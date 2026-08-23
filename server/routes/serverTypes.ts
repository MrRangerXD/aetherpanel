import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, requireRole, AuthenticatedRequest, createAuditLog } from '../auth';
import { Server, ServerType, ServerTypeTheme } from '../../src/types';

const router = Router();

// Multer in-memory storage for asset uploads (backgrounds & icons)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Allowed formats: JPG, PNG, WebP, SVG'));
    }
  }
});

/**
 * Default Theme Fallback Template
 */
const DEFAULT_THEME_TEMPLATE: ServerTypeTheme = {
  id: 'stt_default',
  serverTypeId: 'st_default',
  backgroundUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
  iconUrl: '',
  accentColor: '#8B5CF6',
  overlayOpacity: 0.6,
  gradientEnabled: true,
  cardStyle: 'default',
  badgeStyle: 'glow',
  statusStyle: 'pill',
  defaultResourceLabels: { cpu: 'CPU', ram: 'RAM', disk: 'Disk' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

/**
 * Ensures a ServerType has a fully populated, non-null theme.
 */
function normalizeServerType(st: ServerType): ServerType {
  const existingTheme: Partial<ServerTypeTheme> = st.theme || {};
  const normalizedTheme: ServerTypeTheme = {
    ...DEFAULT_THEME_TEMPLATE,
    ...existingTheme,
    id: existingTheme.id || `stt_${st.id}`,
    serverTypeId: st.id,
    backgroundUrl: existingTheme.backgroundUrl || DEFAULT_THEME_TEMPLATE.backgroundUrl,
    accentColor: existingTheme.accentColor || DEFAULT_THEME_TEMPLATE.accentColor,
    overlayOpacity: typeof existingTheme.overlayOpacity === 'number'
      ? Math.max(0, Math.min(1, existingTheme.overlayOpacity))
      : 0.6,
    gradientEnabled: existingTheme.gradientEnabled !== false,
    cardStyle: ['default', 'compact', 'glass', 'bordered'].includes(existingTheme.cardStyle as any)
      ? existingTheme.cardStyle
      : 'default',
    badgeStyle: ['glow', 'solid', 'outline', 'minimal'].includes(existingTheme.badgeStyle as any)
      ? existingTheme.badgeStyle
      : 'glow',
    statusStyle: ['pill', 'dot', 'pulse', 'bar'].includes(existingTheme.statusStyle as any)
      ? existingTheme.statusStyle
      : 'pill'
  };

  return {
    ...st,
    theme: normalizedTheme
  };
}

/**
 * Resolves a server's ServerType identity and theme with fallbacks.
 */
export function resolveServerType(server: Server, serverTypes: ServerType[]): ServerType {
  const types = (serverTypes || []).filter(Boolean);

  if (server?.serverTypeId) {
    const found = types.find(st => st.id === server.serverTypeId);
    if (found) return normalizeServerType(found);
  }

  const sw = (server?.software || '').toLowerCase();
  const botRt = (server?.startup?.botRuntime || '').toLowerCase();
  
  if (sw.includes('bedrock')) {
    const found = types.find(st => st.id === 'st_minecraft_bedrock' || st.slug === 'minecraft-bedrock');
    if (found) return normalizeServerType(found);
  }
  if (sw.includes('node') || botRt === 'nodejs') {
    const found = types.find(st => st.id === 'st_nodejs' || st.slug === 'nodejs');
    if (found) return normalizeServerType(found);
  }
  if (sw.includes('bun') || botRt === 'bun') {
    const found = types.find(st => st.id === 'st_bun' || st.slug === 'bun');
    if (found) return normalizeServerType(found);
  }
  if (sw.includes('python') || botRt === 'python') {
    const found = types.find(st => st.id === 'st_python' || st.slug === 'python');
    if (found) return normalizeServerType(found);
  }
  const defaultMc = types.find(st => st.id === 'st_minecraft_java' || st.slug === 'minecraft-java');
  if (defaultMc) return normalizeServerType(defaultMc);

  if (types.length > 0) {
    return normalizeServerType(types[0]);
  }

  return normalizeServerType({
    id: 'st_default',
    name: 'Standard Server',
    slug: 'standard',
    category: 'Other',
    runtime: 'General',
    description: 'Default hosting server runtime',
    icon: 'Server',
    enabled: true,
    sortOrder: 99,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    theme: DEFAULT_THEME_TEMPLATE
  });
}

// ==========================================
// PUBLIC / CUSTOMER ENDPOINTS
// ==========================================

// GET /api/v1/server-types - List active server types for customers
router.get('/', async (req, res) => {
  const db = await getDb();
  const enabledTypes = (db.serverTypes || []).filter(st => st.enabled);
  res.json({ success: true, data: enabledTypes });
});

// ==========================================
// ADMIN CONTROL PLANE ENDPOINTS (RBAC Guarded)
// ==========================================

// GET /api/v1/admin/server-types - List all server types (including disabled) for admins
router.get('/admin', authMiddleware, requireRole(['admin', 'super_admin', 'support']), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.serverTypes || [] });
});

// POST /api/v1/admin/server-types - Create a new server type
router.post('/admin', authMiddleware, requireRole(['admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const { name, category, runtime, description, icon, enabled, sortOrder, defaultPort, defaultStartupCommand, theme } = req.body;

  if (!name || typeof name !== 'string' || !name.trim() || !runtime || typeof runtime !== 'string' || !runtime.trim()) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Name and Runtime are required string fields.' } });
    return;
  }

  let slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!slug) slug = `st-${Date.now().toString(36)}`;

  // Ensure unique slug
  if (db.serverTypes.some(s => s.slug === slug)) {
    slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
  }

  const id = `st_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const themeId = `stt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newTheme: ServerTypeTheme = {
    id: themeId,
    serverTypeId: id,
    backgroundUrl: theme?.backgroundUrl || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
    iconUrl: theme?.iconUrl || '',
    accentColor: theme?.accentColor || '#8B5CF6',
    overlayOpacity: typeof theme?.overlayOpacity === 'number' ? Math.max(0, Math.min(1, theme.overlayOpacity)) : 0.6,
    gradientEnabled: theme?.gradientEnabled !== false,
    cardStyle: ['default', 'compact', 'glass', 'bordered'].includes(theme?.cardStyle) ? theme.cardStyle : 'default',
    badgeStyle: ['glow', 'solid', 'outline', 'minimal'].includes(theme?.badgeStyle) ? theme.badgeStyle : 'glow',
    statusStyle: ['pill', 'dot', 'pulse', 'bar'].includes(theme?.statusStyle) ? theme.statusStyle : 'pill',
    defaultResourceLabels: theme?.defaultResourceLabels || { cpu: 'CPU', ram: 'RAM', disk: 'Disk' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const newServerType: ServerType = {
    id,
    name: name.trim(),
    slug,
    category: category || 'Other',
    runtime: runtime.trim(),
    description: description || '',
    icon: icon || 'Server',
    enabled: enabled !== false,
    sortOrder: typeof sortOrder === 'number' ? sortOrder : (db.serverTypes.length + 1),
    defaultPort: defaultPort ? parseInt(defaultPort, 10) : undefined,
    defaultStartupCommand: defaultStartupCommand || undefined,
    theme: newTheme,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.serverTypes.push(newServerType);
  saveDbSync();

  await createAuditLog(
    req.user,
    'SERVER_TYPE_CREATE',
    'server_type',
    `Created server type: ${name} (${runtime})`,
    req.ip || '127.0.0.1'
  );

  res.json({ success: true, data: newServerType });
});

// GET /api/v1/admin/server-types/:id - Get single server type
router.get('/admin/:id', authMiddleware, requireRole(['admin', 'super_admin', 'support']), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const st = db.serverTypes.find(s => s.id === req.params.id);
  if (!st) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server type not found.' } });
    return;
  }
  res.json({ success: true, data: st });
});

// PUT /api/v1/admin/server-types/:id - Update server type & theme
router.put('/admin/:id', authMiddleware, requireRole(['admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const st = db.serverTypes.find(s => s.id === req.params.id);
  if (!st) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server type not found.' } });
    return;
  }

  const { name, category, runtime, description, icon, enabled, sortOrder, defaultPort, defaultStartupCommand, theme } = req.body;

  if (name !== undefined) st.name = name;
  if (category !== undefined) st.category = category;
  if (runtime !== undefined) st.runtime = runtime;
  if (description !== undefined) st.description = description;
  if (icon !== undefined) st.icon = icon;
  if (enabled !== undefined) st.enabled = enabled;
  if (sortOrder !== undefined) st.sortOrder = sortOrder;
  if (defaultPort !== undefined) st.defaultPort = defaultPort;
  if (defaultStartupCommand !== undefined) st.defaultStartupCommand = defaultStartupCommand;

  if (theme) {
    st.theme = {
      ...st.theme,
      ...theme,
      updatedAt: new Date().toISOString()
    };
  }

  st.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(
    req.user,
    'SERVER_TYPE_UPDATE',
    'server_type',
    `Updated server type: ${st.name}`,
    req.ip || '127.0.0.1'
  );

  res.json({ success: true, data: st });
});

// DELETE /api/v1/admin/server-types/:id - Delete server type with deletion safety & reassignments
router.delete('/admin/:id', authMiddleware, requireRole(['admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const stIndex = db.serverTypes.findIndex(s => s.id === req.params.id);
  if (stIndex === -1) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server type not found.' } });
    return;
  }

  const targetSt = db.serverTypes[stIndex];
  const activeServers = db.servers.filter(s => s.serverTypeId === targetSt.id);

  const reassignToId = (req.query.reassignToId || req.body?.reassignToId) as string | undefined;

  if (activeServers.length > 0 && !reassignToId) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SERVERS_IN_USE',
        message: `Cannot delete ${targetSt.name}. ${activeServers.length} active servers are using this type. Please reassign them first.`,
        activeServerCount: activeServers.length
      }
    });
    return;
  }

  if (activeServers.length > 0 && reassignToId) {
    const reassignTarget = db.serverTypes.find(s => s.id === reassignToId && s.id !== targetSt.id);
    if (!reassignTarget) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REASSIGN_TARGET', message: 'Invalid reassign target server type.' } });
      return;
    }
    // Reassign all active servers
    activeServers.forEach(srv => {
      srv.serverTypeId = reassignTarget.id;
    });
  }

  db.serverTypes.splice(stIndex, 1);
  saveDbSync();

  await createAuditLog(
    req.user,
    'SERVER_TYPE_DELETE',
    'server_type',
    `Deleted server type: ${targetSt.name} (reassigned ${activeServers.length} servers)`,
    req.ip || '127.0.0.1'
  );

  res.json({ success: true, message: `Server type ${targetSt.name} deleted successfully.` });
});

// GET /api/v1/admin/server-types/:id/theme - Get theme
router.get('/admin/:id/theme', authMiddleware, requireRole(['admin', 'super_admin', 'support']), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const st = db.serverTypes.find(s => s.id === req.params.id);
  if (!st) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server type not found.' } });
    return;
  }
  res.json({ success: true, data: st.theme });
});

// PUT /api/v1/admin/server-types/:id/theme - Update theme
router.put('/admin/:id/theme', authMiddleware, requireRole(['admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const st = db.serverTypes.find(s => s.id === req.params.id);
  if (!st) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server type not found.' } });
    return;
  }

  st.theme = {
    ...st.theme,
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  st.updatedAt = new Date().toISOString();

  saveDbSync();
  res.json({ success: true, data: st.theme });
});

// POST /api/v1/admin/server-types/:id/theme/reset - Restore default theme
router.post('/admin/:id/theme/reset', authMiddleware, requireRole(['admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const st = db.serverTypes.find(s => s.id === req.params.id);
  if (!st) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server type not found.' } });
    return;
  }

  let defaultBg = 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80';
  let defaultAccent = '#8B5CF6';

  const rt = (st.runtime || '').toLowerCase();
  if (rt.includes('java')) {
    defaultBg = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=80';
    defaultAccent = '#22C55E';
  } else if (rt.includes('bedrock')) {
    defaultBg = 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=1200&q=80';
    defaultAccent = '#10B981';
  } else if (rt.includes('node')) {
    defaultBg = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80';
    defaultAccent = '#68A063';
  } else if (rt.includes('bun')) {
    defaultBg = 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80';
    defaultAccent = '#F472B6';
  } else if (rt.includes('python')) {
    defaultBg = 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80';
    defaultAccent = '#38BDF8';
  }

  st.theme = {
    id: `stt_reset_${Date.now()}`,
    serverTypeId: st.id,
    backgroundUrl: defaultBg,
    iconUrl: '',
    accentColor: defaultAccent,
    overlayOpacity: 0.6,
    gradientEnabled: true,
    cardStyle: 'default',
    badgeStyle: 'glow',
    statusStyle: 'pill',
    defaultResourceLabels: { cpu: 'CPU', ram: 'RAM', disk: 'Disk' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  saveDbSync();
  res.json({ success: true, data: st.theme });
});

// POST /api/v1/admin/server-types/:id/duplicate - Duplicate server type and theme
router.post('/admin/:id/duplicate', authMiddleware, requireRole(['admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const source = db.serverTypes.find(s => s.id === req.params.id);
  if (!source) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Source server type not found.' } });
    return;
  }

  const newId = `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newName = `${source.name} (Copy)`;
  const newSlug = `${source.slug}-copy-${Date.now().toString(36)}`;

  const duplicated: ServerType = {
    ...JSON.parse(JSON.stringify(source)),
    id: newId,
    name: newName,
    slug: newSlug,
    sortOrder: db.serverTypes.length + 1,
    theme: {
      ...JSON.parse(JSON.stringify(source.theme)),
      id: `stt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      serverTypeId: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.serverTypes.push(duplicated);
  saveDbSync();

  res.json({ success: true, data: duplicated });
});

// POST /api/v1/admin/server-types/upload-asset - Upload background/banner or logo asset
router.post('/admin/upload-asset', authMiddleware, requireRole(['admin', 'super_admin']), (req: AuthenticatedRequest, res: Response) => {
  upload.single('asset')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message || 'File upload failed'
        }
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No image file uploaded.' } });
    }

    let buffer = req.file.buffer;
    let mimetype = req.file.mimetype;

    // Sanitize SVG if uploaded to strip malicious scripts
    if (mimetype === 'image/svg+xml') {
      let svgStr = buffer.toString('utf8');
      svgStr = svgStr
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
      buffer = Buffer.from(svgStr, 'utf8');
    }

    // Convert uploaded image to base64 Data URL for secure, permanent, self-contained persistence
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimetype};base64,${base64}`;

    res.json({
      success: true,
      data: {
        url: dataUrl,
        mimetype,
        size: buffer.length
      }
    });
  });
});

export default router;
