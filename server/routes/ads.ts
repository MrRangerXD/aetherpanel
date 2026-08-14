import { Router } from 'express';
import { getDb, saveDb } from '../db';
import { authenticateUser, requireAdmin } from '../auth';
import { AdItem, AdEvent } from '../../src/types';

const router = Router();

// GET /api/v1/ads?placement=dashboard - Get active ads for placement
router.get('/', async (req, res) => {
  try {
    const placement = (req.query.placement as string) || 'dashboard';
    const db = await getDb();
    const now = new Date();

    const activeAds = (db.ads || []).filter(ad => {
      if (!ad.isActive) return false;
      if (ad.placement !== placement && ad.placement !== 'dashboard') return false;

      if (ad.startDate && new Date(ad.startDate) > now) return false;
      if (ad.endDate && new Date(ad.endDate) < now) return false;

      return true;
    }).sort((a, b) => b.priority - a.priority);

    res.json({ success: true, ads: activeAds });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to fetch ads.' } });
  }
});

// POST /api/v1/ads/:id/impression - Record ad impression
router.post('/:id/impression', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const ad = (db.ads || []).find(a => a.id === id);

    if (ad) {
      ad.impressions = (ad.impressions || 0) + 1;
      db.adEvents = db.adEvents || [];
      db.adEvents.push({
        id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        adId: id,
        type: 'impression',
        timestamp: new Date().toISOString()
      });
      await saveDb();
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Impression recording error.' } });
  }
});

// POST /api/v1/ads/:id/click - Record ad click
router.post('/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const ad = (db.ads || []).find(a => a.id === id);

    if (ad) {
      ad.clicks = (ad.clicks || 0) + 1;
      db.adEvents = db.adEvents || [];
      db.adEvents.push({
        id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        adId: id,
        type: 'click',
        timestamp: new Date().toISOString()
      });
      await saveDb();
    }

    res.json({ success: true, destinationUrl: ad?.destinationUrl || '#' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Click recording error.' } });
  }
});

// ADMIN ROUTES

// GET /api/v1/admin/ads - List all ads with metrics
router.get('/admin/list', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    res.json({ success: true, ads: db.ads || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Failed to list admin ads.' } });
  }
});

// POST /api/v1/admin/ads - Create ad
router.post('/admin/create', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { title, description, imageUrl, destinationUrl, type, placement, priority, frequencyCapPerSession, startDate, endDate } = req.body;

    if (!title || !destinationUrl) {
      return res.status(400).json({ success: false, error: { message: 'Title and Destination URL are required.' } });
    }

    const db = await getDb();
    const newAd: AdItem = {
      id: `ad_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      description: description || '',
      imageUrl: imageUrl || '',
      destinationUrl,
      type: type || 'banner',
      placement: placement || 'dashboard',
      priority: Number(priority) || 5,
      frequencyCapPerSession: Number(frequencyCapPerSession) || 5,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      isActive: true,
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString()
    };

    db.ads = db.ads || [];
    db.ads.push(newAd);
    await saveDb();

    res.json({ success: true, ad: newAd });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to create ad.' } });
  }
});

// PUT /api/v1/admin/ads/:id - Update ad
router.put('/admin/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const ad = (db.ads || []).find(a => a.id === id);

    if (!ad) {
      return res.status(404).json({ success: false, error: { message: 'Ad not found.' } });
    }

    Object.assign(ad, req.body);
    await saveDb();

    res.json({ success: true, ad });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Failed to update ad.' } });
  }
});

// DELETE /api/v1/admin/ads/:id - Delete ad
router.delete('/admin/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    db.ads = (db.ads || []).filter(a => a.id !== id);
    await saveDb();

    res.json({ success: true, message: 'Ad deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Failed to delete ad.' } });
  }
});

export default router;
