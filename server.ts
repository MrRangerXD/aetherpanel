import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import authRoutes from './server/routes/auth';
import publicRoutes from './server/routes/public';
import serverRoutes from './server/routes/servers';
import deployRoutes from './server/routes/deploy';
import billingRoutes from './server/routes/billing';
import supportRoutes from './server/routes/support';
import adminRoutes from './server/routes/admin';
import nodeApiRoutes, { startHeartbeatMonitor } from './server/routes/nodeApi';
import adsRoutes from './server/routes/ads';
import afkRoutes from './server/routes/afk';
import templateRoutes from './server/routes/templates';
import discordRoutes from './server/routes/discord';
import marketplaceRoutes from './server/routes/marketplace';
import statusRoutes from './server/routes/status';
import monitoringRoutes from './server/routes/monitoring';
import apiKeysRoutes from './server/routes/apiKeys';
import minecraftRoutes from './server/routes/minecraft';
import { startSchedulerLoop } from './server/scheduler';
import { startLocalNodeAgent } from './server/nodeAgent';
import { setupConsoleWebSocket } from './server/consoleWs';
import { startSftpDaemon } from './server/sftpServer';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Basic Body Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Helper Cookie Parser
  app.use((req, res, next) => {
    req.cookies = {};
    const rc = req.headers.cookie;
    if (rc) {
      rc.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        req.cookies[parts.shift()!.trim()] = decodeURI(parts.join('='));
      });
    }
    next();
  });

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'AetherPanel Control Plane', timestamp: new Date().toISOString() });
  });

  // API Routes FIRST
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/public', publicRoutes);
  app.use('/api/v1/servers', serverRoutes);
  app.use('/api/v1/deploy', deployRoutes);
  app.use('/api/v1/billing', billingRoutes);
  app.use('/api/v1/support', supportRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/node', nodeApiRoutes);
  app.use('/api/v1/ads', adsRoutes);
  app.use('/api/v1/afk', afkRoutes);
  app.use('/api/v1/templates', templateRoutes);
  app.use('/api/v1/discord', discordRoutes);
  app.use('/api/v1/marketplace', marketplaceRoutes);
  app.use('/api/v1/status', statusRoutes);
  app.use('/api/v1/monitoring', monitoringRoutes);
  app.use('/api/v1/api-keys', apiKeysRoutes);
  app.use('/api/v1/minecraft', minecraftRoutes);

  // Vite Integration for SPA Development and Production Serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind and Listen on Port 3000
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AetherPanel] Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[AetherPanel] Port ${PORT} in use, existing listener may still be handling requests.`);
    } else {
      console.error('[AetherPanel] Server listener error:', err);
    }
  });

  // Initialize WebSockets for live console streaming attached to express server
  try {
    setupConsoleWebSocket(server);
  } catch (wsErr) {
    console.warn('[AetherPanel] WebSocket initialization warning:', wsErr);
  }

  // Start background services asynchronously after server is listening
  setImmediate(() => {
    try {
      startHeartbeatMonitor();
    } catch (e) {
      console.warn('[AetherPanel] Heartbeat monitor init notice:', e);
    }

    try {
      startLocalNodeAgent();
    } catch (e) {
      console.warn('[AetherPanel] Local node agent init notice:', e);
    }

    try {
      startSchedulerLoop();
    } catch (e) {
      console.warn('[AetherPanel] Scheduler loop init notice:', e);
    }

    try {
      startSftpDaemon();
    } catch (e) {
      console.warn('[AetherPanel] SFTP daemon init notice:', e);
    }
  });

  return server;
}

startServer().catch(err => {
  console.error('[AetherPanel] Fatal server startup error:', err);
});

