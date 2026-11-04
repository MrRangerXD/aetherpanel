import React from 'react';
import {
  Sliders, Users, Server, HardDrive, Package, Layers, Activity,
  ShieldAlert, Archive, ShoppingBag, Tag, Megaphone, Sparkles,
  Coins, MessageSquare, Palette, LifeBuoy, FileText, FolderInput,
  Key, Scale, ArrowLeft, LogOut, UserPlus, PlusCircle
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface AdminSidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentPage, onNavigate }) => {
  const { user, logout } = useAuth();

  const adminCoreItems = [
    { page: 'admin-dashboard', label: 'Overview', icon: Sliders },
    { page: 'admin-users', label: 'Users', icon: Users },
    { page: 'admin-nodes', label: 'Nodes', icon: HardDrive },
    { page: 'admin-servers', label: 'Servers', icon: Server },
    { page: 'admin-settings', label: 'Panel Settings', icon: Sliders },
  ];

  const secondaryItems = [
    { page: 'admin-products', label: 'Products & Plans', icon: Package },
    { page: 'admin-server-types', label: 'Server Types', icon: Layers },
    { page: 'admin-monitoring', label: 'Monitoring', icon: Activity },
    { page: 'admin-diagnostics', label: 'Diagnostics', icon: ShieldAlert },
    { page: 'admin-backups', label: 'Backups', icon: Archive },
    { page: 'admin-billing', label: 'Billing', icon: ShoppingBag },
    { page: 'admin-coupons', label: 'Coupons', icon: Tag },
    { page: 'admin-announcements', label: 'Announcements', icon: Megaphone },
    { page: 'admin-ads', label: 'Ad Campaigns', icon: Sparkles },
    { page: 'admin-rewards', label: 'AFK Rewards', icon: Coins },
    { page: 'admin-discord', label: 'Discord Bot', icon: MessageSquare },
    { page: 'admin-panel-customization', label: 'Appearance', icon: Palette },
    { page: 'admin-support', label: 'Support Queue', icon: LifeBuoy },
    { page: 'admin-audit-logs', label: 'Audit Trail', icon: FileText },
    { page: 'admin-importer', label: 'Importer', icon: FolderInput },
    { page: 'admin-api-keys', label: 'REST API Keys', icon: Key },
    { page: 'admin-legal', label: 'Legal Pages', icon: Scale },
  ];

  return (
    <aside
      id="aether-sidebar"
      className="hidden lg:flex w-64 flex-none border-r border-[#23252e] bg-[#0c0d12] flex-col h-full select-none z-20"
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-[#23252e] shrink-0 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#f97316]/10 border border-[#f97316]/30 flex items-center justify-center text-[#f97316] font-bold">
          ⚡
        </div>
        <div>
          <div className="text-sm font-bold text-white tracking-wide">Admin Panel</div>
          <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Aether Control Plane</div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-5">
        {/* ADMINISTRATION */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 px-3 mb-1.5 font-semibold">
            Administration
          </div>
          <div className="space-y-0.5">
            {adminCoreItems.map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => onNavigate(item.page)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-[#181920]'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-black' : 'text-neutral-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 px-3 mb-1.5 font-semibold">
            Quick Actions
          </div>
          <div className="space-y-1">
            <button
              onClick={() => onNavigate('admin-users')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-[#181920] transition-colors text-left cursor-pointer"
            >
              <UserPlus className="h-4 w-4 text-[#f97316] shrink-0" />
              <span>New User</span>
            </button>
            <button
              onClick={() => onNavigate('admin-servers')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-[#181920] transition-colors text-left cursor-pointer"
            >
              <PlusCircle className="h-4 w-4 text-[#f97316] shrink-0" />
              <span>New Server</span>
            </button>
          </div>
        </div>

        {/* MORE MODULES */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 px-3 mb-1.5 font-semibold">
            System Modules
          </div>
          <div className="space-y-0.5">
            {secondaryItems.map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => onNavigate(item.page)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#181920] text-white border-l-2 border-[#f97316]'
                      : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-[#f97316]' : 'text-neutral-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* NAVIGATION */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 px-3 mb-1.5 font-semibold">
            Navigation
          </div>
          <button
            onClick={() => onNavigate('dashboard')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-[#181920] transition-colors text-left cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-neutral-400 shrink-0" />
            <span>Back to Panel</span>
          </button>
        </div>
      </div>

      {/* Admin Profile Footer */}
      <div className="p-3 border-t border-[#23252e] bg-[#0c0d12] shrink-0">
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#14151b] border border-[#23252e]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#f97316]/20 border border-[#f97316]/40 flex items-center justify-center text-[#f97316] font-bold text-xs uppercase shrink-0">
              {user?.username?.charAt(0) || user?.email?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {user?.username || user?.displayName || 'admin'}
              </div>
              <div className="text-[10px] text-neutral-400 font-mono capitalize truncate">
                {user?.role || 'Administrator'}
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer rounded hover:bg-[#1e2029]"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
