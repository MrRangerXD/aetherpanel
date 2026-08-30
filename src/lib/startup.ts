import { Server } from '../types';

function sanitizeFlags(flags: string | undefined): string {
  if (!flags || typeof flags !== 'string') return '';
  return flags
    .replace(/[;&|`$><\r\n]/g, '')
    .replace(/--max-old-space-size=\d+/gi, '')
    .replace(/--import\b/gi, '')
    .replace(/--require\b/gi, '')
    .replace(/--eval\b/gi, '')
    .replace(/(^|\s)-e\b/gi, ' ')
    .replace(/(^|\s)-p\b/gi, ' ')
    .trim();
}

function cleanEntryPath(filePath: string | undefined, defaultFile: string): string {
  if (!filePath || typeof filePath !== 'string' || !filePath.trim()) return defaultFile;
  const raw = filePath.trim().replace(/^[\/\\]+/, '');
  if (raw.includes('\0') || raw.includes('..') || /^[a-zA-Z]:/.test(raw) || raw.startsWith('/')) {
    return defaultFile;
  }
  return raw;
}

export function buildBotStartupCommand(
  server: Server | Partial<Server>,
  startupConfig: any
): {
  executable: string;
  args: string[];
  compiledCommand: string;
  runtime: 'nodejs' | 'python' | 'bun';
  startupFile: string;
} {
  const swLower = (server.software || '').toLowerCase();
  const runtime: 'nodejs' | 'python' | 'bun' = startupConfig?.botRuntime ||
    (swLower.includes('python') ? 'python' :
     swLower.includes('bun') ? 'bun' : 'nodejs');

  const config = runtime === 'python' ? startupConfig?.pythonConfig :
                 runtime === 'bun' ? startupConfig?.bunConfig :
                 startupConfig?.nodeConfig;

  const defaultFile = runtime === 'python' ? 'main.py' : runtime === 'bun' ? 'index.ts' : 'index.js';
  const rawEntry = config?.startupFile || startupConfig?.entryFile || defaultFile;
  const startupFile = cleanEntryPath(rawEntry, defaultFile);

  const args: string[] = [];
  let executable = 'node';

  // Strict server allocation memory limit
  const allocatedRamMB = server.limits?.ramMB || 512;

  if (runtime === 'python') {
    // Controlled Python binary: python3 or python3.x (User cannot inject 'bash' or 'curl')
    const pyVer = config?.version || server.version || startupConfig?.version;
    if (pyVer && /^\d+\.\d+/.test(pyVer)) {
      const majMin = pyVer.match(/^\d+\.\d+/)?.[0];
      executable = `python${majMin}`;
    } else {
      executable = 'python3';
    }
    args.push('-u');
  } else if (runtime === 'bun') {
    executable = 'bun';
    args.push('run');
  } else {
    // Node.js: Memory flag strictly matches server RAM allocation
    executable = 'node';
    args.push(`--max-old-space-size=${allocatedRamMB}`);

    if (startupConfig?.nodeOptions) {
      const cleanOpts = sanitizeFlags(startupConfig.nodeOptions);
      if (cleanOpts) {
        args.push(...cleanOpts.split(/\s+/).filter(Boolean));
      }
    }
  }

  const customArgs = config?.startupArguments || startupConfig?.customFlags || '';
  if (customArgs) {
    const cleanArgs = sanitizeFlags(customArgs);
    if (cleanArgs) {
      args.push(...cleanArgs.split(/\s+/).filter(Boolean));
    }
  }

  args.push(startupFile);
  const compiledCommand = `${executable} ${args.join(' ')}`;
  return { executable, args, compiledCommand, runtime, startupFile };
}
