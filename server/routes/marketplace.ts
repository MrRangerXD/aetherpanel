import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import { MarketplaceItem, MarketplaceReview, MarketplaceStatus } from '../../src/types';

const router = Router();

// GET /api/v1/marketplace - Search & filter marketplace items
router.get('/', async (req, res: Response) => {
  try {
    const db = await getDb();
    const { category, search, badge, sort, status, featured } = req.query;

    let items = db.marketplaceItems || [];

    // Filter by status (default to active for general requests, unless status param specified)
    const reqStatus = (status as string) || 'active';
    if (reqStatus !== 'all') {
      items = items.filter(i => i.status === reqStatus);
    }

    // Category filter
    if (category && category !== 'all') {
      items = items.filter(i => i.category === category);
    }

    // Badge filter (official, verified, community)
    if (badge && badge !== 'all') {
      items = items.filter(i => i.badge === badge);
    }

    // Featured filter
    if (featured === 'true') {
      items = items.filter(i => i.isFeatured);
    }

    // Search query
    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.author.toLowerCase().includes(q) ||
        i.compatibility.toLowerCase().includes(q)
      );
    }

    // Sorting
    items = [...items].sort((a, b) => {
      if (sort === 'popular') {
        return b.downloadsCount - a.downloadsCount;
      }
      if (sort === 'rating') {
        return b.rating - a.rating;
      }
      if (sort === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // Default: Featured first, then newest
      if (a.isFeatured !== b.isFeatured) {
        return a.isFeatured ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Counts by category
    const allActive = (db.marketplaceItems || []).filter(i => i.status === 'active');
    const categoryCounts = {
      all: allActive.length,
      minecraft: allActive.filter(i => i.category === 'minecraft').length,
      bot: allActive.filter(i => i.category === 'bot').length,
      template: allActive.filter(i => i.category === 'template').length,
      tool: allActive.filter(i => i.category === 'tool').length,
      utility: allActive.filter(i => i.category === 'utility').length,
    };

    res.json({
      success: true,
      data: {
        items,
        total: items.length,
        categoryCounts
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to fetch marketplace items' }
    });
  }
});

// GET /api/v1/marketplace/:id - Get single marketplace item detail
router.get('/:id', async (req, res: Response) => {
  try {
    const db = await getDb();
    const item = (db.marketplaceItems || []).find(i => i.id === req.params.id || i.slug === req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Marketplace item not found.' }
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to fetch marketplace item.' }
    });
  }
});

// POST /api/v1/marketplace/submit - Community or Admin Item Submission
router.post('/submit', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name, description, longDescription, category, icon, author,
      version, compatibility, requirements, installType, startupCommand,
      environmentVars, installScript, configFiles
    } = req.body;

    if (!name || !description || !category || !installType) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, description, category, and install type are required.' }
      });
    }

    const db = await getDb();
    const user = req.user!;
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';

    // Content Safety Pre-check & Validation Policy
    const suspiciousKeywords = ['rm -rf /', 'curl -s | bash', ':(){ :|:& };:', 'chmod 777 /', 'eval(base64'];
    let securityValidated = true;
    let securityNotes = 'Passed automated static analysis scan.';
    const combinedScript = `${startupCommand || ''} ${installScript || ''} ${JSON.stringify(configFiles || [])}`;

    for (const kw of suspiciousKeywords) {
      if (combinedScript.includes(kw)) {
        securityValidated = false;
        securityNotes = `Flagged potential security hazard: contains pattern '${kw}'. Requires manual admin inspection.`;
        break;
      }
    }

    const newItem: MarketplaceItem = {
      id: `mkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name: name.trim(),
      description: description.trim(),
      longDescription: longDescription ? longDescription.trim() : description.trim(),
      category,
      icon: icon || (category === 'minecraft' ? 'Gamepad2' : category === 'bot' ? 'Bot' : 'Package'),
      author: author || user.displayName || user.username,
      authorId: user.id,
      badge: isAdmin ? 'official' : 'community',
      version: version || '1.0.0',
      changelog: 'Initial submission.',
      compatibility: compatibility || 'All Nodes & Runtimes',
      requirements: {
        minRamMB: requirements?.minRamMB || 1024,
        minCpuCores: requirements?.minCpuCores || 1,
        minDiskGB: requirements?.minDiskGB || 5,
        notes: requirements?.notes || ''
      },
      installType,
      startupCommand: startupCommand || '',
      environmentVars: environmentVars || {},
      installScript: installScript || '',
      configFiles: configFiles || [],

      // Strict Real Metrics Initial State
      downloadsCount: 0,
      rating: 0,
      reviewsCount: 0,
      reviews: [],

      // Status: Admins get auto-active if secure, regular users go to 'pending'
      status: isAdmin ? (securityValidated ? 'active' : 'pending') : 'pending',
      isFeatured: false,
      securityValidated,
      securityNotes,
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!db.marketplaceItems) db.marketplaceItems = [];
    db.marketplaceItems.unshift(newItem);

    await createAuditLog(
      user,
      'MARKETPLACE_SUBMISSION',
      `Marketplace item '${newItem.name}' submitted by ${user.username} (Status: ${newItem.status})`,
      req.ip || '127.0.0.1'
    );

    saveDbSync();

    res.status(201).json({
      success: true,
      data: newItem,
      message: isAdmin
        ? 'Marketplace item published successfully!'
        : 'Your marketplace submission has been queued for admin review and security validation.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to submit marketplace item.' }
    });
  }
});

// POST /api/v1/marketplace/:id/review - Real Rating & Review
router.post('/:id/review', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rating, comment } = req.body;
    const numRating = Number(rating);

    if (isNaN(numRating) || numRating < 1 || numRating > 5 || !comment || comment.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Rating must be a number between 1 and 5, and comment must be provided.' }
      });
    }

    const db = await getDb();
    const item = (db.marketplaceItems || []).find(i => i.id === req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Marketplace item not found.' }
      });
    }

    if (!item.reviews) item.reviews = [];

    const user = req.user!;

    // Check if user already reviewed
    const existingIdx = item.reviews.findIndex(r => r.userId === user.id);
    const newReview: MarketplaceReview = {
      id: `rev_${Date.now()}`,
      userId: user.id,
      userName: user.displayName || user.username,
      userAvatar: user.avatarUrl,
      rating: numRating,
      comment: comment.trim(),
      createdAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      item.reviews[existingIdx] = newReview;
    } else {
      item.reviews.unshift(newReview);
    }

    // Recalculate REAL AVERAGE RATING
    const totalScore = item.reviews.reduce((sum, r) => sum + r.rating, 0);
    item.reviewsCount = item.reviews.length;
    item.rating = Number((totalScore / item.reviewsCount).toFixed(1));
    item.updatedAt = new Date().toISOString();

    saveDbSync();

    res.json({
      success: true,
      data: item,
      message: 'Thank you! Your rating and review have been recorded.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to post review.' }
    });
  }
});

// POST /api/v1/marketplace/:id/deploy - One-Click Install / Deployment Counter
router.post('/:id/deploy', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const item = (db.marketplaceItems || []).find(i => i.id === req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Marketplace item not found.' }
      });
    }

    if (item.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: { code: 'ITEM_INACTIVE', message: 'This marketplace item is currently not active or pending approval.' }
      });
    }

    // Increment REAL DOWNLOAD / INSTALL COUNT
    item.downloadsCount = (item.downloadsCount || 0) + 1;
    item.updatedAt = new Date().toISOString();

    await createAuditLog(
      req.user!,
      'MARKETPLACE_DEPLOY',
      `User ${req.user!.username} deployed Marketplace Item '${item.name}' (Total deploys: ${item.downloadsCount})`,
      req.ip || '127.0.0.1'
    );

    saveDbSync();

    res.json({
      success: true,
      data: {
        item,
        downloadsCount: item.downloadsCount
      },
      message: `Marketplace item installation initiated.`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to record deploy.' }
    });
  }
});

// ADMIN ENDPOINTS

// PUT /api/v1/marketplace/:id - Admin Edit Item
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin permissions required.' }
      });
    }

    const db = await getDb();
    const itemIdx = (db.marketplaceItems || []).findIndex(i => i.id === req.params.id);

    if (itemIdx === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Marketplace item not found.' }
      });
    }

    const updated = {
      ...db.marketplaceItems[itemIdx],
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    db.marketplaceItems[itemIdx] = updated;

    await createAuditLog(
      req.user!,
      'MARKETPLACE_UPDATE',
      `Admin updated Marketplace Item '${updated.name}'`,
      req.ip || '127.0.0.1'
    );

    saveDbSync();

    res.json({
      success: true,
      data: updated
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to update marketplace item.' }
    });
  }
});

// PATCH /api/v1/marketplace/:id/status - Admin Approve / Reject / Archive
router.patch('/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin permissions required.' }
      });
    }

    const { status, rejectionReason, securityNotes, badge } = req.body;
    const db = await getDb();
    const item = (db.marketplaceItems || []).find(i => i.id === req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Marketplace item not found.' }
      });
    }

    item.status = status as MarketplaceStatus;
    if (rejectionReason) item.rejectionReason = rejectionReason;
    if (securityNotes) item.securityNotes = securityNotes;
    if (badge) item.badge = badge;
    if (status === 'active') {
      item.approvedAt = new Date().toISOString();
      item.securityValidated = true;
    }
    item.updatedAt = new Date().toISOString();

    await createAuditLog(
      req.user!,
      'MARKETPLACE_STATUS_CHANGE',
      `Admin changed status of Marketplace Item '${item.name}' to ${status}`,
      req.ip || '127.0.0.1'
    );

    saveDbSync();

    res.json({
      success: true,
      data: item,
      message: `Item status updated to '${status}'.`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to update item status.' }
    });
  }
});

// PATCH /api/v1/marketplace/:id/feature - Admin Toggle Feature
router.patch('/:id/feature', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin permissions required.' }
      });
    }

    const { isFeatured } = req.body;
    const db = await getDb();
    const item = (db.marketplaceItems || []).find(i => i.id === req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Marketplace item not found.' }
      });
    }

    item.isFeatured = Boolean(isFeatured);
    item.updatedAt = new Date().toISOString();

    saveDbSync();

    res.json({
      success: true,
      data: item,
      message: `Item featured status set to ${item.isFeatured}.`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to toggle feature state.' }
    });
  }
});

// DELETE /api/v1/marketplace/:id - Admin Delete Item
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin permissions required.' }
      });
    }

    const db = await getDb();
    const idx = (db.marketplaceItems || []).findIndex(i => i.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Marketplace item not found.' }
      });
    }

    const deleted = db.marketplaceItems.splice(idx, 1)[0];

    await createAuditLog(
      req.user!,
      'MARKETPLACE_DELETE',
      `Admin deleted Marketplace Item '${deleted.name}'`,
      req.ip || '127.0.0.1'
    );

    saveDbSync();

    res.json({
      success: true,
      message: 'Marketplace item deleted successfully.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to delete marketplace item.' }
    });
  }
});

export default router;
