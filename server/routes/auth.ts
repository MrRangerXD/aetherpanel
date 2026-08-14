import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, saveDbSync } from '../db';
import { generateToken, authMiddleware, createAuditLog, AuthenticatedRequest } from '../auth';
import { User } from '../../src/types';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, displayName, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Username, email and password are required.' }
      });
    }

    const db = await getDb();

    if (!db.settings.registrationEnabled) {
      return res.status(403).json({
        success: false,
        error: { code: 'REGISTRATION_DISABLED', message: 'New user registration is currently closed.' }
      });
    }

    const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'A user with this email or username already exists.' }
      });
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser: User = {
      id: userId,
      username: username.trim(),
      displayName: displayName?.trim() || username.trim(),
      email: email.trim().toLowerCase(),
      role: 'user',
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`,
      isSuspended: false,
      emailVerified: true,
      twoFactorEnabled: false,
      credits: 10.0, // Welcome credit
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.passwords[userId] = passwordHash;
    saveDbSync();

    const token = generateToken(newUser);
    await createAuditLog(newUser.id, newUser.email, newUser.role, 'USER_REGISTER', 'ACCOUNT', 'User registered account');

    res.cookie('aether_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000 });

    res.json({
      success: true,
      data: {
        token,
        user: newUser
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Registration failed' } });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' }
      });
    }

    const db = await getDb();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === email.toLowerCase());

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended. Please contact support.' }
      });
    }

    const passwordHash = db.passwords[user.id];
    const isMatch = await bcrypt.compare(password, passwordHash || '');

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
    }

    const token = generateToken(user);
    await createAuditLog(user.id, user.email, user.role, 'USER_LOGIN', 'SESSION', 'Successful user authentication');

    res.cookie('aether_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000 });

    res.json({
      success: true,
      data: {
        token,
        user
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Login failed' } });
  }
});

// GET /api/v1/auth/me
router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

// POST /api/v1/auth/logout
router.post('/logout', (req: AuthenticatedRequest, res: Response) => {
  res.clearCookie('aether_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// PUT /api/v1/auth/profile
router.put('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { displayName, avatarUrl } = req.body;
    const db = await getDb();
    const user = db.users.find(u => u.id === req.user?.id);

    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

    if (displayName) user.displayName = displayName.trim();
    if (avatarUrl) user.avatarUrl = avatarUrl.trim();
    user.updatedAt = new Date().toISOString();

    saveDbSync();

    res.json({ success: true, data: { user } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/auth/change-password
router.put('/change-password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = await getDb();
    const userId = req.user!.id;

    const currentHash = db.passwords[userId];
    const isMatch = await bcrypt.compare(currentPassword, currentHash || '');

    if (!isMatch) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect.' } });
    }

    db.passwords[userId] = await bcrypt.hash(newPassword, 10);
    const dbUser = db.users.find(u => u.id === userId);
    if (dbUser) {
      dbUser.mustChangePassword = false;
      dbUser.updatedAt = new Date().toISOString();
    }
    saveDbSync();

    await createAuditLog(userId, req.user!.email, req.user!.role, 'CHANGE_PASSWORD', 'SECURITY', 'Password changed');

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
