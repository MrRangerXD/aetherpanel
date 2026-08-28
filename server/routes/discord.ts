import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import {
  dispatchDiscordNotification,
  executeDiscordCommand,
  buildDiscordEmbed,
  runDiscordAcceptanceTestSuite,
  getDiscordBotStatusDetails,
  restartDiscordBot,
  stopDiscordBot
} from '../discordService';
import {
  DiscordAccount,
  ServerDiscordLink,
  DiscordBotSettings,
  DiscordNotificationEvent
} from '../../src/types';
import { getDiscordOAuthRedirectUri } from '../oauthUrlResolver';

const router = Router();

// Helper to check server ownership or admin power
async function checkServerAccess(req: AuthenticatedRequest, res: Response, serverId: string, requiredPermission?: string) {
  const db = await getDb();
  const server = db.servers.find(s => s.id === serverId);

  if (!server) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });
    return null;
  }

  const isOwner = server.userId === req.user!.id;
  const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user!.role);
  const subuser = db.subusers?.find(s => s.serverId === serverId && s.userId === req.user!.id);

  if (!isOwner && !isAdmin) {
    if (!subuser) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this server.' } });
      return null;
    }

    if (requiredPermission && !subuser.permissions.includes(requiredPermission)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `Required permission '${requiredPermission}' is missing.` } });
      return null;
    }
  }

  return { server, db, isOwner, isAdmin, subuser };
}

// GET /api/v1/discord/bot-status - Real-time Bot Gateway connection status
router.get('/bot-status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const statusDetails = await getDiscordBotStatusDetails();
  res.json({
    success: true,
    data: statusDetails
  });
});

// ==========================================
// USER LEVEL DISCORD INTEGRATION ENDPOINTS
// ==========================================

// GET /api/v1/discord/user - Get connected Discord account
router.get('/user', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;
  let discordAccount = db.discordLinks ? db.discordLinks[userId] : null;

  // Fallback: If not in discordLinks map but user has a discordId, hydrate and persist it
  if (!discordAccount) {
    const userRecord = db.users.find(u => u.id === userId);
    if (userRecord && userRecord.discordId) {
      if (!db.discordLinks) db.discordLinks = {};
      discordAccount = {
        discordId: userRecord.discordId,
        username: userRecord.username || userRecord.displayName,
        globalName: userRecord.displayName || userRecord.username,
        avatar: userRecord.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${userRecord.username}`,
        email: userRecord.email,
        linkedAt: userRecord.updatedAt || userRecord.createdAt || new Date().toISOString()
      };
      db.discordLinks[userId] = discordAccount;
      saveDbSync();
    }
  }

  res.json({
    success: true,
    data: discordAccount || null
  });
});

// POST /api/v1/discord/user/connect - Connect or OAuth link Discord account
router.post('/user/connect', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;
  const user = req.user!;

  const { discordId, username, globalName, avatar, email } = req.body;

  if (!discordId || !discordId.trim() || !username || !username.trim()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'DISCORD_OAUTH_REQUIRED',
        message: 'Valid Discord ID and username from real Discord OAuth2 authorization are required.'
      }
    });
  }

  const cleanDiscordId = discordId.trim();
  const cleanUsername = username.trim();

  // Unlink from other accounts if present
  db.users.forEach(u => {
    if (u.id !== userId && u.discordId === cleanDiscordId) {
      delete u.discordId;
      u.updatedAt = new Date().toISOString();
      if (db.discordLinks && db.discordLinks[u.id]) {
        delete db.discordLinks[u.id];
      }
    }
  });

  const userRecord = db.users.find(u => u.id === userId);
  if (userRecord) {
    userRecord.discordId = cleanDiscordId;
    userRecord.updatedAt = new Date().toISOString();
  }

  if (!db.discordLinks) db.discordLinks = {};

  const discordAccount: DiscordAccount = {
    discordId: cleanDiscordId,
    username: cleanUsername,
    globalName: globalName || cleanUsername,
    avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    email: email || user.email,
    linkedAt: new Date().toISOString()
  };

  db.discordLinks[userId] = discordAccount;
  saveDbSync();

  await createAuditLog(
    user.id,
    user.email,
    user.role,
    'DISCORD_ACCOUNT_LINKED',
    'DISCORD',
    `Linked Discord account ${cleanUsername} (${cleanDiscordId})`
  );

  res.json({
    success: true,
    message: `Discord account ${cleanUsername} connected successfully.`,
    data: discordAccount
  });
});

// DELETE /api/v1/discord/user/disconnect - Unlink Discord account
router.delete('/user/disconnect', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;

  const userRecord = db.users.find(u => u.id === userId);
  if (userRecord && userRecord.discordId) {
    delete userRecord.discordId;
    userRecord.updatedAt = new Date().toISOString();
  }

  if (db.discordLinks && db.discordLinks[userId]) {
    const prev = db.discordLinks[userId];
    delete db.discordLinks[userId];
    saveDbSync();

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'DISCORD_ACCOUNT_UNLINKED',
      'DISCORD',
      `Unlinked Discord account ${prev.username}`
    );
  } else {
    saveDbSync();
  }

  res.json({ success: true, message: 'Discord account disconnected.' });
});

// ==========================================
// SERVER LEVEL DISCORD NOTIFICATION & LINK
// ==========================================

// GET /api/v1/discord/server/:serverId - Get server discord link configuration
router.get('/server/:serverId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.serverId);
  if (!access) return;

  const { server, db } = access;
  const link = db.serverDiscordLinks?.find(l => l.serverId === server.id);

  const defaultLink: ServerDiscordLink = {
    serverId: server.id,
    enabled: true,
    webhookUrl: '',
    channelName: '#server-alerts',
    enabledEvents: [
      'SERVER_STARTED',
      'SERVER_STOPPED',
      'SERVER_CRASHED',
      'SERVER_RESTARTED',
      'BACKUP_COMPLETED',
      'BACKUP_FAILED',
      'RESOURCE_WARNING'
    ],
    mentionRoleId: '',
    mentionUserId: '',
    cooldownSeconds: 60,
    allowServerCommands: true,
    updatedAt: new Date().toISOString()
  };

  res.json({
    success: true,
    data: link || defaultLink
  });
});

// PUT /api/v1/discord/server/:serverId - Save server discord link configuration
router.put('/server/:serverId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.serverId);
  if (!access) return;

  const { server, db } = access;
  const {
    enabled,
    webhookUrl,
    channelName,
    enabledEvents,
    mentionRoleId,
    mentionUserId,
    cooldownSeconds,
    allowServerCommands
  } = req.body;

  if (webhookUrl && webhookUrl.trim()) {
    const cleanUrl = webhookUrl.trim();
    if (!cleanUrl.startsWith('https://discord.com/api/webhooks/') && !cleanUrl.startsWith('https://discordapp.com/api/webhooks/')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_WEBHOOK_URL', message: 'Discord Webhook URL must start with https://discord.com/api/webhooks/' }
      });
    }
  }

  if (!db.serverDiscordLinks) db.serverDiscordLinks = [];

  let link = db.serverDiscordLinks.find(l => l.serverId === server.id);

  if (!link) {
    link = {
      serverId: server.id,
      enabled: enabled !== false,
      webhookUrl: webhookUrl || '',
      channelName: channelName || '#server-alerts',
      enabledEvents: enabledEvents || [],
      mentionRoleId: mentionRoleId || '',
      mentionUserId: mentionUserId || '',
      cooldownSeconds: cooldownSeconds || 60,
      allowServerCommands: allowServerCommands !== false,
      updatedAt: new Date().toISOString()
    };
    db.serverDiscordLinks.push(link);
  } else {
    link.enabled = enabled;
    link.webhookUrl = webhookUrl;
    link.channelName = channelName;
    link.enabledEvents = enabledEvents;
    link.mentionRoleId = mentionRoleId;
    link.mentionUserId = mentionUserId;
    link.cooldownSeconds = cooldownSeconds;
    link.allowServerCommands = allowServerCommands;
    link.updatedAt = new Date().toISOString();
  }

  saveDbSync();

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'DISCORD_SERVER_LINK_UPDATE',
    'DISCORD',
    `Updated Discord integration settings for server ${server.name}`
  );

  res.json({
    success: true,
    message: 'Discord server integration settings saved.',
    data: link
  });
});

// POST /api/v1/discord/server/:serverId/test-webhook - Dispatch test Discord embed
router.post('/server/:serverId/test-webhook', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.serverId);
  if (!access) return;

  const { server } = access;
  const eventType: DiscordNotificationEvent = req.body.event || 'SERVER_STARTED';

  const result = await dispatchDiscordNotification(server.id, eventType, {
    message: `Test notification dispatched from AetherPanel for server '${server.name}'.`,
    details: 'Verification testing for Discord webhook integration and rich embed formatting.'
  });

  res.json({
    success: result.success,
    message: result.message
  });
});

// ==========================================
// DISCORD BOT COMMAND EXECUTION
// ==========================================

// POST /api/v1/discord/command - Execute interactive Discord command
router.post('/command', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;
  const userDiscordAccount = db.discordLinks ? db.discordLinks[userId] : null;

  const discordUserId = req.body.discordUserId || userDiscordAccount?.discordId;
  
  if (!discordUserId) {
    return res.status(400).json({ success: false, message: 'Your Discord account is not linked to AetherPanel. Link your Discord account in Profile Settings.' });
  }
  const commandStr = req.body.command || '/server status';
  const serverId = req.body.serverId;

  const result = await executeDiscordCommand(discordUserId, commandStr, serverId);

  res.json({
    success: result.success,
    message: result.message,
    data: {
      embed: result.embed
    }
  });
});

// ==========================================
// ADMIN LEVEL DISCORD CONTROLS
// ==========================================

// GET /api/v1/discord/admin/settings - Get global Discord bot settings with masked credentials
router.get('/admin/settings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const defaultDiscordSettings: DiscordBotSettings = {
    enabled: false,
    botToken: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    defaultWebhookUrl: '',
    botStatus: 'offline',
    commandRateLimitPerMin: 10,
    defaultNotificationEvents: []
  };

  const settings = db.settings?.discordSettings || defaultDiscordSettings;
  const botTokenMasked = settings.botToken ? `••••••••${settings.botToken.slice(-4)}` : '';
  const clientSecretMasked = settings.clientSecret ? `••••••••${settings.clientSecret.slice(-4)}` : '';
  const dynamicRedirectUri = getDiscordOAuthRedirectUri(req, db.settings);

  res.json({
    success: true,
    data: {
      ...settings,
      redirectUri: dynamicRedirectUri,
      botToken: botTokenMasked,
      clientSecret: clientSecretMasked,
      botTokenConfigured: !!settings.botToken,
      clientSecretConfigured: !!settings.clientSecret,
      botTokenMasked,
      clientSecretMasked
    }
  });
});

// PUT /api/v1/discord/admin/settings - Save global Discord bot settings
router.put('/admin/settings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const currentSettings = (db.settings.discordSettings || {}) as any;
  
  let newBotToken = req.body.botToken;
  if (!newBotToken || newBotToken.startsWith('••••')) {
    newBotToken = currentSettings.botToken || '';
  }

  let newClientSecret = req.body.clientSecret;
  if (!newClientSecret || newClientSecret.startsWith('••••')) {
    newClientSecret = currentSettings.clientSecret || '';
  }

  db.settings.discordSettings = {
    ...currentSettings,
    ...req.body,
    botToken: newBotToken,
    clientSecret: newClientSecret
  };
  saveDbSync();

  // Trigger bot reconnect if enabled
  if (db.settings.discordSettings.enabled && db.settings.discordSettings.botToken) {
    restartDiscordBot().catch(() => {});
  } else if (!db.settings.discordSettings.enabled) {
    stopDiscordBot().catch(() => {});
  }

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'ADMIN_UPDATE_DISCORD_SETTINGS',
    'DISCORD',
    'Updated global Discord bot and OAuth settings'
  );

  const updatedMasked = {
    ...db.settings.discordSettings,
    botToken: db.settings.discordSettings.botToken ? `••••••••${db.settings.discordSettings.botToken.slice(-4)}` : '',
    clientSecret: db.settings.discordSettings.clientSecret ? `••••••••${db.settings.discordSettings.clientSecret.slice(-4)}` : '',
    botTokenConfigured: !!db.settings.discordSettings.botToken,
    clientSecretConfigured: !!db.settings.discordSettings.clientSecret
  };

  res.json({
    success: true,
    message: 'Global Discord integration settings updated.',
    data: updatedMasked
  });
});

// POST /api/v1/discord/admin/bot-restart - Force restart Bot Gateway Client
router.post('/admin/bot-restart', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const details = await restartDiscordBot();
  res.json({
    success: details.status === 'CONNECTED' || details.status === 'CONNECTING',
    message: `Bot gateway restart status: ${details.status}`,
    data: details
  });
});

// GET /api/v1/discord/admin/audit-logs - View Discord audit logs
router.get('/admin/audit-logs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  res.json({
    success: true,
    data: db.discordAuditLogs || []
  });
});

// POST /api/v1/discord/admin/bot-test - Test global bot webhook connection
router.post('/admin/bot-test', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const firstServer = db.servers[0];
  const serverId = firstServer ? firstServer.id : 'srv_survival';

  const result = await dispatchDiscordNotification(serverId, 'SERVER_STARTED', {
    message: '📢 Admin Global Discord Bot Connection Verification Test',
    details: 'Dispatched from AetherPanel Admin Panel -> Discord Integrations.'
  });

  res.json({
    success: result.success,
    message: result.message
  });
});

// POST /api/v1/discord/admin/run-acceptance-tests - Execute full 11-step Acceptance Test Suite
router.post('/admin/run-acceptance-tests', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  try {
    const results = await runDiscordAcceptanceTestSuite(req.user!.id);
    const passedCount = results.filter(r => r.status === 'passed').length;
    const allPassed = passedCount === results.length;

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'DISCORD_ACCEPTANCE_TESTS_RUN',
      'DISCORD',
      `Executed Discord Acceptance Test Suite: ${passedCount}/${results.length} passed.`
    );

    res.json({
      success: true,
      data: {
        allPassed,
        passedCount,
        totalCount: results.length,
        results
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'TEST_RUNNER_ERROR', message: err.message || 'Acceptance test runner failed.' }
    });
  }
});

// POST /api/v1/discord/server/:serverId/simulate-crash - Test crash alert notification
router.post('/server/:serverId/simulate-crash', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.serverId);
  if (!access) return;

  const { server } = access;
  const result = await dispatchDiscordNotification(server.id, 'SERVER_CRASHED', {
    message: `🚨 Watchdog Crash Alert for server '${server.name}'.`,
    details: 'Process unexpectedly terminated with signal SIGSEGV. Memory dump logged. Auto-restart triggered.'
  });

  res.json({
    success: result.success,
    message: result.message
  });
});

export default router;
