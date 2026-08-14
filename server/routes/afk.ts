import { Router } from 'express';
import { getDb, saveDb } from '../db';
import { authenticateUser, requireAdmin, AuthenticatedRequest } from '../auth';
import { AfkSession, RewardTransaction, AfkSettings } from '../../src/types';

const router = Router();

// GET /api/v1/afk/status - Get current user AFK session & daily earnings summary
router.get('/status', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const db = await getDb();

    // Calculate today's total earned credits
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayRewards = (db.rewardTransactions || []).filter(t => 
      t.userId === user.id && 
      t.type === 'AFK_REWARD' && 
      new Date(t.createdAt) >= startOfDay
    );

    const todayEarnedCredits = todayRewards.reduce((sum, t) => sum + t.amount, 0);

    // Active session check
    const activeSession = (db.afkSessions || []).find(s => s.userId === user.id && !s.isCompleted);

    res.json({
      success: true,
      userCredits: user.credits || 0,
      todayEarnedCredits,
      settings: db.afkSettings || {
        enabled: true,
        creditsPerInterval: 5,
        intervalMinutes: 10,
        dailyMaxCredits: 100,
        weeklyMaxCredits: 500,
        minAccountAgeDays: 0
      },
      activeSession: activeSession || null
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to fetch AFK status.' } });
  }
});

// POST /api/v1/afk/start - Start new AFK session
router.post('/start', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const db = await getDb();

    if (!db.afkSettings?.enabled) {
      return res.status(403).json({ success: false, error: { message: 'AFK Reward system is currently disabled by system administrator.' } });
    }

    // Close any previous stale uncompleted sessions
    db.afkSessions = db.afkSessions || [];
    db.afkSessions.forEach(s => {
      if (s.userId === user.id && !s.isCompleted) {
        s.isCompleted = true;
      }
    });

    const sessionId = `afk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newSession: AfkSession = {
      id: sessionId,
      userId: user.id,
      sessionId,
      startedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      earnedCredits: 0,
      isCompleted: false,
      ipAddress: req.ip || '127.0.0.1'
    };

    db.afkSessions.push(newSession);
    await saveDb();

    res.json({
      success: true,
      session: newSession,
      settings: db.afkSettings
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to start AFK session.' } });
  }
});

// POST /api/v1/afk/heartbeat - Heartbeat check & reward crediting
router.post('/heartbeat', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { sessionId } = req.body;
    const db = await getDb();

    const session = (db.afkSessions || []).find(s => s.id === sessionId && s.userId === user.id && !s.isCompleted);
    if (!session) {
      return res.status(404).json({ success: false, error: { message: 'Invalid or expired AFK session.' } });
    }

    const now = new Date();
    const lastHeartbeat = new Date(session.lastHeartbeatAt);
    const elapsedSeconds = (now.getTime() - lastHeartbeat.getTime()) / 1000;

    const settings = db.afkSettings || {
      enabled: true,
      creditsPerInterval: 5,
      intervalMinutes: 10,
      dailyMaxCredits: 100,
      weeklyMaxCredits: 500,
      minAccountAgeDays: 0
    };

    const intervalSeconds = settings.intervalMinutes * 60;
    let awardedCredits = 0;

    // Check if interval threshold met (allow 5-second buffer for network latency)
    if (elapsedSeconds >= (intervalSeconds - 5)) {
      // Calculate today's earnings
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayRewards = (db.rewardTransactions || []).filter(t => 
        t.userId === user.id && 
        t.type === 'AFK_REWARD' && 
        new Date(t.createdAt) >= startOfDay
      );
      const todayEarned = todayRewards.reduce((sum, t) => sum + t.amount, 0);

      if (todayEarned < settings.dailyMaxCredits) {
        awardedCredits = Math.min(settings.creditsPerInterval, settings.dailyMaxCredits - todayEarned);

        if (awardedCredits > 0) {
          // Update user balance
          const dbUser = db.users.find(u => u.id === user.id);
          if (dbUser) {
            dbUser.credits = (dbUser.credits || 0) + awardedCredits;
          }

          session.earnedCredits += awardedCredits;

          // Create immutable transaction ledger record
          db.rewardTransactions = db.rewardTransactions || [];
          db.rewardTransactions.push({
            id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId: user.id,
            amount: awardedCredits,
            type: 'AFK_REWARD',
            description: `AFK loyalty reward (${settings.intervalMinutes}m session block)`,
            createdAt: now.toISOString(),
            referenceId: session.id
          });
        }
      }

      session.lastHeartbeatAt = now.toISOString();
    } else {
      // Just update timestamp for active connection keepalive
      session.lastHeartbeatAt = now.toISOString();
    }

    await saveDb();

    // Refetch updated user
    const updatedUser = db.users.find(u => u.id === user.id);

    res.json({
      success: true,
      awardedCredits,
      totalCredits: updatedUser?.credits || 0,
      sessionEarned: session.earnedCredits
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'AFK heartbeat verification failed.' } });
  }
});

// POST /api/v1/afk/stop - End AFK session
router.post('/stop', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { sessionId } = req.body;
    const db = await getDb();

    const session = (db.afkSessions || []).find(s => s.id === sessionId && s.userId === user.id);
    if (session) {
      session.isCompleted = true;
      await saveDb();
    }

    res.json({ success: true, message: 'AFK session ended.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Failed to stop AFK session.' } });
  }
});

// GET /api/v1/rewards/wallet - User Reward Wallet & Ledger History
router.get('/wallet', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const db = await getDb();

    const transactions = (db.rewardTransactions || [])
      .filter(t => t.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalEarned = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayEarned = transactions
      .filter(t => t.type === 'AFK_REWARD' && new Date(t.createdAt) >= startOfDay)
      .reduce((sum, t) => sum + t.amount, 0);

    const dbUser = db.users.find(u => u.id === user.id);

    res.json({
      success: true,
      balance: dbUser?.credits || 0,
      todayEarned,
      totalEarned,
      transactions
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch reward wallet.' } });
  }
});

// ADMIN ROUTES FOR REWARDS

// GET /api/v1/admin/rewards/settings
router.get('/admin/settings', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    res.json({ success: true, settings: db.afkSettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch reward settings.' } });
  }
});

// PUT /api/v1/admin/rewards/settings
router.put('/admin/settings', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    db.afkSettings = { ...db.afkSettings, ...req.body };
    await saveDb();
    res.json({ success: true, settings: db.afkSettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Failed to update reward settings.' } });
  }
});

// GET /api/v1/admin/rewards/transactions
router.get('/admin/transactions', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const transactions = (db.rewardTransactions || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ success: true, transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Failed to list transactions.' } });
  }
});

// POST /api/v1/admin/rewards/adjust - Manual Balance Adjustment
router.post('/admin/adjust', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    if (!userId || amount === undefined || !description) {
      return res.status(400).json({ success: false, error: { message: 'userId, amount, and description note are required.' } });
    }

    const db = await getDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'Target user not found.' } });
    }

    user.credits = Math.max(0, (user.credits || 0) + Number(amount));

    db.rewardTransactions = db.rewardTransactions || [];
    db.rewardTransactions.push({
      id: `tx_adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      amount: Number(amount),
      type: 'ADMIN_ADJUSTMENT',
      description: `Admin Adjustment: ${description}`,
      createdAt: new Date().toISOString()
    });

    await saveDb();

    res.json({ success: true, newBalance: user.credits });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: 'Failed to adjust balance.' } });
  }
});

export default router;
