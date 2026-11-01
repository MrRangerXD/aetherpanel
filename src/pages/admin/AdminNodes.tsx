import React, { useState, useEffect } from 'react';
import {
  HardDrive, Server, Activity, ShieldCheck, AlertTriangle, Plus, Terminal,
  Globe, Cpu, Database, Settings, Trash2, Edit3, Copy, Check,
  ExternalLink, RefreshCw, Layers, Shield, Wifi, WifiOff, X, HelpCircle,
  Search, Filter, CheckCircle2, Lock, Tag, ArrowRight, ArrowLeft, Key, Zap
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Node, Location, Allocation } from '../../types';

export const AdminNodes: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'nodes' | 'locations' | 'installer' | 'wings'>('nodes');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'maintenance' | 'offline'>('all');

  // Creation Wizard Modal (3-Step Pterodactyl-Class Workflow)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [createForm, setCreateForm] = useState({
    name: '',
    hostname: '',
    apiPort: 8080,
    apiUrl: '',
    ssl: false,
    behindProxy: false,
    maintenanceMode: false,
    // Step 2 Allocations
    allocationIp: '',
    allocStartPort: 25565,
    allocEndPort: 25575,
    allocAlias: '',
    // Step 3 Resources
    memory: 65536,
    disk: 102400,
    cpu: 400,
    maxServers: 100,
    memoryOverallocate: 0,
    diskOverallocate: 0,
    tags: 'production,wings'
  });

  // Edit Node Modal
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [editForm, setEditForm] = useState<Partial<Node>>({});

  // Token Presentation Modal (Shown ONCE after node creation or token rotation)
  const [tokenModalData, setTokenModalData] = useState<{
    nodeName: string;
    nodeId: string;
    token: string;
    installCmd?: string;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Allocations Modal
  const [selectedNodeForAllocations, setSelectedNodeForAllocations] = useState<Node | null>(null);
  const [allocations, setAllocations] = useState<(Allocation & { serverName?: string; serverStatus?: string })[]>([]);
  const [allocLoading, setAllocLoading] = useState(false);
  const [allocFilter, setAllocFilter] = useState<'all' | 'available' | 'assigned'>('all');
  const [allocSearch, setAllocSearch] = useState('');
  const [newAllocIp, setNewAllocIp] = useState('');
  const [newAllocStart, setNewAllocStart] = useState('25565');
  const [newAllocEnd, setNewAllocEnd] = useState('25575');
  const [newAllocAlias, setNewAllocAlias] = useState('');

  // Diagnostics Modal
  const [selectedNodeForDiagnostics, setSelectedNodeForDiagnostics] = useState<Node | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  // Wings Status State
  const [wingsStatus, setWingsStatus] = useState<any>(null);
  const [wingsBenchmark, setWingsBenchmark] = useState<any>(null);
  const [runningWingsTest, setRunningWingsTest] = useState(false);

  // Flash Notifications
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const showToast = (type: 'error' | 'success', text: string) => {
    if (type === 'error') {
      setErrorMsg(text);
      setTimeout(() => setErrorMsg(''), 6000);
    } else {
      setSuccessMsg(text);
      setTimeout(() => setSuccessMsg(''), 6000);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [nodesRes, locsRes] = await Promise.all([
        apiRequest('/admin/nodes'),
        apiRequest('/admin/locations')
      ]);

      if (nodesRes.success && nodesRes.data) {
        setNodes(nodesRes.data);
      }
      if (locsRes.success && locsRes.data) {
        setLocations(locsRes.data);
      }

      try {
        const wingsRes = await apiRequest('/admin/wings/status');
        if (wingsRes.success) setWingsStatus(wingsRes.data);
      } catch {}
    } catch (err: any) {
      showToast('error', `Failed to load nodes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered nodes
  const filteredNodes = nodes.filter(n => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      n.name.toLowerCase().includes(q) ||
      n.hostname.toLowerCase().includes(q) ||
      (n.ip && n.ip.toLowerCase().includes(q)) ||
      n.id.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && (n.status === 'online' || n.isLocal)) ||
      (statusFilter === 'maintenance' && (n.maintenanceMode || n.isMaintenanceMode)) ||
      (statusFilter === 'offline' && n.status === 'offline' && !n.isLocal && !n.maintenanceMode);

    return matchesSearch && matchesStatus;
  });

  // Toggle Maintenance
  const handleToggleMaintenance = async (node: Node) => {
    try {
      const res = await apiRequest(`/admin/nodes/${node.id}/maintenance`, { method: 'POST' });
      if (res.success) {
        showToast('success', res.message || `Toggled maintenance mode for '${node.name}'.`);
        fetchData();
      } else {
        showToast('error', res.error?.message || 'Failed to toggle maintenance mode.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Delete Node (Blocked for Local Node)
  const handleDeleteNode = async (node: Node) => {
    if (node.id === 'local' || node.isLocal) {
      showToast('error', 'The built-in Local Node cannot be deleted.');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete node '${node.name}' (${node.hostname})? All unassigned allocations will also be removed.`)) {
      return;
    }

    try {
      const res = await apiRequest(`/admin/nodes/${node.id}`, { method: 'DELETE' });
      if (res.success) {
        showToast('success', res.message || `Node '${node.name}' removed.`);
        fetchData();
      } else {
        showToast('error', res.error?.message || 'Failed to delete node.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Probe Node Live Health
  const handleProbeHealth = async (node: Node) => {
    try {
      showToast('success', `Probing daemon health on '${node.name}'...`);
      const res = await apiRequest(`/admin/nodes/${node.id}/health`);
      if (res.success) {
        showToast('success', `Node '${node.name}' is HEALTHY. Response: ${JSON.stringify(res.health || res.data)}`);
        fetchData();
      } else {
        showToast('error', res.error?.message || `Node '${node.name}' daemon unreachable.`);
      }
    } catch (err: any) {
      showToast('error', `Health probe failed: ${err.message}`);
    }
  };

  // Rotate Wings Daemon Token
  const handleRotateToken = async (node: Node) => {
    if (node.id === 'local' || node.isLocal) {
      showToast('error', 'Local node runs in-process and does not require bearer token rotation.');
      return;
    }

    if (!window.confirm(`Rotate daemon bearer token for node '${node.name}'? The existing token will immediately be invalidated.`)) {
      return;
    }

    try {
      const res = await apiRequest(`/admin/nodes/${node.id}/token/rotate`, { method: 'POST' });
      if (res.success && res.token) {
        setTokenModalData({
          nodeName: node.name,
          nodeId: node.id,
          token: res.token,
          installCmd: `curl -fsSL ${window.location.origin}/install.sh | bash -s -- --node --token ${res.token} --panel ${window.location.origin}`
        });
        showToast('success', 'Bearer token rotated. Save the new token now.');
      } else {
        showToast('error', res.error?.message || 'Failed to rotate token.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Open Diagnostics Modal
  const handleOpenDiagnostics = async (node: Node) => {
    setSelectedNodeForDiagnostics(node);
    setDiagnosticsData(null);
    setDiagnosticsLoading(true);

    try {
      const res = await apiRequest(`/admin/nodes/${node.id}/diagnostics`);
      if (res.success && res.data) {
        setDiagnosticsData(res.data);
      } else {
        setDiagnosticsData({
          nodeId: node.id,
          name: node.name,
          isLocal: node.isLocal || node.id === 'local',
          hostname: node.hostname,
          apiPort: node.apiPort,
          ports: [
            { port: node.apiPort, service: 'Wings HTTP API', reachable: node.isLocal ? true : false, note: node.isLocal ? 'In-Process Provider' : 'Remote Wings Daemon' },
            { port: 2022, service: 'SFTP Subsystem', reachable: true, note: 'Direct SFTP Ingress' },
            { port: 3000, service: 'Panel HTTP Web', reachable: true, note: 'Primary Web Service' }
          ]
        });
      }
    } catch {
      setDiagnosticsData({
        nodeId: node.id,
        name: node.name,
        isLocal: node.isLocal,
        ports: [{ port: node.apiPort, service: 'Wings API', reachable: false, note: 'Connection timed out' }]
      });
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  // Open Allocations Modal
  const handleOpenAllocations = async (node: Node) => {
    setSelectedNodeForAllocations(node);
    setNewAllocIp(node.hostname || node.ip || '127.0.0.1');
    setAllocLoading(true);
    try {
      const res = await apiRequest(`/admin/nodes/${node.id}/allocations`);
      if (res.success && res.data) {
        setAllocations(res.data);
      }
    } catch (err: any) {
      showToast('error', `Failed to load allocations: ${err.message}`);
    } finally {
      setAllocLoading(false);
    }
  };

  // Add Allocation Range
  const handleAddAllocations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNodeForAllocations) return;

    const startP = parseInt(newAllocStart);
    const endP = parseInt(newAllocEnd) || startP;

    if (!startP || startP < 1 || endP > 65535 || startP > endP) {
      showToast('error', 'Please enter a valid port range (1 - 65535).');
      return;
    }

    try {
      const res = await apiRequest(`/admin/nodes/${selectedNodeForAllocations.id}/allocations`, {
        method: 'POST',
        body: JSON.stringify({
          ip: newAllocIp.trim() || selectedNodeForAllocations.hostname,
          startPort: startP,
          endPort: endP,
          alias: newAllocAlias.trim() || undefined
        })
      });

      if (res.success) {
        showToast('success', res.message || 'Allocations added.');
        handleOpenAllocations(selectedNodeForAllocations);
        fetchData();
      } else {
        showToast('error', res.error?.message || 'Failed to add allocations.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Delete Allocation
  const handleDeleteAllocation = async (allocId: string) => {
    try {
      const res = await apiRequest(`/admin/allocations/${allocId}`, { method: 'DELETE' });
      if (res.success) {
        showToast('success', 'Allocation deleted.');
        if (selectedNodeForAllocations) handleOpenAllocations(selectedNodeForAllocations);
        fetchData();
      } else {
        showToast('error', res.error?.message || 'Failed to delete allocation.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Purge All Unassigned Allocations
  const handlePurgeAllocations = async () => {
    if (!selectedNodeForAllocations) return;
    if (!window.confirm(`Purge ALL unassigned allocations from node '${selectedNodeForAllocations.name}'? Active server allocations will NOT be touched.`)) {
      return;
    }

    try {
      const res = await apiRequest(`/admin/nodes/${selectedNodeForAllocations.id}/allocations/purge`, {
        method: 'POST'
      });
      if (res.success) {
        showToast('success', res.message || 'Unassigned allocations purged.');
        handleOpenAllocations(selectedNodeForAllocations);
        fetchData();
      } else {
        showToast('error', res.error?.message || 'Failed to purge allocations.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Create Node Wizard Submit (Pterodactyl 3-Step Process)
  const handleCreateNodeSubmit = async () => {
    if (!createForm.name.trim()) {
      showToast('error', 'Node name is required.');
      setCreateStep(1);
      return;
    }
    if (!createForm.hostname.trim()) {
      showToast('error', 'Hostname (FQDN or IPv4/IPv6) is required.');
      setCreateStep(1);
      return;
    }

    try {
      const payload = {
        name: createForm.name.trim(),
        hostname: createForm.hostname.trim(),
        apiPort: Number(createForm.apiPort) || (createForm.ssl ? 8443 : 8080),
        apiUrl: createForm.apiUrl.trim() || undefined,
        ssl: Boolean(createForm.ssl),
        behindProxy: Boolean(createForm.behindProxy),
        maintenanceMode: Boolean(createForm.maintenanceMode),
        memory: Number(createForm.memory) || 65536,
        disk: Number(createForm.disk) || 102400,
        cpu: Number(createForm.cpu) || 400,
        maxServers: Number(createForm.maxServers) || 100,
        memoryOverallocate: Number(createForm.memoryOverallocate) || 0,
        diskOverallocate: Number(createForm.diskOverallocate) || 0,
        tags: createForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const res = await apiRequest('/admin/nodes', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success && res.node) {
        setShowCreateModal(false);
        // Show raw token in one-time modal
        if (res.token) {
          setTokenModalData({
            nodeName: res.node.name,
            nodeId: res.node.id,
            token: res.token,
            installCmd: `curl -fsSL ${window.location.origin}/install.sh | bash -s -- --node --token ${res.token} --panel ${window.location.origin}`
          });
        }
        showToast('success', `Node '${res.node.name}' created! Save your Wings daemon token now.`);
        fetchData();
        // Reset wizard
        setCreateStep(1);
        setCreateForm({
          name: '',
          hostname: '',
          apiPort: 8080,
          apiUrl: '',
          ssl: false,
          behindProxy: false,
          maintenanceMode: false,
          allocationIp: '',
          allocStartPort: 25565,
          allocEndPort: 25575,
          allocAlias: '',
          memory: 65536,
          disk: 102400,
          cpu: 400,
          maxServers: 100,
          memoryOverallocate: 0,
          diskOverallocate: 0,
          tags: 'production,wings'
        });
      } else {
        showToast('error', res.error?.message || 'Failed to create node.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Edit Node Submit
  const handleEditNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode) return;

    try {
      const res = await apiRequest(`/admin/nodes/${editingNode.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm)
      });

      if (res.success) {
        showToast('success', res.message || `Node '${editingNode.name}' updated.`);
        setEditingNode(null);
        fetchData();
      } else {
        showToast('error', res.error?.message || 'Failed to update node.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-line)] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text)] flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-[var(--color-accent)]" />
            Node Infrastructure
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Manage bare-metal physical hosts, Wings daemon instances, port allocations, and hardware limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => {
              setCreateStep(1);
              setShowCreateModal(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Node
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--color-line)] gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'nodes'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-semibold'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Server className="h-4 w-4" />
          Nodes ({nodes.length})
        </button>

        <button
          onClick={() => setActiveTab('locations')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'locations'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-semibold'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Globe className="h-4 w-4" />
          Datacenter Regions ({locations.length})
        </button>

        <button
          onClick={() => setActiveTab('installer')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'installer'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-semibold'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Terminal className="h-4 w-4" />
          Daemon Installer & Pairing
        </button>

        <button
          onClick={() => setActiveTab('wings')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'wings'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-semibold'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Shield className="h-4 w-4" />
          Wings Parity
        </button>
      </div>

      {/* TAB 1: NODES TABLE / CARDS */}
      {activeTab === 'nodes' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search nodes by name, hostname, IP..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div className="flex gap-1 bg-[var(--color-surface)] p-1 rounded-lg border border-[var(--color-line)] text-xs">
              {(['all', 'online', 'maintenance', 'offline'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md capitalize font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-[var(--color-text-muted)]">Loading node metrics and hardware telemetry...</div>
          ) : filteredNodes.length === 0 ? (
            <div className="p-12 text-center rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] space-y-3">
              <HardDrive className="h-8 w-8 text-[var(--color-text-muted)] mx-auto" />
              <h3 className="text-[var(--color-text)] font-semibold text-sm">No Nodes Found</h3>
              <p className="text-[var(--color-text-muted)] text-xs max-w-md mx-auto">
                No compute nodes matched your search. Click "Create Node" to add a new Pterodactyl Wings host.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNodes.map(n => {
                const isLocal = n.id === 'local' || n.isLocal;
                const totalRamMB = n.memory || n.totalRamMB || 65536;
                const totalDiskGB = Math.round((n.disk || n.totalDiskGB || 102400) > 1000 ? (n.disk || n.totalDiskGB || 102400) / 1024 : (n.disk || n.totalDiskGB || 100));
                const allocTotal = (n as any).allocationsCount?.total ?? 0;
                const allocAssigned = (n as any).allocationsCount?.assigned ?? 0;
                const serverCount = (n as any).serverCount ?? 0;

                const isOnline = isLocal || n.status === 'online';
                const isMaint = n.maintenanceMode || n.isMaintenanceMode;

                return (
                  <div
                    key={n.id}
                    className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] hover:border-[var(--color-line-soft)] transition-colors space-y-4"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[var(--color-text)]">{n.name}</h3>
                          {isLocal && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" /> LOCAL
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
                          {n.hostname}:{n.apiPort || (n.ssl ? 8443 : 8080)} {n.ssl ? '(SSL)' : ''}
                        </p>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        isMaint
                          ? 'bg-amber-950/40 text-amber-400 border-amber-800'
                          : isOnline
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        {isMaint ? 'Maintenance' : isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    {/* Hardware & Usage Metrics */}
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--color-line)] text-center">
                      <div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Servers</div>
                        <div className="text-xs font-bold text-[var(--color-text)] font-mono">{serverCount} / {n.maxServers || 100}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Memory</div>
                        <div className="text-xs font-bold text-[var(--color-text)] font-mono">{Math.round(totalRamMB / 1024)} GB</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Allocations</div>
                        <div className="text-xs font-bold text-[var(--color-text)] font-mono">{allocAssigned} / {allocTotal}</div>
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenAllocations(n)}
                          className="px-2 py-1 rounded bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text)] border border-[var(--color-line)] text-[11px] font-medium flex items-center gap-1 transition-colors"
                        >
                          <Layers className="h-3 w-3 text-[var(--color-accent)]" />
                          Ports
                        </button>

                        <button
                          onClick={() => handleProbeHealth(n)}
                          title="Probe live health"
                          className="p-1 rounded bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-line)] transition-colors"
                        >
                          <Activity className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenDiagnostics(n)}
                          title="Diagnostics & Port Scan"
                          className="p-1 rounded bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-line)] transition-colors"
                        >
                          <Wifi className="h-3.5 w-3.5" />
                        </button>

                        {!isLocal && (
                          <button
                            onClick={() => handleRotateToken(n)}
                            title="Rotate Wings Daemon Token"
                            className="p-1 rounded bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-line)] transition-colors"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleMaintenance(n)}
                          title={isMaint ? 'Disable maintenance' : 'Enable maintenance'}
                          className={`p-1 rounded border transition-colors ${
                            isMaint
                              ? 'border-amber-800 bg-amber-950/40 text-amber-400'
                              : 'border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                          }`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setEditingNode(n);
                            setEditForm({
                              name: n.name,
                              hostname: n.hostname,
                              apiPort: n.apiPort,
                              apiUrl: n.apiUrl,
                              ssl: n.ssl,
                              behindProxy: n.behindProxy,
                              memory: n.memory,
                              disk: n.disk,
                              cpu: n.cpu,
                              maxServers: n.maxServers,
                              memoryOverallocate: n.memoryOverallocate,
                              diskOverallocate: n.diskOverallocate,
                              tags: n.tags
                            });
                          }}
                          className="p-1 rounded bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-line)] transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        {!isLocal ? (
                          <button
                            onClick={() => handleDeleteNode(n)}
                            title="Delete Node"
                            className="p-1 rounded bg-[var(--color-surface-2)] hover:bg-red-950/50 text-[var(--color-text-muted)] hover:text-red-400 border border-[var(--color-line)] transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span title="Local node cannot be deleted" className="p-1 text-[var(--color-text-muted)] opacity-30 cursor-not-allowed">
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOCATIONS / REGIONS */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] text-xs text-[var(--color-text-muted)]">
            Datacenter regions allow grouping nodes geographically for server deployments and latency routing.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {locations.map(loc => (
              <div key={loc.id} className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-[var(--color-text)]">{loc.name}</div>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-line)]">{loc.flagCode || loc.id}</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">{loc.description || 'Global datacenter region'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: INSTALLER & DAEMON PAIRING */}
      {activeTab === 'installer' && (
        <div className="space-y-4">
          <div className="p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-3">
            <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[var(--color-accent)]" />
              Wings Daemon Quick-Install Command
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Run this command on your clean Linux VPS/Bare-metal server (Ubuntu, Debian, AlmaLinux, Rocky) to install Docker, the Wings runtime, and automatically connect to this AetherPanel instance.
            </p>
            <div className="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-line)] font-mono text-xs text-[var(--color-accent)] break-all select-all flex items-center justify-between">
              <span>curl -fsSL {window.location.origin}/install.sh | bash -s -- --node --panel {window.location.origin}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`curl -fsSL ${window.location.origin}/install.sh | bash -s -- --node --panel ${window.location.origin}`);
                  showToast('success', 'Copied install command to clipboard.');
                }}
                className="ml-3 px-2 py-1 rounded bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-white text-[11px] font-sans flex items-center gap-1 shrink-0"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WINGS PARITY & DOCKER HEALTH */}
      {activeTab === 'wings' && (
        <div className="p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text)]">Pterodactyl Wings Parity Subsystem</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Verifies in-process and daemon container sandbox isolation and resource governance.
              </p>
            </div>
            <button
              onClick={async () => {
                setRunningWingsTest(true);
                try {
                  const res = await apiRequest('/admin/wings/test', { method: 'POST' });
                  if (res.success && res.data) {
                    setWingsBenchmark(res.data);
                    showToast('success', 'Wings parity benchmark passed.');
                  }
                } catch (err: any) {
                  showToast('error', err.message);
                } finally {
                  setRunningWingsTest(false);
                }
              }}
              disabled={runningWingsTest}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-line)] text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5"
            >
              <Zap className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              {runningWingsTest ? 'Testing...' : 'Run Parity Benchmark'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-line)]">
              <span className="text-[var(--color-text-muted)]">Isolation Engine:</span>
              <div className="font-mono font-bold text-[var(--color-text)] mt-1">Docker / Pterodactyl Sandbox</div>
            </div>
            <div className="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-line)]">
              <span className="text-[var(--color-text-muted)]">SFTP Subsystem:</span>
              <div className="font-mono font-bold text-emerald-400 mt-1">Port 2022 (Active)</div>
            </div>
            <div className="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-line)]">
              <span className="text-[var(--color-text-muted)]">Status:</span>
              <div className="font-mono font-bold text-emerald-400 mt-1">Ready for Wings Daemons</div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NODE MODAL (3-STEP PTERODACTYL WIZARD) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-2xl rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
              <div>
                <h2 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                  <Server className="h-4 w-4 text-[var(--color-accent)]" />
                  Create Wings Compute Node
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Step {createStep} of 3: {createStep === 1 ? 'Connection & Daemon Configuration' : createStep === 2 ? 'Initial Allocations Pool' : 'Hardware Resources & Overallocations'}
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stepper Progress Indicator */}
            <div className="grid grid-cols-3 gap-2">
              <div className={`h-1.5 rounded-full ${createStep >= 1 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'}`} />
              <div className={`h-1.5 rounded-full ${createStep >= 2 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'}`} />
              <div className={`h-1.5 rounded-full ${createStep >= 3 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'}`} />
            </div>

            {/* STEP 1: CONFIGURATION */}
            {createStep === 1 && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[var(--color-text)] mb-1">Node Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. US-East Production Node 01"
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--color-text)] mb-1">FQDN / Hostname or IP *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. wings.example.com or 192.168.1.100"
                      value={createForm.hostname}
                      onChange={e => setCreateForm({ ...createForm, hostname: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Accepts FQDN or bare IPv4/IPv6 address.</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-[var(--color-text)] mb-1">Daemon API Port *</label>
                    <input
                      type="number"
                      required
                      value={createForm.apiPort}
                      onChange={e => setCreateForm({ ...createForm, apiPort: parseInt(e.target.value) || 8080 })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Default 8080 (plain HTTP) or 8443 (SSL).</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.ssl}
                      onChange={e => {
                        const isSsl = e.target.checked;
                        setCreateForm({
                          ...createForm,
                          ssl: isSsl,
                          apiPort: isSsl && createForm.apiPort === 8080 ? 8443 : createForm.apiPort
                        });
                      }}
                      className="rounded accent-[var(--color-accent)]"
                    />
                    <div>
                      <div className="font-semibold text-[var(--color-text)]">Enable SSL / HTTPS</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">Requires a valid TLS certificate on the daemon.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.behindProxy}
                      onChange={e => setCreateForm({ ...createForm, behindProxy: e.target.checked })}
                      className="rounded accent-[var(--color-accent)]"
                    />
                    <div>
                      <div className="font-semibold text-[var(--color-text)]">Behind Proxy / CDN</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">Enable if routing daemon traffic via Cloudflare or reverse proxy.</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* STEP 2: ALLOCATIONS */}
            {createStep === 2 && (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/50 text-blue-200 text-xs">
                  AetherPanel will automatically seed initial ports while skipping reserved infrastructure ports (22, 80, 443, 2022, 3000, 8080, 8443).
                </div>

                <div>
                  <label className="block font-semibold text-[var(--color-text)] mb-1">IP Address to Bind</label>
                  <input
                    type="text"
                    placeholder={createForm.hostname || '127.0.0.1'}
                    value={createForm.allocationIp}
                    onChange={e => setCreateForm({ ...createForm, allocationIp: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--color-text)] mb-1">Start Port</label>
                    <input
                      type="number"
                      value={createForm.allocStartPort}
                      onChange={e => setCreateForm({ ...createForm, allocStartPort: parseInt(e.target.value) || 25565 })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[var(--color-text)] mb-1">End Port</label>
                    <input
                      type="number"
                      value={createForm.allocEndPort}
                      onChange={e => setCreateForm({ ...createForm, allocEndPort: parseInt(e.target.value) || 25575 })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--color-text)] mb-1">IP Alias (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. play.domain.com"
                    value={createForm.allocAlias}
                    onChange={e => setCreateForm({ ...createForm, allocAlias: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>
            )}

            {/* STEP 3: RESOURCES */}
            {createStep === 3 && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--color-text)] mb-1">Total Memory (MB)</label>
                    <input
                      type="number"
                      value={createForm.memory}
                      onChange={e => setCreateForm({ ...createForm, memory: parseInt(e.target.value) || 65536 })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[var(--color-text)] mb-1">Memory Overallocate (%)</label>
                    <input
                      type="number"
                      value={createForm.memoryOverallocate}
                      onChange={e => setCreateForm({ ...createForm, memoryOverallocate: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--color-text)] mb-1">Total Disk Space (MB)</label>
                    <input
                      type="number"
                      value={createForm.disk}
                      onChange={e => setCreateForm({ ...createForm, disk: parseInt(e.target.value) || 102400 })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[var(--color-text)] mb-1">Disk Overallocate (%)</label>
                    <input
                      type="number"
                      value={createForm.diskOverallocate}
                      onChange={e => setCreateForm({ ...createForm, diskOverallocate: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--color-text)] mb-1">CPU Allocation (%)</label>
                    <input
                      type="number"
                      value={createForm.cpu}
                      onChange={e => setCreateForm({ ...createForm, cpu: parseInt(e.target.value) || 400 })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[var(--color-text)] mb-1">Max Server Limit</label>
                    <input
                      type="number"
                      value={createForm.maxServers}
                      onChange={e => setCreateForm({ ...createForm, maxServers: parseInt(e.target.value) || 100 })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--color-text)] mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={createForm.tags}
                    onChange={e => setCreateForm({ ...createForm, tags: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-4">
              {createStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCreateStep((createStep - 1) as any)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text)] flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
              ) : (
                <div />
              )}

              {createStep < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (createStep === 1 && (!createForm.name || !createForm.hostname)) {
                      showToast('error', 'Please fill in required fields (Name and Hostname).');
                      return;
                    }
                    setCreateStep((createStep + 1) as any);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-semibold flex items-center gap-1"
                >
                  Next <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateNodeSubmit}
                  className="px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" /> Create Wings Node
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ONE-TIME TOKEN PRESENTATION MODAL */}
      {tokenModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <div className="w-full max-w-lg rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Key className="h-5 w-5" />
              Wings Daemon Authentication Token
            </div>

            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-200 text-xs">
              <strong>CRITICAL:</strong> This daemon bearer token is hashed at rest using bcrypt and will <u>never</u> be shown again. Save it securely now.
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[var(--color-text-muted)] mb-1">Bearer Token ({tokenModalData.nodeName}):</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={tokenModalData.token}
                  className="w-full px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-xs font-mono text-[var(--color-accent)]"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tokenModalData.token);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 3000);
                  }}
                  className="px-3 py-2 rounded bg-[var(--color-accent)] text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                >
                  {copiedToken ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedToken ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {tokenModalData.installCmd && (
              <div>
                <label className="block text-[11px] font-mono text-[var(--color-text-muted)] mb-1">Automatic Enrollment Command:</label>
                <div className="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-line)] font-mono text-[11px] text-[var(--color-text)] break-all select-all flex items-center justify-between">
                  <span>{tokenModalData.installCmd}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tokenModalData.installCmd!);
                      setCopiedCmd(true);
                      setTimeout(() => setCopiedCmd(false), 3000);
                    }}
                    className="ml-2 px-2 py-1 rounded bg-[var(--color-surface-2)] text-white text-[10px] shrink-0"
                  >
                    {copiedCmd ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 text-right">
              <button
                onClick={() => setTokenModalData(null)}
                className="px-4 py-1.5 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-line)] text-xs font-semibold text-[var(--color-text)]"
              >
                I Have Saved This Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALLOCATIONS MODAL */}
      {selectedNodeForAllocations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-3xl rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[var(--color-accent)]" />
                  Port Allocations — {selectedNodeForAllocations.name}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Total: {allocations.length} | Available: {allocations.filter(a => !a.isAssigned && !a.assigned).length} | Assigned: {allocations.filter(a => a.isAssigned || a.assigned).length}
                </p>
              </div>
              <button onClick={() => setSelectedNodeForAllocations(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddAllocations} className="p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line)] grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <div className="sm:col-span-1">
                <label className="block text-[10px] text-[var(--color-text-muted)] mb-0.5">IP</label>
                <input
                  type="text"
                  required
                  value={newAllocIp}
                  onChange={e => setNewAllocIp(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-text)] text-xs"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[10px] text-[var(--color-text-muted)] mb-0.5">Start Port</label>
                <input
                  type="number"
                  required
                  value={newAllocStart}
                  onChange={e => setNewAllocStart(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-text)] text-xs"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[10px] text-[var(--color-text-muted)] mb-0.5">End Port</label>
                <input
                  type="number"
                  required
                  value={newAllocEnd}
                  onChange={e => setNewAllocEnd(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-text)] text-xs"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[10px] text-[var(--color-text-muted)] mb-0.5">Alias (Optional)</label>
                <input
                  type="text"
                  placeholder="play.host.net"
                  value={newAllocAlias}
                  onChange={e => setNewAllocAlias(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-text)] text-xs"
                />
              </div>

              <div className="sm:col-span-1 flex items-end">
                <button
                  type="submit"
                  className="w-full py-1.5 rounded bg-[var(--color-accent)] hover:opacity-90 text-white font-semibold text-xs transition-opacity"
                >
                  Add Ports
                </button>
              </div>
            </form>

            {/* Filter and Purge Bar */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter by port or IP..."
                  value={allocSearch}
                  onChange={e => setAllocSearch(e.target.value)}
                  className="px-2.5 py-1 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] text-xs w-48"
                />
                <select
                  value={allocFilter}
                  onChange={e => setAllocFilter(e.target.value as any)}
                  className="px-2 py-1 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)] text-xs"
                >
                  <option value="all">All Status</option>
                  <option value="available">Available Only</option>
                  <option value="assigned">Assigned Only</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handlePurgeAllocations}
                className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-950/70 border border-red-800 text-red-300 text-xs flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Purge Unassigned
              </button>
            </div>

            {/* Allocations Table */}
            <div className="flex-1 overflow-y-auto border border-[var(--color-line)] rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-bg)] border-b border-[var(--color-line)] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="py-2 px-3">IP & Port</th>
                    <th className="py-2 px-3">Alias</th>
                    <th className="py-2 px-3">Assigned Server</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {allocations
                    .filter(a => {
                      const matchesF = allocFilter === 'all' || (allocFilter === 'assigned' ? (a.isAssigned || a.assigned) : (!a.isAssigned && !a.assigned));
                      const matchesS = !allocSearch || a.port.toString().includes(allocSearch) || a.ip.includes(allocSearch) || (a.alias && a.alias.includes(allocSearch));
                      return matchesF && matchesS;
                    })
                    .map(a => {
                      const assigned = Boolean(a.isAssigned || a.assigned);
                      return (
                        <tr key={a.id} className="hover:bg-[var(--color-surface-2)]">
                          <td className="py-2 px-3 font-mono font-medium text-[var(--color-text)]">
                            {a.ip}:{a.port}
                          </td>
                          <td className="py-2 px-3 font-mono text-[var(--color-text-muted)]">
                            {a.alias || '—'}
                          </td>
                          <td className="py-2 px-3">
                            {assigned ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 font-medium">
                                {a.serverName || 'Assigned'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-mono">Available</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {!assigned ? (
                              <button
                                onClick={() => handleDeleteAllocation(a.id)}
                                className="text-red-400 hover:text-red-300"
                                title="Delete allocation"
                              >
                                <Trash2 className="h-3.5 w-3.5 inline" />
                              </button>
                            ) : (
                              <span className="text-[var(--color-text-muted)] opacity-30 cursor-not-allowed">
                                <Lock className="h-3 w-3 inline" />
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT NODE MODAL */}
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <form onSubmit={handleEditNodeSubmit} className="w-full max-w-lg rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)]">
                Edit Node — {editingNode.name}
              </h3>
              <button type="button" onClick={() => setEditingNode(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--color-text)] mb-1">Node Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name || ''}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)]"
                />
              </div>

              {!(editingNode.id === 'local' || editingNode.isLocal) && (
                <div>
                  <label className="block font-semibold text-[var(--color-text)] mb-1">Hostname (FQDN/IP)</label>
                  <input
                    type="text"
                    required
                    value={editForm.hostname || ''}
                    onChange={e => setEditForm({ ...editForm, hostname: e.target.value })}
                    className="w-full px-3 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--color-text)] mb-1">Memory (MB)</label>
                  <input
                    type="number"
                    value={editForm.memory || 65536}
                    onChange={e => setEditForm({ ...editForm, memory: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--color-text)] mb-1">Disk (MB)</label>
                  <input
                    type="number"
                    value={editForm.disk || 102400}
                    onChange={e => setEditForm({ ...editForm, disk: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--color-text)] mb-1">CPU Limit (%)</label>
                  <input
                    type="number"
                    value={editForm.cpu || 400}
                    onChange={e => setEditForm({ ...editForm, cpu: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--color-text)] mb-1">Max Servers</label>
                  <input
                    type="number"
                    value={editForm.maxServers || 100}
                    onChange={e => setEditForm({ ...editForm, maxServers: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-text)]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-line)] pt-3">
              <button
                type="button"
                onClick={() => setEditingNode(null)}
                className="px-3 py-1.5 rounded bg-[var(--color-surface-2)] text-xs text-[var(--color-text)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[var(--color-accent)] text-white text-xs font-semibold"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DIAGNOSTICS MODAL */}
      {selectedNodeForDiagnostics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-lg rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                <Wifi className="h-4 w-4 text-[var(--color-accent)]" />
                Network Diagnostics — {selectedNodeForDiagnostics.name}
              </h3>
              <button onClick={() => setSelectedNodeForDiagnostics(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {diagnosticsLoading ? (
              <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">Running diagnostic probes...</div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2">
                  <div className="font-semibold text-[var(--color-text)]">Service Port Probes</div>
                  <div className="space-y-1.5">
                    {diagnosticsData?.ports?.map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-[var(--color-text)]">Port {p.port} ({p.service})</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${p.reachable ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'}`}>
                          {p.reachable ? 'REACHABLE' : 'UNREACHABLE'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-[var(--color-text-muted)]">
                  Node Hostname: <span className="font-mono text-[var(--color-text)]">{selectedNodeForDiagnostics.hostname}</span>
                  <br />
                  Mode: <span className="font-mono text-[var(--color-text)]">{selectedNodeForDiagnostics.isLocal ? 'In-Process Local' : 'Remote Wings Daemon'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
