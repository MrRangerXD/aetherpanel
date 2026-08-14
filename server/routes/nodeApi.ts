import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb, saveDbSync } from '../db';

const router = Router();

// POST /api/v1/node/enroll - Daemon uses one-time installation token to pair with Panel
router.post('/enroll', async (req: Request, res: Response) => {
  const { token, fqdn, ip, daemonPort, sftpPort } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_TOKEN', message: 'Installation token is required' }
    });
  }

  const db = await getDb();
  const tokenRecord = db.nodeInstallTokens.find(
    t => t.token === token && !t.isUsed && new Date(t.expiresAt) > new Date()
  );

  if (!tokenRecord) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid, expired, or already used' }
    });
  }

  const node = db.nodes.find(n => n.id === tokenRecord.nodeId);
  if (!node) {
    return res.status(404).json({
      success: false,
      error: { code: 'NODE_NOT_FOUND', message: 'Associated node record not found' }
    });
  }

  // Generate permanent daemon token
  const daemonToken = `dtoken_${crypto.randomBytes(24).toString('hex')}`;
  node.daemonToken = daemonToken;
  if (fqdn) node.fqdn = fqdn;
  if (ip) node.ip = ip;
  if (daemonPort) node.daemonPort = parseInt(daemonPort) || 8080;
  if (sftpPort) node.sftpPort = parseInt(sftpPort) || 2022;

  node.status = 'online';
  node.lastHeartbeatAt = new Date().toISOString();
  tokenRecord.isUsed = true;

  saveDbSync();

  console.log(`[AETHERNODE DAEMON ENROLLED] Node '${node.name}' (${node.id}) connected successfully.`);

  return res.json({
    success: true,
    data: {
      nodeId: node.id,
      nodeName: node.name,
      daemonToken,
      sftpPort: node.sftpPort,
      daemonPort: node.daemonPort,
      panelUrl: `${req.protocol}://${req.get('host')}`
    }
  });
});

// POST /api/v1/node/heartbeat - Node daemon sends live telemetry & heartbeats
router.post('/heartbeat', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'] || req.headers['x-daemon-token'];
  let daemonToken = req.body.daemonToken;

  if (authHeader && typeof authHeader === 'string') {
    daemonToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  if (!daemonToken) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Daemon authentication token missing' }
    });
  }

  const db = await getDb();
  const node = db.nodes.find(n => n.daemonToken === daemonToken);

  if (!node) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_DAEMON_TOKEN', message: 'Unrecognized daemon authentication credentials' }
    });
  }

  const {
    ramUsageMB,
    cpuUsageCores,
    diskUsageGB,
    activeContainers,
    totalRamMB,
    totalDiskGB
  } = req.body;

  if (typeof ramUsageMB === 'number') node.usedRamMB = ramUsageMB;
  if (typeof cpuUsageCores === 'number') node.usedCpuCores = cpuUsageCores;
  if (typeof diskUsageGB === 'number') node.usedDiskGB = diskUsageGB;
  if (typeof activeContainers === 'number') node.serverCount = activeContainers;
  if (typeof totalRamMB === 'number' && totalRamMB > 0) node.totalRamMB = totalRamMB;
  if (typeof totalDiskGB === 'number' && totalDiskGB > 0) node.totalDiskGB = totalDiskGB;

  node.lastHeartbeatAt = new Date().toISOString();
  if (node.status !== 'maintenance') {
    node.status = 'online';
  }

  saveDbSync();

  return res.json({
    success: true,
    message: 'Heartbeat recorded',
    data: {
      nodeId: node.id,
      status: node.status,
      isMaintenanceMode: node.isMaintenanceMode,
      activeServersCount: db.servers.filter(s => s.nodeId === node.id).length
    }
  });
});

// GET /api/v1/node/servers - List all assigned container servers for this node agent
router.get('/servers', async (req: Request, res: Response) => {
  const daemonToken = (req.headers['x-daemon-token'] || req.headers['authorization'])?.toString().replace(/^Bearer\s+/i, '').trim();
  if (!daemonToken) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
  }

  const db = await getDb();
  const node = db.nodes.find(n => n.daemonToken === daemonToken);
  if (!node) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid daemon token' } });
  }

  const nodeServers = db.servers.filter(s => s.nodeId === node.id);
  res.json({
    success: true,
    data: nodeServers.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      ip: s.primaryIp,
      port: s.primaryPort,
      ramMB: s.limits.ramMB,
      cpuCores: s.limits.cpuCores,
      diskGB: s.limits.diskGB,
      software: s.software,
      version: s.version
    }))
  });
});

// Background task: Periodic node heartbeat timeout check
export function startHeartbeatMonitor() {
  setInterval(async () => {
    try {
      const db = await getDb();
      const now = new Date().getTime();
      let modified = false;

      db.nodes.forEach(n => {
        if (n.status === 'maintenance') return;
        if (!n.lastHeartbeatAt) {
          n.status = 'offline';
          modified = true;
          return;
        }

        const lastHb = new Date(n.lastHeartbeatAt).getTime();
        const diffSeconds = (now - lastHb) / 1000;

        // If no heartbeat in 45s, mark node offline
        if (diffSeconds > 45 && n.status === 'online') {
          n.status = 'offline';
          modified = true;
          console.warn(`[NODE WATCHDOG] Node '${n.name}' (${n.id}) missed heartbeats (${Math.round(diffSeconds)}s ago) -> Status: OFFLINE`);
        }
      });

      if (modified) saveDbSync();
    } catch (err) {
      console.error('Error in heartbeat monitor:', err);
    }
  }, 15000);
}

export default router;
