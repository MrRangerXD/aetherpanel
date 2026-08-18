import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { getServerDir, appendConsoleLog } from './provider';
import { getDb, saveDbSync } from './db';

export interface PlayitStatus {
  isInstalled: boolean;
  isRunning: boolean;
  agent: 'ONLINE' | 'OFFLINE';
  control: 'CONNECTED' | 'DISCONNECTED';
  claim: 'WAITING_FOR_CLAIM' | 'CLAIMED';
  tunnel: 'ONLINE' | 'NOT_ACTIVE';
  status: 'uninstalled' | 'installing' | 'installed' | 'starting' | 'waiting_for_claim' | 'claimed' | 'online' | 'offline' | 'error';
  claimUrl?: string;
  claimCode?: string;
  tunnelAddress?: string;
  tunnelPort?: number;
  tunnelType: 'minecraft_java' | 'minecraft_bedrock' | 'sftp' | 'custom';
  lastCheckedAt: string;
  agentVersion: string;
  pid?: number;
  logs?: string[];
  controlConnected?: boolean;
}

export interface NodePlayitStatus {
  nodeId: string;
  isInstalled: boolean;
  isRunning: boolean;
  status: 'uninstalled' | 'installed' | 'claiming' | 'connected' | 'disconnected' | 'error';
  claimUrl?: string;
  claimCode?: string;
  sftpTunnelAddress?: string;
  sftpTunnelPort?: number;
  lastCheckedAt: string;
  agentVersion: string;
}

// Active background processes tracked in memory
const activePlayitProcesses = new Map<string, ChildProcess>();

export function getPlayitDir(serverId: string): string {
  const dir = path.join(getServerDir(serverId), 'playit');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getNodePlayitDir(): string {
  const dir = path.join(process.cwd(), 'data', 'playit_node');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function isPidRunning(pid?: number): boolean {
  if (!pid) return false;
  try {
    return process.kill(pid, 0);
  } catch {
    return false;
  }
}

// SERVER-LEVEL PLAYIT
export function getPlayitStatus(serverId: string): PlayitStatus {
  const playitDir = getPlayitDir(serverId);
  const configFile = path.join(playitDir, 'playit.json');
  const secretFile = path.join(playitDir, 'playit.toml');
  const logFile = path.join(playitDir, 'playit.log');

  let logs: string[] = [];
  if (fs.existsSync(logFile)) {
    try {
      const content = fs.readFileSync(logFile, 'utf-8');
      logs = content.split('\n').filter(Boolean).slice(-30);
    } catch {}
  }

  if (!fs.existsSync(configFile)) {
    return {
      isInstalled: false,
      isRunning: false,
      agent: 'OFFLINE',
      control: 'DISCONNECTED',
      claim: 'WAITING_FOR_CLAIM',
      tunnel: 'NOT_ACTIVE',
      status: 'uninstalled',
      tunnelType: 'minecraft_java',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: '1.0.10',
      logs
    };
  }

  try {
    const raw = fs.readFileSync(configFile, 'utf-8');
    const data = JSON.parse(raw);
    const running = data.pid ? isPidRunning(data.pid) : data.isRunning || false;

    // Check if secret file exists and is populated to determine claim state
    let isClaimed = data.claimed === true;
    if (fs.existsSync(secretFile)) {
      try {
        const secretContent = fs.readFileSync(secretFile, 'utf-8');
        if (secretContent.includes('secret') || secretContent.length > 50) {
          isClaimed = true;
        }
      } catch {}
    }

    const agentState = running ? 'ONLINE' : 'OFFLINE';
    const controlState = running ? 'CONNECTED' : 'DISCONNECTED';
    const claimState = isClaimed ? 'CLAIMED' : 'WAITING_FOR_CLAIM';
    const tunnelState = (running && isClaimed) ? 'ONLINE' : 'NOT_ACTIVE';

    return {
      isInstalled: true,
      isRunning: running,
      agent: agentState,
      control: controlState,
      claim: claimState,
      tunnel: tunnelState,
      status: running ? (isClaimed ? 'claimed' : 'waiting_for_claim') : 'offline',
      claimUrl: data.claimUrl,
      claimCode: data.claimCode,
      tunnelAddress: data.tunnelAddress,
      tunnelPort: data.tunnelPort,
      tunnelType: data.tunnelType || 'minecraft_java',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: data.agentVersion || '1.0.10',
      pid: data.pid,
      controlConnected: running,
      logs
    };
  } catch {
    return {
      isInstalled: true,
      isRunning: false,
      agent: 'OFFLINE',
      control: 'DISCONNECTED',
      claim: 'WAITING_FOR_CLAIM',
      tunnel: 'NOT_ACTIVE',
      status: 'offline',
      tunnelType: 'minecraft_java',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: '1.0.10',
      logs
    };
  }
}

export async function installPlayitAgent(serverId: string): Promise<PlayitStatus> {
  const playitDir = getPlayitDir(serverId);
  const configFile = path.join(playitDir, 'playit.json');
  const secretFile = path.join(playitDir, 'playit.toml');
  const socketFile = path.join(playitDir, 'playit.sock');
  const logFile = path.join(playitDir, 'playit.log');

  // Check existing process to prevent duplication
  const existing = getPlayitStatus(serverId);
  if (existing.isInstalled && existing.isRunning && existing.pid && isPidRunning(existing.pid)) {
    return existing;
  }

  const claimCode = `AETH-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const claimUrl = `https://playit.gg/claim/${claimCode.toLowerCase()}`;
  
  // Get server port from DB
  const db = await getDb();
  const server = db.servers.find(s => s.id === serverId);
  const targetPort = server?.primaryPort || 25565;
  const tunnelAddress = `${serverId.substring(0, 8)}.auto.playit.gg`;

  // Start real playit binary if available
  const playitBin = path.join(process.cwd(), 'bin', 'playit');
  let childPid: number | undefined = undefined;

  if (fs.existsSync(playitBin)) {
    try {
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });
      logStream.write(`[PLAYIT] Starting agent daemon at ${new Date().toISOString()}\n`);
      logStream.write(`[PLAYIT] Claim URL: ${claimUrl}\n`);

      const child = spawn(playitBin, [
        '--secret-path', secretFile,
        '--socket-path', socketFile,
        '-l', logFile
      ], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);
      child.unref();

      childPid = child.pid;
      if (childPid) {
        activePlayitProcesses.set(serverId, child);
      }
    } catch (err: any) {
      fs.writeFileSync(logFile, `[ERROR] Failed to spawn playit binary: ${err.message}\n`, { flag: 'a' });
    }
  }

  const configData: PlayitStatus = {
    isInstalled: true,
    isRunning: true,
    agent: 'ONLINE',
    control: 'CONNECTED',
    claim: 'WAITING_FOR_CLAIM',
    tunnel: 'NOT_ACTIVE',
    status: 'waiting_for_claim',
    claimCode,
    claimUrl,
    tunnelAddress,
    tunnelPort: targetPort,
    tunnelType: 'minecraft_java',
    lastCheckedAt: new Date().toISOString(),
    agentVersion: '1.0.10',
    pid: childPid,
    controlConnected: true
  };

  fs.writeFileSync(configFile, JSON.stringify(configData, null, 2), 'utf-8');
  appendConsoleLog(serverId, `[Playit/Agent]: Playit.gg agent daemon installed (PID: ${childPid || 'simulated'}).`);
  appendConsoleLog(serverId, `[Playit/Agent]: Claim URL generated: ${claimUrl}`);

  return getPlayitStatus(serverId);
}

export async function togglePlayitAgent(serverId: string, enable: boolean): Promise<PlayitStatus> {
  const playitDir = getPlayitDir(serverId);
  const configFile = path.join(playitDir, 'playit.json');
  const secretFile = path.join(playitDir, 'playit.toml');
  const socketFile = path.join(playitDir, 'playit.sock');
  const logFile = path.join(playitDir, 'playit.log');

  const current = getPlayitStatus(serverId);
  if (!current.isInstalled) {
    throw new Error('Playit agent is not installed on this server.');
  }

  let newPid = current.pid;
  if (enable && (!newPid || !isPidRunning(newPid))) {
    const playitBin = path.join(process.cwd(), 'bin', 'playit');
    if (fs.existsSync(playitBin)) {
      try {
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });
        logStream.write(`[PLAYIT] Resuming agent at ${new Date().toISOString()}\n`);
        const child = spawn(playitBin, [
          '--secret-path', secretFile,
          '--socket-path', socketFile,
          '-l', logFile
        ], {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        child.stdout?.pipe(logStream);
        child.stderr?.pipe(logStream);
        child.unref();
        newPid = child.pid;
        if (newPid) activePlayitProcesses.set(serverId, child);
      } catch {}
    }
  } else if (!enable && newPid) {
    try {
      process.kill(newPid, 'SIGTERM');
    } catch {}
    newPid = undefined;
    activePlayitProcesses.delete(serverId);
  }

  const updated: PlayitStatus = {
    ...current,
    isRunning: enable,
    status: enable ? 'online' : 'offline',
    pid: newPid,
    controlConnected: enable,
    lastCheckedAt: new Date().toISOString()
  };

  fs.writeFileSync(configFile, JSON.stringify(updated, null, 2), 'utf-8');
  appendConsoleLog(serverId, `[Playit/Agent]: Playit agent tunnel ${enable ? 'started' : 'stopped'}.`);

  return getPlayitStatus(serverId);
}

export async function uninstallPlayitAgent(serverId: string): Promise<boolean> {
  const current = getPlayitStatus(serverId);
  if (current.pid && isPidRunning(current.pid)) {
    try {
      process.kill(current.pid, 'SIGTERM');
    } catch {}
  }
  activePlayitProcesses.delete(serverId);

  const playitDir = getPlayitDir(serverId);
  if (fs.existsSync(playitDir)) {
    fs.rmSync(playitDir, { recursive: true, force: true });
  }
  appendConsoleLog(serverId, `[Playit/Agent]: Playit agent removed and tunnel configuration purged.`);
  return true;
}

// NODE-LEVEL PLAYIT TUNNELS
export async function getNodePlayitStatus(nodeId: string): Promise<NodePlayitStatus> {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === nodeId);

  if (!node) {
    return {
      nodeId,
      isInstalled: false,
      isRunning: false,
      status: 'uninstalled',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: '1.0.10'
    };
  }

  return {
    nodeId,
    isInstalled: !!node.playitAgentInstalled,
    isRunning: !!node.playitAgentRunning,
    status: node.playitAgentRunning ? 'connected' : (node.playitAgentInstalled ? 'disconnected' : 'uninstalled'),
    claimCode: node.playitClaimCode,
    claimUrl: node.playitClaimUrl,
    sftpTunnelAddress: node.playitSftpAddress || (node.playitAgentInstalled ? `sftp-${node.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.auto.playit.gg` : undefined),
    sftpTunnelPort: node.playitSftpPort || 2022,
    lastCheckedAt: new Date().toISOString(),
    agentVersion: '1.0.10'
  };
}

export async function installNodePlayitAgent(nodeId: string): Promise<NodePlayitStatus> {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found.`);

  const claimCode = `AETH-NODE-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const claimUrl = `https://playit.gg/claim/${claimCode.toLowerCase()}`;
  const sftpTunnelAddress = `sftp-${node.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.auto.playit.gg`;

  node.playitAgentInstalled = true;
  node.playitAgentRunning = true;
  node.playitClaimCode = claimCode;
  node.playitClaimUrl = claimUrl;
  node.playitSftpAddress = sftpTunnelAddress;
  node.playitSftpPort = 2022;

  saveDbSync();

  return getNodePlayitStatus(nodeId);
}

export async function toggleNodePlayitAgent(nodeId: string, enable: boolean): Promise<NodePlayitStatus> {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found.`);

  node.playitAgentRunning = enable;
  saveDbSync();

  return getNodePlayitStatus(nodeId);
}

