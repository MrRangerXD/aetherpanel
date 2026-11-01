import http from 'http';
import https from 'https';
import { Node } from '../../src/types';

export interface WingsSystemInfo {
  version?: string;
  dockerVersion?: string;
  kernel?: string;
  os?: string;
  architecture?: string;
  cpuCount?: number;
  totalMemoryBytes?: number;
}

export interface WingsServerStats {
  memoryBytes: number;
  cpuPercent: number;
  diskBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  uptimeSeconds: number;
  status: 'running' | 'starting' | 'stopping' | 'offline';
}

function getNodeBaseUrl(node: Node): string {
  if (node.apiUrl && node.apiUrl.trim()) {
    return node.apiUrl.replace(/\/+$/, '');
  }
  const scheme = node.ssl ? 'https' : 'http';
  const port = node.apiPort || (node.ssl ? 8443 : 8080);
  return `${scheme}://${node.hostname}:${port}`;
}

async function wingsRequest<T = any>(
  node: Node,
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    timeoutMs?: number;
    rawToken?: string;
  } = {}
): Promise<{ success: boolean; status: number; data?: T; error?: string }> {
  const baseUrl = getNodeBaseUrl(node);
  const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const method = options.method || 'GET';
  const timeoutMs = options.timeoutMs || 8000;
  const token = options.rawToken || node.token || '';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'AetherPanel-WingsClient/2.6.0'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timer);

    let parsedData: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      parsedData = await response.json();
    } else {
      const text = await response.text();
      try {
        parsedData = JSON.parse(text);
      } catch {
        parsedData = text;
      }
    }

    if (!response.ok) {
      const errMsg = (parsedData && parsedData.error) || (parsedData && parsedData.message) || `HTTP error ${response.status}`;
      return { success: false, status: response.status, error: String(errMsg), data: parsedData };
    }

    return { success: true, status: response.status, data: parsedData };
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    return {
      success: false,
      status: isTimeout ? 408 : 503,
      error: isTimeout ? `Wings connection timed out after ${timeoutMs}ms` : `Failed to communicate with Wings daemon: ${err.message}`
    };
  }
}

export class WingsClient {
  /**
   * Ping / Health check the remote wings daemon
   */
  static async health(node: Node, rawToken?: string): Promise<{
    alive: boolean;
    status: 'online' | 'offline' | 'unauthorized';
    latencyMs: number;
    system?: WingsSystemInfo;
    error?: string;
  }> {
    const start = Date.now();
    const res = await wingsRequest(node, '/api/system', { method: 'GET', timeoutMs: 5000, rawToken });
    const latencyMs = Date.now() - start;

    if (res.status === 401 || res.status === 403) {
      return {
        alive: false,
        status: 'unauthorized',
        latencyMs,
        error: 'Authentication failed: Invalid Wings daemon token'
      };
    }

    if (!res.success) {
      return {
        alive: false,
        status: 'offline',
        latencyMs,
        error: res.error || 'Connection refused or node daemon unreachable'
      };
    }

    return {
      alive: true,
      status: 'online',
      latencyMs,
      system: res.data
    };
  }

  /**
   * Create server instance on Wings daemon
   */
  static async createServer(node: Node, serverPayload: any, rawToken?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const res = await wingsRequest(node, '/api/servers', {
      method: 'POST',
      body: serverPayload,
      rawToken
    });
    return { success: res.success, data: res.data, error: res.error };
  }

  /**
   * Delete server container & filesystem from Wings daemon
   */
  static async deleteServer(node: Node, serverUuid: string, rawToken?: string): Promise<{ success: boolean; error?: string }> {
    const res = await wingsRequest(node, `/api/servers/${encodeURIComponent(serverUuid)}`, {
      method: 'DELETE',
      rawToken
    });
    return { success: res.success, error: res.error };
  }

  /**
   * Execute server power action (start, stop, restart, kill)
   */
  static async power(node: Node, serverUuid: string, action: 'start' | 'stop' | 'restart' | 'kill', rawToken?: string): Promise<{ success: boolean; error?: string }> {
    const res = await wingsRequest(node, `/api/servers/${encodeURIComponent(serverUuid)}/power`, {
      method: 'POST',
      body: { action },
      rawToken
    });
    return { success: res.success, error: res.error };
  }

  /**
   * Send console command to Wings server stdin
   */
  static async command(node: Node, serverUuid: string, commandText: string, rawToken?: string): Promise<{ success: boolean; error?: string }> {
    const res = await wingsRequest(node, `/api/servers/${encodeURIComponent(serverUuid)}/commands`, {
      method: 'POST',
      body: { command: commandText },
      rawToken
    });
    return { success: res.success, error: res.error };
  }

  /**
   * Query server live resource utilization stats
   */
  static async stats(node: Node, serverUuid: string, rawToken?: string): Promise<{ success: boolean; stats?: WingsServerStats; error?: string }> {
    const res = await wingsRequest<WingsServerStats>(node, `/api/servers/${encodeURIComponent(serverUuid)}`, {
      method: 'GET',
      rawToken
    });
    return { success: res.success, stats: res.data, error: res.error };
  }
}
