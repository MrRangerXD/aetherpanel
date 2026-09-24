import express, { Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { authMiddleware, AuthenticatedRequest } from './server/auth';
import { getDb, saveDb } from './server/db';

import authRoutes from './server/routes/auth';
import publicRoutes from './server/routes/public';
import serverRoutes from './server/routes/servers';
import deployRoutes from './server/routes/deploy';
import billingRoutes from './server/routes/billing';
import supportRoutes from './server/routes/support';
import adminRoutes from './server/routes/admin';
import nodeApiRoutes, { startHeartbeatMonitor } from './server/routes/nodeApi';
import nodePlayitRoutes from './server/routes/nodePlayit';
import adsRoutes from './server/routes/ads';
import afkRoutes from './server/routes/afk';
import discordRoutes from './server/routes/discord';
import statusRoutes from './server/routes/status';
import monitoringRoutes from './server/routes/monitoring';
import apiKeysRoutes from './server/routes/apiKeys';
import minecraftRoutes from './server/routes/minecraft';
import serverTypesRoutes from './server/routes/serverTypes';
import runtimesRoutes from './server/routes/runtimes';
import diagnosticsRoutes from './server/routes/diagnostics';
import { startSchedulerLoop } from './server/scheduler';
import { startLocalNodeAgent } from './server/nodeAgent';
import { setupConsoleWebSocket } from './server/consoleWs';
import { startSftpDaemon } from './server/sftpServer';
import { reconcileServerStatesOnBoot } from './server/provider';
import { initializePlayitOnBoot } from './server/playitService';
import { initializeRuntime } from './server/init';
import { initializeNetworkProtectionOnBoot } from './server/services/networkProtectionService';
import { generalApiRateLimiter, sensitiveAuthRateLimiter, safePayloadErrorHandler } from './server/services/requestProtection';

dotenv.config();

async function startServer() {
  // Ensure runtime filesystem is healthy before any service starts
  await initializeRuntime();

  const app = express();
  const PORT = 3000;

  // Enable reverse proxy trust (Cloud Run, Nginx, Cloudflare, Caddy)
  if (process.env.TRUST_PROXY !== 'false' && process.env.TRUST_PROXY !== '0') {
    app.set('trust proxy', true);
  }

  // Basic Body Parsers with error interception
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(safePayloadErrorHandler);

  // General API Request Protection
  app.use('/api', generalApiRateLimiter);

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

  // CORS & Allowed Origins Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedEnv = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean) : [];
    const panelUrl = process.env.PANEL_URL ? process.env.PANEL_URL.trim().replace(/\/+$/, '') : null;
    const appUrl = process.env.APP_URL ? process.env.APP_URL.trim().replace(/\/+$/, '') : null;

    const allowedSet = new Set([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      ...(panelUrl ? [panelUrl] : []),
      ...(appUrl ? [appUrl] : []),
      ...allowedEnv
    ]);

    if (origin && (allowedSet.has(origin) || allowedSet.has('*') || process.env.NODE_ENV !== 'production')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Daemon-Token');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'AetherPanel Control Plane', timestamp: new Date().toISOString() });
  });

  // API Routes FIRST
  app.get('/api/v1/settings/appearance', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDb();
    const defaultAnimationSettings = {
      enabled: true,
      pageTransitions: true,
      initialPanelAnimation: true,
      intensity: 'normal' as const
    };
    const settings = db.settings.animationSettings || defaultAnimationSettings;
    res.json({ success: true, data: settings });
  });

  app.get('/api/v1/settings/social-links', async (req, res) => {
    const db = await getDb();
    const socialLinks = db.settings.socialLinks || {
      discord: db.settings.discordUrl || 'https://discord.gg/aetherpanel',
      twitter: 'https://twitter.com/aetherpanel',
      github: 'https://github.com/aetherpanel'
    };
    res.json({ success: true, data: socialLinks });
  });

  // GET /api/v1/system/branding - System wallpaper & brand settings (PRD Section 5 & 7.2)
  app.get('/api/v1/system/branding', async (req, res) => {
    const db = await getDb();
    const themeSettings = db.settings.themeSettings || ({} as any);
    const assets = themeSettings.assets || {};
    res.json({
      success: true,
      data: {
        brandName: db.settings.brandName || 'AetherPanel',
        brandTagline: db.settings.brandTagline || 'Premium Minecraft & Discord Bot Hosting',
        backgroundWallpaperUrl: assets.backgroundWallpaperUrl || assets.bgPatternUrl || '',
        backgroundBlur: themeSettings.backgroundBlur || 'none',
        backgroundOverlayOpacity: themeSettings.backgroundOverlayOpacity !== undefined ? themeSettings.backgroundOverlayOpacity : 75,
        brightness: (themeSettings as any).brightness !== undefined ? (themeSettings as any).brightness : 100,
        activeThemeId: themeSettings.activeThemeId || 'golden',
        logoUrl: assets.logoUrl || '',
        faviconUrl: assets.faviconUrl || ''
      }
    });
  });

  // PUT /api/v1/system/branding - Updates global wallpaper & branding (Admin only, PRD Section 5 & 7.2)
  app.put('/api/v1/system/branding', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required to modify system branding.' } });
    }

    const db = await getDb();
    const {
      brandName,
      brandTagline,
      backgroundWallpaperUrl,
      backgroundBlur,
      backgroundOverlayOpacity,
      brightness,
      activeThemeId,
      logoUrl,
      faviconUrl
    } = req.body;

    if (typeof brandName === 'string' && brandName.trim()) {
      db.settings.brandName = brandName.trim();
    }
    if (typeof brandTagline === 'string') {
      db.settings.brandTagline = brandTagline.trim();
    }

    if (!db.settings.themeSettings) {
      db.settings.themeSettings = {
        activeThemeId: 'golden',
        activeFontId: 'Plus Jakarta Sans',
        cardStyle: 'rounded-2xl',
        glowIntensity: 'vibrant',
        allowUserCustomization: true,
        backgroundBlur: 'none',
        backgroundOverlayOpacity: 75,
        assets: {
          logoUrl: '',
          faviconUrl: '',
          bgPatternUrl: '',
          backgroundWallpaperUrl: '',
          bannerUrl: '',
          loginBgUrl: ''
        }
      };
    }

    if (!db.settings.themeSettings.assets) {
      db.settings.themeSettings.assets = {
        logoUrl: '',
        faviconUrl: '',
        bgPatternUrl: '',
        backgroundWallpaperUrl: '',
        bannerUrl: '',
        loginBgUrl: ''
      };
    }

    if (backgroundWallpaperUrl !== undefined) {
      db.settings.themeSettings.assets.backgroundWallpaperUrl = backgroundWallpaperUrl;
      db.settings.themeSettings.assets.bgPatternUrl = backgroundWallpaperUrl;
    }
    if (logoUrl !== undefined) {
      db.settings.themeSettings.assets.logoUrl = logoUrl;
    }
    if (faviconUrl !== undefined) {
      db.settings.themeSettings.assets.faviconUrl = faviconUrl;
    }
    if (backgroundBlur !== undefined) {
      db.settings.themeSettings.backgroundBlur = backgroundBlur;
    }
    if (backgroundOverlayOpacity !== undefined) {
      db.settings.themeSettings.backgroundOverlayOpacity = Number(backgroundOverlayOpacity);
    }
    if (brightness !== undefined) {
      (db.settings.themeSettings as any).brightness = Number(brightness);
    }
    if (activeThemeId !== undefined) {
      db.settings.themeSettings.activeThemeId = activeThemeId;
    }

    await saveDb();

    res.json({
      success: true,
      message: 'System branding updated successfully.',
      data: {
        brandName: db.settings.brandName,
        brandTagline: db.settings.brandTagline,
        backgroundWallpaperUrl: db.settings.themeSettings.assets.backgroundWallpaperUrl,
        backgroundBlur: db.settings.themeSettings.backgroundBlur,
        backgroundOverlayOpacity: db.settings.themeSettings.backgroundOverlayOpacity,
        brightness: (db.settings.themeSettings as any).brightness,
        activeThemeId: db.settings.themeSettings.activeThemeId,
        logoUrl: db.settings.themeSettings.assets.logoUrl,
        faviconUrl: db.settings.themeSettings.assets.faviconUrl
      }
    });
  });

  app.use('/api/v1/auth', sensitiveAuthRateLimiter, authRoutes);
  app.use('/api/v1/account', authRoutes);
  app.use('/api/v1/public', publicRoutes);
  app.use('/api/v1/plans', publicRoutes);
  app.use('/api/v1/servers', serverRoutes);
  app.use('/api/v1/deploy', deployRoutes);
  app.use('/api/v1/billing', billingRoutes);
  app.use('/api/v1/support', supportRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/node', nodeApiRoutes);
  app.use('/api/v1/nodes', nodePlayitRoutes);
  app.use('/api/v1/ads', adsRoutes);
  app.use('/api/v1/afk', afkRoutes);
  app.use('/api/v1/discord', discordRoutes);
  app.use('/api/v1/status', statusRoutes);
  app.use('/api/v1/monitoring', monitoringRoutes);
  app.use('/api/v1/api-keys', apiKeysRoutes);
  app.use('/api/v1/minecraft', minecraftRoutes);
  app.use('/api/v1/server-types', serverTypesRoutes);
  app.use('/api/v1/runtimes', runtimesRoutes);
  app.use('/api/v1/diagnostics', diagnosticsRoutes);
  app.use('/api/v1/public/diagnostics', diagnosticsRoutes);

  // Catch-all for missing API routes - must return JSON, not HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'API_NOT_FOUND',
        message: `The API endpoint '${req.originalUrl}' does not exist on this server.`
      }
    });
  });

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

    try {
      reconcileServerStatesOnBoot();
    } catch (e) {
      console.warn('[AetherPanel] Lifecycle boot reconciliation init notice:', e);
    }

    try {
      initializePlayitOnBoot();
    } catch (e) {
      console.warn('[AetherPanel] Playit auto-recovery boot notice:', e);
    }

    try {
      initializeNetworkProtectionOnBoot();
    } catch (e) {
      console.warn('[AetherPanel] Network protection boot notice:', e);
    }
  });

  return server;
}

startServer().catch(err => {
  console.error('[AetherPanel] Fatal server startup error:', err);
});

