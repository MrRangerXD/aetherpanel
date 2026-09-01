import React from 'react';
import {
  ShieldAlert, Users, Server, Package, HardDrive, ShoppingBag,
  Tag, Megaphone, LifeBuoy, FileText, Sliders, ArrowLeft, LogOut,
  Sparkles, Coins, Layers, Archive, MessageSquare, Activity, Scale, Key
} from 'lucide-react';

import { useAuth } from '../lib/AuthContext';

interface AdminSidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentPage, onNavigate }) => {
  const { user, logout } = useAuth();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 border-r border-amber-500/20 bg-zinc-950/80 backdrop-blur-md flex-col justify-between min-h-[calc(100vh-4rem)]">
      <div>
        {/* Admin Header */}
        <div className="p-4 border-b border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <ShieldAlert className="h-4 w-4" />
            <span>Admin Control Plane</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Platform Management Console</p>
        </div>

        {/* Admin Navigation */}
        <div className="p-3 space-y-1">
          <button
            onClick={() => onNavigate('admin-dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-dashboard' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Sliders className="h-4 w-4" />
            <span>System Overview</span>
          </button>

          <button
            onClick={() => onNavigate('admin-users')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-users' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Users className="h-4 w-4" />
            <span>User Accounts</span>
          </button>

          <button
            onClick={() => onNavigate('admin-servers')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-servers' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Server className="h-4 w-4" />
            <span>All Servers</span>
          </button>

          <button
            onClick={() => onNavigate('admin-products')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-products' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Package className="h-4 w-4" />
            <span>Products & Plans</span>
          </button>

          <button
            onClick={() => onNavigate('admin-server-types')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-server-types' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Layers className="h-4 w-4 text-amber-400" />
            <span>Server Types & Themes</span>
          </button>

          <button
            onClick={() => onNavigate('admin-nodes')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-nodes' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <HardDrive className="h-4 w-4" />
            <span>Compute Nodes</span>
          </button>

          <button
            onClick={() => onNavigate('admin-monitoring')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-monitoring' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Activity className="h-4 w-4 text-amber-400" />
            <span>Monitoring & Status</span>
          </button>

          <button
            onClick={() => onNavigate('admin-diagnostics')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-diagnostics' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span>System Diagnostics</span>
          </button>

          <button
            onClick={() => onNavigate('admin-backups')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-backups' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >

            <Archive className="h-4 w-4" />
            <span>Backups & Storage</span>
          </button>

          <button
            onClick={() => onNavigate('admin-billing')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-billing' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Orders & Billing</span>
          </button>

          <button
            onClick={() => onNavigate('admin-coupons')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-coupons' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Tag className="h-4 w-4" />
            <span>Coupons</span>
          </button>

          <button
            onClick={() => onNavigate('admin-announcements')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-announcements' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Megaphone className="h-4 w-4" />
            <span>Announcements</span>
          </button>

          <button
            onClick={() => onNavigate('admin-ads')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-ads' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Ad Campaigns</span>
          </button>

          <button
            onClick={() => onNavigate('admin-rewards')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-rewards' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Coins className="h-4 w-4 text-amber-400" />
            <span>AFK Rewards</span>
          </button>

          <button
            onClick={() => onNavigate('admin-discord')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-discord' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <MessageSquare className="h-4 w-4 text-indigo-400" />
            <span>Discord Integration</span>
          </button>

          <button
            onClick={() => onNavigate('admin-appearance')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-appearance' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Sliders className="h-4 w-4 text-amber-400" />
            <span>Fonts & Themes</span>
          </button>

          <button
            onClick={() => onNavigate('admin-support')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-support' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <LifeBuoy className="h-4 w-4" />
            <span>Support Queue</span>
          </button>

          <button
            onClick={() => onNavigate('admin-audit-logs')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-audit-logs' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <FileText className="h-4 w-4" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => onNavigate('admin-api-keys')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-api-keys' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Key className="h-4 w-4 text-amber-400" />
            <span>REST API Keys</span>
          </button>

          <button
            onClick={() => onNavigate('admin-legal')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-legal' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Scale className="h-4 w-4 text-amber-400" />
            <span>Legal & Policies</span>
          </button>

          <button
            onClick={() => onNavigate('admin-settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentPage === 'admin-settings' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <Sliders className="h-4 w-4" />
            <span>Platform Settings</span>
          </button>
        </div>
      </div>

      {/* Back to User Dashboard */}
      <div className="p-3 border-t border-zinc-800/80 space-y-2">
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-amber-400" />
          <span>Exit to User Panel</span>
        </button>

        <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="text-xs text-amber-400 font-semibold truncate">
            {user?.displayName || user?.email}
          </div>
          <button
            onClick={() => logout()}
            className="p-1 rounded text-zinc-400 hover:text-rose-400"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
