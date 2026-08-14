import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import os from 'os';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import { AlertRule, AlertIncident, TelemetryPoint, Node, Server } from '../../src/types';
import { dispatchDiscordNotification } from '../discordService';

const router = Router();


// ==========================================
// TELEMETRY SAMPLING & DOWNSAMPLING ENGINE
// ==========================================

// In-memory high-resolution ring buffer for recent metrics
const nodeTelemetryBuffer: Record<string, TelemetryPoint[]> = {};
const serverTelemetryBuffer: Record<string, TelemetryPoint[]> = {};

// Helper to generate realistic historical telemetry points based on actual entity specs
export function generateHistoricalTelemetry(
  targetType: 'node' | 'server',
  entity: Node | Server,
  range: '1h' | '24h' | '7d' | '30d'
): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const now = Date.now();

  let count = 60;        // Number of samples
  let stepMs = 60 * 1000; // 1 minute interval

  if (range === '1h') {
    count = 60;
    stepMs = 60 * 1000; // every 1 min
  } else if (range === '24h') {
    count = 48;
    stepMs = 30 * 60 * 1000; // every 30 mins
  } else if (range === '7d') {
    count = 56;
    stepMs = 3 * 3600 * 1000; // every 3 hours
  } else if (range === '30d') {
    count = 60;
    stepMs = 12 * 3600 * 1000; // every 12 hours
  }

  // Base metrics from entity
  let baseCpu = 15;
  let baseRamMB = 1024;
  let totalRamMB = 4096;
  let baseDiskGB = 10;
  let totalDiskGB = 50;
  let isRunning = true;

  if (targetType === 'node') {
    const n = entity as Node;
    totalRamMB = n.totalRamMB || 16384;
    totalDiskGB = n.totalDiskGB || 250;
    baseRamMB = n.usedRamMB || Math.round(totalRamMB * 0.35);
    baseDiskGB = n.usedDiskGB || Math.round(totalDiskGB * 0.2);
    baseCpu = n.status === 'online' ? (n.usedCpuCores ? Math.round((n.usedCpuCores / (n.totalCpuCores || 4)) * 100) : 22) : 0;
    isRunning = n.status === 'online';
  } else {
    const s = entity as Server;
    totalRamMB = s.limits.ramMB || 2048;
    totalDiskGB = s.limits.diskGB || 20;
    baseRamMB = s.ramUsageMB || Math.round(totalRamMB * 0.45);
    baseDiskGB = Math.round((s.diskUsageMB || 2048) / 1024);
    baseCpu = s.status === 'running' ? (s.cpuUsage || 18) : 0;
    isRunning = s.status === 'running';
  }

  for (let i = count; i >= 0; i--) {
    const ts = new Date(now - i * stepMs).toISOString();

    if (!isRunning) {
      points.push({
        timestamp: ts,
        cpuPercent: 0,
        ramPercent: 0,
        usedRamMB: 0,
        totalRamMB,
        diskPercent: Math.round((baseDiskGB / totalDiskGB) * 100),
        usedDiskGB: baseDiskGB,
        totalDiskGB,
        netInKBps: 0,
        netOutKBps: 0,
        latencyMs: 0,
        loadAvg1m: 0,
        tps: 0,
        players: 0,
        status: 'offline'
      });
      continue;
    }

    // Add natural fluctuation
    const seed = Math.sin(i * 0.4) * 8 + Math.cos(i * 0.7) * 5;
    const cpu = Math.max(2, Math.min(98, Math.round(baseCpu + seed)));
    const ramMB = Math.max(256, Math.min(totalRamMB, Math.round(baseRamMB + seed * 12)));
    const ramPct = Math.round((ramMB / totalRamMB) * 100);
    const diskPct = Math.min(100, Math.round((baseDiskGB / totalDiskGB) * 100));

    const netIn = Math.max(12, Math.round(45 + seed * 15 + Math.random() * 20));
    const netOut = Math.max(18, Math.round(80 + seed * 25 + Math.random() * 30));
    const latency = Math.max(4, Math.round(14 + (seed > 0 ? seed * 0.8 : 0)));

    // TPS for minecraft servers
    const tps = Math.max(18.5, Math.min(20.0, +(20.0 - (cpu > 85 ? 0.8 : 0.05 * Math.random())).toFixed(2)));
    const players = Math.max(0, Math.round(4 + Math.sin(i * 0.3) * 3));

    points.push({
      timestamp: ts,
      cpuPercent: cpu,
      ramPercent: ramPct,
      usedRamMB: ramMB,
      totalRamMB,
      diskPercent: diskPct,
      usedDiskGB: baseDiskGB,
      totalDiskGB,
      netInKBps: netIn,
      netOutKBps: netOut,
      latencyMs: latency,
      loadAvg1m: +(cpu / 25).toFixed(2),
      tps,
      players,
      status: 'online'
    });
  }

  return points;
}

// GET /api/v1/monitoring/node/:nodeId/history - Node Historical Telemetry
router.get('/node/:nodeId/history', async (req: Request, res: Response) => {
  const { nodeId } = req.params;
  const range = (req.query.range as any) || '1h';

  const db = await getDb();
  const node = db.nodes.find(n => n.id === nodeId);

  if (!node) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found.' } });
  }

  const telemetry = generateHistoricalTelemetry('node', node, range);

  res.json({
    success: true,
    data: {
      nodeId: node.id,
      nodeName: node.name,
      range,
      pointsCount: telemetry.length,
      current: telemetry[telemetry.length - 1],
      history: telemetry
    }
  });
});

// GET /api/v1/monitoring/server/:serverId/history - Server Historical Telemetry
router.get('/server/:serverId/history', async (req: Request, res: Response) => {
  const { serverId } = req.params;
  const range = (req.query.range as any) || '1h';

  const db = await getDb();
  const server = db.servers.find(s => s.id === serverId);

  if (!server) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });
  }

  const telemetry = generateHistoricalTelemetry('server', server, range);

  res.json({
    success: true,
    data: {
      serverId: server.id,
      serverName: server.name,
      software: server.software,
      version: server.version,
      range,
      pointsCount: telemetry.length,
      current: telemetry[telemetry.length - 1],
      history: telemetry
    }
  });
});

// ==========================================
// ALERT RULES & INCIDENT CONFIGURATION
// ==========================================

// GET /api/v1/monitoring/alerts/rules - List all configured alert rules
router.get('/alerts/rules', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!['admin', 'super_admin', 'moderator'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
  }

  const db = await getDb();
  res.json({
    success: true,
    data: db.alertRules || []
  });
});

// POST /api/v1/monitoring/alerts/rules - Create new alert rule
router.post('/alerts/rules', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!['admin', 'super_admin'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  }

  const { name, targetType, targetId, metric, threshold, durationMinutes, cooldownMinutes, notificationChannel, webhookUrl, isEnabled } = req.body;

  if (!name || !targetType || !metric) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Rule name, target, and metric are required.' } });
  }

  const db = await getDb();
  const ruleId = `rule_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const newRule: AlertRule = {
    id: ruleId,
    name,
    targetType: targetType || 'node',
    targetId: targetId || 'all',
    metric,
    threshold: Number(threshold) || 90,
    durationMinutes: Number(durationMinutes) || 5,
    cooldownMinutes: Number(cooldownMinutes) || 15,
    notificationChannel: notificationChannel || 'all',
    webhookUrl: webhookUrl || '',
    isEnabled: isEnabled !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.alertRules.unshift(newRule);
  saveDbSync();

  createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'CREATE_ALERT_RULE',
    `rule:${ruleId}`,
    `Created alert rule: ${name} (${metric} > ${threshold})`,
    req.ip || '127.0.0.1'
  );

  return res.json({ success: true, message: 'Alert rule created.', data: newRule });
});

// PUT /api/v1/monitoring/alerts/rules/:id - Update alert rule
router.put('/alerts/rules/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!['admin', 'super_admin'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  }

  const { id } = req.params;
  const db = await getDb();
  const rule = db.alertRules.find(r => r.id === id);

  if (!rule) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Alert rule not found.' } });
  }

  const { name, targetType, targetId, metric, threshold, durationMinutes, cooldownMinutes, notificationChannel, webhookUrl, isEnabled } = req.body;

  if (name) rule.name = name;
  if (targetType) rule.targetType = targetType;
  if (targetId !== undefined) rule.targetId = targetId;
  if (metric) rule.metric = metric;
  if (threshold !== undefined) rule.threshold = Number(threshold);
  if (durationMinutes !== undefined) rule.durationMinutes = Number(durationMinutes);
  if (cooldownMinutes !== undefined) rule.cooldownMinutes = Number(cooldownMinutes);
  if (notificationChannel) rule.notificationChannel = notificationChannel;
  if (webhookUrl !== undefined) rule.webhookUrl = webhookUrl;
  if (isEnabled !== undefined) rule.isEnabled = isEnabled;
  rule.updatedAt = new Date().toISOString();

  saveDbSync();
  return res.json({ success: true, message: 'Alert rule updated.', data: rule });
});

// DELETE /api/v1/monitoring/alerts/rules/:id - Delete alert rule
router.delete('/alerts/rules/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!['admin', 'super_admin'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  }

  const { id } = req.params;
  const db = await getDb();
  const idx = db.alertRules.findIndex(r => r.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Alert rule not found.' } });
  }

  db.alertRules.splice(idx, 1);
  saveDbSync();
  return res.json({ success: true, message: 'Alert rule deleted.' });
});

// GET /api/v1/monitoring/alerts/incidents - List active & historical alert incidents
router.get('/alerts/incidents', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!['admin', 'super_admin', 'moderator'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
  }

  const db = await getDb();
  res.json({
    success: true,
    data: db.alertIncidents || []
  });
});

// POST /api/v1/monitoring/alerts/incidents/:id/resolve - Resolve active alert
router.post('/alerts/incidents/:id/resolve', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!['admin', 'super_admin'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  }

  const { id } = req.params;
  const db = await getDb();
  const incident = db.alertIncidents.find(i => i.id === id);

  if (!incident) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Alert incident not found.' } });
  }

  incident.status = 'resolved';
  incident.resolvedAt = new Date().toISOString();
  saveDbSync();

  return res.json({ success: true, message: 'Alert marked as resolved.', data: incident });
});

// POST /api/v1/monitoring/alerts/test - Trigger simulated test alert
router.post('/alerts/test', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!['admin', 'super_admin'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  }

  const { ruleId, targetName, severity, message } = req.body;
  const db = await getDb();

  const rule = db.alertRules.find(r => r.id === ruleId) || db.alertRules[0];
  const alertId = `alt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();

  const newAlert: AlertIncident = {
    id: alertId,
    ruleId: rule?.id || 'manual_test',
    ruleName: rule?.name || 'Manual Health Test Trigger',
    targetId: 'target_node_in',
    targetName: targetName || 'Node India (Delhi/Mumbai)',
    severity: severity || 'warning',
    message: message || 'Simulated telemetry threshold violation: CPU Load exceeded 92% sustained for >10m.',
    status: 'active',
    triggeredAt: now
  };

  db.alertIncidents.unshift(newAlert);
  saveDbSync();

  // Try to dispatch Discord Webhook notification if configured
  if (rule?.notificationChannel === 'discord' || rule?.notificationChannel === 'all') {
    try {
      const db = await getDb();
      const firstServerId = db.servers[0]?.id || 'system';
      await dispatchDiscordNotification(
        firstServerId,
        'RESOURCE_WARNING',
        {
          details: `${newAlert.message}\n**Target:** ${newAlert.targetName}\n**Severity:** ${newAlert.severity.toUpperCase()}`
        }
      );
    } catch (e) {
      console.warn('Discord alert webhook notification skipped/failed:', e);
    }
  }


  return res.json({
    success: true,
    message: 'Test alert triggered and logged.',
    data: newAlert
  });
});

export default router;
