import { Router, Request, Response } from 'express';
import { verifyRuntimeExecutables } from '../utils/runtimeResolver';

const router = Router();

const RUNTIMES_DATA = {
  nodejs: {
    name: 'Node.js',
    category: 'bot',
    description: 'Modern JavaScript/TypeScript runtime with ES modules & npm/pnpm support.',
    defaultVersion: 'Node 22 (LTS)',
    versions: ['Node 22 (LTS)', 'Node 20 (LTS)', 'Node 23 (Current)', 'Node 18 (LTS)', 'Node 16 (Legacy)']
  },
  python: {
    name: 'Python',
    category: 'bot',
    description: 'High-performance Python runtime for Discord.py, Pycord, and automation scripts.',
    defaultVersion: 'Python 3.12 (Latest)',
    versions: ['Python 3.12 (Latest)', 'Python 3.13 (Preview)', 'Python 3.11 (Stable)', 'Python 3.10', 'Python 3.9']
  },
  bun: {
    name: 'Bun',
    category: 'bot',
    description: 'Ultra-fast all-in-one JavaScript runtime & package manager.',
    defaultVersion: 'Bun 1.2 (Latest)',
    versions: ['Bun 1.2 (Latest)', 'Bun 1.1', 'Bun 1.0']
  }
};

export function normalizeRuntimeVersion(software: string, version: string): string {
  if (!version) {
    if (/python/i.test(software)) return 'Python 3.12 (Latest)';
    if (/bun/i.test(software)) return 'Bun 1.2 (Latest)';
    return 'Node 22 (LTS)';
  }
  const clean = version.trim();
  if (/latest/i.test(clean)) return 'Latest Stable';

  return clean;
}

export function isValidRuntimeVersion(software: string, version: string): boolean {
  if (!version) return true;
  const sw = software.toLowerCase();
  let key = 'nodejs';
  if (/python/i.test(sw)) key = 'python';
  else if (/bun/i.test(sw)) key = 'bun';
  
  const runtime = (RUNTIMES_DATA as any)[key];
  if (!runtime) return true;
  const clean = version.trim().toLowerCase();
  return runtime.versions.some((v: string) => v.toLowerCase() === clean || v.toLowerCase().includes(clean) || clean.includes(v.toLowerCase())) || clean.includes('latest') || /^(node|python|bun|\d)/i.test(clean);
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
