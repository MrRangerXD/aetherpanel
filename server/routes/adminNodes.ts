import crypto from 'crypto';
import net from 'net';
import { Router, Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb, saveDbSync, scheduleSaveDb } from '../db';
import { AuthenticatedRequest, createAuditLog } from '../auth';
import { Node, Allocation } from '../../src/types';
import { WingsClient } from '../services/wings';
import { LocalProvider } from '../services/local';
import { ensureLocalNode } from '../nodeAgent';

export const adminNodesRouter = Router();

function getPanelPublicUrl(req: Request): string {
  const envUrl = process.env.PANEL_URL?.trim();
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }
  const proto = req.headers['x-forwarded-proto']?.toString().split(',')[0].trim() || req.protocol || 'http';
  const host = req.headers['x-forwarded-host']?.toString().split(',')[0].trim() || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

function probeTcpPort(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const cleanHost = (host || '127.0.0.1').replace(/^https?:\/\//i, '').replace(/[:/].*$/, '');
    const sock = net.createConnection({ host: cleanHost, port, timeout: timeoutMs });
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

// Reserved infrastructure ports that allocations cannot bind to
export const RESERVED_SYSTEM_PORTS = new Set([22, 80, 443, 2022, 3000, 8080, 8443, 9666]);

// Zod Schemas for Node and Allocation Operations
const CreateNodeSchema = z.object({
  name: z.string().min(1, 'Node name is required').max(100),
  hostname: z.string().min(1, 'Hostname (FQDN or IP) is required').max(255),
  apiPort: z.coerce.number().int().min(1).max(65535).default(9666),
  apiUrl: z.string().optional().or(z.literal('')),
  ssl: z.boolean().default(false),
  behindProxy: z.boolean().default(false),
  maintenanceMode: z.boolean().default(false),
  memory: z.coerce.number().int().min(512, 'Memory must be at least 512 MB').default(65536),
  disk: z.coerce.number().int().min(1024, 'Disk must be at least 1 GB').default(102400),
  cpu: z.coerce.number().int().min(50, 'CPU allocation must be at least 50%').default(400),
  maxServers: z.coerce.number().int().min(1).default(100),
  memoryOverallocate: z.coerce.number().int().min(0).default(0),
  diskOverallocate: z.coerce.number().int().min(0).default(0),
  tags: z.array(z.string()).default(['production']),
  location: z.string().optional(),
  locationName: z.string().optional(),
  flagCode: z.string().optional(),
  description: z.string().optional(),
  ipAlias: z.string().optional(),
  portRanges: z.array(z.object({
    startPort: z.coerce.number().int().min(1).max(65535),
    endPort: z.coerce.number().int().min(1).max(65535)
  })).optional()
});

const UpdateNodeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  hostname: z.string().min(1).max(255).optional(),
  apiPort: z.coerce.number().int().min(1).max(65535).optional(),
  apiUrl: z.string().optional().or(z.literal('')),
  ssl: z.boolean().optional(),
  behindProxy: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  memory: z.coerce.number().int().min(512).optional(),
  disk: z.coerce.number().int().min(1024).optional(),
  cpu: z.coerce.number().int().min(50).optional(),
  maxServers: z.coerce.number().int().min(1).optional(),
  memoryOverallocate: z.coerce.number().int().min(0).optional(),
  diskOverallocate: z.coerce.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  location: z.string().optional(),
  locationName: z.string().optional(),
  flagCode: z.string().optional()
});

const CreateAllocationSchema = z.object({
  ip: z.string().min(1, 'IP is required').default('127.0.0.1'),
  startPort: z.coerce.number().int().min(1).max(65535),
  endPort: z.coerce.number().int().min(1).max(65535).optional(),
  alias: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal(''))
});

/**
 * Strips sensitive internal hashes before sending node object to client
 */
function sanitizeNode(node: Node) {
  const { token, ...safe } = node;
  return safe;
}

// -------------------------------------------------------------
// GET /nodes - List all nodes
// -------------------------------------------------------------
adminNodesRouter.get('/nodes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();

    const enrichedNodes = db.nodes.map(node => {
      const nodeServers = db.servers.filter(s => s.nodeId === node.id);
      const nodeAllocs = db.allocations.filter(a => a.nodeId === node.id);
      const assignedAllocs = nodeAllocs.filter(a => a.isAssigned || a.assigned);

      return {
        ...sanitizeNode(node),
        serverCount: nodeServers.length,
        allocationsCount: {
          total: nodeAllocs.length,
          assigned: assignedAllocs.length,
          available: nodeAllocs.length - assignedAllocs.length
        }
      };
    });

    res.json({ success: true, data: enrichedNodes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// GET /nodes/:id - Get single node details
// -------------------------------------------------------------
adminNodesRouter.get('/nodes/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    const nodeServers = db.servers.filter(s => s.nodeId === node.id);
    const nodeAllocs = db.allocations.filter(a => a.nodeId === node.id);
    const assignedAllocs = nodeAllocs.filter(a => a.isAssigned || a.assigned);

    res.json({
      success: true,
      data: {
        ...sanitizeNode(node),
        servers: nodeServers.map(s => ({
          id: s.id,
          name: s.name,
          status: s.status,
          primaryPort: s.primaryPort,
          ramMB: s.limits?.ramMB,
          cpuCores: s.limits?.cpuCores,
          diskGB: s.limits?.diskGB,
          userId: s.userId
        })),
        allocations: nodeAllocs,
        allocationsCount: {
          total: nodeAllocs.length,
          assigned: assignedAllocs.length,
          available: nodeAllocs.length - assignedAllocs.length
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /nodes/:id/ping - Test connectivity & daemon telemetry
// -------------------------------------------------------------
adminNodesRouter.post('/nodes/:id/ping', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    if (node.id === 'local' || node.isLocal) {
      const refreshed = await ensureLocalNode();
      return res.json({
        success: true,
        online: true,
        latencyMs: 1,
        message: 'Local daemon is running in-process and responding.',
        node: sanitizeNode(refreshed)
      });
    }

    // Remote node: perform live HTTP health check via FQDN/hostname first, then check recent heartbeat
    const health = await WingsClient.health(node);
    if (health.alive) {
      node.lastHeartbeatAt = new Date().toISOString();
      if (!node.maintenanceMode) node.status = 'online';
      scheduleSaveDb(300);
      return res.json({
        success: true,
        online: true,
        latencyMs: health.latencyMs,
        message: `Connected to remote daemon via ${node.fqdn || node.hostname} (${health.latencyMs}ms).`,
        lastHeartbeatAt: node.lastHeartbeatAt,
        system: health.system
      });
    }

    const lastHb = node.lastHeartbeatAt ? new Date(node.lastHeartbeatAt).getTime() : 0;
    const isRecent = (Date.now() - lastHb) < 45000;

    res.json({
      success: true,
      online: isRecent,
      latencyMs: isRecent ? health.latencyMs : null,
      message: isRecent
        ? `Inbound heartbeat active, but direct outbound probe to ${node.fqdn || node.hostname}:${node.apiPort || 9666} failed (${health.error || 'timeout'}).`
        : (health.error || 'Node is currently unreachable or has not sent a heartbeat recently.'),
      lastHeartbeatAt: node.lastHeartbeatAt
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /nodes - Create a remote node (Pterodactyl Wings daemon)
// -------------------------------------------------------------
adminNodesRouter.post('/nodes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = CreateNodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') }
      });
    }

    const data = parsed.data;
    const db = await getDb();

    // Generate unique raw daemon token in AETHER-... format returned ONCE in this response
    const rawToken = 'AETHER-' + crypto.randomBytes(36).toString('base64url');
    const hashedToken = await bcrypt.hash(rawToken, 10);

    const nodeId = `node_${crypto.randomUUID()}`;
    const cleanHostname = data.hostname.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const cleanApiPort = data.apiPort || (data.ssl ? (data.behindProxy ? 443 : 8443) : 9666);
    const scheme = data.ssl ? 'https' : 'http';
    const omitPort = data.behindProxy || (data.ssl && cleanApiPort === 443) || (!data.ssl && cleanApiPort === 80);
    const calculatedApiUrl = data.apiUrl?.trim() || (omitPort ? `${scheme}://${cleanHostname}` : `${scheme}://${cleanHostname}:${cleanApiPort}`);

    const newNode: Node = {
      id: nodeId,
      name: data.name.trim(),
      hostname: cleanHostname,
      fqdn: cleanHostname,
      apiPort: cleanApiPort,
      apiUrl: calculatedApiUrl,
      ssl: Boolean(data.ssl),
      token: hashedToken,
      daemonToken: rawToken, // Kept for fast direct heartbeat & outbound Wings auth
      isLocal: cleanHostname === 'localhost' || cleanHostname === '127.0.0.1',
      behindProxy: Boolean(data.behindProxy),
      maintenanceMode: Boolean(data.maintenanceMode),
      memory: data.memory,
      disk: data.disk,
      cpu: data.cpu,
      maxServers: data.maxServers,
      memoryOverallocate: data.memoryOverallocate,
      diskOverallocate: data.diskOverallocate,
      tags: data.tags || ['production'],
      lastHeartbeatAt: null,
      createdAt: new Date().toISOString(),

      // Compatibility fields for legacy consumers
      description: data.description || '',
      ip: cleanHostname,
      daemonPort: cleanApiPort,
      daemonScheme: scheme,
      daemonSslEnabled: Boolean(data.ssl),
      status: 'offline',
      serverCount: 0,
      location: data.location || 'default',
      locationName: data.locationName || data.location || 'Default Region',
      flagCode: (data.flagCode || 'US').toUpperCase(),
      totalRamMB: data.memory,
      usedRamMB: 0,
      totalCpuCores: Math.max(1, Math.round(data.cpu / 100)),
      usedCpuCores: 0,
      totalDiskGB: Math.round(data.disk / 1024),
      usedDiskGB: 0
    };

    db.nodes.push(newNode);

    // Seed allocations pool from provided portRanges or default 25565-25575
    const reservedPorts = new Set([...RESERVED_SYSTEM_PORTS, cleanApiPort]);
    const seededAllocs: Allocation[] = [];
    const allocIp = data.ipAlias?.trim() || cleanHostname;

    if (data.portRanges && Array.isArray(data.portRanges) && data.portRanges.length > 0) {
      for (const range of data.portRanges) {
        const start = Math.min(range.startPort, range.endPort);
        const end = Math.min(Math.max(range.startPort, range.endPort), start + 200); // cap max per range
        for (let p = start; p <= end; p++) {
          if (!reservedPorts.has(p)) {
            const alloc: Allocation = {
              id: `alloc_${Date.now()}_${p}`,
              nodeId: newNode.id,
              ip: allocIp,
              port: p,
              isAssigned: false,
              assigned: false,
              createdAt: new Date().toISOString()
            };
            db.allocations.push(alloc);
            seededAllocs.push(alloc);
          }
        }
      }
    } else {
      for (let p = 25565; p <= 25575; p++) {
        if (!reservedPorts.has(p)) {
          const alloc: Allocation = {
            id: `alloc_${Date.now()}_${p}`,
            nodeId: newNode.id,
            ip: allocIp,
            port: p,
            isAssigned: false,
            assigned: false,
            createdAt: new Date().toISOString()
          };
          db.allocations.push(alloc);
          seededAllocs.push(alloc);
        }
      }
    }

    saveDbSync();

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'CREATE_NODE',
      newNode.id,
      `Created Wings node '${newNode.name}' (${newNode.hostname}:${newNode.apiPort}) with ${seededAllocs.length} initial allocations`
    );

    const origin = getPanelPublicUrl(req);

    // Return the raw token ONCE only
    res.status(201).json({
      success: true,
      node: sanitizeNode(newNode),
      token: rawToken,
      data: sanitizeNode(newNode),
      daemonConfig: {
        panelUrl: origin,
        nodeId: newNode.id,
        token: rawToken,
        port: cleanApiPort,
        fqdn: cleanHostname
      },
      message: `Node '${newNode.name}' created successfully. Store the Wings token securely.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// PATCH /nodes/:id - Update node with Local Node protection
// -------------------------------------------------------------
const updateNodeHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    const parsed = UpdateNodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') }
      });
    }

    const data = parsed.data;

    // Local Node: Allow editing hostname (FQDN), apiPort, ssl, and resources while preserving local in-process identity
    if (node.id === 'local' || node.isLocal) {
      if (data.name !== undefined) node.name = data.name.trim();
      if (data.hostname !== undefined) {
        node.hostname = data.hostname.trim();
        node.ip = node.hostname;
        node.fqdn = node.hostname;
        // Update unassigned allocations for this node to point to the new public FQDN/IP
        for (const alloc of db.allocations) {
          if ((alloc.nodeId === 'local' || alloc.nodeId === 'node_local') && (!alloc.isAssigned && !alloc.assigned)) {
            alloc.ip = node.hostname;
          }
        }
      }
      if (data.apiPort !== undefined) {
        node.apiPort = data.apiPort;
        node.daemonPort = data.apiPort;
      }
      if (data.apiUrl !== undefined) {
        node.apiUrl = data.apiUrl.trim() || undefined;
      } else if (data.hostname !== undefined || data.apiPort !== undefined || data.ssl !== undefined) {
        const port = node.apiPort || 8080;
        const scheme = (data.ssl ?? node.ssl) ? 'https' : 'http';
        node.apiUrl = `${scheme}://${node.hostname || 'localhost'}:${port}`;
      }
      if (data.ssl !== undefined) {
        node.ssl = data.ssl;
        node.daemonScheme = data.ssl ? 'https' : 'http';
        node.daemonSslEnabled = data.ssl;
      }
      if (data.behindProxy !== undefined) node.behindProxy = data.behindProxy;
      if (data.location !== undefined) node.location = data.location;
      if (data.locationName !== undefined) node.locationName = data.locationName;
      if (data.flagCode !== undefined) node.flagCode = data.flagCode;
      if (data.memory !== undefined) node.memory = data.memory;
      if (data.disk !== undefined) node.disk = data.disk;
      if (data.cpu !== undefined) node.cpu = data.cpu;
      if (data.maxServers !== undefined) node.maxServers = data.maxServers;
      if (data.memoryOverallocate !== undefined) node.memoryOverallocate = data.memoryOverallocate;
      if (data.diskOverallocate !== undefined) node.diskOverallocate = data.diskOverallocate;
      if (data.tags !== undefined) node.tags = data.tags;
      if (data.maintenanceMode !== undefined) {
        node.maintenanceMode = data.maintenanceMode;
        node.status = data.maintenanceMode ? 'maintenance' : 'online';
      }
      node.isLocal = true;
      node.isLocalNode = true;
    } else {
      // Remote Node: all fields updatable including FQDN & apiUrl sync
      if (data.name !== undefined) node.name = data.name.trim();
      if (data.hostname !== undefined) {
        const cleanHost = data.hostname.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        node.hostname = cleanHost;
        node.ip = cleanHost;
        node.fqdn = cleanHost;
        for (const alloc of db.allocations) {
          if (alloc.nodeId === node.id && (!alloc.isAssigned && !alloc.assigned)) {
            alloc.ip = cleanHost;
          }
        }
      }
      if (data.apiPort !== undefined) {
        node.apiPort = data.apiPort;
        node.daemonPort = data.apiPort;
      }
      if (data.ssl !== undefined) {
        node.ssl = data.ssl;
        node.daemonScheme = data.ssl ? 'https' : 'http';
        node.daemonSslEnabled = data.ssl;
      }
      if (data.behindProxy !== undefined) node.behindProxy = data.behindProxy;
      if (data.apiUrl !== undefined) {
        node.apiUrl = data.apiUrl.trim() || undefined;
      } else if (data.hostname !== undefined || data.apiPort !== undefined || data.ssl !== undefined || data.behindProxy !== undefined) {
        const port = node.apiPort || node.daemonPort || 9666;
        const scheme = node.ssl ? 'https' : 'http';
        const omitPort = node.behindProxy || (node.ssl && port === 443) || (!node.ssl && port === 80);
        const host = node.fqdn || node.hostname || node.ip;
        node.apiUrl = omitPort ? `${scheme}://${host}` : `${scheme}://${host}:${port}`;
      }
      if (data.maintenanceMode !== undefined) {
        node.maintenanceMode = data.maintenanceMode;
        node.status = data.maintenanceMode ? 'maintenance' : (node.lastHeartbeatAt ? 'online' : 'offline');
      }
      if (data.memory !== undefined) node.memory = data.memory;
      if (data.disk !== undefined) node.disk = data.disk;
      if (data.cpu !== undefined) node.cpu = data.cpu;
      if (data.maxServers !== undefined) node.maxServers = data.maxServers;
      if (data.memoryOverallocate !== undefined) node.memoryOverallocate = data.memoryOverallocate;
      if (data.diskOverallocate !== undefined) node.diskOverallocate = data.diskOverallocate;
      if (data.tags !== undefined) node.tags = data.tags;
      if (data.location !== undefined) node.location = data.location;
      if (data.locationName !== undefined) node.locationName = data.locationName;
      if (data.flagCode !== undefined) node.flagCode = data.flagCode;
    }

    saveDbSync();

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'UPDATE_NODE',
      node.id,
      `Updated node '${node.name}' settings`
    );

    res.json({ success: true, data: sanitizeNode(node), message: `Node '${node.name}' updated.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};

adminNodesRouter.patch('/nodes/:id', updateNodeHandler);
adminNodesRouter.put('/nodes/:id', updateNodeHandler);

// -------------------------------------------------------------
// DELETE /nodes/:id - Delete node (Local Node is immutable)
// -------------------------------------------------------------
adminNodesRouter.delete('/nodes/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const nodeIndex = db.nodes.findIndex(n => n.id === req.params.id);
    if (nodeIndex === -1) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    const node = db.nodes[nodeIndex];

    // HARD INVARIANT: Local node cannot be deleted
    if (node.id === 'local' || node.isLocal) {
      return res.status(403).json({
        success: false,
        error: { code: 'LOCAL_NODE_IMMUTABLE', message: 'The Local Node is built-in and cannot be deleted.' }
      });
    }

    // Check for active servers
    const assignedServers = db.servers.filter(s => s.nodeId === node.id);
    if (assignedServers.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NODE_IN_USE',
          message: `Cannot delete node '${node.name}' while ${assignedServers.length} server(s) are allocated to it. Delete or relocate them first.`
        }
      });
    }

    db.nodes.splice(nodeIndex, 1);
    // Remove all allocations belonging to this node
    db.allocations = db.allocations.filter(a => a.nodeId !== node.id);
    saveDbSync();

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'DELETE_NODE',
      node.id,
      `Deleted node '${node.name}' and its allocations`
    );

    res.json({ success: true, message: `Node '${node.name}' and all associated allocations deleted.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /nodes/:id/token/rotate - Rotate daemon bearer token
// -------------------------------------------------------------
adminNodesRouter.post('/nodes/:id/token/rotate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    if (node.id === 'local' || node.isLocal) {
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_APPLICABLE', message: 'Local Node operates in-process and does not require bearer token rotation.' }
      });
    }

    const newRawToken = 'AETHER-' + crypto.randomBytes(36).toString('base64url');
    node.token = await bcrypt.hash(newRawToken, 10);
    node.daemonToken = newRawToken;
    saveDbSync();

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'ROTATE_NODE_TOKEN',
      node.id,
      `Rotated daemon bearer token for node '${node.name}'`
    );

    res.json({
      success: true,
      token: newRawToken,
      message: `Bearer token rotated for '${node.name}'. Re-enroll your Wings daemon with this new token.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /nodes/:id/maintenance - Toggle maintenance mode
// -------------------------------------------------------------
adminNodesRouter.post('/nodes/:id/maintenance', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    node.maintenanceMode = !node.maintenanceMode;
    node.isMaintenanceMode = node.maintenanceMode;
    node.status = node.maintenanceMode ? 'maintenance' : (node.isLocal ? 'online' : (node.lastHeartbeatAt ? 'online' : 'offline'));

    saveDbSync();

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'TOGGLE_MAINTENANCE',
      node.id,
      `Set maintenance mode to ${node.maintenanceMode} on node '${node.name}'`
    );

    res.json({
      success: true,
      maintenanceMode: node.maintenanceMode,
      status: node.status,
      message: `Node '${node.name}' maintenance mode set to ${node.maintenanceMode ? 'ENABLED' : 'DISABLED'}.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// GET /nodes/:id/health - Live health probe
// -------------------------------------------------------------
adminNodesRouter.get('/nodes/:id/health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    if (node.id === 'local' || node.isLocal) {
      const health = await LocalProvider.health(node);
      return res.json({ success: true, health });
    }

    // Remote node probe via WingsClient
    const health = await WingsClient.health(node);
    if (health.alive) {
      node.lastHeartbeatAt = new Date().toISOString();
      if (!node.maintenanceMode) node.status = 'online';
      saveDbSync();
    }
    res.json({ success: true, health });
  } catch (err: any) {
    res.status(502).json({
      success: false,
      error: { code: 'DAEMON_UNREACHABLE', message: err.message }
    });
  }
});

// -------------------------------------------------------------
// POST /nodes/:id/repair - Re-synchronize node hardware & state
// -------------------------------------------------------------
adminNodesRouter.post('/nodes/:id/repair', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    if (node.id === 'local' || node.isLocal) {
      const updated = await ensureLocalNode();
      await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'REPAIR_NODE', node.id, 'Repaired local node.');
      return res.json({ success: true, data: sanitizeNode(updated), message: 'Local Node re-synchronized.' });
    }

    const serverCount = db.servers.filter(s => s.nodeId === node.id).length;
    node.serverCount = serverCount;
    node.lastHeartbeatAt = new Date().toISOString();
    if (!node.maintenanceMode) node.status = 'online';
    saveDbSync();

    res.json({ success: true, data: sanitizeNode(node), message: `Node '${node.name}' synchronized.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// GET /nodes/:id/diagnostics - Network & connectivity probe
// -------------------------------------------------------------
adminNodesRouter.get('/nodes/:id/diagnostics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    const isLocal = node.id === 'local' || node.isLocal;
    const daemonPort = node.apiPort || node.daemonPort || 9666;
    const remoteHealth = isLocal ? { alive: true, latencyMs: 1, error: undefined } : await WingsClient.health(node);
    const tcpDaemonReachable = isLocal ? true : await probeTcpPort(node.fqdn || node.hostname || node.ip, daemonPort, 2000);
    const tcpSftpReachable = isLocal ? true : await probeTcpPort(node.fqdn || node.hostname || node.ip, node.sftpPort || 2022, 1500);

    const diag = {
      nodeId: node.id,
      name: node.name,
      isLocal,
      hostname: node.hostname,
      fqdn: node.fqdn || node.hostname,
      apiPort: daemonPort,
      ssl: node.ssl,
      behindProxy: node.behindProxy,
      healthAlive: remoteHealth.alive,
      latencyMs: remoteHealth.latencyMs,
      healthError: remoteHealth.error,
      ports: [
        { port: daemonPort, service: 'AetherNode HTTP API', reachable: isLocal ? true : (remoteHealth.alive || tcpDaemonReachable), note: isLocal ? 'In-Process Provider' : (remoteHealth.alive ? `Daemon Online (${remoteHealth.latencyMs}ms)` : (tcpDaemonReachable ? 'TCP Open / Auth Pending' : (remoteHealth.error || 'Daemon Unreachable'))) },
        { port: node.sftpPort || 2022, service: 'SFTP Subsystem', reachable: tcpSftpReachable, note: 'Direct SFTP Ingress' },
        { port: 3000, service: 'AetherPanel HTTP Web', reachable: true, note: 'Primary Web Service' }
      ],
      systemMemory: {
        totalMB: node.memory,
        usedMB: db.servers.filter(s => s.nodeId === node.id).reduce((sum, s) => sum + (s.limits?.ramMB || 0), 0)
      },
      systemDisk: {
        totalGB: Math.round(node.disk > 1000 ? node.disk / 1024 : node.disk),
        usedGB: db.servers.filter(s => s.nodeId === node.id).reduce((sum, s) => sum + (s.limits?.diskGB || 0), 0)
      }
    };

    res.json({ success: true, data: diag });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /nodes/:id/install-token - One-click enrollment script
// -------------------------------------------------------------
adminNodesRouter.post('/nodes/:id/install-token', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    const tokenStr = `ntok_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    db.nodeInstallTokens.push({
      id: `tok_${Date.now()}`,
      nodeId: node.id,
      token: tokenStr,
      createdAt: new Date().toISOString(),
      expiresAt,
      isUsed: false
    });
    saveDbSync();

    const panelUrl = getPanelPublicUrl(req);
    const nodeFqdn = (node.fqdn || node.hostname || '').trim();
    const daemonPort = node.apiPort || node.daemonPort || 9666;
    const fqdnFlag = nodeFqdn ? ` --fqdn ${nodeFqdn}` : '';
    const portFlag = daemonPort !== 9666 ? ` --daemon-port ${daemonPort}` : '';
    const installCmd = `bash <(curl -fsSL https://raw.githubusercontent.com/mrrangerxd/aetherpanel/refs/heads/main/install.sh) --node --token ${tokenStr} --panel ${panelUrl}${fqdnFlag}${portFlag}`;

    res.json({
      success: true,
      data: {
        nodeId: node.id,
        token: tokenStr,
        expiresAt,
        panelUrl,
        fqdn: nodeFqdn,
        daemonPort,
        installCmd
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// =============================================================
// ALLOCATIONS ENGINE
// =============================================================

// GET /nodes/:id/allocations
adminNodesRouter.get('/nodes/:id/allocations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const { status, search } = req.query;

    let allocs = db.allocations.filter(a => a.nodeId === req.params.id);

    if (status === 'assigned') {
      allocs = allocs.filter(a => a.isAssigned || a.assigned);
    } else if (status === 'available') {
      allocs = allocs.filter(a => !a.isAssigned && !a.assigned);
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
        isAssigned: Boolean(a.isAssigned || a.assigned),
        serverName: srv?.name,
        serverStatus: srv?.status
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /nodes/:id/allocations - Create single or range of allocations
adminNodesRouter.post('/nodes/:id/allocations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    const parsed = CreateAllocationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') }
      });
    }

    const { ip, startPort, endPort, alias, notes } = parsed.data;
    const targetIp = (ip || node.hostname || '127.0.0.1').trim();
    const startP = startPort;
    const endP = endPort || startP;

    if (startP > endP) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PORT_RANGE', message: 'Start port cannot be greater than end port.' }
      });
    }

    const rangeSpan = endP - startP + 1;
    if (rangeSpan > 500) {
      return res.status(400).json({
        success: false,
        error: { code: 'RANGE_TOO_LARGE', message: 'Maximum 500 ports can be allocated in a single request.' }
      });
    }

    const reservedPorts = new Set([...RESERVED_SYSTEM_PORTS, node.apiPort, (node as any).daemonPort, (node as any).sftpPort]);
    const created: Allocation[] = [];
    const skippedReserved: number[] = [];
    const skippedExisting: number[] = [];

    for (let p = startP; p <= endP; p++) {
      if (reservedPorts.has(p)) {
        skippedReserved.push(p);
        continue;
      }

      const exists = db.allocations.some(a => a.nodeId === node.id && a.ip === targetIp && a.port === p);
      if (exists) {
        skippedExisting.push(p);
        continue;
      }

      const newAlloc: Allocation = {
        id: `alloc_${Date.now()}_${p}_${Math.random().toString(36).substring(2, 6)}`,
        nodeId: node.id,
        ip: targetIp,
        port: p,
        alias: alias?.trim() || undefined,
        notes: notes?.trim() || undefined,
        isAssigned: false,
        assigned: false,
        createdAt: new Date().toISOString()
      };

      db.allocations.push(newAlloc);
      created.push(newAlloc);
    }

    saveDbSync();

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'CREATE_ALLOCATIONS',
      node.id,
      `Added ${created.length} allocations [${startP}-${endP}] to node '${node.name}'`
    );

    res.json({
      success: true,
      data: created,
      summary: {
        created: created.length,
        skippedReserved: skippedReserved.length,
        skippedExisting: skippedExisting.length
      },
      message: `Created ${created.length} new allocation(s).${skippedReserved.length > 0 ? ` Skipped ${skippedReserved.length} reserved ports.` : ''}${skippedExisting.length > 0 ? ` ${skippedExisting.length} already existed.` : ''}`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /nodes/:id/allocations/purge - Purge all unassigned allocations for this node
adminNodesRouter.post('/nodes/:id/allocations/purge', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    const beforeCount = db.allocations.length;
    db.allocations = db.allocations.filter(a => !(a.nodeId === req.params.id && !a.isAssigned && !a.assigned));
    const deletedCount = beforeCount - db.allocations.length;

    saveDbSync();

    await createAuditLog(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'PURGE_ALLOCATIONS',
      req.params.id,
      `Purged ${deletedCount} unassigned allocations from node '${node.name}'`
    );

    res.json({
      success: true,
      deletedCount,
      message: `Purged ${deletedCount} unassigned allocation(s) from node '${node.name}'.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /nodes/:id/allocations/bulk-delete - Bulk delete specific allocations
adminNodesRouter.post('/nodes/:id/allocations/bulk-delete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const { allocationIds, deleteAllUnassigned } = req.body;

    let toDeleteIds: string[] = [];
    if (deleteAllUnassigned) {
      toDeleteIds = db.allocations
        .filter(a => a.nodeId === req.params.id && !a.isAssigned && !a.assigned)
        .map(a => a.id);
    } else if (Array.isArray(allocationIds)) {
      toDeleteIds = allocationIds.filter(id => {
        const a = db.allocations.find(item => item.id === id && item.nodeId === req.params.id);
        return a && !a.isAssigned && !a.assigned;
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

    res.json({
      success: true,
      deletedCount: toDeleteIds.length,
      message: `Deleted ${toDeleteIds.length} unassigned allocation(s).`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// DELETE /nodes/:id/allocations/:allocId and DELETE /allocations/:allocId
const deleteSingleAlloc = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const alloc = db.allocations.find(a => a.id === req.params.allocId);
    if (!alloc) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Allocation not found' } });
    }

    if (alloc.isAssigned || alloc.assigned) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALLOCATION_ASSIGNED', message: 'Cannot delete an allocation assigned to an active server.' }
      });
    }

    db.allocations = db.allocations.filter(a => a.id !== req.params.allocId);
    saveDbSync();

    res.json({ success: true, message: `Allocation ${alloc.ip}:${alloc.port} deleted.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};

adminNodesRouter.delete('/nodes/:id/allocations/:allocId', deleteSingleAlloc);
adminNodesRouter.delete('/allocations/:allocId', deleteSingleAlloc);

// PATCH /allocations/:allocId - Update allocation alias or notes
adminNodesRouter.patch('/allocations/:allocId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const alloc = db.allocations.find(a => a.id === req.params.allocId);
    if (!alloc) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Allocation not found' } });
    }

    const { alias, notes } = req.body;
    if (alias !== undefined) alloc.alias = alias ? alias.trim() : undefined;
    if (notes !== undefined) alloc.notes = notes ? notes.trim() : undefined;

    saveDbSync();
    res.json({ success: true, data: alloc, message: 'Allocation updated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});
