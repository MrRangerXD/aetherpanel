import React, { useState, useEffect } from 'react';
import {
  HardDrive, Server, Activity, ShieldCheck, AlertTriangle, Plus, Terminal,
  Globe, Cpu, Database, Settings, Trash2, Edit3, Copy, Check,
  ExternalLink, RefreshCw, Layers, Shield, Wifi, WifiOff, X, HelpCircle,
  Search, Filter, CheckCircle2, Lock, Tag, ArrowRight, ArrowLeft, Key, Zap,
  Play, Square, AlertCircle, Eye, Radio, Clock, ChevronRight
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Node, Allocation } from '../../types';

interface NodeDetailed extends Node {
  servers?: Array<{
    id: string;
    name: string;
    status: string;
    primaryPort: number;
    ramMB?: number;
    cpuCores?: number;
    diskGB?: number;
  }>;
  ipAlias?: string;
  allocations?: Allocation[];
  allocationsCount?: {
    total: number;
    assigned: number;
    available: number;
  };
}

export const AdminNodes: React.FC = () => {
  const [nodes, setNodes] = useState<NodeDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // Flash toasts
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // Create Node Form State
  const [formData, setFormData] = useState({
    name: '',
    countryCode: 'US',
    description: '',
    location: '',
    hostname: '',
    daemonPort: 9666,
    ipAlias: '',
    memory: 65536,
    disk: 102400,
    cpu: 400,
    maxServers: 100,
    portRanges: [{ startPort: 25565, endPort: 25665 }]
  });
  const [submitting, setSubmitting] = useState(false);

  // Animated Token Modal
  const [tokenModal, setTokenModal] = useState<{
    nodeName: string;
    token: string;
    nodeId: string;
    panelUrl: string;
    daemonPort: number;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // View / Overview Modal
  const [viewingNode, setViewingNode] = useState<NodeDetailed | null>(null);
  const [viewTab, setViewTab] = useState<'overview' | 'servers' | 'allocations' | 'config'>('overview');
  const [pingStatus, setPingStatus] = useState<{ pinging: boolean; online?: boolean; latencyMs?: number | null; message?: string } | null>(null);
  const [newAllocPort, setNewAllocPort] = useState('');
  const [addingAlloc, setAddingAlloc] = useState(false);

  // Edit Node Modal
  const [editingNode, setEditingNode] = useState<NodeDetailed | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    hostname: '',
    daemonPort: 9666,
    ipAlias: '',
    flagCode: 'US',
    location: '',
    memory: 65536,
    disk: 102400,
    cpu: 400,
    maxServers: 100,
    maintenanceMode: false
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/admin/nodes');
      if (res.success && Array.isArray(res.data)) {
        setNodes(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch nodes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 10000);
    return () => clearInterval(interval);
  }, []);

  const openOverview = async (node: NodeDetailed) => {
    setViewingNode(node);
    setViewTab('overview');
    setPingStatus(null);
    try {
      const res = await apiRequest(`/admin/nodes/${node.id}`);
      if (res.success && res.data) {
        setViewingNode(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch node details:', e);
    }
  };

  const handleTestPing = async (nodeId: string) => {
    setPingStatus({ pinging: true });
    try {
      const res = await apiRequest(`/admin/nodes/${nodeId}/ping`, { method: 'POST' });
      if (res.success) {
        setPingStatus({
          pinging: false,
          online: res.online,
          latencyMs: res.latencyMs,
          message: res.message
        });
        showToast('success', res.online ? `Node responding! Latency: ${res.latencyMs || 1}ms` : 'Node is currently unreachable');
        fetchNodes();
      } else {
        setPingStatus({ pinging: false, online: false, message: res.error?.message || 'Ping failed' });
        showToast('error', res.error?.message || 'Ping failed');
      }
    } catch (e: any) {
      setPingStatus({ pinging: false, online: false, message: e.message });
      showToast('error', e.message);
    }
  };

  const openEdit = (node: NodeDetailed) => {
    setEditingNode(node);
    setEditForm({
      name: node.name || '',
      hostname: node.hostname || '',
      daemonPort: Number(node.apiPort || node.daemonPort) || 9666,
      ipAlias: node.ipAlias || '',
      flagCode: (node.flagCode || 'US').toUpperCase(),
      location: node.location || node.locationName || '',
      memory: node.memory || node.totalRamMB || 65536,
      disk: node.disk || (node.totalDiskGB ? node.totalDiskGB * 1024 : 102400),
      cpu: node.cpu || (node.totalCpuCores ? node.totalCpuCores * 100 : 400),
      maxServers: node.maxServers || 100,
      maintenanceMode: Boolean(node.maintenanceMode || node.status === 'maintenance')
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode) return;
    if (!editForm.name.trim() || !editForm.hostname.trim()) {
      showToast('error', 'Node name and Hostname/FQDN are required.');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await apiRequest(`/admin/nodes/${editingNode.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name.trim(),
          hostname: editForm.hostname.trim(),
          apiPort: Number(editForm.daemonPort) || 9666,
          ipAlias: editForm.ipAlias.trim(),
          flagCode: editForm.flagCode.trim().toUpperCase(),
          location: editForm.location.trim(),
          locationName: editForm.location.trim(),
          memory: Number(editForm.memory) || 65536,
          disk: Number(editForm.disk) || 102400,
          cpu: Number(editForm.cpu) || 400,
          maxServers: Number(editForm.maxServers) || 100,
          maintenanceMode: editForm.maintenanceMode
        })
      });

      if (res.success) {
        showToast('success', `Node '${editForm.name}' updated successfully!`);
        setEditingNode(null);
        fetchNodes();
        if (viewingNode && viewingNode.id === editingNode.id) {
          openOverview(res.data || { ...viewingNode, ...editForm });
        }
      } else {
        showToast('error', res.error?.message || 'Failed to update node');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error updating node');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingNode || !newAllocPort.trim()) return;
    const portNum = parseInt(newAllocPort.trim(), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      showToast('error', 'Please enter a valid port between 1 and 65535');
      return;
    }

    setAddingAlloc(true);
    try {
      const res = await apiRequest(`/admin/nodes/${viewingNode.id}/allocations`, {
        method: 'POST',
        body: JSON.stringify({
          ip: viewingNode.hostname || '127.0.0.1',
          startPort: portNum,
          endPort: portNum
        })
      });

      if (res.success) {
        showToast('success', `Port ${portNum} allocated to ${viewingNode.name}`);
        setNewAllocPort('');
        openOverview(viewingNode);
      } else {
        showToast('error', res.error?.message || 'Failed to allocate port');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error adding allocation');
    } finally {
      setAddingAlloc(false);
    }
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('error', 'Node Name is required');
      return;
    }
    if (!formData.hostname.trim()) {
      showToast('error', 'IP Address / Hostname (or FQDN) is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/admin/nodes', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name.trim(),
          hostname: formData.hostname.trim(),
          apiPort: Number(formData.daemonPort) || 9666,
          flagCode: (formData.countryCode || 'US').toUpperCase(),
          description: formData.description.trim(),
          location: formData.location.trim() || 'Default Region',
          locationName: formData.location.trim() || 'Default Region',
          ipAlias: formData.ipAlias.trim(),
          memory: Number(formData.memory) || 65536,
          disk: Number(formData.disk) || 102400,
          cpu: Number(formData.cpu) || 400,
          maxServers: Number(formData.maxServers) || 100,
          portRanges: formData.portRanges
        })
      });

      if (res.success) {
        const rawToken = res.token || res.data?.token || res.daemonConfig?.token || '';
        const origin = window.location.origin;
        setTokenModal({
          nodeName: formData.name,
          token: rawToken,
          nodeId: res.data?.id || res.node?.id || 'node_1',
          panelUrl: origin,
          daemonPort: Number(formData.daemonPort) || 9666
        });
        showToast('success', `Node '${formData.name}' created successfully!`);
        // Reset form
        setFormData({
          name: '',
          countryCode: 'US',
          description: '',
          location: '',
          hostname: '',
          daemonPort: 9666,
          ipAlias: '',
          memory: 65536,
          disk: 102400,
          cpu: 400,
          maxServers: 100,
          portRanges: [{ startPort: 25565, endPort: 25665 }]
        });
        fetchNodes();
      } else {
        showToast('error', res.error?.message || 'Failed to create node');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error creating node');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNode = async (nodeId: string, nodeName: string, isLocal?: boolean) => {
    if (isLocal) {
      if (!confirm(`'${nodeName}' is your primary local node hosting the control plane. Deleting it is restricted. Would you like to put it in Maintenance Mode instead?`)) {
        return;
      }
      try {
        const res = await apiRequest(`/admin/nodes/${nodeId}`, {
          method: 'PUT',
          body: JSON.stringify({ maintenanceMode: true })
        });
        if (res.success) {
          showToast('success', `Local Node '${nodeName}' switched to Maintenance Mode`);
          fetchNodes();
        }
      } catch (e: any) {
        showToast('error', e.message);
      }
      return;
    }

    if (!confirm(`Are you sure you want to delete node '${nodeName}'? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await apiRequest(`/admin/nodes/${nodeId}`, { method: 'DELETE' });
      if (res.success) {
        showToast('success', `Node '${nodeName}' deleted`);
        fetchNodes();
        if (viewingNode?.id === nodeId) setViewingNode(null);
      } else {
        showToast('error', res.error?.message || 'Failed to delete node');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleAddRange = () => {
    const lastRange = formData.portRanges[formData.portRanges.length - 1];
    const nextStart = lastRange ? lastRange.endPort + 1 : 25565;
    setFormData({
      ...formData,
      portRanges: [...formData.portRanges, { startPort: nextStart, endPort: nextStart + 50 }]
    });
  };

  const handleRemoveRange = (idx: number) => {
    if (formData.portRanges.length <= 1) return;
    setFormData({
      ...formData,
      portRanges: formData.portRanges.filter((_, i) => i !== idx)
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const onlineNodes = nodes.filter(n => n.status === 'online');
  const offlineNodes = nodes.filter(n => n.status !== 'online');
  const totalServersCount = nodes.reduce((acc, n) => acc + (n.serverCount || 0), 0);

  const filteredNodes = nodes.filter(n => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return n.name.toLowerCase().includes(q) || (n.hostname || '').toLowerCase().includes(q) || (n.ipAlias || '').toLowerCase().includes(q);
  });

  const getFlagEmoji = (countryCode?: string) => {
    if (!countryCode || countryCode === 'LOCAL') return '⚡';
    if (countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const formatRelativeTime = (iso?: string | null) => {
    if (!iso) return 'Never';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg text-xs font-semibold shadow-lg transition-all flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border border-emerald-400'
              : 'bg-red-600 text-white border border-red-400'
          }`}
        >
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-white">
              <HardDrive className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Node Management</h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Manage remote daemon nodes for distributed hosting • {nodes.length} total
          </p>
        </div>

        {viewMode === 'list' && (
          <button
            onClick={() => setViewMode('create')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold text-xs shadow-md shadow-[#f97316]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Node</span>
          </button>
        )}
      </div>

      {/* 4 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL NODES */}
        <div className="p-4 rounded-xl bg-[#14151b] border border-[#23252e] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-medium tracking-wider text-neutral-400 uppercase">
              Total Nodes
            </span>
            <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono">{nodes.length}</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">registered in the panel</div>
          </div>
        </div>

        {/* ONLINE */}
        <div className="p-4 rounded-xl bg-[#14151b] border border-emerald-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-medium tracking-wider text-emerald-400 uppercase">
              Online
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wifi className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-400 font-mono">{onlineNodes.length}</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">reporting heartbeats</div>
          </div>
        </div>

        {/* OFFLINE */}
        <div className="p-4 rounded-xl bg-[#14151b] border border-red-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-medium tracking-wider text-red-400 uppercase">
              Offline
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <WifiOff className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-red-400 font-mono">{offlineNodes.length}</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">not reachable</div>
          </div>
        </div>

        {/* TOTAL SERVERS */}
        <div className="p-4 rounded-xl bg-[#14151b] border border-blue-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-medium tracking-wider text-blue-400 uppercase">
              Total Servers
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Server className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-400 font-mono">{totalServersCount}</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">across all nodes</div>
          </div>
        </div>
      </div>

      {/* VIEW: CREATE NODE (Smooth Animated Slide-in) */}
      {viewMode === 'create' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('list')}
              className="p-2 rounded-lg bg-[#14151b] border border-[#23252e] text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#f97316]" /> Create Node
              </h2>
              <p className="text-xs text-neutral-400">Register a new daemon node for distributed hosting</p>
            </div>
          </div>

          <form onSubmit={handleCreateNode} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Form Fields */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: BASIC INFORMATION */}
              <div className="p-5 rounded-xl bg-[#14151b] border border-[#23252e] space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#23252e] pb-3">
                  <Activity className="w-4 h-4 text-[#f97316]" />
                  <span>Basic Information</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">
                      Node Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. IN-1 or US-East-1"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs focus:outline-none focus:border-[#f97316]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">Country Code</label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="US"
                        value={formData.countryCode}
                        onChange={e => setFormData({ ...formData, countryCode: e.target.value.toUpperCase() })}
                        className="w-full pl-3 pr-10 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs uppercase font-mono focus:outline-none focus:border-[#f97316]"
                      />
                      <span className="absolute right-3 text-base">
                        {getFlagEmoji(formData.countryCode)}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">2-letter code (e.g. US, IN, DE)</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Optional description of this node (e.g. Dedicated AMD Ryzen 9 7950X, 128GB RAM)"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs focus:outline-none focus:border-[#f97316]"
                  />
                  <span className="text-[10px] text-neutral-500 font-mono">Optional — max 1000 characters</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Asia, Frankfurt, Mumbai, New York"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs focus:outline-none focus:border-[#f97316]"
                  />
                </div>
              </div>

              {/* Card 2: NETWORK CONFIGURATION */}
              <div className="p-5 rounded-xl bg-[#14151b] border border-[#23252e] space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#23252e] pb-3">
                  <Globe className="w-4 h-4 text-[#f97316]" />
                  <span>Network Configuration</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">
                      IP Address / Hostname <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="localhost, 127.0.0.1, or node.znx.xyz.com"
                      value={formData.hostname}
                      onChange={e => setFormData({ ...formData, hostname: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono focus:outline-none focus:border-[#f97316]"
                    />
                    <span className="text-[10px] text-neutral-500 font-mono">IPv4, IPv6, localhost, or FQDN</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">
                      Daemon Port <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="9666"
                      value={formData.daemonPort}
                      onChange={e => setFormData({ ...formData, daemonPort: parseInt(e.target.value) || 9666 })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono focus:outline-none focus:border-[#f97316]"
                    />
                    <span className="text-[10px] text-neutral-500 font-mono">Default: 9666</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">IP Alias (display only)</label>
                  <input
                    type="text"
                    placeholder="e.g. play.example.com or node1.myhost.net"
                    value={formData.ipAlias}
                    onChange={e => setFormData({ ...formData, ipAlias: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs focus:outline-none focus:border-[#f97316]"
                  />
                  <span className="text-[10px] text-neutral-500 font-mono">Shown to users instead of the raw IP</span>
                </div>
              </div>

              {/* Card 3: RESOURCE CAPACITY */}
              <div className="p-5 rounded-xl bg-[#14151b] border border-[#23252e] space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#23252e] pb-3">
                  <Cpu className="w-4 h-4 text-[#f97316]" />
                  <span>Hardware Allocation Limits</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">RAM (MB)</label>
                    <input
                      type="number"
                      value={formData.memory}
                      onChange={e => setFormData({ ...formData, memory: parseInt(e.target.value) || 1024 })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">Disk (MB)</label>
                    <input
                      type="number"
                      value={formData.disk}
                      onChange={e => setFormData({ ...formData, disk: parseInt(e.target.value) || 1024 })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">CPU (%)</label>
                    <input
                      type="number"
                      value={formData.cpu}
                      onChange={e => setFormData({ ...formData, cpu: parseInt(e.target.value) || 100 })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">Max Servers</label>
                    <input
                      type="number"
                      value={formData.maxServers}
                      onChange={e => setFormData({ ...formData, maxServers: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: PORT RANGES */}
              <div className="p-5 rounded-xl bg-[#14151b] border border-[#23252e] space-y-4">
                <div className="flex items-center justify-between border-b border-[#23252e] pb-3">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                    <Layers className="w-4 h-4 text-[#f97316]" />
                    <span>Port Ranges</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRange}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#0c0d12] border border-[#23252e] text-xs text-neutral-300 hover:text-white hover:bg-[#1e2029] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#f97316]" />
                    <span>Add Range</span>
                  </button>
                </div>

                <p className="text-[11px] text-neutral-400">
                  Define which ports can be allocated to servers on this node.
                </p>

                <div className="space-y-3">
                  {formData.portRanges.map((range, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-mono uppercase text-neutral-400">Start Port</label>
                        <input
                          type="number"
                          value={range.startPort}
                          onChange={e => {
                            const newRanges = [...formData.portRanges];
                            newRanges[idx].startPort = parseInt(e.target.value) || 0;
                            setFormData({ ...formData, portRanges: newRanges });
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-mono uppercase text-neutral-400">End Port</label>
                        <input
                          type="number"
                          value={range.endPort}
                          onChange={e => {
                            const newRanges = [...formData.portRanges];
                            newRanges[idx].endPort = parseInt(e.target.value) || 0;
                            setFormData({ ...formData, portRanges: newRanges });
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono"
                        />
                      </div>
                      {formData.portRanges.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRange(idx)}
                          className="p-2 mt-5 text-neutral-500 hover:text-red-400 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-4 py-2 rounded-lg bg-[#14151b] border border-[#23252e] text-neutral-300 text-xs font-medium hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold text-xs shadow-md shadow-[#f97316]/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating Node...' : 'Create Node'}
                </button>
              </div>
            </div>

            {/* Right Column: Setup Guide & Security Notes */}
            <div className="space-y-6">
              {/* Setup Guide */}
              <div className="p-5 rounded-xl bg-[#14151b] border border-[#23252e] space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#23252e] pb-2">
                  <Zap className="w-4 h-4 text-[#f97316]" />
                  <span>Setup Guide</span>
                </div>
                <div className="space-y-2 text-xs text-neutral-300">
                  <p>1. Fill in the node details</p>
                  <p>2. Click <strong className="text-white">Create Node</strong></p>
                  <p>3. Copy the generated <strong className="text-[#f97316]">token</strong> (shown once)</p>
                  <p>4. Install the daemon on the remote server:</p>
                  <div className="p-2 rounded bg-[#0c0d12] border border-[#23252e] font-mono text-[10px] text-neutral-300">
                    node agent.js
                  </div>
                  <p>5. Configure the daemon with the token and panel URL</p>
                  <p>6. Start the daemon — it will begin sending heartbeats</p>
                </div>
              </div>

              {/* Security Notes */}
              <div className="p-5 rounded-xl bg-[#14151b] border border-[#23252e] space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#23252e] pb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Security Notes</span>
                </div>
                <div className="space-y-2.5 text-xs text-neutral-300">
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Only a SHA-256 hash of the token is stored.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Agents make outbound requests only — no inbound port needed.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Commands are queued and pulled by the agent.</span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* VIEW: NODES LIST (Spacious, full-width) */
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-[#14151b] border border-[#23252e]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#23252e]">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                <Layers className="w-4 h-4 text-[#f97316]" />
                <span>All Nodes</span>
              </div>

              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search nodes by name or IP..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-[#f97316] w-56"
                  />
                </div>

                <button
                  onClick={fetchNodes}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-xs text-neutral-300 hover:text-white hover:bg-[#181920] transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#f97316]' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Empty State when no nodes exist */}
            {nodes.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800/60 border border-neutral-700 mx-auto flex items-center justify-center text-neutral-400">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">No nodes yet</h3>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    Nodes are the machines that run your servers. Create one to get started with distributed hosting.
                  </p>
                </div>
                <button
                  onClick={() => setViewMode('create')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold text-xs shadow-md shadow-[#f97316]/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create your first node</span>
                </button>
              </div>
            ) : (
              /* Table with nodes */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#23252e] text-neutral-400 font-mono uppercase text-[10px]">
                      <th className="pb-3 font-medium">Node</th>
                      <th className="pb-3 font-medium">Address</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Servers</th>
                      <th className="pb-3 font-medium">Memory</th>
                      <th className="pb-3 font-medium">Disk</th>
                      <th className="pb-3 font-medium">Heartbeat</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23252e]/50">
                    {filteredNodes.map(node => {
                      const isOnline = node.status === 'online';
                      const isMaint = node.maintenanceMode || node.status === 'maintenance';
                      return (
                        <tr key={node.id} className="hover:bg-[#181920]/50 transition-colors">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{getFlagEmoji(node.flagCode || (node.isLocal ? 'LOCAL' : 'US'))}</span>
                              <div>
                                <div className="font-bold text-white flex items-center gap-2">
                                  <span>{node.name}</span>
                                  {node.isLocal && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                      LOCAL
                                    </span>
                                  )}
                                  {isMaint && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      MAINTENANCE
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-neutral-400 font-mono">
                                  {node.locationName || node.location || 'Primary Region'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-neutral-300">
                            {node.hostname}:{node.apiPort || node.daemonPort || 9666}
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                                isOnline
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : isMaint
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-emerald-400 animate-pulse' : isMaint ? 'bg-amber-400' : 'bg-red-400'
                                }`}
                              />
                              {isOnline ? 'ONLINE' : isMaint ? 'MAINTENANCE' : 'OFFLINE'}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-neutral-300">
                            {node.serverCount || 0} / {node.maxServers || 100}
                          </td>
                          <td className="py-3 font-mono text-neutral-300">
                            {node.usedRamMB || 0} / {node.totalRamMB || node.memory || 0} MB
                          </td>
                          <td className="py-3 font-mono text-neutral-300">
                            {node.usedDiskGB || 0} / {node.totalDiskGB || Math.round((node.disk || 0) / 1024)} GB
                          </td>
                          <td className="py-3 font-mono text-[11px] text-neutral-400">
                            {formatRelativeTime(node.lastHeartbeatAt)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Overview Button */}
                              <button
                                onClick={() => openOverview(node)}
                                className="p-1.5 text-neutral-400 hover:text-white transition-colors rounded hover:bg-[#23252e] cursor-pointer"
                                title="Node Overview & Telemetry"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Node Button */}
                              <button
                                onClick={() => openEdit(node)}
                                className="p-1.5 text-neutral-400 hover:text-[#f97316] transition-colors rounded hover:bg-[#23252e] cursor-pointer"
                                title="Edit Node Configuration"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteNode(node.id, node.name, node.isLocal)}
                                className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors rounded hover:bg-[#23252e] cursor-pointer"
                                title={node.isLocal ? "Local Node Protection" : "Delete Node"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANIMATED TOKEN PRESENTATION POPUP */}
      {tokenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#14151b] border border-[#23252e] p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            {/* Header with Gold Key Icon */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Node Token Generated</h3>
              </div>
            </div>

            <div className="text-xs text-neutral-300 space-y-1">
              <p>
                Node <strong className="text-white">{tokenModal.nodeName}</strong> has been created successfully!
              </p>
              <p className="text-neutral-400">Use this token to authenticate the daemon:</p>
            </div>

            {/* Token box */}
            <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e] font-mono text-xs text-amber-300 break-all select-all flex items-center justify-between gap-2">
              <span>{tokenModal.token}</span>
              <button
                onClick={() => copyToClipboard(tokenModal.token)}
                className="p-1.5 text-neutral-400 hover:text-white shrink-0 cursor-pointer"
                title="Copy Token"
              >
                {copiedToken ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Daemon Configuration */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-neutral-400 font-semibold">
                Daemon Configuration
              </div>
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e] font-mono text-xs text-emerald-400 space-y-1 select-all relative">
                <div>PANEL_URL={tokenModal.panelUrl}</div>
                <div>NODE_TOKEN={tokenModal.token}</div>
                <div>NODE_ID={tokenModal.nodeId}</div>
                <div>DAEMON_PORT={tokenModal.daemonPort}</div>
              </div>
            </div>

            {/* Warning banner */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-medium">Save this token now! It cannot be retrieved later.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  copyToClipboard(tokenModal.token);
                  setTokenModal(null);
                  setViewMode('list');
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold text-xs shadow-md shadow-[#f97316]/20 transition-all cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Token & Continue</span>
              </button>

              <button
                onClick={() => {
                  setTokenModal(null);
                  setViewMode('list');
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-neutral-300 font-medium text-xs hover:text-white hover:bg-[#181920] transition-colors cursor-pointer"
              >
                <span>Go to Nodes List</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE NODE OVERVIEW MODAL */}
      {viewingNode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#14151b] border border-[#23252e] p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#23252e] pb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getFlagEmoji(viewingNode.flagCode || (viewingNode.isLocal ? 'LOCAL' : 'US'))}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{viewingNode.name}</h3>
                    {viewingNode.isLocal && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        LOCAL
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                        viewingNode.status === 'online'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${viewingNode.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                      {viewingNode.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-mono mt-0.5">
                    {viewingNode.hostname}:{viewingNode.apiPort || viewingNode.daemonPort || 9666} • {viewingNode.locationName || viewingNode.location || 'Local VPS'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTestPing(viewingNode.id)}
                  disabled={pingStatus?.pinging}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-xs font-mono text-neutral-300 hover:text-white hover:bg-[#181920] cursor-pointer disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${pingStatus?.pinging ? 'animate-spin text-[#f97316]' : 'text-emerald-400'}`} />
                  <span>{pingStatus?.pinging ? 'Pinging...' : 'Test Ping'}</span>
                </button>

                <button
                  onClick={() => openEdit(viewingNode)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-xs text-neutral-300 hover:text-[#f97316] hover:bg-[#181920] cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => setViewingNode(null)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-[#23252e] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Ping Feedback Banner */}
            {pingStatus && !pingStatus.pinging && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  pingStatus.online
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                {pingStatus.online ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>
                  {pingStatus.message} {pingStatus.latencyMs ? `(Latency: ${pingStatus.latencyMs}ms)` : ''}
                </span>
              </div>
            )}

            {/* Navigation Tabs inside Overview */}
            <div className="flex items-center gap-2 border-b border-[#23252e] pb-2">
              <button
                onClick={() => setViewTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  viewTab === 'overview'
                    ? 'bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/40 font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-[#181920]'
                }`}
              >
                Telemetry & Gauges
              </button>
              <button
                onClick={() => setViewTab('servers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  viewTab === 'servers'
                    ? 'bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/40 font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-[#181920]'
                }`}
              >
                Servers ({viewingNode.serverCount || viewingNode.servers?.length || 0})
              </button>
              <button
                onClick={() => setViewTab('allocations')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  viewTab === 'allocations'
                    ? 'bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/40 font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-[#181920]'
                }`}
              >
                Allocations ({viewingNode.allocationsCount?.total || viewingNode.allocations?.length || 0})
              </button>
              <button
                onClick={() => setViewTab('config')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  viewTab === 'config'
                    ? 'bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/40 font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-[#181920]'
                }`}
              >
                Daemon Config
              </button>
            </div>

            {/* TAB CONTENT */}
            {viewTab === 'overview' && (
              <div className="space-y-6">
                {/* 3 Live Hardware Gauges */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Memory Gauge */}
                  <div className="p-4 rounded-xl bg-[#0c0d12] border border-[#23252e] space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <span className="font-mono uppercase font-semibold">Memory Allocated</span>
                      <Cpu className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xl font-bold font-mono text-white">
                        {viewingNode.usedRamMB || 0} / {viewingNode.totalRamMB || viewingNode.memory || 4096} MB
                      </div>
                      <div className="w-full bg-[#1e2029] h-2 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.round(((viewingNode.usedRamMB || 0) / Math.max(1, viewingNode.totalRamMB || viewingNode.memory || 4096)) * 100))}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      {Math.round(((viewingNode.usedRamMB || 0) / Math.max(1, viewingNode.totalRamMB || viewingNode.memory || 4096)) * 100)}% allocated
                    </div>
                  </div>

                  {/* Disk Gauge */}
                  <div className="p-4 rounded-xl bg-[#0c0d12] border border-[#23252e] space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <span className="font-mono uppercase font-semibold">Disk Allocated</span>
                      <HardDrive className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xl font-bold font-mono text-white">
                        {viewingNode.usedDiskGB || 0} / {viewingNode.totalDiskGB || Math.round((viewingNode.disk || 102400) / 1024)} GB
                      </div>
                      <div className="w-full bg-[#1e2029] h-2 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.round(((viewingNode.usedDiskGB || 0) / Math.max(1, viewingNode.totalDiskGB || Math.round((viewingNode.disk || 102400) / 1024))) * 100))}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      {Math.round(((viewingNode.usedDiskGB || 0) / Math.max(1, viewingNode.totalDiskGB || Math.round((viewingNode.disk || 102400) / 1024))) * 100)}% allocated
                    </div>
                  </div>

                  {/* CPU Gauge */}
                  <div className="p-4 rounded-xl bg-[#0c0d12] border border-[#23252e] space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <span className="font-mono uppercase font-semibold">CPU Cores & Threads</span>
                      <Activity className="w-4 h-4 text-[#f97316]" />
                    </div>
                    <div>
                      <div className="text-xl font-bold font-mono text-white">
                        {viewingNode.totalCpuCores || Math.max(1, Math.round((viewingNode.cpu || 400) / 100))} Cores
                      </div>
                      <div className="text-xs text-neutral-400 font-mono mt-1">
                        Capacity: {viewingNode.cpu || 400}% total vCPU
                      </div>
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      Daemon reporting live host CPU metrics
                    </div>
                  </div>
                </div>

                {/* Node Metadata & Connection Card */}
                <div className="p-4 rounded-xl bg-[#0c0d12] border border-[#23252e] space-y-3">
                  <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                    Node Metadata & Connectivity
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                    <div>
                      <div className="text-neutral-500 text-[10px]">DAEMON PORT</div>
                      <div className="text-white font-semibold mt-0.5">{viewingNode.apiPort || viewingNode.daemonPort || 9666}</div>
                    </div>
                    <div>
                      <div className="text-neutral-500 text-[10px]">SFTP PORT</div>
                      <div className="text-white font-semibold mt-0.5">{viewingNode.sftpPort || 2022}</div>
                    </div>
                    <div>
                      <div className="text-neutral-500 text-[10px]">LAST HEARTBEAT</div>
                      <div className="text-white font-semibold mt-0.5">{formatRelativeTime(viewingNode.lastHeartbeatAt)}</div>
                    </div>
                    <div>
                      <div className="text-neutral-500 text-[10px]">NODE TYPE</div>
                      <div className="text-white font-semibold mt-0.5">{viewingNode.isLocal ? 'In-Process Local' : 'Remote Wings Agent'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SERVERS */}
            {viewTab === 'servers' && (
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  Servers Deployed on {viewingNode.name}
                </div>
                {viewingNode.servers && viewingNode.servers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#23252e] text-neutral-400 font-mono uppercase text-[10px]">
                          <th className="pb-2 font-medium">Server Name</th>
                          <th className="pb-2 font-medium">Port</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium">RAM Limit</th>
                          <th className="pb-2 font-medium">Disk Limit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#23252e]/50 font-mono">
                        {viewingNode.servers.map(srv => (
                          <tr key={srv.id} className="hover:bg-[#181920]/40">
                            <td className="py-2.5 font-bold text-white">{srv.name}</td>
                            <td className="py-2.5 text-neutral-300">{srv.primaryPort}</td>
                            <td className="py-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${srv.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
                                {srv.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2.5 text-neutral-300">{srv.ramMB} MB</td>
                            <td className="py-2.5 text-neutral-300">{srv.diskGB} GB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-neutral-500 font-mono">
                    No game servers deployed on this node yet.
                  </div>
                )}
              </div>
            )}

            {/* TAB: ALLOCATIONS */}
            {viewTab === 'allocations' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                    Port Allocations Pool
                  </div>
                  <form onSubmit={handleAddAllocation} className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Add Port (e.g. 25576)"
                      value={newAllocPort}
                      onChange={e => setNewAllocPort(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono w-48 focus:outline-none focus:border-[#f97316]"
                    />
                    <button
                      type="submit"
                      disabled={addingAlloc || !newAllocPort.trim()}
                      className="px-3 py-1.5 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold text-xs cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {addingAlloc ? 'Adding...' : 'Allocate Port'}
                    </button>
                  </form>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {viewingNode.allocations && viewingNode.allocations.length > 0 ? (
                    viewingNode.allocations.map(alloc => (
                      <div
                        key={alloc.id}
                        className={`p-2.5 rounded-lg border text-center font-mono text-xs ${
                          alloc.isAssigned || alloc.assigned
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                            : 'bg-[#0c0d12] border-[#23252e] text-neutral-300'
                        }`}
                      >
                        <div className="font-bold">{alloc.port}</div>
                        <div className="text-[10px] text-neutral-500 uppercase mt-0.5">
                          {alloc.isAssigned || alloc.assigned ? 'ASSIGNED' : 'FREE'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-6 text-center text-xs text-neutral-500 font-mono">
                      No port allocations registered for this node.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: DAEMON CONFIG */}
            {viewTab === 'config' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                    Daemon /etc/atyro/config.json
                  </div>
                  <button
                    onClick={() => {
                      const cfg = JSON.stringify({
                        panelUrl: window.location.origin,
                        nodeId: viewingNode.id,
                        daemonPort: viewingNode.apiPort || viewingNode.daemonPort || 9666,
                        sftpPort: viewingNode.sftpPort || 2022
                      }, null, 2);
                      copyToClipboard(cfg);
                      showToast('success', 'Config copied to clipboard!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#0c0d12] border border-[#23252e] text-xs text-neutral-300 hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Config</span>
                  </button>
                </div>

                <pre className="p-4 rounded-xl bg-[#0c0d12] border border-[#23252e] font-mono text-xs text-emerald-400 overflow-x-auto select-all">
{JSON.stringify({
  panelUrl: window.location.origin,
  nodeId: viewingNode.id,
  daemonPort: viewingNode.apiPort || viewingNode.daemonPort || 9666,
  sftpPort: viewingNode.sftpPort || 2022,
  storagePath: "/var/lib/atyro/volumes",
  logLevel: "info"
}, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMPREHENSIVE NODE EDIT MODAL */}
      {editingNode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#14151b] border border-[#23252e] p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#23252e] pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#f97316]" />
                <h3 className="text-base font-bold text-white">Edit Node: {editingNode.name}</h3>
              </div>
              <button
                onClick={() => setEditingNode(null)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-[#23252e] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Node Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs focus:outline-none focus:border-[#f97316]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Country Code</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      maxLength={2}
                      value={editForm.flagCode}
                      onChange={e => setEditForm({ ...editForm, flagCode: e.target.value.toUpperCase() })}
                      className="w-full pl-3 pr-10 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs uppercase font-mono focus:outline-none focus:border-[#f97316]"
                    />
                    <span className="absolute right-3 text-base">
                      {getFlagEmoji(editForm.flagCode)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Hostname / FQDN *</label>
                  <input
                    type="text"
                    required
                    placeholder="localhost, 127.0.0.1, or node.znx.xyz.com"
                    value={editForm.hostname}
                    onChange={e => setEditForm({ ...editForm, hostname: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono focus:outline-none focus:border-[#f97316]"
                  />
                  <span className="text-[10px] text-neutral-500 font-mono">Used by users to connect to servers</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Daemon Port *</label>
                  <input
                    type="number"
                    required
                    placeholder="9666"
                    value={editForm.daemonPort}
                    onChange={e => setEditForm({ ...editForm, daemonPort: parseInt(e.target.value) || 9666 })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono focus:outline-none focus:border-[#f97316]"
                  />
                  <span className="text-[10px] text-neutral-500 font-mono">Default port: 9666</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">IP Alias (display only)</label>
                  <input
                    type="text"
                    placeholder="e.g. play.example.com"
                    value={editForm.ipAlias}
                    onChange={e => setEditForm({ ...editForm, ipAlias: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs focus:outline-none focus:border-[#f97316]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Asia, Mumbai, Germany"
                    value={editForm.location}
                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs focus:outline-none focus:border-[#f97316]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">RAM Limit (MB)</label>
                  <input
                    type="number"
                    value={editForm.memory}
                    onChange={e => setEditForm({ ...editForm, memory: parseInt(e.target.value) || 1024 })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Disk Limit (MB)</label>
                  <input
                    type="number"
                    value={editForm.disk}
                    onChange={e => setEditForm({ ...editForm, disk: parseInt(e.target.value) || 1024 })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">CPU Allocation (%)</label>
                  <input
                    type="number"
                    value={editForm.cpu}
                    onChange={e => setEditForm({ ...editForm, cpu: parseInt(e.target.value) || 100 })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Max Servers</label>
                  <input
                    type="number"
                    value={editForm.maxServers}
                    onChange={e => setEditForm({ ...editForm, maxServers: parseInt(e.target.value) || 10 })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-white text-xs font-mono"
                  />
                </div>
              </div>

              {/* Maintenance Mode Toggle */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Maintenance Mode</div>
                  <div className="text-[11px] text-neutral-400">
                    Prevents new servers from being deployed to this node while performing maintenance.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.maintenanceMode}
                    onChange={e => setEditForm({ ...editForm, maintenanceMode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#f97316]"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#23252e]">
                <button
                  type="button"
                  onClick={() => setEditingNode(null)}
                  className="px-4 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-neutral-300 text-xs font-medium hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-6 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold text-xs cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-[#f97316]/20"
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
