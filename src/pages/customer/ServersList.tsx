import React, { useState, useEffect } from 'react';
import { Server as ServerIcon, PlusCircle, Activity, Search } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { ServerCard } from '../../components/server/ServerCard';
import { normalizeServer } from '../../lib/serverNormalize';

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
      const list = Array.isArray(res.data) ? res.data : [];
      setServers(list.map((s: any) => normalizeServer(s)));
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
    const name = typeof s.name === 'string' ? s.name.toLowerCase() : '';
    const software = typeof s.software === 'string' ? s.software.toLowerCase() : '';
    const location = typeof s.location === 'string' ? s.location.toLowerCase() : '';
    const q = search.toLowerCase();
    const matchesSearch = name.includes(q) || software.includes(q) || location.includes(q);
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'minecraft') return matchesSearch && (software.includes('paper') || software.includes('purpur') || software.includes('spigot') || software.includes('forge'));
    if (filterType === 'bot') return matchesSearch && (software.includes('node') || software.includes('python') || software.includes('discord') || software.includes('bun'));
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
          {filteredServers.map((s) => (
            <ServerCard
              key={s.id}
              server={s}
              onNavigate={onNavigate}
              onPower={handlePower}
            />
          ))}
        </div>
      )}

    </div>
  );
};
