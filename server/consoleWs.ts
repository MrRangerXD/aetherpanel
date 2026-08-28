import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse as parseUrl } from 'url';
import { verifyToken } from './auth';
import { getDb } from './db';
import { getInstallationId } from './installation';
import { getServerConsoleLogs, sendServerCommand, onConsoleLog, onServerStatus } from './provider';

interface WsClientInfo {
  ws: WebSocket;
  serverId: string;
  userId: string;
  isAlive: boolean;
  connectedAt: Date;
}

const activeClients: Set<WsClientInfo> = new Set();

export function setupConsoleWebSocket(httpServer: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (req, socket, head) => {
    const parsed = parseUrl(req.url || '', true);
    const pathname = parsed.pathname || '';

    // Match /ws/console/:serverId or /api/v1/servers/:serverId/ws-console
    const match = pathname.match(/^\/(?:api\/v1\/servers|ws\/console)\/([a-zA-Z0-9_-]+)(?:\/ws-console)?/);
    if (!match) {
      return; // Handled by standard express / vite
    }

    const serverId = match[1];
    let token = (parsed.query.token as string) || '';

    if (!token && req.headers['sec-websocket-protocol']) {
      token = req.headers['sec-websocket-protocol'].split(',')[0].trim();
    }

    if (!token && req.headers.cookie) {
      const matchCookie = req.headers.cookie.match(/aether_token=([^;]+)/);
      if (matchCookie) token = decodeURIComponent(matchCookie[1]);
    }

    // Optional cross-installation boundary check
    const clientInstallId = (parsed.query.installationId as string) || (req.headers['x-installation-id'] as string);
    const currentInstallationId = getInstallationId();
    if (clientInstallId && clientInstallId !== currentInstallationId) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const user = await verifyToken(token);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const db = await getDb();
    const server = db.servers.find(s => s.id === serverId);
    if (!server) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const isOwner = server.userId === user.id;
    const isAdmin = ['admin', 'super_admin', 'moderator'].includes(user.role);
    const subuser = db.subusers?.find(s => s.serverId === serverId && s.userId === user.id);
    const isSubuserWithConsoleView = subuser && subuser.permissions.includes('console.view');

    if (!isOwner && !isAdmin && !isSubuserWithConsoleView) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, serverId, user);
    });
  });

  wss.on('connection', async (ws: WebSocket, req, serverId: string, user: any) => {
    const clientInfo: WsClientInfo = {
      ws,
      serverId,
      userId: user.id,
      isAlive: true,
      connectedAt: new Date()
    };
    activeClients.add(clientInfo);

    ws.on('pong', () => {
      clientInfo.isAlive = true;
    });

    // Send connection handshake acknowledgment with server metadata
    try {
      const db = await getDb();
      const server = db.servers.find(s => s.id === serverId);
      const backlog = await getServerConsoleLogs(serverId);
      
      ws.send(JSON.stringify({
        type: 'init',
        serverId,
        status: server?.status || 'stopped',
        serverName: server?.name || 'Server',
        installationId: getInstallationId(),
        logs: backlog,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      console.error('[ConsoleWS] Error fetching initial backlog:', e);
    }

    // Handle incoming client messages (interactive stdin commands, ping, clear)
    ws.on('message', async (data: Buffer | string) => {
      try {
        const text = data.toString();
        let payload: any = null;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { type: 'command', command: text.trim() };
        }

        if (payload.type === 'command' && typeof payload.command === 'string') {
          const cmd = payload.command.trim();
          if (cmd) {
            // Check authorization
            const db = await getDb();
            const server = db.servers.find(s => s.id === serverId);
            const isOwner = server?.userId === user.id;
            const isAdmin = ['admin', 'super_admin', 'moderator'].includes(user.role);
            const subuser = db.subusers?.find(s => s.serverId === serverId && s.userId === user.id);
            const hasConsoleSend = isOwner || isAdmin || (subuser && subuser.permissions.includes('console.send'));

            if (!hasConsoleSend) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'You do not have permission to send console commands.'
              }));
              return;
            }

            const result = await sendServerCommand(serverId, cmd);
            ws.send(JSON.stringify({
              type: 'command_ack',
              command: cmd,
              result,
              timestamp: new Date().toISOString()
            }));
          }
        } else if (payload.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (err: any) {
        ws.send(JSON.stringify({
          type: 'error',
          message: err.message || 'Failed to process command'
        }));
      }
    });

    ws.on('close', () => {
      activeClients.delete(clientInfo);
    });

    ws.on('error', () => {
      activeClients.delete(clientInfo);
    });
  });

  // Keep-alive ping interval to purge stale connections
  const pingInterval = setInterval(() => {
    activeClients.forEach((client) => {
      if (!client.isAlive) {
        client.ws.terminate();
        activeClients.delete(client);
        return;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch {
        activeClients.delete(client);
      }
    });
  }, 25000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  // Subscribe to live log emission from provider.ts
  onConsoleLog((serverId: string, logLine: string) => {
    const payload = JSON.stringify({
      type: 'log',
      serverId,
      line: logLine,
      timestamp: new Date().toISOString()
    });

    activeClients.forEach((client) => {
      if (client.serverId === serverId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch {}
      }
    });
  });

  // Subscribe to live server status updates from provider.ts
  onServerStatus((serverId: string, status: string, details?: any) => {
    const payload = JSON.stringify({
      type: 'status_change',
      serverId,
      status,
      details,
      timestamp: new Date().toISOString()
    });

    activeClients.forEach((client) => {
      if (client.serverId === serverId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch {}
      }
    });
  });

  console.log('[AetherPanel] Console WebSocket engine active.');
  return wss;
}

export function getActiveConsoleConnectionsCount(serverId?: string): number {
  if (!serverId) return activeClients.size;
  let count = 0;
  activeClients.forEach(c => {
    if (c.serverId === serverId && c.ws.readyState === WebSocket.OPEN) count++;
  });
  return count;
}

export function closeServerConsoleClients(serverId: string, reason: string = 'Server deleted'): void {
  activeClients.forEach((client) => {
    if (client.serverId === serverId) {
      try {
        client.ws.send(JSON.stringify({
          type: 'server_deleted',
          message: reason,
          serverId,
          timestamp: new Date().toISOString()
        }));
        client.ws.close(1000, reason);
      } catch {}
      activeClients.delete(client);
    }
  });
}

export function closeUserConsoleClient(serverId: string, userId: string, reason: string = 'Access revoked'): void {
  activeClients.forEach((client) => {
    if (client.serverId === serverId && client.userId === userId) {
      try {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: reason,
          serverId,
          timestamp: new Date().toISOString()
        }));
        client.ws.close(1000, reason);
      } catch {}
      activeClients.delete(client);
    }
  });
}

export { clearConsoleBuffer } from './provider';


