import { Router, Request, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import {
  getMinecraftVersions,
  getMinecraftProviders,
  getLatestStableMinecraftVersion,
  searchMinecraftVersions,
  getMinecraftBuilds,
  getRecommendedJavaVersion,
  readServerProperties,
  writeServerProperties,
  writeMinecraftEula,
  downloadMinecraftServerJar,
  discoverJavaBinaries,
  runJavaInstallation,
  javaInstallProgress
} from '../minecraftService';
import { getServerDir, startServer, stopServer, appendConsoleLog } from '../provider';
import { dispatchWebhookEvent } from '../webhookService';
import fs from 'fs';
import path from 'path';

const router = Router();

// GET /api/v1/minecraft/providers - Query supported software providers
router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: getMinecraftProviders()
  });
});

// GET /api/v1/minecraft/versions/latest - Query latest stable version for software
router.get('/versions/latest', async (req: Request, res: Response) => {
  try {
    const software = (req.query.software as string) || 'paper';
    const latest = await getLatestStableMinecraftVersion(software);
    res.json({
      success: true,
      data: { software, latest, recommendedJava: getRecommendedJavaVersion(latest) }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_LATEST_FAILED', message: err.message } });
  }
});

// GET /api/v1/minecraft/versions/search - Search versions dynamically
router.get('/versions/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const software = (req.query.software as string) || 'paper';
    const results = await searchMinecraftVersions(q, software);
    res.json({
      success: true,
      data: { query: q, software, versions: results }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SEARCH_FAILED', message: err.message } });
  }
});

// GET /api/v1/minecraft/versions - Query supported versions for software
router.get('/versions', async (req: Request, res: Response) => {
  try {
    const software = (req.query.software as string) || 'paper';
    const versionInfo = await getMinecraftVersions(software);
    res.json({
      success: true,
      data: versionInfo
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'VERSION_FETCH_FAILED', message: err.message }
    });
  }
});

// GET /api/v1/minecraft/:software/versions - Query versions for specific software
router.get('/:software/versions', async (req: Request, res: Response) => {
  try {
    const software = req.params.software;
    const versionInfo = await getMinecraftVersions(software);
    res.json({
      success: true,
      data: versionInfo
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SOFTWARE_VERSIONS_FAILED', message: err.message } });
  }
});

// GET /api/v1/minecraft/:software/:version/builds - Query builds/artifacts for software version
router.get('/:software/:version/builds', async (req: Request, res: Response) => {
  try {
    const { software, version } = req.params;
    const buildsInfo = await getMinecraftBuilds(software, version);
    res.json({
      success: true,
      data: buildsInfo
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'BUILDS_FETCH_FAILED', message: err.message } });
  }
});

// Helper for server access check
async function checkServerAccess(req: AuthenticatedRequest, res: Response, serverId: string, requiredPermission?: string) {
  const db = await getDb();
  const server = db.servers.find(s => s.id === serverId);

  if (!server) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });
    return null;
  }

  const isOwner = server.userId === req.user!.id;
  const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user!.role);
  const subuser = db.subusers?.find(s => s.serverId === serverId && s.userId === req.user!.id);

  if (!isOwner && !isAdmin) {
    if (!subuser) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this server.' } });
      return null;
    }

    if (requiredPermission && !subuser.permissions.includes(requiredPermission)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `Required permission '${requiredPermission}' is missing.` } });
      return null;
    }
  }

  return { server, db, isOwner, isAdmin, subuser };
}

// GET /api/v1/minecraft/:id/properties - Get parsed server.properties
router.get('/:id/properties', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  try {
    const properties = readServerProperties(req.params.id);
    res.json({
      success: true,
      data: {
        properties,
        recommendedJava: getRecommendedJavaVersion(access.server.version)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PROPERTIES_ERROR', message: err.message } });
  }
});

// PUT /api/v1/minecraft/:id/properties - Update server.properties
router.put('/:id/properties', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  try {
    const { properties } = req.body;
    if (!properties || typeof properties !== 'object') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PROPERTIES', message: 'Properties object required' } });
    }

    // Force serverPort to match server allocation to avoid desync
    properties.serverPort = access.server.primaryPort;

    writeServerProperties(req.params.id, properties);

    await createAuditLog(
      req.user!.id, req.user!.email, req.user!.role,
      'UPDATE_SERVER_PROPERTIES', req.params.id,
      `Updated Minecraft server.properties on '${access.server.name}'`
    );

    res.json({
      success: true,
      message: 'Server properties saved successfully. Restart server to apply changes.',
      data: { properties: readServerProperties(req.params.id) }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SAVE_FAILED', message: err.message } });
  }
});

// POST /api/v1/minecraft/:id/eula - Accept EULA explicitly
router.post('/:id/eula', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { accepted } = req.body;
  writeMinecraftEula(req.params.id, accepted !== false);

  res.json({
    success: true,
    message: accepted !== false ? 'Mojang EULA accepted.' : 'Mojang EULA declined.'
  });
});

// POST /api/v1/minecraft/:id/reinstall - Full reinstallation or version change
router.post('/:id/reinstall', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server, db } = access;
  const { software, version, preserveData } = req.body;

  const targetSoftware = software || server.software || 'Paper';
  let targetVersion = version || server.version;
  if (!targetVersion) {
    try {
      const verInfo = await getMinecraftVersions(targetSoftware);
      targetVersion = verInfo.latest;
    } catch {
      targetVersion = '26.2';
    }
  }

  try {
    // 1. Stop active process
    await stopServer(server.id);

    server.status = 'installing';
    server.deploymentState = 'INSTALLING';
    saveDbSync();

    const dir = getServerDir(server.id);

    // 2. Wipe non-preserved files if preserveData is false
    if (!preserveData && fs.existsSync(dir)) {
      appendConsoleLog(server.id, `[AetherInstaller/WARN]: Wiping server workspace for clean reinstallation...`);
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const full = path.join(dir, entry);
        try {
          fs.rmSync(full, { recursive: true, force: true });
        } catch (e) {}
      }
    }

    // 3. Download target JAR
    appendConsoleLog(server.id, `[AetherInstaller/INFO]: Installing ${targetSoftware} ${targetVersion}...`);
    await downloadMinecraftServerJar(server.id, targetSoftware, targetVersion);

    // 4. Generate configs
    writeMinecraftEula(server.id, true);
    writeServerProperties(server.id, {
      serverPort: server.primaryPort,
      motd: `§bAetherPanel §7- ${server.name}`
    });

    // 5. Update server metadata
    server.software = targetSoftware;
    server.version = targetVersion;
    server.status = 'stopped';
    server.deploymentState = 'READY';
    server.updatedAt = new Date().toISOString();
    saveDbSync();

    await createAuditLog(
      req.user!.id, req.user!.email, req.user!.role,
      'REINSTALL_MINECRAFT', server.id,
      `Reinstalled '${server.name}' to ${targetSoftware} ${targetVersion} (Preserve Data: ${Boolean(preserveData)})`
    );

    appendConsoleLog(server.id, `[AetherInstaller/SUCCESS]: Installation finished. Server is ready to start.`);

    res.json({
      success: true,
      message: `Minecraft server reinstalled to ${targetSoftware} ${targetVersion}.`,
      data: {
        server
      }
    });
  } catch (err: any) {
    server.status = 'error';
    server.deploymentState = 'FAILED';
    saveDbSync();
    res.status(500).json({ success: false, error: { code: 'REINSTALL_FAILED', message: err.message } });
  }
});

// GET /api/v1/minecraft/java-runtimes - Query discovered Java runtimes
router.get('/java-runtimes', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const runtimes = discoverJavaBinaries();
    res.json({
      success: true,
      data: runtimes
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DISCOVERY_FAILED', message: err.message } });
  }
});

// GET /api/v1/minecraft/install-java/status - Query progress of Java installer
router.get('/install-java/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: javaInstallProgress
  });
});

// POST /api/v1/minecraft/install-java - Install missing Java runtime (Admin only)
router.post('/install-java', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user!.role);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can install Java runtimes.' } });
    }

    const { version } = req.body;
    const vNum = parseInt(version, 10);
    if (isNaN(vNum) || ![8, 11, 17, 21, 25].includes(vNum)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_VERSION', message: 'Valid versions are 8, 11, 17, 21, 25' } });
    }

    if (javaInstallProgress.status === 'installing') {
      return res.status(409).json({ success: false, error: { code: 'ALREADY_RUNNING', message: `An installation for Java ${javaInstallProgress.version} is already in progress.` } });
    }

    // Trigger installation asynchronously
    runJavaInstallation(vNum);

    await createAuditLog(
      req.user!.id, req.user!.email, req.user!.role,
      'INSTALL_JAVA', 'SYSTEM',
      `Triggered installation of Java ${vNum}`
    );

    res.json({
      success: true,
      message: `Asynchronous background installation of Java ${vNum} started.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INSTALL_TRIGGER_FAILED', message: err.message } });
  }
});

export default router;
