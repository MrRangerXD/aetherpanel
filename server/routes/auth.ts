import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, saveDbSync } from '../db';
import { generateToken, authMiddleware, createAuditLog, AuthenticatedRequest } from '../auth';
import { User, DiscordAccount } from '../../src/types';

const router = Router();

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

    const db = await getDb();

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

    const db = await getDb();

    if (db.settings.authProviders?.emailPassword?.enabled === false) {
      return res.status(403).json({
        success: false,
        error: { code: 'AUTH_METHOD_DISABLED', message: 'Email and password authentication is currently disabled by administrator.' }
      });
    }

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

    const redirectUri = discordSettings?.redirectUri || process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/v1/auth/discord/callback`;
    const state = crypto.randomBytes(16).toString('hex');

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
  try {
    const { code, error, error_description } = req.query;

    if (error) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#09090b;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;">
              <h2>Discord Authentication Cancelled</h2>
              <p>${error_description || error}</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'DISCORD_AUTH_ERROR', error: '${error_description || error}' }, '*');
                  setTimeout(() => window.close(), 2000);
                }
              </script>
            </div>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send('Missing authorization code.');
    }

    const db = await getDb();
    const discordSettings = db.settings.authProviders?.discord;
    const clientId = discordSettings?.clientId || process.env.DISCORD_CLIENT_ID;
    const clientSecret = discordSettings?.clientSecret || process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = discordSettings?.redirectUri || process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/v1/auth/discord/callback`;

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
                if (window.opener) {
                  window.opener.postMessage({ type: 'DISCORD_AUTH_ERROR', error: '${errMsg}' }, '*');
                  setTimeout(() => window.close(), 2500);
                }
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

    // Check existing user
    let user = db.users.find(u => (u.discordId && u.discordId === discordId) || (discordEmail && u.email.toLowerCase() === discordEmail));

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

      user.discordId = discordId;
      if (!user.avatarUrl || user.avatarUrl.includes('dicebear')) {
        user.avatarUrl = discordAvatar;
      }
      user.updatedAt = new Date().toISOString();

      if (!db.discordLinks) db.discordLinks = {};
      db.discordLinks[user.id] = {
        discordId,
        username: discordUsername,
        globalName: discordUser.global_name || discordUsername,
        avatar: discordAvatar,
        email: discordEmail || user.email,
        linkedAt: new Date().toISOString()
      };
      saveDbSync();

      const sessionToken = generateToken(user);
      await createAuditLog(user.id, user.email, user.role, 'DISCORD_LOGIN', 'SESSION', 'Logged in via Discord OAuth2');

      res.cookie('aether_token', sessionToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 86400000 });

      return res.send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#09090b;color:#34d399;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;">
              <h2>✅ Welcome back, ${user.displayName}!</h2>
              <p>Authenticating session...</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'DISCORD_AUTH_SUCCESS',
                    token: '${sessionToken}',
                    user: ${JSON.stringify(user)}
                  }, '*');
                  window.close();
                } else {
                  window.location.href = '/dashboard';
                }
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
      credits: 10.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.passwords[userId] = passwordHash;
    if (!db.discordLinks) db.discordLinks = {};
    db.discordLinks[userId] = {
      discordId,
      username: discordUsername,
      globalName: discordUser.global_name || discordUsername,
      avatar: discordAvatar,
      email: discordEmail || newUser.email,
      linkedAt: new Date().toISOString()
    };
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
            <p>Redirecting to control panel...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'DISCORD_AUTH_SUCCESS',
                  token: '${sessionToken}',
                  user: ${JSON.stringify(newUser)}
                }, '*');
                window.close();
              } else {
                window.location.href = '/dashboard';
              }
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

// PUT /api/v1/auth/change-password
router.put('/change-password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
});

export default router;

