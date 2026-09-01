import { Router, Request, Response } from 'express';
import { verifyRuntimeExecutables } from '../utils/runtimeResolver';

const router = Router();

const RUNTIMES_DATA = {
  nodejs: {
    name: 'Node.js',
    category: 'bot',
    description: 'Modern JavaScript/TypeScript runtime with ES modules & npm/pnpm support.',
    defaultVersion: '20.x',
    versions: ['24.x', '22.x', '20.x', '18.x', 'Latest Stable']
  },
  python: {
    name: 'Python',
    category: 'bot',
    description: 'High-performance Python runtime for Discord.py, Pycord, and automation scripts.',
    defaultVersion: '3.11.x',
    versions: ['3.14.x', '3.13.x', '3.12.x', '3.11.x', '3.10.x', 'Latest Stable']
  },
  bun: {
    name: 'Bun',
    category: 'bot',
    description: 'Ultra-fast all-in-one JavaScript runtime & package manager.',
    defaultVersion: '1.1.x',
    versions: ['1.2.x', '1.1.x', '1.0.x', 'Latest Stable']
  }
};

export function normalizeRuntimeVersion(software: string, version: string): string {
  if (!version) {
    if (/python/i.test(software)) return '3.11.x';
    if (/bun/i.test(software)) return '1.1.x';
    return '20.x';
  }
  const clean = version.trim();
  if (/latest/i.test(clean)) return 'Latest Stable';

  const sw = software.toLowerCase();
  if (/python/i.test(sw)) {
    const match = clean.match(/3\.(\d+)/);
    if (match) return `3.${match[1]}.x`;
  } else if (/bun/i.test(sw)) {
    const match = clean.match(/1\.(\d+)/);
    if (match) return `1.${match[1]}.x`;
  } else {
    const match = clean.match(/(18|20|22|24)/);
    if (match) return `${match[1]}.x`;
  }
  return clean;
}

export function isValidRuntimeVersion(software: string, version: string): boolean {
  const sw = software.toLowerCase();
  let key = 'nodejs';
  if (/python/i.test(sw)) key = 'python';
  else if (/bun/i.test(sw)) key = 'bun';
  
  const runtime = (RUNTIMES_DATA as any)[key];
  if (!runtime) return false;
  const normalized = normalizeRuntimeVersion(software, version);
  return runtime.versions.some((v: string) => v.toLowerCase() === normalized.toLowerCase()) || normalized === 'Latest Stable';
}

// GET /api/v1/runtimes
router.get('/', (req: Request, res: Response) => {
  const verified = verifyRuntimeExecutables();
  
  res.json({
    success: true,
    data: {
      bun: {
        ...RUNTIMES_DATA.bun,
        available: verified.bun.available,
        installed: verified.bun.available,
        version: verified.bun.version,
        executable: verified.bun.executable,
        reason: verified.bun.reason
      },
      node: {
        ...RUNTIMES_DATA.nodejs,
        available: verified.node.available,
        installed: verified.node.available,
        version: verified.node.version,
        executable: verified.node.executable,
        reason: verified.node.reason
      },
      npm: {
        available: verified.npm.available,
        version: verified.npm.version,
        executable: verified.npm.executable,
        reason: verified.npm.reason
      },
      python: {
        ...RUNTIMES_DATA.python,
        available: verified.python.available,
        installed: verified.python.available,
        version: verified.python.version,
        executable: verified.python.executable,
        reason: verified.python.reason
      },
      pip: {
        available: verified.pip.available,
        version: verified.pip.version,
        executable: verified.pip.executable,
        reason: verified.pip.reason
      }
    }
  });
});

// GET /api/v1/runtimes/:runtime/versions
router.get('/:runtime/versions', (req: Request, res: Response) => {
  const runtimeKey = req.params.runtime.toLowerCase();
  const runtime = (RUNTIMES_DATA as any)[runtimeKey];
  if (!runtime) {
    return res.status(404).json({
      success: false,
      error: { code: 'RUNTIME_NOT_FOUND', message: `Runtime '${req.params.runtime}' not supported.` }
    });
  }
  res.json({
    success: true,
    data: {
      runtime: runtimeKey,
      name: runtime.name,
      defaultVersion: runtime.defaultVersion,
      versions: runtime.versions
    }
  });
});

export default router;
