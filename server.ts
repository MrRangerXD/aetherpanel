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
import { startSchedulerLoop } from './server/scheduler';
import { startLocalNodeAgent } from './server/nodeAgent';

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

  // Serve install.sh bash script directly for curl commands
  app.get('/install.sh', (req, res) => {
    const rootScriptPath = path.join(process.cwd(), 'install.sh');
    const publicScriptPath = path.join(process.cwd(), 'public', 'install.sh');
    const targetScript = fs.existsSync(rootScriptPath) ? rootScriptPath : publicScriptPath;

    if (fs.existsSync(targetScript)) {
      res.setHeader('Content-Type', 'text/x-shellscript');
      return res.sendFile(targetScript);
    }
    res.status(404).send('# Installer script not found');
  });

  // API Routes
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

  // Start Node Daemon Heartbeat Watchdog, Local Node Agent, and Scheduler Automation
  startHeartbeatMonitor();
  startLocalNodeAgent();
  startSchedulerLoop();

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'AetherPanel Control Plane', timestamp: new Date().toISOString() });
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AetherPanel] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[AetherPanel] Fatal server startup error:', err);
});
