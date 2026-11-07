import React from 'react';
import {
  LayoutDashboard, Server, Plus, CreditCard, LifeBuoy, Settings, LogOut,
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
      className="hidden lg:flex w-64 flex-none border-r border-[#181920] bg-[#09090b] flex-col h-full select-none z-20"
    >
      {/* Main Navigation Sections */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-5">
        {/* SECTION: SERVERS */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold mb-1">
            SERVERS
          </div>

          <button
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center justify-between px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
              isDashboardActive
                ? 'bg-[#181920] text-white font-semibold shadow-sm'
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
                ? 'bg-[#181920] text-white font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {/* Server rack icon */}
              <div className="flex flex-col gap-0.5 text-[#f97316]">
                <div className="w-3.5 h-1.5 rounded-[2px] border border-[#f97316] flex items-center justify-end px-0.5">
                  <span className="w-0.5 h-0.5 rounded-full bg-[#f97316]" />
                </div>
                <div className="w-3.5 h-1.5 rounded-[2px] border border-[#f97316] flex items-center justify-end px-0.5">
                  <span className="w-0.5 h-0.5 rounded-full bg-[#f97316]" />
                </div>
              </div>
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
            className={`w-full flex items-center gap-2 px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer group ${
              currentPage === 'deploy'
                ? 'bg-[#181920] text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
            }`}
          >
            <Plus className="h-4 w-4 text-neutral-400 group-hover:text-white transition-colors" />
            <span>Create server</span>
          </button>
        </div>

        {/* SECTION: ACCOUNT */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold mb-1">
            ACCOUNT
          </div>

          <button
            onClick={() => onNavigate('settings')}
            className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
              isAccountActive
                ? 'bg-[#181920] text-white font-semibold shadow-sm'
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
                ? 'bg-[#181920] text-white font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Star className="h-4 w-4 text-neutral-400 group-hover:text-amber-400 transition-colors" />
              <span>Premium</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('support')}
            className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
              currentPage === 'support'
                ? 'bg-[#181920] text-white font-semibold shadow-sm'
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
                ? 'bg-[#181920] text-white font-semibold shadow-sm'
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

        {/* Promo Card: "Need more power?" (Matching Orihost screenshot image_ba8ad95e.png) */}
        <div className="p-3.5 rounded-xl bg-[#12131a] border border-[#23252e] space-y-1.5 relative overflow-hidden group">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Zap className="h-3.5 w-3.5 text-[#f97316] fill-[#f97316]" />
            <span>Need more power?</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Dedicated 24/7 plans on our premium nodes.
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

      {/* User Profile Pill at Bottom (Matching Orihost image_ba8ad95e.png) */}
      <div className="p-3 border-t border-[#181920] shrink-0 bg-[#09090b] space-y-3">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#12131a] border border-[#1f212b]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#f97316] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm relative overflow-hidden">
              <span className="text-white font-extrabold text-xs">
                {((user?.displayName || user?.username || 'k')[0]).toLowerCase()}
              </span>
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-white truncate leading-tight">
                {user?.displayName || user?.username || 'kravenog'}
              </div>
              <div className="text-[10px] text-neutral-400 truncate leading-none mt-0.5 font-mono">
                {user?.email || 'kravenog@gmail.com'}
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign Out"
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0 rounded-lg hover:bg-neutral-800"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* 5 Social SVG Icons Row (Discord, YouTube, Instagram, Facebook, TikTok) */}
        <div className="flex items-center justify-between px-3 text-neutral-500">
          {/* Discord */}
          <a
            href="https://discord.gg"
            target="_blank"
            rel="noreferrer"
            title="Discord"
            className="hover:text-[#5865F2] transition-colors p-1"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </a>

          {/* YouTube */}
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noreferrer"
            title="YouTube"
            className="hover:text-[#FF0000] transition-colors p-1"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>

          {/* Instagram */}
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
            title="Instagram"
            className="hover:text-[#E4405F] transition-colors p-1"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </a>

          {/* Facebook */}
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noreferrer"
            title="Facebook"
            className="hover:text-[#1877F2] transition-colors p-1"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>

          {/* TikTok */}
          <a
            href="https://tiktok.com"
            target="_blank"
            rel="noreferrer"
            title="TikTok"
            className="hover:text-white transition-colors p-1"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.46 2.72 1.11-.06 2.14-.68 2.68-1.63.3-.5.44-1.08.45-1.65.04-3.53.01-7.06.02-10.59z" />
            </svg>
          </a>
        </div>
      </div>
    </aside>
  );
};

