import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse as parseUrl } from 'url';
import { verifyToken } from './auth';
import { getDb } from './db';
import { getServerConsoleLogs, sendServerCommand, onConsoleLog } from './provider';

interface WsClientInfo {
  ws: WebSocket;
  serverId: string;
  userId: string;
  isAlive: boolean;
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
    if (!isOwner && !isAdmin) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, serverId, user.id);
    });
  });

  wss.on('connection', async (ws: WebSocket, req, serverId: string, userId: string) => {
    const clientInfo: WsClientInfo = {
      ws,
      serverId,
      userId,
      isAlive: true
    };
    activeClients.add(clientInfo);

    ws.on('pong', () => {
      clientInfo.isAlive = true;
    });

    // Send initial greeting and backlog
    try {
      const backlog = await getServerConsoleLogs(serverId);
      ws.send(JSON.stringify({
        type: 'backlog',
        serverId,
        logs: backlog
      }));
    } catch (e) {
      console.error('[ConsoleWS] Error fetching backlog:', e);
    }

    // Handle incoming client command messages
    ws.on('message', async (data: Buffer | string) => {
      try {
        const text = data.toString();
        const payload = JSON.parse(text);

        if (payload.type === 'command' && typeof payload.command === 'string') {
          const result = await sendServerCommand(serverId, payload.command);
          ws.send(JSON.stringify({
            type: 'command_ack',
            command: payload.command,
            result
          }));
        } else if (payload.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err: any) {
        // Plain text command fallback
        const cmd = data.toString().trim();
        if (cmd) {
          const result = await sendServerCommand(serverId, cmd);
          ws.send(JSON.stringify({
            type: 'command_ack',
            command: cmd,
            result
          }));
        }
      }
    });

    ws.on('close', () => {
      activeClients.delete(clientInfo);
    });

    ws.on('error', () => {
      activeClients.delete(clientInfo);
    });
  });

  // Keep-alive ping interval
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
  }, 30000);

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

  console.log('[AetherPanel] Console WebSocket engine initialized and listening for socket upgrades.');
  return wss;
}
