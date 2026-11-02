import { Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { AuthenticatedRequest, createAuditLog } from '../auth';
import { Server, SubUser } from '../../src/types';

export interface ServerAccessResult {
  server: Server;
  db: any;
  isOwner: boolean;
  isAdmin: boolean;
  requesterSubuser?: any;
}

/**
 * Validates authenticated request against server ownership, admin override, or subuser permission.
 */
export async function checkServerAccess(
  req: AuthenticatedRequest,
  res: Response,
  serverId: string,
  requiredPermission?: string
): Promise<ServerAccessResult | null> {
  const db = await getDb();
  const server = db.servers.find((s: Server) => s.id === serverId);

  if (!server) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Server not found.' }
    });
    return null;
  }

  const isOwner = server.userId === req.user!.id;
  const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user!.role);

  // Check subusers
  if (!db.subusers) {
    db.subusers = [];
  }
  const subuser = db.subusers.find((s: any) => s.serverId === serverId && s.userId === req.user!.id);

  if (!isOwner && !isAdmin) {
    if (!subuser) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this server.' }
      });
      return null;
    }

    // Check expiry
    if (subuser.expiresAt && new Date(subuser.expiresAt).getTime() < Date.now()) {
      res.status(403).json({
        success: false,
        error: { code: 'SUBUSER_EXPIRED', message: 'Your sub-user access to this server has expired.' }
      });
      return null;
    }

    if (requiredPermission) {
      if (!subuser.permissions.includes(requiredPermission)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Required permission '${requiredPermission}' is missing.`
          }
        });
        return null;
      }
    }
  }

  // Update subuser lastSeenAt
  if (subuser) {
    subuser.lastSeenAt = new Date().toISOString();
    saveDbSync();
  }

  return { server, db, isOwner, isAdmin, requesterSubuser: subuser };
}

/**
 * Enforces server lifecycle safety: refuses mutations while starting/stopping.
 */
export function checkServerStateSafety(server: Server, res: Response): boolean {
  if (server.status === 'starting' || server.status === 'stopping') {
    res.status(409).json({
      success: false,
      error: {
        code: 'SERVER_BUSY',
        message: `Operation refused: Server is currently ${server.status}. Wait until it finishes.`
      }
    });
    return false;
  }
  return true;
}

/**
 * Creates an audit log entry for server actions.
 */
export async function logServerAudit(
  req: AuthenticatedRequest,
  serverId: string,
  action: string,
  detail: string
): Promise<void> {
  const actor = req.user?.username || req.user?.email || 'system';
  await createAuditLog(
    req.user?.id || 'system',
    req.user?.email || 'system',
    req.user?.role || 'user',
    `SERVER_${action.toUpperCase()}`,
    serverId,
    `[${actor}] ${detail}`
  );
}
