import React from 'react';
import {
  ShieldAlert, Users, Server, Package, HardDrive, ShoppingBag,
  Tag, Megaphone, LifeBuoy, FileText, Sliders, ArrowLeft, LogOut,
  Sparkles, Coins, Layers, Archive, MessageSquare, Activity, Scale, Key, LayoutTemplate, Palette
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface AdminSidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentPage, onNavigate }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { page: 'admin-dashboard', label: 'System Overview', icon: Sliders },
    { page: 'admin-users', label: 'User Accounts', icon: Users },
    { page: 'admin-servers', label: 'All Servers', icon: Server },
    { page: 'admin-products', label: 'Products & Plans', icon: Package },
    { page: 'admin-server-types', label: 'Server Types', icon: Layers },
    { page: 'admin-nodes', label: 'Compute Nodes', icon: HardDrive },
    { page: 'admin-monitoring', label: 'Monitoring', icon: Activity },
    { page: 'admin-diagnostics', label: 'Diagnostics', icon: ShieldAlert },
    { page: 'admin-backups', label: 'Backups & Storage', icon: Archive },
    { page: 'admin-billing', label: 'Orders & Billing', icon: ShoppingBag },
    { page: 'admin-coupons', label: 'Coupons', icon: Tag },
    { page: 'admin-announcements', label: 'Announcements', icon: Megaphone },
    { page: 'admin-ads', label: 'Ad Campaigns', icon: Sparkles },
    { page: 'admin-rewards', label: 'AFK Rewards', icon: Coins },
    { page: 'admin-discord', label: 'Discord Bot', icon: MessageSquare },
    { page: 'admin-panel-customization', label: 'Panel Customization', icon: Palette },
    { page: 'admin-support', label: 'Support Queue', icon: LifeBuoy },
    { page: 'admin-audit-logs', label: 'Audit Trail', icon: FileText },
    { page: 'admin-api-keys', label: 'REST API Keys', icon: Key },
    { page: 'admin-legal', label: 'Legal & Policies', icon: Scale },
    { page: 'admin-settings', label: 'Platform Settings', icon: Sliders },
  ];

  return (
    <aside
      id="aether-sidebar"
      className="hidden lg:flex w-60 flex-none border-r border-[var(--color-line)] bg-[var(--color-surface)] flex-col h-full select-none z-20"
    >
      {/* Admin Header */}
      <div className="p-3 border-b border-[var(--color-line)] shrink-0">
        <div className="flex items-center gap-2 text-[var(--color-accent)] font-semibold text-xs tracking-wide">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Admin Control Plane</span>
        </div>
        <p className="text-[10px] text-[var(--color-ink-mute)] font-mono mt-0.5">Platform Management</p>
      </div>

      {/* Admin Navigation */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[var(--color-accent)]' : ''}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Back to User Dashboard (Pinned Bottom) */}
      <div className="p-2.5 border-t border-[var(--color-line)] space-y-2 shrink-0 bg-[var(--color-surface)]">
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-full flex items-center gap-2 px-3 h-8 rounded-md text-xs font-medium text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-line)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          <span>Exit to User Panel</span>
        </button>

        <div className="flex items-center justify-between p-2 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)]">
          <div className="text-xs text-[var(--color-ink)] font-medium truncate">
            {user?.displayName || user?.email}
          </div>
          <button
            onClick={() => logout()}
            className="p-1 text-[var(--color-ink-mute)] hover:text-[var(--color-err)] transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
