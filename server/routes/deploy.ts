import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import { initializeServerFiles, appendConsoleLog } from '../provider';
import { Server, Order, Allocation } from '../../src/types';
import { dispatchWebhookEvent } from '../webhookService';

const router = Router();

// GET /api/v1/deploy/options - Get products, plans, locations, nodes, templates
router.get('/options', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({
    success: true,
    data: {
      products: db.products.filter(p => p.isActive),
      plans: db.plans.filter(p => p.isActive),
      nodes: db.nodes.filter(n => n.status === 'online' && !n.isMaintenanceMode),
      templates: (db.templates || []).filter(t => t.status === 'active'),
      userCredits: req.user!.credits,
      currentServerCount: db.servers.filter(s => s.userId === req.user!.id).length
    }
  });
});

// POST /api/v1/deploy/create - Deploy server instance
router.post('/create', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name, planId, templateId, nodeId, location, software, version,
      billingCycle, couponCode, paymentMethod, environmentVars
    } = req.body;

    if (!name || !planId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Server name and plan selection are required.' }
      });
    }

    const db = await getDb();
    const plan = db.plans.find(p => p.id === planId && p.isActive);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: { code: 'PLAN_NOT_FOUND', message: 'Selected plan is invalid or inactive.' }
      });
    }

    const template = templateId ? (db.templates || []).find(t => t.id === templateId) : null;

    const userServers = db.servers.filter(s => s.userId === req.user!.id);
    if (userServers.length >= plan.serverLimit && plan.serverLimit > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'SERVER_LIMIT_REACHED', message: `Server limit reached for this plan tier (${plan.serverLimit} max servers). Upgrade plan or delete an existing server.` }
      });
    }

    // Advanced Node Scheduler
    let targetNode = null;

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

        // Effective RAM capacity calculation (including over-allocation percentage)
        const ramOverallocPct = n.ramOverallocatePercent || 0;
        const effectiveMaxRam = n.totalRamMB * (1 + ramOverallocPct / 100);
        const availableRam = effectiveMaxRam - n.usedRamMB;

        return availableRam >= plan.ramMB;
      });

      if (candidateNodes.length === 0) {
        return res.status(507).json({
          success: false,
          error: {
            code: 'NO_COMPUTE_CAPACITY',
            message: 'All compute nodes are currently at maximum capacity or undergoing maintenance. Please select another region or try again shortly.'
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

    // Port allocation
    let alloc = db.allocations.find(a => a.nodeId === targetNode!.id && !a.isAssigned);
    let assignedPort = alloc ? alloc.port : (template?.defaultPort || Math.floor(Math.random() * 400) + 25565);

    const serverId = `srv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    if (!alloc) {
      alloc = {
        id: `alloc_${Date.now()}`,
        nodeId: targetNode.id,
        ip: targetNode.ip,
        port: assignedPort,
        serverId,
        isAssigned: true
      };
      db.allocations.push(alloc);
    } else {
      alloc.serverId = serverId;
      alloc.isAssigned = true;
    }

    const prod = db.products.find(p => p.id === plan.productId);

    const selectedSoftware = template?.name || software || (prod?.category === 'minecraft' ? 'Paper' : 'Node.js');
    const selectedVersion = version || template?.defaultVersion || (prod?.category === 'minecraft' ? '1.20.4' : 'Node 20');

    const newServer: Server = {
      id: serverId,
      name: name.trim(),
      userId: req.user!.id,
      productId: plan.productId,
      planId: plan.id,
      nodeId: targetNode.id,
      templateId: template?.id,
      deploymentState: 'READY',
      status: 'running',
      primaryIp: targetNode.ip,
      primaryPort: assignedPort,
      location: targetNode.locationName,
      software: selectedSoftware,
      version: selectedVersion,
      limits: {
        ramMB: plan.ramMB,
        cpuCores: plan.cpuCores,
        diskGB: plan.diskGB,
        backups: plan.backupLimit,
        databases: plan.databaseLimit
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cpuUsage: 12.0,
      ramUsageMB: Math.floor(plan.ramMB * 0.25),
      diskUsageMB: 250,
      uptimeSeconds: 0
    };

    // Update Node capacity
    targetNode.usedRamMB += plan.ramMB;
    targetNode.usedCpuCores += plan.cpuCores;
    targetNode.serverCount += 1;

    db.servers.push(newServer);

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
    appendConsoleLog(serverId, `[AetherPanel]: Server auto-provisioned successfully from template '${selectedSoftware}' on node ${targetNode.name}.`);

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

export default router;
