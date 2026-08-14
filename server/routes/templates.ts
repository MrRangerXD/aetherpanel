import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, requireRole, AuthenticatedRequest, createAuditLog } from '../auth';
import { ServerTemplate } from '../../src/types';

const router = Router();

// GET /api/v1/templates - Public / User listing of active server templates
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const activeTemplates = (db.templates || []).filter(t => t.status === 'active');
    res.json({
      success: true,
      data: activeTemplates.sort((a, b) => a.sortOrder - b.sortOrder)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/templates/:id - Get specific template details
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const tpl = (db.templates || []).find(t => t.id === req.params.id);
    if (!tpl) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }
    res.json({ success: true, data: tpl });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// --- ADMIN ROUTES FOR TEMPLATES ---
// GET /api/v1/admin/templates - Get all templates including disabled
router.get('/admin/list', authMiddleware, requireRole(['admin', 'super_admin', 'support']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    res.json({
      success: true,
      data: (db.templates || []).sort((a, b) => a.sortOrder - b.sortOrder)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/admin/templates - Create new server template
router.post('/admin/create', authMiddleware, requireRole(['admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name, description, category, icon, runtime, versions,
      defaultVersion, startupCommand, environmentVars,
      defaultPort, recommendedRamMB, recommendedCpuCores, recommendedDiskGB, status, isPopular
    } = req.body;

    if (!name || !category || !runtime || !startupCommand) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, category, runtime, and startup command are required.' }
      });
    }

    const db = await getDb();
    if (!db.templates) db.templates = [];

    const newTemplate: ServerTemplate = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      description: description || '',
      category: category || 'minecraft',
      icon: icon || (category === 'minecraft' ? 'Gamepad2' : 'Bot'),
      runtime: runtime || (category === 'minecraft' ? 'minecraft' : 'nodejs'),
      versions: Array.isArray(versions) && versions.length > 0 ? versions : [defaultVersion || '1.20.4'],
      defaultVersion: defaultVersion || (Array.isArray(versions) && versions[0]) || '1.20.4',
      startupCommand: startupCommand || 'java -Xmx{RAM_MB}M -jar server.jar nogui',
      environmentVars: typeof environmentVars === 'object' && environmentVars !== null ? environmentVars : { PORT: '{PORT}' },
      defaultPort: defaultPort ? parseInt(defaultPort, 10) : (category === 'minecraft' ? 25565 : 3000),
      recommendedRamMB: recommendedRamMB ? parseInt(recommendedRamMB, 10) : 2048,
      recommendedCpuCores: recommendedCpuCores ? parseFloat(recommendedCpuCores) : 1,
      recommendedDiskGB: recommendedDiskGB ? parseInt(recommendedDiskGB, 10) : 15,
      status: status || 'active',
      isPopular: Boolean(isPopular),
      sortOrder: db.templates.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.templates.push(newTemplate);
    saveDbSync();

    await createAuditLog(
      req.user!.id, req.user!.email, req.user!.role,
      'ADMIN_CREATE_TEMPLATE', newTemplate.id,
      `Created server template '${newTemplate.name}'`
    );

    res.json({ success: true, message: 'Template created successfully', data: newTemplate });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/admin/templates/:id - Update server template
router.put('/admin/:id', authMiddleware, requireRole(['admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    if (!db.templates) db.templates = [];

    const tpl = db.templates.find(t => t.id === req.params.id);
    if (!tpl) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    const {
      name, description, category, icon, runtime, versions,
      defaultVersion, startupCommand, environmentVars,
      defaultPort, recommendedRamMB, recommendedCpuCores, recommendedDiskGB, status, isPopular, sortOrder
    } = req.body;

    if (name) tpl.name = name.trim();
    if (description !== undefined) tpl.description = description;
    if (category) tpl.category = category;
    if (icon) tpl.icon = icon;
    if (runtime) tpl.runtime = runtime;
    if (Array.isArray(versions)) tpl.versions = versions;
    if (defaultVersion) tpl.defaultVersion = defaultVersion;
    if (startupCommand) tpl.startupCommand = startupCommand;
    if (typeof environmentVars === 'object' && environmentVars !== null) tpl.environmentVars = environmentVars;
    if (defaultPort) tpl.defaultPort = parseInt(defaultPort, 10);
    if (recommendedRamMB) tpl.recommendedRamMB = parseInt(recommendedRamMB, 10);
    if (recommendedCpuCores) tpl.recommendedCpuCores = parseFloat(recommendedCpuCores);
    if (recommendedDiskGB) tpl.recommendedDiskGB = parseInt(recommendedDiskGB, 10);
    if (status) tpl.status = status;
    if (typeof isPopular === 'boolean') tpl.isPopular = isPopular;
    if (typeof sortOrder === 'number') tpl.sortOrder = sortOrder;

    tpl.updatedAt = new Date().toISOString();
    saveDbSync();

    await createAuditLog(
      req.user!.id, req.user!.email, req.user!.role,
      'ADMIN_UPDATE_TEMPLATE', tpl.id,
      `Updated template '${tpl.name}'`
    );

    res.json({ success: true, message: 'Template updated successfully', data: tpl });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/admin/templates/:id/duplicate - Duplicate template
router.post('/admin/:id/duplicate', authMiddleware, requireRole(['admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    if (!db.templates) db.templates = [];

    const tpl = db.templates.find(t => t.id === req.params.id);
    if (!tpl) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    const dupTemplate: ServerTemplate = {
      ...tpl,
      id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${tpl.name} (Copy)`,
      sortOrder: db.templates.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.templates.push(dupTemplate);
    saveDbSync();

    await createAuditLog(
      req.user!.id, req.user!.email, req.user!.role,
      'ADMIN_DUPLICATE_TEMPLATE', dupTemplate.id,
      `Duplicated template '${tpl.name}' to '${dupTemplate.name}'`
    );

    res.json({ success: true, message: 'Template duplicated successfully', data: dupTemplate });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/admin/templates/:id - Delete template
router.delete('/admin/:id', authMiddleware, requireRole(['admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    if (!db.templates) db.templates = [];

    const idx = db.templates.findIndex(t => t.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    const deleted = db.templates.splice(idx, 1)[0];
    saveDbSync();

    await createAuditLog(
      req.user!.id, req.user!.email, req.user!.role,
      'ADMIN_DELETE_TEMPLATE', req.params.id,
      `Deleted template '${deleted.name}'`
    );

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
