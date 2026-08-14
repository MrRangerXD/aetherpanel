import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const db = await getDb();
    const user = db.users.find(u => u.id === decoded.id && !u.isSuspended);
    return user || null;
  } catch (err) {
    return null;
  }
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.headers.authorization?.replace('Bearer ', '');
  if (!token && req.cookies && req.cookies.aether_token) {
    token = req.cookies.aether_token;
  }

  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication token required.' } });
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
