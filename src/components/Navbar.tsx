import React, { useState, useEffect } from 'react';
import {
  Server, Shield, Cpu, Terminal, HelpCircle, Activity, User, LogIn,
  Sparkles, Search, Menu, X, LayoutDashboard, CreditCard, LifeBuoy,
  Settings, LogOut, Sliders, Users, HardDrive, Package, Coins
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { AetherLogo } from './AetherLogo';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenSearch?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate, onOpenSearch }) => {
  const { user, logout } = useAuth();
  const { accentClasses } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (page: string) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  // Close on ESC key & prevent background body scroll when open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const isAdmin = user && ['admin', 'super_admin', 'support', 'moderator'].includes(user.role);
  const isAdminRoute = currentPage.startsWith('admin-');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo */}
        <AetherLogo onClick={() => handleNav('home')} />

        {/* Navigation links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => handleNav('home')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'home' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            Home
          </button>
          <button
            onClick={() => handleNav('minecraft')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'minecraft' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            Minecraft
          </button>
          <button
            onClick={() => handleNav('bot')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'bot' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            Discord Bots
          </button>
          <button
            onClick={() => handleNav('pricing')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'pricing' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            Pricing
          </button>
          <button
            onClick={() => handleNav('status')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${currentPage === 'status' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Status
          </button>
          <button
            onClick={() => handleNav('docs')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'docs' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            Docs
          </button>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs text-zinc-400 bg-zinc-900/80 hover:bg-zinc-800/80 hover:text-white border border-zinc-800 transition"
              title="Search everything (Ctrl+K)"
              aria-label="Search command palette"
            >
              <Search className="h-4 w-4 text-zinc-400" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-950 rounded border border-zinc-800">
                ⌘K
              </kbd>
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => handleNav('admin-dashboard')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Admin Panel
                </button>
              )}
              <button
                onClick={() => handleNav('dashboard')}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md hover:opacity-95 transition-all`}
              >
                <Server className="h-4 w-4" />
                <span className="hidden xs:inline">Control Panel</span>
                <span className="xs:hidden">Panel</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => handleNav('login')}
                className="px-3 sm:px-4 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => handleNav('register')}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md ${accentClasses.shadow} hover:opacity-95 transition-all`}
              >
                <Sparkles className="h-4 w-4" />
                <span>Get Started</span>
              </button>
            </div>
          )}

          {/* Mobile hamburger menu toggle - guaranteed 44x44px touch target */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="h-11 w-11 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 md:hidden transition-colors border border-zinc-800/80 shrink-0"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5 text-amber-400" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Full-Featured Navigation Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Slide-Over Panel */}
          <div className="relative w-full max-w-xs sm:max-w-sm bg-zinc-950 border-l border-zinc-800/80 p-5 flex flex-col justify-between h-full overflow-y-auto shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <AetherLogo onClick={() => handleNav('home')} />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-11 w-11 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
                  aria-label="Close navigation drawer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Logged In User Workspace Navigation */}
              {user && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 px-1">
                    {isAdminRoute ? 'Admin Control Plane' : 'Customer Workspace'}
                  </div>

                  <div className="space-y-1">
                    {isAdminRoute ? (
                      <>
                        <button
                          onClick={() => handleNav('admin-dashboard')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'admin-dashboard' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <Sliders className="h-4 w-4 text-amber-400" /> System Overview
                        </button>
                        <button
                          onClick={() => handleNav('admin-users')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'admin-users' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <Users className="h-4 w-4" /> User Accounts
                        </button>
                        <button
                          onClick={() => handleNav('admin-servers')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'admin-servers' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <Server className="h-4 w-4" /> All Servers
                        </button>
                        <button
                          onClick={() => handleNav('admin-nodes')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'admin-nodes' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <HardDrive className="h-4 w-4" /> Compute Nodes
                        </button>
                        <button
                          onClick={() => handleNav('admin-diagnostics')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'admin-diagnostics' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <Activity className="h-4 w-4 text-amber-400" /> System Diagnostics
                        </button>
                        <button
                          onClick={() => handleNav('admin-settings')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'admin-settings' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <Sliders className="h-4 w-4" /> Platform Settings
                        </button>
                        <button
                          onClick={() => handleNav('dashboard')}
                          className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800"
                        >
                          <Server className="h-4 w-4 text-amber-400" /> Switch to User Panel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleNav('dashboard')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'dashboard' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <LayoutDashboard className="h-4 w-4 text-amber-400" /> Dashboard
                        </button>
                        <button
                          onClick={() => handleNav('servers')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'servers' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <Server className="h-4 w-4" /> My Servers
                        </button>
                        <button
                          onClick={() => handleNav('deploy')}
                          className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 shadow-md"
                        >
                          <Sparkles className="h-4 w-4" /> Deploy Server
                        </button>
                        <button
                          onClick={() => handleNav('billing')}
                          className={`w-full flex items-center justify-between px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'billing' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-4 w-4" /> Billing & Credits
                          </div>
                          <span className="font-mono text-emerald-400 font-bold">${user?.credits?.toFixed(2) || '0.00'}</span>
                        </button>
                        <button
                          onClick={() => handleNav('afk-rewards')}
                          className={`w-full flex items-center justify-between px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'afk-rewards' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <div className="flex items-center gap-3">
                            <Coins className="h-4 w-4 text-amber-400" /> AFK Rewards
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">EARN</span>
                        </button>
                        <button
                          onClick={() => handleNav('support')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'support' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <LifeBuoy className="h-4 w-4" /> Support Tickets
                        </button>
                        <button
                          onClick={() => handleNav('settings')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold ${currentPage === 'settings' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-300 hover:bg-zinc-900'}`}
                        >
                          <Settings className="h-4 w-4" /> User Settings
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => handleNav('admin-dashboard')}
                            className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          >
                            <Shield className="h-4 w-4" /> Admin Control Plane
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Public Pages */}
              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                  Explore
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleNav('home')}
                    className={`px-3 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-left transition-colors ${currentPage === 'home' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-300 hover:bg-zinc-900'}`}
                  >
                    Home
                  </button>
                  <button
                    onClick={() => handleNav('minecraft')}
                    className={`px-3 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-left transition-colors ${currentPage === 'minecraft' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-300 hover:bg-zinc-900'}`}
                  >
                    Minecraft
                  </button>
                  <button
                    onClick={() => handleNav('bot')}
                    className={`px-3 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-left transition-colors ${currentPage === 'bot' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-300 hover:bg-zinc-900'}`}
                  >
                    Discord Bots
                  </button>
                  <button
                    onClick={() => handleNav('pricing')}
                    className={`px-3 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-left transition-colors ${currentPage === 'pricing' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-300 hover:bg-zinc-900'}`}
                  >
                    Pricing
                  </button>
                  <button
                    onClick={() => handleNav('status')}
                    className={`px-3 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-left transition-colors flex items-center gap-1.5 ${currentPage === 'status' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-300 hover:bg-zinc-900'}`}
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Status
                  </button>
                  <button
                    onClick={() => handleNav('docs')}
                    className={`px-3 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-left transition-colors ${currentPage === 'docs' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-300 hover:bg-zinc-900'}`}
                  >
                    Docs
                  </button>
                </div>
              </div>
            </div>

            {/* Footer User Profile & Sign Out */}
            {user ? (
              <div className="pt-4 border-t border-zinc-800 mt-6 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={user.avatarUrl || 'https://api.dicebear.com/7.x/identicon/svg?seed=user'}
                      alt="Avatar"
                      className="h-9 w-9 rounded-xl object-cover bg-zinc-800 shrink-0"
                    />
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate">{user.displayName || user.username}</div>
                      <div className="text-[10px] text-zinc-400 font-mono truncate">{user.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    title="Sign Out"
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-zinc-800 mt-6 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleNav('login')}
                  className="w-full py-3 min-h-[44px] rounded-xl text-xs font-semibold text-zinc-200 bg-zinc-900 border border-zinc-800"
                >
                  Sign In
                </button>
                <button
                  onClick={() => handleNav('register')}
                  className="w-full py-3 min-h-[44px] rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 shadow-md"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

