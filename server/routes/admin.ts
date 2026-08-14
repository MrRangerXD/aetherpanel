import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, requireRole, AuthenticatedRequest, createAuditLog } from '../auth';
import { User, Product, Plan, Node, Allocation, Coupon, Announcement, SystemSettings } from '../../src/types';

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

// PUT /api/v1/admin/users/:id - Update user role, credits, status
router.put('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);

  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const { role, isSuspended, credits, displayName } = req.body;

  if (role && ['user', 'support', 'moderator', 'admin', 'super_admin'].includes(role)) {
    user.role = role;
  }
  if (typeof isSuspended === 'boolean') {
    user.isSuspended = isSuspended;
  }
  if (typeof credits === 'number') {
    user.credits = credits;
  }
  if (displayName) {
    user.displayName = displayName;
  }

  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_USER', user.id, `Updated user ${user.email} (Role: ${user.role}, Suspended: ${user.isSuspended})`);

  res.json({ success: true, data: user });
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
  if (userServers.length > 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'USER_HAS_SERVERS', message: `Cannot delete user with ${userServers.length} active server(s). Please terminate servers first.` }
    });
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

// POST /api/v1/admin/nodes
router.post('/nodes', async (req: AuthenticatedRequest, res: Response) => {
  const {
    name, hostname, ip, fqdn, daemonPort, sftpPort, location, locationName, flagCode,
    totalRamMB, totalCpuCores, totalDiskGB,
    ramOverallocatePercent, cpuOverallocatePercent, diskOverallocatePercent,
    maxServers, allowedProducts
  } = req.body;

  const db = await getDb();

  const newNode: Node = {
    id: `node_${Date.now()}`,
    name: name.trim(),
    hostname: hostname.trim(),
    ip: ip.trim(),
    fqdn: fqdn ? fqdn.trim() : hostname.trim(),
    daemonPort: parseInt(daemonPort) || 8080,
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
    status: 'offline', // status becomes 'online' when daemon connects/enrolls
    isMaintenanceMode: false,
    serverCount: 0,
    lastHeartbeatAt: new Date().toISOString()
  };

  db.nodes.push(newNode);

  // Generate initial allocations pool
  for (let p = 25565; p <= 25575; p++) {
    db.allocations.push({
      id: `alloc_${Date.now()}_${p}`,
      nodeId: newNode.id,
      ip: newNode.ip,
      port: p,
      isAssigned: false
    });
  }

  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'CREATE_NODE', newNode.id, `Created node ${newNode.name} (${newNode.ip})`);

  res.json({ success: true, data: newNode });
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
  const installCmd = `curl -fsSL ${panelUrl}/install.sh | bash -s -- --node --token ${tokenStr} --panel ${panelUrl}`;

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

// PUT /api/v1/admin/nodes/:id
router.put('/nodes/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

  const {
    name, hostname, ip, fqdn, daemonPort, sftpPort, location, locationName, flagCode,
    totalRamMB, totalCpuCores, totalDiskGB, ramOverallocatePercent, cpuOverallocatePercent,
    diskOverallocatePercent, maxServers, allowedProducts, isMaintenanceMode, status
  } = req.body;

  if (name) node.name = name;
  if (hostname) node.hostname = hostname;
  if (ip) node.ip = ip;
  if (fqdn) node.fqdn = fqdn;
  if (daemonPort) node.daemonPort = parseInt(daemonPort);
  if (sftpPort) node.sftpPort = parseInt(sftpPort);
  if (location) node.location = location;
  if (locationName) node.locationName = locationName;
  if (flagCode) node.flagCode = flagCode;
  if (totalRamMB) node.totalRamMB = parseInt(totalRamMB);
  if (totalCpuCores) node.totalCpuCores = parseFloat(totalCpuCores);
  if (totalDiskGB) node.totalDiskGB = parseInt(totalDiskGB);
  if (typeof ramOverallocatePercent === 'number') node.ramOverallocatePercent = ramOverallocatePercent;
  if (typeof cpuOverallocatePercent === 'number') node.cpuOverallocatePercent = cpuOverallocatePercent;
  if (typeof diskOverallocatePercent === 'number') node.diskOverallocatePercent = diskOverallocatePercent;
  if (typeof maxServers === 'number') node.maxServers = maxServers;
  if (Array.isArray(allowedProducts)) node.allowedProducts = allowedProducts;
  if (typeof isMaintenanceMode === 'boolean') node.isMaintenanceMode = isMaintenanceMode;
  if (status) node.status = status;

  saveDbSync();

  res.json({ success: true, data: node });
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

  db.nodes.splice(nodeIndex, 1);
  db.allocations = db.allocations.filter(a => a.nodeId !== req.params.id);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'DELETE_NODE', req.params.id, `Deleted node ${req.params.id}`);

  res.json({ success: true, message: 'Node and unassigned allocations removed' });
});

// --- ALLOCATIONS MANAGEMENT ---
// GET /api/v1/admin/nodes/:id/allocations
router.get('/nodes/:id/allocations', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const allocs = db.allocations.filter(a => a.nodeId === req.params.id);
  res.json({ success: true, data: allocs });
});

// POST /api/v1/admin/nodes/:id/allocations - Range creation
router.post('/nodes/:id/allocations', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

  const { ip, startPort, endPort } = req.body;
  const targetIp = (ip || node.ip).trim();
  const startP = parseInt(startPort);
  const endP = parseInt(endPort) || startP;

  if (!startP || startP < 1 || endP > 65535 || startP > endP) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_PORT_RANGE', message: 'Invalid port range specified (1-65535)' } });
  }

  const created: Allocation[] = [];
  for (let p = startP; p <= endP; p++) {
    const existing = db.allocations.find(a => a.nodeId === node.id && a.ip === targetIp && a.port === p);
    if (!existing) {
      const newAlloc: Allocation = {
        id: `alloc_${Date.now()}_${p}_${Math.random().toString(36).substring(2, 6)}`,
        nodeId: node.id,
        ip: targetIp,
        port: p,
        isAssigned: false
      };
      db.allocations.push(newAlloc);
      created.push(newAlloc);
    }
  }

  saveDbSync();

  res.json({ success: true, data: created, message: `Generated ${created.length} new allocation port(s)` });
});

// DELETE /api/v1/admin/allocations/:allocId
router.delete('/allocations/:allocId', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const alloc = db.allocations.find(a => a.id === req.params.allocId);
  if (!alloc) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Allocation not found' } });

  if (alloc.isAssigned) {
    return res.status(400).json({ success: false, error: { code: 'ALLOCATION_ASSIGNED', message: 'Cannot delete an allocation currently assigned to an active server' } });
  }

  db.allocations = db.allocations.filter(a => a.id !== req.params.allocId);
  saveDbSync();

  res.json({ success: true, message: 'Allocation deleted' });
});

// --- ALL SERVERS ---
// GET /api/v1/admin/servers
router.get('/servers', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.servers });
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

export default router;
