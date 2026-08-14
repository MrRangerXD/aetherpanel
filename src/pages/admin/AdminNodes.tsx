import React, { useState, useEffect } from 'react';
import {
  HardDrive, Server, Activity, ShieldCheck, AlertTriangle, Plus, Terminal,
  Globe, Cpu, Database, Settings, Trash2, Edit3, Copy, Check,
  ExternalLink, RefreshCw, Layers, Shield, Wifi, WifiOff, X, HelpCircle
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Node, Location, Allocation } from '../../types';

export const AdminNodes: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'nodes' | 'locations' | 'installer'>('nodes');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [editingNode, setEditingNode] = useState<Partial<Node> | null>(null);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Partial<Location> | null>(null);

  const [selectedNodeForInstall, setSelectedNodeForInstall] = useState<Node | null>(null);
  const [installTokenData, setInstallTokenData] = useState<{ installCmd: string; token: string; expiresAt: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const [selectedNodeForAllocations, setSelectedNodeForAllocations] = useState<Node | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allocIp, setAllocIp] = useState('');
  const [allocStartPort, setAllocStartPort] = useState('25565');
  const [allocEndPort, setAllocEndPort] = useState('25575');
  const [allocLoading, setAllocLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
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
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Flash message handler
  const showToast = (type: 'error' | 'success', text: string) => {
    if (type === 'error') {
      setErrorMsg(text);
      setTimeout(() => setErrorMsg(''), 5000);
    } else {
      setSuccessMsg(text);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  // Node Actions
  const handleToggleMaintenance = async (nodeId: string, current: boolean) => {
    const res = await apiRequest(`/admin/nodes/${nodeId}`, {
      method: 'PUT',
      body: JSON.stringify({ isMaintenanceMode: !current, status: !current ? 'maintenance' : 'online' })
    });
    if (res.success) {
      showToast('success', `Maintenance mode ${!current ? 'enabled' : 'disabled'} for node.`);
      fetchData();
    }
  };

  const handleDeleteNode = async (nodeId: string, nodeName: string) => {
    if (!window.confirm(`Are you sure you want to delete node '${nodeName}'?`)) return;

    const res = await apiRequest(`/admin/nodes/${nodeId}`, { method: 'DELETE' });
    if (res.success) {
      showToast('success', 'Node deleted successfully.');
      fetchData();
    } else {
      showToast('error', res.error?.message || 'Failed to delete node.');
    }
  };

  const handleRepairNode = async (nodeId: string, nodeName: string) => {
    showToast('success', `Initiating hardware health repair & sync on node '${nodeName}'...`);
    const res = await apiRequest(`/admin/nodes/${nodeId}/repair`, { method: 'POST' });
    if (res.success) {
      showToast('success', res.message || `Node '${nodeName}' repaired and synchronized.`);
      fetchData();
    } else {
      showToast('error', res.error?.message || 'Failed to repair node.');
    }
  };

  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode?.name || !editingNode?.ip || !editingNode?.hostname) {
      showToast('error', 'Please fill in required node fields (Name, IP, Hostname).');
      return;
    }

    const isEdit = !!editingNode.id;
    const url = isEdit ? `/admin/nodes/${editingNode.id}` : '/admin/nodes';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiRequest(url, {
      method,
      body: JSON.stringify(editingNode)
    });

    if (res.success) {
      showToast('success', `Node ${isEdit ? 'updated' : 'created'} successfully.`);
      setShowNodeModal(false);
      setEditingNode(null);
      fetchData();
    } else {
      showToast('error', res.error?.message || 'Failed to save node.');
    }
  };

  // Installer Token Generator
  const handleGenerateInstallerToken = async (node: Node) => {
    setSelectedNodeForInstall(node);
    setInstallTokenData(null);
    const res = await apiRequest(`/admin/nodes/${node.id}/install-token`, { method: 'POST' });
    if (res.success && res.data) {
      setInstallTokenData(res.data);
    } else {
      showToast('error', 'Failed to generate installation token.');
    }
  };

  // Location Actions
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation?.name || !editingLocation?.code) {
      showToast('error', 'Location name and code are required.');
      return;
    }

    const isEdit = !!editingLocation.id;
    const url = isEdit ? `/admin/locations/${editingLocation.id}` : '/admin/locations';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiRequest(url, {
      method,
      body: JSON.stringify(editingLocation)
    });

    if (res.success) {
      showToast('success', `Location ${isEdit ? 'updated' : 'created'} successfully.`);
      setShowLocationModal(false);
      setEditingLocation(null);
      fetchData();
    } else {
      showToast('error', res.error?.message || 'Failed to save location.');
    }
  };

  const handleDeleteLocation = async (locId: string) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    const res = await apiRequest(`/admin/locations/${locId}`, { method: 'DELETE' });
    if (res.success) {
      showToast('success', 'Location deleted.');
      fetchData();
    } else {
      showToast('error', res.error?.message || 'Failed to delete location.');
    }
  };

  // Allocations Management
  const handleOpenAllocations = async (node: Node) => {
    setSelectedNodeForAllocations(node);
    setAllocIp(node.ip);
    setAllocLoading(true);
    const res = await apiRequest(`/admin/nodes/${node.id}/allocations`);
    if (res.success && res.data) {
      setAllocations(res.data);
    }
    setAllocLoading(false);
  };

  const handleCreateAllocations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNodeForAllocations) return;

    const res = await apiRequest(`/admin/nodes/${selectedNodeForAllocations.id}/allocations`, {
      method: 'POST',
      body: JSON.stringify({
        ip: allocIp,
        startPort: allocStartPort,
        endPort: allocEndPort
      })
    });

    if (res.success) {
      showToast('success', res.message || 'Allocations added.');
      handleOpenAllocations(selectedNodeForAllocations);
    } else {
      showToast('error', res.error?.message || 'Failed to generate allocations.');
    }
  };

  const handleDeleteAllocation = async (allocId: string) => {
    const res = await apiRequest(`/admin/allocations/${allocId}`, { method: 'DELETE' });
    if (res.success) {
      showToast('success', 'Allocation deleted.');
      if (selectedNodeForAllocations) handleOpenAllocations(selectedNodeForAllocations);
    } else {
      showToast('error', res.error?.message || 'Failed to delete allocation.');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Toast Messages */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-violet-400" /> Bare-Metal Node & Daemon Management
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Configure host compute nodes, AetherNode daemon agents, location regions, and port allocations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingNode({
                name: '',
                hostname: '',
                ip: '',
                fqdn: '',
                daemonPort: 8080,
                sftpPort: 2022,
                location: locations[0]?.code || 'us-east',
                locationName: locations[0]?.name || 'US East',
                flagCode: locations[0]?.flagCode || 'US',
                totalRamMB: 65536,
                totalCpuCores: 16,
                totalDiskGB: 1024,
                ramOverallocatePercent: 0,
                cpuOverallocatePercent: 0,
                diskOverallocatePercent: 0,
                maxServers: 50,
                allowedProducts: ['prod_minecraft', 'prod_bot']
              });
              setShowNodeModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-violet-600/20 transition-all"
          >
            <Plus className="h-4 w-4" /> Create Node
          </button>

          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all"
            title="Refresh Metrics"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-zinc-800 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'nodes'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Server className="h-4 w-4 text-violet-400" /> Compute Nodes ({nodes.length})
        </button>

        <button
          onClick={() => setActiveTab('locations')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'locations'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Globe className="h-4 w-4 text-cyan-400" /> Datacenter Regions ({locations.length})
        </button>

        <button
          onClick={() => setActiveTab('installer')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'installer'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Terminal className="h-4 w-4 text-emerald-400" /> Installer & Pair Guide
        </button>
      </div>

      {/* --- TAB 1: NODES CLUSTER GRID --- */}
      {activeTab === 'nodes' && (
        loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading node metrics and hardware telemetry...</div>
        ) : nodes.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 space-y-3">
            <HardDrive className="h-10 w-10 text-zinc-600 mx-auto" />
            <h3 className="text-white font-semibold text-base">No Compute Nodes Provisioned</h3>
            <p className="text-zinc-400 text-xs max-w-md mx-auto">
              Create your first bared-metal or VPS node to begin hosting game servers and Discord bot containers.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nodes.map(n => {
              const ramMax = n.totalRamMB * (1 + (n.ramOverallocatePercent || 0) / 100);
              const ramUsagePct = Math.min(100, Math.round((n.usedRamMB / ramMax) * 100));

              return (
                <div
                  key={n.id}
                  className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-4 shadow-xl relative overflow-hidden"
                >
                  {/* Top Status Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg" title={n.locationName}>
                          {n.isLocalNode || n.id === 'node_local' ? '🖥️' : n.flagCode === 'US' ? '🇺🇸' : n.flagCode === 'DE' ? '🇩🇪' : n.flagCode === 'SG' ? '🇸🇬' : n.flagCode === 'IN' ? '🇮🇳' : '🌐'}
                        </span>
                        <h3 className="text-base font-bold text-white">{n.name}</h3>
                        {(n.isLocalNode || n.id === 'node_local') && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-600 text-white shadow-sm shrink-0">
                            Local Control Plane
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">
                        {n.fqdn || n.hostname || n.ip}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border flex items-center gap-1.5 ${
                        n.status === 'online'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : n.status === 'maintenance'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {n.status === 'online' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {n.status.toUpperCase()}
                      </span>

                      {n.ramOverallocatePercent > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                          +{n.ramOverallocatePercent}% Overcommit
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ports and Daemon status */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/50 text-zinc-400">
                    <div>
                      <span className="text-zinc-500 block text-[10px]">DAEMON PORT</span>
                      <span className="text-white font-semibold">{n.daemonPort || 8080}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">SFTP PORT</span>
                      <span className="text-white font-semibold">{n.sftpPort || 2022}</span>
                    </div>
                  </div>

                  {/* Utilization Bars */}
                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-zinc-400 mb-1">
                        <span className="flex items-center gap-1 text-[11px]"><Cpu className="h-3.5 w-3.5 text-violet-400" /> RAM Memory</span>
                        <strong className="text-white text-[11px]">{Math.round(n.usedRamMB / 1024)}GB / {Math.round(n.totalRamMB / 1024)}GB</strong>
                      </div>
                      <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/40">
                        <div
                          className={`h-full transition-all ${
                            ramUsagePct > 85 ? 'bg-red-500' : ramUsagePct > 65 ? 'bg-amber-500' : 'bg-violet-500'
                          }`}
                          style={{ width: `${ramUsagePct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-zinc-400 pt-1">
                      <span>Containers: <strong className="text-white">{n.serverCount} / {n.maxServers || 50}</strong></span>
                      <span>CPUs: <strong className="text-white">{n.usedCpuCores} / {n.totalCpuCores} Cores</strong></span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleGenerateInstallerToken(n)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        title="Generate Installation Pairing Command"
                      >
                        <Terminal className="h-3.5 w-3.5" /> Pair
                      </button>

                      <button
                        onClick={() => handleOpenAllocations(n)}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        title="Manage Network Allocation Ports"
                      >
                        <Layers className="h-3.5 w-3.5" /> Ports
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRepairNode(n.id, n.name)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all"
                        title="Repair & Resync Node Health"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setEditingNode(n);
                          setShowNodeModal(true);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all"
                        title="Edit Node Settings"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleMaintenance(n.id, n.isMaintenanceMode)}
                        className={`p-1.5 rounded-lg transition-all ${
                          n.isMaintenanceMode
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                        }`}
                        title={n.isMaintenanceMode ? 'Exit Maintenance Mode' : 'Put Node in Maintenance'}
                      >
                        <Shield className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteNode(n.id, n.name)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                        title="Delete Node"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* --- TAB 2: LOCATIONS MANAGEMENT --- */}
      {activeTab === 'locations' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-white">Geographic Regions</h2>
              <p className="text-xs text-zinc-400">Datacenter regions available for game and bot server deployment</p>
            </div>

            <button
              onClick={() => {
                setEditingLocation({
                  name: '',
                  code: '',
                  country: '',
                  flagCode: 'US',
                  description: '',
                  isActive: true
                });
                setShowLocationModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add Region
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map(loc => (
              <div key={loc.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{loc.flagCode === 'IN' ? '🇮🇳' : loc.flagCode === 'DE' ? '🇩🇪' : loc.flagCode === 'SG' ? '🇸🇬' : '🇺🇸'}</span>
                    <div>
                      <h3 className="font-bold text-white text-sm">{loc.name}</h3>
                      <span className="text-xs font-mono text-cyan-400">{loc.code}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ACTIVE
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">{loc.description || 'No detailed description provided.'}</p>

                <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-400">
                  <span>Country: <strong className="text-zinc-200">{loc.country}</strong></span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingLocation(loc);
                        setShowLocationModal(true);
                      }}
                      className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(loc.id)}
                      className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 3: INSTALLER & PAIR GUIDE --- */}
      {activeTab === 'installer' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-emerald-400" /> AetherNode Agent Installation Script
            </h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              AetherNode is our high-performance Docker container orchestration daemon. Run our automated one-line installer script on any clean Ubuntu 20.04/22.04/24.04 or Debian 11/12 VPS to auto-install Docker, set up systemd services, and pair the host with your panel.
            </p>

            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 font-mono text-xs text-emerald-400 overflow-x-auto space-y-2">
              <div className="text-zinc-500"># Run directly on your Linux host terminal as root:</div>
              <div>curl -fsSL https://{window.location.host}/install.sh | bash</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs text-zinc-400">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/50 space-y-1">
                <strong className="text-white block font-semibold">1. Port 8080 (TCP)</strong>
                <span>Daemon REST API & real-time telemetry websocket channel.</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/50 space-y-1">
                <strong className="text-white block font-semibold">2. Port 2022 (TCP)</strong>
                <span>Secure SFTP server for file manager and plugin uploads.</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/50 space-y-1">
                <strong className="text-white block font-semibold">3. Ports 25565-25600</strong>
                <span>Application & Minecraft game ports for public connections.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT NODE --- */}
      {showNodeModal && editingNode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-violet-400" />
                {editingNode.id ? 'Edit Compute Node' : 'Provision New Compute Node'}
              </h2>
              <button onClick={() => setShowNodeModal(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNode} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 mb-1 block">Node Name *</label>
                  <input
                    type="text"
                    required
                    value={editingNode.name || ''}
                    onChange={e => setEditingNode({ ...editingNode, name: e.target.value })}
                    placeholder="e.g. US East 01 - Virginia"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">Location Region *</label>
                  <select
                    value={editingNode.location || ''}
                    onChange={e => {
                      const sel = locations.find(l => l.code === e.target.value);
                      setEditingNode({
                        ...editingNode,
                        location: e.target.value,
                        locationName: sel?.name || 'Region',
                        flagCode: sel?.flagCode || 'US'
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-violet-500"
                  >
                    {locations.map(l => (
                      <option key={l.id} value={l.code}>{l.name} ({l.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">IPv4 Address *</label>
                  <input
                    type="text"
                    required
                    value={editingNode.ip || ''}
                    onChange={e => setEditingNode({ ...editingNode, ip: e.target.value })}
                    placeholder="104.22.14.88"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">FQDN / Hostname *</label>
                  <input
                    type="text"
                    required
                    value={editingNode.hostname || ''}
                    onChange={e => setEditingNode({ ...editingNode, hostname: e.target.value, fqdn: e.target.value })}
                    placeholder="node-us1.aetherpanel.com"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">Daemon Port</label>
                  <input
                    type="number"
                    value={editingNode.daemonPort || 8080}
                    onChange={e => setEditingNode({ ...editingNode, daemonPort: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">SFTP Port</label>
                  <input
                    type="number"
                    value={editingNode.sftpPort || 2022}
                    onChange={e => setEditingNode({ ...editingNode, sftpPort: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">Total Physical RAM (MB)</label>
                  <input
                    type="number"
                    value={editingNode.totalRamMB || 65536}
                    onChange={e => setEditingNode({ ...editingNode, totalRamMB: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">Memory Over-allocation (%)</label>
                  <input
                    type="number"
                    value={editingNode.ramOverallocatePercent || 0}
                    onChange={e => setEditingNode({ ...editingNode, ramOverallocatePercent: parseInt(e.target.value) })}
                    placeholder="e.g. 10 (allows 110% RAM)"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">CPU Cores</label>
                  <input
                    type="number"
                    value={editingNode.totalCpuCores || 16}
                    onChange={e => setEditingNode({ ...editingNode, totalCpuCores: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 mb-1 block">Max Containers Cap</label>
                  <input
                    type="number"
                    value={editingNode.maxServers || 50}
                    onChange={e => setEditingNode({ ...editingNode, maxServers: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowNodeModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold"
                >
                  Save Node Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: INSTALLER TOKEN GENERATOR --- */}
      {selectedNodeForInstall && installTokenData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-emerald-400" /> Pair Node: {selectedNodeForInstall.name}
                </h2>
                <p className="text-xs text-zinc-400">One-Time Automated Pair Command (Valid for 1 Hour)</p>
              </div>
              <button onClick={() => setSelectedNodeForInstall(null)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <label className="text-zinc-400 block">Copy and paste this command into your target VPS shell as root:</label>
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 break-all select-all leading-relaxed">
                {installTokenData.installCmd}
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(installTokenData.installCmd);
                  setCopiedCmd(true);
                  setTimeout(() => setCopiedCmd(false), 3000);
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 transition-all font-sans"
              >
                {copiedCmd ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedCmd ? 'Copied to Clipboard!' : 'Copy Pairing Command'}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <span className="text-white font-semibold block">Important:</span>
              <p>When the command finishes, the node daemon will automatically register its SSL keys and report live metrics back to AetherPanel.</p>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ALLOCATIONS MANAGER --- */}
      {selectedNodeForAllocations && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-cyan-400" /> Network Allocations ({selectedNodeForAllocations.name})
                </h2>
                <p className="text-xs text-zinc-400">Manage IP address and port bindings for game servers</p>
              </div>
              <button onClick={() => setSelectedNodeForAllocations(null)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Range Generator Form */}
            <form onSubmit={handleCreateAllocations} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 text-xs font-mono">
              <span className="text-white font-sans font-semibold block">Create Allocation Port Range</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="IP Address"
                  value={allocIp}
                  onChange={e => setAllocIp(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white"
                />
                <input
                  type="number"
                  placeholder="Start Port (e.g. 25565)"
                  value={allocStartPort}
                  onChange={e => setAllocStartPort(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white"
                />
                <input
                  type="number"
                  placeholder="End Port (e.g. 25575)"
                  value={allocEndPort}
                  onChange={e => setAllocEndPort(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-sans font-semibold"
              >
                Generate Port Range
              </button>
            </form>

            {/* Allocations Table */}
            <div className="max-h-60 overflow-y-auto font-mono text-xs border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              {allocLoading ? (
                <div className="p-6 text-center text-zinc-400 font-sans">Loading allocations...</div>
              ) : allocations.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 font-sans">No allocations found for this node.</div>
              ) : (
                allocations.map(a => (
                  <div key={a.id} className="p-3 flex items-center justify-between bg-zinc-950/50 hover:bg-zinc-900">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold">{a.ip}:{a.port}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        a.isAssigned
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {a.isAssigned ? `ASSIGNED (${a.serverId})` : 'FREE / AVAILABLE'}
                      </span>
                    </div>

                    {!a.isAssigned && (
                      <button
                        onClick={() => handleDeleteAllocation(a.id)}
                        className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        title="Delete Allocation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT LOCATION --- */}
      {showLocationModal && editingLocation && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-cyan-400" />
                {editingLocation.id ? 'Edit Region' : 'Add Datacenter Region'}
              </h2>
              <button onClick={() => setShowLocationModal(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 mb-1 block">Region Name *</label>
                <input
                  type="text"
                  required
                  value={editingLocation.name || ''}
                  onChange={e => setEditingLocation({ ...editingLocation, name: e.target.value })}
                  placeholder="e.g. India (Delhi/Mumbai)"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                />
              </div>

              <div>
                <label className="text-zinc-400 mb-1 block">Short Code *</label>
                <input
                  type="text"
                  required
                  value={editingLocation.code || ''}
                  onChange={e => setEditingLocation({ ...editingLocation, code: e.target.value })}
                  placeholder="e.g. in-south"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-zinc-400 mb-1 block">Country</label>
                <input
                  type="text"
                  value={editingLocation.country || ''}
                  onChange={e => setEditingLocation({ ...editingLocation, country: e.target.value })}
                  placeholder="India"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                />
              </div>

              <div>
                <label className="text-zinc-400 mb-1 block">ISO Flag Code (2 letters)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={editingLocation.flagCode || 'IN'}
                  onChange={e => setEditingLocation({ ...editingLocation, flagCode: e.target.value.toUpperCase() })}
                  placeholder="IN"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="text-zinc-400 mb-1 block">Description</label>
                <textarea
                  rows={2}
                  value={editingLocation.description || ''}
                  onChange={e => setEditingLocation({ ...editingLocation, description: e.target.value })}
                  placeholder="Direct Peering with local ISPs, sub-15ms latency"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Save Region
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
