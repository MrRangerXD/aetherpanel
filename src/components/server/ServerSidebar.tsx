import React from 'react';
import {
  Terminal as TerminalIcon, Folder, Database, Clock, Shield,
  HardDrive, Globe, Settings as SettingsIcon, Activity, Box,
  Sliders, Key, FolderInput, MessageSquare, FileText, ArrowLeft
} from 'lucide-react';
import { Server } from '../../types';

interface ServerSidebarProps {
  server: Server;
  activeTab: string;
  onTabSelect: (tab: any) => void;
  hasPerm: (perm: string) => boolean;
  canManageSubusers: boolean;
  isMinecraft: boolean;
  isBot: boolean;
  isPython: boolean;
  databasesCount: number;
  schedulesCount: number;
  backupsCount: number;
  onNavigate: (page: string, params?: any) => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  server,
  activeTab,
  onTabSelect,
  hasPerm,
  canManageSubusers,
  isMinecraft,
  isBot,
  isPython,
  databasesCount,
  schedulesCount,
  backupsCount,
  onNavigate
}) => {
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] h-full overflow-y-auto z-20 select-none">
      {/* Top Back to Servers & Server ID Badge */}
      <div className="p-3 border-b border-[var(--color-line)] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          <span>Servers</span>
        </button>
        <span className="font-mono text-[10px] text-[var(--color-ink-mute)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded border border-[var(--color-line)]">
          ID: {server.id.substring(0, 8)}
        </span>
      </div>

      {/* Server Identity Card */}
      <div className="p-3 border-b border-[var(--color-line)] bg-[var(--color-surface-2)]/30 flex items-center gap-2.5 shrink-0">
        <div className="h-8 w-8 rounded flex items-center justify-center shrink-0 border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-accent)]">
          {isMinecraft ? <Box className="h-4 w-4" /> : isPython ? <FileText className="h-4 w-4" /> : <TerminalIcon className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[var(--color-ink)] truncate" title={server.name}>
            {server.name}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-ink-mute)]">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                server.status === 'running'
                  ? 'bg-[var(--color-ok)]'
                  : server.status === 'starting' || server.status === 'stopping'
                  ? 'bg-[var(--color-warn)]'
                  : 'bg-[var(--color-ink-mute)]'
              }`}
            />
            <span className="uppercase font-mono">{server.status}</span>
          </div>
        </div>
      </div>

      {/* Navigation Categories */}
      <div className="p-2 space-y-0.5 flex-1 overflow-y-auto">
        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-mute)]">
          Management
        </div>

        {hasPerm('console.view') && (
          <button
            onClick={() => onTabSelect('console')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'console'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <TerminalIcon className={`h-3.5 w-3.5 ${activeTab === 'console' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Console</span>
            </div>
          </button>
        )}

        {hasPerm('files.view') && (
          <button
            onClick={() => onTabSelect('files')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'files'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Folder className={`h-3.5 w-3.5 ${activeTab === 'files' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>File Manager</span>
            </div>
          </button>
        )}

        {hasPerm('databases.view') && (
          <button
            onClick={() => onTabSelect('databases')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'databases'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Database className={`h-3.5 w-3.5 ${activeTab === 'databases' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Databases</span>
            </div>
            {databasesCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-surface-3)] text-[var(--color-ink-dim)] border border-[var(--color-line)]">
                {databasesCount}
              </span>
            )}
          </button>
        )}

        {hasPerm('schedules.view') && (
          <button
            onClick={() => onTabSelect('schedules')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'schedules'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className={`h-3.5 w-3.5 ${activeTab === 'schedules' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Schedules</span>
            </div>
            {schedulesCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-surface-3)] text-[var(--color-ink-dim)] border border-[var(--color-line)]">
                {schedulesCount}
              </span>
            )}
          </button>
        )}

        {canManageSubusers && (
          <button
            onClick={() => onTabSelect('subusers')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'subusers'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Shield className={`h-3.5 w-3.5 ${activeTab === 'subusers' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Users</span>
            </div>
          </button>
        )}

        {hasPerm('backups.view') && (
          <button
            onClick={() => onTabSelect('backups')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'backups'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <HardDrive className={`h-3.5 w-3.5 ${activeTab === 'backups' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Backups</span>
            </div>
            {backupsCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-surface-3)] text-[var(--color-ink-dim)] border border-[var(--color-line)]">
                {backupsCount}
              </span>
            )}
          </button>
        )}

        {hasPerm('files.view') && (
          <button
            onClick={() => onTabSelect('network')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'network'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Globe className={`h-3.5 w-3.5 ${activeTab === 'network' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Network</span>
            </div>
          </button>
        )}

        <div className="px-2.5 pt-4 pb-1 text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-mute)]">
          Configuration
        </div>

        {hasPerm('startup.update') && (
          <button
            onClick={() => onTabSelect('settings')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <SettingsIcon className={`h-3.5 w-3.5 ${activeTab === 'settings' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Startup & Settings</span>
            </div>
          </button>
        )}

        {(hasPerm('console.view') || hasPerm('monitoring.view')) && (
          <button
            onClick={() => onTabSelect('monitoring')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'monitoring'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Activity className={`h-3.5 w-3.5 ${activeTab === 'monitoring' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Monitoring</span>
            </div>
          </button>
        )}

        {isMinecraft && hasPerm('plugins.view') && (
          <button
            onClick={() => onTabSelect('plugins')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'plugins'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Box className={`h-3.5 w-3.5 ${activeTab === 'plugins' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Plugins</span>
            </div>
          </button>
        )}

        {isMinecraft && hasPerm('startup.update') && (
          <button
            onClick={() => onTabSelect('properties')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'properties'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sliders className={`h-3.5 w-3.5 ${activeTab === 'properties' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Properties</span>
            </div>
          </button>
        )}

        {isBot && hasPerm('startup.update') && (
          <button
            onClick={() => onTabSelect('env')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'env'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Key className={`h-3.5 w-3.5 ${activeTab === 'env' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>.env Config</span>
            </div>
          </button>
        )}

        {hasPerm('files.create') && (
          <button
            onClick={() => onTabSelect('importer')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'importer'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderInput className={`h-3.5 w-3.5 ${activeTab === 'importer' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Importer</span>
            </div>
          </button>
        )}

        {hasPerm('discord.manage') && (
          <button
            onClick={() => onTabSelect('discord')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'discord'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className={`h-3.5 w-3.5 ${activeTab === 'discord' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Discord</span>
            </div>
          </button>
        )}

        {hasPerm('activity.view') && (
          <button
            onClick={() => onTabSelect('activity')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5'
                : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText className={`h-3.5 w-3.5 ${activeTab === 'activity' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Audit Log</span>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
};
