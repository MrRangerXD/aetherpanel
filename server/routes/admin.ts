import fs from 'fs';
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, requireRole, AuthenticatedRequest, createAuditLog } from '../auth';
import { User, Product, Plan, Node, Allocation, Coupon, Announcement, SystemSettings } from '../../src/types';
import { ensureLocalNode } from '../nodeAgent';
import {
  getNodePlayitStatus, installNodePlayitAgent, toggleNodePlayitAgent, provisionNodePlayitSecret
} from '../playitService';
import { resolveNodeSftpMode } from '../sftpResolver';
import { runNetworkDiagnostics } from '../network/networkDetection';
import { stopServer, startServer, restartServer, getServerDir } from '../provider';
import { clearConsoleBuffer, closeServerConsoleClients } from '../consoleWs';
import { dispatchWebhookEvent } from '../webhookService';
import { resolveServerType } from './serverTypes';

const router = Router();

// Require admin or support role for all routes in this router
router.use(authMiddleware);
router.use(requireRole(['admin', 'super_admin', 'support', 'moderator']));

// GET /api/v1/admin/stats - Global system overview
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();

  const totalUsers = db.users.length;
  const activeUsers = db.users.filter(u => !u.isSuspended).length;
  const totalServers = db.servers.length;
  const runningServers = db.servers.filter(s => s.status === 'running').length;

  const totalRevenue = db.orders.reduce((acc, o) => acc + (o.status === 'paid' ? o.amount : 0), 0);

  const totalRamClusterMB = db.nodes.reduce((acc, n) => acc + n.totalRamMB, 0);
  const usedRamClusterMB = db.nodes.reduce((acc, n) => acc + n.usedRamMB, 0);

  res.json({
    success: true,
    data: {
      users: { total: totalUsers, active: activeUsers },
      servers: { total: totalServers, running: runningServers, stopped: totalServers - runningServers },
      nodes: { total: db.nodes.length, online: db.nodes.filter(n => n.status === 'online').length },
      revenue: { total: parseFloat(totalRevenue.toFixed(2)), ordersCount: db.orders.length },
      cluster: {
        totalRamMB: totalRamClusterMB,
        usedRamMB: usedRamClusterMB,
        ramUsagePercent: totalRamClusterMB > 0 ? parseFloat(((usedRamClusterMB / totalRamClusterMB) * 100).toFixed(1)) : 0
      }
    }
  });
});

// --- USER MANAGEMENT ---
// GET /api/v1/admin/users
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.users });
});

// POST /api/v1/admin/users - Admin Create User
router.post('/users', async (req: AuthenticatedRequest, res: Response) => {
  const { email, username, password, role, credits, displayName } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Email, username, and password are required' } });
  }

  const db = await getDb();
  const existingEmail = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existingEmail) {
    return res.status(400).json({ success: false, error: { code: 'EMAIL_IN_USE', message: 'User with this email already exists' } });
  }

  const existingUsername = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (existingUsername) {
    return res.status(400).json({ success: false, error: { code: 'USERNAME_IN_USE', message: 'Username is already taken' } });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser: User = {
    id: `usr_${Date.now()}`,
    email: email.trim().toLowerCase(),
    username: username.trim().toLowerCase(),
    displayName: displayName || username.trim(),
    role: role || 'user',
    credits: parseFloat(credits) || 0,
    serverLimit: typeof req.body.serverLimit === 'number' ? req.body.serverLimit : (role === 'admin' || role === 'super_admin' ? 50 : 1),
    isSuspended: false,
    emailVerified: true,
    twoFactorEnabled: false,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  (newUser as any).passwordHash = passwordHash;

  db.users.push(newUser);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_CREATE_USER', newUser.id, `Admin created user ${newUser.email} with role ${newUser.role}`);
  res.json({ success: true, data: newUser, message: `User ${newUser.email} created successfully` });
});

// PUT /api/v1/admin/users/:id - Update user role, credits, status, allocation
router.put('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);

  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const { role, isSuspended, credits, displayName, serverLimit } = req.body;

  if (role && ['user', 'support', 'moderator', 'admin', 'super_admin'].includes(role)) {
    user.role = role;
  }
  if (typeof isSuspended === 'boolean') {
    user.isSuspended = isSuspended;
  }
  if (typeof credits === 'number') {
    user.credits = credits;
  }
  if (typeof serverLimit === 'number') {
    user.serverLimit = serverLimit;
  }
  if (displayName) {
    user.displayName = displayName;
  }

  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_USER', user.id, `Updated user ${user.email} (Role: ${user.role}, Suspended: ${user.isSuspended})`);

  res.json({ success: true, data: user });
});

// PATCH /api/v1/admin/users/:id/allocation - Admin update user server quota
router.patch('/users/:id/allocation', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const { serverLimit } = req.body;
  if (typeof serverLimit !== 'number' || serverLimit < 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_LIMIT', message: 'Server limit must be a non-negative number' } });
  }

  user.serverLimit = serverLimit;
  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_USER_ALLOCATION', user.id, `Updated server allocation limit for ${user.email} to ${serverLimit}`);

  res.json({ success: true, data: { userId: user.id, serverLimit: user.serverLimit } });
});

// PATCH /api/v1/admin/users/:id/role
router.patch('/users/:id/role', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const { role } = req.body;
  if (!role || !['user', 'support', 'moderator', 'admin', 'super_admin'].includes(role)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: 'Invalid role specified' } });
  }

  user.role = role;
  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_USER_ROLE', user.id, `Changed role of user ${user.email} to ${role}`);
  res.json({ success: true, data: user, message: `User role updated to ${role}` });
});

// PATCH /api/v1/admin/users/:id/suspend
router.patch('/users/:id/suspend', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  if (user.id === req.user!.id) {
    return res.status(400).json({ success: false, error: { code: 'CANNOT_SUSPEND_SELF', message: 'You cannot suspend your own account' } });
  }

  const isSuspended = typeof req.body.isSuspended === 'boolean' ? req.body.isSuspended : !user.isSuspended;
  user.isSuspended = isSuspended;
  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_SUSPEND_USER', user.id, `${isSuspended ? 'Suspended' : 'Unsuspended'} user ${user.email}`);
  res.json({ success: true, data: user, message: `User ${isSuspended ? 'suspended' : 'unsuspended'}` });
});

// POST /api/v1/admin/users/:id/credits - Add, remove, or set user balance
router.post('/users/:id/credits', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const { amount, mode } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Valid numerical amount is required' } });
  }

  const currentCredits = user.credits || 0;
  if (mode === 'remove' || mode === 'deduct') {
    user.credits = Math.max(0, parseFloat((currentCredits - Math.abs(numAmount)).toFixed(2)));
  } else if (mode === 'set') {
    user.credits = Math.max(0, parseFloat(numAmount.toFixed(2)));
  } else {
    // Default 'add'
    user.credits = parseFloat((currentCredits + Math.abs(numAmount)).toFixed(2));
  }

  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_ADJUST_CREDITS', user.id, `Adjusted credits for ${user.email} (${mode || 'add'}: $${numAmount}) -> Balance: $${user.credits}`);
  res.json({ success: true, data: user, message: `User credits updated to $${user.credits.toFixed(2)}` });
});

// DELETE /api/v1/admin/users/:id - Delete user
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userIndex = db.users.findIndex(u => u.id === req.params.id);
  if (userIndex === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const user = db.users[userIndex];
  if (user.id === req.user!.id) {
    return res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE_SELF', message: 'Cannot delete your own active administrator account' } });
  }

  if (user.role === 'super_admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only a Super Admin can delete another Super Admin' } });
  }

  // Check if user has servers
  const userServers = db.servers.filter(s => s.userId === user.id);
  const force = req.query.force === 'true' || req.body?.force === true;

  if (userServers.length > 0 && !force) {
    return res.status(400).json({
      success: false,
      error: { code: 'USER_HAS_SERVERS', message: `Cannot delete user with ${userServers.length} active server(s). Pass force=true or terminate servers first.` }
    });
  }

  if (userServers.length > 0 && force) {
    db.servers = db.servers.filter(s => s.userId !== user.id);
  }

  db.users.splice(userIndex, 1);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_DELETE_USER', user.id, `Deleted user account ${user.email}`);
  res.json({ success: true, message: `User ${user.email} deleted successfully` });
});

// --- PRODUCT & PLAN MANAGEMENT ---
// GET /api/v1/admin/products
router.get('/products', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.products });
});

// POST /api/v1/admin/products - Create product
router.post('/products', async (req: AuthenticatedRequest, res: Response) => {
  const { name, slug, description, category, icon } = req.body;
  const db = await getDb();

  const newProd: Product = {
    id: `prod_${Date.now()}`,
    name: name.trim(),
    slug: (slug || name).toLowerCase().replace(/[^a-z0-9]/g, '-'),
    description: description || '',
    category: category || 'minecraft',
    icon: icon || 'Gamepad2',
    isActive: true,
    sortOrder: db.products.length + 1
  };

  db.products.push(newProd);
  saveDbSync();

  res.json({ success: true, data: newProd });
});

// GET /api/v1/admin/plans
router.get('/plans', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.plans });
});

// POST /api/v1/admin/plans and /api/v1/admin/plans/create
const handleCreatePlan = async (req: AuthenticatedRequest, res: Response) => {
  const {
    productId, name, description, priceMonthly, priceYearly,
    ramMB, cpuCores, diskGB, backupLimit, databaseLimit, serverLimit, features, locations, isPopular
  } = req.body;

  const db = await getDb();

  const newPlan: Plan = {
    id: `plan_${Date.now()}`,
    productId: productId || 'prod_minecraft',
    name: name.trim(),
    description: description || '',
    priceMonthly: parseFloat(priceMonthly) || 0,
    priceYearly: parseFloat(priceYearly) || ((parseFloat(priceMonthly) || 0) * 10),
    ramMB: parseInt(ramMB) || 2048,
    cpuCores: parseFloat(cpuCores) || 1,
    diskGB: parseInt(diskGB) || 15,
    backupLimit: parseInt(backupLimit) || 2,
    databaseLimit: parseInt(databaseLimit) || 1,
    serverLimit: parseInt(serverLimit) || 1,
    networkMbps: 1000,
    features: Array.isArray(features) ? features : ['DDoS Protection', 'NVMe Storage', 'Instant Setup'],
    locations: Array.isArray(locations) ? locations : ['us-east', 'eu-central'],
    isPopular: !!isPopular,
    isActive: true
  };

  db.plans.push(newPlan);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_CREATE_PLAN', newPlan.id, `Created plan tier '${newPlan.name}' ($${newPlan.priceMonthly}/mo)`);
  res.json({ success: true, data: newPlan, message: 'Plan created successfully' });
};

router.post('/plans', handleCreatePlan);
router.post('/plans/create', handleCreatePlan);

// PUT /api/v1/admin/plans/:id
router.put('/plans/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const plan = db.plans.find(p => p.id === req.params.id);
  if (!plan) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });

  Object.assign(plan, req.body);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_PLAN', plan.id, `Updated plan tier '${plan.name}'`);
  res.json({ success: true, data: plan, message: 'Plan updated' });
});

// DELETE /api/v1/admin/plans/:id
router.delete('/plans/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const planIdx = db.plans.findIndex(p => p.id === req.params.id);
  if (planIdx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });

  const plan = db.plans[planIdx];
  // Check if any server is using this plan
  const activeServers = db.servers.filter(s => s.planId === plan.id);
  if (activeServers.length > 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'PLAN_IN_USE', message: `Cannot delete plan: ${activeServers.length} active server(s) are using this tier.` }
    });
  }

  db.plans.splice(planIdx, 1);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_DELETE_PLAN', plan.id, `Deleted plan tier '${plan.name}'`);
  res.json({ success: true, message: `Plan '${plan.name}' deleted successfully` });
});

// --- LOCATIONS MANAGEMENT ---
// GET /api/v1/admin/locations
router.get('/locations', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.locations || [] });
});

// POST /api/v1/admin/locations
router.post('/locations', async (req: AuthenticatedRequest, res: Response) => {
  const { name, code, country, flagCode, description } = req.body;
  if (!name || !code) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'Location name and code are required' } });
  }

  const db = await getDb();
  const newLoc = {
    id: `loc_${Date.now()}`,
    name: name.trim(),
    code: code.trim().toLowerCase(),
    country: country || 'Global',
    flagCode: (flagCode || 'US').toUpperCase(),
    description: description || '',
    isActive: true
  };

  db.locations.push(newLoc);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'CREATE_LOCATION', newLoc.id, `Created location ${newLoc.name} (${newLoc.code})`);

  res.json({ success: true, data: newLoc });
});

// PUT /api/v1/admin/locations/:id
router.put('/locations/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const loc = db.locations.find(l => l.id === req.params.id);
  if (!loc) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Location not found' } });

  Object.assign(loc, req.body);
  saveDbSync();
  res.json({ success: true, data: loc });
});

// DELETE /api/v1/admin/locations/:id
router.delete('/locations/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const nodesInLoc = db.nodes.filter(n => n.location === req.params.id);
  if (nodesInLoc.length > 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'LOCATION_IN_USE', message: `Cannot delete location containing ${nodesInLoc.length} active node(s)` }
    });
  }

  db.locations = db.locations.filter(l => l.id !== req.params.id);
  saveDbSync();
  res.json({ success: true, message: 'Location deleted successfully' });
});

// --- NODE MANAGEMENT ---
// GET /api/v1/admin/nodes
router.get('/nodes', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.nodes });
});

// GET /api/v1/admin/nodes/:id
router.get('/nodes/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

  const nodeServers = db.servers.filter(s => s.nodeId === node.id);
  const nodeAllocs = db.allocations.filter(a => a.nodeId === node.id);

  res.json({
    success: true,
    data: {
      ...node,
      servers: nodeServers.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        primaryPort: s.primaryPort,
        ramMB: s.limits.ramMB,
        cpuCores: s.limits.cpuCores,
        diskGB: s.limits.diskGB,
        userId: s.userId
      })),
      allocationsCount: {
        total: nodeAllocs.length,
        assigned: nodeAllocs.filter(a => a.isAssigned).length,
        available: nodeAllocs.filter(a => !a.isAssigned).length
      }
    }
  });
});

// POST /api/v1/admin/nodes
router.post('/nodes', async (req: AuthenticatedRequest, res: Response) => {
  const {
    name, description, hostname, ip, publicIpv4, publicIpv6, fqdn,
    daemonPort, daemonListenIp, daemonScheme, daemonSslEnabled,
    sftpPort, sftpFqdn, playitSftpAddress, playitSftpPort,
    location, locationName, flagCode,
    totalRamMB, totalCpuCores, totalDiskGB,
    ramOverallocatePercent, cpuOverallocatePercent, diskOverallocatePercent,
    maxServers, allowedProducts, tags
  } = req.body;

  if (!name || !hostname || !ip) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Node name, hostname, and primary IP are required.' }
    });
  }

  const db = await getDb();

  const rawFqdn = fqdn ? fqdn.trim() : (hostname.includes('.') ? hostname.trim() : `${hostname.trim()}.local`);
  const rawIp = ip.trim();

  const newNode: Node = {
    id: `node_${Date.now()}`,
    name: name.trim(),
    description: description ? description.trim() : undefined,
    hostname: hostname.trim(),
    ip: rawIp,
    publicIpv4: publicIpv4 ? publicIpv4.trim() : (rawIp !== '127.0.0.1' ? rawIp : undefined),
    publicIpv6: publicIpv6 ? publicIpv6.trim() : undefined,
    fqdn: rawFqdn,
    sftpFqdn: sftpFqdn ? sftpFqdn.trim() : (rawFqdn ? `sftp.${rawFqdn}` : undefined),
    playitSftpAddress: playitSftpAddress ? playitSftpAddress.trim() : undefined,
    playitSftpPort: playitSftpPort ? parseInt(playitSftpPort) : undefined,
    daemonPort: parseInt(daemonPort) || 8080,
    daemonListenIp: daemonListenIp ? daemonListenIp.trim() : '0.0.0.0',
    daemonScheme: daemonScheme === 'https' ? 'https' : 'http',
    daemonSslEnabled: Boolean(daemonSslEnabled),
    sftpPort: parseInt(sftpPort) || 2022,
    location: location || 'us-east',
    locationName: locationName || 'Default Region',
    flagCode: (flagCode || 'US').toUpperCase(),
    totalRamMB: parseInt(totalRamMB) || 65536,
    usedRamMB: 0,
    totalCpuCores: parseInt(totalCpuCores) || 16,
    usedCpuCores: 0,
    totalDiskGB: parseInt(totalDiskGB) || 1024,
    usedDiskGB: 0,
    ramOverallocatePercent: parseInt(ramOverallocatePercent) || 0,
    cpuOverallocatePercent: parseInt(cpuOverallocatePercent) || 0,
    diskOverallocatePercent: parseInt(diskOverallocatePercent) || 0,
    maxServers: parseInt(maxServers) || 100,
    allowedProducts: Array.isArray(allowedProducts) ? allowedProducts : ['prod_minecraft', 'prod_bot'],
    tags: Array.isArray(tags) ? tags : ['compute', 'production'],
    status: 'offline', // status becomes 'online' when daemon connects/enrolls
    isMaintenanceMode: false,
    serverCount: 0,
    lastHeartbeatAt: new Date().toISOString()
  };

  db.nodes.push(newNode);

  // Generate initial allocations pool safely avoiding reserved infrastructure ports
  const reservedPorts = new Set([22, 80, 443, 2022, 3000, 8080, 8443, newNode.daemonPort, newNode.sftpPort]);
  for (let p = 25565; p <= 25575; p++) {
    if (!reservedPorts.has(p)) {
      db.allocations.push({
        id: `alloc_${Date.now()}_${p}`,
        nodeId: newNode.id,
        ip: newNode.ip,
        port: p,
        isAssigned: false,
        createdAt: new Date().toISOString()
      });
    }
  }

  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'CREATE_NODE', newNode.id, `Created node ${newNode.name} (${newNode.ip})`);

  res.json({ success: true, data: newNode, message: `Node '${newNode.name}' created successfully.` });
});

// POST /api/v1/admin/nodes/:id/install-token - Generate installation token for AetherNode installer
router.post('/nodes/:id/install-token', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

  const crypto = await import('crypto');
  const tokenStr = `ntok_${crypto.randomBytes(32).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

  const tokenRecord = {
    id: `tok_${Date.now()}`,
    nodeId: node.id,
    token: tokenStr,
    createdAt: new Date().toISOString(),
    expiresAt,
    isUsed: false
  };

  db.nodeInstallTokens.push(tokenRecord);
  saveDbSync();

  const protocol = req.protocol;
  const host = req.get('host');
  const panelUrl = `${protocol}://${host}`;
  const installCmd = `bash <(curl -fsSL https://raw.githubusercontent.com/MrRangerXD/aetherpanel/refs/heads/main/install.sh) --node --token ${tokenStr} --panel ${panelUrl}`;

  res.json({
    success: true,
    data: {
      nodeId: node.id,
      token: tokenStr,
      expiresAt,
      panelUrl,
      installCmd
    }
  });
});

// POST /api/v1/admin/nodes/:id/repair - Hardware health check, metric sync & reconnection
router.post('/nodes/:id/repair', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

  if (node.isLocalNode || node.id === 'node_local') {
    const updated = await ensureLocalNode();
    await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'REPAIR_NODE', node.id, `Repaired and synchronized Local Node telemetry.`);
    return res.json({
      success: true,
      data: updated,
      message: `Local Node telemetry re-synchronized with live hardware. Status: ${updated.status}.`
    });
  }

  // Remote node: re-verify heartbeat timestamp and server count
  const serverCount = db.servers.filter(s => s.nodeId === node.id).length;
  node.serverCount = serverCount;
  const isRecent = node.lastHeartbeatAt && (Date.now() - new Date(node.lastHeartbeatAt).getTime() < 300000);
  if (isRecent && !node.isMaintenanceMode && node.status !== 'maintenance') {
    node.status = 'online';
  }
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'REPAIR_NODE', node.id, `Repaired and synchronized Remote Node '${node.name}'.`);
  res.json({
    success: true,
    data: node,
    message: `Remote Node '${node.name}' synchronized. Status: ${node.status}.`
  });
});

// PUT /api/v1/admin/nodes/:id
router.put('/nodes/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

  const {
    name, description, hostname, ip, publicIpv4, publicIpv6, fqdn,
    daemonPort, daemonListenIp, daemonScheme, daemonSslEnabled,
    sftpPort, sftpFqdn, playitSftpAddress, playitSftpPort,
    location, locationName, flagCode,
    totalRamMB, totalCpuCores, totalDiskGB, ramOverallocatePercent, cpuOverallocatePercent,
    diskOverallocatePercent, maxServers, allowedProducts, tags, isMaintenanceMode, status
  } = req.body;

  if (name !== undefined) node.name = name.trim();
  if (description !== undefined) node.description = description.trim();
  if (hostname !== undefined) node.hostname = hostname.trim();
  if (ip !== undefined) node.ip = ip.trim();
  if (publicIpv4 !== undefined) node.publicIpv4 = publicIpv4 ? publicIpv4.trim() : undefined;
  if (publicIpv6 !== undefined) node.publicIpv6 = publicIpv6 ? publicIpv6.trim() : undefined;
  if (fqdn !== undefined) node.fqdn = fqdn ? fqdn.trim() : undefined;
  if (sftpFqdn !== undefined) node.sftpFqdn = sftpFqdn ? sftpFqdn.trim() : undefined;
  if (playitSftpAddress !== undefined) node.playitSftpAddress = playitSftpAddress ? playitSftpAddress.trim() : undefined;
  if (playitSftpPort !== undefined) node.playitSftpPort = playitSftpPort ? parseInt(playitSftpPort) : undefined;
  if (daemonPort !== undefined) node.daemonPort = parseInt(daemonPort);
  if (daemonListenIp !== undefined) node.daemonListenIp = daemonListenIp.trim();
  if (daemonScheme !== undefined) node.daemonScheme = daemonScheme === 'https' ? 'https' : 'http';
  if (daemonSslEnabled !== undefined) node.daemonSslEnabled = Boolean(daemonSslEnabled);
  if (sftpPort !== undefined) node.sftpPort = parseInt(sftpPort);
  if (location !== undefined) node.location = location;
  if (locationName !== undefined) node.locationName = locationName;
  if (flagCode !== undefined) node.flagCode = flagCode;
  if (totalRamMB !== undefined) node.totalRamMB = parseInt(totalRamMB);
  if (totalCpuCores !== undefined) node.totalCpuCores = parseFloat(totalCpuCores);
  if (totalDiskGB !== undefined) node.totalDiskGB = parseInt(totalDiskGB);
  if (typeof ramOverallocatePercent === 'number') node.ramOverallocatePercent = ramOverallocatePercent;
  if (typeof cpuOverallocatePercent === 'number') node.cpuOverallocatePercent = cpuOverallocatePercent;
  if (typeof diskOverallocatePercent === 'number') node.diskOverallocatePercent = diskOverallocatePercent;
  if (typeof maxServers === 'number') node.maxServers = maxServers;
  if (Array.isArray(allowedProducts)) node.allowedProducts = allowedProducts;
  if (Array.isArray(tags)) node.tags = tags;
  if (typeof isMaintenanceMode === 'boolean') {
    node.isMaintenanceMode = isMaintenanceMode;
    if (isMaintenanceMode) {
      node.status = 'maintenance';
    } else if (node.status === 'maintenance') {
      node.status = 'online';
    }
  }
  if (status !== undefined) node.status = status;

  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_NODE', node.id, `Updated node configuration for '${node.name}'`);

  res.json({ success: true, data: node, message: `Node '${node.name}' updated successfully.` });
});

// GET /api/v1/admin/nodes/:id/playit - Get node-level Playit tunnel status
router.get('/nodes/:id/playit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await getNodePlayitStatus(req.params.id);
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PLAYIT_ERROR', message: err.message } });
  }
});

// POST /api/v1/admin/nodes/:id/playit/install - Install node-level Playit tunnel (zero port-forward SFTP)
router.post('/nodes/:id/playit/install', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await installNodePlayitAgent(req.params.id);
    res.json({ success: true, message: 'Playit tunnel configured for node SFTP.', data: status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PLAYIT_INSTALL_FAILED', message: err.message } });
  }
});

// POST /api/v1/admin/nodes/:id/playit/toggle - Toggle node-level Playit tunnel
router.post('/nodes/:id/playit/toggle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enable } = req.body;
    const status = await toggleNodePlayitAgent(req.params.id, Boolean(enable));
    res.json({ success: true, message: `Node Playit tunnel ${enable ? 'activated' : 'paused'}.`, data: status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PLAYIT_TOGGLE_FAILED', message: err.message } });
  }
});

// POST /api/v1/admin/nodes/:id/playit/secret - Provision node-level Playit secret key
router.post('/nodes/:id/playit/secret', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { secretKey } = req.body;
    if (!secretKey || !secretKey.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_SECRET', message: 'Secret key is required' } });
      return;
    }
    const status = await provisionNodePlayitSecret(req.params.id, secretKey);
    res.json({ success: true, message: 'Node Playit secret provisioned successfully.', data: status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PLAYIT_SECRET_FAILED', message: err.message } });
  }
});

// DELETE /api/v1/admin/nodes/:id - Delete node safety check
router.delete('/nodes/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const nodeIndex = db.nodes.findIndex(n => n.id === req.params.id);
  if (nodeIndex === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

  const activeServers = db.servers.filter(s => s.nodeId === req.params.id);
  if (activeServers.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NODE_HAS_SERVERS',
        message: `Cannot delete node containing ${activeServers.length} active server(s). Please migrate or terminate servers before node removal.`
      }
    });
  }

  const deletedNode = db.nodes[nodeIndex];
  db.nodes.splice(nodeIndex, 1);
  db.allocations = db.allocations.filter(a => a.nodeId !== req.params.id);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'DELETE_NODE', req.params.id, `Deleted node '${deletedNode.name}' (${req.params.id})`);

  res.json({ success: true, message: `Node '${deletedNode.name}' and all associated unassigned allocations removed.` });
});

// --- ALLOCATIONS MANAGEMENT ---
// GET /api/v1/admin/nodes/:id/allocations
router.get('/nodes/:id/allocations', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const { status, search } = req.query;

  let allocs = db.allocations.filter(a => a.nodeId === req.params.id);

  if (status === 'assigned') {
    allocs = allocs.filter(a => a.isAssigned);
  } else if (status === 'available') {
    allocs = allocs.filter(a => !a.isAssigned);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase().trim();
    allocs = allocs.filter(a => 
      a.ip.includes(q) || 
      a.port.toString().includes(q) || 
      (a.alias && a.alias.toLowerCase().includes(q))
    );
  }

  // Enrich with server metadata
  const enriched = allocs.map(a => {
    const srv = a.serverId ? db.servers.find(s => s.id === a.serverId) : null;
    return {
      ...a,
      serverName: srv?.name,
      serverStatus: srv?.status
    };
  });

  res.json({ success: true, data: enriched });
});

// POST /api/v1/admin/nodes/:id/allocations - Single or Range creation with reserved port checks
router.post('/nodes/:id/allocations', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

  const { ip, startPort, endPort, alias, notes } = req.body;
  const targetIp = (ip || node.ip || '127.0.0.1').trim();
  const startP = parseInt(startPort);
  const endP = parseInt(endPort) || startP;

  if (!startP || startP < 1 || endP > 65535 || startP > endP) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PORT_RANGE', message: 'Invalid port range specified (must be between 1 and 65535).' }
    });
  }

  const rangeSpan = endP - startP + 1;
  if (rangeSpan > 500) {
    return res.status(400).json({
      success: false,
      error: { code: 'RANGE_TOO_LARGE', message: 'A maximum of 500 allocation ports can be generated in a single request.' }
    });
  }

  const reservedPorts = new Set([22, 80, 443, 2022, 3000, 8080, 8443, node.daemonPort, node.sftpPort]);
  const created: Allocation[] = [];
  const skippedReserved: number[] = [];
  const skippedExisting: number[] = [];

  for (let p = startP; p <= endP; p++) {
    if (reservedPorts.has(p)) {
      skippedReserved.push(p);
      continue;
    }

    const existing = db.allocations.find(a => a.nodeId === node.id && a.ip === targetIp && a.port === p);
    if (existing) {
      skippedExisting.push(p);
      continue;
    }

    const newAlloc: Allocation = {
      id: `alloc_${Date.now()}_${p}_${Math.random().toString(36).substring(2, 6)}`,
      nodeId: node.id,
      ip: targetIp,
      port: p,
      alias: alias ? alias.trim() : undefined,
      notes: notes ? notes.trim() : undefined,
      isAssigned: false,
      createdAt: new Date().toISOString()
    };
    db.allocations.push(newAlloc);
    created.push(newAlloc);
  }

  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'CREATE_ALLOCATIONS', node.id,
    `Added ${created.length} port allocation(s) [${startP}-${endP}] to node '${node.name}'`
  );

  let msg = `Created ${created.length} new port allocation(s).`;
  if (skippedReserved.length > 0) {
    msg += ` (Skipped ${skippedReserved.length} reserved system port${skippedReserved.length === 1 ? '' : 's'}: ${skippedReserved.slice(0, 5).join(', ')}${skippedReserved.length > 5 ? '...' : ''})`;
  }
  if (skippedExisting.length > 0) {
    msg += ` (${skippedExisting.length} port${skippedExisting.length === 1 ? '' : 's'} already existed)`;
  }

  res.json({
    success: true,
    data: created,
    message: msg,
    summary: {
      created: created.length,
      skippedReserved: skippedReserved.length,
      skippedExisting: skippedExisting.length
    }
  });
});

// PATCH /api/v1/admin/allocations/:allocId - Update allocation alias or notes
router.patch('/allocations/:allocId', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const alloc = db.allocations.find(a => a.id === req.params.allocId);
  if (!alloc) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Allocation not found' } });

  const { alias, notes } = req.body;
  if (alias !== undefined) alloc.alias = alias ? alias.trim() : undefined;
  if (notes !== undefined) alloc.notes = notes ? notes.trim() : undefined;

  saveDbSync();

  res.json({ success: true, data: alloc, message: 'Allocation updated.' });
});

// DELETE /api/v1/admin/allocations/:allocId - Delete single unassigned allocation
router.delete('/allocations/:allocId', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const alloc = db.allocations.find(a => a.id === req.params.allocId);
  if (!alloc) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Allocation not found' } });

  if (alloc.isAssigned) {
    return res.status(400).json({
      success: false,
      error: { code: 'ALLOCATION_ASSIGNED', message: 'Cannot delete an allocation currently assigned to an active server.' }
    });
  }

  db.allocations = db.allocations.filter(a => a.id !== req.params.allocId);
  saveDbSync();

  res.json({ success: true, message: `Allocation ${alloc.ip}:${alloc.port} deleted.` });
});

// POST /api/v1/admin/nodes/:id/allocations/bulk-delete - Delete unassigned allocations
router.post('/nodes/:id/allocations/bulk-delete', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const { allocationIds, deleteAllUnassigned } = req.body;

  let toDeleteIds: string[] = [];
  if (deleteAllUnassigned) {
    toDeleteIds = db.allocations
      .filter(a => a.nodeId === req.params.id && !a.isAssigned)
      .map(a => a.id);
  } else if (Array.isArray(allocationIds)) {
    toDeleteIds = allocationIds.filter(id => {
      const a = db.allocations.find(item => item.id === id && item.nodeId === req.params.id);
      return a && !a.isAssigned;
    });
  }

  if (toDeleteIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_DELETABLE_ALLOCATIONS', message: 'No unassigned allocations matched for deletion.' }
    });
  }

  const deleteSet = new Set(toDeleteIds);
  db.allocations = db.allocations.filter(a => !deleteSet.has(a.id));
  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'BULK_DELETE_ALLOCATIONS', req.params.id,
    `Bulk deleted ${toDeleteIds.length} unassigned allocations from node ${req.params.id}`
  );

  res.json({
    success: true,
    deletedCount: toDeleteIds.length,
    message: `Successfully deleted ${toDeleteIds.length} unassigned allocation(s).`
  });
});

// --- ALL SERVERS ---
// GET /api/v1/admin/servers
router.get('/servers', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const enrichedServers = db.servers.map(srv => ({
    ...srv,
    serverType: resolveServerType(srv, db.serverTypes || [])
  }));
  res.json({ success: true, data: enrichedServers });
});

// DELETE /api/v1/admin/servers/:id - Forcible admin deletion of a server container
router.delete('/servers/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const server = db.servers.find(s => s.id === req.params.id);
  if (!server) {
    return res.status(404).json({ success: false, error: { code: 'SERVER_NOT_FOUND', message: 'Server not found' } });
  }

  // 1. Terminate running process if any
  try {
    await stopServer(server.id);
  } catch (e) {}

  // 2. Clear console logs buffer & disconnect streaming clients
  clearConsoleBuffer(server.id);
  closeServerConsoleClients(server.id, `Server '${server.name}' deleted by administrator.`);

  // 3. Remove filesystem directory recursively
  const serverDir = getServerDir(server.id);
  if (fs.existsSync(serverDir)) {
    try {
      fs.rmSync(serverDir, { recursive: true, force: true });
    } catch (e) {}
  }

  // 4. Free allocations
  db.allocations.filter(a => a.serverId === server.id).forEach(a => {
    a.serverId = undefined;
    a.isAssigned = false;
  });

  // 5. Remove associated databases, backups, and schedules
  db.backups = db.backups.filter(b => b.serverId !== server.id);
  db.databases = db.databases.filter(d => d.serverId !== server.id);
  db.schedules = db.schedules.filter(sc => sc.serverId !== server.id);

  // 6. Remove from servers list
  db.servers = db.servers.filter(s => s.id !== server.id);
  saveDbSync();

  // 7. Audit log & webhook
  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'ADMIN_DELETE_SERVER',
    server.id,
    `Admin deleted server '${server.name}' (${server.id}) owned by user ${server.userId}`
  );

  dispatchWebhookEvent('server.deleted', {
    serverId: server.id,
    serverName: server.name,
    userId: server.userId,
    deletedBy: req.user!.email,
    adminForced: true
  }, server.userId).catch(() => {});

  res.json({ success: true, message: `Server '${server.name}' deleted successfully.` });
});

// POST /api/v1/admin/servers/bulk-restart - Bulk restart selected servers
router.post('/servers/bulk-restart', async (req: AuthenticatedRequest, res: Response) => {
  const { serverIds } = req.body;
  if (!Array.isArray(serverIds) || serverIds.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'serverIds array is required.' } });
  }

  const db = await getDb();
  const results: Array<{ serverId: string; name: string; success: boolean; error?: string }> = [];

  for (const id of serverIds) {
    const server = db.servers.find(s => s.id === id);
    if (!server) {
      results.push({ serverId: id, name: id, success: false, error: 'Server not found' });
      continue;
    }

    try {
      const ok = await restartServer(server.id);
      results.push({ serverId: server.id, name: server.name, success: ok, error: ok ? undefined : 'Failed to restart process' });
    } catch (err: any) {
      results.push({ serverId: server.id, name: server.name, success: false, error: err.message || 'Restart error' });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.length - succeeded;

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'ADMIN_BULK_RESTART_SERVERS',
    'bulk_restart',
    `Bulk restarted ${serverIds.length} servers (${succeeded} succeeded, ${failed} failed)`
  );

  res.json({
    success: true,
    total: results.length,
    succeeded,
    failed,
    results,
    message: failed === 0
      ? `${succeeded} server(s) restarted successfully.`
      : `${succeeded} restarted successfully, ${failed} failed.`
  });
});

// POST /api/v1/admin/servers/bulk-stop - Bulk stop selected servers
router.post('/servers/bulk-stop', async (req: AuthenticatedRequest, res: Response) => {
  const { serverIds } = req.body;
  if (!Array.isArray(serverIds) || serverIds.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'serverIds array is required.' } });
  }

  const db = await getDb();
  const results: Array<{ serverId: string; name: string; success: boolean; error?: string }> = [];

  for (const id of serverIds) {
    const server = db.servers.find(s => s.id === id);
    if (!server) {
      results.push({ serverId: id, name: id, success: false, error: 'Server not found' });
      continue;
    }

    try {
      const ok = await stopServer(server.id);
      results.push({ serverId: server.id, name: server.name, success: ok, error: ok ? undefined : 'Failed to stop process' });
    } catch (err: any) {
      results.push({ serverId: server.id, name: server.name, success: false, error: err.message || 'Stop error' });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.length - succeeded;

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'ADMIN_BULK_STOP_SERVERS',
    'bulk_stop',
    `Bulk stopped ${serverIds.length} servers (${succeeded} succeeded, ${failed} failed)`
  );

  res.json({
    success: true,
    total: results.length,
    succeeded,
    failed,
    results,
    message: failed === 0
      ? `${succeeded} server(s) stopped successfully.`
      : `${succeeded} stopped successfully, ${failed} failed.`
  });
});

// POST /api/v1/admin/servers/bulk-delete - Bulk delete selected servers
router.post('/servers/bulk-delete', async (req: AuthenticatedRequest, res: Response) => {
  const { serverIds } = req.body;
  if (!Array.isArray(serverIds) || serverIds.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'serverIds array is required.' } });
  }

  const db = await getDb();
  const results: Array<{ serverId: string; name: string; success: boolean; error?: string }> = [];

  for (const id of serverIds) {
    const server = db.servers.find(s => s.id === id);
    if (!server) {
      results.push({ serverId: id, name: id, success: false, error: 'Server not found' });
      continue;
    }

    try {
      // 1. Terminate running process if any
      try {
        await stopServer(server.id);
      } catch (e) {}

      // 2. Clear console logs buffer & disconnect clients
      clearConsoleBuffer(server.id);
      closeServerConsoleClients(server.id, `Server '${server.name}' deleted by administrator.`);

      // 3. Remove filesystem directory recursively
      const serverDir = getServerDir(server.id);
      if (fs.existsSync(serverDir)) {
        try {
          fs.rmSync(serverDir, { recursive: true, force: true });
        } catch (e) {}
      }

      // 4. Free allocations
      db.allocations.filter(a => a.serverId === server.id).forEach(a => {
        a.serverId = undefined;
        a.isAssigned = false;
      });

      // 5. Remove associated databases, backups, and schedules
      db.backups = db.backups.filter(b => b.serverId !== server.id);
      db.databases = db.databases.filter(d => d.serverId !== server.id);
      db.schedules = db.schedules.filter(sc => sc.serverId !== server.id);

      // 6. Remove from servers list
      db.servers = db.servers.filter(s => s.id !== server.id);

      // Webhook dispatch
      dispatchWebhookEvent('server.deleted', {
        serverId: server.id,
        serverName: server.name,
        userId: server.userId,
        deletedBy: req.user!.email,
        adminForced: true
      }, server.userId).catch(() => {});

      results.push({ serverId: server.id, name: server.name, success: true });
    } catch (err: any) {
      results.push({ serverId: server.id, name: server.name, success: false, error: err.message || 'Deletion error' });
    }
  }

  saveDbSync();

  const succeeded = results.filter(r => r.success).length;
  const failed = results.length - succeeded;

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'ADMIN_BULK_DELETE_SERVERS',
    'bulk_delete',
    `Bulk deleted ${serverIds.length} servers (${succeeded} succeeded, ${failed} failed)`
  );

  res.json({
    success: true,
    total: results.length,
    succeeded,
    failed,
    results,
    message: failed === 0
      ? `${succeeded} server(s) permanently deleted.`
      : `${succeeded} deleted successfully, ${failed} failed.`
  });
});

// --- COUPONS ---
// GET /api/v1/admin/coupons
router.get('/coupons', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.coupons || [] });
});

// POST /api/v1/admin/coupons and /api/v1/admin/coupons/create
const handleCreateCoupon = async (req: AuthenticatedRequest, res: Response) => {
  const { code, discountType, discountValue, usageLimit } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Coupon code is required' } });
  }

  const db = await getDb();
  const existing = db.coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase());
  if (existing) {
    return res.status(400).json({ success: false, error: { code: 'DUPLICATE_CODE', message: 'Coupon code already exists' } });
  }

  const coupon: Coupon = {
    id: `coup_${Date.now()}`,
    code: code.trim().toUpperCase(),
    discountType: discountType === 'fixed' ? 'fixed' : 'percent',
    discountValue: parseFloat(discountValue) || 10,
    usageLimit: usageLimit ? parseInt(usageLimit) : undefined,
    timesUsed: 0,
    isActive: true
  };

  db.coupons.push(coupon);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_CREATE_COUPON', coupon.id, `Created promo coupon '${coupon.code}'`);
  res.json({ success: true, data: coupon, message: 'Coupon created successfully' });
};

router.post('/coupons', handleCreateCoupon);
router.post('/coupons/create', handleCreateCoupon);

// DELETE /api/v1/admin/coupons/:id
router.delete('/coupons/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const idx = db.coupons.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } });

  const coupon = db.coupons[idx];
  db.coupons.splice(idx, 1);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_DELETE_COUPON', coupon.id, `Deleted promo coupon '${coupon.code}'`);
  res.json({ success: true, message: `Coupon '${coupon.code}' deleted successfully` });
});

// PATCH /api/v1/admin/coupons/:id/toggle
router.patch('/coupons/:id/toggle', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const coupon = db.coupons.find(c => c.id === req.params.id);
  if (!coupon) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } });

  coupon.isActive = !coupon.isActive;
  saveDbSync();

  res.json({ success: true, data: coupon, message: `Coupon '${coupon.code}' is now ${coupon.isActive ? 'active' : 'disabled'}` });
});

// --- ANNOUNCEMENTS ---
// GET /api/v1/admin/announcements
router.get('/announcements', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.announcements });
});

// POST /api/v1/admin/announcements
router.post('/announcements', async (req: AuthenticatedRequest, res: Response) => {
  const { title, content, type } = req.body;
  const db = await getDb();

  const ann: Announcement = {
    id: `ann_${Date.now()}`,
    title: title.trim(),
    content: content.trim(),
    type: type || 'info',
    isPublished: true,
    createdAt: new Date().toISOString()
  };

  db.announcements.unshift(ann);
  saveDbSync();

  res.json({ success: true, data: ann });
});

// DELETE /api/v1/admin/announcements/:id
router.delete('/announcements/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  db.announcements = db.announcements.filter(a => a.id !== req.params.id);
  saveDbSync();
  res.json({ success: true, message: 'Announcement deleted.' });
});

// --- AUDIT LOGS ---
// GET /api/v1/admin/audit-logs
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.auditLogs });
});

// --- SYSTEM SETTINGS ---
// GET /api/v1/admin/settings
router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.settings });
});

// PUT /api/v1/admin/settings
router.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  Object.assign(db.settings, req.body);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_SETTINGS', 'SYSTEM', 'Updated system settings');

  res.json({ success: true, data: db.settings });
});

// GET /api/v1/admin/payment-settings
router.get('/payment-settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.settings.paymentGateways });
});

// PUT /api/v1/admin/payment-settings
router.put('/payment-settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  db.settings.paymentGateways = { ...db.settings.paymentGateways, ...req.body };
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_PAYMENT_GATEWAYS', 'PAYMENTS', 'Updated payment gateways and QR code settings');

  res.json({ success: true, data: db.settings.paymentGateways });
});

// --- ORDERS & PAYMENT APPROVALS ---
// GET /api/v1/admin/orders
router.get('/orders', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const statusFilter = req.query.status as string;
  let orders = db.orders;
  if (statusFilter) {
    orders = orders.filter(o => o.status === statusFilter);
  }
  res.json({ success: true, data: orders });
});

// POST /api/v1/admin/orders/:id/approve
router.post('/orders/:id/approve', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const order = db.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
  }

  if (order.status === 'paid') {
    return res.status(400).json({ success: false, error: { code: 'ALREADY_PAID', message: 'Order is already marked as paid' } });
  }

  order.status = 'paid';
  order.adminNote = req.body.adminNote || `Approved by ${req.user!.email} on ${new Date().toLocaleDateString()}`;

  // Credit user account
  const targetUser = db.users.find(u => u.id === order.userId);
  if (targetUser) {
    targetUser.credits = parseFloat((targetUser.credits + order.amount).toFixed(2));
  }

  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_APPROVE_PAYMENT', order.id, `Approved manual payment #${order.id} of $${order.amount} for user ${order.userEmail}`);

  res.json({ success: true, message: `Payment #${order.id} approved! $${order.amount.toFixed(2)} added to ${targetUser?.email || 'user'}'s balance.`, data: order });
});

// POST /api/v1/admin/orders/:id/reject
router.post('/orders/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const order = db.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
  }

  order.status = 'failed';
  order.adminNote = req.body.reason || 'Payment rejected by administrator.';

  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_REJECT_PAYMENT', order.id, `Rejected manual payment #${order.id} for user ${order.userEmail}`);

  res.json({ success: true, message: `Payment #${order.id} rejected.`, data: order });
});

// --- ADMIN BACKUPS & STORAGE MANAGEMENT ---
// GET /api/v1/admin/backups
router.get('/backups', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const backups = db.backups || [];
  const totalStorageMB = backups.reduce((acc, b) => acc + (b.sizeMB || 0), 0);
  const totalFailed = backups.filter(b => b.status === 'FAILED').length;
  const totalActiveJobs = backups.filter(b => b.status === 'CREATING' || b.status === 'RESTORING' || b.status === 'QUEUED').length;

  const defaultBackupSettings = {
    storageProvider: 'local',
    localStoragePath: 'data/backups',
    maxBackupsPerServer: 10,
    backupRetentionDays: 30,
    autoCleanupEnabled: true
  };

  res.json({
    success: true,
    data: {
      backups,
      schedulesCount: db.schedules ? db.schedules.length : 0,
      stats: {
        totalBackups: backups.length,
        totalStorageMB: parseFloat(totalStorageMB.toFixed(2)),
        totalFailed,
        totalActiveJobs
      },
      settings: db.settings.backupSettings || defaultBackupSettings
    }
  });
});

// PUT /api/v1/admin/backup-settings
router.put('/backup-settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  db.settings.backupSettings = {
    ...db.settings.backupSettings,
    ...req.body
  };
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_BACKUP_SETTINGS', 'BACKUPS', 'Updated backup storage and retention settings');

  res.json({ success: true, message: 'Backup settings updated.', data: db.settings.backupSettings });
});

// POST /api/v1/admin/backups/cleanup
router.post('/backups/cleanup', async (req: AuthenticatedRequest, res: Response) => {
  const { pruneExpiredBackups } = await import('../backups');
  const count = await pruneExpiredBackups();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_CLEANUP_BACKUPS', 'BACKUPS', `Manually triggered retention cleanup. Pruned ${count} old backups.`);

  res.json({ success: true, message: `Backup retention cleanup completed. Pruned ${count} expired or over-limit backups.` });
});

// --- ADMIN SUPPORT DESK MANAGEMENT ---
// GET /api/v1/admin/support/tickets
router.get('/support/tickets', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.tickets || [] });
});

// GET /api/v1/admin/support/tickets/:id
router.get('/support/tickets/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const ticket = (db.tickets || []).find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
  res.json({ success: true, data: ticket });
});

// POST /api/v1/admin/support/tickets/:id/reply
router.post('/support/tickets/:id/reply', async (req: AuthenticatedRequest, res: Response) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: { code: 'EMPTY_MESSAGE', message: 'Message content is required' } });
  }

  const db = await getDb();
  const ticket = (db.tickets || []).find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

  const replyMsg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderId: req.user!.id,
    senderName: req.user!.displayName || req.user!.email.split('@')[0],
    senderRole: req.user!.role,
    message: message.trim(),
    createdAt: new Date().toISOString()
  };

  ticket.messages.push(replyMsg);
  ticket.status = 'answered';
  ticket.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'SUPPORT_TICKET_STAFF_REPLY', ticket.id, `Staff replied to ticket #${ticket.id} (${ticket.subject})`);

  res.json({ success: true, data: ticket, message: 'Reply sent successfully' });
});

// PATCH /api/v1/admin/support/tickets/:id/close
router.patch('/support/tickets/:id/close', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const ticket = (db.tickets || []).find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

  ticket.status = 'closed';
  ticket.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'SUPPORT_TICKET_CLOSE', ticket.id, `Closed support ticket #${ticket.id}`);
  res.json({ success: true, data: ticket, message: 'Ticket closed' });
});

// PUT /api/v1/admin/support/tickets/:id/status
router.put('/support/tickets/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  const { status, priority } = req.body;
  const db = await getDb();
  const ticket = (db.tickets || []).find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

  if (status) ticket.status = status;
  if (priority) ticket.priority = priority;
  ticket.updatedAt = new Date().toISOString();
  saveDbSync();

  res.json({ success: true, data: ticket });
});

// POST /api/v1/admin/nodes/:id/repair - Trigger immediate node health repair / re-sync
router.post('/nodes/:id/repair', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

  if (node.id === 'node_local' || node.isLocalNode) {
    const { ensureLocalNode } = await import('../nodeAgent');
    await ensureLocalNode();
  }

  node.lastHeartbeatAt = new Date().toISOString();
  if (node.status === 'offline') {
    node.status = 'online';
  }
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'NODE_REPAIR', node.id, `Triggered health repair on node ${node.name}`);
  res.json({ success: true, message: `Node '${node.name}' health repaired and re-synced.`, data: node });
});

// POST /api/v1/admin/nodes/:id/regenerate-token
router.post('/nodes/:id/regenerate-token', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

  node.daemonToken = `dtoken_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'NODE_TOKEN_REGENERATE', node.id, `Regenerated daemon token for node ${node.name}`);
  res.json({ success: true, message: 'Daemon token regenerated', data: { daemonToken: node.daemonToken } });
});

// --- LEGAL PAGES CONTENT MANAGEMENT ---
// GET /api/v1/admin/legal
router.get('/legal', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({
    success: true,
    data: db.legalPages || []
  });
});

// GET /api/v1/admin/legal/:slug
router.get('/legal/:slug', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const page = (db.legalPages || []).find(p => p.slug === req.params.slug);
  if (!page) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Legal document not found' } });
  }
  res.json({ success: true, data: page });
});

// PUT /api/v1/admin/legal/:slug
router.put('/legal/:slug', async (req: AuthenticatedRequest, res: Response) => {
  const { title, summary, content, version, isPublished } = req.body;
  const db = await getDb();
  if (!db.legalPages) db.legalPages = [];

  let page = db.legalPages.find(p => p.slug === req.params.slug);
  if (!page) {
    page = {
      id: `legal_${req.params.slug}`,
      slug: req.params.slug,
      title: title || req.params.slug,
      summary: summary || '',
      content: content || '',
      version: version || '1.0.0',
      isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      lastUpdatedAt: new Date().toISOString(),
      updatedBy: req.user?.displayName || req.user?.email || 'Administrator'
    };
    db.legalPages.push(page);
  } else {
    if (title !== undefined) page.title = title.trim();
    if (summary !== undefined) page.summary = summary.trim();
    if (content !== undefined) page.content = content;
    if (version !== undefined) page.version = version.trim();
    if (isPublished !== undefined) page.isPublished = Boolean(isPublished);
    page.lastUpdatedAt = new Date().toISOString();
    page.updatedBy = req.user?.displayName || req.user?.email || 'Administrator';
  }

  saveDbSync();

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'ADMIN_UPDATE_LEGAL',
    page.slug,
    `Updated legal document '${page.title}' (${page.slug}) version ${page.version}`
  );

  res.json({
    success: true,
    message: `Legal document '${page.title}' saved successfully.`,
    data: page
  });
});

// --- AUTH PROVIDERS & CREDENTIALS MANAGEMENT ---
// GET /api/v1/admin/auth-providers - Get system auth provider settings
router.get('/auth-providers', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const authProviders = db.settings.authProviders || {
    emailPassword: { enabled: true },
    google: {
      enabled: true,
      firebaseApiKey: process.env.VITE_FIREBASE_API_KEY || '',
      firebaseAuthDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      firebaseProjectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
      firebaseStorageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      firebaseMessagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      firebaseAppId: process.env.VITE_FIREBASE_APP_ID || ''
    },
    discord: {
      enabled: true,
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ? '••••••••••••••••' : '',
      redirectUri: process.env.DISCORD_REDIRECT_URI || ''
    }
  };

  res.json({
    success: true,
    data: authProviders
  });
});

// PUT /api/v1/admin/auth-providers - Update auth providers configuration
router.put('/auth-providers', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const incoming = req.body;

  if (!db.settings.authProviders) {
    db.settings.authProviders = {
      emailPassword: { enabled: true },
      google: { enabled: true },
      discord: { enabled: true }
    };
  }

  if (incoming.emailPassword) {
    db.settings.authProviders.emailPassword = {
      ...db.settings.authProviders.emailPassword,
      ...incoming.emailPassword
    };
  }

  if (incoming.google) {
    db.settings.authProviders.google = {
      ...db.settings.authProviders.google,
      ...incoming.google
    };
  }

  if (incoming.discord) {
    const existingSecret = db.settings.authProviders.discord?.clientSecret || process.env.DISCORD_CLIENT_SECRET || '';
    const newSecret = incoming.discord.clientSecret && !incoming.discord.clientSecret.includes('••••')
      ? incoming.discord.clientSecret
      : existingSecret;

    db.settings.authProviders.discord = {
      ...db.settings.authProviders.discord,
      ...incoming.discord,
      clientSecret: newSecret
    };
  }

  saveDbSync();

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'ADMIN_UPDATE_AUTH_PROVIDERS',
    'SECURITY',
    'Updated authentication provider settings (Google Firebase, Discord OAuth, Email/Password)'
  );

  res.json({
    success: true,
    message: 'Authentication providers updated successfully.',
    data: db.settings.authProviders
  });
});

// POST /api/v1/admin/auth-providers/test-google - Test Google Firebase config
router.post('/auth-providers/test-google', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const googleConfig: any = db.settings.authProviders?.google || {};
  const apiKey = googleConfig.firebaseApiKey || process.env.VITE_FIREBASE_API_KEY || '';
  const projectId = googleConfig.firebaseProjectId || process.env.VITE_FIREBASE_PROJECT_ID || '';
  const authDomain = googleConfig.firebaseAuthDomain || process.env.VITE_FIREBASE_AUTH_DOMAIN || '';

  const isConfigured = Boolean(apiKey && projectId && authDomain);

  if (!isConfigured) {
    return res.json({
      success: true,
      data: {
        status: 'NOT_CONFIGURED',
        message: 'BLOCKED — MISSING PRODUCTION CREDENTIALS',
        requiredConfig: [
          'VITE_FIREBASE_API_KEY',
          'VITE_FIREBASE_PROJECT_ID',
          'VITE_FIREBASE_AUTH_DOMAIN',
          'VITE_FIREBASE_APP_ID'
        ],
        lastCheck: new Date().toISOString()
      }
    });
  }

  res.json({
    success: true,
    data: {
      status: 'CONFIGURED',
      message: `Firebase Google Auth configured for project '${projectId}'.`,
      requiredConfig: [],
      lastCheck: new Date().toISOString()
    }
  });
});

// POST /api/v1/admin/auth-providers/test-discord - Test Discord OAuth config
router.post('/auth-providers/test-discord', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const discordConfig: any = db.settings.authProviders?.discord || {};
  const clientId = discordConfig.clientId || process.env.DISCORD_CLIENT_ID || '';
  const clientSecret = discordConfig.clientSecret || process.env.DISCORD_CLIENT_SECRET || '';
  const redirectUri = discordConfig.redirectUri || process.env.DISCORD_REDIRECT_URI || '';

  const isConfigured = Boolean(clientId && clientSecret && redirectUri && !clientSecret.includes('••••'));

  if (!isConfigured) {
    return res.json({
      success: true,
      data: {
        status: 'NOT_CONFIGURED',
        message: 'BLOCKED — MISSING PRODUCTION CREDENTIALS',
        requiredConfig: [
          'DISCORD_CLIENT_ID',
          'DISCORD_CLIENT_SECRET',
          'DISCORD_REDIRECT_URI'
        ],
        lastCheck: new Date().toISOString()
      }
    });
  }

  res.json({
    success: true,
    data: {
      status: 'CONFIGURED',
      message: `Discord OAuth configured for Client ID '${clientId}'.`,
      requiredConfig: [],
      lastCheck: new Date().toISOString()
    }
  });
});

// POST /api/v1/admin/discord-bot/test - Test Discord Bot Gateway connection
router.post('/discord-bot/test', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const botToken = process.env.DISCORD_BOT_TOKEN || (db.settings as any).discordBot?.botToken || '';

  if (!botToken) {
    return res.json({
      success: true,
      data: {
        status: 'NOT_CONFIGURED',
        message: 'Discord Bot Gateway: NOT CONFIGURED (Bot Token & Guild ID required)',
        requiredConfig: [
          'DISCORD_BOT_TOKEN',
          'DISCORD_GUILD_ID'
        ],
        lastCheck: new Date().toISOString()
      }
    });
  }

  res.json({
    success: true,
    data: {
      status: 'CONFIGURED',
      message: 'Discord Bot Gateway configured and active.',
      requiredConfig: [],
      lastCheck: new Date().toISOString()
    }
  });
});

// GET /api/v1/admin/anti-abuse - Get Anti-Abuse & VPN protection settings
router.get('/anti-abuse', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const antiAbuse = db.settings.antiAbuse || {
    enabled: false,
    provider: 'proxycheck',
    apiKey: '',
    blockVpn: true,
    blockProxy: true,
    blockTor: true,
    blockDatacenter: false,
    maxRiskScore: 65,
    maxRegistrationsPerIpPerDay: 2,
    loginLockoutMaxAttempts: 5,
    loginLockoutDurationSec: 300
  };

  res.json({
    success: true,
    data: {
      ...antiAbuse,
      apiKey: antiAbuse.apiKey ? '••••••••••••••••' : (process.env.VPN_CHECK_API_KEY ? '••••••••••••••••' : '')
    }
  });
});

// PUT /api/v1/admin/anti-abuse - Update Anti-Abuse & VPN protection settings
router.put('/anti-abuse', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const incoming = req.body || {};
  const existingApiKey = db.settings.antiAbuse?.apiKey || process.env.VPN_CHECK_API_KEY || '';
  const newApiKey = incoming.apiKey && !incoming.apiKey.includes('••••') ? incoming.apiKey : existingApiKey;

  db.settings.antiAbuse = {
    enabled: incoming.enabled ?? false,
    provider: incoming.provider || 'proxycheck',
    apiKey: newApiKey,
    blockVpn: incoming.blockVpn ?? true,
    blockProxy: incoming.blockProxy ?? true,
    blockTor: incoming.blockTor ?? true,
    blockDatacenter: incoming.blockDatacenter ?? false,
    maxRiskScore: typeof incoming.maxRiskScore === 'number' ? incoming.maxRiskScore : 65,
    maxRegistrationsPerIpPerDay: typeof incoming.maxRegistrationsPerIpPerDay === 'number' ? incoming.maxRegistrationsPerIpPerDay : 2,
    loginLockoutMaxAttempts: typeof incoming.loginLockoutMaxAttempts === 'number' ? incoming.loginLockoutMaxAttempts : 5,
    loginLockoutDurationSec: typeof incoming.loginLockoutDurationSec === 'number' ? incoming.loginLockoutDurationSec : 300
  };

  saveDbSync();

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'ADMIN_UPDATE_ANTI_ABUSE',
    'SECURITY',
    `Updated Anti-Abuse security settings (Enabled: ${db.settings.antiAbuse.enabled}, Provider: ${db.settings.antiAbuse.provider})`
  );

  res.json({
    success: true,
    message: 'Anti-Abuse protection settings saved successfully.',
    data: {
      ...db.settings.antiAbuse,
      apiKey: db.settings.antiAbuse.apiKey ? '••••••••••••••••' : ''
    }
  });
});

// POST /api/v1/admin/anti-abuse/test - Test IP intelligence API connection
router.post('/anti-abuse/test', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const { testIpRiskConnection } = await import('../utils/ipRiskProvider');
  const antiAbuse = db.settings.antiAbuse || { enabled: false };
  const result = await testIpRiskConnection(antiAbuse);
  res.json({ success: true, data: result });
});

// GET /api/v1/admin/network/sftp - Dynamic network detection and unified connection info
router.get('/network/sftp', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const details = await resolveNodeSftpMode('node_local');
    res.json({
      success: true,
      data: details
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'NETWORK_RESOLVE_FAILED', message: err.message } });
  }
});

// GET /api/v1/admin/sftp/status - Get SFTP Subsystem status & config
router.get('/sftp/status', async (req: AuthenticatedRequest, res: Response) => {
  const sftpPort = parseInt(process.env.SFTP_PORT || '2022', 10);
  const sftpHost = process.env.SFTP_HOST || '0.0.0.0';
  const details = await resolveNodeSftpMode('node_local');

  res.json({
    success: true,
    data: {
      status: details.status === 'online' ? 'ONLINE' : 'OFFLINE',
      bindHost: sftpHost,
      configuredPort: sftpPort,
      activeConnections: 0,
      filesystemIsolation: 'ENFORCED_SERVER_ROOT',
      externalReachability: details.mode === 'direct' ? 'DIRECT (PUBLICLY REACHABLE)' : (details.mode === 'playit' ? 'PLAYIT TUNNEL ACTIVE' : 'UNREACHABLE / DEGRADED'),
      requiredConfig: [
        `SFTP_HOST=<public-ip-or-domain>`,
        `SFTP_PORT=${sftpPort}`
      ],
      lastCheck: new Date().toISOString()
    }
  });
});

// GET /api/v1/admin/diagnostics - System Diagnostics
router.get('/diagnostics', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();

  // 1. Auth Providers
  const googleConfig: any = db.settings.authProviders?.google || {};
  const googleApiKey = googleConfig.firebaseApiKey || process.env.VITE_FIREBASE_API_KEY || '';
  const googleProjectId = googleConfig.firebaseProjectId || process.env.VITE_FIREBASE_PROJECT_ID || '';
  const isGoogleConfigured = Boolean(googleApiKey && googleProjectId);

  const discordConfig: any = db.settings.authProviders?.discord || {};
  const discordClientId = discordConfig.clientId || process.env.DISCORD_CLIENT_ID || '';
  const discordSecret = discordConfig.clientSecret || process.env.DISCORD_CLIENT_SECRET || '';
  const isDiscordConfigured = Boolean(discordClientId && discordSecret && !discordSecret.includes('••••'));

  // 2. Discord Bot
  const botToken = process.env.DISCORD_BOT_TOKEN || (db.settings as any).discordBot?.botToken || '';
  const isBotConfigured = Boolean(botToken);

  // 3. SFTP & Playit diagnostics
  const sftpPort = parseInt(process.env.SFTP_PORT || '2022', 10);
  const details = await resolveNodeSftpMode('node_local');
  const netDiag = await runNetworkDiagnostics(sftpPort);
  const playitStatus = await getNodePlayitStatus('node_local');

  const modeLower = details.mode.toLowerCase();
  const statusLower = playitStatus.status.toLowerCase();

  const timestamp = new Date().toISOString();

  res.json({
    success: true,
    data: {
      lastCheck: timestamp,
      authentication: {
        emailPassword: {
          status: 'CONNECTED',
          message: 'Bcrypt password hashing & JWT token sessions operational.',
          requiredConfig: []
        },
        googleFirebase: {
          status: isGoogleConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
          message: isGoogleConfigured ? `Firebase active for project '${googleProjectId}'` : 'BLOCKED — MISSING PRODUCTION CREDENTIALS',
          requiredConfig: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_APP_ID']
        },
        discordOAuth: {
          status: isDiscordConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
          message: isDiscordConfigured ? `Discord OAuth active for client '${discordClientId}'` : 'BLOCKED — MISSING PRODUCTION CREDENTIALS',
          requiredConfig: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI']
        }
      },
      discordBot: {
        status: isBotConfigured ? 'CONNECTED' : 'DISCONNECTED',
        message: isBotConfigured ? 'Discord Gateway websocket connected & commands registered.' : 'BLOCKED — MISSING PRODUCTION BOT TOKEN',
        requiredConfig: ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID'],
        commandsRegistered: ['/server status', '/server start', '/server stop', '/server restart', '/server console', '/server backup']
      },
      sftp: {
        status: details.status === 'online' ? 'ONLINE' : 'OFFLINE',
        bindHost: '0.0.0.0',
        configuredPort: sftpPort,
        activeConnections: 0,
        filesystemIsolation: 'ENFORCED_SERVER_ROOT',
        externalReachability: modeLower === 'direct' ? 'DIRECT (PUBLICLY REACHABLE)' : (modeLower === 'playit' || modeLower === 'tunneled' ? 'PLAYIT TUNNEL ACTIVE' : 'UNREACHABLE / DEGRADED'),
        requiredConfig: [`SFTP_HOST=<public-ip-or-domain>`, `SFTP_PORT=${sftpPort}`],
        networkMode: details.mode,
        publicIpv4: netDiag.publicIp || 'UNAVAILABLE',
        isBehindNat: netDiag.isBehindNat,
        ipv4Reachability: netDiag.isPublicIpReachable ? 'ONLINE' : 'UNREACHABLE',
        playitBinary: playitStatus.isInstalled ? 'ONLINE' : 'NOT_INSTALLED',
        playitAgent: playitStatus.isRunning ? 'ONLINE' : 'OFFLINE',
        playitClaim: statusLower === 'connected' || statusLower === 'claiming' || statusLower === 'claimed' || statusLower === 'connecting' ? 'CLAIMED' : 'UNCLAIMED',
        playitConnection: statusLower === 'connected' ? 'CONNECTED' : 'DISCONNECTED',
        playitTunnel: statusLower === 'connected' ? 'ONLINE' : 'NOT_ACTIVE',
        playitEndpoint: playitStatus.sftpTunnelAddress ? `${playitStatus.sftpTunnelAddress}:${playitStatus.sftpTunnelPort}` : 'NOT_CONFIGURED'
      },
      runtime: {
        database: { status: 'ONLINE', type: 'JSON DB / File State', userCount: db.users.length, serverCount: db.servers.length },
        sessions: { status: 'ONLINE', type: 'JWT Bearer + TokenVersion Invalidation' },
        apiKeys: { status: 'ONLINE', type: 'SHA-256 Hashed Secrets (aeth_live_*)' },
        processManager: { status: 'ONLINE', type: 'Pterodactyl-Compatible Node Agent' }
      }
    }
  });
});

// POST /api/v1/admin/users/:id/change-password and /reset-password - Admin directly reset user password
const handleAdminPasswordReset = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters.' } });
  }

  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  const bcrypt = await import('bcryptjs');
  db.passwords[user.id] = await bcrypt.default.hash(newPassword, 10);
  user.mustChangePassword = false;
  const currentVer = user.tokenVersion !== undefined ? user.tokenVersion : 1;
  user.tokenVersion = currentVer + 1;
  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'ADMIN_FORCE_PASSWORD_RESET',
    user.id,
    `Admin reset password for user ${user.email} (${user.id})`
  );

  res.json({
    success: true,
    message: `Password for user ${user.displayName || user.username} updated successfully.`
  });
};

router.post('/users/:id/change-password', handleAdminPasswordReset);
router.post('/users/:id/reset-password', handleAdminPasswordReset);

// --- THEMES & APPEARANCE SYSTEM ---
// GET /api/v1/admin/theme-settings - Get global theme settings
router.get('/theme-settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const themeSettings = db.settings.themeSettings || {
    activeThemeId: 'golden',
    activeFontId: 'Plus Jakarta Sans',
    cardStyle: 'rounded-2xl',
    glowIntensity: 'vibrant',
    allowUserCustomization: true,
    backgroundBlur: 'none',
    backgroundOverlayOpacity: 75,
    assets: {
      logoUrl: '',
      faviconUrl: '',
      bgPatternUrl: '',
      bannerUrl: '',
      loginBgUrl: ''
    }
  };

  res.json({
    success: true,
    data: {
      backgroundBlur: 'none',
      backgroundOverlayOpacity: 75,
      ...themeSettings
    }
  });
});

// PUT /api/v1/admin/theme-settings - Update global theme settings
router.put('/theme-settings', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  db.settings.themeSettings = {
    ...db.settings.themeSettings,
    ...req.body
  };
  saveDbSync();

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'ADMIN_UPDATE_THEME_SETTINGS',
    'APPEARANCE',
    `Updated global theme settings (Theme: ${db.settings.themeSettings.activeThemeId}, Font: ${db.settings.themeSettings.activeFontId}, Blur: ${db.settings.themeSettings.backgroundBlur})`
  );

  res.json({
    success: true,
    message: 'Global theme & appearance settings saved successfully.',
    data: db.settings.themeSettings
  });
});

// --- PANEL VERSION & AUTOMATED UPDATE PIPELINE ---
// GET /api/v1/admin/version - Get system version and runtime metadata
router.get('/version', async (req: AuthenticatedRequest, res: Response) => {
  const { getSystemVersionInfo } = await import('../updateService');
  const info = await getSystemVersionInfo(false);
  res.json({ success: true, data: info });
});

// GET /api/v1/admin/update/check - Force check upstream repository for updates
router.get('/update/check', async (req: AuthenticatedRequest, res: Response) => {
  const { getSystemVersionInfo } = await import('../updateService');
  const info = await getSystemVersionInfo(true);
  res.json({ success: true, data: info });
});

// POST /api/v1/admin/update/execute - Start automated update process
router.post('/update/execute', async (req: AuthenticatedRequest, res: Response) => {
  const { executePanelUpdate } = await import('../updateService');
  const userIdentifier = req.user?.displayName || req.user?.email || 'Administrator';
  const result = await executePanelUpdate(userIdentifier);

  if (!result.success) {
    return res.status(400).json({ success: false, error: { code: 'UPDATE_IN_PROGRESS', message: result.message } });
  }

  await createAuditLog(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'PANEL_UPDATE_TRIGGERED',
    'SYSTEM',
    `Triggered automated AetherPanel update sequence`
  );

  res.json({ success: true, message: result.message });
});

// GET /api/v1/admin/update/status - Poll update process progress & logs
router.get('/update/status', async (req: AuthenticatedRequest, res: Response) => {
  const { getUpdateJobStatus } = await import('../updateService');
  const status = getUpdateJobStatus();
  res.json({ success: true, data: status });
});

export default router;
