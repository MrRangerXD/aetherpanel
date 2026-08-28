import { DatabaseSchema } from '../db';
import { User, UserAllocationStatus } from '../../src/types';

/**
 * AetherPanel Authoritative Server Allocation Service
 * Single source of truth for user server quotas, admin grants, and limits.
 */

export function countOwnedServers(db: DatabaseSchema, userId: string): number {
  if (!db || !Array.isArray(db.servers)) return 0;
  return db.servers.filter(s => s.userId === userId).length;
}

export function getUserAllocationStatus(db: DatabaseSchema, userOrId: User | string): UserAllocationStatus {
  const user = typeof userOrId === 'string'
    ? db.users.find(u => u.id === userOrId || u.email.toLowerCase() === userOrId.toLowerCase())
    : userOrId;

  if (!user) {
    throw new Error('User not found');
  }

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const used = countOwnedServers(db, user.id);

  // Compute Base Allocation (default: 1 for users, 50 for admins)
  let baseAlloc = 1;
  if (typeof user.baseServerAllocations === 'number') {
    baseAlloc = user.baseServerAllocations;
  } else if (typeof user.serverLimit === 'number') {
    baseAlloc = user.serverLimit;
  } else if (isAdmin) {
    baseAlloc = 50;
  }

  // Compute Admin Extra Allocations (default: 0)
  const extraAlloc = typeof user.adminGrantedAllocations === 'number' ? user.adminGrantedAllocations : 0;

  // Plan info
  const plan = user.plan || 'free';

  if (isAdmin) {
    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role,
      plan: 'admin',
      baseServerAllocations: baseAlloc,
      adminGrantedAllocations: extraAlloc,
      limit: null,
      used,
      remaining: null,
      unlimited: true
    };
  }

  const limit = Math.max(0, baseAlloc + extraAlloc);
  const remaining = Math.max(0, limit - used);

  return {
    userId: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
    plan,
    baseServerAllocations: baseAlloc,
    adminGrantedAllocations: extraAlloc,
    limit,
    used,
    remaining,
    unlimited: false
  };
}

export function canUserDeployServer(db: DatabaseSchema, user: User): {
  allowed: boolean;
  status: UserAllocationStatus;
  errorCode?: string;
  errorMessage?: string;
} {
  const status = getUserAllocationStatus(db, user);

  if (status.unlimited) {
    return { allowed: true, status };
  }

  if (status.remaining !== null && status.remaining <= 0) {
    return {
      allowed: false,
      status,
      errorCode: 'SERVER_ALLOCATION_LIMIT_REACHED',
      errorMessage: 'Your current plan does not support additional server allocations. Upgrade your plan or purchase additional allocations.'
    };
  }

  return { allowed: true, status };
}

export interface AdjustAllocationOptions {
  action?: 'grant' | 'remove' | 'set';
  amount?: number;
  baseServerAllocations?: number;
  adminGrantedAllocations?: number;
  serverLimit?: number;
}

export function adjustUserAllocations(
  db: DatabaseSchema,
  targetUserIdOrEmail: string,
  options: AdjustAllocationOptions
): {
  success: boolean;
  status?: UserAllocationStatus;
  error?: { code: string; message: string; details?: any };
} {
  const targetUser = db.users.find(
    u => u.id === targetUserIdOrEmail || u.email.toLowerCase() === targetUserIdOrEmail.toLowerCase()
  );

  if (!targetUser) {
    return {
      success: false,
      error: { code: 'USER_NOT_FOUND', message: `User '${targetUserIdOrEmail}' was not found.` }
    };
  }

  const isAdmin = targetUser.role === 'admin' || targetUser.role === 'super_admin';
  const currentOwned = countOwnedServers(db, targetUser.id);

  let currentBase = typeof targetUser.baseServerAllocations === 'number'
    ? targetUser.baseServerAllocations
    : (typeof targetUser.serverLimit === 'number' ? targetUser.serverLimit : (isAdmin ? 50 : 1));

  let currentExtra = typeof targetUser.adminGrantedAllocations === 'number'
    ? targetUser.adminGrantedAllocations
    : 0;

  let newBase = currentBase;
  let newExtra = currentExtra;

  if (options.action === 'grant') {
    const grantAmount = typeof options.amount === 'number' ? options.amount : 1;
    if (grantAmount <= 0) {
      return {
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Grant amount must be a positive integer.' }
      };
    }
    newExtra += grantAmount;
  } else if (options.action === 'remove') {
    const removeAmount = typeof options.amount === 'number' ? options.amount : 1;
    if (removeAmount <= 0) {
      return {
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Remove amount must be a positive integer.' }
      };
    }
    newExtra = Math.max(0, newExtra - removeAmount);
  } else if (options.action === 'set') {
    if (typeof options.adminGrantedAllocations === 'number') {
      if (options.adminGrantedAllocations < 0) {
        return {
          success: false,
          error: { code: 'INVALID_AMOUNT', message: 'Admin extra allocations cannot be negative.' }
        };
      }
      newExtra = options.adminGrantedAllocations;
    }
    if (typeof options.baseServerAllocations === 'number') {
      if (options.baseServerAllocations < 0) {
        return {
          success: false,
          error: { code: 'INVALID_AMOUNT', message: 'Base server allocations cannot be negative.' }
        };
      }
      newBase = options.baseServerAllocations;
    }
    if (typeof options.serverLimit === 'number') {
      if (options.serverLimit < 0) {
        return {
          success: false,
          error: { code: 'INVALID_AMOUNT', message: 'Server limit cannot be negative.' }
        };
      }
      // If setting total limit directly: set base to 1 and remaining to extra, or preserve base
      if (options.serverLimit >= newBase) {
        newExtra = options.serverLimit - newBase;
      } else {
        newBase = options.serverLimit;
        newExtra = 0;
      }
    }
  } else {
    // Default fallback if serverLimit or adminGrantedAllocations passed directly
    if (typeof options.adminGrantedAllocations === 'number') {
      newExtra = Math.max(0, options.adminGrantedAllocations);
    }
    if (typeof options.baseServerAllocations === 'number') {
      newBase = Math.max(0, options.baseServerAllocations);
    }
    if (typeof options.serverLimit === 'number') {
      const targetLimit = Math.max(0, options.serverLimit);
      if (targetLimit >= newBase) {
        newExtra = targetLimit - newBase;
      } else {
        newBase = targetLimit;
        newExtra = 0;
      }
    }
  }

  const newTotalLimit = newBase + newExtra;

  // Safe reduction enforcement:
  // Cannot reduce allocation limit below currently used server count for non-admin users
  if (!isAdmin && newTotalLimit < currentOwned) {
    return {
      success: false,
      error: {
        code: 'ALLOCATION_BELOW_USAGE',
        message: "Allocation limit cannot be reduced below the user's currently used server allocations.",
        details: {
          currentUsage: currentOwned,
          requestedLimit: newTotalLimit
        }
      }
    };
  }

  // Update target user record
  targetUser.baseServerAllocations = newBase;
  targetUser.adminGrantedAllocations = newExtra;
  targetUser.serverLimit = newTotalLimit;
  targetUser.updatedAt = new Date().toISOString();

  const status = getUserAllocationStatus(db, targetUser);
  return { success: true, status };
}

/**
 * Migration helper to ensure all users have valid, safe allocation fields
 */
export function migrateUserAllocations(db: DatabaseSchema): void {
  if (!db || !Array.isArray(db.users)) return;

  db.users.forEach(u => {
    const isAdmin = u.role === 'admin' || u.role === 'super_admin';
    const ownedCount = countOwnedServers(db, u.id);

    if (isAdmin) {
      if (u.baseServerAllocations === undefined) u.baseServerAllocations = 50;
      if (u.adminGrantedAllocations === undefined) u.adminGrantedAllocations = 0;
      u.serverLimit = 50;
    } else {
      if (u.baseServerAllocations === undefined) {
        const existingLimit = typeof u.serverLimit === 'number' ? u.serverLimit : 1;
        u.baseServerAllocations = Math.max(1, existingLimit, ownedCount);
      }
      if (u.adminGrantedAllocations === undefined) {
        u.adminGrantedAllocations = 0;
      }
      if (u.baseServerAllocations + u.adminGrantedAllocations < ownedCount) {
        u.baseServerAllocations = Math.max(1, ownedCount - u.adminGrantedAllocations);
      }
      u.serverLimit = u.baseServerAllocations + u.adminGrantedAllocations;
    }
  });
}
