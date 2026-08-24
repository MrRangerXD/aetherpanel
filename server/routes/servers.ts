import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { getDb, saveDbSync } from '../db';
import { parseEnvContent, mergeEnvVariables, serializeEnvLines, EnvLine } from '../utils/envHelper';
import { authMiddleware, requireApiKeyScope, AuthenticatedRequest, createAuditLog } from '../auth';
import {
  startServer, stopServer, restartServer, reinstallServer, killServer,
  validateServerPreflight,
  getServerConsoleLogs, sendServerCommand, listServerFiles,
  readServerFile, writeServerFile, deleteServerItem, deleteServerItems, createServerDirectory,
  renameServerItem, moveServerItems, copyServerItems, compressServerItem, compressServerItems, decompressServerItem,
  readServerEnv, writeServerEnv, recordServerActivity,
  listMinecraftPlugins, toggleMinecraftPlugin, getServerDir, safePath,
  installServerDependencies, clearConsoleBuffer
} from '../provider';
import { closeServerConsoleClients } from '../consoleWs';
import {
  getPlayitStatus, installPlayitAgent, togglePlayitAgent, provisionPlayitSecret, uninstallPlayitAgent
} from '../playitService';
import { searchRealPlugins, downloadPluginJar } from '../pluginProviders';
import { createRealBackupProcess, restoreRealBackupProcess, deleteRealBackupProcess, getBackupFilePath } from '../backups';
import { calculateNextRunAt } from '../scheduler';
import { ServerBackup, ServerDatabase, ServerSchedule, ServerActivity } from '../../src/types';
import { dispatchWebhookEvent } from '../webhookService';
import { resolveServerSftpInfo } from '../sftpResolver';
import { resolveServerPublicEndpoint } from '../network/endpointResolver';
import { getNodePlayitStatus } from '../playit/playitService';
import { resolveServerType } from './serverTypes';

const router = Router();

// Multer storage for server file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const serverId = req.params.id;
      const relPath = (req.query.path as string) || (req.body.path as string) || '';
      const targetDir = safePath(serverId, relPath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      cb(null, targetDir);
    } catch (err: any) {
      cb(new Error(`Access denied: ${err.message}`), '');
    }
  },
  filename: (req, file, cb) => {
    const safeName = path.basename(file.originalname).replace(/[\/\\]/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit per file
});

// Helper to check server ownership or admin power
async function checkServerAccess(req: AuthenticatedRequest, res: Response, serverId: string) {
  const db = await getDb();
  const server = db.servers.find(s => s.id === serverId);

  if (!server) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });
    return null;
  }

  const isOwner = server.userId === req.user!.id;
  const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user!.role);

  if (!isOwner && !isAdmin) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this server.' } });
    return null;
  }

  return { server, db };
}

// GET /api/v1/servers - List user's servers
router.get('/', authMiddleware, requireApiKeyScope('servers:read'), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userServers = db.servers.filter(s => s.userId === req.user!.id).map(srv => ({
    ...srv,
    serverType: resolveServerType(srv, db.serverTypes || [])
  }));
  res.json({ success: true, data: userServers });
});

// GET /api/v1/servers/:id - Server details
router.get('/:id', authMiddleware, requireApiKeyScope('servers:read'), async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server, db } = access;
  const node = db.nodes.find(n => n.id === server.nodeId);
  const product = db.products.find(p => p.id === server.productId);
  const plan = db.plans.find(p => p.id === server.planId);
  const sftp = await resolveServerSftpInfo(server.id, req.get('host'));

  const playitStatus = node ? await getNodePlayitStatus(node.id).catch(() => null) : null;
  const publicEndpoint = resolveServerPublicEndpoint(server, node, playitStatus);

  res.json({
    success: true,
    data: {
      server: {
        ...server,
        serverType: resolveServerType(server, db.serverTypes || []),
        resolvedPublicEndpoint: publicEndpoint.endpoint,
        endpointSource: publicEndpoint.source,
        isExternallyReachable: publicEndpoint.isExternallyReachable
      },
      node: node ? {
        id: node.id,
        name: node.name,
        locationName: node.locationName,
        flagCode: node.flagCode,
        fqdn: node.fqdn,
        publicIpv4: node.publicIpv4,
        publicIpv6: node.publicIpv6,
        daemonPort: node.daemonPort,
        sftpPort: node.sftpPort
      } : null,
      product,
      plan,
      sftp,
      publicEndpoint
    }
  });
});

// GET /api/v1/servers/:id/sftp - Resolved public SFTP Connection details
router.get('/:id/sftp', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const sftpInfo = await resolveServerSftpInfo(req.params.id, req.get('host'));
  res.json({
    success: true,
    data: sftpInfo
  });
});

// POST /api/v1/servers/:id/power - Power actions
router.post('/:id/power', authMiddleware, requireApiKeyScope('servers:control'), async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server } = access;
  const { action } = req.body; // 'start', 'stop', 'restart', 'kill', 'reinstall'

  let success = false;
  if (action === 'start') {
    success = await startServer(server.id);
  } else if (action === 'stop') {
    success = await stopServer(server.id);
  } else if (action === 'restart') {
    success = await restartServer(server.id);
  } else if (action === 'kill') {
    success = await killServer(server.id);
  } else if (action === 'reinstall') {
    success = await reinstallServer(server.id);
  } else {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: 'Invalid power action.' } });
  }

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    `SERVER_POWER_${action.toUpperCase()}`, server.id,
    `Executed ${action} on server ${server.name}`
  );

  dispatchWebhookEvent(`server.${action}`, {
    serverId: server.id,
    serverName: server.name,
    userId: server.userId,
    action,
    timestamp: new Date().toISOString()
  }, server.userId).catch(() => {});

  res.json({ success, message: `Server power action '${action}' processed.`, data: { serverId: server.id, action } });
});

// GET /api/v1/servers/:id/preflight - Validate environment & runtime preflight
router.get('/:id/preflight', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const preflight = await validateServerPreflight(req.params.id);
  res.json({ success: true, data: preflight });
});

// PATCH /api/v1/servers/:id - Update server metadata, startup configuration, and environment variables
router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server, db } = access;
  const { name, startup, envVars, description } = req.body;

  if (typeof name === 'string' && name.trim()) {
    server.name = name.trim();
  }

  if (startup && typeof startup === 'object') {
    server.startup = {
      ...(server.startup || {}),
      ...startup
    };
  }

  if (Array.isArray(envVars)) {
    server.envVars = envVars;
    // Also synchronize key-values to .env file
    const envObj: Record<string, string> = {};
    for (const item of envVars) {
      if (item && item.key) {
        envObj[item.key.trim()] = item.value || '';
      }
    }
    writeServerEnv(server.id, envObj);
  }

  saveDbSync();

  await recordServerActivity(
    server.id, req.user!.id, req.user!.username,
    'SETTINGS_UPDATE', 'Updated server configuration & startup flags'
  );

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'SERVER_UPDATE_SETTINGS', server.id,
    `Updated settings & startup profile for ${server.name}`
  );

  res.json({ success: true, message: 'Server settings saved successfully.', data: { server } });
});

// GET /api/v1/servers/:id/console - Console logs
router.get('/:id/console', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const logs = await getServerConsoleLogs(req.params.id);
  res.json({ success: true, data: { logs } });
});

// POST /api/v1/servers/:id/command - Send console command
router.post('/:id/command', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_COMMAND', message: 'Command required.' } });
  }

  const result = await sendServerCommand(req.params.id, command);
  res.json({ success: true, data: { result } });
});

// GET /api/v1/servers/:id/files - List files
router.get('/:id/files', authMiddleware, requireApiKeyScope('files:read'), async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const relPath = (req.query.path as string) || '';
  try {
    const files = listServerFiles(req.params.id, relPath);
    res.json({ success: true, data: { path: relPath, files }, files });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'FILE_ERROR', message: err.message } });
  }
});

// GET /api/v1/servers/:id/files/content - Read file
router.get('/:id/files/content', authMiddleware, requireApiKeyScope('files:read'), async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ success: false, error: { code: 'PATH_REQUIRED', message: 'File path required' } });

  try {
    const content = readServerFile(req.params.id, filePath);
    res.json({ success: true, data: { path: filePath, content } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'FILE_ERROR', message: err.message } });
  }
});

// POST /api/v1/servers/:id/files/content - Write file
router.post('/:id/files/content', authMiddleware, requireApiKeyScope('files:write'), async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ success: false, error: { code: 'PATH_REQUIRED', message: 'File path required' } });

  try {
    writeServerFile(req.params.id, filePath, content || '');
    res.json({ success: true, message: 'File saved successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'FILE_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/servers/:id/files - Delete file or folder (single or multiple)
router.delete('/:id/files', authMiddleware, requireApiKeyScope('files:write'), async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const filePath = req.query.path as string;
  const paths = req.body?.paths as string[];

  if (paths && Array.isArray(paths) && paths.length > 0) {
    try {
      const result = deleteServerItems(req.params.id, paths);
      await recordServerActivity(
        req.params.id, req.user!.id, req.user!.username,
        'FILE_DELETE', `Deleted ${result.succeeded.length} files/folders.`
      );
      return res.json({
        success: result.failed.length === 0,
        message: `Deleted ${result.succeeded.length} items.`,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: { code: 'FILE_ERROR', message: err.message } });
    }
  }

  if (!filePath) return res.status(400).json({ success: false, error: { code: 'PATH_REQUIRED', message: 'Path required' } });

  try {
    deleteServerItem(req.params.id, filePath);
    await recordServerActivity(
      req.params.id, req.user!.id, req.user!.username,
      'FILE_DELETE', `Deleted: ${filePath}`
    );
    res.json({ success: true, message: 'Item deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'FILE_ERROR', message: err.message } });
  }
});

// POST /api/v1/servers/:id/files/bulk-delete - Explicit bulk delete
router.post('/:id/files/bulk-delete', authMiddleware, requireApiKeyScope('files:write'), async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { paths } = req.body;
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'PATHS_REQUIRED', message: 'Array of paths required' } });
  }

  try {
    const result = deleteServerItems(req.params.id, paths);
    await recordServerActivity(
      req.params.id, req.user!.id, req.user!.username,
      'FILE_DELETE', `Bulk deleted ${result.succeeded.length} items.`
    );
    res.json({
      success: result.failed.length === 0,
      message: `Deleted ${result.succeeded.length} items.${result.failed.length > 0 ? ` (${result.failed.length} failed)` : ''}`,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'BULK_DELETE_ERROR', message: err.message } });
  }
});

// POST /api/v1/servers/:id/files/move - Move file(s) or folder(s)
router.post('/:id/files/move', authMiddleware, requireApiKeyScope('files:write'), async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { sources, destinationDir, conflictStrategy } = req.body;
  const sourceList = Array.isArray(sources) ? sources : (sources ? [sources] : []);

  if (sourceList.length === 0 || typeof destinationDir !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'sources array and destinationDir string are required.' }
    });
  }

  try {
    const result = moveServerItems(req.params.id, sourceList, destinationDir, conflictStrategy || 'replace');
    await recordServerActivity(
      req.params.id, req.user!.id, req.user!.username,
      'FILE_MOVE', `Moved ${result.moved.length} items into ${destinationDir}`
    );
    res.json({
      success: result.errors.length === 0,
      message: `Moved ${result.moved.length} items into ${destinationDir || '/'}.`,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'MOVE_FAILED', message: err.message } });
  }
});

// POST /api/v1/servers/:id/files/copy - Copy file(s) or folder(s)
router.post('/:id/files/copy', authMiddleware, requireApiKeyScope('files:write'), async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { sources, destinationDir, conflictStrategy } = req.body;
  const sourceList = Array.isArray(sources) ? sources : (sources ? [sources] : []);

  if (sourceList.length === 0 || typeof destinationDir !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'sources array and destinationDir string are required.' }
    });
  }

  try {
    const result = copyServerItems(req.params.id, sourceList, destinationDir, conflictStrategy || 'replace');
    await recordServerActivity(
      req.params.id, req.user!.id, req.user!.username,
      'FILE_COPY', `Copied ${result.copied.length} items into ${destinationDir}`
    );
    res.json({
      success: result.errors.length === 0,
      message: `Copied ${result.copied.length} items into ${destinationDir || '/'}.`,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'COPY_FAILED', message: err.message } });
  }
});

// POST /api/v1/servers/:id/files/mkdir - Create directory
router.post('/:id/files/mkdir', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ success: false, error: { code: 'PATH_REQUIRED', message: 'Folder path required' } });

  try {
    createServerDirectory(req.params.id, dirPath);
    res.json({ success: true, message: 'Folder created.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'FILE_ERROR', message: err.message } });
  }
});

// POST /api/v1/servers/:id/files/upload - Upload file(s)
router.post('/:id/files/upload', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  upload.array('files', 20)(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message || 'File upload failed.' } });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_FILES', message: 'No files provided.' } });
    }

    const uploadedNames = files.map(f => f.originalname);
    await recordServerActivity(
      req.params.id, req.user!.id, req.user!.username,
      'FILE_UPLOAD', `Uploaded files: ${uploadedNames.join(', ')}`
    );

    res.json({
      success: true,
      message: `Uploaded ${files.length} file(s) successfully.`,
      data: { filenames: uploadedNames }
    });
  });
});

// POST /api/v1/servers/:id/files/rename - Rename file or folder
router.post('/:id/files/rename', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Both oldPath and newPath are required.' } });
  }

  try {
    renameServerItem(req.params.id, oldPath, newPath);
    res.json({ success: true, message: 'Renamed successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'RENAME_FAILED', message: err.message } });
  }
});

// GET /api/v1/servers/:id/files/download - Download file
router.get('/:id/files/download', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const relPath = req.query.path as string;
  if (!relPath) return res.status(400).json({ success: false, error: { code: 'PATH_REQUIRED', message: 'Path parameter is required.' } });

  try {
    const targetPath = safePath(req.params.id, relPath);
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found.' } });
    }
    res.download(targetPath, path.basename(targetPath));
  } catch (err: any) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: err.message } });
  }
});

// POST /api/v1/servers/:id/files/compress - Create ZIP archive (single or multiple items)
router.post('/:id/files/compress', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { path: relPath, paths, outputName, currentDir } = req.body;
  const targetPaths = Array.isArray(paths) && paths.length > 0 ? paths : (relPath ? [relPath] : []);

  if (targetPaths.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'PATHS_REQUIRED', message: 'Paths to compress required.' } });
  }

  try {
    const zipRel = compressServerItems(req.params.id, targetPaths, outputName, currentDir || '/');
    await recordServerActivity(
      req.params.id, req.user!.id, req.user!.username,
      'FILE_COMPRESS', `Compressed ${targetPaths.length} items into ${zipRel}`
    );
    res.json({ success: true, message: 'Compressed into ZIP archive.', data: { zipPath: zipRel } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'COMPRESS_FAILED', message: err.message } });
  }
});

// POST /api/v1/servers/:id/files/decompress - Extract ZIP archive
router.post('/:id/files/decompress', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { path: zipRelPath, destinationDir } = req.body;
  if (!zipRelPath) {
    return res.status(400).json({ success: false, error: { code: 'PATH_REQUIRED', message: 'ZIP file path required.' } });
  }

  try {
    decompressServerItem(req.params.id, zipRelPath, destinationDir);
    await recordServerActivity(
      req.params.id, req.user!.id, req.user!.username,
      'FILE_DECOMPRESS', `Extracted archive ${zipRelPath}`
    );
    res.json({ success: true, message: 'Extracted ZIP archive successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'DECOMPRESS_FAILED', message: err.message } });
  }
});

// PATCH /api/v1/servers/:id - Update server name and settings
router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server, db } = access;
  const { name, software, version } = req.body;

  if (name && typeof name === 'string' && name.trim()) {
    server.name = name.trim();
  }
  if (software) server.software = software;
  if (version) server.version = version;
  server.updatedAt = new Date().toISOString();

  saveDbSync();

  await recordServerActivity(
    server.id, req.user!.id, req.user!.username,
    'SERVER_RENAME', `Updated server settings: name="${server.name}"`
  );

  res.json({ success: true, message: 'Server settings saved.', data: server });
});

// POST /api/v1/servers/:id/reinstall - Reinstall server
router.post('/:id/reinstall', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server } = access;
  const success = await reinstallServer(server.id);

  if (!success) {
    return res.status(500).json({ success: false, error: { code: 'REINSTALL_FAILED', message: 'Reinstallation process failed.' } });
  }

  await recordServerActivity(
    server.id, req.user!.id, req.user!.username,
    'SERVER_REINSTALL', `Initiated full server reinstallation`
  );

  res.json({ success: true, message: 'Server reinstallation started successfully.' });
});

// --- MINECRAFT PLUGINS ---
// GET /api/v1/servers/:id/plugins - List installed plugins
router.get('/:id/plugins', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const plugins = listMinecraftPlugins(req.params.id);
  res.json({ success: true, data: plugins });
});

// POST /api/v1/servers/:id/plugins/search - Search plugins repository via Modrinth/Hangar APIs
router.post('/:id/plugins/search', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { query } = req.body;
  try {
    const results = await searchRealPlugins(query || '');
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SEARCH_FAILED', message: err.message || 'Plugin search failed.' } });
  }
});

// POST /api/v1/servers/:id/plugins/install - Install plugin by downloading real .jar
router.post('/:id/plugins/install', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { name, downloadUrl, projectId, provider } = req.body;
  if (!name) return res.status(400).json({ success: false, error: { code: 'NAME_REQUIRED', message: 'Plugin name required.' } });

  try {
    const result = await downloadPluginJar(req.params.id, name, downloadUrl, projectId, provider);

    await recordServerActivity(
      req.params.id, req.user!.id, req.user!.username,
      'PLUGIN_INSTALL', `Installed plugin ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`
    );

    res.json({
      success: true,
      message: `Plugin '${name}' installed successfully to plugins/${result.filename}`,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'INSTALL_FAILED', message: err.message } });
  }
});

// POST /api/v1/servers/:id/plugins/toggle - Enable or disable plugin
router.post('/:id/plugins/toggle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { filename } = req.body;
  try {
    const isNowEnabled = toggleMinecraftPlugin(req.params.id, filename);
    res.json({
      success: true,
      message: `Plugin is now ${isNowEnabled ? 'enabled' : 'disabled'}.`
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'TOGGLE_FAILED', message: err.message } });
  }
});

// DELETE /api/v1/servers/:id/plugins/:filename - Delete plugin
router.delete('/:id/plugins/:filename', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { filename } = req.params;
  const baseDir = getServerDir(req.params.id);
  const targetPath = path.join(baseDir, 'plugins', filename);

  if (targetPath.startsWith(baseDir) && fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }

  res.json({ success: true, message: 'Plugin file deleted.' });
});

// --- ENVIRONMENT VARIABLES (BOT HOSTING) ---
// GET /api/v1/servers/:id/env
router.get('/:id/env', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server } = access;
  const baseDir = getServerDir(req.params.id);
  
  // Optional custom file path query param (can be passed when user selects a file or triggers a reload)
  const queryPath = req.query.filePath as string;
  const resolvedPath = queryPath || server.selectedEnvPath;

  if (resolvedPath) {
    const targetPath = path.join(baseDir, resolvedPath);
    if (!targetPath.startsWith(baseDir)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PATH', message: 'Access denied: Path is outside the server root' }
      });
    }

    if (!fs.existsSync(targetPath)) {
      return res.json({
        success: true,
        data: {
          env: {},
          envVars: [],
          selectedEnvPath: resolvedPath,
          exists: false
        }
      });
    }

    try {
      const content = fs.readFileSync(targetPath, 'utf-8');
      const lines = parseEnvContent(content);
      const parsedVars = lines
        .filter(l => l.type === 'variable')
        .map(l => ({
          key: l.key!,
          value: l.value!,
          isSecret: /token|secret|key|password|auth/i.test(l.key!),
          isEnabled: true
        }));
      
      const envMap: Record<string, string> = {};
      for (const item of parsedVars) {
        envMap[item.key] = item.value;
      }

      return res.json({
        success: true,
        data: {
          env: envMap,
          envVars: parsedVars,
          selectedEnvPath: resolvedPath,
          exists: true
        }
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'PARSE_ERROR', message: `Failed to parse .env file: ${err.message}` }
      });
    }
  }

  // Fallback to default behavior (root .env file)
  const envMap = readServerEnv(req.params.id);
  res.json({
    success: true,
    data: {
      env: envMap,
      envVars: server.envVars || [],
      selectedEnvPath: null,
      exists: fs.existsSync(path.join(baseDir, '.env'))
    }
  });
});

// PUT /api/v1/servers/:id/env
router.put('/:id/env', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server } = access;
  const { envVars, selectedEnvPath, createFile } = req.body;

  const baseDir = getServerDir(req.params.id);
  const targetPath = selectedEnvPath ? path.join(baseDir, selectedEnvPath) : path.join(baseDir, '.env');

  // Path safety verification
  if (!targetPath.startsWith(baseDir)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PATH', message: 'Access denied: Path is outside the server root' }
    });
  }

  // 18. VARIABLE KEY VALIDATION
  if (Array.isArray(envVars)) {
    const keys = new Set<string>();
    for (const item of envVars) {
      if (!item || !item.key) continue;
      const key = item.key.trim();
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_KEY', message: `Invalid environment variable key: "${key}". Keys must start with a letter or underscore and contain only alphanumeric characters and underscores.` }
        });
      }
      if (keys.has(key)) {
        return res.status(400).json({
          success: false,
          error: { code: 'DUPLICATE_KEY', message: `Duplicate key detected: "${key}". Duplicate environment variable keys are not allowed.` }
        });
      }
      keys.add(key);
    }
  }

  // Check if file exists when selectedEnvPath is given
  if (selectedEnvPath) {
    const exists = fs.existsSync(targetPath);
    if (!exists && !createFile) {
      return res.status(400).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'The selected environment file does not exist.' }
      });
    }

    if (!exists && createFile) {
      // Create directories if necessary
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      // Create empty file
      fs.writeFileSync(targetPath, '', 'utf-8');
    }
  }

  // Parse current file content if it exists
  let existingLines: EnvLine[] = [];
  if (fs.existsSync(targetPath)) {
    const currentContent = fs.readFileSync(targetPath, 'utf-8');
    existingLines = parseEnvContent(currentContent);
  }

  // Prepare new envVars
  const cleanList = Array.isArray(envVars) ? envVars.filter(item => item && item.key && item.key.trim().length > 0) : [];
  
  // Merge & Serialize
  const mergedLines = mergeEnvVariables(existingLines, cleanList);
  const newContent = serializeEnvLines(mergedLines);

  // Atomic write strategy
  const tmpPath = `${targetPath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, newContent, 'utf-8');
    fs.renameSync(tmpPath, targetPath);
  } catch (err: any) {
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
    return res.status(500).json({
      success: false,
      error: { code: 'WRITE_ERROR', message: `Failed to write file atomically: ${err.message}` }
    });
  }

  // Update server DB state
  server.selectedEnvPath = selectedEnvPath || null;
  server.envVars = cleanList;
  saveDbSync();

  const envMap: Record<string, string> = {};
  for (const item of cleanList) {
    envMap[item.key.trim()] = item.value || '';
  }

  await recordServerActivity(
    req.params.id, req.user!.id, req.user!.username,
    'ENV_UPDATE', `Updated environment variables (${selectedEnvPath || '.env'})`
  );

  res.json({
    success: true,
    message: 'Environment variables saved successfully.',
    data: {
      env: envMap,
      envVars: server.envVars,
      selectedEnvPath: server.selectedEnvPath,
      exists: true
    }
  });
});

// GET /api/v1/servers/:id/activity - Server activity history
router.get('/:id/activity', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { db } = access;
  const serverActivities = db.activities.filter(a => a.serverId === req.params.id);
  res.json({ success: true, data: serverActivities });
});

// GET /api/v1/servers/:id/backups - List backups
router.get('/:id/backups', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { db } = access;
  const backups = db.backups.filter(b => b.serverId === req.params.id);
  res.json({ success: true, data: backups });
});

// POST /api/v1/servers/:id/backups - Create real backup
router.post('/:id/backups', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  try {
    const { name, storageProvider } = req.body;
    const backup = await createRealBackupProcess(req.params.id, name || '', 'manual', storageProvider);
    res.json({ success: true, message: 'Backup creation queued and processing.', data: backup });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'BACKUP_FAILED', message: err.message || 'Backup failed' } });
  }
});

// POST /api/v1/servers/:id/backups/:backupId/restore - Restore real backup
router.post('/:id/backups/:backupId/restore', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  try {
    await restoreRealBackupProcess(req.params.id, req.params.backupId);
    res.json({ success: true, message: 'Backup snapshot restored successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'RESTORE_FAILED', message: err.message || 'Restore failed' } });
  }
});

// GET /api/v1/servers/:id/backups/:backupId/download - Download physical backup archive
router.get('/:id/backups/:backupId/download', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { db } = access;
  const backup = db.backups.find(b => b.id === req.params.backupId && b.serverId === req.params.id);

  if (!backup) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Backup not found' } });
  }

  const filePath = getBackupFilePath(backup);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Physical backup file missing on storage provider.' } });
  }

  const filename = `${backup.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${backup.id}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.download(filePath, filename);
});

// DELETE /api/v1/servers/:id/backups/:backupId - Delete backup
router.delete('/:id/backups/:backupId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  try {
    await deleteRealBackupProcess(req.params.id, req.params.backupId);
    res.json({ success: true, message: 'Backup deleted.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'DELETE_FAILED', message: err.message } });
  }
});

// GET /api/v1/servers/:id/databases - List databases
router.get('/:id/databases', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { db } = access;
  const dbs = db.databases.filter(d => d.serverId === req.params.id);
  res.json({ success: true, data: dbs });
});

// POST /api/v1/servers/:id/databases - Create database
router.post('/:id/databases', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server, db } = access;
  const currentDbs = db.databases.filter(d => d.serverId === server.id);

  if (currentDbs.length >= server.limits.databases) {
    return res.status(400).json({
      success: false,
      error: { code: 'DATABASE_LIMIT_EXCEEDED', message: `Database limit reached (${server.limits.databases} max for your plan).` }
    });
  }

  const { name, dbType } = req.body;
  const dbName = (name || 'app_db').replace(/[^a-zA-Z0-9_]/g, '');

  const node = db.nodes.find(n => n.id === server.nodeId);

  const newDb: ServerDatabase = {
    id: `db_${Date.now()}`,
    serverId: server.id,
    name: `s_${server.id.substring(4)}_${dbName}`,
    username: `u_${server.id.substring(4)}`,
    host: node?.hostname || 'db-cluster.aetherpanel.com',
    port: dbType === 'postgres' ? 5432 : 3306,
    dbType: dbType === 'postgres' ? 'postgres' : 'mysql',
    createdAt: new Date().toISOString()
  };

  db.databases.push(newDb);
  saveDbSync();

  res.json({ success: true, message: 'Database created successfully.', data: newDb });
});

// DELETE /api/v1/servers/:id/databases/:databaseId
router.delete('/:id/databases/:databaseId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { db } = access;
  const idx = db.databases.findIndex(d => d.id === req.params.databaseId && d.serverId === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Database not found' } });

  db.databases.splice(idx, 1);
  saveDbSync();

  res.json({ success: true, message: 'Database removed.' });
});

// GET /api/v1/servers/:id/schedules
router.get('/:id/schedules', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { db } = access;
  const schedules = db.schedules.filter(s => s.serverId === req.params.id);
  res.json({ success: true, data: schedules });
});

// POST /api/v1/servers/:id/schedules
router.post('/:id/schedules', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server, db } = access;
  const {
    name,
    scheduleType = 'custom_cron',
    cronExpression = '0 0 * * *',
    date,
    time,
    timezone = 'UTC',
    intervalHours,
    dayOfWeek,
    action = 'restart',
    payload = '',
    isEnabled = true
  } = req.body;

  const plan = db.plans.find(p => p.id === server.planId);
  if (plan && plan.allowScheduledBackups === false && action === 'backup') {
    return res.status(400).json({ success: false, error: { code: 'FORBIDDEN', message: 'Scheduled backups are not enabled on your current plan tier.' } });
  }

  const newSchedule: ServerSchedule = {
    id: `sch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    serverId: server.id,
    serverName: server.name,
    name: name || 'Automated Task',
    scheduleType,
    cronExpression,
    date,
    time,
    timezone,
    intervalHours,
    dayOfWeek,
    action,
    payload,
    isEnabled,
    createdAt: new Date().toISOString()
  };

  newSchedule.nextRunAt = calculateNextRunAt(newSchedule);

  db.schedules.push(newSchedule);
  saveDbSync();

  res.json({ success: true, message: 'Schedule created successfully.', data: newSchedule });
});

// PUT /api/v1/servers/:id/schedules/:scheduleId - Update/Toggle Schedule
router.put('/:id/schedules/:scheduleId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { db } = access;
  const sched = db.schedules.find(s => s.id === req.params.scheduleId && s.serverId === req.params.id);
  if (!sched) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } });

  const { name, isEnabled, action, payload, scheduleType, date, time, cronExpression } = req.body;

  if (typeof isEnabled === 'boolean') sched.isEnabled = isEnabled;
  if (name) sched.name = name;
  if (action) sched.action = action;
  if (payload !== undefined) sched.payload = payload;
  if (scheduleType) sched.scheduleType = scheduleType;
  if (date) sched.date = date;
  if (time) sched.time = time;
  if (cronExpression) sched.cronExpression = cronExpression;

  sched.nextRunAt = calculateNextRunAt(sched);
  saveDbSync();

  res.json({ success: true, message: 'Schedule updated.', data: sched });
});

// POST /api/v1/servers/:id/schedules/:scheduleId/run - Run Schedule Immediately
router.post('/:id/schedules/:scheduleId/run', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { db } = access;
  const sched = db.schedules.find(s => s.id === req.params.scheduleId && s.serverId === req.params.id);
  if (!sched) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } });

  // Execute task immediately
  try {
    if (sched.action === 'backup') {
      await createRealBackupProcess(sched.serverId, `ManualRun_${sched.name}`, 'manual');
    } else if (sched.action === 'start') {
      await startServer(sched.serverId);
    } else if (sched.action === 'stop') {
      await stopServer(sched.serverId);
    } else if (sched.action === 'restart') {
      await restartServer(sched.serverId);
    } else if (sched.action === 'command' && sched.payload) {
      sendServerCommand(sched.serverId, sched.payload);
    }

    sched.lastRunAt = new Date().toISOString();
    sched.lastStatus = 'success';
    sched.lastError = undefined;
    saveDbSync();

    res.json({ success: true, message: `Executed schedule '${sched.name}' successfully.` });
  } catch (err: any) {
    sched.lastRunAt = new Date().toISOString();
    sched.lastStatus = 'failed';
    sched.lastError = err.message;
    saveDbSync();

    res.status(400).json({ success: false, error: { code: 'EXECUTION_FAILED', message: err.message } });
  }
});

// DELETE /api/v1/servers/:id/schedules/:scheduleId
router.delete('/:id/schedules/:scheduleId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { db } = access;
  const idx = db.schedules.findIndex(s => s.id === req.params.scheduleId && s.serverId === req.params.id);
  if (idx !== -1) {
    db.schedules.splice(idx, 1);
    saveDbSync();
  }
  res.json({ success: true, message: 'Schedule deleted.' });
});

// PUT /api/v1/servers/:id/startup - Update server software/version/startup
router.put('/:id/startup', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server, db } = access;
  const { software, version } = req.body;

  if (software) server.software = software;
  if (version) server.version = version;
  server.updatedAt = new Date().toISOString();

  saveDbSync();

  res.json({ success: true, message: 'Startup configuration updated.', data: server });
});

// POST /api/v1/servers/:id/install-dependencies - Install npm / pip packages
router.post('/:id/install-dependencies', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  try {
    const result = await installServerDependencies(req.params.id);
    res.json({ success: result.success, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INSTALL_FAILED', message: err.message } });
  }
});

// GET /api/v1/servers/:id/playit - Get Playit agent & tunnel status
router.get('/:id/playit', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const status = getPlayitStatus(req.params.id);
  res.json({ success: true, data: status });
});

// POST /api/v1/servers/:id/playit/install - Install Playit agent
router.post('/:id/playit/install', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  try {
    const status = await installPlayitAgent(req.params.id);
    res.json({ success: true, message: 'Playit agent configured and tunnel created.', data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PLAYIT_INSTALL_FAILED', message: err.message } });
  }
});

// POST /api/v1/servers/:id/playit/toggle - Start / Stop Playit tunnel
router.post('/:id/playit/toggle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { enable } = req.body;
  try {
    const status = await togglePlayitAgent(req.params.id, Boolean(enable));
    res.json({ success: true, message: `Playit tunnel ${enable ? 'activated' : 'paused'}.`, data: status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PLAYIT_TOGGLE_FAILED', message: err.message } });
  }
});

// POST /api/v1/servers/:id/playit/secret - Provision Playit secret key
router.post('/:id/playit/secret', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { secretKey } = req.body;
  if (!secretKey || !secretKey.trim()) {
    res.status(400).json({ success: false, error: { code: 'INVALID_SECRET', message: 'Secret key is required' } });
    return;
  }

  try {
    const status = await provisionPlayitSecret(req.params.id, secretKey);
    res.json({ success: true, message: 'Playit secret provisioned successfully.', data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PLAYIT_SECRET_FAILED', message: err.message } });
  }
});

// POST /api/v1/servers/:id/playit/uninstall - Remove Playit agent
router.post('/:id/playit/uninstall', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  try {
    await uninstallPlayitAgent(req.params.id);
    res.json({ success: true, message: 'Playit agent uninstalled.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PLAYIT_UNINSTALL_FAILED', message: err.message } });
  }
});

// POST /api/v1/servers/:id/sftp/reset-password - Generate fresh SFTP password
router.post('/:id/sftp/reset-password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server } = access;
  const newPassword = `aeth_${crypto.randomBytes(8).toString('hex')}`;
  (server as any).sftpPassword = newPassword;
  saveDbSync();

  res.json({ success: true, message: 'SFTP password regenerated.', data: { sftpPassword: newPassword } });
});

// DELETE /api/v1/servers/:id - Delete server
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server, db } = access;

  // Stop server first
  await stopServer(server.id);

  // Clear console log buffer & close active console clients
  clearConsoleBuffer(server.id);
  closeServerConsoleClients(server.id, `Server '${server.name}' has been deleted.`);

  // Clean filesystem directory
  const serverDir = getServerDir(server.id);
  if (fs.existsSync(serverDir)) {
    try {
      fs.rmSync(serverDir, { recursive: true, force: true });
    } catch (e) {}
  }

  // Remove from DB
  db.servers = db.servers.filter(s => s.id !== server.id);
  // Free allocations
  db.allocations.filter(a => a.serverId === server.id).forEach(a => {
    a.serverId = undefined;
    a.isAssigned = false;
  });
  // Remove backups & dbs
  db.backups = db.backups.filter(b => b.serverId !== server.id);
  db.databases = db.databases.filter(d => d.serverId !== server.id);
  db.schedules = db.schedules.filter(sc => sc.serverId !== server.id);

  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'DELETE_SERVER', server.id, `Deleted server ${server.name}`);

  dispatchWebhookEvent('server.deleted', {
    serverId: server.id,
    serverName: server.name,
    userId: server.userId,
    deletedBy: req.user!.email
  }, server.userId).catch(() => {});

  res.json({ success: true, message: 'Server deleted successfully.' });
});

export default router;
