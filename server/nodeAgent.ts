import os from 'os';
import fs from 'fs';
import path from 'path';
import { getDb, saveDbSync } from './db';
import { Node } from '../src/types';
import { runNetworkDiagnostics } from './network/networkDetection';

let localAgentInterval: NodeJS.Timeout | null = null;

/**
 * Ensures the Local Node exists in the database with accurate hardware telemetry.
 * Idempotent: Never duplicates 'node_local' and preserves custom overrides.
 */
export async function ensureLocalNode(): Promise<Node> {
  const db = await getDb();

  let localNode = db.nodes.find(n => n.id === 'node_local' || n.isLocalNode);

  const hostRamMB = Math.round(os.totalmem() / (1024 * 1024));
  const freeRamMB = Math.round(os.freemem() / (1024 * 1024));
  const usedRamMB = Math.max(0, hostRamMB - freeRamMB);
  const hostCpuCores = os.cpus()?.length || 4;
  const hostName = os.hostname() || 'local-vps';

  // Calculate approximate disk capacity
  let totalDiskGB = 200;
  let usedDiskGB = 10;
  try {
    const stat = fs.statfsSync(process.cwd());
    totalDiskGB = Math.round((stat.blocks * stat.bsize) / (1024 * 1024 * 1024));
    const freeDiskGB = Math.round((stat.bfree * stat.bsize) / (1024 * 1024 * 1024));
    usedDiskGB = Math.max(1, totalDiskGB - freeDiskGB);
  } catch {
    totalDiskGB = 250;
    usedDiskGB = 15;
  }

  // Attempt non-blocking network diagnostics for public IP detection
  let detectedPublicIp = '';
  try {
    const diag = await runNetworkDiagnostics(2022);
    if (diag.publicIp) {
      detectedPublicIp = diag.publicIp;
    }
  } catch {
    // Non-blocking fallback
  }

  const primaryIp = detectedPublicIp || (localNode?.ip && localNode.ip !== '127.0.0.1' ? localNode.ip : '127.0.0.1');

  if (!localNode) {
    localNode = {
      id: 'node_local',
      uuid: 'local-node-00000000-0000-000000000000',
      name: 'Local Node (Primary Host)',
      description: 'Default local compute host co-located on control plane VPS.',
      hostname: hostName,
      ip: primaryIp,
      publicIpv4: detectedPublicIp || undefined,
      fqdn: hostName.includes('.') ? hostName : `${hostName}.local`,
      bindAddress: '0.0.0.0',
      scheme: 'http',
      sslEnabled: false,
      daemonPort: 8080,
      daemonListenIp: '0.0.0.0',
      daemonScheme: 'http',
      daemonSslEnabled: false,
      sftpPort: 2022,
      sftpFqdn: hostName.includes('.') ? `sftp.${hostName}` : undefined,
      location: 'local',
      locationName: 'Primary Control Plane Region',
      flagCode: 'US',
      totalRamMB: hostRamMB,
      usedRamMB,
      totalCpuCores: hostCpuCores,
      usedCpuCores: 0.1,
      totalDiskGB,
      usedDiskGB,
      reservedRamMB: 1024,
      reservedCpuCores: 0.5,
      reservedDiskGB: 5,
      ramOverallocatePercent: 0,
      cpuOverallocatePercent: 0,
      diskOverallocatePercent: 0,
      maxServers: 100,
      allowedProducts: ['prod_minecraft', 'prod_bot'],
      tags: ['local', 'primary', 'bare-metal'],
      status: 'online',
      isMaintenanceMode: false,
      isLocalNode: true,
      serverCount: 0,
      daemonToken: 'daemon_token_local_node_secret_82910',
      lastHeartbeatAt: new Date().toISOString(),
      isSecure: true
    };
    db.nodes.unshift(localNode);

    // Ensure initial port allocations for Local Node
    for (let p = 25565; p <= 25575; p++) {
      const exists = db.allocations.some(a => a.nodeId === 'node_local' && a.port === p);
      if (!exists) {
        db.allocations.push({
          id: `alloc_local_${p}`,
          nodeId: 'node_local',
          ip: primaryIp,
          port: p,
          isAssigned: false,
          createdAt: new Date().toISOString()
        });
      }
    }
    saveDbSync();
  } else {
    // Update live hardware capacity & preserve user settings
    localNode.uuid = localNode.uuid || 'local-node-00000000-0000-000000000000';
    localNode.bindAddress = localNode.bindAddress || '0.0.0.0';
    localNode.scheme = localNode.scheme || (localNode.sslEnabled ? 'https' : 'http');
    localNode.sslEnabled = localNode.sslEnabled ?? false;
    localNode.daemonPort = localNode.daemonPort || 8080;
    localNode.sftpPort = localNode.sftpPort || 2022;
    localNode.hostname = localNode.hostname || hostName;
    if (!localNode.fqdn) localNode.fqdn = hostName.includes('.') ? hostName : `${hostName}.local`;
    if (detectedPublicIp && (!localNode.publicIpv4 || localNode.ip === '127.0.0.1')) {
      localNode.publicIpv4 = detectedPublicIp;
    }
    localNode.totalRamMB = hostRamMB;
    localNode.totalCpuCores = hostCpuCores;
    localNode.totalDiskGB = totalDiskGB;
    localNode.isLocalNode = true;
    localNode.lastHeartbeatAt = new Date().toISOString();
    if (!localNode.isMaintenanceMode && localNode.status === 'offline') {
      localNode.status = 'online';
    }

    // Ensure allocations exist for local node
    const localAllocs = db.allocations.filter(a => a.nodeId === localNode!.id);
    if (localAllocs.length === 0) {
      for (let p = 25565; p <= 25575; p++) {
        db.allocations.push({
          id: `alloc_local_${p}`,
          nodeId: localNode.id,
          ip: localNode.ip || primaryIp,
          port: p,
          isAssigned: false,
          createdAt: new Date().toISOString()
        });
      }
    }
    saveDbSync();
  }

  return localNode;
}

/**
 * Returns instantaneous hardware telemetry metrics for the local host.
 */
export async function getLocalHardwareMetrics() {
  const totalRam = os.totalmem();
  const freeRam = os.freemem();
  const ramTotalMB = Math.round(totalRam / (1024 * 1024));
  const ramUsedMB = Math.max(0, Math.round((totalRam - freeRam) / (1024 * 1024)));
  const loadAvg = os.loadavg();
  const cpus = os.cpus() || [];
  const cpuUsagePercent = Math.min(100, Math.round(((loadAvg[0] || 0.1) / Math.max(1, cpus.length)) * 100));

  let diskTotalGB = 200;
  let diskUsedGB = 10;
  try {
    const stat = fs.statfsSync(process.cwd());
    diskTotalGB = Math.round((stat.blocks * stat.bsize) / (1024 * 1024 * 1024));
    const freeDiskGB = Math.round((stat.bfree * stat.bsize) / (1024 * 1024 * 1024));
    diskUsedGB = Math.max(1, diskTotalGB - freeDiskGB);
  } catch {
    // fallback
  }

  return {
    cpuUsagePercent,
    cpuCores: cpus.length,
    ramTotalMB,
    ramUsedMB,
    diskTotalGB,
    diskUsedGB,
    uptimeSeconds: os.uptime()
  };
}

/**
 * Starts the continuous Local Node agent heartbeat loop.
 * Collects real VPS metrics and pulses authenticated heartbeats.
 */
export function startLocalNodeAgent(): void {
  if (localAgentInterval) return;

  console.log('[LOCAL NODE AGENT] Initializing Local Node telemetry and heartbeat agent...');

  // Immediate initial sync
  ensureLocalNode().catch(err => {
    console.error('[LOCAL NODE AGENT] Error on initial local node sync:', err);
  });

  localAgentInterval = setInterval(async () => {
    try {
      const db = await getDb();
      const localNode = db.nodes.find(n => n.id === 'node_local' || n.isLocalNode);

      if (!localNode) {
        await ensureLocalNode();
        return;
      }

      // Collect live system telemetry
      const totalRam = os.totalmem();
      const freeRam = os.freemem();
      const hostRamMB = Math.round(totalRam / (1024 * 1024));
      const usedRamMB = Math.max(0, Math.round((totalRam - freeRam) / (1024 * 1024)));
      const loadAvg = os.loadavg();
      const cpuUsageCores = parseFloat((loadAvg[0] || 0.1).toFixed(2));

      let totalDiskGB = localNode.totalDiskGB || 200;
      let usedDiskGB = localNode.usedDiskGB || 10;
      try {
        const stat = fs.statfsSync(process.cwd());
        totalDiskGB = Math.round((stat.blocks * stat.bsize) / (1024 * 1024 * 1024));
        const freeDiskGB = Math.round((stat.bfree * stat.bsize) / (1024 * 1024 * 1024));
        usedDiskGB = Math.max(1, totalDiskGB - freeDiskGB);
      } catch {
        // Ignored fallback
      }

      localNode.usedRamMB = usedRamMB;
      localNode.usedCpuCores = cpuUsageCores;
      localNode.totalRamMB = hostRamMB;
      localNode.totalDiskGB = totalDiskGB;
      localNode.usedDiskGB = usedDiskGB;
      localNode.serverCount = db.servers.filter(s => s.nodeId === localNode.id).length;
      localNode.lastHeartbeatAt = new Date().toISOString();

      if (!localNode.isMaintenanceMode && localNode.status !== 'maintenance') {
        localNode.status = 'online';
      }

      saveDbSync();
    } catch (err) {
      console.error('[LOCAL NODE AGENT] Heartbeat cycle error:', err);
    }
  }, 10000); // 10s heartbeat cadence
}
