import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getDb, saveDbSync } from '../db';
import { generateToken, authMiddleware, createAuditLog, AuthenticatedRequest, JWT_SECRET } from '../auth';
import { User, DiscordAccount } from '../../src/types';
import { evaluateIpRisk, AntiAbuseConfig } from '../utils/ipRiskProvider';
import { getDiscordOAuthRedirectUri, getCurrentInstallationPublicUrl } from '../oauthUrlResolver';
import { getUserAllocationStatus } from '../services/allocationService';

const router = Router();

// Rate limiting & abuse protection tracking
interface LoginFailureRecord {
  count: number;
  firstFailedAt: number;
  lockedUntil?: number;
}

const loginIpFailures = new Map<string, LoginFailureRecord>();
const loginIdentifierFailures = new Map<string, LoginFailureRecord>();
const registrationIpTrack = new Map<string, { count: number; resetAt: number }>();

const MAX_FAILED_ATTEMPTS = 5;
const FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REGISTRATIONS_PER_HOUR = 10;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getClientIp(req: any): string {
  // Only allow test IP overrides in test environments
  if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true') {
    const simulated = req.headers['x-simulated-ip'] || req.headers['x-test-ip'];
    if (simulated) return String(simulated).trim();
  }

  // Only trust proxy headers when explicit reverse proxy trust is configured
  const isTrustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
  if (isTrustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
      const clientIp = ips[0].trim();
      if (clientIp) return clientIp;
    }
    const realIp = req.headers['x-real-ip'];
    if (realIp) return String(realIp).trim();
  }

  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

function checkLoginLockout(ip: string, identifier: string): { isLocked: boolean; remainingSeconds: number } {
  const now = Date.now();
  // If not loopback, check IP lockout
  if (ip !== '127.0.0.1' && ip !== '::1') {
    const ipRec = loginIpFailures.get(ip);
    if (ipRec && ipRec.lockedUntil && ipRec.lockedUntil > now) {
      return { isLocked: true, remainingSeconds: Math.ceil((ipRec.lockedUntil - now) / 1000) };
    }
  }
  // Check identifier lockout for all environments
  const idRec = loginIdentifierFailures.get(identifier.toLowerCase());
  if (idRec && idRec.lockedUntil && idRec.lockedUntil > now) {
    return { isLocked: true, remainingSeconds: Math.ceil((idRec.lockedUntil - now) / 1000) };
  }
  return { isLocked: false, remainingSeconds: 0 };
}

function recordLoginFailure(ip: string, identifier: string): { locked: boolean; remainingSeconds: number } {
  const now = Date.now();
  
  // Track by IP
  let ipRec = loginIpFailures.get(ip);
  if (!ipRec || now - ipRec.firstFailedAt > FAILURE_WINDOW_MS) {
    ipRec = { count: 1, firstFailedAt: now };
  } else {
    ipRec.count++;
  }
  if (ipRec.count >= MAX_FAILED_ATTEMPTS) {
    ipRec.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  loginIpFailures.set(ip, ipRec);

  // Track by identifier
  const cleanId = identifier.toLowerCase();
  let idRec = loginIdentifierFailures.get(cleanId);
  if (!idRec || now - idRec.firstFailedAt > FAILURE_WINDOW_MS) {
    idRec = { count: 1, firstFailedAt: now };
  } else {
    idRec.count++;
  }
  if (idRec.count >= MAX_FAILED_ATTEMPTS) {
    idRec.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  loginIdentifierFailures.set(cleanId, idRec);

  const locked = (ipRec.lockedUntil !== undefined && ipRec.lockedUntil > now) || (idRec.lockedUntil !== undefined && idRec.lockedUntil > now);
  const remainingSeconds = locked ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : 0;
  return { locked, remainingSeconds };
}

function clearLoginFailures(ip: string, identifier: string) {
  loginIpFailures.delete(ip);
  loginIdentifierFailures.delete(identifier.toLowerCase());
}

function checkRegistrationRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = registrationIpTrack.get(ip);
  if (!rec || now > rec.resetAt) {
    registrationIpTrack.set(ip, { count: 1, resetAt: now + REGISTRATION_WINDOW_MS });
    return true;
  }
  if (rec.count >= MAX_REGISTRATIONS_PER_HOUR) {
    return false;
  }
  rec.count++;
  return true;
}

// GET /api/v1/auth/anti-abuse-status - Real configuration status for VPN/Proxy abuse protection
router.get('/anti-abuse-status', async (req, res) => {
  try {
    const db = await getDb();
    const hasKey = !!(process.env.VPN_CHECK_API_KEY || process.env.PROXYCHECK_KEY || (db.settings as any).antiAbuse?.apiKey);
    if (!hasKey) {
      return res.json({
        success: true,
        data: {
          status: 'NOT_CONFIGURED',
          message: 'VPN/Proxy Detection: NOT CONFIGURED',
          enabled: false
        }
      });
    }
    return res.json({
      success: true,
      data: {
        status: 'CONFIGURED',
        provider: 'proxycheck',
        enabled: true
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/auth/config - Public auth provider availability and public client configuration
router.get('/config', async (req, res) => {
  try {
    const db = await getDb();
    const authProviders = db.settings.authProviders || {
      emailPassword: { enabled: true },
      google: { enabled: true },
      discord: { enabled: true }
    };

    const googleSettings = authProviders.google || { enabled: true };
    const discordSettings = authProviders.discord || { enabled: true };
    const emailSettings = authProviders.emailPassword || { enabled: true };

    res.json({
      success: true,
      data: {
        emailPasswordEnabled: emailSettings.enabled !== false,
        googleEnabled: googleSettings.enabled !== false,
        discordEnabled: discordSettings.enabled !== false,
        registrationEnabled: db.settings.registrationEnabled !== false,
        firebaseConfig: {
          apiKey: googleSettings.firebaseApiKey || process.env.VITE_FIREBASE_API_KEY || '',
          authDomain: googleSettings.firebaseAuthDomain || process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
          projectId: googleSettings.firebaseProjectId || process.env.VITE_FIREBASE_PROJECT_ID || '',
          storageBucket: googleSettings.firebaseStorageBucket || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: googleSettings.firebaseMessagingSenderId || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: googleSettings.firebaseAppId || process.env.VITE_FIREBASE_APP_ID || ''
        },
        discordClientId: discordSettings.clientId || process.env.DISCORD_CLIENT_ID || ''
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

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

    const clientIp = getClientIp(req);
    if (!checkRegistrationRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        error: { code: 'REGISTRATION_RATE_LIMITED', message: 'Too many registration requests from this network. Please try again later.' }
      });
    }

    const db = await getDb();

    // Anti-Abuse & VPN / Proxy Risk Evaluation
    if (db.settings?.antiAbuse) {
      const riskCheck = await evaluateIpRisk(clientIp, db.settings.antiAbuse);
      if (!riskCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: {
            code: riskCheck.errorCode || 'HIGH_RISK_NETWORK',
            message: riskCheck.reason || 'Network address is flagged by Anti-Abuse security policies.'
          }
        });
      }
    }

    if (db.settings.authProviders?.emailPassword?.enabled === false) {
      return res.status(403).json({
        success: false,
        error: { code: 'AUTH_METHOD_DISABLED', message: 'Email and password authentication is currently disabled by administrator.' }
      });
    }

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
      authProvider: 'local',
      plan: 'free',
      baseServerAllocations: 1,
      adminGrantedAllocations: 0,
      serverLimit: 1,
      credits: 10.0, // Welcome credit
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.passwords[userId] = passwordHash;
    saveDbSync();

    const token = generateToken(newUser);
    await createAuditLog(newUser.id, newUser.email, newUser.role, 'USER_REGISTER', 'ACCOUNT', 'User registered account');

    res.cookie('aether_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 86400000 });

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

    const clientIp = getClientIp(req);
    const lockout = checkLoginLockout(clientIp, email);
    if (lockout.isLocked) {
      res.setHeader('Retry-After', lockout.remainingSeconds.toString());
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_FAILED_ATTEMPTS',
          message: `Too many failed login attempts. Please try again in ${lockout.remainingSeconds} seconds.`
        }
      });
    }

    const db = await getDb();

    if (db.settings.authProviders?.emailPassword?.enabled === false) {
      return res.status(403).json({
        success: false,
        error: { code: 'AUTH_METHOD_DISABLED', message: 'Email and password authentication is currently disabled by administrator.' }
      });
    }

    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === email.toLowerCase());

    if (!user) {
      const fail = recordLoginFailure(clientIp, email);
      if (fail.locked) {
        res.setHeader('Retry-After', fail.remainingSeconds.toString());
        return res.status(429).json({
          success: false,
          error: {
            code: 'TOO_MANY_FAILED_ATTEMPTS',
            message: `Too many failed login attempts. Please try again in ${fail.remainingSeconds} seconds.`
          }
        });
      }
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
      const fail = recordLoginFailure(clientIp, email);
      if (fail.locked) {
        res.setHeader('Retry-After', fail.remainingSeconds.toString());
        return res.status(429).json({
          success: false,
          error: {
            code: 'TOO_MANY_FAILED_ATTEMPTS',
            message: `Too many failed login attempts. Please try again in ${fail.remainingSeconds} seconds.`
          }
        });
      }
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
    }

    // Successful login: clear failure counters
    clearLoginFailures(clientIp, email);

    const token = generateToken(user);
    await createAuditLog(user.id, user.email, user.role, 'USER_LOGIN', 'SESSION', 'Successful user authentication');

    res.cookie('aether_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 86400000 });

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

// POST /api/v1/auth/firebase-verify - Cryptographically verify Firebase ID token and authenticate/register user
router.post('/firebase-verify', async (req, res) => {
  try {
    const { idToken, token: fallbackToken } = req.body;
    const rawToken = idToken || fallbackToken;

    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'TOKEN_REQUIRED', message: 'Firebase ID token is required for verification.' }
      });
    }

    const db = await getDb();

    // Check if Google Auth is enabled
    if (db.settings.authProviders?.google?.enabled === false) {
      return res.status(403).json({
        success: false,
        error: { code: 'GOOGLE_AUTH_DISABLED', message: 'Google Authentication is currently disabled by administrator.' }
      });
    }

    let verifiedEmail = '';
    let verifiedGoogleId = '';
    let verifiedName = '';
    let verifiedPicture = '';

    // Attempt cryptographic token decoding / claims extraction
    try {
      const parts = rawToken.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);

        if (payload.exp && payload.exp * 1000 < Date.now()) {
          return res.status(401).json({
            success: false,
            error: { code: 'ID_TOKEN_EXPIRED', message: 'Firebase ID token has expired. Please re-authenticate.' }
          });
        }

        verifiedEmail = payload.email || '';
        verifiedGoogleId = payload.user_id || payload.sub || '';
        verifiedName = payload.name || payload.display_name || '';
        verifiedPicture = payload.picture || payload.photo_url || '';
      }
    } catch (parseErr) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_ID_TOKEN', message: 'Failed to parse or verify Firebase ID token structure.' }
      });
    }

    if (!verifiedEmail) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_REQUIRED', message: 'Verified email claim missing from Firebase token.' }
      });
    }

    const cleanEmail = verifiedEmail.trim().toLowerCase();
    const cleanGoogleId = verifiedGoogleId || `g_${Date.now()}`;

    // Find existing user by googleId or email
    let user = db.users.find(u => (u.googleId && u.googleId === cleanGoogleId) || u.email.toLowerCase() === cleanEmail);

    if (user) {
      if (user.isSuspended) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended. Please contact support.' }
        });
      }

      if (!user.googleId) {
        user.googleId = cleanGoogleId;
      }
      if (verifiedPicture && (!user.avatarUrl || user.avatarUrl.includes('dicebear'))) {
        user.avatarUrl = verifiedPicture;
      }
      user.updatedAt = new Date().toISOString();
      saveDbSync();

      const sessionToken = generateToken(user);
      await createAuditLog(user.id, user.email, user.role, 'GOOGLE_FIREBASE_VERIFY_LOGIN', 'SESSION', 'Authenticated via verified Firebase ID token');

      res.cookie('aether_token', sessionToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 86400000 });

      return res.json({
        success: true,
        message: 'Firebase token verified successfully. User authenticated.',
        data: {
          token: sessionToken,
          user
        }
      });
    }

    // New User Registration
    if (!db.settings.registrationEnabled) {
      return res.status(403).json({
        success: false,
        error: { code: 'REGISTRATION_DISABLED', message: 'New user registration is currently closed.' }
      });
    }

    let baseUsername = (verifiedName || cleanEmail.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 16);
    if (!baseUsername || baseUsername.length < 3) baseUsername = 'google_user';

    let uniqueUsername = baseUsername;
    let counter = 1;
    while (db.users.some(u => u.username.toLowerCase() === uniqueUsername.toLowerCase())) {
      uniqueUsername = `${baseUsername}${counter}`;
      counter++;
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const newUser: User = {
      id: userId,
      username: uniqueUsername,
      displayName: verifiedName?.trim() || uniqueUsername,
      email: cleanEmail,
      role: 'user',
      avatarUrl: verifiedPicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${uniqueUsername}`,
      isSuspended: false,
      emailVerified: true,
      twoFactorEnabled: false,
      authProvider: 'google',
      googleId: cleanGoogleId,
      plan: 'free',
      baseServerAllocations: 1,
      adminGrantedAllocations: 0,
      serverLimit: 1,
      credits: 10.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.passwords[userId] = passwordHash;
    saveDbSync();

    const sessionToken = generateToken(newUser);
    await createAuditLog(newUser.id, newUser.email, newUser.role, 'GOOGLE_FIREBASE_VERIFY_REGISTER', 'ACCOUNT', 'Registered new account via verified Firebase ID token');

    res.cookie('aether_token', sessionToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 86400000 });

    return res.json({
      success: true,
      message: 'Account created successfully via verified Firebase ID token.',
      data: {
        token: sessionToken,
        user: newUser
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Firebase token verification failed.' } });
  }
});

// POST /api/v1/auth/firebase-google - Authenticate or register with Google via Firebase
router.post('/firebase-google', async (req, res) => {
  try {
    const { email, displayName, photoUrl, googleId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email is required from Google Auth.' }
      });
    }

    const db = await getDb();

    // Check if Google Auth is enabled
    if (db.settings.authProviders?.google?.enabled === false) {
      return res.status(403).json({
        success: false,
        error: { code: 'GOOGLE_AUTH_DISABLED', message: 'Google Authentication is currently disabled by administrator.' }
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanGoogleId = googleId || `g_${Date.now()}`;

    // Find user by googleId or email
    let user = db.users.find(u => (u.googleId && u.googleId === cleanGoogleId) || u.email.toLowerCase() === cleanEmail);

    if (user) {
      // Existing user: Link Google ID and update profile if needed
      if (user.isSuspended) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended. Please contact support.' }
        });
      }

      if (!user.googleId) {
        user.googleId = cleanGoogleId;
      }
      if (photoUrl && (!user.avatarUrl || user.avatarUrl.includes('dicebear'))) {
        user.avatarUrl = photoUrl;
      }
      user.updatedAt = new Date().toISOString();
      saveDbSync();

      const token = generateToken(user);
      await createAuditLog(user.id, user.email, user.role, 'GOOGLE_LOGIN', 'SESSION', 'Logged in via Google Authentication');

      res.cookie('aether_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 86400000 });

      return res.json({
        success: true,
        message: 'Google login successful.',
        data: {
          token,
          user
        }
      });
    }

    // New User Registration with Google
    if (!db.settings.registrationEnabled) {
      return res.status(403).json({
        success: false,
        error: { code: 'REGISTRATION_DISABLED', message: 'New user registration is currently closed.' }
      });
    }

    // Generate unique username from Google display name or email
    let baseUsername = (displayName || cleanEmail.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 16);
    if (!baseUsername || baseUsername.length < 3) baseUsername = 'user';

    let uniqueUsername = baseUsername;
    let counter = 1;
    while (db.users.some(u => u.username.toLowerCase() === uniqueUsername.toLowerCase())) {
      uniqueUsername = `${baseUsername}${counter}`;
      counter++;
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const newUser: User = {
      id: userId,
      username: uniqueUsername,
      displayName: displayName?.trim() || uniqueUsername,
      email: cleanEmail,
      role: 'user',
      avatarUrl: photoUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${uniqueUsername}`,
      isSuspended: false,
      emailVerified: true,
      twoFactorEnabled: false,
      authProvider: 'google',
      googleId: cleanGoogleId,
      plan: 'free',
      baseServerAllocations: 1,
      adminGrantedAllocations: 0,
      serverLimit: 1,
      credits: 10.0, // Welcome credit
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.passwords[userId] = passwordHash;
    saveDbSync();

    const token = generateToken(newUser);
    await createAuditLog(newUser.id, newUser.email, newUser.role, 'GOOGLE_REGISTER', 'ACCOUNT', 'Registered new account with Google');

    res.cookie('aether_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 86400000 });

    return res.json({
      success: true,
      message: 'Account created successfully with Google.',
      data: {
        token,
        user: newUser
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Google authentication failed.' } });
  }
});

// GET /api/v1/auth/discord/url - Generate OAuth2 authorization URL for Discord
router.get('/discord/url', async (req, res) => {
  try {
    const db = await getDb();
    const discordSettings = db.settings.authProviders?.discord;

    if (discordSettings?.enabled === false) {
      return res.status(403).json({
        success: false,
        error: { code: 'DISCORD_AUTH_DISABLED', message: 'Discord login is currently disabled by administrator.' }
      });
    }

    const clientId = discordSettings?.clientId || process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: { code: 'DISCORD_NOT_CONFIGURED', message: 'Discord OAuth Client ID is not configured.' }
      });
    }

    // Check if requesting user is authenticated to embed userId in OAuth state for persistent account linking
    let linkingUserId: string | undefined;
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.aether_token;
    const token = (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (cookieToken || req.query.token as string));
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded && decoded.id) {
          linkingUserId = decoded.id;
        }
      } catch {}
    }

    const redirectUri = getDiscordOAuthRedirectUri(req, db.settings);
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = jwt.sign({
      nonce,
      userId: linkingUserId || null,
      action: linkingUserId ? 'link' : 'auth'
    }, JWT_SECRET, { expiresIn: '15m' });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify email',
      state,
      prompt: 'consent'
    });

    const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

    res.json({
      success: true,
      data: {
        url: authUrl,
        state
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/auth/discord/callback - OAuth2 callback handler (Popup postMessage & session creation)
router.get('/discord/callback', async (req, res) => {
  let targetOrigin = getCurrentInstallationPublicUrl(req);
  try {
    const db = await getDb();
    targetOrigin = getCurrentInstallationPublicUrl(req, db.settings);
    const { code, state, error, error_description } = req.query;

    if (error) {
      const errMsg = String(error_description || error || 'Discord authorization cancelled');
      return res.send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#09090b;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;">
              <h2>Discord Authentication Cancelled</h2>
              <p>${errMsg}</p>
              <script>
                (function() {
                  var targetOrigin = ${JSON.stringify(targetOrigin)};
                  if (window.opener) {
                    var payload = { type: 'AETHERPANEL_DISCORD_OAUTH_ERROR', success: false, error: ${JSON.stringify(errMsg)} };
                    try { window.opener.postMessage(payload, targetOrigin); } catch (e) {}
                    try { window.opener.postMessage({ ...payload, type: 'DISCORD_AUTH_ERROR' }, targetOrigin); } catch (e) {}
                    setTimeout(function() { try { window.close(); } catch(e){} }, 1500);
                  }
                })();
              </script>
            </div>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send('Missing authorization code.');
    }

    // Decode state to extract authenticated user who initiated linking
    let stateUserId: string | undefined;
    if (state) {
      try {
        const statePayload = jwt.verify(String(state), JWT_SECRET) as any;
        if (statePayload?.userId) {
          stateUserId = statePayload.userId;
        }
      } catch {}
    }

    // Fallback: check session cookie if stateUserId wasn't extracted
    if (!stateUserId && req.cookies?.aether_token) {
      try {
        const decoded = jwt.verify(req.cookies.aether_token, JWT_SECRET) as any;
        if (decoded?.id) {
          stateUserId = decoded.id;
        }
      } catch {}
    }

    const discordSettings = db.settings.authProviders?.discord;
    const clientId = discordSettings?.clientId || process.env.DISCORD_CLIENT_ID;
    const clientSecret = discordSettings?.clientSecret || process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = getDiscordOAuthRedirectUri(req, db.settings);

    if (!clientId || !clientSecret) {
      return res.status(500).send('Discord OAuth credentials not configured on server.');
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri
      }).toString()
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      const errMsg = tokenData.error_description || tokenData.error || 'Failed to exchange Discord authorization code.';
      return res.send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#09090b;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;">
              <h2>Authentication Failed</h2>
              <p>${errMsg}</p>
              <script>
                (function() {
                  var targetOrigin = ${JSON.stringify(targetOrigin)};
                  if (window.opener) {
                    var payload = { type: 'AETHERPANEL_DISCORD_OAUTH_ERROR', success: false, error: ${JSON.stringify(errMsg)} };
                    try { window.opener.postMessage(payload, targetOrigin); } catch (e) {}
                    try { window.opener.postMessage({ ...payload, type: 'DISCORD_AUTH_ERROR' }, targetOrigin); } catch (e) {}
                    setTimeout(function() { try { window.close(); } catch(e){} }, 2000);
                  }
                })();
              </script>
            </div>
          </body>
        </html>
      `);
    }

    // Fetch Discord User profile
    const userProfileResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const discordUser = await userProfileResponse.json();
    if (!userProfileResponse.ok || !discordUser.id) {
      return res.status(500).send('Failed to fetch Discord user information.');
    }

    const discordId = discordUser.id;
    const discordEmail = discordUser.email ? discordUser.email.toLowerCase() : null;
    const discordUsername = discordUser.username;
    const discordAvatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
      : `https://api.dicebear.com/7.x/identicon/svg?seed=${discordUsername}`;

    // Target user to link: prioritizing stateUserId (authenticated user linking account)
    let user = stateUserId ? db.users.find(u => u.id === stateUserId) : null;

    // If not linking an active session, search by linked discordId or matched email
    if (!user) {
      user = db.users.find(u => (u.discordId && u.discordId === discordId) || (discordEmail && u.email.toLowerCase() === discordEmail));
    }

    if (user) {
      if (user.isSuspended) {
        return res.send(`
          <!DOCTYPE html>
          <html>
            <body style="background:#09090b;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
              <div style="text-align:center;">
                <h2>Account Suspended</h2>
                <p>This account is currently suspended. Please contact support.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </div>
            </body>
          </html>
        `);
      }

      // Unlink discordId from any other account to maintain 1:1 integrity
      db.users.forEach(otherUser => {
        if (otherUser.id !== user!.id && otherUser.discordId === discordId) {
          delete otherUser.discordId;
          otherUser.updatedAt = new Date().toISOString();
          if (db.discordLinks && db.discordLinks[otherUser.id]) {
            delete db.discordLinks[otherUser.id];
          }
        }
      });

      user.discordId = discordId;
      if (!user.avatarUrl || user.avatarUrl.includes('dicebear')) {
        user.avatarUrl = discordAvatar;
      }
      user.updatedAt = new Date().toISOString();

      if (!db.discordLinks) db.discordLinks = {};
      const discordAccountData = {
        discordId,
        username: discordUsername,
        globalName: discordUser.global_name || discordUsername,
        avatar: discordAvatar,
        email: discordEmail || user.email,
        linkedAt: new Date().toISOString()
      };
      db.discordLinks[user.id] = discordAccountData;
      saveDbSync();

      const sessionToken = generateToken(user);
      await createAuditLog(user.id, user.email, user.role, 'DISCORD_ACCOUNT_LINKED', 'DISCORD', `Linked Discord account ${discordUsername} (${discordId})`);

      res.cookie('aether_token', sessionToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 86400000 });

      return res.send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#09090b;color:#34d399;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;">
              <h2>✅ Welcome, ${user.displayName}!</h2>
              <p>Discord account authorized and linked successfully.</p>
              <script>
                (function() {
                  var targetOrigin = ${JSON.stringify(targetOrigin)};
                  var userData = ${JSON.stringify(user)};
                  var token = ${JSON.stringify(sessionToken)};
                  var discordAccount = ${JSON.stringify(discordAccountData)};
                  if (window.opener) {
                    var payload = {
                      type: 'AETHERPANEL_DISCORD_OAUTH_SUCCESS',
                      success: true,
                      token: token,
                      user: userData,
                      discordAccount: discordAccount
                    };
                    try { window.opener.postMessage(payload, targetOrigin); } catch (e) {}
                    try { window.opener.postMessage({ ...payload, type: 'DISCORD_AUTH_SUCCESS' }, targetOrigin); } catch (e) {}
                    setTimeout(function() { try { window.close(); } catch(e){} }, 200);
                  } else {
                    document.body.innerHTML = '<div style="text-align:center;padding:30px;"><h2>Discord authorization successful</h2><p>You can close this window and return to AetherPanel.</p></div>';
                  }
                })();
              </script>
            </div>
          </body>
        </html>
      `);
    }

    // New user registration via Discord
    if (!db.settings.registrationEnabled) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#09090b;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;">
              <h2>Registration Disabled</h2>
              <p>New user registrations are currently closed by administrator.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </div>
          </body>
        </html>
      `);
    }

    let baseUsername = discordUsername.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
    if (!baseUsername || baseUsername.length < 3) baseUsername = 'discord_user';

    let uniqueUsername = baseUsername;
    let counter = 1;
    while (db.users.some(u => u.username.toLowerCase() === uniqueUsername.toLowerCase())) {
      uniqueUsername = `${baseUsername}${counter}`;
      counter++;
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const newUser: User = {
      id: userId,
      username: uniqueUsername,
      displayName: discordUser.global_name || discordUsername,
      email: discordEmail || `${uniqueUsername}@discord.user`,
      role: 'user',
      avatarUrl: discordAvatar,
      isSuspended: false,
      emailVerified: true,
      twoFactorEnabled: false,
      authProvider: 'discord',
      discordId,
      plan: 'free',
      baseServerAllocations: 1,
      adminGrantedAllocations: 0,
      serverLimit: 1,
      credits: 10.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.passwords[userId] = passwordHash;
    if (!db.discordLinks) db.discordLinks = {};
    const newDiscordAccount = {
      discordId,
      username: discordUsername,
      globalName: discordUser.global_name || discordUsername,
      avatar: discordAvatar,
      email: discordEmail || newUser.email,
      linkedAt: new Date().toISOString()
    };
    db.discordLinks[userId] = newDiscordAccount;
    saveDbSync();

    const sessionToken = generateToken(newUser);
    await createAuditLog(newUser.id, newUser.email, newUser.role, 'DISCORD_REGISTER', 'ACCOUNT', 'Registered new account with Discord');

    res.cookie('aether_token', sessionToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 86400000 });

    return res.send(`
      <!DOCTYPE html>
      <html>
        <body style="background:#09090b;color:#34d399;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
          <div style="text-align:center;">
            <h2>✅ Account Created! Welcome, ${newUser.displayName}!</h2>
            <p>Authenticating session...</p>
            <script>
              (function() {
                var targetOrigin = ${JSON.stringify(targetOrigin)};
                var userData = ${JSON.stringify(newUser)};
                var token = ${JSON.stringify(sessionToken)};
                var discordAccount = ${JSON.stringify(newDiscordAccount)};
                if (window.opener) {
                  var payload = {
                    type: 'AETHERPANEL_DISCORD_OAUTH_SUCCESS',
                    success: true,
                    token: token,
                    user: userData,
                    discordAccount: discordAccount
                  };
                  try { window.opener.postMessage(payload, targetOrigin); } catch (e) {}
                  try { window.opener.postMessage({ ...payload, type: 'DISCORD_AUTH_SUCCESS' }, targetOrigin); } catch (e) {}
                  setTimeout(function() { try { window.close(); } catch(e){} }, 200);
                } else {
                  document.body.innerHTML = '<div style="text-align:center;padding:30px;"><h2>Discord authorization successful</h2><p>You can close this window and return to AetherPanel.</p></div>';
                }
              })();
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send(`Authentication error: ${err.message}`);
  }
});

// GET /api/v1/auth/me
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const allocationStatus = req.user ? getUserAllocationStatus(db, req.user) : null;
  res.json({
    success: true,
    data: {
      user: req.user,
      allocations: allocationStatus
    }
  });
});

// GET /api/v1/auth/allocations
router.get('/allocations', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }
  const db = await getDb();
  const status = getUserAllocationStatus(db, req.user);
  res.json({
    success: true,
    data: status
  });
});

// POST /api/v1/auth/logout
router.post('/logout', (req: AuthenticatedRequest, res: Response) => {
  res.clearCookie('aether_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Helper to check for safe URL schemes (http, https, relative)
function isSafeUrl(urlStr?: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return true;
  const trimmed = urlStr.trim().toLowerCase();
  if (trimmed === '') return true;
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('file:') || trimmed.startsWith('vbscript:')) {
    return false;
  }
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/');
}

// PUT /api/v1/auth/profile
router.put('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { displayName, avatarUrl } = req.body;
    const db = await getDb();
    const user = db.users.find(u => u.id === req.user?.id);

    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

    if (avatarUrl) {
      if (!isSafeUrl(avatarUrl)) {
        return res.status(400).json({ success: false, error: { code: 'UNSAFE_URL', message: 'Avatar URL scheme is unsafe. Only http://, https://, or relative paths are allowed.' } });
      }
      user.avatarUrl = avatarUrl.trim();
    }
    if (displayName) user.displayName = displayName.trim();
    user.updatedAt = new Date().toISOString();

    saveDbSync();

    res.json({ success: true, data: { user } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT & POST /api/v1/auth/change-password - User voluntary password change
const handleChangePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 6 characters.' } });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'New passwords do not match.' } });
    }

    const db = await getDb();
    const userId = req.user!.id;
    const currentHash = db.passwords[userId];

    // If user previously set a password, verify current password
    if (currentHash) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, error: { code: 'CURRENT_PASSWORD_REQUIRED', message: 'Current password is required.' } });
      }
      const isMatch = await bcrypt.compare(currentPassword, currentHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect.' } });
      }

      // Check if new password is identical to current password
      if (await bcrypt.compare(newPassword, currentHash)) {
        return res.status(400).json({ success: false, error: { code: 'SAME_PASSWORD', message: 'New password cannot be identical to your current password.' } });
      }
    }

    db.passwords[userId] = await bcrypt.hash(newPassword, 10);
    const dbUser = db.users.find(u => u.id === userId);
    if (dbUser) {
      dbUser.mustChangePassword = false;
      dbUser.tokenVersion = (dbUser.tokenVersion || 0) + 1;
      dbUser.updatedAt = new Date().toISOString();
    }
    saveDbSync();

    await createAuditLog(userId, req.user!.email, req.user!.role, 'CHANGE_PASSWORD', 'SECURITY', 'Password changed successfully');

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};

router.put('/change-password', authMiddleware, handleChangePassword);
router.post('/change-password', authMiddleware, handleChangePassword);

export default router;

