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
  const isStarting = server.status === 'starting';
  const fullIp = `${server.primaryIp || '127.0.0.1'}:${server.primaryPort || 25565}`;

  const canStart = !server.isSubuser || server.permissions?.includes('server.start');
  const canStop = !server.isSubuser || server.permissions?.includes('server.stop');
  const canRestart = !server.isSubuser || server.permissions?.includes('server.restart');

  const serverType = server.serverType;
  const theme: Partial<ServerTypeTheme> = serverType?.theme || {};
  const rawBgUrl = theme.backgroundUrl || FALLBACK_BACKGROUND;
  const bgUrl = bgError ? FALLBACK_BACKGROUND : rawBgUrl;
  const overlayOpacity = typeof theme.overlayOpacity === 'number' ? theme.overlayOpacity : 0.75;

  const handleCopyIp = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullIp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePowerClick = async (e: React.MouseEvent, action: 'start' | 'stop' | 'restart') => {
    e.stopPropagation();
    if (powerLoadingAction) return;
    setPowerLoadingAction(action);
    try {
      await onPower(e, server.id, action);
    } finally {
      setPowerLoadingAction(null);
    }
  };

  const cpuNum = typeof server.cpuUsage === 'number' && !isNaN(server.cpuUsage) ? server.cpuUsage : 0;
  const ramNum = typeof server.ramUsageMB === 'number' && !isNaN(server.ramUsageMB) ? server.ramUsageMB : 0;
  const maxRamMB = server.resources?.memoryMb || server.limits?.ramMB || 1024;
  const ramPercent = maxRamMB > 0 ? (ramNum / maxRamMB) * 100 : 0;

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

  // Status badge styling per tokens
  const statusColor = isRunning
    ? 'border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10 text-[var(--color-ok)]'
    : isStarting
    ? 'border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 text-[var(--color-warn)]'
    : 'border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink-mute)]';

  return (
    <div
      onClick={() => onNavigate('server-manage', { serverId: server.id })}
      className="group relative rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] hover:border-[#2e3034] transition-colors cursor-pointer flex flex-col justify-between overflow-hidden"
    >
      {/* Top Banner with Background Image */}
      <div className="relative h-28 w-full overflow-hidden bg-[var(--color-surface-2)] shrink-0 border-b border-[var(--color-line)]">
        <img
          src={bgUrl}
          alt={server.name}
          onError={() => setBgError(true)}
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: `rgba(10, 10, 11, ${overlayOpacity})`
          }}
        />

        {/* Top Header: Shared label & Status pill */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <div>
            {server.isSubuser && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium uppercase tracking-wider bg-[var(--color-surface-3)] text-[var(--color-accent)] border border-[var(--color-line)]">
                Shared
              </span>
            )}
          </div>

          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono font-semibold border tracking-wider uppercase ${statusColor}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-[var(--color-ok)]' : isStarting ? 'bg-[var(--color-warn)]' : 'bg-[var(--color-ink-mute)]'}`} />
            <span>{server.status}</span>
          </span>
        </div>

        {/* Runtime Icon & Server Title Overlay */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end gap-2.5">
          {theme.iconUrl && !iconError ? (
            <img
              src={theme.iconUrl}
              alt={serverType?.name || 'runtime'}
              onError={() => setIconError(true)}
              className="h-8 w-8 rounded-md object-contain bg-[var(--color-surface)] p-1 border border-[var(--color-line)] shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-ink)] font-mono font-bold text-xs shrink-0">
              {(serverType?.name || server.software || 'MC').substring(0, 2).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-mono tracking-wider uppercase font-semibold text-[var(--color-ink-mute)] mb-0.5 flex items-center gap-1.5 truncate">
              <span>{serverType?.category || 'Hosting'}</span>
              <span>·</span>
              <span>{server.software}</span>
            </div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)] group-hover:text-white transition-colors truncate">
              {server.name}
            </h3>
          </div>
        </div>
      </div>

      {/* Body Section */}
      <div className="p-3 space-y-3 flex-1 flex flex-col justify-between">
        {/* Endpoint & Region Info */}
        <div className="flex items-center justify-between text-xs gap-2">
          <button
            onClick={handleCopyIp}
            title="Click to copy endpoint IP"
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-line)] font-mono text-[10px] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:border-[#2e3034] transition-colors truncate max-w-[75%] cursor-pointer"
          >
            <span className="truncate">{fullIp}</span>
            {copied ? <Check className="h-3 w-3 text-[var(--color-ok)] shrink-0" /> : <Copy className="h-3 w-3 text-[var(--color-ink-mute)] shrink-0" />}
          </button>

          <span className="text-[9px] font-mono tracking-wider text-[var(--color-ink-mute)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded border border-[var(--color-line)] shrink-0 uppercase">
            {server.location || 'node-01'}
          </span>
        </div>

        {/* Live Hardware Usage Grid with 2px metric bars */}
        <div className="grid grid-cols-3 gap-2 p-2 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[10px] font-mono">
          <div>
            <div className="text-[9px] text-[var(--color-ink-mute)] flex items-center gap-1 uppercase tracking-wider font-medium">
              <Cpu className="h-3 w-3" /> CPU
            </div>
            <div className="text-[var(--color-ink)] font-semibold tabular-nums mt-0.5">{formatCpu()}</div>
            <div className="h-0.5 w-full bg-[var(--color-surface-3)] rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${cpuNum > 85 ? 'bg-[var(--color-err)]' : 'bg-[var(--color-accent)]'}`}
                style={{ width: `${Math.min(100, Math.max(0, cpuNum))}%` }}
              />
            </div>
          </div>

          <div>
            <div className="text-[9px] text-[var(--color-ink-mute)] flex items-center gap-1 uppercase tracking-wider font-medium">
              <Activity className="h-3 w-3" /> RAM
            </div>
            <div className="text-[var(--color-ink)] font-semibold tabular-nums mt-0.5">{formatRam()}</div>
            <div className="h-0.5 w-full bg-[var(--color-surface-3)] rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${ramPercent > 85 ? 'bg-[var(--color-err)]' : 'bg-[var(--color-accent)]'}`}
                style={{ width: `${Math.min(100, Math.max(0, ramPercent))}%` }}
              />
            </div>
          </div>

          <div>
            <div className="text-[9px] text-[var(--color-ink-mute)] flex items-center gap-1 uppercase tracking-wider font-medium">
              <HardDrive className="h-3 w-3" /> Disk
            </div>
            <div className="text-[var(--color-ink)] font-semibold tabular-nums mt-0.5">{formatDisk()}</div>
            <div className="h-0.5 w-full bg-[var(--color-surface-3)] rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, ((server.diskUsageMB || 0) / ((server.limits?.diskGB || 10) * 1024)) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Power Actions Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-line)] text-xs">
          <div className="flex flex-col">
            <span className="text-[9px] text-[var(--color-ink-mute)] font-mono tracking-wide">
              {server.id.substring(0, 8)}
            </span>
            {server.isSubuser && server.owner && (
              <span className="text-[9px] text-[var(--color-ink-dim)]">
                by {server.owner.displayName || server.owner.username}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {!isRunning ? (
              canStart && (
                <button
                  disabled={!!powerLoadingAction}
                  onClick={e => handlePowerClick(e, 'start')}
                  className="px-2.5 h-7 rounded-md bg-[var(--color-ok)]/10 hover:bg-[var(--color-ok)]/20 text-[var(--color-ok)] border border-[var(--color-ok)]/30 transition-colors font-medium text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  title="Start Server"
                >
                  {powerLoadingAction === 'start' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 fill-current" />
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
                    className="px-2 h-7 rounded-md bg-[var(--color-warn)]/10 hover:bg-[var(--color-warn)]/20 text-[var(--color-warn)] border border-[var(--color-warn)]/30 transition-colors font-medium text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    title="Restart Server"
                  >
                    {powerLoadingAction === 'restart' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCw className="h-3 w-3" />
                    )}
                  </button>
                )}
                {canStop && (
                  <button
                    disabled={!!powerLoadingAction}
                    onClick={e => handlePowerClick(e, 'stop')}
                    className="px-2 h-7 rounded-md bg-[var(--color-err)]/10 hover:bg-[var(--color-err)]/20 text-[var(--color-err)] border border-[var(--color-err)]/30 transition-colors font-medium text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    title="Stop Server"
                  >
                    {powerLoadingAction === 'stop' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Square className="h-3 w-3 fill-current" />
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
