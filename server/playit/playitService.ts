import fs from 'fs';
import path from 'path';
import net from 'net';
import os from 'os';
import { spawn, ChildProcess, execSync } from 'child_process';
import { getDb, saveDbSync } from '../db';
import { getServerDir, appendConsoleLog } from '../provider';

export type PlayitAgentState = 
  | 'NOT_INSTALLED'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'STARTING'
  | 'RUNNING_UNCLAIMED'
  | 'CLAIM_URL_AVAILABLE'
  | 'CLAIMING'
  | 'CLAIMED'
  | 'RUNNING_CLAIMED'
  | 'STOPPING'
  | 'STOPPED'
  | 'CRASHED'
  | 'UNAVAILABLE'
  | 'BLOCKED'
  | 'ERROR';

export interface PlayitDiagnosticCheck {
  check: string;
  status: 'PASSED' | 'REPAIRED' | 'FAILED' | 'SKIPPED';
  message: string;
}

export interface PlayitStatus {
  isInstalled: boolean;
  isRunning: boolean;
  isClaimed: boolean;
  status: PlayitAgentState;
  agentStatus: 'RUNNING' | 'STOPPED' | 'STARTING' | 'CRASHED' | 'NOT_INSTALLED' | 'ERROR' | 'UNAVAILABLE' | 'BLOCKED';
  claimStatus: 'UNCLAIMED' | 'CLAIM_IN_PROGRESS' | 'CLAIM_URL_AVAILABLE' | 'CLAIMED';
  accountStatus: 'Connected' | 'Unlinked' | 'Pending';
  tunnelManagement: 'Managed externally';
  claimUrl?: string;
  claimCode?: string;
  agentVersion: string;
  pid?: number;
  logs?: string[];
  errorReason?: string;
  lastCheckedAt: string;
}

export interface NodePlayitStatus {
  nodeId: string;
  isInstalled: boolean;
  isRunning: boolean;
  isClaimed: boolean;
  status: PlayitAgentState;
  agentStatus: 'RUNNING' | 'STOPPED' | 'STARTING' | 'CRASHED' | 'NOT_INSTALLED' | 'ERROR' | 'UNAVAILABLE' | 'BLOCKED';
  claimStatus: 'UNCLAIMED' | 'CLAIM_IN_PROGRESS' | 'CLAIM_URL_AVAILABLE' | 'CLAIMED';
  accountStatus: 'Connected' | 'Unlinked' | 'Pending';
  tunnelManagement: 'Managed externally';
  claimUrl?: string;
  claimCode?: string;
  agentVersion: string;
  pid?: number;
  logs?: string[];
  errorReason?: string;
  lastCheckedAt: string;
}

export class PlayitConflictError extends Error {
  constructor(message: string = 'Playit operation is already in progress.') {
    super(message);
    this.name = 'PlayitConflictError';
  }
}

// Global Concurrency Lock Tracking
const activeOperationLocks = new Set<string>();

export function acquirePlayitLock(id: string): void {
  if (activeOperationLocks.has(id)) {
    throw new PlayitConflictError(`Playit operation is already in progress for '${id}'.`);
  }
  activeOperationLocks.add(id);
}

export function releasePlayitLock(id: string): void {
  activeOperationLocks.delete(id);
}

// Memory tracking of actively running processes and recovery parameters
interface ActiveProcessInfo {
  child: ChildProcess;
  pid: number;
  retryCount: number;
  lastStarted: number;
  crashed?: boolean;
  lastExitCode?: number | null;
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
  // Preferred node storage directory: data/nodes/<nodeId>/playit
  const dir = path.join(process.cwd(), 'data', 'nodes', nodeId, 'playit');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Validates if the local process id is genuinely active in the operating system
 * and matches the playit binary to detect stale PIDs and PID reuse.
 */
export function isPidRunning(pid?: number, requirePlayitCommand: boolean = true): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0); // Signals 0 checks process existence without killing
    if (requirePlayitCommand) {
      const cmdlinePath = `/proc/${pid}/cmdline`;
      if (fs.existsSync(cmdlinePath)) {
        const cmd = fs.readFileSync(cmdlinePath, 'utf-8');
        return cmd.includes('playit');
      }
      try {
        const psOut = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, { encoding: 'utf-8' }).trim();
        return psOut.toLowerCase().includes('playit');
      } catch {
        return true; // Fallback if proc/ps unavailable
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a JSON-RPC request to the Playit agent Unix domain socket.
 */
export function queryIpc(socketPath: string, req: any, timeoutMs = 2500): Promise<any> {
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
      let requestObj = req;
      if (typeof req === 'string') {
        requestObj = { type: req };
      } else if (req && typeof req === 'object' && req.type && !req.request) {
        requestObj = req;
      }
      const payload = JSON.stringify({
        ipc_version: 2,
        request_id: reqId,
        request: requestObj
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
 * Downloads official Playit agent binary matching system architecture.
 */
export function downloadPlayitBinarySync(): { success: boolean; error?: string } {
  const binDir = path.join(process.cwd(), 'bin');
  const binPath = path.join(binDir, 'playit');
  try {
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    const arch = os.arch();
    let downloadUrl = '';
    
    if (arch === 'arm64' || arch === 'aarch64') {
      downloadUrl = 'https://github.com/playit-cloud/playit-agent/releases/download/v1.0.10/playit-linux-aarch64';
    } else if (arch === 'x64' || arch === 'amd64') {
      downloadUrl = 'https://github.com/playit-cloud/playit-agent/releases/download/v1.0.10/playit-linux-amd64';
    } else if (arch === 'arm') {
      downloadUrl = 'https://github.com/playit-cloud/playit-agent/releases/download/v1.0.10/playit-linux-armv7';
    } else {
      return { success: false, error: `Unsupported architecture for Playit agent: ${arch}` };
    }

    console.log(`[PLAYIT] Downloading official Playit.GG agent binary (${arch}) from ${downloadUrl}...`);
    execSync(`curl -fsSL -o "${binPath}" "${downloadUrl}"`, { stdio: 'ignore', timeout: 30000 });
    fs.chmodSync(binPath, '755');
    console.log(`[PLAYIT] Binary downloaded and permissions configured at ${binPath}`);
    return { success: true };
  } catch (err: any) {
    const msg = `Download failed: ${err.message || err}`;
    console.error(`[PLAYIT] ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Validates the Playit binary executable and auto-recovers if corrupted or missing.
 */
export function checkPlayitBinary(): { exists: boolean; runnable: boolean; version: string; reason?: string } {
  const binPath = path.join(process.cwd(), 'bin', 'playit');
  
  if (!fs.existsSync(binPath)) {
    console.warn('[PLAYIT] Binary missing, attempting auto-download...');
    const result = downloadPlayitBinarySync();
    if (!result.success) {
      return { exists: false, runnable: false, version: '1.0.10', reason: result.error || 'Playit agent binary missing and download failed.' };
    }
  }

  // Double check existence after potential download
  if (!fs.existsSync(binPath)) {
    return { exists: false, runnable: false, version: '1.0.10', reason: 'Playit agent binary missing.' };
  }

  try {
    fs.accessSync(binPath, fs.constants.X_OK);
  } catch {
    try {
      console.log('[PLAYIT] Attempting to fix executable permission...');
      fs.chmodSync(binPath, '755');
    } catch (err: any) {
      return { exists: true, runnable: false, version: '1.0.10', reason: `Binary is not executable and chmod failed: ${err.message}` };
    }
  }

  try {
    // Check if the binary actually runs and returns help output
    execSync(`"${binPath}" --help`, { stdio: 'ignore', timeout: 3500 });
    return { exists: true, runnable: true, version: '1.0.10' };
  } catch (err: any) {
    const errStr = String(err.stderr || err.stdout || err.message || err);
    
    // Check for common execution errors
    if (errStr.includes('format error') || errStr.includes('exec format') || err.status === 126 || err.status === 127 || errStr.includes('Bad address')) {
      const isGvisor = os.release().toLowerCase().includes('gvisor');
      if (isGvisor || errStr.includes('Bad address') || err.status === 126) {
        return {
          exists: true,
          runnable: false,
          version: '1.0.10',
          reason: 'Host environment restriction (gVisor container sandbox syscall barrier: Bad address / code 126). Execution requires a full Linux kernel / VPS.'
        };
      }

      console.warn(`[PLAYIT] Binary execution format mismatch or corruption detected (Arch: ${os.arch()}). Re-downloading...`);
      const result = downloadPlayitBinarySync();
      if (result.success) {
        try {
          execSync(`"${binPath}" --help`, { stdio: 'ignore', timeout: 3500 });
          return { exists: true, runnable: true, version: '1.0.10' };
        } catch (retryErr: any) {
          return { exists: true, runnable: false, version: '1.0.10', reason: `Re-downloaded binary execution check failed: ${retryErr.message}` };
        }
      }
      return { exists: true, runnable: false, version: '1.0.10', reason: `Incompatible architecture or binary corruption: ${result.error}` };
    }

    // Playit might exit with non-zero on --help in some versions/envs, so we check status codes
    if (err.status === 2 || err.status === 1 || err.status === 0) {
      return { exists: true, runnable: true, version: '1.0.10' };
    }
    
    return { exists: true, runnable: false, version: '1.0.10', reason: `Execution verification error (Code: ${err.status}): ${err.message || err}` };
  }
}

/**
 * Extracts real-time claim URLs generated directly by Playit daemon from logs or stdout.
 * Never constructs fake or mock claim codes.
 */
export function parseLogsForMetadata(logText: string): {
  claimUrl?: string;
  claimCode?: string;
} {
  const result: { claimUrl?: string; claimCode?: string } = {};

  const claimUrlRegex = /https?:\/\/(?:www\.)?playit\.gg\/(?:claim|login\/guest-account)\/([a-zA-Z0-9_-]+)/i;
  const match = logText.match(claimUrlRegex);
  if (match) {
    result.claimUrl = match[0];
    result.claimCode = match[1].toUpperCase();
  }

  return result;
}

/**
 * Checks if playit.toml contains a genuine secret key.
 */
export function isAgentSecretClaimed(secretFile: string): boolean {
  if (!fs.existsSync(secretFile)) return false;
  try {
    const content = fs.readFileSync(secretFile, 'utf-8');
    const match = content.match(/secret_key\s*=\s*"([^"]+)"/);
    return !!match && match[1].trim().length > 10;
  } catch {
    return false;
  }
}

/**
 * Maps state boolean parameters cleanly into PlayitAgentState lifecycle values.
 */
function resolveTruthfulState(
  isInstalled: boolean,
  isRunning: boolean,
  isClaimed: boolean,
  isStarting: boolean,
  isCrashed: boolean,
  hasError: boolean,
  hasClaimUrl: boolean,
  isClaiming: boolean = false,
  isBlockedOrUnavailable: boolean = false
): {
  status: PlayitAgentState;
  agentStatus: 'RUNNING' | 'STOPPED' | 'STARTING' | 'CRASHED' | 'NOT_INSTALLED' | 'ERROR' | 'UNAVAILABLE' | 'BLOCKED';
  claimStatus: 'UNCLAIMED' | 'CLAIM_IN_PROGRESS' | 'CLAIM_URL_AVAILABLE' | 'CLAIMED';
  accountStatus: 'Connected' | 'Unlinked' | 'Pending';
} {
  if (!isInstalled) {
    return {
      status: 'NOT_INSTALLED',
      agentStatus: 'NOT_INSTALLED',
      claimStatus: 'UNCLAIMED',
      accountStatus: 'Unlinked'
    };
  }

  if (isBlockedOrUnavailable && !isRunning) {
    return {
      status: 'UNAVAILABLE',
      agentStatus: 'UNAVAILABLE',
      claimStatus: isClaimed ? 'CLAIMED' : 'UNCLAIMED',
      accountStatus: isClaimed ? 'Connected' : 'Unlinked'
    };
  }

  if (hasError && !isRunning) {
    return {
      status: 'ERROR',
      agentStatus: 'ERROR',
      claimStatus: isClaimed ? 'CLAIMED' : 'UNCLAIMED',
      accountStatus: isClaimed ? 'Connected' : 'Pending'
    };
  }

  if (isCrashed) {
    return {
      status: 'CRASHED',
      agentStatus: 'CRASHED',
      claimStatus: isClaimed ? 'CLAIMED' : 'UNCLAIMED',
      accountStatus: isClaimed ? 'Connected' : 'Pending'
    };
  }

  if (!isRunning) {
    return {
      status: 'STOPPED',
      agentStatus: 'STOPPED',
      claimStatus: isClaimed ? 'CLAIMED' : 'UNCLAIMED',
      accountStatus: isClaimed ? 'Connected' : 'Pending'
    };
  }

  if (isStarting) {
    return {
      status: 'STARTING',
      agentStatus: 'STARTING',
      claimStatus: isClaimed ? 'CLAIMED' : 'UNCLAIMED',
      accountStatus: isClaimed ? 'Connected' : 'Pending'
    };
  }

  if (isClaimed) {
    return {
      status: 'CLAIMED',
      agentStatus: 'RUNNING',
      claimStatus: 'CLAIMED',
      accountStatus: 'Connected'
    };
  }

  if (isClaiming) {
    return {
      status: 'CLAIMING',
      agentStatus: 'RUNNING',
      claimStatus: 'CLAIM_IN_PROGRESS',
      accountStatus: 'Pending'
    };
  }

  if (hasClaimUrl) {
    return {
      status: 'CLAIM_URL_AVAILABLE',
      agentStatus: 'RUNNING',
      claimStatus: 'CLAIM_URL_AVAILABLE',
      accountStatus: 'Pending'
    };
  }

  return {
    status: 'RUNNING_UNCLAIMED',
    agentStatus: 'RUNNING',
    claimStatus: 'UNCLAIMED',
    accountStatus: 'Pending'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER-LEVEL PLAYIT AGENT
// ─────────────────────────────────────────────────────────────────────────────

export async function getPlayitStatus(serverId: string): Promise<PlayitStatus> {
  const playitDir = getPlayitDir(serverId);
  const configFile = path.join(playitDir, 'playit.json');
  const secretFile = path.join(playitDir, 'playit.toml');
  const socketFile = path.join(playitDir, 'playit.sock');
  const logFile = path.join(playitDir, 'playit.log');

  let logs: string[] = [];
  if (fs.existsSync(logFile)) {
    try {
      logs = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean).slice(-35);
    } catch {}
  }

  const binCheck = checkPlayitBinary();
  if (!binCheck.exists) {
    return {
      isInstalled: false,
      isRunning: false,
      isClaimed: false,
      status: 'NOT_INSTALLED',
      agentStatus: 'NOT_INSTALLED',
      claimStatus: 'UNCLAIMED',
      accountStatus: 'Unlinked',
      tunnelManagement: 'Managed externally',
      agentVersion: '1.0.10',
      lastCheckedAt: new Date().toISOString(),
      errorReason: binCheck.reason || 'Binary not installed.',
      logs
    };
  }

  let savedConfig: any = {};
  if (fs.existsSync(configFile)) {
    try {
      savedConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    } catch {}
  }

  const activeProc = activePlayitProcesses.get(serverId);
  
  // PID Verification & Stale PID Cleanup
  let storedPid = activeProc ? activeProc.pid : savedConfig.pid;
  let running = isPidRunning(storedPid, true);

  if (savedConfig.pid && !running && !activeProc) {
    // Detect & clean stale PID
    console.log(`[PLAYIT] Stale PID ${savedConfig.pid} detected for server ${serverId}. Cleaning runtime state.`);
    savedConfig.pid = undefined;
    try {
      fs.writeFileSync(configFile, JSON.stringify(savedConfig, null, 2));
    } catch {}
  }

  const isStarting = activeProc ? (Date.now() - activeProc.lastStarted < 3000) : false;
  const isCrashed = activeProc?.crashed || (savedConfig.crashed && !running);

  // Check IPC socket if running
  let socketClaimed = false;
  let ipcStatusKnown = false;
  if (running && fs.existsSync(socketFile)) {
    try {
      const res = await queryIpc(socketFile, { type: 'get_status' }, 1000);
      if (res && res.data) {
        ipcStatusKnown = true;
        if (res.data.has_secret === true || res.data.phase === 'account_linked') {
          socketClaimed = true;
        } else if (res.data.phase === 'waiting_for_secret' || res.data.has_secret === false) {
          socketClaimed = false;
        }
      }
    } catch {}
  }

  const isClaimed = ipcStatusKnown ? socketClaimed : isAgentSecretClaimed(secretFile);

  // Parse logs for real Playit-generated claim metadata
  let claimCode: string | undefined = undefined;
  let claimUrl: string | undefined = undefined;

  // Query daemon over IPC for real claim URL if running
  if (running && fs.existsSync(socketFile)) {
    try {
      const loginRes = await queryIpc(socketFile, { type: 'get_account_login_url' }, 1000);
      if (loginRes && (loginRes.url || loginRes.data?.url)) {
        claimUrl = loginRes.url || loginRes.data?.url;
        const parsed = parseLogsForMetadata(claimUrl || '');
        claimCode = parsed.claimCode || undefined;
      }
    } catch {}
  }

  if (!claimUrl && fs.existsSync(logFile)) {
    try {
      const logContent = fs.readFileSync(logFile, 'utf-8');
      const parsed = parseLogsForMetadata(logContent);
      if (parsed.claimUrl) claimUrl = parsed.claimUrl;
      if (parsed.claimCode) claimCode = parsed.claimCode;
    } catch {}
  }

  // Filter out any stale/fake claim URLs
  const realSavedUrl = savedConfig.claimUrl && !savedConfig.claimUrl.includes('/claim/agent-') ? savedConfig.claimUrl : undefined;
  const realSavedCode = savedConfig.claimCode && !savedConfig.claimCode.startsWith('agent-') ? savedConfig.claimCode : undefined;

  const finalClaimUrl = isClaimed ? undefined : (claimUrl || realSavedUrl);
  const finalClaimCode = isClaimed ? undefined : (claimCode || realSavedCode);

  const isBlocked = !binCheck.runnable;
  const hasError = !!savedConfig.errorReason;
  const states = resolveTruthfulState(
    true,
    running,
    isClaimed,
    isStarting,
    !!isCrashed,
    hasError,
    !!finalClaimUrl,
    !!savedConfig.isClaiming,
    isBlocked
  );

  const finalPid = running ? storedPid : undefined;

  return {
    isInstalled: true,
    isRunning: running,
    isClaimed,
    status: states.status,
    agentStatus: states.agentStatus,
    claimStatus: states.claimStatus,
    accountStatus: states.accountStatus,
    tunnelManagement: 'Managed externally',
    claimUrl: finalClaimUrl,
    claimCode: finalClaimCode,
    agentVersion: binCheck.version || '1.0.10',
    pid: finalPid,
    logs,
    errorReason: savedConfig.errorReason || (!binCheck.runnable ? binCheck.reason : undefined),
    lastCheckedAt: new Date().toISOString()
  };
}

/**
 * Spawns a playit background agent daemon process.
 */
function spawnAgentProcess(
  id: string,
  secretPath: string,
  socketPath: string,
  logPath: string,
  onLogUpdate: (metadata: { claimUrl?: string; claimCode?: string }) => void,
  onExit: (code: number | null) => void
): ChildProcess | null {
  const binPath = path.join(process.cwd(), 'bin', 'playit');
  
  try {
    if (fs.existsSync(socketPath)) {
      try { fs.unlinkSync(socketPath); } catch {}
    }

    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n[PLAYIT] Starting Playit agent daemon at ${new Date().toISOString()}\n`);

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
    fs.writeFileSync(logPath, `[PLAYIT] Failed to spawn daemon: ${err.message}\n`, { flag: 'a' });
    return null;
  }
}

export async function installPlayitAgent(serverId: string): Promise<PlayitStatus> {
  acquirePlayitLock(serverId);
  try {
    const playitDir = getPlayitDir(serverId);
    const configFile = path.join(playitDir, 'playit.json');
    const logFile = path.join(playitDir, 'playit.log');

    const binCheck = checkPlayitBinary();
    if (!binCheck.runnable) {
      const blockedStatus = {
        isInstalled: true,
        isRunning: false,
        crashed: false,
        errorReason: binCheck.reason || 'Binary uncallable due to host sandbox restriction',
        agentVersion: '1.0.10',
        lastCheckedAt: new Date().toISOString()
      };
      fs.writeFileSync(configFile, JSON.stringify(blockedStatus, null, 2), 'utf-8');
      return await getPlayitStatus(serverId);
    }

    if (fs.existsSync(logFile)) {
      try { fs.unlinkSync(logFile); } catch {}
    }

    const initialStatus = {
      isInstalled: true,
      isRunning: true,
      crashed: false,
      claimCode: undefined,
      claimUrl: undefined,
      agentVersion: '1.0.10',
      lastCheckedAt: new Date().toISOString()
    };

    fs.writeFileSync(configFile, JSON.stringify(initialStatus, null, 2), 'utf-8');

    await togglePlayitAgentInternal(serverId, true);
    return await getPlayitStatus(serverId);
  } finally {
    releasePlayitLock(serverId);
  }
}

async function togglePlayitAgentInternal(serverId: string, enable: boolean): Promise<PlayitStatus> {
  const playitDir = getPlayitDir(serverId);
  const configFile = path.join(playitDir, 'playit.json');
  const secretFile = path.join(playitDir, 'playit.toml');
  const socketFile = path.join(playitDir, 'playit.sock');
  const logFile = path.join(playitDir, 'playit.log');

  const current = await getPlayitStatus(serverId);
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
              if (meta.claimUrl && !meta.claimUrl.includes('/claim/agent-')) fileData.claimUrl = meta.claimUrl;
              if (meta.claimCode && !meta.claimCode.startsWith('agent-')) fileData.claimCode = meta.claimCode;
              fs.writeFileSync(configFile, JSON.stringify(fileData, null, 2));
            }
          } catch {}
        },
        (code) => {
          const procInfo = activePlayitProcesses.get(serverId);
          if (procInfo) {
            procInfo.crashed = (code !== 0 && code !== null);
            procInfo.lastExitCode = code;
          }
          activePlayitProcesses.delete(serverId);
          appendConsoleLog(serverId, `[Playit/Agent]: Process exited with code ${code}.`);

          if (enable && retries < 5 && code !== 0) {
            const backoff = Math.min(4000 * Math.pow(1.5, retries), 30000);
            appendConsoleLog(serverId, `[Playit/Agent]: Reconnecting in ${Math.round(backoff / 1000)}s...`);
            setTimeout(() => {
              startAgent(retries + 1);
            }, backoff);
            
            try {
              if (fs.existsSync(configFile)) {
                const fd = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
                fd.crashed = true;
                fd.errorReason = `Process exited (code ${code}). Reconnecting...`;
                fs.writeFileSync(configFile, JSON.stringify(fd, null, 2));
              }
            } catch {}
          } else if (retries >= 5) {
            try {
              if (fs.existsSync(configFile)) {
                const fd = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
                fd.crashed = true;
                fd.errorReason = 'Process repeatedly exited. State marked as CRASHED.';
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
          lastStarted: Date.now(),
          crashed: false
        });

        try {
          if (fs.existsSync(configFile)) {
            const fd = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            fd.pid = child.pid;
            fd.crashed = false;
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
    
    if (fs.existsSync(socketFile)) {
      try { fs.unlinkSync(socketFile); } catch {}
    }

    try {
      if (fs.existsSync(configFile)) {
        const fd = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        fd.pid = undefined;
        fd.crashed = false;
        fs.writeFileSync(configFile, JSON.stringify(fd, null, 2));
      }
    } catch {}
  }

  return await getPlayitStatus(serverId);
}

export async function togglePlayitAgent(serverId: string, enable: boolean): Promise<PlayitStatus> {
  acquirePlayitLock(serverId);
  try {
    return await togglePlayitAgentInternal(serverId, enable);
  } finally {
    releasePlayitLock(serverId);
  }
}

export async function restartPlayitAgent(serverId: string): Promise<PlayitStatus> {
  acquirePlayitLock(serverId);
  try {
    await togglePlayitAgentInternal(serverId, false);
    await new Promise(r => setTimeout(r, 400));
    return await togglePlayitAgentInternal(serverId, true);
  } finally {
    releasePlayitLock(serverId);
  }
}

export async function provisionPlayitSecret(serverId: string, secretKey: string): Promise<PlayitStatus> {
  acquirePlayitLock(serverId);
  try {
    const playitDir = getPlayitDir(serverId);
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

    await togglePlayitAgentInternal(serverId, false);
    await new Promise(r => setTimeout(r, 300));
    return await togglePlayitAgentInternal(serverId, true);
  } finally {
    releasePlayitLock(serverId);
  }
}

/**
 * Initiates claim flow querying real daemon over IPC (`get_account_login_url` / `claim`)
 * or scanning live logs. If no URL is provided by Playit yet, returns success: false.
 */
export async function claimPlayitAgent(serverId: string): Promise<{
  success: boolean;
  state?: PlayitAgentState;
  claimStatus: 'UNCLAIMED' | 'CLAIMED' | 'CLAIM_URL_AVAILABLE';
  claimUrl: string | null;
  claimCode: string | null;
  message?: string;
}> {
  acquirePlayitLock(serverId);
  try {
    const current = await getPlayitStatus(serverId);
    if (current.isClaimed) {
      return {
        success: true,
        state: 'CLAIMED',
        claimStatus: 'CLAIMED',
        claimUrl: null,
        claimCode: null,
        message: 'Playit agent is already claimed and authenticated.'
      };
    }

    if (!current.isRunning) {
      await togglePlayitAgentInternal(serverId, true);
      await new Promise(r => setTimeout(r, 600));
    }

    const playitDir = getPlayitDir(serverId);
    const configFile = path.join(playitDir, 'playit.json');
    const logFile = path.join(playitDir, 'playit.log');
    const socketFile = path.join(playitDir, 'playit.sock');

    let foundClaimUrl: string | null = null;
    let foundClaimCode: string | null = null;

    if (fs.existsSync(socketFile)) {
      try {
        const res = await queryIpc(socketFile, { type: 'get_account_login_url' }, 2000);
        if (res && (res.url || res.data?.url)) {
          foundClaimUrl = res.url || res.data?.url;
          const parsed = parseLogsForMetadata(foundClaimUrl || '');
          foundClaimCode = parsed.claimCode || null;
        }
      } catch {}
    }

    if (!foundClaimUrl && fs.existsSync(logFile)) {
      try {
        const logContent = fs.readFileSync(logFile, 'utf-8');
        const parsed = parseLogsForMetadata(logContent);
        if (parsed.claimUrl) {
          foundClaimUrl = parsed.claimUrl;
          foundClaimCode = parsed.claimCode || null;
        }
      } catch {}
    }

    if (!foundClaimUrl) {
      if (fs.existsSync(configFile)) {
        try {
          const cfgData = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
          if (cfgData.claimUrl && !cfgData.claimUrl.includes('/claim/agent-')) {
            foundClaimUrl = cfgData.claimUrl;
            foundClaimCode = cfgData.claimCode && !cfgData.claimCode.startsWith('agent-') ? cfgData.claimCode : null;
          }
        } catch {}
      }
    }

    if (foundClaimUrl) {
      try {
        let fileData: any = {};
        if (fs.existsSync(configFile)) {
          fileData = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        }
        fileData.claimUrl = foundClaimUrl;
        if (foundClaimCode) fileData.claimCode = foundClaimCode;
        fs.writeFileSync(configFile, JSON.stringify(fileData, null, 2));
      } catch {}

      return {
        success: true,
        state: 'CLAIM_URL_AVAILABLE',
        claimStatus: 'UNCLAIMED',
        claimUrl: foundClaimUrl,
        claimCode: foundClaimCode,
        message: 'Real Playit agent claim URL retrieved.'
      };
    }

    return {
      success: false,
      state: 'RUNNING_UNCLAIMED',
      claimStatus: 'UNCLAIMED',
      claimUrl: null,
      claimCode: null,
      message: 'Playit agent is running, but Playit daemon has not provided a claim URL yet.'
    };
  } finally {
    releasePlayitLock(serverId);
  }
}

/**
 * Runs diagnostics, cleans up stale PIDs/sockets, and repairs the agent daemon.
 */
export async function repairPlayitAgent(serverId: string): Promise<{
  success: boolean;
  repaired: boolean;
  diagnostics: PlayitDiagnosticCheck[];
  status: PlayitStatus;
}> {
  acquirePlayitLock(serverId);
  try {
    const diagnostics: PlayitDiagnosticCheck[] = [];
    let repaired = false;

    // 1. Binary check
    const binCheck = checkPlayitBinary();
    if (binCheck.runnable) {
      diagnostics.push({ check: 'Binary Integrity', status: 'PASSED', message: 'Playit binary exists and is executable.' });
    } else {
      diagnostics.push({ check: 'Binary Integrity', status: 'REPAIRED', message: `Binary issue detected (${binCheck.reason}). Attempted download.` });
      repaired = true;
    }

    // 2. Playit directory
    const playitDir = getPlayitDir(serverId);
    const configFile = path.join(playitDir, 'playit.json');
    const socketFile = path.join(playitDir, 'playit.sock');
    const logFile = path.join(playitDir, 'playit.log');

    // 3. Stale PID check
    let savedConfig: any = {};
    if (fs.existsSync(configFile)) {
      try { savedConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8')); } catch {}
    }

    const activeProc = activePlayitProcesses.get(serverId);
    const storedPid = activeProc ? activeProc.pid : savedConfig.pid;
    const running = isPidRunning(storedPid, true);

    if (savedConfig.pid && !running && !activeProc) {
      savedConfig.pid = undefined;
      fs.writeFileSync(configFile, JSON.stringify(savedConfig, null, 2));
      diagnostics.push({ check: 'Stale PID Cleanup', status: 'REPAIRED', message: `Removed dead PID ${storedPid} from configuration.` });
      repaired = true;
    } else if (running) {
      diagnostics.push({ check: 'Process Status', status: 'PASSED', message: `Playit process PID ${storedPid} is active.` });
    } else {
      diagnostics.push({ check: 'Process Status', status: 'PASSED', message: 'Process is currently stopped.' });
    }

    // 4. Stale Socket check
    if (fs.existsSync(socketFile) && !running) {
      try {
        fs.unlinkSync(socketFile);
        diagnostics.push({ check: 'Orphan Socket Cleanup', status: 'REPAIRED', message: 'Removed orphan socket file.' });
        repaired = true;
      } catch {}
    } else if (running && fs.existsSync(socketFile)) {
      try {
        await queryIpc(socketFile, { type: 'get_status' }, 1000);
        diagnostics.push({ check: 'IPC Connectivity', status: 'PASSED', message: 'Daemon socket responded to IPC get_status.' });
      } catch (e: any) {
        fs.unlinkSync(socketFile);
        diagnostics.push({ check: 'IPC Connectivity', status: 'REPAIRED', message: 'Removed unresponsive socket file.' });
        repaired = true;
      }
    }

    // 5. Restart if enabled
    if (savedConfig.isRunning && !running) {
      await togglePlayitAgentInternal(serverId, true);
      diagnostics.push({ check: 'Agent Daemon Recovery', status: 'REPAIRED', message: 'Restarted Playit agent process.' });
      repaired = true;
    }

    return {
      success: true,
      repaired,
      diagnostics,
      status: await getPlayitStatus(serverId)
    };
  } finally {
    releasePlayitLock(serverId);
  }
}

export async function uninstallPlayitAgent(serverId: string): Promise<boolean> {
  acquirePlayitLock(serverId);
  try {
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
  } finally {
    releasePlayitLock(serverId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE-LEVEL PLAYIT AGENT
// ─────────────────────────────────────────────────────────────────────────────

export async function getNodePlayitStatus(nodeId: string): Promise<NodePlayitStatus> {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === nodeId);

  if (!node) {
    return {
      nodeId,
      isInstalled: false,
      isRunning: false,
      isClaimed: false,
      status: 'NOT_INSTALLED',
      agentStatus: 'NOT_INSTALLED',
      claimStatus: 'UNCLAIMED',
      accountStatus: 'Unlinked',
      tunnelManagement: 'Managed externally',
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
      isClaimed: false,
      status: 'NOT_INSTALLED',
      agentStatus: 'NOT_INSTALLED',
      claimStatus: 'UNCLAIMED',
      accountStatus: 'Unlinked',
      tunnelManagement: 'Managed externally',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: '1.0.10',
      errorReason: binCheck.reason || 'Binary missing.'
    };
  }

  const playitDir = getNodePlayitDir(nodeId);
  const secretFile = path.join(playitDir, 'playit.toml');
  const socketFile = path.join(playitDir, 'playit.sock');
  const logFile = path.join(playitDir, 'playit.log');

  const activeKey = `node_${nodeId}`;
  const active = activePlayitProcesses.get(activeKey);
  
  // Stale PID validation
  const running = active ? isPidRunning(active.pid, true) : !!node.playitAgentRunning;

  let socketClaimed = false;
  if (running && fs.existsSync(socketFile)) {
    try {
      const res = await queryIpc(socketFile, { type: 'get_status' }, 1000);
      if (res && res.data && (res.data.has_secret || res.data.phase === 'account_linked')) {
        socketClaimed = true;
      }
    } catch {}
  }

  const isClaimed = socketClaimed || isAgentSecretClaimed(secretFile);

  let claimCode: string | undefined = undefined;
  let claimUrl: string | undefined = undefined;

  if (fs.existsSync(logFile)) {
    try {
      const logs = fs.readFileSync(logFile, 'utf-8');
      const meta = parseLogsForMetadata(logs);
      if (meta.claimUrl) claimUrl = meta.claimUrl;
      if (meta.claimCode) claimCode = meta.claimCode;
    } catch {}
  }

  let logsArray: string[] = [];
  if (fs.existsSync(logFile)) {
    try {
      logsArray = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean).slice(-35);
    } catch {}
  }

  const isStarting = active ? (Date.now() - active.lastStarted < 3000) : false;
  const isCrashed = active?.crashed || false;
  const isBlocked = !binCheck.runnable;
  const hasError = !binCheck.exists;

  const states = resolveTruthfulState(
    !!node.playitAgentInstalled,
    running,
    isClaimed,
    isStarting,
    isCrashed,
    hasError,
    !!claimUrl,
    false,
    isBlocked
  );

  return {
    nodeId,
    isInstalled: !!node.playitAgentInstalled,
    isRunning: running,
    isClaimed,
    status: states.status,
    agentStatus: states.agentStatus,
    claimStatus: states.claimStatus,
    accountStatus: states.accountStatus,
    tunnelManagement: 'Managed externally',
    claimUrl: isClaimed ? undefined : claimUrl,
    claimCode: isClaimed ? undefined : claimCode,
    lastCheckedAt: new Date().toISOString(),
    agentVersion: binCheck.version || '1.0.10',
    pid: active && running ? active.pid : undefined,
    errorReason: !binCheck.runnable ? binCheck.reason : undefined,
    logs: logsArray
  };
}

export async function installNodePlayitAgent(nodeId: string): Promise<NodePlayitStatus> {
  acquirePlayitLock(`node_${nodeId}`);
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found.`);

    const binCheck = checkPlayitBinary();
    if (!binCheck.runnable) {
      throw new Error(`Incompatible Playit environment: ${binCheck.reason || 'Binary uncallable'}`);
    }

    const playitDir = getNodePlayitDir(nodeId);
    const logFile = path.join(playitDir, 'playit.log');
    if (fs.existsSync(logFile)) {
      try { fs.unlinkSync(logFile); } catch {}
    }

    node.playitAgentInstalled = true;
    node.playitAgentRunning = true;
    node.playitClaimCode = undefined;
    node.playitClaimUrl = undefined;
    saveDbSync();

    await toggleNodePlayitAgentInternal(nodeId, true);
    return getNodePlayitStatus(nodeId);
  } finally {
    releasePlayitLock(`node_${nodeId}`);
  }
}

async function toggleNodePlayitAgentInternal(nodeId: string, enable: boolean): Promise<NodePlayitStatus> {
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
          saveDbSync();
        },
        (code) => {
          const procInfo = activePlayitProcesses.get(activeKey);
          if (procInfo) {
            procInfo.crashed = (code !== 0 && code !== null);
          }
          activePlayitProcesses.delete(activeKey);
          
          if (enable && retries < 5 && code !== 0) {
            const backoff = Math.min(4000 * Math.pow(1.5, retries), 30000);
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
          lastStarted: Date.now(),
          crashed: false
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

    if (fs.existsSync(socketFile)) {
      try { fs.unlinkSync(socketFile); } catch {}
    }
  }

  return getNodePlayitStatus(nodeId);
}

export async function toggleNodePlayitAgent(nodeId: string, enable: boolean): Promise<NodePlayitStatus> {
  acquirePlayitLock(`node_${nodeId}`);
  try {
    return await toggleNodePlayitAgentInternal(nodeId, enable);
  } finally {
    releasePlayitLock(`node_${nodeId}`);
  }
}

export async function restartNodePlayitAgent(nodeId: string): Promise<NodePlayitStatus> {
  acquirePlayitLock(`node_${nodeId}`);
  try {
    await toggleNodePlayitAgentInternal(nodeId, false);
    await new Promise(r => setTimeout(r, 400));
    return await toggleNodePlayitAgentInternal(nodeId, true);
  } finally {
    releasePlayitLock(`node_${nodeId}`);
  }
}

export async function provisionNodePlayitSecret(nodeId: string, secretKey: string): Promise<NodePlayitStatus> {
  acquirePlayitLock(`node_${nodeId}`);
  try {
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

    await toggleNodePlayitAgentInternal(nodeId, false);
    await new Promise(r => setTimeout(r, 300));
    return await toggleNodePlayitAgentInternal(nodeId, true);
  } finally {
    releasePlayitLock(`node_${nodeId}`);
  }
}

/**
 * Initiates Node Playit claim action.
 */
export async function claimNodePlayitAgent(nodeId: string): Promise<{
  success: boolean;
  state?: PlayitAgentState;
  claimStatus: 'UNCLAIMED' | 'CLAIMED' | 'CLAIM_URL_AVAILABLE';
  claimUrl: string | null;
  claimCode: string | null;
  message?: string;
}> {
  acquirePlayitLock(`node_${nodeId}`);
  try {
    const current = await getNodePlayitStatus(nodeId);
    if (current.isClaimed) {
      return {
        success: true,
        state: 'CLAIMED',
        claimStatus: 'CLAIMED',
        claimUrl: null,
        claimCode: null,
        message: 'Node Playit agent is already claimed and authenticated.'
      };
    }

    if (!current.isRunning) {
      await toggleNodePlayitAgentInternal(nodeId, true);
      await new Promise(r => setTimeout(r, 600));
    }

    const playitDir = getNodePlayitDir(nodeId);
    const logFile = path.join(playitDir, 'playit.log');
    const socketFile = path.join(playitDir, 'playit.sock');

    let foundClaimUrl: string | null = null;
    let foundClaimCode: string | null = null;

    if (fs.existsSync(socketFile)) {
      try {
        const res = await queryIpc(socketFile, { type: 'get_account_login_url' }, 2000);
        if (res && (res.url || res.data?.url)) {
          foundClaimUrl = res.url || res.data?.url;
          const parsed = parseLogsForMetadata(foundClaimUrl || '');
          foundClaimCode = parsed.claimCode || null;
        }
      } catch {}
    }

    if (!foundClaimUrl && fs.existsSync(logFile)) {
      try {
        const logContent = fs.readFileSync(logFile, 'utf-8');
        const parsed = parseLogsForMetadata(logContent);
        if (parsed.claimUrl) {
          foundClaimUrl = parsed.claimUrl;
          foundClaimCode = parsed.claimCode || null;
        }
      } catch {}
    }

    if (!foundClaimUrl) {
      const refreshed = await getNodePlayitStatus(nodeId);
      if (refreshed.claimUrl) {
        foundClaimUrl = refreshed.claimUrl;
        foundClaimCode = refreshed.claimCode || null;
      }
    }

    if (foundClaimUrl) {
      const db = await getDb();
      const node = db.nodes.find(n => n.id === nodeId);
      if (node) {
        node.playitClaimUrl = foundClaimUrl;
        if (foundClaimCode) node.playitClaimCode = foundClaimCode;
        saveDbSync();
      }

      return {
        success: true,
        state: 'CLAIM_URL_AVAILABLE',
        claimStatus: 'CLAIM_URL_AVAILABLE',
        claimUrl: foundClaimUrl,
        claimCode: foundClaimCode,
        message: 'Real node Playit agent claim URL retrieved.'
      };
    }

    return {
      success: false,
      state: 'RUNNING_UNCLAIMED',
      claimStatus: 'UNCLAIMED',
      claimUrl: null,
      claimCode: null,
      message: 'Playit agent is running, but Playit has not provided a claim URL yet.'
    };
  } finally {
    releasePlayitLock(`node_${nodeId}`);
  }
}

/**
 * Diagnostic and Repair flow for Node Playit Agent.
 */
export async function repairNodePlayitAgent(nodeId: string): Promise<{
  success: boolean;
  repaired: boolean;
  diagnostics: PlayitDiagnosticCheck[];
  status: NodePlayitStatus;
}> {
  acquirePlayitLock(`node_${nodeId}`);
  try {
    const diagnostics: PlayitDiagnosticCheck[] = [];
    let repaired = false;

    const binCheck = checkPlayitBinary();
    if (binCheck.runnable) {
      diagnostics.push({ check: 'Binary Integrity', status: 'PASSED', message: 'Playit binary exists and is executable.' });
    } else {
      diagnostics.push({ check: 'Binary Integrity', status: 'REPAIRED', message: `Binary issue detected (${binCheck.reason}). Attempted auto-redownload.` });
      repaired = true;
    }

    const playitDir = getNodePlayitDir(nodeId);
    const socketFile = path.join(playitDir, 'playit.sock');

    const activeKey = `node_${nodeId}`;
    const active = activePlayitProcesses.get(activeKey);
    const running = active ? isPidRunning(active.pid, true) : false;

    if (active && !running) {
      activePlayitProcesses.delete(activeKey);
      diagnostics.push({ check: 'Stale PID Cleanup', status: 'REPAIRED', message: `Removed dead PID ${active.pid} reference.` });
      repaired = true;
    } else if (running) {
      diagnostics.push({ check: 'Process Status', status: 'PASSED', message: `Node process PID ${active?.pid} is active.` });
    }

    if (fs.existsSync(socketFile) && !running) {
      try {
        fs.unlinkSync(socketFile);
        diagnostics.push({ check: 'Orphan Socket Cleanup', status: 'REPAIRED', message: 'Removed orphan socket file.' });
        repaired = true;
      } catch {}
    } else if (running && fs.existsSync(socketFile)) {
      try {
        await queryIpc(socketFile, { type: 'get_status' }, 1000);
        diagnostics.push({ check: 'IPC Connectivity', status: 'PASSED', message: 'Socket responded to IPC status query.' });
      } catch {
        fs.unlinkSync(socketFile);
        diagnostics.push({ check: 'IPC Connectivity', status: 'REPAIRED', message: 'Cleaned unresponsive socket.' });
        repaired = true;
      }
    }

    const db = await getDb();
    const node = db.nodes.find(n => n.id === nodeId);
    if (node && node.playitAgentRunning && !running) {
      await toggleNodePlayitAgentInternal(nodeId, true);
      diagnostics.push({ check: 'Agent Recovery', status: 'REPAIRED', message: 'Restarted Node Playit daemon.' });
      repaired = true;
    }

    return {
      success: true,
      repaired,
      diagnostics,
      status: await getNodePlayitStatus(nodeId)
    };
  } finally {
    releasePlayitLock(`node_${nodeId}`);
  }
}

/**
 * Returns sanitized log history for server or node.
 */
export function getPlayitLogs(id: string, isNode: boolean = false, lineLimit = 100): string[] {
  const playitDir = isNode ? getNodePlayitDir(id) : getPlayitDir(id);
  const logFile = path.join(playitDir, 'playit.log');

  if (!fs.existsSync(logFile)) return [];

  try {
    const raw = fs.readFileSync(logFile, 'utf-8');
    const lines = raw.split('\n').filter(Boolean).slice(-Math.min(lineLimit, 500));
    // Sanitize secret keys in output logs
    return lines.map(line => line.replace(/secret_key\s*=\s*"[^"]+"/gi, 'secret_key = "[REDACTED]"'));
  } catch {
    return [];
  }
}

export async function initializePlayitOnBoot(): Promise<void> {
  console.log('[PLAYIT] Performing boot recovery diagnostics...');
  try {
    const db = await getDb();
    
    if (db && db.nodes) {
      for (const node of db.nodes) {
        if (node.playitAgentInstalled && node.playitAgentRunning) {
          console.log(`[PLAYIT] Auto-starting Playit agent for node: ${node.id}`);
          try {
            await toggleNodePlayitAgentInternal(node.id, true);
          } catch (err: any) {
            console.error(`[PLAYIT] Failed auto-start node playit agent for ${node.id}:`, err.message || err);
          }
        }
      }
    }

    if (db && db.servers) {
      for (const server of db.servers) {
        const playitDir = getPlayitDir(server.id);
        const configFile = path.join(playitDir, 'playit.json');
        if (fs.existsSync(configFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            if (data.isRunning) {
              console.log(`[PLAYIT] Auto-starting Playit agent for server: ${server.id}`);
              await togglePlayitAgentInternal(server.id, true);
            }
          } catch {}
        }
      }
    }
  } catch (err: any) {
    console.error('[PLAYIT] Boot recovery error:', err.message || err);
  }
}
