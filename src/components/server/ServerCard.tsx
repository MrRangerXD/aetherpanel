import React, { useState } from 'react';
import { Play, Square, RotateCw, Cpu, Activity, HardDrive, Copy, Check, Loader2 } from 'lucide-react';
import { Server, ServerTypeTheme } from '../../types';
import { formatMemory } from '../../lib/serverNormalize';

interface ServerCardProps {
  server: Server;
  onNavigate: (page: string, params?: any) => void;
  onPower: (e: React.MouseEvent, serverId: string, action: 'start' | 'stop' | 'restart') => Promise<void> | void;
}

const FALLBACK_BACKGROUND = 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80';

export const ServerCard: React.FC<ServerCardProps> = ({ server, onNavigate, onPower }) => {
  const [copied, setCopied] = useState(false);
  const [bgError, setBgError] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [powerLoadingAction, setPowerLoadingAction] = useState<'start' | 'stop' | 'restart' | null>(null);

  const isRunning = server.status === 'running';
  const fullIp = `${server.primaryIp || '127.0.0.1'}:${server.primaryPort || 25565}`;

  const canStart = !server.isSubuser || server.permissions?.includes('server.start');
  const canStop = !server.isSubuser || server.permissions?.includes('server.stop');
  const canRestart = !server.isSubuser || server.permissions?.includes('server.restart');

  const serverType = server.serverType;
  const theme: Partial<ServerTypeTheme> = serverType?.theme || {};
  const accentColor = theme.accentColor || '#8B5CF6';
  const rawBgUrl = theme.backgroundUrl || FALLBACK_BACKGROUND;
  const bgUrl = bgError ? FALLBACK_BACKGROUND : rawBgUrl;
  const overlayOpacity = typeof theme.overlayOpacity === 'number' ? theme.overlayOpacity : 0.6;
  const cardStyle = theme.cardStyle || 'default';
  const badgeStyle = theme.badgeStyle || 'glow';
  const statusStyle = theme.statusStyle || 'pill';

  const handleCopyIp = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullIp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePowerClick = async (e: React.MouseEvent, action: 'start' | 'stop' | 'restart') => {
    e.stopPropagation();
    if (powerLoadingAction) return; // Prevent double clicks
    setPowerLoadingAction(action);
    try {
      await onPower(e, server.id, action);
    } finally {
      setPowerLoadingAction(null);
    }
  };

  // Safe Telemetry Formatting
  const formatCpu = () => {
    if (!isRunning) return '0%';
    if (typeof server.cpuUsage === 'number' && !isNaN(server.cpuUsage)) {
      return `${server.cpuUsage}%`;
    }
    return '—';
  };

  const formatRam = () => {
    if (!isRunning) return '0 MB';
    if (typeof server.ramUsageMB === 'number' && !isNaN(server.ramUsageMB)) {
      return formatMemory(server.ramUsageMB);
    }
    return '—';
  };

  const formatDisk = () => {
    if (typeof server.diskUsageMB === 'number' && !isNaN(server.diskUsageMB)) {
      return `${(server.diskUsageMB / 1024).toFixed(1)} GB`;
    }
    return '—';
  };

  // Preset Card Classes
  const getCardClasses = () => {
    return 'bg-white/[0.01] backdrop-blur-md border border-white/5 shadow-xl hover:shadow-black/50 hover:border-white/10 hover:bg-white/[0.03]';
  };

  // Category Badge Style
  const getBadgeClasses = () => {
    return 'px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white shadow-md backdrop-blur-md';
  };

  return (
    <div
      onClick={() => onNavigate('server-manage', { serverId: server.id })}
      className={`group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col justify-between hover:scale-[1.01] ${getCardClasses()}`}
      style={{
        borderColor: cardStyle === 'bordered' ? accentColor : undefined
      }}
    >
      {/* Top Banner with Background Image & Theme Overlay */}
      <div className={`relative ${cardStyle === 'compact' ? 'h-28' : 'h-36'} w-full overflow-hidden bg-zinc-950 shrink-0`}>
        <img
          src={bgUrl}
          alt={server.name}
          onError={() => setBgError(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          className="absolute inset-0 transition-opacity"
          style={{
            backgroundColor: `rgba(4, 4, 6, ${overlayOpacity})`,
            backgroundImage: theme.gradientEnabled !== false
              ? `linear-gradient(to bottom, rgba(4,4,6,0.1), rgba(4,4,6,0.98))`
              : 'none'
          }}
        />

        {/* Top Header: Category Badge & Status Badge */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={getBadgeClasses()}
              style={{ backgroundColor: badgeStyle === 'outline' ? undefined : `${accentColor}CC` }}
            >
              {serverType?.category || 'Hosting'}
            </span>
            {server.isSubuser && (
              <span className="px-1.5 py-0.5 rounded bg-violet-600/40 backdrop-blur-md text-[8px] font-bold uppercase tracking-widest text-white shadow-lg border border-violet-400/20">
                Shared
              </span>
            )}
          </div>

          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border backdrop-blur-md ${
            isRunning
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-zinc-950/80 text-zinc-400 border-white/5'
          }`}>
            <span className={`h-1 w-1 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
            <span className="capitalize">{server.status}</span>
          </span>
        </div>

        {/* Runtime Icon & Server Title Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end gap-3">
          {theme.iconUrl && !iconError ? (
            <img
              src={theme.iconUrl}
              alt={serverType?.name || 'runtime'}
              onError={() => setIconError(true)}
              className="h-10 w-10 rounded-xl object-contain bg-zinc-950/90 p-1.5 border border-white/5 shadow-lg shrink-0"
            />
          ) : (
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-lg shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {(serverType?.name || server.software || 'MC').substring(0, 2).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate drop-shadow">
              {server.name}
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono truncate">
              {server.software} ({server.version})
            </p>
          </div>
        </div>
      </div>

      {/* Body Section: Endpoint IP & Live Telemetry */}
      <div className="p-4 space-y-3 bg-transparent flex-1 flex flex-col justify-between">
        {/* Endpoint & Region Info */}
        <div className="flex items-center justify-between text-xs gap-2">
          <button
            onClick={handleCopyIp}
            title="Click to copy endpoint IP"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/60 border border-white/5 font-mono text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-950 transition-all truncate max-w-[70%] cursor-pointer"
          >
            <span className="truncate">{fullIp}</span>
            {copied ? <Check className="h-3 w-3 text-emerald-400 shrink-0" /> : <Copy className="h-3 w-3 text-zinc-600 shrink-0" />}
          </button>

          <span className="text-[9px] font-mono tracking-wider text-zinc-500 bg-zinc-950/40 px-2 py-1 rounded-lg border border-white/5 shrink-0 uppercase font-semibold">
            {server.location || 'us-west'}
          </span>
        </div>

        {/* Real-time Hardware Usage Grid */}
        <div className="grid grid-cols-3 gap-2 bg-zinc-950/30 p-2.5 rounded-xl border border-white/5 text-[10px] font-mono">
          <div>
            <div className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-semibold">
              <Cpu className="h-3 w-3 text-amber-500/80" /> CPU
            </div>
            <div className="text-zinc-200 font-bold tabular-nums mt-0.5">{formatCpu()}</div>
          </div>

          <div>
            <div className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-semibold">
              <Activity className="h-3 w-3 text-cyan-500/80" /> RAM
            </div>
            <div className="text-zinc-200 font-bold tabular-nums mt-0.5">{formatRam()}</div>
          </div>

          <div>
            <div className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-semibold">
              <HardDrive className="h-3 w-3 text-emerald-500/80" /> Disk
            </div>
            <div className="text-zinc-200 font-bold tabular-nums mt-0.5">{formatDisk()}</div>
          </div>
        </div>

        {/* Quick Power Actions Bar */}
        <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-xs">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 font-mono tracking-wide">
              ID: {server.id}
            </span>
            {server.isSubuser && server.owner && (
              <span className="text-[9px] text-violet-400 font-medium">
                Shared by: {server.owner.displayName || server.owner.username}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {!isRunning ? (
              canStart && (
                <button
                  disabled={!!powerLoadingAction}
                  onClick={e => handlePowerClick(e, 'start')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors font-medium text-xs flex items-center gap-1 disabled:opacity-50"
                  title="Start Server"
                >
                  {powerLoadingAction === 'start' ? (
                    <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  <span>Start</span>
                </button>
              )
            ) : (
              <>
                {canRestart && (
                  <button
                    disabled={!!powerLoadingAction}
                    onClick={e => handlePowerClick(e, 'restart')}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors font-medium text-xs flex items-center gap-1 disabled:opacity-50"
                    title="Restart Server"
                  >
                    {powerLoadingAction === 'restart' ? (
                      <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                    ) : (
                      <RotateCw className="h-3 w-3" />
                    )}
                  </button>
                )}
                {canStop && (
                  <button
                    disabled={!!powerLoadingAction}
                    onClick={e => handlePowerClick(e, 'stop')}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors font-medium text-xs flex items-center gap-1 disabled:opacity-50"
                    title="Stop Server"
                  >
                    {powerLoadingAction === 'stop' ? (
                      <Loader2 className="h-3 w-3 animate-spin text-rose-400" />
                    ) : (
                      <Square className="h-3 w-3" />
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerCard;
