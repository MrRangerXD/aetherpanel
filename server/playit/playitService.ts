import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn, ChildProcess, execSync } from 'child_process';
import { getDb, saveDbSync } from '../db';
import { getServerDir, appendConsoleLog } from '../provider';

export type PlayitAgentState = 
  | 'NOT_INSTALLED'
  | 'INSTALLED'
  | 'STOPPED'
  | 'STARTING'
  | 'RUNNING'
  | 'WAITING_FOR_CONFIGURATION'
  | 'CLAIM_REQUIRED'
  | 'CLAIMING'
  | 'CLAIMED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR';

export interface PlayitStatus {
  isInstalled: boolean;
  isRunning: boolean;
  agent: 'ONLINE' | 'OFFLINE';
  control: 'CONNECTED' | 'DISCONNECTED';
  claim: 'WAITING_FOR_CLAIM' | 'CLAIMED';
  tunnel: 'ONLINE' | 'NOT_ACTIVE';
  status: PlayitAgentState;
  claimUrl?: string;
  claimCode?: string;
  tunnelAddress?: string;
  tunnelPort?: number;
  tunnelType: 'minecraft_java' | 'minecraft_bedrock' | 'sftp' | 'custom';
  lastCheckedAt: string;
  agentVersion: string;
  pid?: number;
  logs?: string[];
  errorReason?: string;
}

export interface NodePlayitStatus {
  nodeId: string;
  isInstalled: boolean;
  isRunning: boolean;
  status: PlayitAgentState;
  claimUrl?: string;
  claimCode?: string;
  sftpTunnelAddress?: string;
  sftpTunnelPort?: number;
  lastCheckedAt: string;
  agentVersion: string;
  pid?: number;
  errorReason?: string;
  logs?: string[];
}

// Memory tracking of actively running processes and recovery parameters
interface ActiveProcessInfo {
  child: ChildProcess;
  pid: number;
  retryCount: number;
  lastStarted: number;
  backoffTimer?: NodeJS.Timeout;
}

const activePlayitProcesses = new Map<string, ActiveProcessInfo>();

// Directory resolver helpers
export function getPlayitDir(serverId: string): string {
  const dir = path.join(getServerDir(serverId), 'playit');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getNodePlayitDir(nodeId: string): string {
  const dir = path.join(process.cwd(), 'data', `playit_node_${nodeId}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Validates if the local process id is genuinely active in the operating system.
 */
function isPidRunning(pid?: number): boolean {
  if (!pid) return false;
  try {
    if (!process.kill(pid, 0)) return false;
    const cmdlinePath = `/proc/${pid}/cmdline`;
    if (fs.existsSync(cmdlinePath)) {
      const cmd = fs.readFileSync(cmdlinePath, 'utf-8');
      return cmd.includes('playit');
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a JSON-RPC-like IPC request to the Playit agent Unix domain socket.
 */
export function queryIpc(socketPath: string, req: any, timeoutMs = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(socketPath)) {
      return reject(new Error('IPC socket file does not exist'));
    }

    let client: net.Socket;
    try {
      client = net.createConnection(socketPath);
    } catch (err) {
      return reject(err);
    }

    let buffer = '';
    const reqId = Math.floor(Math.random() * 1000000);

    const timer = setTimeout(() => {
      client.destroy();
      reject(new Error('IPC query timeout'));
    }, timeoutMs);

    client.on('connect', () => {
      const payload = JSON.stringify({
        ipc_version: 2,
        request_id: reqId,
        request: req
      }) + '\n';
      client.write(payload);
    });

    client.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message_kind === 'response' && parsed.data && parsed.data.request_id === reqId) {
            clearTimeout(timer);
            client.end();
            return resolve(parsed.data.response);
          }
        } catch {}
      }
      buffer = lines[lines.length - 1];
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Downloads the official playit linux-amd64 binary.
 */
export function downloadPlayitBinarySync(): boolean {
  const binDir = path.join(process.cwd(), 'bin');
  const binPath = path.join(binDir, 'playit');
  try {
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }
    console.log(`[PLAYIT] Downloading official compatible Playit.GG binary to ${binPath}...`);
    execSync(`curl -L -o "${binPath}" "https://github.com/playit-cloud/playit-agent/releases/download/v1.0.10/playit-linux-amd64"`, { stdio: 'ignore', timeout: 15000 });
    fs.chmodSync(binPath, '755');
    console.log(`[PLAYIT] Binary downloaded and permissions configured.`);
    return true;
  } catch (err: any) {
    console.error(`[PLAYIT] Download failed: ${err.message || err}`);
    return false;
  }
}

/**
 * Validates the playit executable binary with actual execution and auto-downloads if corrupt/missing.
 */
export function checkPlayitBinary(): { exists: boolean; runnable: boolean; reason?: string } {
  const binPath = path.join(process.cwd(), 'bin', 'playit');
  
  if (!fs.existsSync(binPath)) {
    const ok = downloadPlayitBinarySync();
    if (!ok) {
      return { exists: false, runnable: false, reason: 'Binary missing and download failed.' };
    }
  }

  try {
    fs.accessSync(binPath, fs.constants.X_OK);
  } catch {
    try {
      fs.chmodSync(binPath, '755');
    } catch {
      return { exists: true, runnable: false, reason: 'Binary is not marked as executable.' };
    }
  }

  // Realistically execute to verify architecture and lack of corruption
  try {
    execSync(`"${binPath}" --help`, { stdio: 'ignore', timeout: 2000 });
    return { exists: true, runnable: true };
  } catch (err: any) {
    const errStr = String(err.message || err);
    if (errStr.includes('format error') || errStr.includes('exec format') || err.status === 126 || err.status === 127) {
      console.warn(`[PLAYIT] Binary is corrupted or incompatible. Attempting auto-recovery download...`);
      const ok = downloadPlayitBinarySync();
      if (ok) {
        try {
          execSync(`"${binPath}" --help`, { stdio: 'ignore', timeout: 2000 });
          return { exists: true, runnable: true };
        } catch {
          return { exists: true, runnable: false, reason: 'Re-downloaded binary still fails execution check.' };
        }
      }
      return { exists: true, runnable: false, reason: 'Exec format error: Binary is corrupted and auto-recovery failed.' };
    }
    if (err.status === 2 || err.status === 1 || err.status === 0) {
      return { exists: true, runnable: true };
    }
    return { exists: true, runnable: false, reason: `Execution verification failed: ${err.message || err}` };
  }
}

/**
 * Parses real-time claim urls, claim codes, or tunnel allocations from raw log chunks.
 */
function parseLogsForMetadata(logText: string): {
  claimUrl?: string;
  claimCode?: string;
  tunnelAddress?: string;
  tunnelPort?: number;
  waitingForSecret?: boolean;
} {
  const result: {
    claimUrl?: string;
    claimCode?: string;
    tunnelAddress?: string;
    tunnelPort?: number;
    waitingForSecret?: boolean;
  } = {};
  
  if (
    logText.includes('Waiting for frontend secret provisioning') ||
    logText.includes('secret_key required') ||
    logText.includes('no secret found')
  ) {
    result.waitingForSecret = true;
  }

  // Patterns for playit.gg claiming and tunnels
  const claimUrlRegex = /https?:\/\/(?:www\.)?playit\.gg\/claim\/([a-zA-Z0-9-]+)/i;
  const claimCodeRegex = /claim[ -_]code[:\s]+([a-zA-Z0-9-]+)/i;
  const tunnelRegex = /established.*at\s+([a-z0-9.-]+\.playit\.gg):(\d+)/i;
  const generalAllocationRegex = /allocated\s+([a-z0-9.-]+\.playit\.gg):(\d+)/i;

  const urlMatch = logText.match(claimUrlRegex);
  if (urlMatch) {
    result.claimUrl = urlMatch[0];
    result.claimCode = urlMatch[1].toUpperCase();
  } else {
    const codeMatch = logText.match(claimCodeRegex);
    if (codeMatch) {
      result.claimCode = codeMatch[1].toUpperCase();
      result.claimUrl = `https://playit.gg/claim/${codeMatch[1].toLowerCase()}`;
    }
  }

  const tunnelMatch = logText.match(tunnelRegex) || logText.match(generalAllocationRegex);
  if (tunnelMatch) {
    result.tunnelAddress = tunnelMatch[1];
    result.tunnelPort = parseInt(tunnelMatch[2], 10);
  }

  return result;
}

/**
 * Checks if a playit.toml config has been fully claimed (written secret key).
 */
function isAgentSecretClaimed(secretFile: string): boolean {
  if (!fs.existsSync(secretFile)) return false;
  try {
    const content = fs.readFileSync(secretFile, 'utf-8');
    const hasSecretKey = content.includes('secret_key') && content.split('secret_key')[1].includes('"');
    return hasSecretKey && content.length > 20;
  } catch {
    return false;
  }
}

function resolveLifecycleState(
  isInstalled: boolean,
  isRunning: boolean,
  isClaimed: boolean,
  hasClaimUrl: boolean,
  hasTunnelAllocated: boolean,
  hasError: boolean,
  hasConfig: boolean,
  isStarting: boolean = false,
  waitingForSecret: boolean = false
): PlayitAgentState {
  if (!isInstalled) return 'NOT_INSTALLED';
  if (hasError) return 'ERROR';
  if (!isRunning) {
    return hasConfig ? 'STOPPED' : 'INSTALLED';
  }
  if (isStarting) return 'STARTING';
  
  if (waitingForSecret) {
    return 'WAITING_FOR_CONFIGURATION';
  }

  if (!isClaimed) {
    if (hasClaimUrl) return 'CLAIMING';
    return 'WAITING_FOR_CONFIGURATION';
  }
  
  if (!hasTunnelAllocated) {
    return 'CLAIM_REQUIRED';
  }
  return 'CONNECTED';
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER LEVEL PLAYIT CONTROLS
// ─────────────────────────────────────────────────────────────────────────────

export function getPlayitStatus(serverId: string): PlayitStatus {
  const playitDir = getPlayitDir(serverId);
  const configFile = path.join(playitDir, 'playit.json');
  const secretFile = path.join(playitDir, 'playit.toml');
  const socketFile = path.join(playitDir, 'playit.sock');
  const logFile = path.join(playitDir, 'playit.log');

  let logs: string[] = [];
  if (fs.existsSync(logFile)) {
    try {
      logs = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean).slice(-30);
    } catch {}
  }

  const binCheck = checkPlayitBinary();
  if (!binCheck.exists) {
    return {
      isInstalled: false,
      isRunning: false,
      agent: 'OFFLINE',
      control: 'DISCONNECTED',
      claim: 'WAITING_FOR_CLAIM',
      tunnel: 'NOT_ACTIVE',
      status: 'NOT_INSTALLED',
      tunnelType: 'minecraft_java',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: '1.0.10',
      errorReason: binCheck.reason || 'Binary not installed.',
      logs
    };
  }

  if (!fs.existsSync(configFile)) {
    return {
      isInstalled: true,
      isRunning: false,
      agent: 'OFFLINE',
      control: 'DISCONNECTED',
      claim: 'WAITING_FOR_CLAIM',
      tunnel: 'NOT_ACTIVE',
      status: 'INSTALLED',
      tunnelType: 'minecraft_java',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: '1.0.10',
      logs
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const isClaimed = isAgentSecretClaimed(secretFile);
    
    // Validate if background process is active
    const activeProc = activePlayitProcesses.get(serverId);
    const running = activeProc ? isPidRunning(activeProc.pid) : isPidRunning(data.pid);

    const isStarting = activeProc ? (Date.now() - activeProc.lastStarted < 4000) : false;

    let claimUrl = data.claimUrl;
    let claimCode = data.claimCode;
    let tunnelAddress = data.tunnelAddress;
    let tunnelPort = data.tunnelPort;
    let waitingForSecret = false;

    // Parse logs for real-time claim Urls or secret provisioning state if present
    if (fs.existsSync(logFile)) {
      try {
        const logContent = fs.readFileSync(logFile, 'utf-8');
        const parsed = parseLogsForMetadata(logContent);
        if (parsed.claimUrl) claimUrl = parsed.claimUrl;
        if (parsed.claimCode) claimCode = parsed.claimCode;
        if (parsed.tunnelAddress) {
          tunnelAddress = parsed.tunnelAddress;
          tunnelPort = parsed.tunnelPort;
        }
        if (parsed.waitingForSecret) {
          waitingForSecret = true;
        }
      } catch {}
    }

    const hasTunnel = isClaimed && !!tunnelAddress && tunnelAddress.endsWith('.playit.gg');
    const hasError = !!data.errorReason || binCheck.runnable === false;

    const stateStatus = resolveLifecycleState(
      true,
      running,
      isClaimed,
      !!claimUrl,
      hasTunnel,
      hasError,
      true,
      isStarting,
      waitingForSecret
    );
    
    const agentState = running ? 'ONLINE' : 'OFFLINE';
    const controlState = (running && isClaimed) ? 'CONNECTED' : 'DISCONNECTED';
    const claimState = isClaimed ? 'CLAIMED' : 'WAITING_FOR_CLAIM';
    const tunnelState = (running && isClaimed && hasTunnel) ? 'ONLINE' : 'NOT_ACTIVE';

    return {
      isInstalled: true,
      isRunning: running,
      agent: agentState,
      control: controlState,
      claim: claimState,
      tunnel: tunnelState,
      status: stateStatus,
      claimUrl,
      claimCode,
      tunnelAddress: isClaimed ? tunnelAddress : undefined,
      tunnelPort: isClaimed ? tunnelPort : undefined,
      tunnelType: data.tunnelType || 'minecraft_java',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: data.agentVersion || '1.0.10',
      pid: activeProc ? activeProc.pid : data.pid,
      errorReason: data.errorReason,
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
      status: 'ERROR',
      tunnelType: 'minecraft_java',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: '1.0.10',
      errorReason: 'Failed to read status file.',
      logs
    };
  }
}

/**
 * Spawns a playit background agent daemon with clean socket handling.
 */
function spawnAgentProcess(
  id: string,
  secretPath: string,
  socketPath: string,
  logPath: string,
  onLogUpdate: (metadata: { claimUrl?: string; claimCode?: string; tunnelAddress?: string; tunnelPort?: number }) => void,
  onExit: (code: number | null) => void
): ChildProcess | null {
  const binPath = path.join(process.cwd(), 'bin', 'playit');
  
  try {
    // Clean socket file if orphaned
    if (fs.existsSync(socketPath)) {
      try {
        fs.unlinkSync(socketPath);
      } catch {}
    }

    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n[PLAYIT] Spawning agent process on ${new Date().toISOString()}\n`);

    const child = spawn(binPath, [
      '--secret-path', secretPath,
      '--socket-path', socketPath,
      '-l', logPath
    ], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      const parsed = parseLogsForMetadata(text);
      onLogUpdate(parsed);
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      const parsed = parseLogsForMetadata(text);
      onLogUpdate(parsed);
    });

    child.on('exit', (code) => {
      onExit(code);
    });

    child.unref();
    return child;
  } catch (err: any) {
    fs.writeFileSync(logPath, `[PLAYIT] Failed to spawn playit binary: ${err.message}\n`, { flag: 'a' });
    return null;
  }
}

export async function installPlayitAgent(serverId: string): Promise<PlayitStatus> {
  const playitDir = getPlayitDir(serverId);
  const configFile = path.join(playitDir, 'playit.json');
  const secretFile = path.join(playitDir, 'playit.toml');
  const socketFile = path.join(playitDir, 'playit.sock');
  const logFile = path.join(playitDir, 'playit.log');

  const binCheck = checkPlayitBinary();
  if (!binCheck.runnable) {
    throw new Error(`Incompatible Playit environment: ${binCheck.reason || 'Binary uncallable'}`);
  }

  // Clear existing logs
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  const initialStatus: PlayitStatus = {
    isInstalled: true,
    isRunning: true,
    agent: 'OFFLINE',
    control: 'DISCONNECTED',
    claim: 'WAITING_FOR_CLAIM',
    tunnel: 'NOT_ACTIVE',
    status: 'STARTING',
    tunnelType: 'minecraft_java',
    lastCheckedAt: new Date().toISOString(),
    agentVersion: '1.0.10'
  };

  fs.writeFileSync(configFile, JSON.stringify(initialStatus, null, 2), 'utf-8');

  // Trigger agent start
  await togglePlayitAgent(serverId, true);
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
    throw new Error('Playit agent is not installed.');
  }

  const active = activePlayitProcesses.get(serverId);

  if (enable) {
    if (active && isPidRunning(active.pid)) {
      return current;
    }

    const startAgent = (retries = 0) => {
      const child = spawnAgentProcess(
        serverId,
        secretFile,
        socketFile,
        logFile,
        (meta) => {
          try {
            if (fs.existsSync(configFile)) {
              const fileData = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
              if (meta.claimUrl) fileData.claimUrl = meta.claimUrl;
              if (meta.claimCode) fileData.claimCode = meta.claimCode;
              if (meta.tunnelAddress) fileData.tunnelAddress = meta.tunnelAddress;
              if (meta.tunnelPort) fileData.tunnelPort = meta.tunnelPort;
              fs.writeFileSync(configFile, JSON.stringify(fileData, null, 2));
            }
          } catch {}
        },
        (code) => {
          activePlayitProcesses.delete(serverId);
          appendConsoleLog(serverId, `[Playit/Agent]: Process exited with code ${code}.`);

          if (enable && retries < 5) {
            const backoff = Math.min(5000 * Math.pow(2, retries), 30000);
            appendConsoleLog(serverId, `[Playit/Agent]: Reconnecting in ${backoff / 1000}s...`);
            setTimeout(() => {
              startAgent(retries + 1);
            }, backoff);
            
            try {
              if (fs.existsSync(configFile)) {
                const fd = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
                fd.errorReason = `Process exited. Reconnecting... (Attempt ${retries + 1})`;
                fs.writeFileSync(configFile, JSON.stringify(fd, null, 2));
              }
            } catch {}
          } else if (retries >= 5) {
            try {
              if (fs.existsSync(configFile)) {
                const fd = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
                fd.errorReason = 'Process repeatedly crashed. State marked as DEGRADED.';
                fs.writeFileSync(configFile, JSON.stringify(fd, null, 2));
              }
            } catch {}
          }
        }
      );

      if (child && child.pid) {
        activePlayitProcesses.set(serverId, {
          child,
          pid: child.pid,
          retryCount: retries,
          lastStarted: Date.now()
        });

        try {
          if (fs.existsSync(configFile)) {
            const fd = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            fd.pid = child.pid;
            fd.errorReason = undefined;
            fs.writeFileSync(configFile, JSON.stringify(fd, null, 2));
          }
        } catch {}
      }
    };

    startAgent(0);
  } else {
    if (active) {
      try {
        process.kill(active.pid, 'SIGTERM');
      } catch {}
      activePlayitProcesses.delete(serverId);
    }
    
    try {
      if (fs.existsSync(configFile)) {
        const fd = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        fd.pid = undefined;
        fs.writeFileSync(configFile, JSON.stringify(fd, null, 2));
      }
    } catch {}
  }

  return getPlayitStatus(serverId);
}

export async function provisionPlayitSecret(serverId: string, secretKey: string): Promise<PlayitStatus> {
  const playitDir = getPlayitDir(serverId);
  const secretFile = path.join(playitDir, 'playit.toml');
  const socketFile = path.join(playitDir, 'playit.sock');

  const trimmedSecret = secretKey.trim();
  if (!trimmedSecret) throw new Error('Secret key cannot be empty.');

  // Write secret key to playit.toml
  fs.writeFileSync(secretFile, `secret_key = "${trimmedSecret}"\n`, 'utf-8');

  // Attempt set_secret over IPC
  if (fs.existsSync(socketFile)) {
    try {
      await queryIpc(socketFile, { type: 'set_secret', secret: trimmedSecret }, 2000);
    } catch {}
  }

  // Restart daemon to apply secret
  await togglePlayitAgent(serverId, false);
  await togglePlayitAgent(serverId, true);

  return getPlayitStatus(serverId);
}

export async function uninstallPlayitAgent(serverId: string): Promise<boolean> {
  const active = activePlayitProcesses.get(serverId);
  if (active) {
    try {
      process.kill(active.pid, 'SIGTERM');
    } catch {}
    activePlayitProcesses.delete(serverId);
  }

  const playitDir = getPlayitDir(serverId);
  if (fs.existsSync(playitDir)) {
    fs.rmSync(playitDir, { recursive: true, force: true });
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE LEVEL PLAYIT CONTROLS
// ─────────────────────────────────────────────────────────────────────────────

export async function getNodePlayitStatus(nodeId: string): Promise<NodePlayitStatus> {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === nodeId);

  if (!node) {
    return {
      nodeId,
      isInstalled: false,
      isRunning: false,
      status: 'NOT_INSTALLED',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: '1.0.10'
    };
  }

  const binCheck = checkPlayitBinary();
  if (!binCheck.exists) {
    return {
      nodeId,
      isInstalled: false,
      isRunning: false,
      status: 'NOT_INSTALLED',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: '1.0.10',
      errorReason: binCheck.reason || 'Binary missing.'
    };
  }

  const playitDir = getNodePlayitDir(nodeId);
  const secretFile = path.join(playitDir, 'playit.toml');
  const isClaimed = isAgentSecretClaimed(secretFile);

  const active = activePlayitProcesses.get(`node_${nodeId}`);
  const running = active ? isPidRunning(active.pid) : !!node.playitAgentRunning;

  let claimUrl = node.playitClaimUrl;
  let claimCode = node.playitClaimCode;
  let waitingForSecretNode = false;

  const logFile = path.join(playitDir, 'playit.log');
  if (fs.existsSync(logFile)) {
    try {
      const logs = fs.readFileSync(logFile, 'utf-8');
      const meta = parseLogsForMetadata(logs);
      if (meta.claimUrl) claimUrl = meta.claimUrl;
      if (meta.claimCode) claimCode = meta.claimCode;
      if (meta.waitingForSecret) waitingForSecretNode = true;
      
      if (isClaimed && meta.tunnelAddress) {
        node.playitSftpAddress = meta.tunnelAddress;
        node.playitSftpPort = meta.tunnelPort;
      }
    } catch {}
  }

  let logsArray: string[] = [];
  if (fs.existsSync(logFile)) {
    try {
      logsArray = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean).slice(-15);
    } catch {}
  }

  const isStarting = active ? (Date.now() - active.lastStarted < 4000) : false;
  const hasTunnel = isClaimed && !!node.playitSftpAddress && node.playitSftpAddress !== 'sftp-tunnel.playit.gg';
  const hasError = binCheck.runnable === false;

  const stateStatus = resolveLifecycleState(
    !!node.playitAgentInstalled,
    running,
    isClaimed,
    !!claimUrl,
    hasTunnel,
    hasError,
    !!node.playitAgentInstalled,
    isStarting,
    waitingForSecretNode
  );

  return {
    nodeId,
    isInstalled: !!node.playitAgentInstalled,
    isRunning: running,
    status: stateStatus,
    claimUrl,
    claimCode,
    sftpTunnelAddress: isClaimed ? node.playitSftpAddress : undefined,
    sftpTunnelPort: isClaimed ? (node.playitSftpPort || 2022) : undefined,
    lastCheckedAt: new Date().toISOString(),
    agentVersion: '1.0.10',
    pid: active?.pid,
    logs: logsArray
  };
}

export async function installNodePlayitAgent(nodeId: string): Promise<NodePlayitStatus> {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found.`);

  const binCheck = checkPlayitBinary();
  if (!binCheck.runnable) {
    throw new Error(`Incompatible Playit environment: ${binCheck.reason || 'Binary uncallable'}`);
  }

  const playitDir = getNodePlayitDir(nodeId);
  const logFile = path.join(playitDir, 'playit.log');
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  node.playitAgentInstalled = true;
  node.playitAgentRunning = true;
  saveDbSync();

  await toggleNodePlayitAgent(nodeId, true);
  return getNodePlayitStatus(nodeId);
}

export async function toggleNodePlayitAgent(nodeId: string, enable: boolean): Promise<NodePlayitStatus> {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found.`);

  const playitDir = getNodePlayitDir(nodeId);
  const secretFile = path.join(playitDir, 'playit.toml');
  const socketFile = path.join(playitDir, 'playit.sock');
  const logFile = path.join(playitDir, 'playit.log');

  const activeKey = `node_${nodeId}`;
  const active = activePlayitProcesses.get(activeKey);

  node.playitAgentRunning = enable;
  saveDbSync();

  if (enable) {
    if (active && isPidRunning(active.pid)) {
      return getNodePlayitStatus(nodeId);
    }

    const startNodeAgent = (retries = 0) => {
      const child = spawnAgentProcess(
        activeKey,
        secretFile,
        socketFile,
        logFile,
        (meta) => {
          if (meta.claimUrl) node.playitClaimUrl = meta.claimUrl;
          if (meta.claimCode) node.playitClaimCode = meta.claimCode;
          if (meta.tunnelAddress) {
            node.playitSftpAddress = meta.tunnelAddress;
            node.playitSftpPort = meta.tunnelPort;
          }
          saveDbSync();
        },
        (code) => {
          activePlayitProcesses.delete(activeKey);
          
          if (enable && retries < 5) {
            const backoff = Math.min(5000 * Math.pow(2, retries), 30000);
            setTimeout(() => {
              startNodeAgent(retries + 1);
            }, backoff);
          }
        }
      );

      if (child && child.pid) {
        activePlayitProcesses.set(activeKey, {
          child,
          pid: child.pid,
          retryCount: retries,
          lastStarted: Date.now()
        });
      }
    };

    startNodeAgent(0);
  } else {
    if (active) {
      try {
        process.kill(active.pid, 'SIGTERM');
      } catch {}
      activePlayitProcesses.delete(activeKey);
    }
  }

  return getNodePlayitStatus(nodeId);
}

export async function provisionNodePlayitSecret(nodeId: string, secretKey: string): Promise<NodePlayitStatus> {
  const playitDir = getNodePlayitDir(nodeId);
  const secretFile = path.join(playitDir, 'playit.toml');
  const socketFile = path.join(playitDir, 'playit.sock');

  const trimmedSecret = secretKey.trim();
  if (!trimmedSecret) throw new Error('Secret key cannot be empty.');

  fs.writeFileSync(secretFile, `secret_key = "${trimmedSecret}"\n`, 'utf-8');

  if (fs.existsSync(socketFile)) {
    try {
      await queryIpc(socketFile, { type: 'set_secret', secret: trimmedSecret }, 2000);
    } catch {}
  }

  await toggleNodePlayitAgent(nodeId, false);
  await toggleNodePlayitAgent(nodeId, true);

  return getNodePlayitStatus(nodeId);
}

export async function initializePlayitOnBoot(): Promise<void> {
  console.log('[PLAYIT] Performing real-time boot-up auto-recovery diagnostics...');
  try {
    const db = await getDb();
    
    // 1. Recover Node-level Playit tunnels
    if (db && db.nodes) {
      for (const node of db.nodes) {
        if (node.playitAgentInstalled && node.playitAgentRunning) {
          console.log(`[PLAYIT] Auto-starting node Playit agent for node: ${node.id}`);
          try {
            await toggleNodePlayitAgent(node.id, true);
          } catch (err: any) {
            console.error(`[PLAYIT] Failed to auto-recover node playit agent for ${node.id}:`, err.message || err);
          }
        }
      }
    }

    // 2. Recover Server-level Playit tunnels
    if (db && db.servers) {
      for (const server of db.servers) {
        const playitDir = getPlayitDir(server.id);
        const configFile = path.join(playitDir, 'playit.json');
        if (fs.existsSync(configFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            if (data.isRunning) {
              console.log(`[PLAYIT] Auto-starting server Playit agent for server: ${server.id}`);
              await togglePlayitAgent(server.id, true);
            }
          } catch {}
        }
      }
    }
  } catch (err: any) {
    console.error('[PLAYIT] Boot recovery error:', err.message || err);
  }
}
