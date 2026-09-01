import fs from 'fs';
import path from 'path';
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

function cleanEntryPath(filePath: string | undefined): string | null {
  if (!filePath || typeof filePath !== 'string' || !filePath.trim()) return null;
  const raw = filePath.trim().replace(/^[\/\\]+/, '');
  if (raw.includes('\0') || raw.includes('..') || /^[a-zA-Z]:/.test(raw) || raw.startsWith('/')) {
    return null;
  }
  return raw;
}

export function buildBotStartupCommand(
  server: Server | Partial<Server>,
  startupConfig: any,
  serverDir?: string
): {
  executable: string;
  args: string[];
  compiledCommand: string;
  runtime: 'nodejs' | 'python' | 'bun';
  startupFile: string;
  hasEntryFile: boolean;
  missingReason?: string;
} {
  const swLower = (server.software || '').toLowerCase();
  const runtime: 'nodejs' | 'python' | 'bun' = startupConfig?.botRuntime ||
    (swLower.includes('python') ? 'python' :
     swLower.includes('bun') ? 'bun' : 'nodejs');

  const config = runtime === 'python' ? startupConfig?.pythonConfig :
                 runtime === 'bun' ? startupConfig?.bunConfig :
                 startupConfig?.nodeConfig;

  // Check if custom full startup command or custom startup file was configured by user
  const customCmdRaw = config?.startupCommand || startupConfig?.customCommand || startupConfig?.command;
  const customFileRaw = config?.startupFile || startupConfig?.entryFile;
  const customFileClean = cleanEntryPath(customFileRaw);

  let executable = runtime === 'python' ? 'python3' : runtime === 'bun' ? 'bun' : 'node';
  let args: string[] = [];
  let startupFile = customFileClean || (runtime === 'python' ? 'main.py' : runtime === 'bun' ? 'index.ts' : 'index.js');
  let hasEntryFile = true;
  let missingReason: string | undefined = undefined;

  // PRIORITY 1: Explicit custom command from user
  if (customCmdRaw && typeof customCmdRaw === 'string' && customCmdRaw.trim()) {
    const rawParts = customCmdRaw.trim().split(/\s+/).filter(Boolean);
    const firstWord = rawParts[0].toLowerCase();

    if (firstWord === 'bun') {
      executable = 'bun';
      // Prevent double prefixing if user wrote "bun run start" or "bun index.ts"
      args = rawParts.slice(1);
    } else if (firstWord === 'node') {
      executable = 'node';
      args = rawParts.slice(1);
    } else if (firstWord === 'npm') {
      executable = 'npm';
      args = rawParts.slice(1);
    } else if (firstWord === 'python' || firstWord === 'python3') {
      executable = 'python3';
      args = rawParts.slice(1);
    } else {
      if (runtime === 'bun') {
        executable = 'bun';
        args = ['run', ...rawParts];
      } else if (runtime === 'nodejs') {
        executable = 'node';
        args = [...rawParts];
      } else {
        executable = 'python3';
        args = ['-u', ...rawParts];
      }
    }

    const lastArg = args[args.length - 1];
    if (lastArg && !lastArg.startsWith('-')) {
      startupFile = lastArg;
    }

    const compiledCommand = `${executable} ${args.join(' ')}`;
    return { executable, args, compiledCommand, runtime, startupFile, hasEntryFile: true };
  }

  // PRIORITY 2: If package.json exists and has scripts.start or main/module (for Bun / Node)
  if (serverDir && (runtime === 'bun' || runtime === 'nodejs')) {
    const pkgPath = path.join(serverDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts && pkg.scripts.start) {
          if (runtime === 'bun') {
            executable = 'bun';
            args = ['run', 'start'];
          } else {
            executable = 'npm';
            args = ['start'];
          }
          startupFile = 'package.json (start script)';
          const compiledCommand = `${executable} ${args.join(' ')}`;
          return { executable, args, compiledCommand, runtime, startupFile, hasEntryFile: true };
        }
        const pkgEntry = pkg.main || pkg.module;
        if (pkgEntry && typeof pkgEntry === 'string') {
          const cleanPkgEntry = cleanEntryPath(pkgEntry);
          if (cleanPkgEntry && fs.existsSync(path.join(serverDir, cleanPkgEntry))) {
            startupFile = cleanPkgEntry;
          }
        }
      } catch {}
    }
  }

  // PRIORITY 3: Fallback entry files - only if valid file actually exists or default
  const candidateFiles = runtime === 'python'
    ? ['main.py', 'bot.py', 'app.py', 'src/main.py', 'src/bot.py']
    : runtime === 'bun'
    ? ['index.ts', 'index.js', 'main.ts', 'main.js', 'src/index.ts', 'src/index.js', 'bot.ts', 'bot.js', 'src/bot.ts']
    : ['index.js', 'main.js', 'src/index.js', 'app.js', 'bot.js', 'src/bot.js', 'index.ts', 'src/index.ts'];

  if (customFileClean) {
    startupFile = customFileClean;
  } else if (serverDir) {
    let found: string | null = null;
    for (const cand of candidateFiles) {
      if (fs.existsSync(path.join(serverDir, cand))) {
        found = cand;
        break;
      }
    }
    if (found) {
      startupFile = found;
    } else {
      hasEntryFile = false;
      missingReason = `No valid startup entry file found for ${runtime}. Expected one of: ${candidateFiles.join(', ')}`;
    }
  }

  // Build default arguments for runtime
  const allocatedRamMB = server.limits?.ramMB || 512;
  if (runtime === 'python') {
    executable = 'python3';
    args = ['-u'];
  } else if (runtime === 'bun') {
    executable = 'bun';
    args = ['run'];
  } else {
    executable = 'node';
    args = [`--max-old-space-size=${allocatedRamMB}`];
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
  return { executable, args, compiledCommand, runtime, startupFile, hasEntryFile, missingReason };
}

