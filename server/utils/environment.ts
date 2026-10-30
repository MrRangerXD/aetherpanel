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
  portBinding: 'Available' | 'Restricted';
  processSupervision: 'Native' | 'Fallback' | 'Limited';
  environmentLifetime: 'Persistent' | 'Ephemeral';
  environmentName: string;
  architecture: string;
  gvisorDetected: boolean;
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

  return {
    systemd: hasSystemd ? 'Available' : 'Unavailable',
    detachedProcesses: 'Available',
    persistentBackgroundProcesses: env.isSandbox ? 'Limited' : 'Available',
    executableDownload: 'Available',
    portBinding: (env.isDocker || env.isSandbox) ? 'Restricted' : 'Available',
    processSupervision: hasSystemd ? 'Native' : 'Fallback',
    environmentLifetime: env.isSandbox ? 'Ephemeral' : 'Persistent',
    environmentName: env.virtualization,
    architecture: env.arch,
    gvisorDetected: env.isGvisor
  };
}
