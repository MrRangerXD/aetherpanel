import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { checkServerAccess, checkServerStateSafety, logServerAudit } from '../middleware/serverAuth';
import { getServerDir, safePath } from '../provider';
import { InstalledPlugin, PluginSidecarEntry, PluginUpdate, ModrinthVersion } from '../../src/types';

export const pluginsRouter = Router({ mergeParams: true });

// Bukkit software family allowed to install plugins
const BUKKIT_FAMILY = new Set(['paper', 'spigot', 'purpur', 'bukkit', 'folia']);
const PROXY_FAMILY = new Set(['velocity', 'bungeecord', 'waterfall']);

function getPluginsDir(serverId: string): string {
  const pDir = path.join(getServerDir(serverId), 'plugins');
  if (!fs.existsSync(pDir)) {
    fs.mkdirSync(pDir, { recursive: true });
  }
  return pDir;
}

function getSidecarPath(serverId: string): string {
  return path.join(getServerDir(serverId), '.plugins.json');
}

function readSidecar(serverId: string): Record<string, PluginSidecarEntry> {
  const sidecar = getSidecarPath(serverId);
  if (!fs.existsSync(sidecar)) return {};
  try {
    return JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSidecar(serverId: string, data: Record<string, PluginSidecarEntry>): void {
  try {
    fs.writeFileSync(getSidecarPath(serverId), JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

function sanitizeJarFilename(name: string): string {
  let clean = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!clean.endsWith('.jar') && !clean.endsWith('.jar.disabled')) {
    clean += '.jar';
  }
  return clean;
}

// -----------------------------------------------------------------------------
// GET /servers/:id/plugins/installed
// -----------------------------------------------------------------------------
pluginsRouter.get('/installed', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
  if (!access) return;

  const pluginsDir = getPluginsDir(access.server.id);
  const sidecar = readSidecar(access.server.id);

  try {
    const files = fs.readdirSync(pluginsDir);
    const installed: InstalledPlugin[] = [];

    for (const file of files) {
      if (file.endsWith('.jar') || file.endsWith('.jar.disabled')) {
        const fullPath = path.join(pluginsDir, file);
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
          name: meta.name || file.replace(/\.jar(\.disabled)?$/, '')
        });
      }
    }

    res.json({
      success: true,
      data: installed,
      total: installed.length,
      serverSoftware: access.server.software,
      isBukkit: BUKKIT_FAMILY.has((access.server.software || '').toLowerCase()),
      isProxy: PROXY_FAMILY.has((access.server.software || '').toLowerCase())
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'IO_ERROR', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// GET /servers/:id/plugins/search (Modrinth Proxy with Loader & Game Version facets)
// -----------------------------------------------------------------------------
pluginsRouter.get('/search', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
  if (!access) return;

  const q = String(req.query.q || '');
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'))));
  const offset = Math.max(0, parseInt(String(req.query.offset || '0')));

  try {
    const facets = [
      ['project_type:plugin'],
      ['categories:spigot', 'categories:paper', 'categories:purpur', 'categories:bukkit']
    ];

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
    res.json({ success: true, data: data.hits, total: data.total_hits });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// GET /servers/:id/plugins/versions/:projectId
// -----------------------------------------------------------------------------
pluginsRouter.get('/versions/:projectId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
  if (!access) return;

  const { projectId } = req.params;
  const serverMcVersion = (access.server.version || '').replace(/[^0-9.]/g, '');

  try {
    const url = `https://api.modrinth.com/v2/project/${projectId}/version`;
    const response = await fetch(url, { headers: { 'User-Agent': 'AetherPanel/2.6.0' } });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: { code: 'MODRINTH_ERROR', message: 'Failed to fetch project versions' }
      });
    }

    const versions: ModrinthVersion[] = await response.json();
    const sidecar = readSidecar(access.server.id);
    const installedProjectIds = new Set(Object.values(sidecar).map(s => s.projectId).filter(Boolean));

    const enriched = versions.map(v => {
      const isGameVersionMatch = !serverMcVersion || v.game_versions.includes(serverMcVersion);
      const isLoaderMatch = v.loaders.some(l => BUKKIT_FAMILY.has(l.toLowerCase()));

      let compatibilityReason = '';
      if (!isGameVersionMatch) compatibilityReason = `Requires MC ${v.game_versions.slice(0, 3).join(', ')}`;
      else if (!isLoaderMatch) compatibilityReason = `Requires loader: ${v.loaders.join(', ')}`;

      const missingDependencies = (v.dependencies || [])
        .filter(d => d.dependency_type === 'required' && d.project_id && !installedProjectIds.has(d.project_id));

      return {
        ...v,
        compatible: isGameVersionMatch && isLoaderMatch,
        compatibilityReason,
        missingDependencies
      };
    });

    res.json({ success: true, data: enriched, serverVersion: serverMcVersion });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// POST /servers/:id/plugins/install
// -----------------------------------------------------------------------------
const InstallPluginSchema = z.object({
  source: z.enum(['modrinth', 'hangar']).default('modrinth'),
  projectId: z.string().min(1),
  versionId: z.string().optional(),
  replace: z.boolean().optional()
});

pluginsRouter.post('/install', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const sw = (access.server.software || '').toLowerCase();
  if (!BUKKIT_FAMILY.has(sw)) {
    if (PROXY_FAMILY.has(sw)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PROXY_SERVER',
          message: 'Proxy servers (Velocity/BungeeCord) do not support Bukkit plugins. Please upload proxy plugins manually.'
        }
      });
    }
    return res.status(400).json({
      success: false,
      error: {
        code: 'INCOMPATIBLE_SOFTWARE',
        message: `Plugin installation is only supported on Bukkit/Paper/Purpur/Spigot. Current software is '${access.server.software}'.`
      }
    });
  }

  const parsed = InstallPluginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') }
    });
  }

  const { projectId, versionId, replace } = parsed.data;
  const serverMcVersion = (access.server.version || '').replace(/[^0-9.]/g, '');

  try {
    let targetVersion: ModrinthVersion | null = null;
    if (versionId) {
      const vRes = await fetch(`https://api.modrinth.com/v2/version/${versionId}`, {
        headers: { 'User-Agent': 'AetherPanel/2.6.0' }
      });
      if (vRes.ok) targetVersion = await vRes.json();
    } else {
      // Find latest version matching game version & loaders
      const vListRes = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`, {
        headers: { 'User-Agent': 'AetherPanel/2.6.0' }
      });
      if (vListRes.ok) {
        const versions: ModrinthVersion[] = await vListRes.json();
        targetVersion = versions.find(v =>
          (!serverMcVersion || v.game_versions.includes(serverMcVersion)) &&
          v.loaders.some(l => BUKKIT_FAMILY.has(l.toLowerCase()))
        ) || versions[0] || null;
      }
    }

    if (!targetVersion || !targetVersion.files || targetVersion.files.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_MATCHING_VERSION', message: 'No compatible plugin version found for this Minecraft build.' }
      });
    }

    const primaryFile = targetVersion.files.find(f => f.primary) || targetVersion.files[0];
    const cleanFilename = sanitizeJarFilename(primaryFile.filename);
    const pluginsDir = getPluginsDir(access.server.id);
    let targetPath = path.join(pluginsDir, cleanFilename);

    if (fs.existsSync(targetPath) && !replace) {
      return res.status(409).json({
        success: false,
        error: { code: 'FILE_EXISTS', message: `Plugin file '${cleanFilename}' already exists.` },
        canReplace: true
      });
    }

    // Download the .jar file
    const fileRes = await fetch(primaryFile.url);
    if (!fileRes.ok) {
      return res.status(502).json({
        success: false,
        error: { code: 'DOWNLOAD_FAILED', message: `Failed to download file from ${primaryFile.url}` }
      });
    }

    const buffer = await fileRes.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(buffer));

    // Update sidecar
    const sidecar = readSidecar(access.server.id);
    sidecar[cleanFilename] = {
      projectId,
      version: targetVersion.version_number,
      name: cleanFilename.replace(/\.jar$/, ''),
      source: 'modrinth',
      installedAt: new Date().toISOString()
    };
    writeSidecar(access.server.id, sidecar);

    await logServerAudit(
      req,
      access.server.id,
      'PLUGIN_INSTALL',
      `Installed plugin '${cleanFilename}' (Version: ${targetVersion.version_number})`
    );

    res.json({
      success: true,
      message: `Plugin '${cleanFilename}' installed successfully.`,
      restartRequired: access.server.status === 'running',
      data: {
        filename: cleanFilename,
        version: targetVersion.version_number,
        size: buffer.byteLength
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INSTALL_FAILED', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// POST /servers/:id/plugins/install-file (Direct URL download)
// -----------------------------------------------------------------------------
const InstallFileSchema = z.object({
  url: z.string().url('A valid URL is required'),
  filename: z.string().min(1)
});

pluginsRouter.post('/install-file', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const parsed = InstallFileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') }
    });
  }

  const { url, filename } = parsed.data;
  const cleanFilename = sanitizeJarFilename(filename);
  const pluginsDir = getPluginsDir(access.server.id);
  const targetPath = path.join(pluginsDir, cleanFilename);

  try {
    const fileRes = await fetch(url);
    if (!fileRes.ok) {
      return res.status(502).json({
        success: false,
        error: { code: 'DOWNLOAD_FAILED', message: `Failed to download file: HTTP ${fileRes.status}` }
      });
    }

    const buffer = await fileRes.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(buffer));

    const sidecar = readSidecar(access.server.id);
    sidecar[cleanFilename] = {
      name: cleanFilename.replace(/\.jar$/, ''),
      source: 'direct',
      installedAt: new Date().toISOString()
    };
    writeSidecar(access.server.id, sidecar);

    await logServerAudit(req, access.server.id, 'PLUGIN_INSTALL', `Direct installed plugin '${cleanFilename}'`);

    res.json({
      success: true,
      message: `Plugin '${cleanFilename}' downloaded successfully.`,
      restartRequired: access.server.status === 'running',
      data: { filename: cleanFilename, size: buffer.byteLength }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INSTALL_FAILED', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// DELETE /servers/:id/plugins/:filename
// -----------------------------------------------------------------------------
pluginsRouter.delete('/:filename', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const filename = sanitizeJarFilename(req.params.filename);
  const pluginsDir = getPluginsDir(access.server.id);
  const targetPath = path.join(pluginsDir, filename);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Plugin file '${filename}' does not exist.` }
    });
  }

  try {
    fs.unlinkSync(targetPath);

    const sidecar = readSidecar(access.server.id);
    delete sidecar[filename];
    delete sidecar[filename.replace('.disabled', '')];
    writeSidecar(access.server.id, sidecar);

    await logServerAudit(req, access.server.id, 'PLUGIN_DELETE', `Deleted plugin '${filename}'`);

    res.json({
      success: true,
      message: `Plugin '${filename}' deleted successfully.`,
      restartRequired: access.server.status === 'running'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DELETE_FAILED', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// POST /servers/:id/plugins/:filename/toggle (.jar <-> .jar.disabled)
// -----------------------------------------------------------------------------
pluginsRouter.post('/:filename/toggle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const rawFilename = path.basename(req.params.filename);
  const pluginsDir = getPluginsDir(access.server.id);

  const currentPath = path.join(pluginsDir, rawFilename);
  if (!fs.existsSync(currentPath)) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Plugin file '${rawFilename}' does not exist.` }
    });
  }

  const isCurrentlyDisabled = rawFilename.endsWith('.disabled');
  const newFilename = isCurrentlyDisabled
    ? rawFilename.replace(/\.disabled$/, '')
    : `${rawFilename}.disabled`;

  const newPath = path.join(pluginsDir, newFilename);

  try {
    fs.renameSync(currentPath, newPath);

    const sidecar = readSidecar(access.server.id);
    const meta = sidecar[rawFilename] || sidecar[rawFilename.replace('.disabled', '')];
    if (meta) {
      delete sidecar[rawFilename];
      sidecar[newFilename] = meta;
      writeSidecar(access.server.id, sidecar);
    }

    await logServerAudit(
      req,
      access.server.id,
      'PLUGIN_TOGGLE',
      `Toggled plugin '${rawFilename}' -> '${newFilename}'`
    );

    res.json({
      success: true,
      enabled: isCurrentlyDisabled,
      filename: newFilename,
      message: `Plugin ${isCurrentlyDisabled ? 'enabled' : 'disabled'}.`,
      restartRequired: access.server.status === 'running'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'TOGGLE_FAILED', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// GET /servers/:id/plugins/updates (Check out-of-date plugins against Modrinth)
// -----------------------------------------------------------------------------
pluginsRouter.get('/updates', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
  if (!access) return;

  const sidecar = readSidecar(access.server.id);
  const updates: PluginUpdate[] = [];
  const serverMcVersion = (access.server.version || '').replace(/[^0-9.]/g, '');

  for (const [filename, meta] of Object.entries(sidecar)) {
    if (meta.projectId && meta.version) {
      try {
        const vListRes = await fetch(`https://api.modrinth.com/v2/project/${meta.projectId}/version`, {
          headers: { 'User-Agent': 'AetherPanel/2.6.0' }
        });
        if (vListRes.ok) {
          const versions: ModrinthVersion[] = await vListRes.json();
          const latest = versions.find(v =>
            (!serverMcVersion || v.game_versions.includes(serverMcVersion)) &&
            v.loaders.some(l => BUKKIT_FAMILY.has(l.toLowerCase()))
          );

          if (latest && latest.version_number !== meta.version && latest.files && latest.files[0]) {
            updates.push({
              filename,
              currentVersion: meta.version,
              latestVersion: latest.version_number,
              updateUrl: latest.files[0].url,
              releaseName: latest.name
            });
          }
        }
      } catch {}
    }
  }

  res.json({ success: true, data: updates, total: updates.length });
});
