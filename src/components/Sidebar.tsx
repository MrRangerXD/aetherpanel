import React from 'react';
import {
  LayoutDashboard, Server, PlusCircle, CreditCard, LifeBuoy,
  Activity, Settings, LogOut, ShieldCheck, ChevronDown, Cpu, Sparkles, Coins
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';

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
  const { accentClasses, accent, setAccent } = useTheme();

  return (
    <aside className="hidden md:flex w-64 shrink-0 border-r border-zinc-800/80 bg-zinc-950 flex-col justify-between min-h-[calc(100vh-4rem)]">
      <div>
        {/* Brand Header / Server Quick Switcher */}
        <div className="p-4 border-b border-zinc-800/80">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Active Workspace
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
                className="w-full appearance-none rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-amber-500 pr-8"
              >
                <option value="overview">All Servers ({userServers.length})</option>
                <optgroup label="Your Servers">
                  {userServers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.software})
                    </option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400">
              <Cpu className="h-4 w-4 text-amber-400 shrink-0" />
              <span>No active servers yet</span>
            </div>
          )}
        </div>

        {/* Primary Navigation */}
        <div className="p-3 space-y-1">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'dashboard' ? 'bg-zinc-800/80 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <LayoutDashboard className={`h-4 w-4 ${currentPage === 'dashboard' ? accentClasses.text : ''}`} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => onNavigate('servers')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'servers' ? 'bg-zinc-800/80 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <div className="flex items-center gap-3">
              <Server className={`h-4 w-4 ${currentPage === 'servers' ? accentClasses.text : ''}`} />
              <span>My Servers</span>
            </div>
            {userServers.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                {userServers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('deploy')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md my-2`}
          >
            <PlusCircle className="h-4 w-4" />
            <span>Deploy Server</span>
          </button>

          <div className="pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 px-3">
            Account Management
          </div>

          <button
            onClick={() => onNavigate('billing')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'billing' ? 'bg-zinc-800/80 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <div className="flex items-center gap-3">
              <CreditCard className={`h-4 w-4 ${currentPage === 'billing' ? accentClasses.text : ''}`} />
              <span>Billing & Credits</span>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              ${user?.credits?.toFixed(2) || '0.00'}
            </span>
          </button>

          <button
            onClick={() => onNavigate('afk-rewards')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'afk-rewards' ? 'bg-zinc-800/80 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <div className="flex items-center gap-3">
              <Coins className={`h-4 w-4 ${currentPage === 'afk-rewards' ? accentClasses.text : 'text-amber-400'}`} />
              <span>AFK Rewards</span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              EARN
            </span>
          </button>

          <button
            onClick={() => onNavigate('support')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'support' ? 'bg-zinc-800/80 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <LifeBuoy className={`h-4 w-4 ${currentPage === 'support' ? accentClasses.text : ''}`} />
            <span>Support Tickets</span>
          </button>

          <button
            onClick={() => onNavigate('activity')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'activity' ? 'bg-zinc-800/80 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Activity className={`h-4 w-4 ${currentPage === 'activity' ? accentClasses.text : ''}`} />
            <span>Activity Log</span>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'settings' ? 'bg-zinc-800/80 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Settings className={`h-4 w-4 ${currentPage === 'settings' ? accentClasses.text : ''}`} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* User Footer & Theme Controls */}
      <div className="p-3 border-t border-zinc-800/80 space-y-3">
        {/* Accent Selector */}
        <div className="flex items-center justify-between px-2 text-xs text-zinc-400">
          <span>Accent Theme</span>
          <div className="flex items-center gap-1.5">
            {(['violet', 'cyan', 'emerald', 'amber', 'rose'] as const).map((color) => (
              <button
                key={color}
                onClick={() => setAccent(color)}
                className={`h-3.5 w-3.5 rounded-full border border-white/20 transition-transform ${accent === color ? 'scale-125 ring-2 ring-white/50' : 'opacity-70 hover:opacity-100'} ${
                  color === 'violet' ? 'bg-violet-500' :
                  color === 'cyan' ? 'bg-cyan-500' :
                  color === 'emerald' ? 'bg-emerald-500' :
                  color === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
                }`}
              />
            ))}
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800/80">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={user?.avatarUrl || 'https://api.dicebear.com/7.x/identicon/svg?seed=user'}
              alt="Avatar"
              className="h-8 w-8 rounded-lg object-cover bg-zinc-800"
            />
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">
                {user?.displayName || user?.username || 'User'}
              </div>
              <div className="text-[10px] text-zinc-400 capitalize flex items-center gap-1">
                {user?.role === 'super_admin' ? (
                  <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                    <ShieldCheck className="h-3 w-3" /> Super Admin
                  </span>
                ) : user?.role === 'admin' ? (
                  <span className="text-amber-400 font-semibold">Administrator</span>
                ) : (
                  <span>Customer</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign Out"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
