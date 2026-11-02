import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { checkServerAccess, checkServerStateSafety, logServerAudit } from '../middleware/serverAuth';
import { getServerDir } from '../provider';
import { InstalledMod, ModDependency, ModrinthVersion } from '../../src/types';

export const modsRouter = Router({ mergeParams: true });

const MOD_LOADERS = new Set(['fabric', 'forge', 'neoforge', 'quilt']);

function getModsDir(serverId: string): string {
  const mDir = path.join(getServerDir(serverId), 'mods');
  if (!fs.existsSync(mDir)) {
    fs.mkdirSync(mDir, { recursive: true });
  }
  return mDir;
}

function getSidecarPath(serverId: string): string {
  return path.join(getServerDir(serverId), '.mods.json');
}

function readSidecar(serverId: string): Record<string, any> {
  const sidecar = getSidecarPath(serverId);
  if (!fs.existsSync(sidecar)) return {};
  try {
    return JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSidecar(serverId: string, data: Record<string, any>): void {
  try {
    fs.writeFileSync(getSidecarPath(serverId), JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

function detectServerLoader(software: string = ''): string {
  const sw = software.toLowerCase();
  if (sw.includes('neoforge')) return 'neoforge';
  if (sw.includes('forge')) return 'forge';
  if (sw.includes('quilt')) return 'quilt';
  if (sw.includes('fabric')) return 'fabric';
  return 'fabric'; // Default modern loader
}

function sanitizeJarFilename(name: string): string {
  let clean = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!clean.endsWith('.jar') && !clean.endsWith('.jar.disabled')) {
    clean += '.jar';
  }
  return clean;
}

// -----------------------------------------------------------------------------
// GET /servers/:id/mods/installed
// -----------------------------------------------------------------------------
modsRouter.get('/installed', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'mods.manage');
  if (!access) return;

  const modsDir = getModsDir(access.server.id);
  const sidecar = readSidecar(access.server.id);
  const currentLoader = detectServerLoader(access.server.software);

  try {
    const files = fs.readdirSync(modsDir);
    const installed: InstalledMod[] = [];

    for (const file of files) {
      if (file.endsWith('.jar') || file.endsWith('.jar.disabled')) {
        const fullPath = path.join(modsDir, file);
        const stat = fs.statSync(fullPath);
        const enabled = !file.endsWith('.disabled');
        const meta = sidecar[file] || sidecar[file.replace('.disabled', '')] || {};

        installed.push({
          filename: file,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          enabled,
          projectId: meta.projectId,
          version: meta.version,
          name: meta.name || file.replace(/\.jar(\.disabled)?$/, ''),
          description: meta.description
        });
      }
    }

    res.json({
      success: true,
      data: installed,
      total: installed.length,
      serverSoftware: access.server.software,
      detectedLoader: currentLoader
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'IO_ERROR', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// GET /servers/:id/mods/search (Modrinth Proxy)
// -----------------------------------------------------------------------------
modsRouter.get('/search', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'mods.manage');
  if (!access) return;

  const q = String(req.query.q || '');
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'))));
  const offset = Math.max(0, parseInt(String(req.query.offset || '0')));
  const loader = detectServerLoader(access.server.software);
  const serverMcVersion = (access.server.version || '').replace(/[^0-9.]/g, '');

  try {
    const facets = [
      ['project_type:mod'],
      [`categories:${loader}`]
    ];
    if (serverMcVersion) {
      facets.push([`versions:${serverMcVersion}`]);
    }

    const url = new URL('https://api.modrinth.com/v2/search');
    if (q) url.searchParams.set('query', q);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('facets', JSON.stringify(facets));

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'AetherPanel/2.6.0' }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: { code: 'MODRINTH_ERROR', message: `Modrinth returned status ${response.status}` }
      });
    }

    const data = await response.json();
    res.json({ success: true, data: data.hits, total: data.total_hits, loader });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// GET /servers/:id/mods/dependencies/:projectId
// -----------------------------------------------------------------------------
modsRouter.get('/dependencies/:projectId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'mods.manage');
  if (!access) return;

  const { projectId } = req.params;
  const versionId = req.query.versionId as string;
  const sidecar = readSidecar(access.server.id);
  const installedProjectIds = new Set(Object.values(sidecar).map(s => s.projectId).filter(Boolean));

  try {
    let targetVersion: ModrinthVersion | null = null;
    if (versionId) {
      const vRes = await fetch(`https://api.modrinth.com/v2/version/${versionId}`, {
        headers: { 'User-Agent': 'AetherPanel/2.6.0' }
      });
      if (vRes.ok) targetVersion = await vRes.json();
    } else {
      const vListRes = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`, {
        headers: { 'User-Agent': 'AetherPanel/2.6.0' }
      });
      if (vListRes.ok) {
        const versions: ModrinthVersion[] = await vListRes.json();
        targetVersion = versions[0] || null;
      }
    }

    if (!targetVersion) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Version not found' } });
    }

    const dependencies: ModDependency[] = [];
    for (const dep of targetVersion.dependencies || []) {
      if (dep.project_id) {
        // Fetch project metadata
        let name = dep.project_id;
        try {
          const pRes = await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}`, {
            headers: { 'User-Agent': 'AetherPanel/2.6.0' }
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            name = pData.title || name;
          }
        } catch {}

        dependencies.push({
          projectId: dep.project_id,
          name,
          type: dep.dependency_type as any,
          isInstalled: installedProjectIds.has(dep.project_id)
        });
      }
    }

    res.json({ success: true, data: dependencies });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

// Helper function to install a single Modrinth project
async function downloadAndInstallMod(serverId: string, projectId: string, versionId?: string): Promise<{ filename: string; version: string }> {
  let targetVersion: ModrinthVersion | null = null;
  if (versionId) {
    const vRes = await fetch(`https://api.modrinth.com/v2/version/${versionId}`, {
      headers: { 'User-Agent': 'AetherPanel/2.6.0' }
    });
    if (vRes.ok) targetVersion = await vRes.json();
  } else {
    const vListRes = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`, {
      headers: { 'User-Agent': 'AetherPanel/2.6.0' }
    });
    if (vListRes.ok) {
      const versions: ModrinthVersion[] = await vListRes.json();
      targetVersion = versions[0] || null;
    }
  }

  if (!targetVersion || !targetVersion.files || !targetVersion.files[0]) {
    throw new Error(`No file found for mod project ${projectId}`);
  }

  const primaryFile = targetVersion.files.find(f => f.primary) || targetVersion.files[0];
  const cleanFilename = sanitizeJarFilename(primaryFile.filename);
  const modsDir = getModsDir(serverId);
  const targetPath = path.join(modsDir, cleanFilename);

  const fileRes = await fetch(primaryFile.url);
  if (!fileRes.ok) throw new Error(`Download failed: HTTP ${fileRes.status}`);

  const buffer = await fileRes.arrayBuffer();
  fs.writeFileSync(targetPath, Buffer.from(buffer));

  const sidecar = readSidecar(serverId);
  sidecar[cleanFilename] = {
    projectId,
    version: targetVersion.version_number,
    name: cleanFilename.replace(/\.jar$/, ''),
    installedAt: new Date().toISOString()
  };
  writeSidecar(serverId, sidecar);

  return { filename: cleanFilename, version: targetVersion.version_number };
}

// -----------------------------------------------------------------------------
// POST /servers/:id/mods/install-with-deps
// -----------------------------------------------------------------------------
const InstallWithDepsSchema = z.object({
  projectId: z.string().min(1),
  versionId: z.string().optional(),
  includeOptional: z.array(z.string()).optional()
});

modsRouter.post('/install-with-deps', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'mods.manage');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const parsed = InstallWithDepsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') }
    });
  }

  const { projectId, versionId, includeOptional = [] } = parsed.data;

  try {
    const installedList: string[] = [];

    // Install primary mod
    const mainMod = await downloadAndInstallMod(access.server.id, projectId, versionId);
    installedList.push(mainMod.filename);

    // Fetch dependencies for this version
    let targetVersion: ModrinthVersion | null = null;
    if (versionId) {
      const vRes = await fetch(`https://api.modrinth.com/v2/version/${versionId}`, {
        headers: { 'User-Agent': 'AetherPanel/2.6.0' }
      });
      if (vRes.ok) targetVersion = await vRes.json();
    }

    if (targetVersion?.dependencies) {
      const sidecar = readSidecar(access.server.id);
      const installedProjectIds = new Set(Object.values(sidecar).map(s => s.projectId).filter(Boolean));

      for (const dep of targetVersion.dependencies) {
        if (!dep.project_id) continue;
        const isRequired = dep.dependency_type === 'required';
        const isSelectedOptional = dep.dependency_type === 'optional' && includeOptional.includes(dep.project_id);

        if ((isRequired || isSelectedOptional) && !installedProjectIds.has(dep.project_id)) {
          try {
            const depMod = await downloadAndInstallMod(access.server.id, dep.project_id);
            installedList.push(depMod.filename);
            installedProjectIds.add(dep.project_id);
          } catch (depErr: any) {
            console.error(`Failed to install dependency ${dep.project_id}:`, depErr.message);
          }
        }
      }
    }

    await logServerAudit(
      req,
      access.server.id,
      'MOD_INSTALL',
      `Installed mod '${mainMod.filename}' and ${installedList.length - 1} dependencies`
    );

    res.json({
      success: true,
      message: `Installed ${installedList.length} mod(s) successfully.`,
      restartRequired: access.server.status === 'running',
      installed: installedList
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INSTALL_FAILED', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// POST /servers/:id/mods/import-pack (Modpack support: .mrpack)
// -----------------------------------------------------------------------------
modsRouter.post('/import-pack', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'mods.manage');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const { mrpackPath } = req.body;
  if (!mrpackPath) {
    return res.status(400).json({ success: false, error: { code: 'PATH_REQUIRED', message: 'Path to .mrpack required' } });
  }

  const resolvedPath = path.isAbsolute(mrpackPath)
    ? mrpackPath
    : path.join(getServerDir(access.server.id), mrpackPath);

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '.mrpack file not found' } });
  }

  try {
    const zip = new AdmZip(resolvedPath);
    const indexEntry = zip.getEntry('modrinth.index.json');
    if (!indexEntry) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PACK', message: 'modrinth.index.json missing from pack' } });
    }

    const indexData = JSON.parse(indexEntry.getData().toString('utf-8'));
    const files = indexData.files || [];
    let installedCount = 0;

    for (const fileObj of files) {
      if (fileObj.env?.server === 'unsupported') continue;
      const downloadUrl = fileObj.downloads?.[0];
      if (!downloadUrl) continue;

      const destRel = fileObj.path;
      const targetAbs = path.join(getServerDir(access.server.id), destRel);
      fs.mkdirSync(path.dirname(targetAbs), { recursive: true });

      const dRes = await fetch(downloadUrl);
      if (dRes.ok) {
        const buf = await dRes.arrayBuffer();
        fs.writeFileSync(targetAbs, Buffer.from(buf));
        installedCount++;
      }
    }

    // Extract overrides if present
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.entryName.startsWith('overrides/') && !entry.isDirectory) {
        const rel = entry.entryName.replace(/^overrides\//, '');
        const target = path.join(getServerDir(access.server.id), rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, entry.getData());
      }
    }

    await logServerAudit(req, access.server.id, 'MODPACK_IMPORT', `Imported modpack (${installedCount} files)`);

    res.json({
      success: true,
      message: `Modpack imported successfully with ${installedCount} file(s).`,
      restartRequired: access.server.status === 'running'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'IMPORT_FAILED', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// DELETE /servers/:id/mods/:filename
// -----------------------------------------------------------------------------
modsRouter.delete('/:filename', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'mods.manage');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const filename = sanitizeJarFilename(req.params.filename);
  const modsDir = getModsDir(access.server.id);
  const targetPath = path.join(modsDir, filename);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mod not found' } });
  }

  try {
    fs.unlinkSync(targetPath);
    const sidecar = readSidecar(access.server.id);
    delete sidecar[filename];
    delete sidecar[filename.replace('.disabled', '')];
    writeSidecar(access.server.id, sidecar);

    await logServerAudit(req, access.server.id, 'MOD_DELETE', `Deleted mod '${filename}'`);

    res.json({ success: true, message: `Mod '${filename}' deleted.`, restartRequired: access.server.status === 'running' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DELETE_FAILED', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// POST /servers/:id/mods/:filename/toggle
// -----------------------------------------------------------------------------
modsRouter.post('/:filename/toggle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'mods.manage');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const rawFilename = path.basename(req.params.filename);
  const modsDir = getModsDir(access.server.id);
  const currentPath = path.join(modsDir, rawFilename);

  if (!fs.existsSync(currentPath)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mod file not found' } });
  }

  const isCurrentlyDisabled = rawFilename.endsWith('.disabled');
  const newFilename = isCurrentlyDisabled
    ? rawFilename.replace(/\.disabled$/, '')
    : `${rawFilename}.disabled`;

  const newPath = path.join(modsDir, newFilename);

  try {
    fs.renameSync(currentPath, newPath);

    const sidecar = readSidecar(access.server.id);
    const meta = sidecar[rawFilename] || sidecar[rawFilename.replace('.disabled', '')];
    if (meta) {
      delete sidecar[rawFilename];
      sidecar[newFilename] = meta;
      writeSidecar(access.server.id, sidecar);
    }

    await logServerAudit(req, access.server.id, 'MOD_TOGGLE', `Toggled mod '${rawFilename}' -> '${newFilename}'`);

    res.json({
      success: true,
      enabled: isCurrentlyDisabled,
      filename: newFilename,
      message: `Mod ${isCurrentlyDisabled ? 'enabled' : 'disabled'}.`,
      restartRequired: access.server.status === 'running'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'TOGGLE_FAILED', message: err.message } });
  }
});
