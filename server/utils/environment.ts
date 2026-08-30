import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

export interface EnvironmentCapabilities {
  systemd: 'Available' | 'Unavailable';
  detachedProcesses: 'Available' | 'Unavailable';
  persistentBackgroundProcesses: 'Available' | 'Limited' | 'Unavailable';
  executableDownload: 'Available' | 'Unavailable';
  playitAgentExecution: 'Available' | 'Unavailable';
  portBinding: 'Available' | 'Restricted';
  processSupervision: 'Native' | 'Fallback' | 'Limited';
  environmentLifetime: 'Persistent' | 'Ephemeral';
  environmentName: string;
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

export function detectEnvironmentCapabilities(): EnvironmentCapabilities {
  const hasSystemd = checkSystemd();
  
  let isDocker = false;
  let isLxc = false;
  let isVirtualMachine = false;
  let isBareMetal = true;
  let isSandbox = false;
  let environmentName = 'Bare Metal Linux';
  let isEphemeral = false;
  let persistentBackgroundProcesses: 'Available' | 'Limited' | 'Unavailable' = 'Available';

  // 1. Detect Docker
  if (fs.existsSync('/.dockerenv')) {
    isDocker = true;
    isBareMetal = false;
    environmentName = 'Docker Container';
  } else {
    try {
      const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf-8');
      if (cgroup.includes('docker') || cgroup.includes('containerd')) {
        isDocker = true;
        isBareMetal = false;
        environmentName = 'Docker Container';
      }
    } catch {}
  }

  // 2. Detect LXC
  try {
    const environ = fs.readFileSync('/proc/1/environ', 'utf-8');
    if (environ.includes('container=lxc')) {
      isLxc = true;
      isBareMetal = false;
      environmentName = 'LXC Container';
    }
  } catch {}

  // 3. Detect Sandboxes (CodeSandbox, Replit, Gitpod, Glitch, etc.)
  if (
    process.env.CODESANDBOX_SSE ||
    process.env.CSB_ENGINE_URL ||
    process.env.SANDBOX_URL ||
    process.env.REPL_ID ||
    process.env.REPL_SLUG ||
    process.env.GITPOD_WORKSPACE_ID ||
    process.env.GLITCH_PROJECT_ID ||
    process.env.PORT_3000_TCP_ADDR
  ) {
    isSandbox = true;
    isBareMetal = false;
    isEphemeral = true;
    persistentBackgroundProcesses = 'Limited';
    if (process.env.CODESANDBOX_SSE || process.env.CSB_ENGINE_URL) {
      environmentName = 'CodeSandbox VM';
    } else if (process.env.REPL_ID) {
      environmentName = 'Replit Workspace';
    } else if (process.env.GITPOD_WORKSPACE_ID) {
      environmentName = 'Gitpod Sandbox';
    } else {
      environmentName = 'Cloud Sandbox / Cloud IDE';
    }
  }

  // 4. Detect CI environments
  if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI) {
    isSandbox = true;
    isBareMetal = false;
    isEphemeral = true;
    persistentBackgroundProcesses = 'Unavailable';
    environmentName = 'CI/CD Pipeline Runner';
  }

  // 5. Detect VM (KVM, QEMU, VirtualBox, VMware)
  if (!isDocker && !isLxc && !isSandbox) {
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
          environmentName = `Virtual Machine (${prodName.trim().toUpperCase()})`;
        }
      } else {
        const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf-8').toLowerCase();
        if (cpuinfo.includes('qemu') || cpuinfo.includes('kvm') || cpuinfo.includes('hypervisor')) {
          isVirtualMachine = true;
          isBareMetal = false;
          environmentName = 'Virtual Machine (Hypervisor)';
        }
      }
    } catch {}
  }

  // Check if executable download works (needs outbound connection & write permission)
  let executableDownload: 'Available' | 'Unavailable' = 'Available';
  try {
    const binDir = path.join(process.cwd(), 'bin');
    fs.accessSync(binDir, fs.constants.W_OK);
  } catch {
    executableDownload = 'Unavailable';
  }

  // Check if playit execution is supported (checks if arch is x64 or arm64)
  const arch = os.arch();
  const playitAgentExecution: 'Available' | 'Unavailable' =
    (arch === 'x64' || arch === 'arm64' || arch === 'aarch64' || arch === 'amd64') ? 'Available' : 'Unavailable';

  // Port binding on general ports is restricted inside container networks
  // Port 3000 is always open, but arbitrary server ports like 25565 might not be reachable from WAN without external tools
  const portBinding: 'Available' | 'Restricted' = (isDocker || isSandbox) ? 'Restricted' : 'Available';

  // Process supervision model
  let processSupervision: 'Native' | 'Fallback' | 'Limited' = 'Native';
  if (hasSystemd) {
    processSupervision = 'Native';
  } else if (persistentBackgroundProcesses === 'Limited') {
    processSupervision = 'Limited';
  } else {
    processSupervision = 'Fallback';
  }

  return {
    systemd: hasSystemd ? 'Available' : 'Unavailable',
    detachedProcesses: 'Available', // Node.js standard
    persistentBackgroundProcesses,
    executableDownload,
    playitAgentExecution,
    portBinding,
    processSupervision,
    environmentLifetime: isEphemeral ? 'Ephemeral' : 'Persistent',
    environmentName
  };
}
