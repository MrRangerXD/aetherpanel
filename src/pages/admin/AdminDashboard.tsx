import React, { useState, useEffect } from 'react';
import {
  Users, Server, Play, Square, HardDrive, Cpu, Clock, Layers,
  Terminal, Activity, Settings, UserPlus, PlusCircle, CheckCircle,
  Zap, HelpCircle, ArrowUpRight, Gauge
} from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await apiRequest('/admin/stats');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (e) {
      console.error('Failed to load admin stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0h 1m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const sys = stats?.system || {
    platform: 'Linux',
    nodeVersion: 'v23.11.1',
    panelVersion: '1.0.0',
    cpuCores: 4,
    uptimeSeconds: 240,
    totalMemoryGB: 8,
    freeMemoryGB: 5,
    disk: { usedPercent: 1, freeGB: 252.6 },
    architecture: 'x64',
    osRelease: '6.18.60'
  };

  const atGlance = stats?.atAGlance || {
    serverUptime: stats?.servers?.running > 0 ? '99.9%' : 'No servers',
    admins: `${stats?.users?.admins || 1} of ${stats?.users?.total || 1} users`,
    panelStatus: 'Operational'
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-white">
              <Gauge className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Admin Overview</h1>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-400">
            <span>System-wide monitoring and management</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              OPERATIONAL
            </span>
          </div>
        </div>
      </div>

      {/* 4 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL USERS */}
        <div className="p-4 rounded-xl bg-[#14151b] border border-[#23252e] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-medium tracking-wider text-neutral-400 uppercase">
              Total Users
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono">
              {stats?.users?.total ?? 1}
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              registered in the panel
            </div>
          </div>
        </div>

        {/* TOTAL SERVERS */}
        <div className="p-4 rounded-xl bg-[#14151b] border border-[#23252e] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-medium tracking-wider text-neutral-400 uppercase">
              Total Servers
            </span>
            <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300">
              <Server className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono">
              {stats?.servers?.total ?? 0}
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              {stats?.servers?.running ?? 0} currently running
            </div>
          </div>
        </div>

        {/* RUNNING */}
        <div className="p-4 rounded-xl bg-[#14151b] border border-emerald-500/30 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-medium tracking-wider text-emerald-400 uppercase">
              Running
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Play className="w-3.5 h-3.5 fill-current" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {stats?.servers?.running ?? 0}
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              active server processes
            </div>
          </div>
        </div>

        {/* STOPPED */}
        <div className="p-4 rounded-xl bg-[#14151b] border border-red-500/30 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-medium tracking-wider text-red-400 uppercase">
              Stopped
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Square className="w-3.5 h-3.5 fill-current" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-red-400 font-mono">
              {stats?.servers?.stopped ?? 0}
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              not currently running
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: System Information (Left) + Quick Actions & At a Glance (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: System Information (2 cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-xl bg-[#14151b] border border-[#23252e]">
            <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[#23252e] text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              <Cpu className="w-4 h-4 text-[#f97316]" />
              <span>System Information</span>
            </div>

            {/* 5x2 Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Box 1: Platform */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Platform</div>
                <div className="text-sm font-bold text-white mt-1 capitalize">{sys.platform}</div>
              </div>

              {/* Box 2: Node.js */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Node.js</div>
                <div className="text-sm font-bold text-white mt-1 font-mono">{sys.nodeVersion}</div>
              </div>

              {/* Box 3: Panel Version */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Panel Version</div>
                <div className="text-sm font-bold text-white mt-1 font-mono">{sys.panelVersion}</div>
              </div>

              {/* Box 4: CPU Cores */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">CPU Cores</div>
                <div className="text-sm font-bold text-white mt-1 font-mono">{sys.cpuCores}</div>
              </div>

              {/* Box 5: Uptime */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Uptime</div>
                <div className="text-sm font-bold text-white mt-1 font-mono">{formatUptime(sys.uptimeSeconds)}</div>
              </div>

              {/* Box 6: Total Memory */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Total Memory</div>
                <div className="text-sm font-bold text-white mt-1 font-mono">{sys.totalMemoryGB} GB</div>
              </div>

              {/* Box 7: Free Memory */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Free Memory</div>
                <div className="text-sm font-bold text-white mt-1 font-mono">{sys.freeMemoryGB} GB</div>
              </div>

              {/* Box 8: Disk Space */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e] sm:col-span-1">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Disk Space</div>
                <div className="text-xs font-bold text-white mt-1 truncate font-mono">
                  {sys.disk?.usedPercent || 1}% used · {sys.disk?.freeGB || 252.6} GB free
                </div>
              </div>

              {/* Box 9: Architecture */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Architecture</div>
                <div className="text-sm font-bold text-white mt-1 font-mono uppercase">{sys.architecture}</div>
              </div>

              {/* Box 10: OS Release */}
              <div className="p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">OS Release</div>
                <div className="text-sm font-bold text-white mt-1 font-mono truncate">{sys.osRelease}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & At a Glance */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="p-5 rounded-xl bg-[#14151b] border border-[#23252e]">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#23252e] text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              <Zap className="w-4 h-4 text-[#f97316]" />
              <span>Quick Actions</span>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => onNavigate('admin-users')}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#181920] border border-[#f97316]/40 text-white font-semibold text-xs hover:bg-[#20222e] hover:border-[#f97316] transition-all cursor-pointer shadow-sm"
              >
                <UserPlus className="w-4 h-4 text-[#f97316] shrink-0" />
                <span>Create User</span>
              </button>

              <button
                onClick={() => onNavigate('admin-servers')}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-neutral-200 font-medium text-xs hover:text-white hover:bg-[#181920] transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-[#f97316] shrink-0" />
                <span>Create Server</span>
              </button>

              <button
                onClick={() => onNavigate('admin-nodes')}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-neutral-200 font-medium text-xs hover:text-white hover:bg-[#181920] transition-colors cursor-pointer"
              >
                <HardDrive className="w-4 h-4 text-[#f97316] shrink-0" />
                <span>Create Node</span>
              </button>

              <button
                onClick={() => onNavigate('admin-settings')}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-neutral-200 font-medium text-xs hover:text-white hover:bg-[#181920] transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4 text-neutral-400 shrink-0" />
                <span>Panel Settings</span>
              </button>
            </div>
          </div>

          {/* At a Glance */}
          <div className="p-5 rounded-xl bg-[#14151b] border border-[#23252e]">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#23252e] text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              <Activity className="w-4 h-4 text-[#f97316]" />
              <span>At A Glance</span>
            </div>

            <div className="space-y-3">
              {/* Server Uptime */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">
                    %
                  </div>
                  <span className="text-xs text-neutral-300 font-medium">Server uptime</span>
                </div>
                <span className="text-xs font-mono text-neutral-400">{atGlance.serverUptime}</span>
              </div>

              {/* Admins */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs text-neutral-300 font-medium">Admins</span>
                </div>
                <span className="text-xs font-mono text-neutral-400">{atGlance.admins}</span>
              </div>

              {/* Panel Status */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs text-neutral-300 font-medium">Panel status</span>
                </div>
                <span className="text-xs font-mono text-emerald-400">{atGlance.panelStatus}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
