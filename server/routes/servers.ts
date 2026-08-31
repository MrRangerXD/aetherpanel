import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { getDb, saveDbSync } from '../db';
import { parseEnvContent, mergeEnvVariables, serializeEnvLines, EnvLine } from '../utils/envHelper';
import { authMiddleware, requireApiKeyScope, AuthenticatedRequest, createAuditLog } from '../auth';
import { isValidRuntimeVersion, normalizeRuntimeVersion } from './runtimes';
import { validateAndNormalizeEntrypoint, sanitizeStartupFlags, validateRuntimeVersion } from '../utils/startupValidation';
import { buildBotStartupCommand } from '../../src/lib/startup';
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
import { closeServerConsoleClients, closeUserConsoleClient } from '../consoleWs';
import {
  getPlayitStatus, installPlayitAgent, togglePlayitAgent, restartPlayitAgent, provisionPlayitSecret, claimPlayitAgent, uninstallPlayitAgent, repairPlayitAgent, getPlayitLogs, PlayitConflictError
} from '../playitService';
import { searchRealPlugins, downloadPluginJar } from '../pluginProviders';
import { createRealBackupProcess, restoreRealBackupProcess, deleteRealBackupProcess, getBackupFilePath } from '../backups';
import { calculateNextRunAt } from '../scheduler';
import {
  createRealDatabase, deleteRealDatabase, rotateRealDatabasePassword,
  cleanupServerDatabases, testDatabaseCredentials, getProviderStatus, validateDatabaseName
} from '../services/databaseService';
import { ServerBackup, ServerDatabase, ServerSchedule, ServerActivity } from '../../src/types';
import { dispatchWebhookEvent } from '../webhookService';
import { resolveServerSftpInfo } from '../sftpResolver';
import { removeServerPortRule } from '../services/networkProtectionService';
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

// Helper to check server ownership, admin power, or subuser permission
async function checkServerAccess(req: AuthenticatedRequest, res: Response, serverId: string, requiredPermission?: string) {
  const db = await getDb();
  const server = db.servers.find(s => s.id === serverId);

  if (!server) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });
    return null;
  }

  const isOwner = server.userId === req.user!.id;
  const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user!.role);

  // Check subuser
  const subuser = db.subusers?.find(s => s.serverId === serverId && s.userId === req.user!.id);

  if (!isOwner && !isAdmin) {
    if (!subuser) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this server.' } });
      return null;
    }

    if (requiredPermission) {
      if (!subuser.permissions.includes(requiredPermission)) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `Required permission '${requiredPermission}' is missing.` } });
        return null;
      }
    }
  }

  return { server, db, isOwner, isAdmin, requesterSubuser: subuser };
}

// GET /api/v1/servers - List user's servers
router.get('/', authMiddleware, requireApiKeyScope('servers:read'), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  
  // Find subuser mapping
  const subuserEntries = (db.subusers || [])
    .filter(sub => sub.userId === req.user!.id);
  
  const subuserServerIds = subuserEntries.map(sub => sub.serverId);

  const ownedServers = db.servers
    .filter(s => s.userId === req.user!.id)
    .map(srv => ({
      ...srv,
      serverType: resolveServerType(srv, db.serverTypes || []),
      isSubuser: false
    }));

  const sharedServers = db.servers
    .filter(s => subuserServerIds.includes(s.id) && s.userId !== req.user!.id)
    .map(srv => {
      const subuserEntry = subuserEntries.find(sub => sub.serverId === srv.id);
      const owner = db.users.find(u => u.id === srv.userId);
      
      return {
        ...srv,
        serverType: resolveServerType(srv, db.serverTypes || []),
        isSubuser: true,
        permissions: subuserEntry ? subuserEntry.permissions : [],
        owner: owner ? {
          id: owner.id,
          username: owner.username,
          displayName: owner.displayName
        } : undefined
      };
    });

  const allServers = [...ownedServers, ...sharedServers];

  res.json({ 
    success: true, 
    data: allServers,
    ownedServers,
    sharedServers
  });
});

// GET /api/v1/servers/:id - Server details
router.get('/:id', authMiddleware, requireApiKeyScope('servers:read'), async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'server.view');
  if (!access) return;

  const { server, db } = access;
  const node = db.nodes.find(n => n.id === server.nodeId);
  const product = db.products.find(p => p.id === server.productId);
  const plan = db.plans.find(p => p.id === server.planId);
  const sftp = await resolveServerSftpInfo(server.id, req.get('host'));

  const playitStatus = node ? await getNodePlayitStatus(node.id).catch(() => null) : null;
  const publicEndpoint = resolveServerPublicEndpoint(server, node, playitStatus);

  const isSubuser = server.userId !== req.user!.id;
  const subuserEntry = isSubuser ? (db.subusers || []).find(sub => sub.serverId === server.id && sub.userId === req.user!.id) : null;

  res.json({
    success: true,
    data: {
      server: {
        ...server,
        serverType: resolveServerType(server, db.serverTypes || []),
        isSubuser,
        permissions: subuserEntry ? subuserEntry.permissions : undefined,
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

  const { isOwner, isAdmin, requesterSubuser } = access;
  if (!isOwner && !isAdmin) {
    const hasPerm = requesterSubuser?.permissions.includes('sftp.connect') || requesterSubuser?.permissions.includes('files.view');
    if (!hasPerm) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: "Required permission 'files.view' or 'sftp.connect' is missing." } });
      return;
    }
  }

  const sftpInfo = await resolveServerSftpInfo(req.params.id, req.get('host'));
  res.json({
    success: true,
    data: sftpInfo
  });
});

// POST /api/v1/servers/:id/power - Power actions
router.post('/:id/power', authMiddleware, requireApiKeyScope('servers:control'), async (req: AuthenticatedRequest, res: Response) => {
  const { action } = req.body; // 'start', 'stop', 'restart', 'kill', 'reinstall'
  let reqPerm = 'server.start';
  if (action === 'stop') reqPerm = 'server.stop';
  else if (action === 'restart') reqPerm = 'server.restart';
  else if (action === 'kill') reqPerm = 'server.kill';
  else if (action === 'reinstall') reqPerm = 'server.reinstall';

  const access = await checkServerAccess(req, res, req.params.id, reqPerm);
  if (!access) return;

  const { server } = access;

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
  const access = await checkServerAccess(req, res, req.params.id, 'server.view');
  if (!access) return;

  const preflight = await validateServerPreflight(req.params.id);
  res.json({ success: true, data: preflight });
});

// PATCH /api/v1/servers/:id - Update server metadata, startup configuration, and environment variables
router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'startup.update');
  if (!access) return;

  const { server, db } = access;
  const { name, startup, envVars, description, limits, memory, ramMB, cpu, disk } = req.body;

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

  // Resource limits mutation protection: non-admins CANNOT alter server resource limits
  if (isAdmin && limits && typeof limits === 'object') {
    server.limits = {
      ...server.limits,
      ...limits
    };
    server.resources = {
      memoryMb: server.limits.ramMB,
      cpuPercent: Math.round(server.limits.cpuCores * 100),
      diskGb: server.limits.diskGB
    };
  }

  if (typeof name === 'string' && name.trim()) {
    server.name = name.trim();
  }

  if (startup && typeof startup === 'object') {
    // 1. Validate entrypoints across sub-configs
    const isMinecraft = server.productId === 'prod_minecraft' || /minecraft|paper|purpur|forge|fabric/i.test(server.software || '');

    if (startup.entryFile) {
      const val = validateAndNormalizeEntrypoint(startup.entryFile, isMinecraft ? 'server.jar' : 'index.js');
      if (!val.valid) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_ENTRYPOINT', message: val.error } });
      }
      startup.entryFile = val.normalized;
    }

    if (startup.nodeConfig?.startupFile) {
      const val = validateAndNormalizeEntrypoint(startup.nodeConfig.startupFile, 'index.js');
      if (!val.valid) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_ENTRYPOINT', message: val.error } });
      }
      startup.nodeConfig.startupFile = val.normalized;
    }

    if (startup.pythonConfig?.startupFile) {
      const val = validateAndNormalizeEntrypoint(startup.pythonConfig.startupFile, 'main.py');
      if (!val.valid) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_ENTRYPOINT', message: val.error } });
      }
      startup.pythonConfig.startupFile = val.normalized;
    }

    if (startup.bunConfig?.startupFile) {
      const val = validateAndNormalizeEntrypoint(startup.bunConfig.startupFile, 'index.ts');
      if (!val.valid) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_ENTRYPOINT', message: val.error } });
      }
      startup.bunConfig.startupFile = val.normalized;
    }

    if (startup.serverJar) {
      const val = validateAndNormalizeEntrypoint(startup.serverJar, 'server.jar');
      if (!val.valid) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_SERVER_JAR', message: val.error } });
      }
      startup.serverJar = val.normalized;
    }

    // 2. Prevent user-supplied executable override (e.g. 'bash', 'curl', etc.)
    if ('pythonExecutable' in startup) {
      delete startup.pythonExecutable;
    }

    // 3. Force Node memory flag & config to match server allocation
    if (!startup.nodeConfig) startup.nodeConfig = {};
    startup.nodeConfig.memoryLimitMB = server.limits.ramMB;

    // 4. Force Minecraft heap to stay within allocated RAM
    if (startup.xmxMB) {
      startup.xmxMB = Math.min(Math.max(256, Number(startup.xmxMB) || server.limits.ramMB), server.limits.ramMB);
    } else {
      startup.xmxMB = server.limits.ramMB;
    }
    if (startup.xmsMB) {
      startup.xmsMB = Math.min(Math.max(64, Number(startup.xmsMB) || 128), startup.xmxMB);
    }

    // 5. Sanitize custom flags
    if (startup.customFlags) {
      startup.customFlags = sanitizeStartupFlags(startup.customFlags, { disallowMemoryOverride: true });
    }
    if (startup.nodeOptions) {
      startup.nodeOptions = sanitizeStartupFlags(startup.nodeOptions, { disallowMemoryOverride: true });
    }
    if (startup.jvmFlags) {
      startup.jvmFlags = sanitizeStartupFlags(startup.jvmFlags, { disallowMemoryOverride: true });
    }

    // 6. Synchronize software version and runtime
    if (startup.javaVersion) {
      server.version = startup.javaVersion;
    } else if (startup.version) {
      const verVal = validateRuntimeVersion(server.software, startup.version);
      if (!verVal.valid) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_VERSION', message: `Invalid version '${startup.version}'.` } });
      }
      server.version = verVal.normalized;
    }

    if (startup.botRuntime) {
      if (startup.botRuntime === 'python') {
        server.software = 'Python Bot';
      } else if (startup.botRuntime === 'bun') {
        server.software = 'Bun JS';
      } else if (startup.botRuntime === 'nodejs') {
        server.software = 'Node.js Bot';
      }
    }

    // Merge into server.startup
    server.startup = {
      ...(server.startup || {}),
      ...startup
    };

    // Re-generate compiled startup command dynamically
    if (!isMinecraft) {
      const cmdObj = buildBotStartupCommand(server, server.startup);
      server.startup.compiledCommand = cmdObj.compiledCommand;
      server.startup.entryFile = cmdObj.startupFile;
    } else {
      const xms = server.startup.xmsMB || 128;
      const xmx = server.startup.xmxMB || server.limits.ramMB;
      const jar = server.startup.serverJar || 'server.jar';
      const flags = server.startup.jvmFlags || server.startup.customFlags || '';
      server.startup.compiledCommand = `java -Xms${xms}M -Xmx${xmx}M ${flags} -jar ${jar} nogui`.replace(/\s+/g, ' ').trim();
    }
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
  const access = await checkServerAccess(req, res, req.params.id, 'console.view');
  if (!access) return;

  const logs = await getServerConsoleLogs(req.params.id);
  res.json({ success: true, data: { logs } });
});

// POST /api/v1/servers/:id/command - Send console command
router.post('/:id/command', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'console.send');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.view');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.view');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.edit');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.delete');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.delete');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.rename');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.create');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.create');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.upload');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.rename');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.download');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.create');
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
  const access = await checkServerAccess(req, res, req.params.id, 'files.create');
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
  const access = await checkServerAccess(req, res, req.params.id, 'settings.manage');
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
  const access = await checkServerAccess(req, res, req.params.id, 'server.reinstall');
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
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.view');
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
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
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
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
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
  const access = await checkServerAccess(req, res, req.params.id, 'plugins.manage');
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
  const access = await checkServerAccess(req, res, req.params.id, 'startup.update');
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
  const access = await checkServerAccess(req, res, req.params.id, 'startup.update');
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
  const access = await checkServerAccess(req, res, req.params.id, 'activity.view');
  if (!access) return;

  const { db } = access;
  const serverActivities = db.activities.filter(a => a.serverId === req.params.id);
  res.json({ success: true, data: serverActivities });
});

// GET /api/v1/servers/:id/backups - List backups
router.get('/:id/backups', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'backups.view');
  if (!access) return;

  const { db } = access;
  const backups = db.backups.filter(b => b.serverId === req.params.id);
  res.json({ success: true, data: backups });
});

// POST /api/v1/servers/:id/backups - Create real backup
router.post('/:id/backups', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'backups.create');
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
  const access = await checkServerAccess(req, res, req.params.id, 'backups.restore');
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
  const access = await checkServerAccess(req, res, req.params.id, 'backups.download');
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
  const access = await checkServerAccess(req, res, req.params.id, 'backups.delete');
  if (!access) return;

  try {
    await deleteRealBackupProcess(req.params.id, req.params.backupId);
    res.json({ success: true, message: 'Backup deleted.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'DELETE_FAILED', message: err.message } });
  }
});

// GET /api/v1/servers/:id/databases - List databases & provider status
router.get('/:id/databases', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'databases.view');
  if (!access) return;

  const { server, db } = access;
  const dbs = db.databases.filter(d => d.serverId === req.params.id);
  const providerStatus = await getProviderStatus(server);

  res.json({
    success: true,
    data: dbs,
    providerStatus,
    limits: {
      used: dbs.length,
      max: server.limits.databases
    }
  });
});

// GET /api/v1/servers/:id/databases/provider-status - Check provider status
router.get('/:id/databases/provider-status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'databases.view');
  if (!access) return;

  const { server } = access;
  const providerStatus = await getProviderStatus(server);
  res.json({ success: true, data: providerStatus });
});

// POST /api/v1/servers/:id/databases - Create real database
router.post('/:id/databases', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'databases.create');
  if (!access) return;

  const { server, db } = access;
  const currentDbs = (db.databases || []).filter(d => d.serverId === server.id);

  if (currentDbs.length >= server.limits.databases) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'DATABASE_LIMIT_EXCEEDED',
        message: `Database limit reached (${currentDbs.length}/${server.limits.databases} allocated for this server). Upgrade your plan to create more databases.`
      }
    });
  }

  const { name, dbType } = req.body;
  const val = validateDatabaseName(name);
  if (!val.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_DATABASE_NAME', message: val.error }
    });
  }

  try {
    const newDb = await createRealDatabase(server, name, dbType);
    if (!db.databases) db.databases = [];
    db.databases.push(newDb);
    saveDbSync();

    await recordServerActivity(
      server.id,
      req.user!.id,
      req.user!.username,
      'database.created',
      `Created and provisioned real database schema '${newDb.name}' (${newDb.dbType.toUpperCase()})`
    );

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'CREATE_SERVER_DATABASE',
      server.id,
      `Created real database ${newDb.name} on host ${newDb.host}:${newDb.port}`
    );

    res.json({
      success: true,
      message: 'Database schema and user credentials successfully provisioned.',
      data: newDb
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'DATABASE_PROVISIONING_FAILED',
        message: err.message || 'Database provisioning failed.'
      }
    });
  }
});

// DELETE /api/v1/servers/:id/databases/:databaseId - Delete real database
router.delete('/:id/databases/:databaseId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'databases.delete');
  if (!access) return;

  const { server, db } = access;
  const targetDb = (db.databases || []).find(d => d.id === req.params.databaseId && d.serverId === req.params.id);
  if (!targetDb) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Database not found.' } });
  }

  try {
    await deleteRealDatabase(targetDb);

    db.databases = (db.databases || []).filter(d => d.id !== targetDb.id);
    saveDbSync();

    await recordServerActivity(
      server.id,
      req.user!.id,
      req.user!.username,
      'database.deleted',
      `Deleted database schema '${targetDb.name}' and revoked user credentials`
    );

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'DELETE_SERVER_DATABASE',
      server.id,
      `Deleted database schema ${targetDb.name}`
    );

    res.json({ success: true, message: 'Database and associated user successfully removed.' });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'DATABASE_DELETION_FAILED', message: err.message || 'Failed to delete database.' }
    });
  }
});

// POST /api/v1/servers/:id/databases/:databaseId/rotate-password - Rotate database password
router.post('/:id/databases/:databaseId/rotate-password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'databases.create');
  if (!access) return;

  const { server, db } = access;
  const targetDb = (db.databases || []).find(d => d.id === req.params.databaseId && d.serverId === req.params.id);
  if (!targetDb) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Database not found.' } });
  }

  try {
    const { newPassword, connectionUri } = await rotateRealDatabasePassword(targetDb);
    targetDb.password = newPassword;
    targetDb.connectionUri = connectionUri;
    targetDb.updatedAt = new Date().toISOString();
    saveDbSync();

    await recordServerActivity(
      server.id,
      req.user!.id,
      req.user!.username,
      'database.password_rotated',
      `Rotated credentials for database '${targetDb.name}'`
    );

    res.json({
      success: true,
      message: 'Database password rotated successfully.',
      data: {
        id: targetDb.id,
        password: newPassword,
        connectionUri
      }
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'ROTATE_PASSWORD_FAILED', message: err.message || 'Failed to rotate database password.' }
    });
  }
});

// POST /api/v1/servers/:id/databases/:databaseId/test-connection - Test real database connectivity
router.post('/:id/databases/:databaseId/test-connection', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'databases.view');
  if (!access) return;

  const { db } = access;
  const targetDb = (db.databases || []).find(d => d.id === req.params.databaseId && d.serverId === req.params.id);
  if (!targetDb) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Database not found.' } });
  }

  const result = await testDatabaseCredentials(targetDb);
  res.json({
    success: result.success,
    data: {
      connected: result.success,
      message: result.message
    }
  });
});

// GET /api/v1/servers/:id/schedules
router.get('/:id/schedules', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'schedules.view');
  if (!access) return;

  const { db } = access;
  const schedules = db.schedules.filter(s => s.serverId === req.params.id);
  res.json({ success: true, data: schedules });
});

// POST /api/v1/servers/:id/schedules
router.post('/:id/schedules', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'schedules.create');
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
  const access = await checkServerAccess(req, res, req.params.id, 'schedules.update');
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
  const access = await checkServerAccess(req, res, req.params.id, 'schedules.update');
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
  const access = await checkServerAccess(req, res, req.params.id, 'schedules.delete');
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
  const access = await checkServerAccess(req, res, req.params.id, 'startup.update');
  if (!access) return;

  const { server } = access;
  const { software, version, entryFile, startup } = req.body;

  if (software) server.software = software;

  if (version) {
    const isBot = server.productId === 'prod_bot' || (typeof server.software === 'string' && /node|python|bun/i.test(server.software));
    if (isBot) {
      const verCheck = validateRuntimeVersion(server.software, version);
      if (!verCheck.valid) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_VERSION', message: `Invalid version '${version}' for runtime '${server.software}'.` } });
      }
      server.version = verCheck.normalized;
    } else {
      server.version = version;
    }
  }

  if (entryFile) {
    const isMinecraft = server.productId === 'prod_minecraft' || /minecraft|paper|purpur|forge|fabric/i.test(server.software || '');
    const val = validateAndNormalizeEntrypoint(entryFile, isMinecraft ? 'server.jar' : 'index.js');
    if (!val.valid) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ENTRYPOINT', message: val.error } });
    }
    if (!server.startup) server.startup = {};
    server.startup.entryFile = val.normalized;
  }

  if (startup && typeof startup === 'object') {
    if ('pythonExecutable' in startup) delete startup.pythonExecutable;
    server.startup = { ...(server.startup || {}), ...startup };
  }

  // Re-generate compiled startup command
  const isMinecraft = server.productId === 'prod_minecraft' || /minecraft|paper|purpur|forge|fabric/i.test(server.software || '');
  if (!isMinecraft) {
    const cmdObj = buildBotStartupCommand(server, server.startup);
    server.startup = server.startup || {};
    server.startup.compiledCommand = cmdObj.compiledCommand;
    server.startup.entryFile = cmdObj.startupFile;
  } else {
    server.startup = server.startup || {};
    const xms = server.startup.xmsMB || 128;
    const xmx = server.startup.xmxMB || server.limits.ramMB;
    const jar = server.startup.serverJar || 'server.jar';
    const flags = server.startup.jvmFlags || server.startup.customFlags || '';
    server.startup.compiledCommand = `java -Xms${xms}M -Xmx${xmx}M ${flags} -jar ${jar} nogui`.replace(/\s+/g, ' ').trim();
  }

  server.updatedAt = new Date().toISOString();
  saveDbSync();

  res.json({ success: true, message: 'Startup configuration updated.', data: server });
});

// POST /api/v1/servers/:id/install-dependencies - Install npm / pip packages
router.post('/:id/install-dependencies', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'startup.update');
  if (!access) return;

  try {
    const result = await installServerDependencies(req.params.id);
    res.json({ success: result.success, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INSTALL_FAILED', message: err.message } });
  }
});

// Helper to check if Playit is globally enabled
async function checkPlayitEnabled(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const db = await getDb();
  if (db.settings.enablePlayit === false && req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: {
        code: 'PLAYIT_DISABLED',
        message: 'Playit.GG is currently disabled by the administrator.'
      }
    });
    return false;
  }
  return true;
}

// Helper error response for server playit routes
function handleServerPlayitError(res: Response, err: any, defaultCode = 'PLAYIT_ERROR') {
  if (err instanceof PlayitConflictError || err?.name === 'PlayitConflictError') {
    return res.status(409).json({
      success: false,
      error: { code: 'OPERATION_IN_PROGRESS', message: err.message }
    });
  }
  return res.status(400).json({
    success: false,
    error: { code: defaultCode, message: err.message || 'Playit operation failed.' }
  });
}

// GET /api/v1/servers/:id/playit - Get Playit agent & tunnel status
router.get('/:id/playit', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.view');
  if (!access) return;

  const status = await getPlayitStatus(req.params.id);
  res.json({ success: true, data: status });
});

// POST /api/v1/servers/:id/playit/install - Install Playit agent
router.post('/:id/playit/install', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.manage');
  if (!access) return;

  try {
    const status = await installPlayitAgent(req.params.id);
    res.json({ success: true, message: 'Playit agent configured and tunnel created.', data: status });
  } catch (err: any) {
    handleServerPlayitError(res, err, 'PLAYIT_INSTALL_FAILED');
  }
});

// POST /api/v1/servers/:id/playit/start - Start Playit agent
router.post('/:id/playit/start', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.manage');
  if (!access) return;

  try {
    const status = await togglePlayitAgent(req.params.id, true);
    res.json({ success: true, message: 'Playit agent started.', data: status });
  } catch (err: any) {
    handleServerPlayitError(res, err, 'PLAYIT_START_FAILED');
  }
});

// POST /api/v1/servers/:id/playit/stop - Stop Playit agent
router.post('/:id/playit/stop', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.manage');
  if (!access) return;

  try {
    const status = await togglePlayitAgent(req.params.id, false);
    res.json({ success: true, message: 'Playit agent stopped.', data: status });
  } catch (err: any) {
    handleServerPlayitError(res, err, 'PLAYIT_STOP_FAILED');
  }
});

// POST /api/v1/servers/:id/playit/toggle - Toggle Playit agent
router.post('/:id/playit/toggle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.manage');
  if (!access) return;

  const { enable } = req.body;
  try {
    const status = await togglePlayitAgent(req.params.id, Boolean(enable));
    res.json({ success: true, message: `Playit agent ${enable ? 'started' : 'stopped'}.`, data: status });
  } catch (err: any) {
    handleServerPlayitError(res, err, 'PLAYIT_TOGGLE_FAILED');
  }
});

// POST /api/v1/servers/:id/playit/restart - Restart Playit agent
router.post('/:id/playit/restart', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.manage');
  if (!access) return;

  try {
    const status = await restartPlayitAgent(req.params.id);
    res.json({ success: true, message: 'Playit agent restarted successfully.', data: status });
  } catch (err: any) {
    handleServerPlayitError(res, err, 'PLAYIT_RESTART_FAILED');
  }
});

// POST /api/v1/servers/:id/playit/secret - Provision Playit secret key
router.post('/:id/playit/secret', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.manage');
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
    handleServerPlayitError(res, err, 'PLAYIT_SECRET_FAILED');
  }
});

// POST /api/v1/servers/:id/playit/claim - Explicitly initiate Playit claim action
router.post('/:id/playit/claim', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.manage');
  if (!access) return;

  try {
    const claimRes = await claimPlayitAgent(req.params.id);
    if (!claimRes.success) {
      return res.status(400).json({
        success: false,
        code: 'PLAYIT_CLAIM_UNAVAILABLE',
        message: claimRes.message || 'The Playit agent started, but a verified claim URL could not be obtained.'
      });
    }
    res.json({ success: true, data: claimRes });
  } catch (err: any) {
    handleServerPlayitError(res, err, 'PLAYIT_CLAIM_FAILED');
  }
});

// GET /api/v1/servers/:id/playit/logs - Retrieve Playit agent logs
router.get('/:id/playit/logs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.view');
  if (!access) return;

  try {
    const lines = parseInt(req.query.lines as string) || 100;
    const logs = getPlayitLogs(req.params.id, false, lines);
    res.json({ success: true, data: { serverId: req.params.id, logs } });
  } catch (err: any) {
    handleServerPlayitError(res, err, 'PLAYIT_LOGS_FAILED');
  }
});

// POST /api/v1/servers/:id/playit/repair - Run Playit agent repair
router.post('/:id/playit/repair', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.manage');
  if (!access) return;

  try {
    const repairRes = await repairPlayitAgent(req.params.id);
    res.json({ success: true, data: repairRes });
  } catch (err: any) {
    handleServerPlayitError(res, err, 'PLAYIT_REPAIR_FAILED');
  }
});

// POST /api/v1/servers/:id/playit/uninstall - Remove Playit agent
router.post('/:id/playit/uninstall', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const isEnabled = await checkPlayitEnabled(req, res);
  if (!isEnabled) return;

  const access = await checkServerAccess(req, res, req.params.id, 'network.manage');
  if (!access) return;

  try {
    await uninstallPlayitAgent(req.params.id);
    res.json({ success: true, message: 'Playit agent uninstalled.' });
  } catch (err: any) {
    handleServerPlayitError(res, err, 'PLAYIT_UNINSTALL_FAILED');
  }
});

// POST /api/v1/servers/:id/sftp/reset-password - Generate fresh SFTP password
router.post('/:id/sftp/reset-password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id);
  if (!access) return;

  const { server, isOwner, isAdmin, requesterSubuser } = access;
  if (!isOwner && !isAdmin) {
    const hasPerm = requesterSubuser?.permissions.includes('sftp.connect') || requesterSubuser?.permissions.includes('network.manage');
    if (!hasPerm) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: "Required permission 'network.manage' or 'sftp.connect' is missing." } });
      return;
    }
  }

  const newPassword = `aeth_${crypto.randomBytes(8).toString('hex')}`;
  (server as any).sftpPassword = newPassword;
  saveDbSync();

  res.json({ success: true, message: 'SFTP password regenerated.', data: { sftpPassword: newPassword } });
});

// DELETE /api/v1/servers/:id - Delete server
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'settings.manage');
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

  // Release node capacity
  const targetNode = db.nodes.find(n => n.id === server.nodeId);
  if (targetNode) {
    targetNode.usedRamMB = Math.max(0, targetNode.usedRamMB - (server.limits?.ramMB || 0));
    targetNode.usedCpuCores = Math.max(0, targetNode.usedCpuCores - (server.limits?.cpuCores || 0));
    targetNode.usedDiskGB = Math.max(0, (targetNode.usedDiskGB || 0) - (server.limits?.diskGB || 0));
    targetNode.serverCount = Math.max(0, targetNode.serverCount - 1);
  }

  // Clean up host firewall / network protection rule
  if (server.primaryPort) {
    removeServerPortRule(server.primaryPort, 'both', server.id).catch(() => {});
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
  await cleanupServerDatabases(server.id);
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

// Subusers CRUD Routes

// GET /api/v1/servers/:id/subusers - List subusers
router.get('/:id/subusers', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'subusers.view');
  if (!access) return;

  const { server, db } = access;


  const serverSubusers = (db.subusers || [])
    .filter(s => s.serverId === server.id)
    .map(sub => {
      const userDetails = db.users.find(u => u.id === sub.userId);
      return {
        ...sub,
        username: userDetails?.username || 'unknown',
        displayName: userDetails?.displayName || 'unknown',
        email: userDetails?.email || 'unknown',
        role: userDetails?.role || 'user'
      };
    });

  res.json({ success: true, data: serverSubusers });
});

// POST /api/v1/servers/:id/subusers - Create/Add subuser
router.post('/:id/subusers', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'subusers.create');
  if (!access) return;

  const { server, db, isOwner, isAdmin, requesterSubuser } = access;


  const { email, permissions } = req.body;
  if (!email || !permissions) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Email and permissions are required.' } });
  }

  // Permission escalation check
  const requestedPermissions = Array.isArray(permissions) ? permissions : [];
  if (!isOwner && !isAdmin && requesterSubuser) {
    const missingPermissions = requestedPermissions.filter(p => !requesterSubuser.permissions.includes(p));
    if (missingPermissions.length > 0) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot grant permissions you do not possess.' } });
    }
  }

  const targetUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === email.toLowerCase());
  if (!targetUser) {
    return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'No registered user found with this email or username.' } });
  }

  if (targetUser.id === server.userId) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_SUBUSER', message: 'Owners cannot be subusers of their own servers.' } });
  }

  const existingSubuser = (db.subusers || []).find(s => s.serverId === server.id && s.userId === targetUser.id);
  if (existingSubuser) {
    return res.status(400).json({ success: false, error: { code: 'ALREADY_SUBUSER', message: 'This user is already a subuser of this server.' } });
  }

  const newSubuser = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    installationId: server.installationId,
    serverId: server.id,
    userId: targetUser.id,
    permissions: Array.isArray(permissions) ? permissions : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!db.subusers) {
    db.subusers = [];
  }
  db.subusers.push(newSubuser);
  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'SUBUSER_CREATE', server.id,
    `Added subuser ${targetUser.username} with permissions: ${newSubuser.permissions.join(', ')}`
  );

  res.json({
    success: true,
    data: {
      ...newSubuser,
      username: targetUser.username,
      displayName: targetUser.displayName,
      email: targetUser.email,
      role: targetUser.role
    }
  });
});

// PUT /api/v1/servers/:id/subusers/:subuserId - Update subuser permissions
router.put('/:id/subusers/:subuserId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'subusers.update');
  if (!access) return;

  const { server, db, isOwner, isAdmin, requesterSubuser } = access;


  const { permissions } = req.body;
  const subuser = (db.subusers || []).find(s => s.serverId === server.id && s.id === req.params.subuserId);
  if (!subuser) {
    return res.status(404).json({ success: false, error: { code: 'SUBUSER_NOT_FOUND', message: 'Subuser not found.' } });
  }

  // Self-edit protection
  if (subuser.userId === req.user!.id) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot modify your own subuser permissions.' } });
  }

  // Permission escalation check
  const requestedPermissions = Array.isArray(permissions) ? permissions : [];
  if (!isOwner && !isAdmin && requesterSubuser) {
    const missingPermissions = requestedPermissions.filter(p => !requesterSubuser.permissions.includes(p));
    if (missingPermissions.length > 0) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot grant permissions you do not possess.' } });
    }
  }

  subuser.permissions = requestedPermissions;
  subuser.updatedAt = new Date().toISOString();
  saveDbSync();

  if (!subuser.permissions.includes('console.view')) {
    closeUserConsoleClient(server.id, subuser.userId, 'Console access revoked.');
  }

  const targetUser = db.users.find(u => u.id === subuser.userId);
  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'SUBUSER_UPDATE', server.id,
    `Updated subuser ${targetUser?.username || 'unknown'} permissions to: ${subuser.permissions.join(', ')}`
  );

  res.json({
    success: true,
    data: {
      ...subuser,
      username: targetUser?.username || 'unknown',
      displayName: targetUser?.displayName || 'unknown',
      email: targetUser?.email || 'unknown',
      role: targetUser?.role || 'user'
    }
  });
});

// DELETE /api/v1/servers/:id/subusers/:subuserId - Revoke subuser access
router.delete('/:id/subusers/:subuserId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'subusers.delete');
  if (!access) return;

  const { server, db } = access;


  const index = (db.subusers || []).findIndex(s => s.serverId === server.id && s.id === req.params.subuserId);
  if (index === -1) {
    return res.status(404).json({ success: false, error: { code: 'SUBUSER_NOT_FOUND', message: 'Subuser not found.' } });
  }

  const subuser = db.subusers[index];

  // Self-delete protection
  if (subuser.userId === req.user!.id) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot remove your own subuser access.' } });
  }

  const deletedSub = db.subusers.splice(index, 1)[0];
  saveDbSync();

  closeUserConsoleClient(server.id, deletedSub.userId, 'Server access revoked.');

  const targetUser = db.users.find(u => u.id === deletedSub.userId);
  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'SUBUSER_DELETE', server.id,
    `Revoked subuser ${targetUser?.username || 'unknown'} access.`
  );

  res.json({ success: true, message: 'Subuser access revoked successfully.' });
});

export default router;
