import React, { useState, useEffect, useMemo } from 'react';
import {
  Server as ServerIcon, PlusCircle, RefreshCw,
  Cpu, HardDrive, Gamepad2, ArrowRight,
  Sun, SunMedium, Sunset, Moon, Search, BookOpen, ShieldCheck,
  Terminal, Sparkles
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server, UserAllocationStatus } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { ServerCard } from '../../components/server/ServerCard';
import { normalizeServer, formatMemory } from '../../lib/serverNormalize';
import { PanelScrollReveal } from '../../components/PanelScrollReveal';

interface DashboardProps {
  onNavigate: (page: string, params?: any) => void;
  onSelectServer?: (serverId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectServer }) => {
  const { user } = useAuth();

  const [servers, setServers] = useState<Server[]>([]);
  const [ownedServers, setOwnedServers] = useState<Server[]>([]);
  const [sharedServers, setSharedServers] = useState<Server[]>([]);
  const [allocations, setAllocations] = useState<UserAllocationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'offline'>('all');

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
    }, 10000);
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

  // Time-of-day greeting determination
  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return {
        greeting: 'Good morning',
        icon: Sun,
        subtitle: 'Ready to build, configure, and monitor your cloud containers today?'
      };
    } else if (hour >= 12 && hour < 17) {
      return {
        greeting: 'Good afternoon',
        icon: SunMedium,
        subtitle: 'All server instances and high-performance nodes are operating smoothly.'
      };
    } else if (hour >= 17 && hour < 22) {
      return {
        greeting: 'Good evening',
        icon: Sunset,
        subtitle: 'Track active player connections, container logs, and resource quotas.'
      };
    } else {
      return {
        greeting: 'Good night',
        icon: Moon,
        subtitle: 'Late night management? Your 24/7 high-uptime instances remain online.'
      };
    }
  }, []);

  const GreetingIcon = greetingData.icon;

  // Filtered owned servers
  const filteredOwnedServers = useMemo(() => {
    return ownedServers.filter(server => {
      const matchesSearch =
        server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (server.software && server.software.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (server.location && server.location.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'running') return server.status === 'running';
      if (statusFilter === 'offline') return server.status !== 'running';
      return true;
    });
  }, [ownedServers, searchQuery, statusFilter]);

  const runningCount = servers.filter(s => s.status === 'running').length;
  const totalRamMB = servers.reduce((acc, s) => acc + s.limits.ramMB, 0);
  const totalDiskGB = servers.reduce((acc, s) => acc + (s.limits.diskGB || 0), 0);

  // Formatted date
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  return (
    <div className="w-full space-y-6">
      
      {/* 1. GREETING & CLOUD STATUS HEADER */}
      <PanelScrollReveal delayMs={0}>
        <div className="surface p-5 sm:p-6 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[var(--color-ink-dim)]">
                <GreetingIcon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              </span>
              <span className="label">
                {todayFormatted}
              </span>
              <span className="text-[var(--color-ink-mute)]">·</span>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)] animate-pulse" />
                <span className="text-[10px] font-mono font-medium text-[var(--color-ok)] uppercase">Nodes Operational</span>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] tracking-tight">
              {greetingData.greeting},{' '}
              <span className="text-[var(--color-accent)]">
                {user?.displayName || user?.username || 'Commander'}
              </span>
            </h1>
            
            <p className="text-xs text-[var(--color-ink-dim)] max-w-2xl">
              {greetingData.subtitle}
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('docs')}
              className="btn btn-ghost"
            >
              <BookOpen className="h-3.5 w-3.5 text-[var(--color-ink-dim)]" />
              <span>Docs & Guides</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('deploy')}
              className="btn btn-primary"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Deploy Server</span>
            </button>
          </div>
        </div>
      </PanelScrollReveal>

      {/* 2. SUMMARY METRIC CARDS */}
      <PanelScrollReveal delayMs={40}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 stagger">
          
          {/* Server Allocations */}
          <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/50 transition-colors">
            <div className="label flex items-center justify-between">
              <span>Server Slots</span>
              <ServerIcon className="h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
            </div>
            <div className="text-2xl font-bold text-[var(--color-ink)] font-mono tracking-tight tabular-nums flex items-baseline gap-1.5">
              {allocations?.unlimited ? (
                <span className="text-lg text-[var(--color-accent)] font-sans font-semibold">Unlimited</span>
              ) : (
                <>
                  <span>{allocations ? `${allocations.used}` : `${ownedServers.length}`}</span>
                  <span className="text-xs text-[var(--color-ink-mute)]">/ {allocations ? allocations.limit : (user?.serverLimit || 1)}</span>
                </>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--color-ink-dim)] pt-2 border-t border-[var(--color-line)]">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)]" />
                {runningCount} Running
              </span>
              <span>{ownedServers.length - runningCount} Offline</span>
            </div>
          </div>

          {/* Memory Quota */}
          <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/50 transition-colors">
            <div className="label flex items-center justify-between">
              <span>Allocated Memory</span>
              <Cpu className="h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
            </div>
            <div className="text-2xl font-bold text-[var(--color-ink)] font-mono tracking-tight tabular-nums">
              {formatMemory(totalRamMB)}
            </div>
            <div className="text-[11px] font-mono text-[var(--color-ink-dim)] pt-2 border-t border-[var(--color-line)] flex items-center justify-between">
              <span>Active Containers</span>
              <span className="text-[var(--color-accent)] font-semibold">{servers.length}</span>
            </div>
          </div>

          {/* Storage Utilization */}
          <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/50 transition-colors">
            <div className="label flex items-center justify-between">
              <span>NVMe Storage</span>
              <HardDrive className="h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
            </div>
            <div className="text-2xl font-bold text-[var(--color-ink)] font-mono tracking-tight tabular-nums">
              {totalDiskGB > 0 ? `${totalDiskGB} GB` : '0 GB'}
            </div>
            <div className="text-[11px] font-mono text-[var(--color-ink-dim)] pt-2 border-t border-[var(--color-line)] flex items-center justify-between">
              <span>PCIe 4.0 Storage</span>
              <span className="text-[var(--color-ok)] font-medium">Fast SSD</span>
            </div>
          </div>

          {/* Account Balance */}
          <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/50 transition-colors">
            <div className="label flex items-center justify-between">
              <span>Account Balance</span>
              <span className="text-[var(--color-ok)] font-mono text-xs font-bold">$</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-ok)] font-mono tracking-tight tabular-nums">
              ${user?.credits?.toFixed(2) || '0.00'}
            </div>
            <div className="pt-2 border-t border-[var(--color-line)] flex items-center justify-between">
              <button 
                type="button"
                onClick={() => onNavigate('billing')} 
                className="text-[11px] font-mono font-medium text-[var(--color-accent)] hover:underline uppercase tracking-wider cursor-pointer"
              >
                + Add Funds
              </button>
              <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">No auto-charge</span>
            </div>
          </div>

        </div>
      </PanelScrollReveal>

      {/* 3. ACTIVE HOSTING CONTAINERS WITH SEARCH & FILTER */}
      <div className="space-y-4">
        <PanelScrollReveal delayMs={80}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <div>
              <h2 className="text-base font-bold text-[var(--color-ink)] tracking-tight flex items-center gap-2">
                <ServerIcon className="h-4 w-4 text-[var(--color-accent)]" />
                <span>Your Active Hosting Containers</span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--color-surface-2)] text-[var(--color-ink-dim)] border border-[var(--color-line)]">
                  {ownedServers.length}
                </span>
              </h2>
              <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">
                Manage, start, stop, or access web console and SFTP for your instances.
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex items-center gap-2">
              {ownedServers.length > 0 && (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
                    <input
                      type="text"
                      placeholder="Filter servers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="field pl-8 pr-2.5 py-1.5 w-36 sm:w-48 text-xs rounded-md"
                    />
                  </div>

                  <div className="flex items-center rounded-md bg-[var(--color-surface)] border border-[var(--color-line)] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`px-2 py-1 rounded-[4px] font-medium transition-colors cursor-pointer ${
                        statusFilter === 'all' ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)]' : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('running')}
                      className={`px-2 py-1 rounded-[4px] font-medium transition-colors cursor-pointer ${
                        statusFilter === 'running' ? 'bg-[var(--color-surface-3)] text-[var(--color-ok)]' : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                      }`}
                    >
                      Online
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('offline')}
                      className={`px-2 py-1 rounded-[4px] font-medium transition-colors cursor-pointer ${
                        statusFilter === 'offline' ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)]' : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                      }`}
                    >
                      Offline
                    </button>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => fetchServers(true)}
                disabled={loading}
                className="btn btn-ghost text-xs py-1.5 px-2.5"
                title="Refresh servers list"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[var(--color-accent)]' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </PanelScrollReveal>

        {/* Server Cards Grid */}
        <PanelScrollReveal delayMs={120}>
          {ownedServers.length === 0 ? (
            <div className="surface rounded-lg p-10 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-[var(--color-surface-2)] text-[var(--color-ink-dim)] border border-[var(--color-line)]">
                <ServerIcon className="h-6 w-6 text-[var(--color-accent)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[var(--color-ink)]">No Servers Provisioned Yet</h3>
                <p className="text-xs text-[var(--color-ink-mute)] max-w-sm mx-auto">
                  Provision a Minecraft server, Discord bot container, or Node.js web app in seconds.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('deploy')}
                  className="btn btn-primary"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Deploy Your First Server</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('docs')}
                  className="btn btn-ghost"
                >
                  <BookOpen className="h-3.5 w-3.5 text-[var(--color-ink-dim)]" />
                  <span>View Documentation</span>
                </button>
              </div>
            </div>
          ) : filteredOwnedServers.length === 0 ? (
            <div className="surface rounded-lg p-8 text-center text-xs text-[var(--color-ink-mute)]">
              No servers match your current filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOwnedServers.map((server) => (
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
        </PanelScrollReveal>

        {/* Shared Servers Section */}
        {sharedServers.length > 0 && (
          <PanelScrollReveal delayMs={150}>
            <div className="space-y-3 pt-4 border-t border-[var(--color-line)]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[var(--color-ink)] tracking-tight flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-[var(--color-accent)]" />
                  <span>Shared & Subuser Servers</span>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--color-surface-2)] text-[var(--color-ink-dim)] border border-[var(--color-line)]">
                    {sharedServers.length}
                  </span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          </PanelScrollReveal>
        )}

        {/* 4. QUICK ACCESS PROTOCOLS */}
        <PanelScrollReveal delayMs={180}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3">
            
            <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/40 transition-colors">
              <div className="flex items-center gap-2 text-[var(--color-accent)] font-semibold text-xs font-mono">
                <Terminal className="h-3.5 w-3.5" />
                <span>Instant SFTP Access</span>
              </div>
              <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
                Connect via FileZilla, Cyberduck, or VS Code using your server IP and allocated port with 100% encrypted transfer.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('docs')}
                className="text-xs font-medium text-[var(--color-accent)] hover:underline inline-flex items-center gap-1 cursor-pointer pt-0.5"
              >
                <span>Read SFTP Guide</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/40 transition-colors">
              <div className="flex items-center gap-2 text-[var(--color-ink)] font-semibold text-xs font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span>Automated S3 Backups</span>
              </div>
              <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
                Scheduled daily snapshots keep world save files, databases, and configuration YAMLs secure from accidental loss.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('docs')}
                className="text-xs font-medium text-[var(--color-accent)] hover:underline inline-flex items-center gap-1 cursor-pointer pt-0.5"
              >
                <span>Backup Policies</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/40 transition-colors">
              <div className="flex items-center gap-2 text-[var(--color-ink)] font-semibold text-xs font-mono">
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span>24/7 Discord Community</span>
              </div>
              <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
                Need configuration advice or custom Java flags? Chat directly with support engineers and fellow server admins.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('support')}
                className="text-xs font-medium text-[var(--color-accent)] hover:underline inline-flex items-center gap-1 cursor-pointer pt-0.5"
              >
                <span>Open Support Ticket</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

          </div>
        </PanelScrollReveal>

      </div>

    </div>
  );
};
