import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import { checkServerAccess, logServerAudit } from '../middleware/serverAuth';
import { getDb, saveDbSync } from '../db';
import { SubUser, SubUserCandidate } from '../../src/types';
import { closeUserConsoleClient } from '../consoleWs';

export const subusersRouter = Router({ mergeParams: true });

const AddSubUserSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
  expiresAt: z.string().nullable().optional()
});

const UpdateSubUserSchema = z.object({
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
  expiresAt: z.string().nullable().optional()
});

// GET /api/v1/servers/:id/subusers - List subusers
subusersRouter.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const serverId = req.params.id as string;
  const access = await checkServerAccess(req, res, serverId, 'subusers.view');
  if (!access) return;

  const { server, db } = access;
  const rawSubusers = (db.subusers || []).filter(s => s.serverId === server.id);

  const subusersList: SubUser[] = rawSubusers.map(sub => {
    const user = db.users.find(u => u.id === sub.userId);
    return {
      id: sub.id,
      userId: sub.userId,
      serverId: sub.serverId,
      email: user?.email || 'unknown',
      username: user?.username || 'unknown',
      displayName: user?.displayName || user?.username || 'Unknown User',
      avatarUrl: user?.avatarUrl,
      permissions: sub.permissions || [],
      expiresAt: (sub as any).expiresAt || null,
      lastSeenAt: user?.lastLoginAt || null,
      createdAt: sub.createdAt || new Date().toISOString()
    };
  });

  return res.json({ success: true, data: subusersList });
});

// GET /api/v1/servers/:id/subusers/candidates?q= - Find eligible users for invite
subusersRouter.get('/candidates', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const serverId = req.params.id as string;
  const access = await checkServerAccess(req, res, serverId, 'subusers.create');
  if (!access) return;

  const { server, db } = access;
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const existingSubUserIds = new Set((db.subusers || []).filter(s => s.serverId === server.id).map(s => s.userId));
  existingSubUserIds.add(server.userId); // Exclude server owner

  const matched = (db.users || [])
    .filter(u => {
      if (existingSubUserIds.has(u.id)) return false;
      if (!query) return true;
      return (
        u.email.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query) ||
        (u.displayName && u.displayName.toLowerCase().includes(query))
      );
    })
    .slice(0, 10)
    .map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.displayName || u.username,
      avatarUrl: u.avatarUrl
    } as SubUserCandidate));

  return res.json({ success: true, data: matched });
});

// POST /api/v1/servers/:id/subusers - Invite/Add subuser
subusersRouter.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const serverId = req.params.id as string;
  const access = await checkServerAccess(req, res, serverId, 'subusers.create');
  if (!access) return;

  const { server, db, isOwner, isAdmin, requesterSubuser } = access;

  const parsed = AddSubUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid payload' }
    });
  }

  const { emailOrUsername, permissions, expiresAt } = parsed.data;

  // Escalation check: Cannot grant permissions granter does not possess
  if (!isOwner && !isAdmin && requesterSubuser) {
    const missingPerms = permissions.filter(p => !requesterSubuser.permissions.includes(p));
    if (missingPerms.length > 0) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: `Cannot grant permissions you lack: ${missingPerms.join(', ')}` }
      });
    }
  }

  // Lookup target user
  const targetUser = db.users.find(
    u => u.email.toLowerCase() === emailOrUsername.toLowerCase() ||
         u.username.toLowerCase() === emailOrUsername.toLowerCase()
  );

  if (!targetUser) {
    return res.status(404).json({
      error: { code: 'USER_NOT_FOUND', message: 'No registered user matches that email or username.' }
    });
  }

  if (targetUser.id === server.userId) {
    return res.status(400).json({
      error: { code: 'INVALID_SUBUSER', message: 'The server owner cannot be added as a subuser.' }
    });
  }

  const alreadySub = (db.subusers || []).find(s => s.serverId === server.id && s.userId === targetUser.id);
  if (alreadySub) {
    return res.status(409).json({
      error: { code: 'ALREADY_SUBUSER', message: 'This user is already a subuser on this server.' }
    });
  }

  const newSubuser = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    installationId: server.installationId,
    serverId: server.id,
    userId: targetUser.id,
    permissions,
    expiresAt: expiresAt || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!db.subusers) {
    db.subusers = [];
  }
  db.subusers.push(newSubuser);
  saveDbSync();

  await logServerAudit(
    req,
    server.id,
    'SUBUSER_CREATE',
    `Added subuser ${targetUser.username} (${targetUser.email}) with ${permissions.length} permissions`
  );

  const enrichedSubuser: SubUser = {
    id: newSubuser.id,
    userId: targetUser.id,
    serverId: server.id,
    email: targetUser.email,
    username: targetUser.username,
    displayName: targetUser.displayName || targetUser.username,
    avatarUrl: targetUser.avatarUrl,
    permissions: newSubuser.permissions,
    expiresAt: newSubuser.expiresAt,
    lastSeenAt: targetUser.lastLoginAt || null,
    createdAt: newSubuser.createdAt
  };

  return res.status(201).json({ success: true, data: enrichedSubuser });
});

// PATCH /api/v1/servers/:id/subusers/:userId - Update subuser permissions and expiry
subusersRouter.patch('/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const serverId = req.params.id as string;
  const targetUserId = req.params.userId as string;
  const access = await checkServerAccess(req, res, serverId, 'subusers.update');
  if (!access) return;

  const { server, db, isOwner, isAdmin, requesterSubuser } = access;

  // Cannot modify own permissions to prevent privilege escalation
  if (targetUserId === req.user!.id && !isOwner && !isAdmin) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'You cannot modify your own permissions.' }
    });
  }

  const parsed = UpdateSubUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid payload' }
    });
  }

  const { permissions, expiresAt } = parsed.data;

  // Find subuser record by userId OR subuser id
  const subuser = (db.subusers || []).find(
    s => s.serverId === server.id && (s.userId === targetUserId || s.id === targetUserId)
  );

  if (!subuser) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Subuser not found on this server.' }
    });
  }

  // Escalation check
  if (!isOwner && !isAdmin && requesterSubuser) {
    const missingPerms = permissions.filter(p => !requesterSubuser.permissions.includes(p));
    if (missingPerms.length > 0) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: `Cannot grant permissions you lack: ${missingPerms.join(', ')}` }
      });
    }
  }

  subuser.permissions = permissions;
  if (expiresAt !== undefined) {
    (subuser as any).expiresAt = expiresAt;
  }
  subuser.updatedAt = new Date().toISOString();
  saveDbSync();

  // If console access was revoked, kick from active WebSocket console
  if (!permissions.includes('console.view')) {
    closeUserConsoleClient(server.id, subuser.userId, 'Console access revoked by administrator.');
  }

  const user = db.users.find(u => u.id === subuser.userId);
  await logServerAudit(
    req,
    server.id,
    'SUBUSER_UPDATE',
    `Updated subuser ${user?.username || subuser.userId} permissions`
  );

  const enrichedSubuser: SubUser = {
    id: subuser.id,
    userId: subuser.userId,
    serverId: server.id,
    email: user?.email || 'unknown',
    username: user?.username || 'unknown',
    displayName: user?.displayName || user?.username || 'Unknown User',
    avatarUrl: user?.avatarUrl,
    permissions: subuser.permissions,
    expiresAt: (subuser as any).expiresAt || null,
    lastSeenAt: user?.lastLoginAt || null,
    createdAt: subuser.createdAt
  };

  return res.json({ success: true, data: enrichedSubuser });
});

// DELETE /api/v1/servers/:id/subusers/:userId - Revoke subuser access
subusersRouter.delete('/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const serverId = req.params.id as string;
  const targetUserId = req.params.userId as string;
  const access = await checkServerAccess(req, res, serverId, 'subusers.delete');
  if (!access) return;

  const { server, db } = access;

  const index = (db.subusers || []).findIndex(
    s => s.serverId === server.id && (s.userId === targetUserId || s.id === targetUserId)
  );

  if (index === -1) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Subuser not found on this server.' }
    });
  }

  const removedSub = db.subusers[index];

  // Self-revoke check
  if (removedSub.userId === req.user!.id) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'You cannot revoke your own subuser access.' }
    });
  }

  db.subusers.splice(index, 1);
  saveDbSync();

  closeUserConsoleClient(server.id, removedSub.userId, 'Server access has been revoked.');

  const user = db.users.find(u => u.id === removedSub.userId);
  await logServerAudit(
    req,
    server.id,
    'SUBUSER_DELETE',
    `Revoked subuser ${user?.username || removedSub.userId} access`
  );

  return res.json({ success: true, message: 'Subuser access revoked successfully.' });
});

// GET /api/v1/servers/:id/subusers/:userId/activity - Subuser audit log history
subusersRouter.get('/:userId/activity', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const serverId = req.params.id as string;
  const targetUserId = req.params.userId as string;
  const access = await checkServerAccess(req, res, serverId, 'subusers.view');
  if (!access) return;

  const { server, db } = access;

  // Resolve actual user ID if passed subuser record ID
  const subuser = (db.subusers || []).find(
    s => s.serverId === server.id && (s.userId === targetUserId || s.id === targetUserId)
  );
  const actualUserId = subuser ? subuser.userId : targetUserId;

  const userLogs = (db.auditLogs || [])
    .filter(log => log.actorId === actualUserId && log.targetResource === server.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);

  return res.json({ success: true, data: userLogs });
});
