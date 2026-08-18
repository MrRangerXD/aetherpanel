import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb, saveDbSync } from '../db';
import { getInstallationId } from '../installation';
import { appendConsoleLog, emitServerStatus, pullRemoteServerCommands, handleNodeReconnect } from '../provider';

const router = Router();

// POST /api/v1/node/enroll - Daemon uses one-time installation token to pair with Panel
router.post('/enroll', async (req: Request, res: Response) => {
  const { token, fqdn, ip, daemonPort, sftpPort, installationId } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_TOKEN', message: 'Installation token is required' }
    });
  }

  // Installation ID boundary validation
  const currentInstallationId = getInstallationId();
  if (installationId && installationId !== currentInstallationId) {
    return res.status(403).json({
      success: false,
      error: { code: 'CROSS_INSTALLATION_DENIED', message: 'Daemon is targeting a different AetherPanel installation' }
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
      installationId: currentInstallationId,
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
    totalDiskGB,
    serverStatuses
  } = req.body;

  if (typeof ramUsageMB === 'number') node.usedRamMB = ramUsageMB;
  if (typeof cpuUsageCores === 'number') node.usedCpuCores = cpuUsageCores;
  if (typeof diskUsageGB === 'number') node.usedDiskGB = diskUsageGB;
  if (typeof activeContainers === 'number') node.serverCount = activeContainers;
  if (typeof totalRamMB === 'number' && totalRamMB > 0) node.totalRamMB = totalRamMB;
  if (typeof totalDiskGB === 'number' && totalDiskGB > 0) node.totalDiskGB = totalDiskGB;

  // If node reports actual status for its running server containers
  if (Array.isArray(serverStatuses)) {
    serverStatuses.forEach((st: { serverId: string; status: any; cpu?: number; ram?: number }) => {
      const s = db.servers.find(srv => srv.id === st.serverId && srv.nodeId === node.id);
      if (s) {
        if (st.status) s.status = st.status;
        if (typeof st.cpu === 'number') s.cpuUsage = st.cpu;
        if (typeof st.ram === 'number') s.ramUsageMB = st.ram;
      }
    });
  }

  const wasOffline = node.status === 'offline';
  node.lastHeartbeatAt = new Date().toISOString();
  if (node.status !== 'maintenance') {
    node.status = 'online';
  }

  saveDbSync();

  if (wasOffline) {
    handleNodeReconnect(node.id).catch(() => {});
  }

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

// POST /api/v1/node/servers/:id/logs - Daemon streams console stdout/stderr lines to Panel
router.post('/servers/:id/logs', async (req: Request, res: Response) => {
  const daemonToken = (req.headers['x-daemon-token'] || req.headers['authorization'])?.toString().replace(/^Bearer\s+/i, '').trim();
  if (!daemonToken) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing daemon token' } });
  }

  const db = await getDb();
  const node = db.nodes.find(n => n.daemonToken === daemonToken);
  if (!node) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid daemon token' } });
  }

  const serverId = req.params.id;
  const server = db.servers.find(s => s.id === serverId && s.nodeId === node.id);
  if (!server) {
    return res.status(404).json({ success: false, error: { code: 'SERVER_NOT_FOUND', message: 'Server not assigned to this node' } });
  }

  const { lines, line } = req.body;
  if (Array.isArray(lines)) {
    for (const l of lines) {
      if (typeof l === 'string') appendConsoleLog(serverId, l);
    }
  } else if (typeof line === 'string') {
    appendConsoleLog(serverId, line);
  }

  res.json({ success: true });
});

// POST /api/v1/node/servers/:id/status - Daemon notifies Panel of container status change
router.post('/servers/:id/status', async (req: Request, res: Response) => {
  const daemonToken = (req.headers['x-daemon-token'] || req.headers['authorization'])?.toString().replace(/^Bearer\s+/i, '').trim();
  if (!daemonToken) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing daemon token' } });
  }

  const db = await getDb();
  const node = db.nodes.find(n => n.daemonToken === daemonToken);
  if (!node) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid daemon token' } });
  }

  const serverId = req.params.id;
  const server = db.servers.find(s => s.id === serverId && s.nodeId === node.id);
  if (!server) {
    return res.status(404).json({ success: false, error: { code: 'SERVER_NOT_FOUND', message: 'Server not assigned to this node' } });
  }

  const { status, cpuUsage, ramUsageMB, exitCode, signal } = req.body;
  if (status) {
    server.status = status;
    if (typeof cpuUsage === 'number') server.cpuUsage = cpuUsage;
    if (typeof ramUsageMB === 'number') server.ramUsageMB = ramUsageMB;
    saveDbSync();
    emitServerStatus(serverId, status, { exitCode, signal, cpuUsage, ramUsageMB });
  }

  res.json({ success: true });
});

// GET /api/v1/node/servers/:id/commands - Daemon pulls pending stdin commands queued by Panel users
router.get('/servers/:id/commands', async (req: Request, res: Response) => {
  const daemonToken = (req.headers['x-daemon-token'] || req.headers['authorization'])?.toString().replace(/^Bearer\s+/i, '').trim();
  if (!daemonToken) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing daemon token' } });
  }

  const db = await getDb();
  const node = db.nodes.find(n => n.daemonToken === daemonToken);
  if (!node) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid daemon token' } });
  }

  const serverId = req.params.id;
  const server = db.servers.find(s => s.id === serverId && s.nodeId === node.id);
  if (!server) {
    return res.status(404).json({ success: false, error: { code: 'SERVER_NOT_FOUND', message: 'Server not assigned to this node' } });
  }

  const commands = pullRemoteServerCommands(serverId);
  res.json({ success: true, data: { commands } });
});

// GET /api/v1/node/config - Remote daemon fetches full node networking & SFTP configurations
router.get('/config', async (req: Request, res: Response) => {
  const daemonToken = (req.headers['x-daemon-token'] || req.headers['authorization'])?.toString().replace(/^Bearer\s+/i, '').trim();
  if (!daemonToken) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing daemon token' } });
  }

  const db = await getDb();
  const node = db.nodes.find(n => n.daemonToken === daemonToken);
  if (!node) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid daemon token' } });
  }

  res.json({
    success: true,
    data: {
      nodeId: node.id,
      nodeName: node.name,
      ip: node.ip,
      fqdn: node.fqdn,
      sftpFqdn: node.sftpFqdn,
      sftpPort: node.sftpPort || 2022,
      daemonPort: node.daemonPort || 8080,
      playitSftpAddress: node.playitSftpAddress,
      playitSftpPort: node.playitSftpPort,
      playitAgentInstalled: node.playitAgentInstalled,
      playitAgentRunning: node.playitAgentRunning,
      playitClaimCode: node.playitClaimCode,
      playitClaimUrl: node.playitClaimUrl,
      limits: {
        totalRamMB: node.totalRamMB,
        totalCpuCores: node.totalCpuCores,
        totalDiskGB: node.totalDiskGB,
        maxServers: node.maxServers
      }
    }
  });
});

// POST /api/v1/node/sftp-status - Remote daemon syncs its local SFTP listener & public tunnel info
router.post('/sftp-status', async (req: Request, res: Response) => {
  const daemonToken = (req.headers['x-daemon-token'] || req.headers['authorization'])?.toString().replace(/^Bearer\s+/i, '').trim();
  if (!daemonToken) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing daemon token' } });
  }

  const db = await getDb();
  const node = db.nodes.find(n => n.daemonToken === daemonToken);
  if (!node) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid daemon token' } });
  }

  const { sftpPort, sftpFqdn, playitSftpAddress, playitSftpPort } = req.body;
  if (sftpPort) node.sftpPort = parseInt(sftpPort);
  if (sftpFqdn) node.sftpFqdn = sftpFqdn.trim();
  if (playitSftpAddress) node.playitSftpAddress = playitSftpAddress.trim();
  if (playitSftpPort) node.playitSftpPort = parseInt(playitSftpPort);

  saveDbSync();

  res.json({
    success: true,
    message: 'SFTP networking status synchronized with Panel.'
  });
});

// POST /api/v1/node/playit/sync - Remote daemon syncs Playit agent daemon state
router.post('/playit/sync', async (req: Request, res: Response) => {
  const daemonToken = (req.headers['x-daemon-token'] || req.headers['authorization'])?.toString().replace(/^Bearer\s+/i, '').trim();
  if (!daemonToken) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing daemon token' } });
  }

  const db = await getDb();
  const node = db.nodes.find(n => n.daemonToken === daemonToken);
  if (!node) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid daemon token' } });
  }

  const { isInstalled, isRunning, claimCode, claimUrl, sftpTunnelAddress, sftpTunnelPort } = req.body;
  if (typeof isInstalled === 'boolean') node.playitAgentInstalled = isInstalled;
  if (typeof isRunning === 'boolean') node.playitAgentRunning = isRunning;
  if (claimCode) node.playitClaimCode = claimCode;
  if (claimUrl) node.playitClaimUrl = claimUrl;
  if (sftpTunnelAddress) node.playitSftpAddress = sftpTunnelAddress;
  if (sftpTunnelPort) node.playitSftpPort = parseInt(sftpTunnelPort);

  saveDbSync();

  res.json({
    success: true,
    message: 'Node Playit tunnel status synchronized.'
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
