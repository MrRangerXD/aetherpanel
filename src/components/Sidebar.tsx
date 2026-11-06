import React from 'react';
import {
  LayoutDashboard, Server, PlusCircle, CreditCard, LifeBuoy, Settings, LogOut,
  ShieldCheck, Coins, Key, Activity, Zap, ExternalLink, User, Star
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useBranding } from '../lib/BrandingContext';

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
  const { brandName } = useBranding();

  const isDashboardActive = currentPage === 'dashboard';
  const isServerActive = currentPage === 'servers' || currentPage === 'server-manage';
  const isAccountActive = currentPage === 'settings' || currentPage === 'api-keys';

  return (
    <aside
      id="aether-sidebar"
      className="hidden lg:flex w-64 flex-none border-r border-[#181922] bg-[#09090b] flex-col h-full select-none z-20"
    >
      {/* Main Navigation Sections */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-5">
        {/* SECTION: SERVERS */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold mb-1">
            Servers
          </div>

          <button
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center justify-between px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
              isDashboardActive
                ? 'bg-[#181922] text-white border-l-2 border-[#f97316] pl-2.5 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className={`h-4 w-4 ${isDashboardActive ? 'text-[#f97316]' : 'text-neutral-400'}`} />
              <span>Dashboard</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('servers')}
            className={`w-full flex items-center justify-between px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
              isServerActive
                ? 'bg-[#181922] text-white border-l-2 border-[#f97316] pl-2.5 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Server className={`h-4 w-4 ${isServerActive ? 'text-[#f97316]' : 'text-neutral-400'}`} />
              <span>My servers</span>
            </div>
            {userServers.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#23252e] text-neutral-300 font-mono">
                {userServers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('deploy')}
            className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
              currentPage === 'deploy'
                ? 'bg-[#181922] text-white border-l-2 border-[#f97316] pl-2.5 font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
            }`}
          >
            <PlusCircle className="h-4 w-4 text-[#f97316]" />
            <span className="text-[#f97316] font-medium">Create server</span>
          </button>
        </div>

        {/* SECTION: ACCOUNT & SERVICES */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold mb-1">
            Account
          </div>

          <button
            onClick={() => onNavigate('settings')}
            className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
              isAccountActive
                ? 'bg-[#181922] text-white border-l-2 border-[#f97316] pl-2.5 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
            }`}
          >
            <User className={`h-4 w-4 ${isAccountActive ? 'text-[#f97316]' : 'text-neutral-400'}`} />
            <span>Account</span>
          </button>

          <button
            onClick={() => onNavigate('billing')}
            className={`w-full flex items-center justify-between px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer group ${
              currentPage === 'billing'
                ? 'bg-[#181922] text-white border-l-2 border-[#f97316] pl-2.5 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400/20 group-hover:fill-amber-400 transition-colors" />
              <span className="text-amber-300 font-medium group-hover:text-amber-200">Premium</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
              VIP
            </span>
          </button>

          <button
            onClick={() => onNavigate('support')}
            className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
              currentPage === 'support'
                ? 'bg-[#181922] text-white border-l-2 border-[#f97316] pl-2.5 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
            }`}
          >
            <LifeBuoy className={`h-4 w-4 ${currentPage === 'support' ? 'text-[#f97316]' : 'text-neutral-400'}`} />
            <span>Support</span>
          </button>

          <button
            onClick={() => onNavigate('afk-rewards')}
            className={`w-full flex items-center justify-between px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
              currentPage === 'afk-rewards'
                ? 'bg-[#181922] text-white border-l-2 border-[#f97316] pl-2.5 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Coins className={`h-4 w-4 ${currentPage === 'afk-rewards' ? 'text-[#f97316]' : 'text-neutral-400'}`} />
              <span>AFK Rewards</span>
            </div>
            <span className="text-[9px] font-mono text-[#f97316] font-semibold bg-[#f97316]/10 px-1.5 py-0.5 rounded">
              FREE
            </span>
          </button>
        </div>

        {/* Promo Card: "Need more power?" (Matching Orihost screenshot image_621d190d.png) */}
        <div className="p-3.5 rounded-xl bg-gradient-to-b from-[#181922] to-[#12131a] border border-[#23252e] space-y-2 relative overflow-hidden group">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Zap className="h-3.5 w-3.5 text-[#f97316] fill-current" />
            <span>Need more power?</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Dedicated 24/7 plans on our high-performance Ryzen & EPYC nodes.
          </p>
          <button
            onClick={() => onNavigate('billing')}
            className="text-[11px] font-semibold text-[#f97316] hover:text-[#fb923c] flex items-center gap-1 transition-colors pt-1 cursor-pointer"
          >
            <span>View plans</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>

      {/* User Profile Pill at Bottom (Matching Orihost) */}
      <div className="p-3 border-t border-[#181922] shrink-0 bg-[#09090b]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#12131a] border border-[#1f212b]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#f97316] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              {((user?.displayName || user?.username || 'U')[0]).toUpperCase()}
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-white truncate leading-tight">
                {user?.displayName || user?.username || 'kravenog'}
              </div>
              <div className="text-[10px] text-neutral-500 truncate leading-none mt-0.5">
                {user?.email || 'user@example.com'}
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign Out"
            className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer shrink-0 rounded-lg hover:bg-neutral-800"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Tiny Social Icons Row */}
        <div className="flex items-center justify-center gap-4 mt-2.5 text-neutral-500 text-[11px]">
          <a
            href="https://discord.gg"
            target="_blank"
            rel="noreferrer"
            className="hover:text-indigo-400 transition-colors"
            title="Discord"
          >
            Discord
          </a>
          <span>•</span>
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-red-400 transition-colors"
            title="YouTube"
          >
            YouTube
          </a>
          <span>•</span>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-sky-400 transition-colors"
            title="Twitter"
          >
            Twitter
          </a>
        </div>
      </div>
    </aside>
  );
};
