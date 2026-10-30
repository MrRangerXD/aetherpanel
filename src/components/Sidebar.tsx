import React from 'react';
import {
  LayoutDashboard, Server, PlusCircle, CreditCard, LifeBuoy,
  Activity, Settings, LogOut, ShieldCheck, ChevronDown, Cpu, Coins
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string, params?: any) => void;
  userServers?: any[];
  currentServerId?: string;
  onSelectServer?: (serverId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  userServers = [],
  currentServerId,
  onSelectServer
}) => {
  const { user, logout } = useAuth();

  return (
    <aside
      id="aether-sidebar"
      className="hidden lg:flex w-60 flex-none border-r border-[var(--color-line)] bg-[var(--color-surface)] flex-col h-full select-none z-20"
    >
      {/* Active Workspace / Server Switcher */}
      <div className="p-3 border-b border-[var(--color-line)] shrink-0">
        <div className="label mb-2">
          Workspace
        </div>

        {userServers.length > 0 ? (
          <div className="relative">
            <select
              value={currentServerId || 'overview'}
              onChange={(e) => {
                if (e.target.value === 'overview') {
                  onNavigate('dashboard');
                } else if (onSelectServer) {
                  onSelectServer(e.target.value);
                }
              }}
              className="w-full appearance-none rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink)] font-medium focus:outline-none focus:border-[var(--color-accent)] pr-7 transition-colors cursor-pointer"
            >
              <option value="overview" className="bg-[var(--color-surface)] text-[var(--color-ink)]">
                All Servers ({userServers.length})
              </option>
              <optgroup label="Your Servers" className="bg-[var(--color-surface)] text-[var(--color-ink-mute)]">
                {userServers.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[var(--color-surface)] text-[var(--color-ink)]">
                    {s.name} ({s.software})
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-ink-mute)] pointer-events-none" />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[11px] text-[var(--color-ink-mute)]">
            <Cpu className="h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" />
            <span>No active servers</span>
          </div>
        )}
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
            currentPage === 'dashboard'
              ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)]'
              : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
          }`}
        >
          <LayoutDashboard className={`h-3.5 w-3.5 ${currentPage === 'dashboard' ? 'text-[var(--color-accent)]' : ''}`} />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate('servers')}
          className={`w-full flex items-center justify-between px-3 h-8 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
            currentPage === 'servers'
              ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)]'
              : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Server className={`h-3.5 w-3.5 ${currentPage === 'servers' ? 'text-[var(--color-accent)]' : ''}`} />
            <span>My Servers</span>
          </div>
          {userServers.length > 0 && (
            <span className="text-[10px] px-1 py-0.2 rounded bg-[var(--color-surface-3)] text-[var(--color-ink-dim)] font-mono border border-[var(--color-line)]">
              {userServers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => onNavigate('deploy')}
          className="w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-xs font-medium text-white bg-[var(--color-accent)] hover:bg-[#3d6ae8] transition-colors my-2 cursor-pointer"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>Deploy Server</span>
        </button>

        <div className="pt-3 pb-1 label px-3">
          Management
        </div>

        <button
          onClick={() => onNavigate('billing')}
          className={`w-full flex items-center justify-between px-3 h-8 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
            currentPage === 'billing'
              ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)]'
              : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CreditCard className={`h-3.5 w-3.5 ${currentPage === 'billing' ? 'text-[var(--color-accent)]' : ''}`} />
            <span>Billing</span>
          </div>
          <span className="text-[11px] font-mono text-[var(--color-ok)] font-medium">
            ${user?.credits?.toFixed(2) || '0.00'}
          </span>
        </button>

        <button
          onClick={() => onNavigate('afk-rewards')}
          className={`w-full flex items-center justify-between px-3 h-8 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
            currentPage === 'afk-rewards'
              ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)]'
              : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Coins className={`h-3.5 w-3.5 ${currentPage === 'afk-rewards' ? 'text-[var(--color-accent)]' : ''}`} />
            <span>AFK Rewards</span>
          </div>
          <span className="text-[9px] font-mono text-[var(--color-accent)]">
            EARN
          </span>
        </button>

        <button
          onClick={() => onNavigate('support')}
          className={`w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
            currentPage === 'support'
              ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)]'
              : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
          }`}
        >
          <LifeBuoy className={`h-3.5 w-3.5 ${currentPage === 'support' ? 'text-[var(--color-accent)]' : ''}`} />
          <span>Support Tickets</span>
        </button>

        <button
          onClick={() => onNavigate('activity')}
          className={`w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
            currentPage === 'activity'
              ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)]'
              : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
          }`}
        >
          <Activity className={`h-3.5 w-3.5 ${currentPage === 'activity' ? 'text-[var(--color-accent)]' : ''}`} />
          <span>Activity Log</span>
        </button>

        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
            currentPage === 'settings'
              ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)]'
              : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
          }`}
        >
          <Settings className={`h-3.5 w-3.5 ${currentPage === 'settings' ? 'text-[var(--color-accent)]' : ''}`} />
          <span>Settings</span>
        </button>
      </div>

      {/* User Footer (Pinned Bottom) */}
      <div className="p-2.5 border-t border-[var(--color-line)] shrink-0 bg-[var(--color-surface)]">
        <div className="flex items-center justify-between p-2 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)]">
          <div className="flex items-center gap-2 overflow-hidden">
            <img
              src={user?.avatarUrl || 'https://api.dicebear.com/7.x/identicon/svg?seed=user'}
              alt="Avatar"
              className="h-6 w-6 rounded-md object-cover bg-zinc-800 shrink-0"
            />
            <div className="truncate">
              <div className="text-xs font-semibold text-[var(--color-ink)] truncate leading-tight">
                {user?.displayName || user?.username || 'User'}
              </div>
              <div className="text-[10px] text-[var(--color-ink-mute)] flex items-center gap-1 leading-none mt-0.5">
                {user?.role === 'super_admin' ? (
                  <span className="text-[var(--color-accent)] font-medium flex items-center gap-0.5">
                    <ShieldCheck className="h-2.5 w-2.5" /> Superadmin
                  </span>
                ) : user?.role === 'admin' ? (
                  <span className="text-[var(--color-accent)] font-medium">Admin</span>
                ) : (
                  <span>Customer</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign Out"
            className="p-1 text-[var(--color-ink-mute)] hover:text-[var(--color-err)] transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
