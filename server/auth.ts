import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, saveDbSync } from './db';
import { User, UserRole, AuditLog } from '../src/types';

const JWT_SECRET = process.env.JWT_SECRET || 'aetherpanel_secret_jwt_key_2026_super_safe';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 1
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; tokenVersion?: number };
    const db = await getDb();
    const user = db.users.find(u => u.id === decoded.id && !u.isSuspended);
    if (!user) return null;

    // Check token version for instant session revocation
    if (user.tokenVersion !== undefined && decoded.tokenVersion !== undefined) {
      if (decoded.tokenVersion !== user.tokenVersion) {
        return null;
      }
    }
    return user;
  } catch (err) {
    return null;
  }
}


// Basic in-memory rate limiting for API keys
const apiRateLimits = new Map<string, { count: number, resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 60;

export function checkRateLimit(apiKeyId: string): boolean {
  const now = Date.now();
  const record = apiRateLimits.get(apiKeyId);
  
  if (!record || now > record.resetAt) {
    apiRateLimits.set(apiKeyId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (record.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  record.count++;
  return true;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.headers.authorization?.replace('Bearer ', '');
  if (!token && req.cookies && req.cookies.aether_token) {
    token = req.cookies.aether_token;
  }
  
  // Try API key if standard token is missing or looks like an API key
  let isApiKey = false;
  if (!token && req.headers['x-api-key']) {
    token = req.headers['x-api-key'] as string;
    isApiKey = true;
  } else if (token && (token.startsWith('aeth_live_') || token.startsWith('aeth_sec_') || token.startsWith('aeth_'))) {
    isApiKey = true;
  }

  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication token or API key required.' } });
  }

  if (isApiKey) {
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');
    const db = await getDb();
    
    const apiKey = db.apiKeys.find(k => k.keyHash === keyHash);
    if (!apiKey) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid API key.' } });
    }
    if (apiKey.status === 'revoked') {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'API key revoked.' } });
    }
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'API key expired.' } });
    }
    const user = db.users.find(u => u.id === apiKey.userId && !u.isSuspended);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User account suspended or not found.' } });
    }
    
    // Check rate limit
    if (!checkRateLimit(apiKey.id)) {
      return res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'API rate limit exceeded. Please try again later.' } });
    }
    
    apiKey.lastUsedAt = new Date().toISOString();
    
    // Log the API access
    if (!db.apiAuditLogs) db.apiAuditLogs = [];
    db.apiAuditLogs.unshift({
      id: `apiaud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      apiKeyId: apiKey.id,
      userId: user.id,
      endpoint: req.originalUrl,
      method: req.method,
      statusCode: 200, // Will be inaccurate but sufficient for now unless we hook res.on('finish')
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      createdAt: new Date().toISOString()
    });
    if (db.apiAuditLogs.length > 1000) db.apiAuditLogs = db.apiAuditLogs.slice(0, 1000);
    
    saveDbSync();
    
    req.user = user;
    (req as any).apiKey = apiKey;
    return next();
  }

  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Session expired or invalid token.' } });
  }

  req.user = user;
  next();
}


export const authenticateUser = authMiddleware;

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Insufficient administrative privileges.' }
      });
    }

    next();
  };
}

export function requireApiKeyScope(requiredScope: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const apiKey = (req as any).apiKey;
    if (!apiKey) return next();

    const scopes: string[] = apiKey.scopes || [];
    const singularScope = requiredScope.replace('servers:', 'server:').replace('files:', 'file:').replace('backups:', 'backup:');
    const pluralScope = requiredScope.replace('server:', 'servers:').replace('file:', 'files:').replace('backup:', 'backups:');

    if (scopes.includes('*') || scopes.includes('admin') || scopes.includes(requiredScope) || scopes.includes(singularScope) || scopes.includes(pluralScope)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN_SCOPE',
        message: `API key lacks required scope '${requiredScope}'.`
      }
    });
  };
}

export const requireAdmin = requireRole(['admin', 'super_admin']);

export async function checkServerAccess(user: User, serverId: string) {
  const db = await getDb();
  const server = db.servers.find(s => s.id === serverId);
  if (!server) {
    return { hasAccess: false, server: null, error: 'Server not found' };
  }
  if (user.role === 'admin' || user.role === 'super_admin' || server.userId === user.id) {
    return { hasAccess: true, server, role: 'owner' };
  }
  return { hasAccess: false, server: null, error: 'Access denied to this server' };
}

export async function createAuditLog(
  actor: any,
  actionOrEmail: string,
  detailsOrRole: string,
  ipOrAction?: string,
  targetResource?: string,
  details?: string,
  ipAddress: string = '127.0.0.1'
): Promise<void> {
  const db = await getDb();
  let log: AuditLog;

  if (typeof actor === 'object' && actor !== null && actor.id) {
    log = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      actorId: actor.id,
      actorEmail: actor.email || actor.username,
      actorRole: actor.role || 'user',
      action: actionOrEmail,
      targetResource: detailsOrRole,
      details: ipOrAction || detailsOrRole,
      ipAddress: targetResource || '127.0.0.1',
      createdAt: new Date().toISOString()
    };
  } else {
    log = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      actorId: String(actor),
      actorEmail: actionOrEmail,
      actorRole: detailsOrRole,
      action: ipOrAction || 'ACTION',
      targetResource: targetResource || 'system',
      details: details || '',
      ipAddress,
      createdAt: new Date().toISOString()
    };
  }

  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  saveDbSync();
}


export function requireApiScope(requiredScope: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const apiKey = (req as any).apiKey;
    if (!apiKey) return next(); // Fallback if using standard session auth (which wouldn't have apiKey)
    
    const scopes = apiKey.scopes || [];
    if (!scopes.includes(requiredScope) && !scopes.includes('*')) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `Missing required scope: ${requiredScope}` } });
    }
    next();
  }
}
