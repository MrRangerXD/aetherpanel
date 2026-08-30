import { Server, ServerResources, ServerResourceLimits } from '../types';

/**
 * Normalizes any server object returned from backend APIs into the authoritative frontend Server model.
 * Guarantees that resources (RAM in MB, CPU in %, Disk in GB) and limits are strictly synchronized
 * and that no hardcoded default fallbacks hide real backend allocations.
 */
export function normalizeServer(apiServer: any): Server {
  if (!apiServer) {
    throw new Error('Cannot normalize null or undefined server response.');
  }

  const isMinecraft = apiServer.productId === 'prod_minecraft' ||
    (typeof apiServer.serverTypeId === 'string' && apiServer.serverTypeId.includes('minecraft')) ||
    (typeof apiServer.software === 'string' && ['paper', 'spigot', 'forge', 'purpur', 'bedrock', 'fabric', 'bungeecord', 'velocity'].includes(apiServer.software.toLowerCase()));

  // Authoritative resource values
  const memoryMb = Number(
    apiServer.resources?.memoryMb ??
    apiServer.memoryMb ??
    apiServer.memory ??
    apiServer.limits?.ramMB ??
    apiServer.ramMB ??
    (isMinecraft ? 1024 : 512)
  );

  const cpuPercent = Number(
    apiServer.resources?.cpuPercent ?? (
      apiServer.limits?.cpuCores !== undefined
        ? Math.round(apiServer.limits.cpuCores * 100)
        : (isMinecraft ? 100 : 50)
    )
  );

  const diskGb = Number(
    apiServer.resources?.diskGb ??
    apiServer.diskGb ??
    apiServer.disk ??
    apiServer.limits?.diskGB ??
    apiServer.diskGB ??
    (isMinecraft ? 10 : 5)
  );

  const resources: ServerResources = {
    memoryMb,
    cpuPercent,
    diskGb
  };

  const limits: ServerResourceLimits = {
    ramMB: memoryMb,
    cpuCores: cpuPercent / 100,
    diskGB: diskGb,
    backups: apiServer.limits?.backups ?? 1,
    maxBackupStorageMB: apiServer.limits?.maxBackupStorageMB,
    allowScheduledBackups: apiServer.limits?.allowScheduledBackups,
    databases: apiServer.limits?.databases ?? 1
  };

  return {
    id: String(apiServer.id || ''),
    installationId: apiServer.installationId,
    name: String(apiServer.name || 'Unnamed Server'),
    userId: String(apiServer.userId || ''),
    productId: String(apiServer.productId || (isMinecraft ? 'prod_minecraft' : 'prod_discord_bot')),
    planId: String(apiServer.planId || 'free'),
    nodeId: String(apiServer.nodeId || 'node-1'),
    templateId: apiServer.templateId,
    serverTypeId: apiServer.serverTypeId,
    serverType: apiServer.serverType,
    isSubuser: Boolean(apiServer.isSubuser),
    isAdminCreated: Boolean(apiServer.isAdminCreated || apiServer.createdByAdmin),
    createdByAdmin: Boolean(apiServer.createdByAdmin || apiServer.isAdminCreated),
    provisionSource: apiServer.provisionSource || (apiServer.isAdminCreated ? 'admin_assigned' : 'self_service'),
    permissions: Array.isArray(apiServer.permissions) ? apiServer.permissions : [],
    deploymentState: apiServer.deploymentState || 'ready',
    status: apiServer.status || 'offline',
    primaryIp: String(apiServer.primaryIp || '127.0.0.1'),
    primaryPort: Number(apiServer.primaryPort || 25565),
    location: String(apiServer.location || 'us-east'),
    software: String(apiServer.software || (isMinecraft ? 'Paper' : 'Node.js')),
    version: String(apiServer.version || (isMinecraft ? '1.20.4' : 'Node 20')),
    limits,
    resources,
    startup: apiServer.startup || {},
    envVars: Array.isArray(apiServer.envVars) ? apiServer.envVars : [],
    selectedEnvPath: apiServer.selectedEnvPath,
    owner: apiServer.owner,
    createdAt: apiServer.createdAt || new Date().toISOString(),
    updatedAt: apiServer.updatedAt || new Date().toISOString(),
    cpuUsage: Number(apiServer.cpuUsage || 0),
    ramUsageMB: Number(apiServer.ramUsageMB || 0),
    diskUsageMB: Number(apiServer.diskUsageMB || 0),
    uptimeSeconds: Number(apiServer.uptimeSeconds || 0)
  };
}

/**
 * Shared memory formatter across AetherPanel.
 * Displays MB if < 1024 MB, or formatted GB (e.g. 1 GB, 1.5 GB, 2 GB, 4 GB).
 * Prevents 512 MB from being rounded to 1 GB or displayed as 512 GB.
 */
export function formatMemory(memoryMb: number | null | undefined): string {
  if (memoryMb === undefined || memoryMb === null || isNaN(Number(memoryMb)) || Number(memoryMb) <= 0) {
    return '0 MB';
  }
  const mb = Number(memoryMb);
  if (mb < 1024) {
    return `${mb} MB`;
  }
  const gb = mb / 1024;
  if (gb % 1 === 0) {
    return `${gb} GB`;
  }
  return `${parseFloat(gb.toFixed(2))} GB`;
}
