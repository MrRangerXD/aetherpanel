import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { getDb, saveDbSync } from './db';
import { WebhookSubscription } from '../src/types';

export interface WebhookEventPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Dispatch an event to all matching, enabled webhooks
 */
export async function dispatchWebhookEvent(
  event: string,
  data: Record<string, any>,
  targetUserId?: string
): Promise<void> {
  try {
    const db = await getDb();
    if (!db.webhooks || db.webhooks.length === 0) return;

    const payload: WebhookEventPayload = {
      event,
      timestamp: new Date().toISOString(),
      data
    };

    const payloadString = JSON.stringify(payload);

    // Filter webhooks listening to this event or '*' (wildcard)
    const matchingWebhooks = db.webhooks.filter(wh => {
      if (!wh.isEnabled) return false;
      if (targetUserId && wh.userId !== targetUserId && wh.userId !== 'usr_admin') return false;
      return wh.events.includes('*') || wh.events.includes(event);
    });

    for (const wh of matchingWebhooks) {
      deliverWebhook(wh, payloadString, event).catch(err => {
        console.warn(`[Webhooks] Delivery failed for hook '${wh.name}' (${wh.id}):`, err.message);
      });
    }
  } catch (err: any) {
    console.error('[Webhooks] Dispatch error:', err);
  }
}

/**
 * Deliver a webhook with HMAC SHA-256 signature
 */
export async function deliverWebhook(
  webhook: WebhookSubscription,
  payloadString: string,
  event: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      const url = new URL(webhook.url);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      // Compute HMAC-SHA256 signature using the webhook secret
      const signature = crypto
        .createHmac('sha256', webhook.secret || 'aether_default_secret')
        .update(payloadString)
        .digest('hex');

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + (url.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadString),
          'User-Agent': 'AetherPanel-Webhook-Delivery/1.0',
          'X-Aether-Event': event,
          'X-Aether-Signature-256': `sha256=${signature}`,
          'X-Aether-Delivery': `del_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        },
        timeout: 10000 // 10s timeout
      };

      const req = client.request(options, (res) => {
        let resData = '';
        res.on('data', chunk => { resData += chunk; });
        res.on('end', () => {
          const isSuccess = (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300;
          webhook.lastTriggeredAt = new Date().toISOString();
          webhook.lastStatus = res.statusCode;
          webhook.lastError = isSuccess ? undefined : `HTTP Status ${res.statusCode}: ${resData.slice(0, 200)}`;
          saveDbSync();
          resolve({ success: isSuccess, statusCode: res.statusCode });
        });
      });

      req.on('error', (err) => {
        webhook.lastTriggeredAt = new Date().toISOString();
        webhook.lastStatus = 0;
        webhook.lastError = err.message;
        saveDbSync();
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        webhook.lastTriggeredAt = new Date().toISOString();
        webhook.lastStatus = 408;
        webhook.lastError = 'Request timed out after 10000ms';
        saveDbSync();
        resolve({ success: false, error: 'Request timeout' });
      });

      req.write(payloadString);
      req.end();
    } catch (err: any) {
      webhook.lastTriggeredAt = new Date().toISOString();
      webhook.lastError = err.message;
      saveDbSync();
      resolve({ success: false, error: err.message });
    }
  });
}
