import express, { Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { getDb } from '../db';
import {
  testSftpConnection,
  startSftpImport,
  startUrlImport,
  startPterodactylImport,
  getImportJobStatus,
  cancelImportJob
} from '../services/importerService';

const router = express.Router();

// Helper to check user permission on server
async function checkServerAccess(req: AuthenticatedRequest, serverId: string, requiredPerm = 'files.create'): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'admin' || req.user.role === 'super_admin') return true;

  const db = await getDb();
  const server = db.servers.find(s => s.id === serverId);
  if (!server) return false;

  if (server.userId === req.user.id) return true;

  const subuser = db.subusers?.find(s => s.serverId === serverId && s.userId === req.user?.id);
  if (subuser && subuser.permissions.includes(requiredPerm)) return true;

  return false;
}

// POST /api/v1/servers/:serverId/importer/test-sftp - Test SFTP credentials
router.post('/servers/:serverId/importer/test-sftp', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { serverId } = req.params;
  const hasAccess = await checkServerAccess(req, serverId);
  if (!hasAccess) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient server permissions.' } });
  }

  const { host, port, username, password, privateKey, remotePath } = req.body;
  if (!host || !username) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Host and Username are required.' } });
  }

  const result = await testSftpConnection({ host, port: Number(port) || 22, username, password, privateKey, remotePath });
  res.json({ success: result.success, data: result });
});

// POST /api/v1/servers/:serverId/importer/start-sftp - Start SFTP Import
router.post('/servers/:serverId/importer/start-sftp', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { serverId } = req.params;
  const hasAccess = await checkServerAccess(req, serverId);
  if (!hasAccess) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient server permissions.' } });
  }

  const { host, port, username, password, privateKey, remotePath, autoExtractArchives } = req.body;
  if (!host || !username) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Host and Username are required.' } });
  }

  const job = await startSftpImport(serverId, {
    host,
    port: Number(port) || 22,
    username,
    password,
    privateKey,
    remotePath,
    autoExtractArchives: autoExtractArchives !== false
  });

  res.json({ success: true, data: job });
});

// POST /api/v1/servers/:serverId/importer/start-url - Start Direct Archive URL Import
router.post('/servers/:serverId/importer/start-url', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { serverId } = req.params;
  const hasAccess = await checkServerAccess(req, serverId);
  if (!hasAccess) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient server permissions.' } });
  }

  const { downloadUrl, autoExtract } = req.body;
  if (!downloadUrl || typeof downloadUrl !== 'string' || !downloadUrl.startsWith('http')) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Valid HTTP/HTTPS Download URL is required.' } });
  }

  const job = await startUrlImport(serverId, { downloadUrl, autoExtract: autoExtract !== false });
  res.json({ success: true, data: job });
});

// POST /api/v1/servers/:serverId/importer/start-pterodactyl - Start Pterodactyl One-Click Import
router.post('/servers/:serverId/importer/start-pterodactyl', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { serverId } = req.params;
  const hasAccess = await checkServerAccess(req, serverId);
  if (!hasAccess) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient server permissions.' } });
  }

  const { panelUrl, apiKey, serverIdentifier } = req.body;
  if (!panelUrl || !apiKey || !serverIdentifier) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Pterodactyl Panel URL, API Key, and Server Identifier are required.' } });
  }

  const job = await startPterodactylImport(serverId, { panelUrl, apiKey, serverIdentifier });
  res.json({ success: true, data: job });
});

// GET /api/v1/servers/:serverId/importer/status - Query Active Import Job Status
router.get('/servers/:serverId/importer/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { serverId } = req.params;
  const hasAccess = await checkServerAccess(req, serverId, 'files.view');
  if (!hasAccess) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient server permissions.' } });
  }

  const job = getImportJobStatus(serverId);
  res.json({ success: true, data: job });
});

// POST /api/v1/servers/:serverId/importer/cancel - Cancel Import Job
router.post('/servers/:serverId/importer/cancel', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { serverId } = req.params;
  const hasAccess = await checkServerAccess(req, serverId);
  if (!hasAccess) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient server permissions.' } });
  }

  const canceled = cancelImportJob(serverId);
  res.json({ success: canceled, message: canceled ? 'Job cancellation requested.' : 'No active job to cancel.' });
});

export default router;
