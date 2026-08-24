import React, { useState, useEffect } from 'react';
import {
  Key, Plus, RefreshCw, Trash2, ShieldAlert, ShieldCheck, ShieldOff,
  Copy, Check, Search, Filter, Clock, Sparkles, AlertTriangle, FileText,
  CheckCircle2, XCircle, Lock, Eye, Activity, Server, Users, Terminal,
  Sliders, ChevronRight, X, AlertCircle
} from 'lucide-react';
import { ApiKey, ApiAuditLog, ApiKeyStats } from '../../types';

interface AdminApiKeysProps {
  onNavigate?: (page: string) => void;
}

const AVAILABLE_SCOPES = [
  { id: '*', name: 'Full Administrator Access', category: 'Global', desc: 'Unrestricted administrative control across all platform APIs' },
  { id: 'servers.read', name: 'Read Servers', category: 'Servers', desc: 'View server details, resource usage, status, and network ports' },
  { id: 'servers.start', name: 'Start Servers', category: 'Servers', desc: 'Trigger server boot sequence' },
  { id: 'servers.stop', name: 'Stop Servers', category: 'Servers', desc: 'Trigger graceful or forced server shutdown' },
  { id: 'servers.restart', name: 'Restart Servers', category: 'Servers', desc: 'Reboot running server instances' },
  { id: 'servers.console', name: 'Console WebSocket / Logs', category: 'Servers', desc: 'Access real-time server console stream and execute commands' },
  { id: 'servers.manage', name: 'Manage Server Specs', category: 'Servers', desc: 'Modify CPU, RAM, disk limits, and startup arguments' },
  { id: 'nodes.read', name: 'Read Node Health', category: 'Nodes', desc: 'View daemon status, resource allocation, and heartbeat metrics' },
  { id: 'nodes.manage', name: 'Manage Nodes', category: 'Nodes', desc: 'Add, edit, or restart node daemons' },
  { id: 'users.read', name: 'Read Users', category: 'Users', desc: 'Query customer accounts, roles, and suspension states' },
  { id: 'users.manage', name: 'Manage Users', category: 'Users', desc: 'Modify user accounts, roles, credits, and permissions' },
  { id: 'backups.read', name: 'Read Backups', category: 'Backups', desc: 'List backup archives and storage manifests' },
  { id: 'backups.create', name: 'Create Backups', category: 'Backups', desc: 'Trigger automated or manual server backups' },
  { id: 'plans.read', name: 'Read Billing Plans', category: 'Billing', desc: 'View hosting plans and pricing structures' },
  { id: 'settings.read', name: 'Read Settings', category: 'Platform', desc: 'Query system configuration and maintenance mode status' }
];

export const AdminApiKeys: React.FC<AdminApiKeysProps> = () => {
  const [activeTab, setActiveTab] = useState<'keys' | 'audit' | 'tests'>('keys');

  // State for API Keys list and stats
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<ApiAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedKeyForDetails, setSelectedKeyForDetails] = useState<ApiKey | null>(null);
  const [revealedSecretModal, setRevealedSecretModal] = useState<{ name: string; secret: string; action: 'created' | 'rotated' } | null>(null);

  // Form State for Key Creation
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [newKeyDesc, setNewKeyDesc] = useState<string>('');
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>('30');
  const [customExpiryDate, setCustomExpiryDate] = useState<string>('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['servers.read', 'servers.start', 'servers.stop', 'servers.restart']);
  const [allowedIpsInput, setAllowedIpsInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // One-click copy state
  const [copiedSecret, setCopiedSecret] = useState<boolean>(false);

  // Security Test Suite State
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [testSummary, setTestSummary] = useState<any | null>(null);
  const [runningTests, setRunningTests] = useState<boolean>(false);

  // Fetch API keys, dashboard stats, and audit logs
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysRes, statsRes, auditRes] = await Promise.all([
        fetch('/api/v1/api-keys'),
        fetch('/api/v1/api-keys/dashboard'),
        fetch('/api/v1/api-keys/audit-logs')
      ]);

      const keysData = await keysRes.json();
      const statsData = await statsRes.json();
      const auditData = await auditRes.json();

      if (!keysRes.ok) throw new Error(keysData.error?.message || 'Failed to load API keys');
      if (keysData.success) setKeys(keysData.data || []);
      if (statsData.success) setStats(statsData.data);
      if (auditData.success) setAuditLogs(auditData.data || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred while communicating with the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Handle Create API Key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let expiresAtCustom: string | undefined = undefined;
      let expiresInDays: number | undefined = undefined;

      if (newKeyExpiry === 'custom' && customExpiryDate) {
        expiresAtCustom = new Date(customExpiryDate).toISOString();
      } else if (newKeyExpiry !== '0') {
        expiresInDays = parseInt(newKeyExpiry, 10);
      }

      const allowedIps = allowedIpsInput
        .split(',')
        .map(ip => ip.trim())
        .filter(Boolean);

      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          description: newKeyDesc.trim(),
          scopes: newKeyScopes,
          expiresInDays,
          expiresAtCustom,
          allowedIps
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create API key');
      }

      // Close create modal and open secret reveal modal
      setIsCreateModalOpen(false);
      setRevealedSecretModal({
        name: data.data.name,
        secret: data.data.apiKey,
        action: 'created'
      });

      // Reset form
      setNewKeyName('');
      setNewKeyDesc('');
      setNewKeyScopes(['servers.read', 'servers.start', 'servers.stop', 'servers.restart']);
      setAllowedIpsInput('');
      setNewKeyExpiry('30');

      // Refresh list
      fetchAllData();
    } catch (err: any) {
      setError(err.message || 'Failed to generate API key.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Revoke Key
  const handleRevokeKey = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to revoke the API key '${name}'? It will immediately stop functioning for all automated calls.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/api-keys/${id}/revoke`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to revoke API key');
      }
      fetchAllData();
    } catch (err: any) {
      alert(`Error revoking API key: ${err.message}`);
    }
  };

  // Handle Rotate Key
  const handleRotateKey = async (id: string, name: string) => {
    if (!window.confirm(`Rotate secret credentials for '${name}'? The current key secret will immediately stop working and a new secret will be generated.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/api-keys/${id}/rotate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to rotate API key');
      }

      setRevealedSecretModal({
        name: data.data.name,
        secret: data.data.apiKey,
        action: 'rotated'
      });

      fetchAllData();
    } catch (err: any) {
      alert(`Error rotating API key: ${err.message}`);
    }
  };

  // Handle Delete Key Record
  const handleDeleteKey = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete the metadata record for API key '${name}'? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/api-keys/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete API key');
      }
      fetchAllData();
    } catch (err: any) {
      alert(`Error deleting API key: ${err.message}`);
    }
  };

  // Handle Copy Secret
  const handleCopySecret = (secretText: string) => {
    navigator.clipboard.writeText(secretText);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  // Run Automated Security & Acceptance Tests
  const handleRunSecurityTests = async () => {
    setRunningTests(true);
    setTestResults(null);
    setTestSummary(null);

    try {
      const res = await fetch('/api/v1/api-keys/run-security-tests', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to run security test pass');
      }
      setTestResults(data.results || []);
      setTestSummary(data.summary || null);
    } catch (err: any) {
      alert(`Security test pass error: ${err.message}`);
    } finally {
      setRunningTests(false);
    }
  };

  // Preset Scope Handler
  const applyScopePreset = (preset: 'full' | 'read' | 'bot' | 'none') => {
    if (preset === 'full') {
      setNewKeyScopes(['*']);
    } else if (preset === 'read') {
      setNewKeyScopes(['servers.read', 'nodes.read', 'users.read', 'backups.read', 'plans.read', 'settings.read']);
    } else if (preset === 'bot') {
      setNewKeyScopes(['servers.read', 'servers.start', 'servers.stop', 'servers.restart', 'servers.console', 'nodes.read']);
    } else {
      setNewKeyScopes([]);
    }
  };

  const toggleScope = (scopeId: string) => {
    if (scopeId === '*') {
      setNewKeyScopes(['*']);
      return;
    }
    setNewKeyScopes(prev => {
      const withoutAll = prev.filter(s => s !== '*');
      if (withoutAll.includes(scopeId)) {
        return withoutAll.filter(s => s !== scopeId);
      } else {
        return [...withoutAll, scopeId];
      }
    });
  };

  // Filtered keys
  const filteredKeys = keys.filter(k => {
    const matchesQuery = searchQuery === '' ||
      k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.keyPrefix.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.description && k.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || k.status === statusFilter;

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                REST API Key Management
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  ADMIN ONLY
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manage cryptographically hashed REST API credentials for external tools, automation scripts, and manager bots.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunSecurityTests}
            disabled={runningTests}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-2 transition disabled:opacity-50"
          >
            <ShieldCheck className={`h-4 w-4 text-emerald-400 ${runningTests ? 'animate-spin' : ''}`} />
            <span>{runningTests ? 'Running Verification...' : 'Security Test Suite'}</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Generate New API Key</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stat Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Credentials</span>
          <div className="text-2xl font-black text-white">{stats?.totalKeys ?? keys.length}</div>
          <p className="text-[10px] text-zinc-500">Provisioned API Keys</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Active Keys</span>
          <div className="text-2xl font-black text-emerald-400">{stats?.activeKeys ?? keys.filter(k => k.status === 'active').length}</div>
          <p className="text-[10px] text-zinc-500">Authenticated & Valid</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Revoked Keys</span>
          <div className="text-2xl font-black text-rose-400">{stats?.revokedKeys ?? keys.filter(k => k.status === 'revoked').length}</div>
          <p className="text-[10px] text-zinc-500">Access Invalidated</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Expired Keys</span>
          <div className="text-2xl font-black text-amber-400">{stats?.expiredKeys ?? keys.filter(k => k.status === 'expired').length}</div>
          <p className="text-[10px] text-zinc-500">Lapsed Lifetime</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">24h Activity</span>
          <div className="text-2xl font-black text-sky-400">{stats?.recentlyUsed24h ?? 0}</div>
          <p className="text-[10px] text-zinc-500 truncate">
            {stats?.lastActivityAt ? `Last: ${new Date(stats.lastActivityAt).toLocaleTimeString()}` : 'No recent calls'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('keys')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'keys'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Key className="h-4 w-4" />
          <span>Managed API Keys ({keys.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>API Access Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('tests');
            if (!testResults) handleRunSecurityTests();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'tests'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Security & Authorization Suite</span>
        </button>
      </div>

      {/* TAB 1: MANAGED API KEYS TABLE */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by key name, prefix, email, description..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Filter className="h-4 w-4 text-zinc-500" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="revoked">Revoked Only</option>
                <option value="expired">Expired Only</option>
              </select>

              <button
                onClick={fetchAllData}
                className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white transition"
                title="Refresh Table"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-4">Key Name & Purpose</th>
                    <th className="p-4">Key Prefix</th>
                    <th className="p-4">Admin Owner</th>
                    <th className="p-4">Scopes</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Timestamps</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-400" />
                        Loading REST API credentials from database...
                      </td>
                    </tr>
                  ) : filteredKeys.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-zinc-500">
                        <Key className="h-8 w-8 mx-auto mb-3 text-zinc-600" />
                        <div className="text-sm font-bold text-zinc-400">No API Keys Found</div>
                        <p className="text-xs text-zinc-600 mt-1">
                          {searchQuery || statusFilter !== 'all' ? 'No keys match your search filters.' : 'Generate your first admin API key to begin automating platform management.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredKeys.map(key => (
                      <tr key={key.id} className="hover:bg-zinc-800/40 transition">
                        <td className="p-4">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {key.name}
                          </div>
                          {key.description && (
                            <div className="text-[11px] text-zinc-500 truncate max-w-xs mt-0.5">
                              {key.description}
                            </div>
                          )}
                        </td>

                        <td className="p-4 font-mono text-[11px]">
                          <span className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-amber-400">
                            {key.keyPrefix}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="font-medium text-zinc-200">{key.userName || key.userEmail}</div>
                          <div className="text-[10px] font-mono text-zinc-500">{key.role}</div>
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {key.scopes.map(s => (
                              <span
                                key={s}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                                  s === '*'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                }`}
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="p-4">
                          {key.status === 'active' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-max">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          )}
                          {key.status === 'revoked' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 w-max">
                              <ShieldOff className="h-3 w-3" />
                              Revoked
                            </span>
                          )}
                          {key.status === 'expired' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 w-max">
                              <Clock className="h-3 w-3" />
                              Expired
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-[11px] text-zinc-400 space-y-0.5">
                          <div>Created: {new Date(key.createdAt).toLocaleDateString()}</div>
                          <div className="text-[10px] text-zinc-500">
                            Expires: {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}
                          </div>
                          {key.lastUsedAt && (
                            <div className="text-[10px] text-sky-400">
                              Last used: {new Date(key.lastUsedAt).toLocaleDateString()} ({key.requestCount || 1} calls)
                            </div>
                          )}
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedKeyForDetails(key)}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {key.status === 'active' && (
                              <>
                                <button
                                  onClick={() => handleRotateKey(key.id, key.name)}
                                  className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition"
                                  title="Rotate Secret Credentials"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  onClick={() => handleRevokeKey(key.id, key.name)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                                  title="Revoke Key Immediately"
                                >
                                  <ShieldOff className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => handleDeleteKey(key.id, key.name)}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition"
                              title="Delete Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT TRAIL VIEW */}
      {activeTab === 'audit' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" /> API Request Audit Stream
              </h3>
              <p className="text-xs text-zinc-400">
                Real-time security log of incoming API calls authenticated via REST API keys.
              </p>
            </div>
            <button
              onClick={fetchAllData}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">API Key ID</th>
                    <th className="p-3">Admin Email</th>
                    <th className="p-3">Method & Endpoint</th>
                    <th className="p-3">IP Address</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300 text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500 font-sans">
                        No API access requests logged yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-900/60">
                        <td className="p-3 text-zinc-400">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="p-3 text-amber-400">{log.apiKeyId}</td>
                        <td className="p-3 text-zinc-300">{log.userEmail || log.userId}</td>
                        <td className="p-3 font-bold text-white">
                          <span className="text-emerald-400 mr-2">{log.method}</span>
                          <span>{log.endpoint}</span>
                        </td>
                        <td className="p-3 text-zinc-400">{log.ipAddress}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                            {log.statusCode || 200} OK
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY ACCEPTANCE TESTS */}
      {activeTab === 'tests' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" /> Automated Security Verification Pass
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Execute automated validation checking cryptographic hashing, scope enforcement, admin RBAC, revocation, rotation, and audit compliance.
              </p>
            </div>

            <button
              onClick={handleRunSecurityTests}
              disabled={runningTests}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${runningTests ? 'animate-spin' : ''}`} />
              <span>{runningTests ? 'Running Diagnostic Pass...' : 'Run Full Verification Pass'}</span>
            </button>
          </div>

          {testSummary && (
            <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
              testSummary.status === 'PASS'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              <div className="flex items-center gap-3">
                {testSummary.status === 'PASS' ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-bold">
                    Verification Pass: {testSummary.status === 'PASS' ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}
                  </div>
                  <div className="text-xs opacity-90 mt-0.5">
                    Passed {testSummary.passed} of {testSummary.total} security checks.
                  </div>
                </div>
              </div>

              <div className="text-right font-mono text-xs font-bold">
                {testSummary.passed} / {testSummary.total} GREEN
              </div>
            </div>
          )}

          <div className="space-y-2">
            {runningTests ? (
              <div className="py-12 text-center text-zinc-400 space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-emerald-400" />
                <div className="text-xs font-bold text-white">Running 11-step security & authorization pass...</div>
              </div>
            ) : !testResults ? (
              <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                Click "Run Full Verification Pass" to test backend cryptographic hashing, RBAC, scope validation, and rotation.
              </div>
            ) : (
              testResults.map((t: any) => (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl border flex items-start justify-between gap-4 transition ${
                    t.passed
                      ? 'bg-zinc-950/80 border-zinc-800/80 hover:border-emerald-500/30'
                      : 'bg-rose-950/20 border-rose-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {t.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Test #{t.id}: {t.name}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                        {t.details}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    t.passed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {t.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CREATE API KEY MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Generate Admin REST API Key</h3>
                  <p className="text-xs text-zinc-400">Provision secure API credentials for external integrations.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Key Name / Client System <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AetherPanel Manager Bot, Billing Integration, CI/CD Script"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Dedicated credentials for server power management and live monitoring"
                  value={newKeyDesc}
                  onChange={e => setNewKeyDesc(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Expiration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Expiration Period</label>
                  <select
                    value={newKeyExpiry}
                    onChange={e => setNewKeyExpiry(e.target.value)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="7">7 Days</option>
                    <option value="30">30 Days (Recommended)</option>
                    <option value="90">90 Days</option>
                    <option value="365">1 Year</option>
                    <option value="0">Never Expires</option>
                    <option value="custom">Custom Date...</option>
                  </select>
                </div>

                {newKeyExpiry === 'custom' && (
                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">Custom Expiration Date</label>
                    <input
                      type="date"
                      required
                      value={customExpiryDate}
                      onChange={e => setCustomExpiryDate(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Allowed IP Addresses (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.50, 10.0.0.1 (Comma separated)"
                    value={allowedIpsInput}
                    onChange={e => setAllowedIpsInput(e.target.value)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Scopes Selection */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-zinc-300 font-semibold">Granular Permission Scopes</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyScopePreset('full')}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Full Admin (*)
                    </button>
                    <span className="text-zinc-600">•</span>
                    <button
                      type="button"
                      onClick={() => applyScopePreset('bot')}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Bot Preset
                    </button>
                    <span className="text-zinc-600">•</span>
                    <button
                      type="button"
                      onClick={() => applyScopePreset('read')}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Read Only
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                  {AVAILABLE_SCOPES.map(scope => {
                    const isSelected = newKeyScopes.includes(scope.id) || newKeyScopes.includes('*');
                    return (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => toggleScope(scope.id)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{scope.name}</span>
                          <span className="font-mono text-[10px] text-zinc-500">{scope.id}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{scope.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newKeyName.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Key className="h-4 w-4" />
                  <span>{isSubmitting ? 'Generating Secret...' : 'Generate API Key'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONE-TIME SECRET DISPLAY MODAL */}
      {revealedSecretModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-zinc-900 border border-amber-500/40 p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-400">
              <Sparkles className="h-6 w-6" />
              <div>
                <h3 className="text-base font-bold text-white">
                  API Key Secret Generated ({revealedSecretModal.name})
                </h3>
                <p className="text-xs text-amber-200/80">
                  {revealedSecretModal.action === 'rotated' ? 'Credentials rotated successfully.' : 'Copy your API key now.'}
                </p>
              </div>
            </div>

            {/* Warning Callout Box */}
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Save this key in a secure location!</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                For security reasons, this raw token will <strong>never be shown again</strong>. If you lose this secret token, you will need to rotate or recreate the API key.
              </p>
            </div>

            {/* Raw Key Display Box */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Raw API Secret Token
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={revealedSecretModal.secret}
                  className="flex-1 rounded-xl bg-zinc-950 border border-amber-500/50 px-4 py-3 text-xs font-mono text-amber-300 selection:bg-amber-500 selection:text-black font-bold"
                />
                <button
                  onClick={() => handleCopySecret(revealedSecretModal.secret)}
                  className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-2 transition shrink-0"
                >
                  {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedSecret ? 'Copied!' : 'Copy Secret'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setRevealedSecretModal(null)}
                className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white"
              >
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW KEY DETAILS MODAL */}
      {selectedKeyForDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">{selectedKeyForDetails.name}</h3>
              </div>
              <button
                onClick={() => setSelectedKeyForDetails(null)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-zinc-500">Key Identifier:</span>
                <div className="font-mono text-white mt-0.5">{selectedKeyForDetails.id}</div>
              </div>

              <div>
                <span className="text-zinc-500">Key Prefix:</span>
                <div className="font-mono text-amber-400 mt-0.5">{selectedKeyForDetails.keyPrefix}</div>
              </div>

              <div>
                <span className="text-zinc-500">Owner Admin:</span>
                <div className="text-white mt-0.5">{selectedKeyForDetails.userName || selectedKeyForDetails.userEmail} ({selectedKeyForDetails.role})</div>
              </div>

              <div>
                <span className="text-zinc-500">Allowed IP Whitelist:</span>
                <div className="text-white mt-0.5 font-mono">
                  {selectedKeyForDetails.allowedIps && selectedKeyForDetails.allowedIps.length > 0
                    ? selectedKeyForDetails.allowedIps.join(', ')
                    : 'Any IP Allowed (No restriction)'}
                </div>
              </div>

              <div>
                <span className="text-zinc-500">Assigned Scopes:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedKeyForDetails.scopes.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[10px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800 text-[11px]">
                <div>
                  <span className="text-zinc-500">Total Calls:</span>
                  <div className="text-white font-bold">{selectedKeyForDetails.requestCount || 0}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Last IP:</span>
                  <div className="text-white font-mono">{selectedKeyForDetails.lastUsedIp || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedKeyForDetails(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApiKeys;
