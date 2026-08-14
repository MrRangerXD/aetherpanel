import React, { useState, useEffect } from 'react';
import { Server as ServerIcon, PlusCircle, Play, Square, RotateCw, Cpu, Activity, HardDrive, Copy, Check, Search, Filter } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

interface ServersListProps {
  onNavigate: (page: string, params?: any) => void;
}

export const ServersList: React.FC<ServersListProps> = ({ onNavigate }) => {
  const { accentClasses } = useTheme();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'minecraft' | 'bot'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchServers = async () => {
    const res = await apiRequest('/servers');
    if (res.success && res.data) {
      setServers(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 8000);
    return () => clearInterval(interval);
  }, []);

  const handlePower = async (e: React.MouseEvent, serverId: string, action: 'start' | 'stop' | 'restart') => {
    e.stopPropagation();
    await apiRequest(`/servers/${serverId}/power`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    fetchServers();
  };

  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredServers = servers.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                          s.software.toLowerCase().includes(search.toLowerCase()) ||
                          s.location.toLowerCase().includes(search.toLowerCase());
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'minecraft') return matchesSearch && (s.software.includes('Paper') || s.software.includes('Purpur') || s.software.includes('Spigot') || s.software.includes('Forge'));
    if (filterType === 'bot') return matchesSearch && (s.software.includes('Node') || s.software.includes('Python') || s.software.includes('Discord'));
    return matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Servers</h1>
          <p className="text-xs text-zinc-400 mt-1">Manage and monitor your running Minecraft instances and Discord bot containers.</p>
        </div>

        <button
          onClick={() => onNavigate('deploy')}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md flex items-center gap-2 hover:opacity-95 transition-all`}
        >
          <PlusCircle className="h-4 w-4" /> Deploy New Server
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900 p-3 rounded-2xl border border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search servers by name, software, location..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['all', 'minecraft', 'bot'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                filterType === type ? 'bg-violet-600 text-white' : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Servers List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400 space-y-2">
          <Activity className="h-6 w-6 animate-spin text-violet-400 mx-auto" />
          <p>Loading server inventory...</p>
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl space-y-4">
          <ServerIcon className="h-10 w-10 text-zinc-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">No servers found</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
              You don't have any deployed servers matching this filter yet. Deploy a high-performance server in seconds.
            </p>
          </div>
          <button
            onClick={() => onNavigate('deploy')}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs inline-flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" /> Deploy Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServers.map((s) => {
            const isRunning = s.status === 'running';
            const fullIp = `${s.primaryIp}:${s.primaryPort}`;

            return (
              <div
                key={s.id}
                onClick={() => onNavigate('server-manage', { serverId: s.id })}
                className="group p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/5 transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                {/* Top Title & Status */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      isRunning
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                      <span className="capitalize">{s.status}</span>
                    </span>

                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                      {s.location}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-violet-400 transition-colors">
                    {s.name}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    {s.software} ({s.version})
                  </p>
                </div>

                {/* Resource Stats */}
                <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 text-[11px] font-mono">
                  <div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Cpu className="h-3 w-3 text-violet-400" /> CPU
                    </div>
                    <div className="text-white font-bold">{isRunning ? `${s.cpuUsage}%` : '0%'}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Activity className="h-3 w-3 text-cyan-400" /> RAM
                    </div>
                    <div className="text-white font-bold">{isRunning ? `${(s.ramUsageMB / 1024).toFixed(1)}G` : '0G'}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <HardDrive className="h-3 w-3 text-emerald-400" /> Disk
                    </div>
                    <div className="text-white font-bold">{(s.diskUsageMB / 1024).toFixed(1)}G</div>
                  </div>
                </div>

                {/* IP Copy & Quick Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                  <button
                    onClick={(e) => handleCopy(e, fullIp, s.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 hover:text-white"
                  >
                    <span>{fullIp}</span>
                    {copiedId === s.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                  </button>

                  <div className="flex items-center gap-1">
                    {!isRunning ? (
                      <button
                        onClick={(e) => handlePower(e, s.id, 'start')}
                        className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors"
                        title="Start Server"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => handlePower(e, s.id, 'restart')}
                          className="p-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white transition-colors"
                          title="Restart Server"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handlePower(e, s.id, 'stop')}
                          className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white transition-colors"
                          title="Stop Server"
                        >
                          <Square className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
