import React from 'react';
import {
  Wifi, Check, Copy, RotateCw, Play, Square, Skull,
  Box, FileText, Terminal as TerminalIcon, ArrowLeft
} from 'lucide-react';
import { Server } from '../../types';
import { formatMemory } from '../../lib/serverNormalize';

interface ServerHeaderProps {
  server: Server;
  isMinecraft: boolean;
  isPython: boolean;
  fullIp: string;
  copied: boolean;
  onCopy: (text: string) => void;
  onNavigate: (page: string, params?: any) => void;
  isRunning: boolean;
  canStart: boolean;
  canRestart: boolean;
  canStop: boolean;
  canKill: boolean;
  powerLoadingAction: 'start' | 'stop' | 'restart' | 'kill' | null;
  onPowerAction: (action: 'start' | 'stop' | 'restart' | 'kill') => void;
}

export const ServerHeader: React.FC<ServerHeaderProps> = ({
  server,
  isMinecraft,
  isPython,
  fullIp,
  copied,
  onCopy,
  onNavigate,
  isRunning,
  canStart,
  canRestart,
  canStop,
  canKill,
  powerLoadingAction,
  onPowerAction
}) => {
  return (
    <div className="p-4 sm:p-5 border-b border-[var(--color-line)] bg-[var(--color-surface)] space-y-3 shrink-0">
      {/* Top Breadcrumb row */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-ink-mute)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="lg:hidden inline-flex items-center gap-1.5 text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            <span>Servers</span>
            <span>/</span>
          </button>
          <span className="hidden lg:inline text-[var(--color-ink-dim)]">Server Control</span>
          <span className="hidden lg:inline">/</span>
          <span className="text-[var(--color-ink)] font-semibold truncate max-w-xs">{server.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[var(--color-ink-mute)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded border border-[var(--color-line)]">
            Node: {server.location || 'Local Node'}
          </span>
          {server.isSubuser && (
            <span className="font-mono text-[10px] text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded border border-[var(--color-accent)]/30">
              Shared Access
            </span>
          )}
        </div>
      </div>

      {/* Server Title, Status, Real Specs, and Pterodactyl Power Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
        {/* Left: Icon, Server Name & Real Specs */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-accent)]">
            {isMinecraft ? <Box className="h-5 w-5" /> : isPython ? <FileText className="h-5 w-5" /> : <TerminalIcon className="h-5 w-5" />}
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-[var(--color-ink)] tracking-tight break-words">
                {server.name}
              </h1>

              {/* Real-time Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  server.status === 'running'
                    ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/40'
                    : server.status === 'starting' || server.status === 'stopping'
                    ? 'bg-[var(--color-warn)]/10 text-[var(--color-warn)] border-[var(--color-warn)]/40'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-ink-mute)] border-[var(--color-line)]'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    server.status === 'running'
                      ? 'bg-[var(--color-ok)] animate-pulse'
                      : server.status === 'starting' || server.status === 'stopping'
                      ? 'bg-[var(--color-warn)] animate-spin'
                      : 'bg-[var(--color-ink-mute)]'
                  }`}
                />
                <span className="uppercase tracking-wider font-mono">{server.status}</span>
              </span>
            </div>

            {/* Real Server Specs & Node Info */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-ink-mute)]">
              <span className="text-[var(--color-ink-dim)] font-medium">
                {server.software} ({server.version || 'Latest'})
              </span>
              <span>·</span>
              <span className="font-mono">
                {formatMemory(server.resources?.memoryMb || server.limits?.ramMB || 512)} RAM
              </span>
              <span>·</span>
              <span className="font-mono">
                {server.limits?.cpuCores || 1} CPU Core
                {server.limits?.cpuCores && server.limits.cpuCores > 1 ? 's' : ''}
              </span>
              <span>·</span>
              <span className="font-mono">{server.limits?.diskGB || 10} GB NVMe</span>
            </div>
          </div>
        </div>

        {/* Right: Address Quick Copy & Pterodactyl Power Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1-click Address Pill */}
          <div
            onClick={() => onCopy(fullIp)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xs font-mono text-[var(--color-ink-dim)] hover:border-[var(--color-accent)] transition-colors cursor-pointer group"
            title="Click to copy server address"
          >
            <Wifi className="h-3.5 w-3.5 text-[var(--color-ink-mute)] group-hover:text-[var(--color-accent)] transition-colors" />
            <span className="truncate max-w-[180px] sm:max-w-[220px]">
              <strong className="text-[var(--color-ink)] font-mono">{fullIp}</strong>
            </span>
            <button
              type="button"
              className="p-0.5 hover:text-[var(--color-ink)] text-[var(--color-ink-mute)] transition-colors shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[var(--color-ok)]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Pterodactyl Power Buttons Group */}
          <div className="flex items-center gap-1 p-1 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)]">
            {!isRunning && server.status !== 'starting' ? (
              <button
                type="button"
                disabled={powerLoadingAction !== null || !canStart}
                onClick={() => onPowerAction('start')}
                className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                title="Start Server"
              >
                {powerLoadingAction === 'start' ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                <span>Start</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={powerLoadingAction !== null || !canRestart}
                  onClick={() => onPowerAction('restart')}
                  className="btn btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1.5 text-[var(--color-warn)] hover:text-[var(--color-warn)] hover:bg-[var(--color-warn)]/10"
                  title="Restart Server"
                >
                  {powerLoadingAction === 'restart' ? (
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5" />
                  )}
                  <span>Restart</span>
                </button>

                <button
                  type="button"
                  disabled={powerLoadingAction !== null || !canStop}
                  onClick={() => onPowerAction('stop')}
                  className="btn btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1.5 text-[var(--color-err)] hover:text-[var(--color-err)] hover:bg-[var(--color-err)]/10"
                  title="Gracefully Stop Server"
                >
                  {powerLoadingAction === 'stop' ? (
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Square className="h-3.5 w-3.5 fill-current" />
                  )}
                  <span>Stop</span>
                </button>

                <button
                  type="button"
                  disabled={powerLoadingAction !== null || !canKill}
                  onClick={() => onPowerAction('kill')}
                  className="btn btn-danger text-xs py-1.5 px-2.5 flex items-center gap-1.5"
                  title="Force Kill Process (Immediate SIGKILL)"
                >
                  {powerLoadingAction === 'kill' ? (
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Skull className="h-3.5 w-3.5" />
                  )}
                  <span>Kill</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
