import { Server } from '../types';

export function buildBotStartupCommand(server: Server | Partial<Server>, startupConfig: any): { executable: string; args: string[]; compiledCommand: string; runtime: 'nodejs' | 'python' | 'bun'; startupFile: string } {
  const runtime: 'nodejs' | 'python' | 'bun' = startupConfig?.botRuntime ||
    (server.software?.toLowerCase().includes('python') ? 'python' :
     server.software?.toLowerCase().includes('bun') ? 'bun' : 'nodejs');

  const config = runtime === 'python' ? startupConfig?.pythonConfig :
                 runtime === 'bun' ? startupConfig?.bunConfig :
                 startupConfig?.nodeConfig;

  const defaultFile = runtime === 'python' ? 'bot.py' : runtime === 'bun' ? 'index.ts' : 'index.js';
  const startupFile = config?.startupFile || startupConfig?.entryFile || defaultFile;

  const args: string[] = [];
  let executable = 'node';

  if (runtime === 'python') {
    executable = config?.version ? `python${config.version}` : (startupConfig?.pythonExecutable || 'python3');
    args.push('-u');
  } else if (runtime === 'bun') {
    executable = 'bun';
    args.push('run');
  } else {
    executable = 'node';
    const mem = config?.memoryLimitMB || server.limits?.ramMB || 4096;
    args.push(`--max-old-space-size=${mem}`);
    if (startupConfig?.nodeOptions) {
      const extraOpts = startupConfig.nodeOptions.split(/\s+/).filter(Boolean);
      args.push(...extraOpts);
    }
  }

  const customArgs = config?.startupArguments || startupConfig?.customFlags || '';
  if (customArgs) {
    const tokens = customArgs.split(/\s+/).filter(Boolean);
    args.push(...tokens);
  }

  args.push(startupFile);
  const compiledCommand = `${executable} ${args.join(' ')}`;
  return { executable, args, compiledCommand, runtime, startupFile };
}