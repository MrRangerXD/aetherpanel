import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import { ApiKey, WebhookSubscription } from '../../src/types';
import { deliverWebhook } from '../webhookService';

const router = Router();

// ==========================================
// API KEYS MANAGEMENT
// ==========================================

// GET /api/v1/api-keys - List current user's or admin's API keys
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;
  const isSuperAdmin = req.user!.role === 'super_admin' || req.user!.role === 'admin';

  let keys = db.apiKeys || [];
  if (!isSuperAdmin) {
    keys = keys.filter(k => k.userId === userId);
  }

  // Sanitize key hashes before returning
  const sanitized = keys.map(k => ({
    id: k.id,
    userId: k.userId,
    userEmail: k.userEmail,
    name: k.name,
    keyPrefix: k.keyPrefix,
    role: k.role,
    allowedIps: k.allowedIps,
    expiresAt: k.expiresAt,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt
  }));

  res.json({ success: true, data: sanitized });
});

// POST /api/v1/api-keys - Generate a new API key
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name, allowedIps, expiresInDays } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: { code: 'NAME_REQUIRED', message: 'API key name is required.' } });
  }

  const db = await getDb();
  const rawSecret = crypto.randomBytes(24).toString('hex');
  const fullApiKey = `aeth_live_${rawSecret}`;
  const keyPrefix = `aeth_live_${rawSecret.substring(0, 6)}...${rawSecret.substring(rawSecret.length - 4)}`;
  const keyHash = crypto.createHash('sha256').update(fullApiKey).digest('hex');

  let expiresAt: string | undefined = undefined;
  if (expiresInDays && Number(expiresInDays) > 0) {
    expiresAt = new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString();
  }

  const newKey: ApiKey = {
    id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    userId: req.user!.id,
    userEmail: req.user!.email,
    name: name.trim(),
    keyPrefix,
    keyHash,
    role: req.user!.role,
    allowedIps: Array.isArray(allowedIps) ? allowedIps.filter(Boolean) : undefined,
    expiresAt,
    createdAt: new Date().toISOString()
  };

  if (!db.apiKeys) db.apiKeys = [];
  db.apiKeys.push(newKey);
  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'CREATE_API_KEY', newKey.id,
    `Created API key token '${newKey.name}'`
  );

  // Return the full key ONCE for user copying
  res.json({
    success: true,
    message: 'API Key generated successfully. Copy your key now as it will not be shown again.',
    data: {
      ...newKey,
      apiKey: fullApiKey
    }
  });
});

// DELETE /api/v1/api-keys/:id - Revoke an API key
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const idx = (db.apiKeys || []).findIndex(k => k.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API key not found.' } });
  }

  const key = db.apiKeys[idx];
  if (key.userId !== req.user!.id && req.user!.role !== 'super_admin' && req.user!.role !== 'admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized to delete this key.' } });
  }

  db.apiKeys.splice(idx, 1);
  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'DELETE_API_KEY', key.id,
    `Revoked API key '${key.name}' (${key.keyPrefix})`
  );

  res.json({ success: true, message: `API Key '${key.name}' revoked successfully.` });
});

// ==========================================
// WEBHOOKS MANAGEMENT
// ==========================================

// GET /api/v1/api-keys/webhooks - List webhooks
router.get('/webhooks/list', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;
  const isSuperAdmin = req.user!.role === 'super_admin' || req.user!.role === 'admin';

  let hooks = db.webhooks || [];
  if (!isSuperAdmin) {
    hooks = hooks.filter(w => w.userId === userId);
  }

  res.json({ success: true, data: hooks });
});

// POST /api/v1/api-keys/webhooks - Create webhook
router.post('/webhooks/create', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name, url, events, secret } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: { code: 'NAME_REQUIRED', message: 'Webhook name is required.' } });
  }
  if (!url || !url.trim() || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'Valid HTTP/HTTPS endpoint URL is required.' } });
  }

  const db = await getDb();
  const webhookSecret = secret && secret.trim() ? secret.trim() : `whsec_${crypto.randomBytes(16).toString('hex')}`;
  const validEvents = Array.isArray(events) && events.length > 0 ? events : ['*'];

  const newWebhook: WebhookSubscription = {
    id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    userId: req.user!.id,
    name: name.trim(),
    url: url.trim(),
    secret: webhookSecret,
    events: validEvents,
    isEnabled: true,
    createdAt: new Date().toISOString()
  };

  if (!db.webhooks) db.webhooks = [];
  db.webhooks.push(newWebhook);
  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'CREATE_WEBHOOK', newWebhook.id,
    `Registered webhook '${newWebhook.name}' targeting ${newWebhook.url}`
  );

  res.json({
    success: true,
    message: 'Webhook subscription created successfully.',
    data: newWebhook
  });
});

// POST /api/v1/api-keys/webhooks/:id/test - Test trigger webhook
router.post('/webhooks/:id/test', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const webhook = (db.webhooks || []).find(w => w.id === req.params.id);
  if (!webhook) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found.' } });
  }

  const testPayload = JSON.stringify({
    event: 'test.ping',
    timestamp: new Date().toISOString(),
    data: {
      message: 'AetherPanel Webhook Test Ping',
      triggeredBy: req.user!.email,
      panelVersion: '3.4.0-production'
    }
  });

  const result = await deliverWebhook(webhook, testPayload, 'test.ping');
  res.json({
    success: result.success,
    data: {
      statusCode: result.statusCode,
      error: result.error
    },
    message: result.success ? 'Test ping delivered successfully!' : `Test delivery failed: ${result.error || 'Check endpoint'}`
  });
});

// PATCH /api/v1/api-keys/webhooks/:id/toggle - Enable / disable webhook
router.patch('/webhooks/:id/toggle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const webhook = (db.webhooks || []).find(w => w.id === req.params.id);
  if (!webhook) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found.' } });
  }

  webhook.isEnabled = !webhook.isEnabled;
  saveDbSync();

  res.json({
    success: true,
    data: webhook,
    message: `Webhook '${webhook.name}' is now ${webhook.isEnabled ? 'active' : 'disabled'}.`
  });
});

// DELETE /api/v1/api-keys/webhooks/:id - Delete webhook
router.delete('/webhooks/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const idx = (db.webhooks || []).findIndex(w => w.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found.' } });
  }

  const webhook = db.webhooks[idx];
  db.webhooks.splice(idx, 1);
  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'DELETE_WEBHOOK', webhook.id,
    `Deleted webhook '${webhook.name}'`
  );

  res.json({ success: true, message: `Webhook '${webhook.name}' deleted successfully.` });
});

export default router;
