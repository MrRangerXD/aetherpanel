import React, { useState, useEffect } from 'react';
import {
  Server as ServerIcon, PlusCircle, Play, Square, RefreshCw,
  Copy, Check, Cpu, HardDrive, Gamepad2, Bot, ArrowRight, Activity, Zap
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server, UserAllocationStatus } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { ServerCard } from '../../components/server/ServerCard';
import { normalizeServer, formatMemory } from '../../lib/serverNormalize';

interface DashboardProps {
  onNavigate: (page: string, params?: any) => void;
  onSelectServer?: (serverId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectServer }) => {
  const { user } = useAuth();
  const { accentClasses } = useTheme();

  const [servers, setServers] = useState<Server[]>([]);
  const [ownedServers, setOwnedServers] = useState<Server[]>([]);
  const [sharedServers, setSharedServers] = useState<Server[]>([]);
  const [allocations, setAllocations] = useState<UserAllocationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const fetchServers = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [serversRes, allocRes] = await Promise.all([
        apiRequest('/servers'),
        apiRequest('/account/allocations')
      ]);

      if (serversRes.success) {
        const all = Array.isArray(serversRes.data) ? serversRes.data : [];
        const owned = Array.isArray(serversRes.ownedServers) ? serversRes.ownedServers : [];
        const shared = Array.isArray(serversRes.sharedServers) ? serversRes.sharedServers : [];

        setServers(all.map((s: any) => normalizeServer(s)));
        setOwnedServers(owned.map((s: any) => normalizeServer(s)));
        setSharedServers(shared.map((s: any) => normalizeServer(s)));
      }

      if (allocRes.success && allocRes.data) {
        setAllocations(allocRes.data);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers(true);
    const interval = setInterval(() => {
      fetchServers(false);
    }, 10000); // 10s live polling
    return () => clearInterval(interval);
  }, []);

  const handlePowerAction = async (e: React.MouseEvent, serverId: string, action: string) => {
    e.stopPropagation();
    await apiRequest(`/servers/${serverId}/power`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    fetchServers();
  };

  const handleCopyIp = (e: React.MouseEvent, ipPort: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ipPort);
    setCopiedIp(ipPort);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const runningCount = servers.filter(s => s.status === 'running').length;
  const totalRamMB = servers.reduce((acc, s) => acc + s.limits.ramMB, 0);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      
      {/* Overview Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome back, {user?.displayName || user?.username}!
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Overview of your active servers, resource metrics, and cloud instances.
          </p>
        </div>

        <button
          onClick={() => onNavigate('deploy')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r ${accentClasses.gradient} shadow-lg ${accentClasses.shadow} hover:opacity-95 transition-all`}
        >
          <PlusCircle className="h-4 w-4" />
          <span>Create New Server</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/5 space-y-2 hover:bg-white/[0.04] transition-all duration-300 shadow-xl shadow-black/30 hover:border-white/10 group">
          <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500 flex items-center justify-between">
            <span>Server Allocations</span>
            <ServerIcon className="h-3.5 w-3.5 text-zinc-400 group-hover:text-violet-400 transition-colors" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono tracking-tight tabular-nums">
            {allocations?.unlimited ? (
              <span className="text-xl text-violet-400 font-sans font-bold">Unlimited</span>
            ) : (
              <span>{allocations ? `${allocations.used} / ${allocations.limit}` : `${ownedServers.length} / ${user?.serverLimit || 1}`}</span>
            )}
          </div>
          <p className="text-[10px] font-mono text-zinc-500">
            {allocations?.unlimited
              ? `${ownedServers.length} active instances • No limit`
              : `${allocations?.remaining ?? 0} available • ${ownedServers.length} used`}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/5 space-y-2 hover:bg-white/[0.04] transition-all duration-300 shadow-xl shadow-black/30 hover:border-white/10 group">
          <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500 flex items-center justify-between">
            <span>Memory Allocated</span>
            <Cpu className="h-3.5 w-3.5 text-zinc-400 group-hover:text-cyan-400 transition-colors" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono tracking-tight tabular-nums">
            {formatMemory(totalRamMB)}
          </div>
          <p className="text-[10px] font-mono text-zinc-500">Across {servers.length} container instances</p>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/5 space-y-2 hover:bg-white/[0.04] transition-all duration-300 shadow-xl shadow-black/30 hover:border-white/10 group">
          <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500 flex items-center justify-between">
            <span>Account Credits</span>
            <span className="text-zinc-500 group-hover:text-emerald-400 text-xs font-mono transition-colors font-bold">$</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono tracking-tight tabular-nums">
            ${user?.credits?.toFixed(2) || '0.00'}
          </div>
          <button onClick={() => onNavigate('billing')} className="text-[10px] font-mono font-bold text-violet-400 hover:text-violet-300 transition-colors uppercase tracking-wider cursor-pointer">
            + Add Credits
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/5 space-y-2 hover:bg-white/[0.04] transition-all duration-300 shadow-xl shadow-black/30 hover:border-white/10 group">
          <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500 flex items-center justify-between">
            <span>Cluster Status</span>
            <Activity className="h-3.5 w-3.5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            <span className="text-base font-bold">Optimal</span>
          </div>
          <p className="text-[10px] font-mono text-zinc-500">0 pending maintenance events</p>
        </div>

      </div>

      {/* Servers List */}
      <div className="space-y-12">
        {/* Owned Servers Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white uppercase tracking-wider text-xs font-mono">
              Your Active Hosting Containers ({ownedServers.length})
            </h2>
            <button
              onClick={() => fetchServers(true)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {ownedServers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 p-12 text-center space-y-4 bg-zinc-950">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500">
                <ServerIcon className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">No servers created yet</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Deploy your first Minecraft server or Discord Bot container in seconds.
                </p>
              </div>
              <button
                onClick={() => onNavigate('deploy')}
                className={`px-6 py-3 rounded-xl font-semibold text-xs text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md inline-flex items-center gap-2`}
              >
                <PlusCircle className="h-4 w-4" />
                <span>Deploy First Server</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {ownedServers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  onNavigate={(page, params) => {
                    if (page === 'server-manage' && onSelectServer && params?.serverId) {
                      onSelectServer(params.serverId);
                    } else {
                      onNavigate(page, params);
                    }
                  }}
                  onPower={handlePowerAction}
                />
              ))}
            </div>
          )}
        </div>

        {/* Shared Servers Section */}
        {sharedServers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-t border-zinc-800 pt-8">
              <h2 className="text-base font-bold text-violet-400 uppercase tracking-wider text-xs font-mono flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" />
                Shared Servers ({sharedServers.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sharedServers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  onNavigate={(page, params) => {
                    if (page === 'server-manage' && onSelectServer && params?.serverId) {
                      onSelectServer(params.serverId);
                    } else {
                      onNavigate(page, params);
                    }
                  }}
                  onPower={handlePowerAction}
                />
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
