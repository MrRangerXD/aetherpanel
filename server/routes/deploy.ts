import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import { buildBotStartupCommand } from '../../src/lib/startup';
import { initializeServerFiles, appendConsoleLog, startServer } from '../provider';
import { downloadMinecraftServerJar, writeMinecraftEula, writeServerProperties } from '../minecraftService';
import { Server, Order, Allocation } from '../../src/types';
import { dispatchWebhookEvent } from '../webhookService';
import { RESERVED_SYSTEM_PORTS, isPortReserved, resolveNodePublicEndpoint, resolveServerPublicEndpoint } from '../network/endpointResolver';
import { getUserAllocationStatus, canUserDeployServer } from '../services/allocationService';
import { resolveServerResources } from '../services/resourceResolverService';
import { applyServerPortRule } from '../services/networkProtectionService';

const router = Router();

// GET /api/v1/deploy/options - Get products, plans, locations, nodes, templates, allocations
router.get('/options', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const allocationStatus = req.user ? getUserAllocationStatus(db, req.user) : null;
  res.json({
    success: true,
    data: {
      products: db.products.filter(p => p.isActive),
      plans: db.plans.filter(p => p.isActive),
      nodes: db.nodes.filter(n => n.status === 'online' && !n.isMaintenanceMode),
      templates: (db.templates || []).filter(t => t.status === 'active'),
      userCredits: req.user!.credits,
      currentServerCount: db.servers.filter(s => s.userId === req.user!.id).length,
      allocations: allocationStatus
    }
  });
});

// User deployment mutex locks to prevent allocation race conditions
const userDeployLocks = new Map<string, Promise<void>>();
let globalDeployLock: Promise<void> | null = null;

async function withGlobalDeployLock<T>(fn: () => Promise<T>): Promise<T> {
  while (globalDeployLock) {
    await globalDeployLock;
  }
  let resolveLock: () => void;
  globalDeployLock = new Promise<void>(resolve => {
    resolveLock = resolve;
  });
  try {
    return await fn();
  } finally {
    globalDeployLock = null;
    resolveLock!();
  }
}

async function withUserDeployLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  while (userDeployLocks.has(userId)) {
    await userDeployLocks.get(userId);
  }
  let resolveLock: () => void;
  const lockPromise = new Promise<void>(resolve => {
    resolveLock = resolve;
  });
  userDeployLocks.set(userId, lockPromise);
  try {
    // Also acquire global lock to prevent concurrent node capacity over-allocation
    return await withGlobalDeployLock(fn);
  } finally {
    userDeployLocks.delete(userId);
    resolveLock!();
  }
}

// POST /api/v1/deploy/create - Deploy server instance
router.post('/create', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  return withUserDeployLock(req.user!.id, async () => {
    try {
      const {
        name, planId, templateId, nodeId, location, software, version,
        billingCycle, couponCode, paymentMethod, environmentVars, serverTypeId
      } = req.body;

      if (!name || !planId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Server name and plan selection are required.' }
        });
      }

      const db = await getDb();

      // Verify fresh user account state
      const freshUser = db.users.find(u => u.id === req.user!.id);
      if (!freshUser) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User account no longer exists.' }
        });
      }

      if (freshUser.isSuspended) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account is currently suspended. Deployment is prohibited.' }
        });
      }

      const plan = db.plans.find(p => p.id === planId && p.isActive);

      if (!plan) {
        return res.status(404).json({
          success: false,
          error: { code: 'PLAN_NOT_FOUND', message: 'Selected plan is invalid or inactive.' }
        });
      }

      const template = templateId ? (db.templates || []).find(t => t.id === templateId) : null;

      // Authoritative Server Allocation Verification
      const deployCheck = canUserDeployServer(db, freshUser);
      if (!deployCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: {
            code: deployCheck.errorCode || 'SERVER_ALLOCATION_LIMIT_REACHED',
            message: deployCheck.errorMessage || 'Your current plan supports only 1 server allocation.',
            details: {
              allowed: deployCheck.status.limit,
              used: deployCheck.status.used,
              remaining: deployCheck.status.remaining,
              baseAllocations: deployCheck.status.baseServerAllocations,
              adminGrantedAllocations: deployCheck.status.adminGrantedAllocations
            }
          }
        });
      }

    // 1. Resolve Server Resources BEFORE scheduler
    const prod = db.products.find(p => p.id === plan.productId);
    const category = template?.category || prod?.category || (plan.id.includes('bot') ? 'bot' : 'minecraft');

    const resolvedResources = resolveServerResources({
      db,
      planId: plan.id,
      serverCategory: category,
      provisionSource: 'self_service',
      requestedLimits: {
        memory: req.body.memory,
        ramMB: req.body.ramMB,
        cpu: req.body.cpu,
        cpuCores: req.body.cpuCores,
        disk: req.body.disk,
        diskGB: req.body.diskGB
      }
    });

    // Advanced Node Scheduler
    let targetNode = null;
    let nodeRejectionReason = '';

    if (nodeId) {
      targetNode = db.nodes.find(n => n.id === nodeId && n.status === 'online' && !n.isMaintenanceMode);
    }

    if (!targetNode) {
      const candidateNodes = db.nodes.filter(n => {
        if (n.status !== 'online' || n.isMaintenanceMode) return false;

        // Product check
        if (n.allowedProducts && n.allowedProducts.length > 0 && !n.allowedProducts.includes(plan.productId)) {
          return false;
        }

        // Max servers cap check
        if (n.maxServers && n.maxServers > 0 && n.serverCount >= n.maxServers) {
          return false;
        }

        // Effective RAM capacity calculation
        const ramOverallocPct = n.ramOverallocatePercent || 0;
        const effectiveMaxRam = n.totalRamMB * (1 + ramOverallocPct / 100);
        const availableRam = effectiveMaxRam - n.usedRamMB - (n.reservedRamMB || 0);

        // Effective CPU capacity calculation
        const cpuOverallocPct = n.cpuOverallocatePercent || 0;
        const effectiveMaxCpu = n.totalCpuCores * (1 + cpuOverallocPct / 100);
        const availableCpu = effectiveMaxCpu - n.usedCpuCores - (n.reservedCpuCores || 0);

        // Effective Disk capacity calculation
        const availableDisk = n.totalDiskGB - n.usedDiskGB - (n.reservedDiskGB || 0);

        const hasRam = availableRam >= resolvedResources.ramMB;
        const hasCpu = availableCpu >= resolvedResources.cpuCores;
        const hasDisk = availableDisk >= resolvedResources.diskGB;

        if (!hasRam) nodeRejectionReason = 'INSUFFICIENT_RAM';
        else if (!hasCpu) nodeRejectionReason = 'INSUFFICIENT_CPU';
        else if (!hasDisk) nodeRejectionReason = 'INSUFFICIENT_DISK';

        return hasRam && hasCpu && hasDisk;
      });

      if (candidateNodes.length === 0) {
        console.warn(`[Scheduler] Requested: RAM: ${resolvedResources.ramMB} MB, CPU: ${resolvedResources.cpuCores} vCPU, Disk: ${resolvedResources.diskGB} GB`);
        console.warn(`[Scheduler] Rejection reason: ${nodeRejectionReason || 'NO_ELIGIBLE_NODES'}`);
        return res.status(507).json({
          success: false,
          error: {
            code: 'NO_COMPUTE_CAPACITY',
            message: `All compute nodes are currently at maximum capacity or undergoing maintenance (Reason: ${nodeRejectionReason || 'NO_ELIGIBLE_NODES'}). Please select another region or try again shortly.`
          }
        });
      }

      // Filter by requested location if specified
      let locationNodes = candidateNodes.filter(n => n.location === location);
      if (locationNodes.length === 0) {
        locationNodes = candidateNodes;
      }

      // Rank candidate nodes by lowest memory load ratio
      locationNodes.sort((a, b) => {
        const effMaxA = a.totalRamMB * (1 + (a.ramOverallocatePercent || 0) / 100);
        const effMaxB = b.totalRamMB * (1 + (b.ramOverallocatePercent || 0) / 100);
        const ratioA = a.usedRamMB / effMaxA;
        const ratioB = b.usedRamMB / effMaxB;
        return ratioA - ratioB;
      });

      targetNode = locationNodes[0];
    }

    if (!targetNode) {
      return res.status(507).json({
        success: false,
        error: { code: 'NO_TARGET_NODE', message: 'Unable to resolve eligible target node for deployment.' }
      });
    }

    // Price & Coupon calculation
    let basePrice = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
    let finalAmount = basePrice;

    if (couponCode) {
      const coupon = db.coupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase() && c.isActive);
      if (coupon) {
        if (coupon.discountType === 'percent') {
          finalAmount = Math.max(0, basePrice * (1 - coupon.discountValue / 100));
        } else {
          finalAmount = Math.max(0, basePrice - coupon.discountValue);
        }
        coupon.timesUsed += 1;
      }
    }

    // Check User Credits if using Balance
    if (paymentMethod === 'balance') {
      const userObj = db.users.find(u => u.id === req.user!.id);
      if (userObj && userObj.credits < finalAmount) {
        return res.status(402).json({
          success: false,
          error: { code: 'INSUFFICIENT_FUNDS', message: `Insufficient credits balance. Required: $${finalAmount.toFixed(2)}, Available: $${userObj.credits.toFixed(2)}` }
        });
      }
      if (userObj) {
        userObj.credits -= finalAmount;
        req.user!.credits = userObj.credits;
      }
    }

    // Port allocation with atomic assignment and system port protection
    let alloc = db.allocations.find(a => a.nodeId === targetNode!.id && !a.isAssigned && !isPortReserved(a.port, targetNode!));
    
    let assignedPort: number;
    if (alloc) {
      assignedPort = alloc.port;
    } else {
      let candidate = template?.defaultPort || 25565;
      while (isPortReserved(candidate, targetNode!) || db.allocations.some(a => a.nodeId === targetNode!.id && a.port === candidate)) {
        candidate = Math.floor(Math.random() * 4000) + 25565;
      }
      assignedPort = candidate;
    }

    const serverId = `srv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const nodeEndpoint = resolveNodePublicEndpoint(targetNode!);
    const effectiveIp = nodeEndpoint.host;

    if (!alloc) {
      alloc = {
        id: `alloc_${Date.now()}_${assignedPort}`,
        nodeId: targetNode.id,
        ip: targetNode.ip,
        port: assignedPort,
        serverId,
        isAssigned: true,
        createdAt: new Date().toISOString()
      };
      db.allocations.push(alloc);
    } else {
      alloc.serverId = serverId;
      alloc.isAssigned = true;
    }

    const resourceLimits = {
      ramMB: resolvedResources.ramMB,
      cpuCores: resolvedResources.cpuCores,
      diskGB: resolvedResources.diskGB,
      backups: resolvedResources.backups,
      databases: resolvedResources.databases
    };

    const selectedSoftware = template?.name || software || (category === 'minecraft' ? 'Paper' : 'Node.js');
    const selectedVersion = version || template?.defaultVersion || (category === 'minecraft' ? '26.2' : 'Node 20');

    let resolvedServerTypeId = serverTypeId;
    if (!resolvedServerTypeId) {
      const swLower = (selectedSoftware || '').toLowerCase();
      if (swLower.includes('node')) {
        resolvedServerTypeId = 'st_nodejs';
      } else if (swLower.includes('bun')) {
        resolvedServerTypeId = 'st_bun';
      } else if (swLower.includes('python')) {
        resolvedServerTypeId = 'st_python';
      } else {
        resolvedServerTypeId = 'st_minecraft_java';
      }
    }

    const startupConfig: any = category === 'bot' ? {
      botRuntime: selectedSoftware.toLowerCase().includes('python') ? 'python' : selectedSoftware.toLowerCase().includes('bun') ? 'bun' : 'nodejs',
      nodeConfig: selectedSoftware.toLowerCase().includes('node') ? { version: selectedVersion, startupFile: 'index.js' } : undefined,
      pythonConfig: selectedSoftware.toLowerCase().includes('python') ? { version: selectedVersion, startupFile: 'main.py' } : undefined,
      bunConfig: selectedSoftware.toLowerCase().includes('bun') ? { version: selectedVersion, startupFile: 'index.ts' } : undefined,
      entryFile: selectedSoftware.toLowerCase().includes('python') ? 'main.py' : selectedSoftware.toLowerCase().includes('bun') ? 'index.ts' : 'index.js'
    } : {};

    const dummyServer: Partial<Server> = {
      software: selectedSoftware,
      version: selectedVersion,
      limits: resourceLimits
    };

    if (category === 'bot') {
      const cmdObj = buildBotStartupCommand(dummyServer, startupConfig);
      startupConfig.compiledCommand = cmdObj.compiledCommand;
    } else {
      startupConfig.compiledCommand = `java -Xms128M -Xmx${resourceLimits.ramMB}M -jar server.jar nogui`;
    }

    const newServer: Server = {
      id: serverId,
      name: name.trim(),
      userId: req.user!.id,
      productId: plan.productId,
      planId: plan.id,
      nodeId: targetNode.id,
      templateId: template?.id,
      serverTypeId: resolvedServerTypeId,
      deploymentState: 'READY',
      status: 'running',
      primaryIp: effectiveIp,
      primaryPort: assignedPort,
      location: targetNode.locationName,
      software: selectedSoftware,
      version: selectedVersion,
      startup: startupConfig as any,
      limits: resourceLimits,
      resources: {
        memoryMb: resolvedResources.ramMB,
        cpuPercent: resolvedResources.cpuPercent,
        diskGb: resolvedResources.diskGB
      },
      provisionSource: 'self_service',
      isAdminCreated: false,
      createdByAdmin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cpuUsage: 12.0,
      ramUsageMB: Math.floor(resourceLimits.ramMB * 0.25),
      diskUsageMB: 250,
      uptimeSeconds: 0
    };

    // Update Node capacity
    targetNode.usedRamMB += resourceLimits.ramMB;
    targetNode.usedCpuCores += resourceLimits.cpuCores;
    targetNode.usedDiskGB = (targetNode.usedDiskGB || 0) + resourceLimits.diskGB;
    targetNode.serverCount += 1;

    db.servers.push(newServer);

    // Apply network protection and host firewall rule for server allocation
    if (assignedPort) {
      applyServerPortRule(assignedPort, 'both', newServer.id, newServer.name).catch(() => {});
    }

    // Create Order Record
    const order: Order = {
      id: `ord_${Date.now()}`,
      userId: req.user!.id,
      userEmail: req.user!.email,
      planId: plan.id,
      planName: `${prod?.name || 'Hosting'} - ${plan.name}`,
      billingCycle: billingCycle || 'monthly',
      amount: parseFloat(finalAmount.toFixed(2)),
      currency: db.settings.currencyCode,
      status: 'paid',
      paymentMethod: paymentMethod === 'balance' ? 'Aether Account Credits' : 'Credit Card (Stripe Verified)',
      createdAt: new Date().toISOString()
    };
    db.orders.unshift(order);

    // Initialize files on disk
    initializeServerFiles(serverId, prod?.category || 'minecraft', newServer.software);

    if (prod?.category === 'minecraft') {
      appendConsoleLog(serverId, `[AetherPanel]: Provisioning Minecraft server runtime (${newServer.software} ${newServer.version})...`);
      writeMinecraftEula(serverId, true);
      writeServerProperties(serverId, {
        serverPort: assignedPort,
        motd: `§bAetherPanel §7- ${newServer.name}`
      });
      try {
        await downloadMinecraftServerJar(serverId, newServer.software, newServer.version);
      } catch (err: any) {
        appendConsoleLog(serverId, `[AetherInstaller/WARN]: Server JAR download notice: ${err.message}`);
      }
    }

    appendConsoleLog(serverId, `[AetherPanel]: Server auto-provisioned successfully from template '${selectedSoftware}' on node ${targetNode.name}.`);

    // Genuinely spawn the server runtime process
    try {
      await startServer(serverId);
    } catch (err: any) {
      if (newServer && targetNode) {
        // Rollback memory state if deployment crashed
        targetNode.usedRamMB -= resourceLimits.ramMB;
        targetNode.usedCpuCores -= resourceLimits.cpuCores;
        targetNode.usedDiskGB = (targetNode.usedDiskGB || 0) - resourceLimits.diskGB;
        targetNode.serverCount -= 1;
        const srvIdx = db.servers.findIndex(s => s.id === serverId);
        if (srvIdx !== -1) db.servers.splice(srvIdx, 1);
        
        // Unassign port allocation
        if (alloc) alloc.isAssigned = false;
        
        // Refund credits if used
        if (paymentMethod === 'balance') {
          const userObj = db.users.find(u => u.id === req.user!.id);
          if (userObj) userObj.credits += finalAmount;
        }
      }
      throw err;
    }

    saveDbSync();

    await createAuditLog(
      req.user!.id, req.user!.email, req.user!.role,
      'SERVER_PROVISION', serverId,
      `Provisioned server '${name}' from template '${selectedSoftware}' ($${finalAmount.toFixed(2)})`
    );

    // Dispatch Webhook Event
    dispatchWebhookEvent('server.created', {
      serverId: newServer.id,
      serverName: newServer.name,
      userId: newServer.userId,
      userEmail: req.user!.email,
      nodeId: targetNode.id,
      nodeName: targetNode.name,
      software: newServer.software,
      version: newServer.version,
      primaryIp: newServer.primaryIp,
      primaryPort: newServer.primaryPort,
      limits: newServer.limits
    }, req.user!.id).catch(() => {});

    res.json({
      success: true,
      message: 'Server deployed and running!',
      data: {
        server: newServer,
        order
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DEPLOYMENT_FAILED', message: err.message || 'Server deployment failed.' } });
  }
  });
});

export default router;
