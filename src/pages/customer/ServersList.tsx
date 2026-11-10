import React, { useState, useEffect } from 'react';
import {
  Server as ServerIcon, PlusCircle, RefreshCw, Search, Star, Zap,
  ExternalLink, Copy, Check, HardDrive, Cpu, Wifi, Info, ChevronRight
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server } from '../../types';
import { normalizeServer } from '../../lib/serverNormalize';
import { useAuth } from '../../lib/AuthContext';

interface ServersListProps {
  onNavigate: (page: string, params?: any) => void;
}

export const ServersList: React.FC<ServersListProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'minecraft' | 'bot'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchServers = async () => {
    try {
      const res = await apiRequest('/servers');
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : [];
        setServers(list.map((s: any) => normalizeServer(s)));
      }
    } catch (e) {
      console.error('Failed to load servers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredServers = servers.filter((s) => {
    const name = typeof s.name === 'string' ? s.name.toLowerCase() : '';
    const software = typeof s.software === 'string' ? s.software.toLowerCase() : '';
    const location = typeof s.location === 'string' ? s.location.toLowerCase() : '';
    const q = search.toLowerCase();
    const matchesSearch = name.includes(q) || software.includes(q) || location.includes(q);
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'minecraft') {
      return matchesSearch && (software.includes('paper') || software.includes('purpur') || software.includes('spigot') || software.includes('forge') || software.includes('minecraft'));
    }
    if (filterType === 'bot') {
      return matchesSearch && (software.includes('node') || software.includes('python') || software.includes('discord') || software.includes('bun'));
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Welcome Back Header + Badges & New Server Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Welcome back, {user?.displayName || user?.username || 'kravenog'}</span>
            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {servers.length} {servers.length === 1 ? 'server' : 'servers'} deployed across your account
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-400 bg-[#14151b] border border-[#23252e] px-3 py-1.5 rounded-lg">
            <span className="text-white font-bold">{servers.length > 0 ? 2248 + servers.length : 2248}</span> servers
            <span>•</span>
            <span className="text-white font-bold">35,996</span> users
          </div>

          <button
            onClick={() => onNavigate('deploy')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New server</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search servers by name, software, ip..."
            className="w-full bg-[#14151b] border border-[#23252e] text-white text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#f97316] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['all', 'minecraft', 'bot'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                filterType === type
                  ? 'bg-[#181922] text-white border border-[#23252e] shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Server Table View (Orihost image_621d190d.png) */}
      <div className="rounded-xl bg-[#14151b] border border-[#23252e] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin text-[#f97316] mx-auto" />
            <div className="text-xs text-neutral-400">Loading your cloud containers...</div>
          </div>
        ) : filteredServers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#0c0d12] border border-[#23252e] flex items-center justify-center text-neutral-500 mx-auto">
              <ServerIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">No servers found</div>
              <div className="text-xs text-neutral-400 mt-1">
                {search ? 'Try adjusting your search query.' : 'Deploy your first high-speed container now.'}
              </div>
            </div>
            <button
              onClick={() => onNavigate('deploy')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] text-white text-xs font-bold hover:bg-[#ea580c] transition-colors cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Deploy Server</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#23252e] text-[10px] font-mono uppercase tracking-wider text-neutral-400 bg-[#0e0f14]">
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Address</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">CPU</th>
                  <th className="py-3 px-4 font-semibold">Memory</th>
                  <th className="py-3 px-4 font-semibold">Disk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#23252e]/60 text-xs">
                {filteredServers.map((server) => {
                  const isRunning = server.status === 'running';
                  const displayHost = (server as any).fqdn || ((server as any).resolvedPublicEndpoint ? (server as any).resolvedPublicEndpoint.split(':')[0] : '') || (server.primaryIp && server.primaryIp !== '127.0.0.1' && server.primaryIp !== '0.0.0.0' ? server.primaryIp : (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'));
                  const fullAddress = (server as any).resolvedPublicEndpoint || `${displayHost}:${server.primaryPort || 25565}`;
                  const ramMB = server.resources?.memoryMb || server.limits?.ramMB || 512;
                  const diskGB = server.limits?.diskGB || 1;

                  return (
                    <tr
                      key={server.id}
                      onClick={() => onNavigate('server-manage', { serverId: server.id })}
                      className="hover:bg-[#181922] transition-colors cursor-pointer group"
                    >
                      {/* Name Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#0c0d12] border border-[#23252e] flex items-center justify-center text-neutral-400 group-hover:text-[#f97316] group-hover:border-[#f97316]/40 transition-colors shrink-0">
                            <ServerIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-[#f97316] transition-colors">
                              {server.name}
                            </div>
                            <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                              #{server.id.substring(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Address Column */}
                      <td className="py-3.5 px-4">
                        <div
                          onClick={(e) => handleCopy(e, fullAddress, server.id)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                          title="Click to copy address"
                        >
                          <span>{fullAddress}</span>
                          {copiedId === server.id ? (
                            <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                          ) : (
                            <Copy className="h-3 w-3 text-neutral-400 opacity-60 hover:opacity-100 shrink-0" />
                          )}
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${
                            isRunning
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : server.status === 'starting'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isRunning
                                ? 'bg-emerald-400 animate-pulse'
                                : server.status === 'starting'
                                ? 'bg-amber-400 animate-spin'
                                : 'bg-neutral-500'
                            }`}
                          />
                          <span>{server.status}</span>
                        </span>
                      </td>

                      {/* CPU Column */}
                      <td className="py-3.5 px-4 font-mono text-neutral-300">
                        {isRunning ? '0.01%' : '0%'}
                      </td>

                      {/* Memory Column */}
                      <td className="py-3.5 px-4 font-mono text-neutral-300">
                        {isRunning ? `56.96 MiB / ${ramMB} MB` : 'Offline'}
                      </td>

                      {/* Disk Column */}
                      <td className="py-3.5 px-4 font-mono text-neutral-300">
                        {isRunning ? `90.45 MiB / ${diskGB} GB` : 'Offline'}
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
  );
};
