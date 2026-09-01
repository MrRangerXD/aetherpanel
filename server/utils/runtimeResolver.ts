import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

export interface RuntimeInfo {
  available: boolean;
  executable: string;
  version: string;
  pipAvailable?: boolean;
  reason?: string;
}

export interface ExecutableInfo {
  available: boolean;
  executable: string;
  version: string;
  reason?: string;
}

/**
 * Ensures standard binary search directories are included in environment PATH
 */
export function getAugmentedEnv(): Record<string, string> {
  const currentPath = process.env.PATH || '';
  const homeBun = path.join(os.homedir(), '.bun', 'bin');
  const binDir = path.join(process.cwd(), 'bin');
  const runtimesBin = path.join(process.cwd(), 'data', 'runtimes', 'bun');

  const extraPaths = ['/usr/local/bin', '/usr/bin', '/bin', homeBun, binDir, runtimesBin];
  const pathParts = currentPath.split(path.delimiter);

  for (const p of extraPaths) {
    if (p && !pathParts.includes(p)) {
      pathParts.unshift(p);
    }
  }

  const env = {
    ...process.env,
    PATH: pathParts.join(path.delimiter),
    HOME: process.env.HOME || os.homedir(),
    USER: process.env.USER || (os.userInfo ? os.userInfo().username : 'aether')
  };

  return env as Record<string, string>;
}

/**
 * Resolves authoritative executable path and version for Bun, Node.js, and Python.
 */
export function resolveBotRuntimeExecutable(
  runtime: 'bun' | 'nodejs' | 'python',
  requestedVersion?: string
): RuntimeInfo {
  const env = getAugmentedEnv();

  if (runtime === 'bun') {
    const candidates = [
      'bun',
      '/usr/local/bin/bun',
      '/usr/bin/bun',
      path.join(os.homedir(), '.bun', 'bin', 'bun'),
      path.join(process.cwd(), 'bin', 'bun'),
      path.join(process.cwd(), 'data', 'runtimes', 'bun', 'bun'),
    ];

    for (const cand of candidates) {
      if (cand !== 'bun' && !fs.existsSync(cand)) continue;
      try {
        const res = spawnSync(cand, ['--version'], { env, shell: false, encoding: 'utf8' });
        if (res.status === 0 && res.stdout && res.stdout.trim()) {
          const ver = res.stdout.trim();
          return {
            available: true,
            executable: cand,
            version: ver
          };
        }
      } catch {}
    }

    return {
      available: false,
      executable: 'bun',
      version: 'None',
      reason: 'Bun binary not found or not executable on host system.'
    };
  }

  if (runtime === 'nodejs') {
    const candidates = [
      'node',
      '/usr/local/bin/node',
      '/usr/bin/node',
      path.join(process.cwd(), 'bin', 'node'),
    ];

    for (const cand of candidates) {
      if (cand !== 'node' && !fs.existsSync(cand)) continue;
      try {
        const res = spawnSync(cand, ['--version'], { env, shell: false, encoding: 'utf8' });
        if (res.status === 0 && res.stdout && res.stdout.trim()) {
          const ver = res.stdout.trim();
          return {
            available: true,
            executable: cand,
            version: ver
          };
        }
      } catch {}
    }

    return {
      available: false,
      executable: 'node',
      version: 'None',
      reason: 'Node.js binary not found or not executable on host system.'
    };
  }

  // Python
  const pyCandidates: string[] = [];
  if (requestedVersion && /^\d+\.\d+/.test(requestedVersion)) {
    const majMin = requestedVersion.match(/^\d+\.\d+/)?.[0];
    if (majMin) {
      pyCandidates.push(`python${majMin}`, `/usr/bin/python${majMin}`, `/usr/local/bin/python${majMin}`);
    }
  }
  pyCandidates.push('python3', '/usr/bin/python3', '/usr/local/bin/python3', 'python');

  for (const cand of pyCandidates) {
    if (cand.startsWith('/') && !fs.existsSync(cand)) continue;
    try {
      const res = spawnSync(cand, ['--version'], { env, shell: false, encoding: 'utf8' });
      const out = (res.stdout || res.stderr || '').trim();
      if (res.status === 0 && out.toLowerCase().includes('python')) {
        // Check pip availability safely
        const pipRes = spawnSync(cand, ['-m', 'pip', '--version'], { env, shell: false, encoding: 'utf8' });
        const pipAvailable = pipRes.status === 0;

        return {
          available: true,
          executable: cand,
          version: out,
          pipAvailable
        };
      }
    } catch {}
  }

  return {
    available: false,
    executable: 'python3',
    version: 'None',
    pipAvailable: false,
    reason: 'Python 3 binary not found or not executable on host system.'
  };
}

/**
 * Resolves authoritative npm executable info
 */
export function resolveNpmExecutable(): ExecutableInfo {
  const env = getAugmentedEnv();
  const candidates = ['npm', '/usr/local/bin/npm', '/usr/bin/npm', path.join(process.cwd(), 'bin', 'npm')];
  for (const cand of candidates) {
    if (cand !== 'npm' && !fs.existsSync(cand)) continue;
    try {
      const res = spawnSync(cand, ['--version'], { env, shell: false, encoding: 'utf8' });
      if (res.status === 0 && res.stdout && res.stdout.trim()) {
        return {
          available: true,
          executable: cand,
          version: res.stdout.trim()
        };
      }
    } catch {}
  }
  return {
    available: false,
    executable: 'npm',
    version: 'None',
    reason: 'npm binary not found or not executable on host system.'
  };
}

/**
 * Returns npm executable string path for child_process
 */
export function resolveNpmExecutablePath(): string {
  return resolveNpmExecutable().executable;
}

/**
 * Resolves authoritative pip executable info for python
 */
export function resolvePipExecutable(pythonExecutable?: string): ExecutableInfo {
  const env = getAugmentedEnv();
  const pyCand = pythonExecutable || resolveBotRuntimeExecutable('python').executable || 'python3';
  try {
    const res = spawnSync(pyCand, ['-m', 'pip', '--version'], { env, shell: false, encoding: 'utf8' });
    if (res.status === 0 && res.stdout && res.stdout.trim()) {
      return {
        available: true,
        executable: `${pyCand} -m pip`,
        version: res.stdout.trim()
      };
    }
  } catch {}

  return {
    available: false,
    executable: 'pip',
    version: 'None',
    reason: 'pip module unavailable for Python environment.'
  };
}

/**
 * Verifies all 3 runtimes and returns authoritative matrix
 */
export function verifyRuntimeExecutables() {
  const bun = resolveBotRuntimeExecutable('bun');
  const node = resolveBotRuntimeExecutable('nodejs');
  const npm = resolveNpmExecutable();
  const python = resolveBotRuntimeExecutable('python');
  const pip = resolvePipExecutable(python.executable);

  return {
    bun: {
      available: bun.available,
      version: bun.version,
      executable: bun.executable,
      reason: bun.reason
    },
    node: {
      available: node.available,
      version: node.version,
      executable: node.executable,
      reason: node.reason
    },
    npm: {
      available: npm.available,
      version: npm.version,
      executable: npm.executable,
      reason: npm.reason
    },
    python: {
      available: python.available,
      version: python.version,
      executable: python.executable,
      reason: python.reason
    },
    pip: {
      available: pip.available,
      version: pip.version,
      executable: pip.executable,
      reason: pip.reason
    }
  };
}

