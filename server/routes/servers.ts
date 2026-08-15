import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import {
  startServer, stopServer, restartServer, reinstallServer,
  getServerConsoleLogs, sendServerCommand, listServerFiles,
  readServerFile, writeServerFile, deleteServerItem, createServerDirectory,
  renameServerItem, compressServerItem, decompressServerItem,
  readServerEnv, writeServerEnv, recordServerActivity,
  listMinecraftPlugins, toggleMinecraftPlugin, getServerDir,
  installServerDependencies
} from '../provider';
import {
  getPlayitStatus, installPlayitAgent, togglePlayitAgent, uninstallPlayitAgent
} from '../playitService';
import { searchRealPlugins, downloadPluginJar } from '../pluginProviders';
import { createRealBackupProcess, restoreRealBackupProcess, deleteRealBackupProcess, getBackupFilePath } from '../backups';
import { calculateNextRunAt } from '../scheduler';
import { ServerBackup, ServerDatabase, ServerSchedule, ServerActivity } from '../../src/types';
import { dispatchWebhookEvent } from '../webhookService';

const router = Router();

// Multer storage for server file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const serverId = req.params.id;
    const relPath = (req.query.path as string) || (req.body.path as string) || '';
    const baseDir = getServerDir(serverId);
    const targetDir = path.join(baseDir, relPath);

    if (!targetDir.startsWith(baseDir)) {
      return cb(new Error('Access denied: Outside server directory'), '');
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
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
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userServers = db.servers.filter(s => s.userId === req.user!.id);
  res.json({ success: true, data: userServers });
});

// GET /api/v1/servers/:id - Server details
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server, db } = access;
  const node = db.nodes.find(n => n.id === server.nodeId);
  const product = db.products.find(p => p.id === server.productId);
  const plan = db.plans.find(p => p.id === server.planId);

  res.json({
    success: true,
    data: {
      server,
      node: node ? { id: node.id, name: node.name, locationName: node.locationName, flagCode: node.flagCode } : null,
      product,
      plan
    }
  });
});

// POST /api/v1/servers/:id/power - Power actions
router.post('/:id/power', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server } = access;
  const { action } = req.body; // 'start', 'stop', 'restart', 'reinstall'

  let success = false;
  if (action === 'start') {
    success = await startServer(server.id);
  } else if (action === 'stop') {
    success = await stopServer(server.id);
  } else if (action === 'restart') {
    success = await restartServer(server.id);
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

  res.json({ success: true, message: `Server power action '${action}' initiated.`, data: { serverId: server.id } });
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
router.get('/:id/files', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const relPath = (req.query.path as string) || '';
  try {
    const files = listServerFiles(req.params.id, relPath);
    res.json({ success: true, data: { path: relPath, files } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'FILE_ERROR', message: err.message } });
  }
});

// GET /api/v1/servers/:id/files/content - Read file
router.get('/:id/files/content', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
router.post('/:id/files/content', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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

// DELETE /api/v1/servers/:id/files - Delete file or folder
router.delete('/:id/files', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ success: false, error: { code: 'PATH_REQUIRED', message: 'Path required' } });

  try {
    deleteServerItem(req.params.id, filePath);
    res.json({ success: true, message: 'Item deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'FILE_ERROR', message: err.message } });
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

  upload.array('files', 10)(req, res, async (err: any) => {
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

  const baseDir = getServerDir(req.params.id);
  const targetPath = path.join(baseDir, relPath);

  if (!targetPath.startsWith(baseDir) || !fs.existsSync(targetPath)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found.' } });
  }

  res.download(targetPath, path.basename(targetPath));
});

// POST /api/v1/servers/:id/files/compress - Create ZIP archive
router.post('/:id/files/compress', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { path: relPath } = req.body;
  try {
    const zipRel = compressServerItem(req.params.id, relPath || '/');
    res.json({ success: true, message: 'Compressed into ZIP archive.', data: { zipPath: zipRel } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'COMPRESS_FAILED', message: err.message } });
  }
});

// POST /api/v1/servers/:id/files/decompress - Extract ZIP archive
router.post('/:id/files/decompress', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { path: zipRelPath } = req.body;
  try {
    decompressServerItem(req.params.id, zipRelPath);
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

  const envMap = readServerEnv(req.params.id);
  res.json({ success: true, data: envMap });
});

// PUT /api/v1/servers/:id/env
router.put('/:id/env', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const envMap = req.body.env || {};
  writeServerEnv(req.params.id, envMap);

  await recordServerActivity(
    req.params.id, req.user!.id, req.user!.username,
    'ENV_UPDATE', 'Updated environment variables (.env)'
  );

  res.json({ success: true, message: 'Environment variables saved successfully.' });
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

  // Remove from DB
  db.servers = db.servers.filter(s => s.id !== server.id);
  // Free allocations
  const alloc = db.allocations.find(a => a.serverId === server.id);
  if (alloc) {
    alloc.serverId = undefined;
    alloc.isAssigned = false;
  }
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
