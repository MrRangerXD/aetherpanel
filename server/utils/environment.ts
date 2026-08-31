import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

export type NormalizedArchitecture = 'x86_64' | 'aarch64' | 'armv7' | 'armv6' | 'i386' | 'unknown';

export interface BinaryProbeResult {
  runnable: boolean;
  version?: string;
  exitCode?: number | string | null;
  error?: string;
  reason?: string;
  isBlockedBySandbox?: boolean;
}

export interface DetailedEnvironmentReport {
  os: string;
  arch: string;
  normalizedArch: NormalizedArchitecture;
  virtualization: string;
  isBareMetal: boolean;
  isVirtualMachine: boolean;
  isDocker: boolean;
  isLxc: boolean;
  isGvisor: boolean;
  isSandbox: boolean;
  systemd: boolean;
  tunAvailable: boolean;
  playitBinaryProbe: BinaryProbeResult;
  sftpCapability: {
    supported: boolean;
    configuredPort: number;
    hostKeyPresent: boolean;
  };
}

export interface EnvironmentCapabilities {
  systemd: 'Available' | 'Unavailable';
  detachedProcesses: 'Available' | 'Unavailable';
  persistentBackgroundProcesses: 'Available' | 'Limited' | 'Unavailable';
  executableDownload: 'Available' | 'Unavailable';
  playitAgentExecution: 'Available' | 'Restricted' | 'Unavailable';
  portBinding: 'Available' | 'Restricted';
  processSupervision: 'Native' | 'Fallback' | 'Limited';
  environmentLifetime: 'Persistent' | 'Ephemeral';
  environmentName: string;
  architecture: string;
  gvisorDetected: boolean;
  playitBlockReason?: string;
}

export function detectNormalizedArch(): NormalizedArchitecture {
  const arch = os.arch();
  let machine = '';
  try {
    machine = execSync('uname -m 2>/dev/null', { encoding: 'utf-8' }).trim().toLowerCase();
  } catch {}

  if (machine === 'x86_64' || machine === 'amd64' || arch === 'x64') {
    return 'x86_64';
  }
  if (machine === 'aarch64' || machine === 'arm64' || arch === 'arm64') {
    return 'aarch64';
  }
  if (machine.startsWith('armv7') || arch === 'arm') {
    return 'armv7';
  }
  if (machine.startsWith('armv6')) {
    return 'armv6';
  }
  if (machine === 'i386' || machine === 'i686' || arch === 'ia32') {
    return 'i386';
  }
  return 'unknown';
}

export function checkSystemd(): boolean {
  try {
    if (fs.existsSync('/run/systemd/system')) return true;
    const out = execSync('systemctl --version 2>/dev/null', { encoding: 'utf-8' });
    return out.includes('systemd');
  } catch {
    return false;
  }
}

export function checkGvisor(): boolean {
  try {
    const release = os.release().toLowerCase();
    if (release.includes('gvisor')) return true;
    
    if (fs.existsSync('/proc/version')) {
      const procVer = fs.readFileSync('/proc/version', 'utf-8').toLowerCase();
      if (procVer.includes('gvisor')) return true;
    }
  } catch {}
  return false;
}

export function checkTunAvailable(): boolean {
  try {
    return fs.existsSync('/dev/net/tun');
  } catch {
    return false;
  }
}

export function probePlayitBinaryExecution(): BinaryProbeResult {
  const binPath = path.join(process.cwd(), 'bin', 'playit');
  if (!fs.existsSync(binPath)) {
    return {
      runnable: false,
      reason: 'Playit binary does not exist in bin/playit'
    };
  }

  // Ensure executable permissions
  try {
    fs.chmodSync(binPath, '755');
  } catch {}

  const isGvisor = checkGvisor();

  try {
    const out = execSync(`"${binPath}" --help 2>&1`, { timeout: 3500, encoding: 'utf-8' });
    return {
      runnable: true,
      version: '1.0.10',
      exitCode: 0
    };
  } catch (err: any) {
    const errMsg = String(err.stderr || err.stdout || err.message || err);
    const code = err.status ?? (err.code || 1);

    const isBlocked = 
      isGvisor ||
      code === 126 ||
      errMsg.includes('Bad address') ||
      errMsg.includes('Operation not permitted') ||
      errMsg.includes('cannot execute') ||
      errMsg.includes('exec format error') ||
      errMsg.includes('Permission denied');

    let specificReason = `Binary exit code ${code}: ${errMsg.trim()}`;
    if (isGvisor || errMsg.includes('Bad address') || code === 126) {
      specificReason = 'Restricted container sandbox (gVisor syscall barrier: Bad address / code 126). Binary cannot execute in current sandbox kernel.';
    } else if (errMsg.includes('exec format error')) {
      specificReason = `Architecture execution mismatch (Arch: ${os.arch()}).`;
    }

    return {
      runnable: false,
      exitCode: code,
      error: errMsg.trim(),
      reason: specificReason,
      isBlockedBySandbox: isBlocked
    };
  }
}

export function detectHostEnvironment(): DetailedEnvironmentReport {
  const normArch = detectNormalizedArch();
  const isGv = checkGvisor();
  const hasSys = checkSystemd();
  const hasTun = checkTunAvailable();

  let isDocker = false;
  let isLxc = false;
  let isVirtualMachine = false;
  let isBareMetal = true;
  let isSandbox = false;
  let virtName = 'Bare Metal Linux';

  if (isGv) {
    isSandbox = true;
    isBareMetal = false;
    virtName = 'gVisor Container Sandbox';
  } else if (fs.existsSync('/.dockerenv')) {
    isDocker = true;
    isBareMetal = false;
    virtName = 'Docker Container';
  } else {
    try {
      const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf-8');
      if (cgroup.includes('docker') || cgroup.includes('containerd')) {
        isDocker = true;
        isBareMetal = false;
        virtName = 'Docker Container';
      }
    } catch {}
  }

  if (!isDocker && !isGv) {
    try {
      const environ = fs.readFileSync('/proc/1/environ', 'utf-8');
      if (environ.includes('container=lxc')) {
        isLxc = true;
        isBareMetal = false;
        virtName = 'LXC Container';
      }
    } catch {}
  }

  if (!isDocker && !isLxc && !isGv) {
    if (
      process.env.CODESANDBOX_SSE ||
      process.env.CSB_ENGINE_URL ||
      process.env.SANDBOX_URL ||
      process.env.REPL_ID ||
      process.env.GITPOD_WORKSPACE_ID
    ) {
      isSandbox = true;
      isBareMetal = false;
      virtName = 'Cloud IDE Sandbox';
    }
  }

  if (!isDocker && !isLxc && !isSandbox && !isGv) {
    try {
      if (fs.existsSync('/sys/class/dmi/id/product_name')) {
        const prodName = fs.readFileSync('/sys/class/dmi/id/product_name', 'utf-8').toLowerCase();
        if (
          prodName.includes('qemu') ||
          prodName.includes('kvm') ||
          prodName.includes('virtualbox') ||
          prodName.includes('vmware') ||
          prodName.includes('xen')
        ) {
          isVirtualMachine = true;
          isBareMetal = false;
          virtName = `Virtual Machine (${prodName.trim().toUpperCase()})`;
        }
      }
    } catch {}
  }

  const playitProbe = probePlayitBinaryExecution();
  const sftpPort = parseInt(process.env.SFTP_PORT || '2022', 10);
  const hostKeyPresent = fs.existsSync(path.join(process.cwd(), 'data', 'ssh_host_rsa_key'));

  return {
    os: os.type() + ' ' + os.release(),
    arch: os.arch(),
    normalizedArch: normArch,
    virtualization: virtName,
    isBareMetal,
    isVirtualMachine,
    isDocker,
    isLxc,
    isGvisor: isGv,
    isSandbox,
    systemd: hasSys,
    tunAvailable: hasTun,
    playitBinaryProbe: playitProbe,
    sftpCapability: {
      supported: true,
      configuredPort: sftpPort,
      hostKeyPresent
    }
  };
}

export function detectEnvironmentCapabilities(): EnvironmentCapabilities {
  const env = detectHostEnvironment();
  const hasSystemd = env.systemd;

  let playitAgentExecution: 'Available' | 'Restricted' | 'Unavailable' = 'Available';
  let playitBlockReason: string | undefined = undefined;

  if (env.isGvisor || env.playitBinaryProbe.isBlockedBySandbox) {
    playitAgentExecution = 'Unavailable';
    playitBlockReason = env.playitBinaryProbe.reason || 'Restricted container sandbox prevents Playit agent execution.';
  } else if (env.normalizedArch === 'unknown' || env.normalizedArch === 'armv6' || env.normalizedArch === 'i386') {
    playitAgentExecution = 'Unavailable';
    playitBlockReason = `Unsupported CPU architecture: ${env.arch}`;
  } else if (!env.playitBinaryProbe.runnable) {
    playitAgentExecution = 'Restricted';
    playitBlockReason = env.playitBinaryProbe.reason;
  }

  return {
    systemd: hasSystemd ? 'Available' : 'Unavailable',
    detachedProcesses: 'Available',
    persistentBackgroundProcesses: env.isSandbox ? 'Limited' : 'Available',
    executableDownload: 'Available',
    playitAgentExecution,
    portBinding: (env.isDocker || env.isSandbox) ? 'Restricted' : 'Available',
    processSupervision: hasSystemd ? 'Native' : 'Fallback',
    environmentLifetime: env.isSandbox ? 'Ephemeral' : 'Persistent',
    environmentName: env.virtualization,
    architecture: env.arch,
    gvisorDetected: env.isGvisor,
    playitBlockReason
  };
}
