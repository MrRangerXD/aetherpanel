import React, { useState, useEffect } from 'react';
import {
  Server as ServerIcon, PlusCircle, Play, Square, RefreshCw,
  Copy, Check, Cpu, HardDrive, Gamepad2, Bot, ArrowRight, Activity, Zap
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server, ServerStatus } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

interface DashboardProps {
  onNavigate: (page: string, params?: any) => void;
  onSelectServer: (serverId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectServer }) => {
  const { user } = useAuth();
  const { accentClasses } = useTheme();

  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const fetchServers = async () => {
    setLoading(true);
    const res = await apiRequest('/servers');
    if (res.success && res.data) {
      setServers(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServers();
    const interval = setInterval(() => {
      fetchServers();
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
        
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="text-xs font-medium text-zinc-400 flex items-center justify-between">
            <span>Total Servers</span>
            <ServerIcon className="h-4 w-4 text-violet-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{servers.length}</div>
          <p className="text-[11px] text-zinc-500">{runningCount} active • {servers.length - runningCount} offline</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="text-xs font-medium text-zinc-400 flex items-center justify-between">
            <span>Memory Allocated</span>
            <Cpu className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {(totalRamMB / 1024).toFixed(1)} GB
          </div>
          <p className="text-[11px] text-zinc-500">Across {servers.length} container instances</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="text-xs font-medium text-zinc-400 flex items-center justify-between">
            <span>Account Credits</span>
            <span className="text-emerald-400 text-xs font-bold">$</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            ${user?.credits?.toFixed(2) || '0.00'}
          </div>
          <button onClick={() => onNavigate('billing')} className="text-[11px] text-violet-400 hover:underline">
            + Add Credits
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="text-xs font-medium text-zinc-400 flex items-center justify-between">
            <span>Cluster Status</span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse inline-block" />
            <span className="text-lg">Optimal</span>
          </div>
          <p className="text-[11px] text-zinc-500">0 pending maintenance events</p>
        </div>

      </div>

      {/* Servers List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-xs font-mono">
            Your Active Hosting Containers ({servers.length})
          </h2>
          <button
            onClick={fetchServers}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {servers.length === 0 ? (
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {servers.map((server) => {
              const fullIp = `${server.primaryIp}:${server.primaryPort}`;
              const isRunning = server.status === 'running';

              return (
                <div
                  key={server.id}
                  onClick={() => onSelectServer(server.id)}
                  className="rounded-2xl border border-zinc-800/80 bg-zinc-900/90 p-5 space-y-4 hover:border-zinc-700 transition-all cursor-pointer group relative"
                >
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        server.software.includes('Node') || server.software.includes('Python')
                          ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                          : 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                      }`}>
                        {server.software.includes('Node') || server.software.includes('Python') ? (
                          <Bot className="h-5 w-5" />
                        ) : (
                          <Gamepad2 className="h-5 w-5" />
                        )}
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-violet-400 transition-colors flex items-center gap-2">
                          <span>{server.name}</span>
                        </h3>
                        <div className="text-xs text-zinc-400 flex items-center gap-2">
                          <span>{server.software} ({server.version})</span>
                          <span>•</span>
                          <span>{server.location}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        server.status === 'running'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : server.status === 'starting'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${server.status === 'running' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                        <span className="capitalize">{server.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* IP Copy Bar & Quick Controls */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-zinc-500">IP:</span>
                      <span className="font-semibold text-white">{fullIp}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => handleCopyIp(e, fullIp)}
                        className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors text-[11px] flex items-center gap-1"
                      >
                        {copiedIp === fullIp ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copiedIp === fullIp ? 'Copied!' : 'Copy IP'}</span>
                      </button>

                      {isRunning ? (
                        <button
                          onClick={(e) => handlePowerAction(e, server.id, 'stop')}
                          title="Stop Server"
                          className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
                        >
                          <Square className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handlePowerAction(e, server.id, 'start')}
                          title="Start Server"
                          className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Resource Gauges */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>CPU Usage</span>
                        <span className="font-semibold text-white">{isRunning ? `${server.cpuUsage}%` : '0%'}</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all duration-500"
                          style={{ width: `${isRunning ? Math.min(100, server.cpuUsage * 2) : 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Memory</span>
                        <span className="font-semibold text-white">
                          {isRunning ? `${(server.ramUsageMB / 1024).toFixed(1)}GB` : '0GB'} / {(server.limits.ramMB / 1024).toFixed(0)}GB
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                          style={{ width: `${isRunning ? Math.min(100, (server.ramUsageMB / server.limits.ramMB) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
