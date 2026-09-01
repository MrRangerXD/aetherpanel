import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { getDb, saveDbSync, getDbSync } from '../db';
import { appendConsoleLog, emitServerStatus } from '../provider';

export interface SupervisorProcess {
  pid: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  startedAt: string;
}

export interface RuntimeState {
  pid?: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  startedAt?: string;
  executable?: string;
  args?: string[];
  cwd?: string;
}

class FileTailer {
  private serverId: string;
  private filePath: string;
  private fd: number | null = null;
  private position: number = 0;
  private watcher: fs.FSWatcher | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(serverId: string, filePath: string) {
    this.serverId = serverId;
    this.filePath = filePath;
  }

  start() {
    try {
      if (!fs.existsSync(this.filePath)) {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        fs.writeFileSync(this.filePath, '');
      }
      this.position = fs.statSync(this.filePath).size;
      this.fd = fs.openSync(this.filePath, 'r');

      this.watcher = fs.watch(this.filePath, (event) => {
        if (event === 'change') {
          this.readNewData();
        }
      });

      this.intervalId = setInterval(() => {
        this.readNewData();
      }, 500);
    } catch (err) {
      console.error(`[FileTailer] Error starting for ${this.filePath}:`, err);
    }
  }

  private readNewData() {
    if (this.fd === null) return;
    try {
      const stats = fs.statSync(this.filePath);
      if (stats.size < this.position) {
        this.position = 0;
      }
      if (stats.size === this.position) return;

      const bytesToRead = stats.size - this.position;
      const buffer = Buffer.alloc(bytesToRead);
      fs.readSync(this.fd, buffer, 0, bytesToRead, this.position);
      this.position = stats.size;

      const text = buffer.toString('utf8');
      appendConsoleLog(this.serverId, text);
    } catch (err) {
      // Stream or descriptor closed
    }
  }

  stop() {
    if (this.watcher) {
      try { this.watcher.close(); } catch {}
      this.watcher = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {}
      this.fd = null;
    }
  }
}

export class RuntimeSupervisor {
  private static activeTailers = new Map<string, { stdout: FileTailer; stderr: FileTailer }>();

  private static getRuntimePaths(serverId: string) {
    const serverDir = path.join(process.cwd(), 'data', 'servers', serverId);
    return {
      serverDir,
      runtimeDir: path.join(serverDir, 'runtime'),
      logsDir: path.join(serverDir, 'runtime', 'logs'),
      stateDir: path.join(serverDir, 'runtime', 'state'),
      stdoutLog: path.join(serverDir, 'runtime', 'logs', 'stdout.log'),
      stderrLog: path.join(serverDir, 'runtime', 'logs', 'stderr.log'),
      stateJson: path.join(serverDir, 'runtime', 'state', 'runtime.json'),
    };
  }

  static async spawn(
    serverId: string,
    executable: string,
    args: string[],
    options: SpawnOptions & { runnerType: string }
  ): Promise<SupervisorProcess> {
    const paths = this.getRuntimePaths(serverId);

    // Ensure directories exist
    fs.mkdirSync(paths.logsDir, { recursive: true });
    fs.mkdirSync(paths.stateDir, { recursive: true });

    // Rotate or clear previous logs to keep file sizes clean
    try {
      if (fs.existsSync(paths.stdoutLog)) fs.unlinkSync(paths.stdoutLog);
      if (fs.existsSync(paths.stderrLog)) fs.unlinkSync(paths.stderrLog);
    } catch {}

    // Open persistent stream logs
    const stdoutFd = fs.openSync(paths.stdoutLog, 'a');
    const stderrFd = fs.openSync(paths.stderrLog, 'a');

    const cleanEnv = { ...process.env, ...(options.env || {}) };

    console.log(`[RuntimeSupervisor] Spawning detached workload for ${serverId}: ${executable} ${args.join(' ')}`);

    const child = spawn(executable, args, {
      cwd: options.cwd || paths.serverDir,
      env: cleanEnv,
      stdio: ['pipe', stdoutFd, stderrFd],
      detached: true,
      shell: false,
    });

    if (!child.pid) {
      fs.closeSync(stdoutFd);
      fs.closeSync(stderrFd);
      throw new Error(`Failed to spawn process for ${serverId}: PID is missing.`);
    }

    // Attach exit handler BEFORE unref to track lifecycle cleanly
    child.on('exit', (code, signal) => {
      console.log(`[RuntimeSupervisor] Process PID ${child.pid} for ${serverId} exited with code ${code}, signal ${signal}`);
      try {
        const statePath = paths.stateJson;
        if (fs.existsSync(statePath)) {
          const stateData: RuntimeState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
          stateData.status = 'stopped';
          stateData.pid = undefined;
          fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2), 'utf-8');
        }
      } catch {}

      try {
        const db = getDbSync();
        const server = db.servers.find(s => s.id === serverId);
        if (server && (server.status === 'running' || server.status === 'starting')) {
          server.status = code === 0 ? 'stopped' : 'error';
          server.cpuUsage = 0;
          server.ramUsageMB = 0;
          if (code !== 0 && code !== null) {
            if (!server.startup) server.startup = {};
            server.startup.lastCrashReason = `Process exited with exit code ${code}`;
            appendConsoleLog(serverId, `[AetherDaemon/ERROR]: Process PID ${child.pid} exited with code ${code}.`);
          } else if (signal) {
            appendConsoleLog(serverId, `[AetherDaemon/INFO]: Process PID ${child.pid} terminated by signal ${signal}.`);
          }
          saveDbSync();
          emitServerStatus(serverId, server.status);
        }
      } catch {}

      this.stopTailers(serverId);
    });

    // Unreference from parent event loop to decouple lifetime
    child.unref();

    const processInfo: SupervisorProcess = {
      pid: child.pid,
      status: 'starting',
      startedAt: new Date().toISOString(),
    };

    const state: RuntimeState = {
      pid: child.pid,
      status: 'starting',
      startedAt: processInfo.startedAt,
      executable,
      args,
      cwd: (typeof options.cwd === 'string' ? options.cwd : undefined) || paths.serverDir,
    };

    fs.writeFileSync(paths.stateJson, JSON.stringify(state, null, 2), 'utf-8');

    // Close fds locally; the child process owns them now on the kernel level
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);

    // Set up file tailers to stream live logs to the panel's in-memory buffers
    this.startTailers(serverId, paths.stdoutLog, paths.stderrLog);

    return processInfo;
  }

  static startTailers(serverId: string, stdoutLog: string, stderrLog: string) {
    this.stopTailers(serverId);

    const stdoutTailer = new FileTailer(serverId, stdoutLog);
    const stderrTailer = new FileTailer(serverId, stderrLog);

    stdoutTailer.start();
    stderrTailer.start();

    this.activeTailers.set(serverId, { stdout: stdoutTailer, stderr: stderrTailer });
  }

  static stopTailers(serverId: string) {
    const tailers = this.activeTailers.get(serverId);
    if (tailers) {
      tailers.stdout.stop();
      tailers.stderr.stop();
      this.activeTailers.delete(serverId);
    }
  }

  static async reconcile(): Promise<void> {
    console.log('[RuntimeSupervisor] Scanning host system to discover surviving workloads...');
    try {
      const db = await getDb();
      let modified = false;

      for (const server of db.servers) {
        const node = db.nodes.find(n => n.id === server.nodeId);
        const isLocal = !node || node.isLocalNode || node.id === 'node_local';
        if (!isLocal) continue;

        const paths = this.getRuntimePaths(server.id);
        if (!fs.existsSync(paths.stateJson)) {
          // If running, but no state file exists, mark it as stopped safely
          if (server.status === 'running' || server.status === 'starting') {
            server.status = 'stopped';
            server.cpuUsage = 0;
            server.ramUsageMB = 0;
            if (server.startup) server.startup.pid = undefined;
            modified = true;
          }
          continue;
        }

        try {
          const stateData: RuntimeState = JSON.parse(fs.readFileSync(paths.stateJson, 'utf-8'));
          if (stateData.pid) {
            let isAlive = false;
            try {
              process.kill(stateData.pid, 0);
              isAlive = true;
            } catch {
              isAlive = false;
            }

            if (isAlive) {
              console.log(`[RuntimeSupervisor] Recovered running workload for server '${server.name}' (${server.id}), PID: ${stateData.pid}`);
              
              // Ensure server state matches running
              if (server.status !== 'running' && server.status !== 'starting') {
                server.status = 'running';
                if (!server.startup) server.startup = {};
                server.startup.pid = stateData.pid;
                modified = true;
              }

              // Re-attach log streaming
              this.startTailers(server.id, paths.stdoutLog, paths.stderrLog);
            } else {
              console.log(`[RuntimeSupervisor] Cleaned stale or crashed process state for server '${server.name}' (${server.id})`);
              
              if (server.status !== 'stopped' && server.status !== 'error') {
                server.status = 'stopped';
                server.cpuUsage = 0;
                server.ramUsageMB = 0;
                if (server.startup) server.startup.pid = undefined;
                modified = true;
              }

              stateData.status = 'stopped';
              stateData.pid = undefined;
              fs.writeFileSync(paths.stateJson, JSON.stringify(stateData, null, 2), 'utf-8');
              this.stopTailers(server.id);
            }
          }
        } catch (err) {
          console.error(`[RuntimeSupervisor] Failed to parse state JSON for ${server.id}:`, err);
        }
      }

      if (modified) {
        saveDbSync();
      }
    } catch (err) {
      console.error('[RuntimeSupervisor] Reconciliation error:', err);
    }
  }

  static async stop(serverId: string): Promise<boolean> {
    const paths = this.getRuntimePaths(serverId);
    this.stopTailers(serverId);

    if (!fs.existsSync(paths.stateJson)) return false;

    try {
      const stateData: RuntimeState = JSON.parse(fs.readFileSync(paths.stateJson, 'utf-8'));
      if (stateData.pid) {
        console.log(`[RuntimeSupervisor] Stopping workload for ${serverId}, PID: ${stateData.pid}`);
        
        try {
          // Graceful SIGTERM
          process.kill(stateData.pid, 15);
          
          // Wait up to 3 seconds for graceful shutdown
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 500));
            try {
              process.kill(stateData.pid, 0);
            } catch {
              // Stopped
              break;
            }
          }

          // Force SIGKILL if still alive
          try {
            process.kill(stateData.pid, 0);
            console.warn(`[RuntimeSupervisor] Force-killing unresponsive process PID ${stateData.pid}`);
            process.kill(stateData.pid, 9);
          } catch {}

        } catch {}

        stateData.status = 'stopped';
        stateData.pid = undefined;
        fs.writeFileSync(paths.stateJson, JSON.stringify(stateData, null, 2), 'utf-8');
        return true;
      }
    } catch (err) {
      console.error(`[RuntimeSupervisor] Error stopping workload ${serverId}:`, err);
    }
    return false;
  }

  static getStatus(serverId: string): 'starting' | 'running' | 'stopped' | 'error' {
    const paths = this.getRuntimePaths(serverId);
    if (!fs.existsSync(paths.stateJson)) return 'stopped';
    try {
      const stateData: RuntimeState = JSON.parse(fs.readFileSync(paths.stateJson, 'utf-8'));
      if (stateData.pid) {
        try {
          process.kill(stateData.pid, 0);
          return stateData.status;
        } catch {
          return 'stopped';
        }
      }
    } catch {}
    return 'stopped';
  }

  static getLogs(serverId: string, limit = 500): string[] {
    const paths = this.getRuntimePaths(serverId);
    const logs: string[] = [];

    if (fs.existsSync(paths.stdoutLog)) {
      try {
        const content = fs.readFileSync(paths.stdoutLog, 'utf-8');
        const lines = content.split('\n');
        logs.push(...lines.slice(-limit));
      } catch {}
    }

    if (fs.existsSync(paths.stderrLog)) {
      try {
        const content = fs.readFileSync(paths.stderrLog, 'utf-8');
        const lines = content.split('\n');
        logs.push(...lines.slice(-limit).map(line => `[STDERR] ${line}`));
      } catch {}
    }

    return logs;
  }

  static clean(serverId: string) {
    const paths = this.getRuntimePaths(serverId);
    this.stopTailers(serverId);
    try {
      if (fs.existsSync(paths.runtimeDir)) {
        fs.rmSync(paths.runtimeDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`[RuntimeSupervisor] Failed to clean runtime directories for ${serverId}:`, err);
    }
  }
}
