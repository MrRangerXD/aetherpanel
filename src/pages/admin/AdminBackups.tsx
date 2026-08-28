import React, { useState, useEffect } from 'react';
import {
  Archive, HardDrive, Database, AlertCircle, RefreshCw, Save,
  CheckCircle2, Trash2, Download, Shield, Clock, Layers, Filter, Check
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { ServerBackup, BackupSettings, BackupStorageProvider } from '../../types';

interface AdminBackupsProps {
  onNavigate: (page: string, params?: any) => void;
}

export const AdminBackups: React.FC<AdminBackupsProps> = ({ onNavigate }) => {
  const [backups, setBackups] = useState<ServerBackup[]>([]);
  const [schedulesCount, setSchedulesCount] = useState<number>(0);
  const [stats, setStats] = useState({
    totalBackups: 0,
    totalStorageMB: 0,
    totalFailed: 0,
    totalActiveJobs: 0
  });
  const [settings, setSettings] = useState<BackupSettings>({
    storageProvider: 'local',
    localStoragePath: 'data/backups',
    s3Endpoint: '',
    s3Bucket: '',
    s3AccessKey: '',
    s3SecretKey: '',
    s3Region: 'us-east-1',
    maxBackupsPerServer: 10,
    backupRetentionDays: 30,
    autoCleanupEnabled: true
  });

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        backups: ServerBackup[];
        schedulesCount: number;
        stats: { totalBackups: number; totalStorageMB: number; totalFailed: number; totalActiveJobs: number };
        settings: BackupSettings;
      }>('/api/v1/admin/backups');

      if (res.success && res.data) {
        setBackups(res.data.backups || []);
        setSchedulesCount(res.data.schedulesCount || 0);
        setStats(res.data.stats || { totalBackups: 0, totalStorageMB: 0, totalFailed: 0, totalActiveJobs: 0 });
        if (res.data.settings) {
          setSettings(res.data.settings);
        }
      }
    } catch (err) {
      console.error('Failed to load admin backups data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSavedSuccess(false);
    try {
      const res = await apiRequest('/admin/backup-settings', {
        method: 'PUT',
        body: settings
      });
      if (res.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      }
    } catch (err) {
      console.error('Failed to save backup settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRunCleanup = async () => {
    setCleaningUp(true);
    setCleanupMessage(null);
    try {
      const res = await apiRequest<{ message: string }>('/api/v1/admin/backups/cleanup', {
        method: 'POST'
      });
      if (res.success) {
        setCleanupMessage(res.message || 'Retention cleanup completed.');
        await loadData();
      }
    } catch (err: any) {
      setCleanupMessage(`Cleanup failed: ${err.message}`);
    } finally {
      setCleaningUp(false);
    }
  };

  const filteredBackups = backups.filter(b => {
    const matchesStatus = statusFilter === 'all' || b.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesQuery = !searchQuery || 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      b.serverId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.serverName && b.serverName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="h-7 w-7 text-amber-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">System Backup & Storage Control</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Global storage provider configuration, system-wide retention policy, and active backup jobs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunCleanup}
            disabled={cleaningUp}
            className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center gap-2 transition-all shadow-md"
          >
            <RefreshCw className={`h-4 w-4 ${cleaningUp ? 'animate-spin' : ''}`} />
            {cleaningUp ? 'Pruning Old Backups...' : 'Run Retention Cleanup'}
          </button>
        </div>
      </div>

      {cleanupMessage && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{cleanupMessage}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Total Backups</span>
            <Archive className="h-5 w-5 text-violet-400" />
          </div>
          <p className="text-2xl font-black text-white">{stats.totalBackups}</p>
          <p className="text-[11px] text-zinc-500">{schedulesCount} Active Cron Schedules</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Storage Consumed</span>
            <HardDrive className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white">{(stats.totalStorageMB / 1024).toFixed(2)} GB</p>
          <p className="text-[11px] text-zinc-500">{stats.totalStorageMB.toLocaleString()} MB Total</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Active Jobs</span>
            <RefreshCw className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white">{stats.totalActiveJobs}</p>
          <p className="text-[11px] text-zinc-500">Creating / Restoring Jobs</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Failed Snapshots</span>
            <AlertCircle className="h-5 w-5 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-white">{stats.totalFailed}</p>
          <p className="text-[11px] text-zinc-500">Errors requiring review</p>
        </div>
      </div>

      {/* Global Storage & Retention Policy Form */}
      <form onSubmit={handleSaveSettings} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-amber-400" /> Storage Provider & System Retention Policy
            </h2>
            <p className="text-xs text-zinc-400">Configure default storage backend (Local Disk, Node Daemon, Object S3) and backup lifetimes.</p>
          </div>
          <button
            type="submit"
            disabled={savingSettings}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
          >
            <Save className="h-4 w-4" />
            {savingSettings ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> System backup and storage settings updated successfully!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">Storage Provider Backend</label>
            <select
              value={settings.storageProvider}
              onChange={(e) => setSettings({ ...settings, storageProvider: e.target.value as BackupStorageProvider })}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
            >
              <option value="local">Local Panel Filesystem (/data/backups)</option>
              <option value="node">Compute Node Daemon Storage</option>
              <option value="object">S3 Compatible Object Storage</option>
            </select>
            <p className="text-[11px] text-zinc-500 mt-1">Sets where default backup zip archives are stored.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">Max Backups Per Server</label>
            <input
              type="number"
              min={1}
              max={50}
              value={settings.maxBackupsPerServer}
              onChange={(e) => setSettings({ ...settings, maxBackupsPerServer: parseInt(e.target.value) || 10 })}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
            />
            <p className="text-[11px] text-zinc-500 mt-1">Default max snapshots count allowed per server.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">Backup Retention Days</label>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.backupRetentionDays}
              onChange={(e) => setSettings({ ...settings, backupRetentionDays: parseInt(e.target.value) || 30 })}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
            />
            <p className="text-[11px] text-zinc-500 mt-1">Backups older than this will be automatically pruned.</p>
          </div>
        </div>

        {/* S3 Details if Object storage selected */}
        {settings.storageProvider === 'object' && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">AWS S3 / MinIO / Object Storage Endpoint</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">S3 Endpoint URL</label>
                <input
                  type="text"
                  placeholder="https://s3.us-east-1.amazonaws.com"
                  value={settings.s3Endpoint || ''}
                  onChange={(e) => setSettings({ ...settings, s3Endpoint: e.target.value })}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">S3 Bucket Name</label>
                <input
                  type="text"
                  placeholder="aetherpanel-backups"
                  value={settings.s3Bucket || ''}
                  onChange={(e) => setSettings({ ...settings, s3Bucket: e.target.value })}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Access Key</label>
                <input
                  type="text"
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  value={settings.s3AccessKey || ''}
                  onChange={(e) => setSettings({ ...settings, s3AccessKey: e.target.value })}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Secret Key</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••"
                  value={settings.s3SecretKey || ''}
                  onChange={(e) => setSettings({ ...settings, s3SecretKey: e.target.value })}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </form>

      {/* System Backups Table */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">All System Backups</h2>
            <p className="text-xs text-zinc-400">List of all customer & server backups across the panel.</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or server ID..."
              className="rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs text-white w-full sm:w-64"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs text-white"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="creating">Creating</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {filteredBackups.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs rounded-2xl bg-zinc-950 border border-zinc-800">
            No system backups found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] font-mono tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="p-3">Backup Name</th>
                  <th className="p-3">Server / User</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredBackups.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="p-3 font-semibold text-white font-mono">
                      <div>{b.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono truncate max-w-[180px]">{b.id}</div>
                    </td>
                    <td className="p-3 text-zinc-300">
                      <button
                        onClick={() => onNavigate('server-manage', { serverId: b.serverId, initialTab: 'backups' })}
                        className="hover:underline text-amber-400 font-medium"
                      >
                        {b.serverName || b.serverId}
                      </button>
                      <div className="text-[11px] text-zinc-500">{b.userEmail || 'User'}</div>
                    </td>
                    <td className="p-3 font-mono text-zinc-300 font-bold">{b.sizeMB} MB</td>
                    <td className="p-3 font-mono text-xs uppercase text-zinc-400">{b.type || 'manual'}</td>
                    <td className="p-3 font-mono text-xs text-zinc-400 uppercase">{b.storageProvider || 'local'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        b.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        b.status === 'CREATING' || b.status === 'RESTORING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                        b.status === 'FAILED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-400 font-mono text-[11px]">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <a
                        href={`/api/v1/servers/${b.serverId}/backups/${b.id}/download`}
                        download
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
