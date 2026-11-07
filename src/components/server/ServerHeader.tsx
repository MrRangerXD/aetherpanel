import React, { useState } from 'react';
import {
  Wifi, Check, Copy, RotateCw, Play, Square, Skull,
  Box, FileText, Terminal as TerminalIcon, ArrowLeft,
  ChevronDown, ExternalLink, Zap, Info, Shield, Database,
  Clock, Folder, Activity, Key, Sliders, Users, HardDrive,
  Package, Boxes, Globe, Crown
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
  activeTab?: string;
  onTabSelect?: (tab: string) => void;
  databasesCount?: number;
  schedulesCount?: number;
  backupsCount?: number;
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
  onPowerAction,
  activeTab = 'console',
  onTabSelect,
  databasesCount = 0,
  schedulesCount = 0,
  backupsCount = 0
}) => {
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);

  // Minecraft servers get Plugins, Mods, Players, Worlds, Properties outside in main tabs row!
  const mainTabs = isMinecraft
    ? [
        { id: 'console', label: 'Console', icon: TerminalIcon },
        { id: 'files', label: 'Files', icon: Folder },
        { id: 'plugins', label: 'Plugins', icon: Package },
        { id: 'mods', label: 'Mods', icon: Boxes },
        { id: 'players', label: 'Players', icon: Crown },
        { id: 'worlds', label: 'Worlds', icon: Globe },
        { id: 'properties', label: 'Properties', icon: FileText },
        { id: 'backups', label: 'Backups', icon: HardDrive, count: backupsCount },
        { id: 'startup', label: 'Startup', icon: Sliders },
        { id: 'databases', label: 'Databases', icon: Database, count: databasesCount },
        { id: 'schedules', label: 'Schedules', icon: Clock, count: schedulesCount },
        { id: 'subusers', label: 'Users', icon: Users },
        { id: 'activity', label: 'Activity', icon: Activity }
      ]
    : [
        { id: 'console', label: 'Console', icon: TerminalIcon },
        { id: 'files', label: 'Files', icon: Folder },
        { id: 'startup', label: 'Startup', icon: Sliders },
        { id: 'env', label: 'Environment', icon: Key },
        { id: 'backups', label: 'Backups', icon: HardDrive, count: backupsCount },
        { id: 'databases', label: 'Databases', icon: Database, count: databasesCount },
        { id: 'schedules', label: 'Schedules', icon: Clock, count: schedulesCount },
        { id: 'subusers', label: 'Users', icon: Users },
        { id: 'activity', label: 'Activity', icon: Activity },
        { id: 'settings', label: 'Settings', icon: Sliders }
      ];

  const moreTabs = [
    { id: 'network', label: 'Network & SFTP' },
    { id: 'monitoring', label: 'Monitoring & Metrics' },
    ...(isMinecraft
      ? [
          { id: 'settings', label: 'Settings' },
          { id: 'env', label: 'Raw .env Editor' }
        ]
      : []),
    { id: 'importer', label: 'Server Importer' },
    { id: 'discord', label: 'Discord Bot' }
  ];

  const isMoreTabActive = moreTabs.some((t) => t.id === activeTab);

  return (
    <div className="border-b border-[#181920] bg-[#09090b] space-y-4 shrink-0 px-4 sm:px-6 pt-4 pb-2">
      {/* 1. Breadcrumb row (Orihost image_00688f85.png) */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
        <div className="flex items-center gap-2 font-mono">
          <button
            type="button"
            onClick={() => onNavigate('servers')}
            className="inline-flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[#f97316]" />
            <span>Servers</span>
          </button>
          <span>/</span>
          <span className="text-white font-semibold truncate max-w-[200px] sm:max-w-xs">{server.name}</span>
          <span>/</span>
          <span className="text-[#f97316] font-semibold capitalize">{activeTab}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-neutral-400 bg-[#14151b] px-2.5 py-0.5 rounded border border-[#23252e]">
            Node: {server.location || 'DE-04'}
          </span>
          {server.isSubuser && (
            <span className="font-mono text-[10px] text-[#f97316] bg-[#f97316]/10 px-2.5 py-0.5 rounded border border-[#f97316]/30">
              Shared Access
            </span>
          )}
        </div>
      </div>

      {/* 2. Server Title, Specs & Power Buttons (Orihost image_00688f85.png) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Icon, Server Name & Real Specs */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border border-[#23252e] bg-[#14151b] text-[#f97316] shadow-sm">
            {isMinecraft ? <Box className="h-5 w-5" /> : isPython ? <FileText className="h-5 w-5" /> : <TerminalIcon className="h-5 w-5" />}
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight break-words">
                {server.name}
              </h1>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold border ${
                  server.status === 'running'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : server.status === 'starting' || server.status === 'stopping'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    server.status === 'running'
                      ? 'bg-emerald-400 animate-pulse'
                      : server.status === 'starting' || server.status === 'stopping'
                      ? 'bg-amber-400 animate-spin'
                      : 'bg-neutral-500'
                  }`}
                />
                <span className="uppercase tracking-wider font-mono">{server.status}</span>
              </span>

              {/* Address with 1-click Copy */}
              <div
                onClick={() => onCopy(fullIp)}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#14151b] border border-[#23252e] text-xs font-mono text-neutral-300 hover:text-white hover:border-[#f97316] transition-colors cursor-pointer group"
                title="Click to copy address"
              >
                <span>{fullIp}</span>
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-neutral-400 group-hover:text-white" />}
              </div>

              {/* Location Tag */}
              <span className="text-[10px] font-mono text-neutral-400 flex items-center gap-1">
                <span>/</span>
                <span>{server.location || 'DE-04'}</span>
              </span>
            </div>

            {/* Subtitle Specs */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400 font-mono">
              <span className="text-neutral-300 font-medium">
                {server.software} ({server.version || 'Latest'})
              </span>
              <span>·</span>
              <span>{formatMemory(server.resources?.memoryMb || server.limits?.ramMB || 512)} RAM</span>
              <span>·</span>
              <span>{server.limits?.cpuCores || 1} CPU</span>
              <span>·</span>
              <span>{server.limits?.diskGB || 10} GB Disk</span>
            </div>
          </div>
        </div>

        {/* Right: Power Controls */}
        <div className="flex items-center gap-2">
          {!isRunning && server.status !== 'starting' ? (
            <button
              type="button"
              disabled={powerLoadingAction !== null || !canStart}
              onClick={() => onPowerAction('start')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {powerLoadingAction === 'start' ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              <span>Start</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={powerLoadingAction !== null || !canRestart}
                onClick={() => onPowerAction('restart')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#14151b] border border-[#23252e] hover:border-amber-500/50 text-amber-400 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#14151b] border border-[#23252e] hover:border-red-500/50 text-red-400 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {powerLoadingAction === 'stop' ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Square className="h-3.5 w-3.5 fill-current" />
                )}
                <span>Stop</span>
              </button>

              {canKill && (
                <button
                  type="button"
                  disabled={powerLoadingAction !== null}
                  onClick={() => onPowerAction('kill')}
                  className="p-2 rounded-lg bg-[#14151b] border border-[#23252e] hover:bg-red-950/40 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                  title="Force Kill (SIGKILL)"
                >
                  <Skull className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Horizontal Sub-Navigation Tabs Row */}
      <div className="flex items-center justify-between border-t border-[#23252e]/80 pt-2 relative overflow-visible gap-2">
        {/* Scrollable Main Tabs Row */}
        <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-1 sm:gap-2 py-0.5">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabSelect && onTabSelect(tab.id)}
                className={`relative flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-white bg-[#181922] border-b-2 border-[#f97316]'
                    : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#f97316]' : 'text-neutral-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#23252e] text-neutral-300">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* More Dropdown (Outside Scroll Container - Never Clipped) */}
        <div className="shrink-0 relative">
          <button
            onClick={() => setMoreDropdownOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap border border-transparent ${
              isMoreTabActive
                ? 'text-white bg-[#181922] border-b-2 border-[#f97316]'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b] hover:border-[#23252e]'
            }`}
          >
            <span>More</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {moreDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMoreDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[#14151b] border border-[#23252e] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#23252e]/60 mb-1">
                  Additional Tools
                </div>
                {moreTabs.map((mt) => (
                  <button
                    key={mt.id}
                    onClick={() => {
                      if (onTabSelect) onTabSelect(mt.id);
                      setMoreDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      activeTab === mt.id
                        ? 'bg-[#181922] text-[#f97316] font-bold'
                        : 'text-neutral-300 hover:text-white hover:bg-[#1c1e28]'
                    }`}
                  >
                    <span>{mt.label}</span>
                    {activeTab === mt.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#f97316]" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Top 2 Promo Banners on Every Server Tab (Orihost image_00688f85.png) */}
      <div className="space-y-2 pt-1">
      </div>
    </div>
  );
};
