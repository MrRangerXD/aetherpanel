import React, { useState, useEffect } from 'react';
import { Server as ServerIcon, PlusCircle, RefreshCw, Search } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server } from '../../types';
import { ServerCard } from '../../components/server/ServerCard';
import { normalizeServer } from '../../lib/serverNormalize';
import { PanelScrollReveal } from '../../components/PanelScrollReveal';

interface ServersListProps {
  onNavigate: (page: string, params?: any) => void;
}

export const ServersList: React.FC<ServersListProps> = ({ onNavigate }) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'minecraft' | 'bot'>('all');

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <PanelScrollReveal delayMs={0}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-line)] pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] tracking-tight">Your Servers</h1>
            <p className="text-xs text-[var(--color-ink-mute)] mt-1">Manage and monitor your running Minecraft instances and Discord bot containers.</p>
          </div>

          <button
            onClick={() => onNavigate('deploy')}
            className="btn btn-primary"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Deploy New Server</span>
          </button>
        </div>
      </PanelScrollReveal>

      {/* Filter and Search Bar */}
      <PanelScrollReveal delayMs={40}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 surface p-3 rounded-lg">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search servers by name, software, location..."
              className="field w-full pl-8 pr-3 py-1.5 text-xs rounded-md"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {(['all', 'minecraft', 'bot'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                  filterType === type 
                    ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)] border border-[var(--color-line)]' 
                    : 'bg-transparent text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] border border-transparent'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </PanelScrollReveal>

      {/* Servers List */}
      {loading ? (
        <div className="surface p-10 text-center rounded-lg space-y-2">
          <RefreshCw className="h-5 w-5 animate-spin text-[var(--color-accent)] mx-auto" />
          <p className="text-xs text-[var(--color-ink-dim)]">Loading server inventory...</p>
        </div>
      ) : filteredServers.length === 0 ? (
        <PanelScrollReveal delayMs={80}>
          <div className="surface p-10 text-center rounded-lg space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-surface-2)] text-[var(--color-ink-dim)] border border-[var(--color-line)]">
              <ServerIcon className="h-5 w-5 text-[var(--color-ink-mute)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">No servers found</h3>
              <p className="text-xs text-[var(--color-ink-mute)] max-w-sm mx-auto mt-0.5">
                No servers match the selected criteria. Deploy a container in seconds.
              </p>
            </div>
            <div className="pt-1">
              <button
                onClick={() => onNavigate('deploy')}
                className="btn btn-primary"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Deploy Server</span>
              </button>
            </div>
          </div>
        </PanelScrollReveal>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
