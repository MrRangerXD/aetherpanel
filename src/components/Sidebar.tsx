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
    <aside id="aether-sidebar" className="hidden lg:flex w-64 flex-none border-r border-white/5 bg-zinc-950/40 backdrop-blur-md flex-col h-full select-none z-20">
      {/* Brand Header / Server Quick Switcher (Pinned Top) */}
      <div className="p-4 border-b border-white/5 shrink-0">
        <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500 mb-2.5">
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
              className="w-full appearance-none rounded-xl bg-zinc-950/60 border border-white/5 px-3 py-2.5 text-xs text-zinc-200 font-medium focus:outline-none focus:border-zinc-500 pr-8 shadow-inner transition-colors cursor-pointer"
            >
              <option value="overview" className="bg-zinc-950 text-white">All Servers ({userServers.length})</option>
              <optgroup label="Your Servers" className="bg-zinc-950 text-zinc-400">
                {userServers.map((s) => (
                  <option key={s.id} value={s.id} className="bg-zinc-950 text-white">
                    {s.name} ({s.software})
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="absolute right-3 top-3.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950/30 border border-white/5 text-[11px] text-zinc-400">
            <Cpu className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>No active servers yet</span>
          </div>
        )}
      </div>

      {/* Primary Navigation (Independently Scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${currentPage === 'dashboard' ? 'bg-white/[0.06] text-white shadow-inner border border-white/5' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'}`}
        >
          <LayoutDashboard className={`h-4 w-4 ${currentPage === 'dashboard' ? accentClasses.text : ''}`} />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate('servers')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${currentPage === 'servers' ? 'bg-white/[0.06] text-white shadow-inner border border-white/5' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'}`}
        >
          <div className="flex items-center gap-3">
            <Server className={`h-4 w-4 ${currentPage === 'servers' ? accentClasses.text : ''}`} />
            <span>My Servers</span>
          </div>
          {userServers.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 font-mono border border-white/5">
              {userServers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => onNavigate('deploy')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 text-white bg-gradient-to-r ${accentClasses.gradient} hover:brightness-110 shadow-lg shadow-black/30 my-3.5 cursor-pointer`}
        >
          <PlusCircle className="h-4 w-4" />
          <span>Deploy Server</span>
        </button>

        <div className="pt-3 pb-1 text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-500 px-3">
          Management
        </div>

        <button
          onClick={() => onNavigate('billing')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${currentPage === 'billing' ? 'bg-white/[0.06] text-white shadow-inner border border-white/5' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'}`}
        >
          <div className="flex items-center gap-3">
            <CreditCard className={`h-4 w-4 ${currentPage === 'billing' ? accentClasses.text : ''}`} />
            <span>Billing & Credits</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 font-bold">
            ${user?.credits?.toFixed(2) || '0.00'}
          </span>
        </button>

        <button
          onClick={() => onNavigate('afk-rewards')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${currentPage === 'afk-rewards' ? 'bg-white/[0.06] text-white shadow-inner border border-white/5' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'}`}
        >
          <div className="flex items-center gap-3">
            <Coins className={`h-4 w-4 ${currentPage === 'afk-rewards' ? accentClasses.text : 'text-amber-500'}`} />
            <span>AFK Rewards</span>
          </div>
          <span className="text-[9px] font-mono font-bold tracking-wider text-amber-500">
            EARN
          </span>
        </button>

        <button
          onClick={() => onNavigate('support')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${currentPage === 'support' ? 'bg-white/[0.06] text-white shadow-inner border border-white/5' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'}`}
        >
          <LifeBuoy className={`h-4 w-4 ${currentPage === 'support' ? accentClasses.text : ''}`} />
          <span>Support Tickets</span>
        </button>

        <button
          onClick={() => onNavigate('activity')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${currentPage === 'activity' ? 'bg-white/[0.06] text-white shadow-inner border border-white/5' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'}`}
        >
          <Activity className={`h-4 w-4 ${currentPage === 'activity' ? accentClasses.text : ''}`} />
          <span>Activity Log</span>
        </button>

        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${currentPage === 'settings' ? 'bg-white/[0.06] text-white shadow-inner border border-white/5' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'}`}
        >
          <Settings className={`h-4 w-4 ${currentPage === 'settings' ? accentClasses.text : ''}`} />
          <span>Settings</span>
        </button>
      </div>

      {/* User Footer & Theme Controls (Pinned Bottom) */}
      <div className="p-3 border-t border-white/5 space-y-3 shrink-0 bg-zinc-950/20">
        {/* Accent Selector */}
        <div className="flex items-center justify-between px-2 text-[10px] font-mono font-semibold text-zinc-500">
          <span>ACCENT THEME</span>
          <div className="flex items-center gap-2">
            {(['violet', 'cyan', 'emerald', 'amber', 'rose'] as const).map((color) => (
              <button
                key={color}
                onClick={() => setAccent(color)}
                className={`h-3 w-3 rounded-full border border-white/10 transition-all duration-300 ${accent === color ? 'scale-125 ring-2 ring-white/40 shadow-md shadow-white/10' : 'opacity-60 hover:opacity-100 hover:scale-110'} ${
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
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={user?.avatarUrl || 'https://api.dicebear.com/7.x/identicon/svg?seed=user'}
              alt="Avatar"
              className="h-7 w-7 rounded-lg object-cover bg-zinc-900 border border-white/5 shadow-inner"
            />
            <div className="truncate">
              <div className="text-xs font-bold text-zinc-200 truncate leading-none mb-1">
                {user?.displayName || user?.username || 'User'}
              </div>
              <div className="text-[9px] text-zinc-400 font-medium capitalize flex items-center gap-1 leading-none">
                {user?.role === 'super_admin' ? (
                  <span className="text-amber-500 font-bold flex items-center gap-0.5">
                    <ShieldCheck className="h-2.5 w-2.5" /> Admin
                  </span>
                ) : user?.role === 'admin' ? (
                  <span className="text-amber-500 font-semibold">Staff</span>
                ) : (
                  <span>Customer</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign Out"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
