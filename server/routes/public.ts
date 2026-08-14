import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { HealthStatus } from '../../src/types';

const router = Router();

// GET /api/v1/public/status
router.get('/status', async (req: Request, res: Response) => {
  const db = await getDb();

  const totalNodes = db.nodes.length;
  const onlineNodes = db.nodes.filter(n => n.status === 'online' && !n.isMaintenanceMode).length;
  const activeServers = db.servers.filter(s => s.status === 'running').length;

  let overallStatus: HealthStatus['status'] = 'operational';
  if (onlineNodes < totalNodes) {
    overallStatus = 'degraded';
  }
  if (db.settings.maintenanceMode) {
    overallStatus = 'outage';
  }

  const health: HealthStatus = {
    status: overallStatus,
    controlPanel: db.settings.maintenanceMode ? 'outage' : 'operational',
    api: 'operational',
    nodesOnline: onlineNodes,
    nodesTotal: totalNodes,
    activeServers,
    lastCheckedAt: new Date().toISOString()
  };

  res.json({
    success: true,
    data: {
      health,
      nodes: db.nodes.map(n => ({
        id: n.id,
        name: n.name,
        locationName: n.locationName,
        flagCode: n.flagCode,
        status: n.status,
        isMaintenanceMode: n.isMaintenanceMode,
        serverCount: n.serverCount
      }))
    }
  });
});

// GET /api/v1/public/products
router.get('/products', async (req: Request, res: Response) => {
  const db = await getDb();
  res.json({
    success: true,
    data: db.products.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  });
});

// GET /api/v1/public/plans
router.get('/plans', async (req: Request, res: Response) => {
  const db = await getDb();
  res.json({
    success: true,
    data: db.plans.filter(p => p.isActive)
  });
});

// GET /api/v1/public/announcements
router.get('/announcements', async (req: Request, res: Response) => {
  const db = await getDb();
  res.json({
    success: true,
    data: db.announcements.filter(a => a.isPublished)
  });
});

// GET /api/v1/public/settings
router.get('/settings', async (req: Request, res: Response) => {
  const db = await getDb();
  const { brandName, brandTagline, supportEmail, discordUrl, currencySymbol, currencyCode, registrationEnabled, maintenanceMode, maintenanceMessage, defaultTheme, accentColor } = db.settings;

  res.json({
    success: true,
    data: {
      brandName,
      brandTagline,
      supportEmail,
      discordUrl,
      currencySymbol,
      currencyCode,
      registrationEnabled,
      maintenanceMode,
      maintenanceMessage,
      defaultTheme,
      accentColor
    }
  });
});

export default router;
