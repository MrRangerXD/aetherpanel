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

// GET /api/v1/public/plans & GET /api/v1/plans
router.get('/plans', async (req: Request, res: Response) => {
  const db = await getDb();
  let plans = db.plans.filter(p => p.isActive);
  const category = req.query.category as string;
  if (category) {
    plans = plans.filter(p => {
      const prod = db.products.find(prod => prod.id === p.productId);
      const planCat = prod?.category || (p.id.includes('bot') ? 'bot' : 'minecraft');
      return planCat.toLowerCase() === category.toLowerCase();
    });
  }
  res.json({
    success: true,
    data: plans
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
  const { brandName, brandTagline, supportEmail, discordUrl, currencySymbol, currencyCode, registrationEnabled, maintenanceMode, maintenanceMessage, defaultTheme, accentColor, enablePlayit, pageAnimationsEnabled, socialLinks } = db.settings;

  res.json({
    success: true,
    data: {
      brandName,
      brandTagline,
      supportEmail,
      discordUrl,
      socialLinks: socialLinks || {
        discord: discordUrl || 'https://discord.gg/aetherpanel',
        twitter: 'https://twitter.com/aetherpanel',
        github: 'https://github.com/aetherpanel'
      },
      currencySymbol,
      currencyCode,
      registrationEnabled,
      maintenanceMode,
      maintenanceMessage,
      defaultTheme,
      accentColor,
      enablePlayit: enablePlayit !== false,
      pageAnimationsEnabled: pageAnimationsEnabled !== false
    }
  });
});

// GET /api/v1/public/settings/social-links and /social-links
const getPublicSocialLinks = async (req: Request, res: Response) => {
  const db = await getDb();
  const socialLinks = db.settings.socialLinks || {
    discord: db.settings.discordUrl || 'https://discord.gg/aetherpanel',
    twitter: 'https://twitter.com/aetherpanel',
    github: 'https://github.com/aetherpanel'
  };
  res.json({
    success: true,
    data: socialLinks
  });
};

router.get('/settings/social-links', getPublicSocialLinks);
router.get('/social-links', getPublicSocialLinks);

// GET /api/v1/public/theme-settings
router.get('/theme-settings', async (req: Request, res: Response) => {
  const db = await getDb();
  const defaults = {
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
      bannerUrl: '',
      loginBgUrl: ''
    }
  };
  const themeSettings = {
    ...defaults,
    ...(db.settings.themeSettings || {}),
    assets: {
      ...defaults.assets,
      ...(db.settings.themeSettings?.assets || {})
    }
  };
  res.json({
    success: true,
    data: themeSettings
  });
});

// GET /api/v1/public/legal
router.get('/legal', async (req: Request, res: Response) => {
  const db = await getDb();
  const pages = (db.legalPages || []).filter(p => p.isPublished).map(p => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    version: p.version,
    lastUpdatedAt: p.lastUpdatedAt
  }));
  res.json({
    success: true,
    data: pages
  });
});

// GET /api/v1/public/legal/:slug
router.get('/legal/:slug', async (req: Request, res: Response) => {
  const db = await getDb();
  const page = (db.legalPages || []).find(p => p.slug === req.params.slug && p.isPublished);
  if (!page) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Legal document not found or unpublished.' }
    });
  }
  res.json({
    success: true,
    data: page
  });
});

export default router;
