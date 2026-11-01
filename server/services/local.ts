import os from 'os';
import { Node } from '../../src/types';
import { getDb } from '../db';
import {
  startServer,
  stopServer,
  restartServer,
  killServer,
  sendServerCommand
} from '../provider';

export class LocalProvider {
  /**
   * Health status of local node (hardware telemetry & process runtime)
   */
  static async health(node?: Node): Promise<{
    alive: boolean;
    status: 'online';
    latencyMs: number;
    system: {
      hostname: string;
      platform: string;
      arch: string;
      cpuCount: number;
      totalMemoryMB: number;
      freeMemoryMB: number;
      usedMemoryMB: number;
      uptimeSeconds: number;
      loadAverage: number[];
    };
  }> {
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const totalMemMB = Math.round(totalMemBytes / (1024 * 1024));
    const freeMemMB = Math.round(freeMemBytes / (1024 * 1024));
    const usedMemMB = totalMemMB - freeMemMB;

    return {
      alive: true,
      status: 'online',
      latencyMs: 1,
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus()?.length || 4,
        totalMemoryMB: totalMemMB,
        freeMemoryMB: freeMemMB,
        usedMemoryMB: usedMemMB,
        uptimeSeconds: Math.round(os.uptime()),
        loadAverage: os.loadavg()
      }
    };
  }

  /**
   * Power action routed to local in-process provider
   */
  static async power(
    node: Node,
    serverId: string,
    action: 'start' | 'stop' | 'restart' | 'kill'
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      let ok = false;
      if (action === 'start') {
        ok = await startServer(serverId);
      } else if (action === 'stop') {
        ok = await stopServer(serverId);
      } else if (action === 'restart') {
        ok = await restartServer(serverId);
      } else if (action === 'kill') {
        ok = await killServer(serverId);
      }
      const db = await getDb();
      const server = db.servers.find(s => s.id === serverId);
      return { success: ok, status: server?.status || 'stopped' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Console command routed to local in-process provider
   */
  static async command(
    node: Node,
    serverId: string,
    commandText: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const ok = await sendServerCommand(serverId, commandText);
      return { success: Boolean(ok) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Query metrics from local in-process provider
   */
  static async stats(
    node: Node,
    serverId: string
  ): Promise<{ success: boolean; stats?: any; error?: string }> {
    try {
      const db = await getDb();
      const server = db.servers.find(s => s.id === serverId);
      return {
        success: true,
        stats: {
          memoryBytes: Math.round(((server as any)?.ramUsageMB || 0) * 1024 * 1024),
          cpuPercent: (server as any)?.cpuUsage || 0,
          diskBytes: Math.round(((server as any)?.diskUsageGB || 0) * 1024 * 1024 * 1024),
          uptimeSeconds: server?.uptimeSeconds || 0,
          status: server?.status || 'stopped'
        }
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
