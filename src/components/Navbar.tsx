import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Server, Shield, Search, Menu, X, LayoutDashboard, CreditCard, LifeBuoy,
  Settings, LogOut, Sliders, Users, HardDrive, Package, Coins,
  ExternalLink, ChevronDown, Gamepad2, Bot, Activity, MousePointer,
  Plus, Terminal, Disc as DiscordIcon, Radio, Sparkles
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useBranding } from '../lib/BrandingContext';
import { AetherLogo } from './AetherLogo';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string, params?: any) => void;
  onOpenSearch?: () => void;
  userServers?: any[];
  currentServerId?: string;
  onSelectServer?: (serverId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onOpenSearch,
  userServers = [],
  currentServerId,
  onSelectServer
}) => {
  const { user, logout } = useAuth();
  const { brandName, supportEmail, discordUrl, socialLinks } = useBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hostingDropdownOpen, setHostingDropdownOpen] = useState(false);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hostingDropdownRef = useRef<HTMLDivElement>(null);

  const activeDiscord = socialLinks?.discord || discordUrl || 'https://discord.gg/aetherpanel';

  const [cursorActive, setCursorActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('aether_custom_cursor') !== 'false';
  });

  const toggleCursor = () => {
    const next = !cursorActive;
    setCursorActive(next);
    localStorage.setItem('aether_custom_cursor', next ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('aether-cursor-toggle', { detail: { enabled: next } }));
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hostingDropdownRef.current && !hostingDropdownRef.current.contains(e.target as Node)) {
        setHostingDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNav = (page: string, params?: any) => {
    onNavigate(page, params);
    setMobileMenuOpen(false);
    setHostingDropdownOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 1024 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', handleResize);
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileMenuOpen]);

  const isAdmin = user && ['admin', 'super_admin', 'support', 'moderator'].includes(user.role);
  const isAdminRoute = currentPage.startsWith('admin-');
  const isPublicPage = ['home', 'about', 'contact', 'minecraft', 'bot', 'pricing', 'status', 'docs', 'terms', 'privacy', 'acceptable-use', 'legal', 'login', 'register'].includes(currentPage);
  const isControlPanel = !isPublicPage && !isAdminRoute;

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--color-bg)] border-b border-[var(--color-line)] select-none">
      <div className="w-full h-14 px-3 sm:px-5 lg:px-7 flex items-center justify-between gap-3">
        
        {/* ========================================================================= */}
        {/* LEFT SECTION: Brand Logo (Always navigates to Homepage) */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <AetherLogo onClick={() => handleNav('home')} />
        </div>

        {/* ========================================================================= */}
        {/* CENTER SECTION: Desktop Navigation Links (ONLY on Public Homepage) */}
        {/* ========================================================================= */}
        {isPublicPage && (
          <nav className="hidden lg:flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleNav('home')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                currentPage === 'home'
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)]'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] border border-transparent'
              }`}
            >
              Home
            </button>

            {/* Hosting Dropdown */}
            <div
              ref={hostingDropdownRef}
              className="relative"
              onMouseEnter={() => {
                if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
                setHostingDropdownOpen(true);
              }}
              onMouseLeave={() => {
                dropdownTimeoutRef.current = setTimeout(() => {
                  setHostingDropdownOpen(false);
                }, 160);
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHostingDropdownOpen((prev) => !prev);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors flex items-center gap-1.5 cursor-pointer ${
                  currentPage === 'minecraft' || currentPage === 'bot'
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)]'
                    : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] border border-transparent'
                }`}
              >
                <span>Hosting</span>
                <ChevronDown className={`h-3 w-3 transition-transform duration-120 ${hostingDropdownOpen ? 'rotate-180 text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              </button>

              {hostingDropdownOpen && (
                <div
                  className="absolute top-full left-0 mt-1 w-72 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] p-1.5 z-50 anim-scale-in shadow-2xl"
                  onMouseEnter={() => {
                    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
                    setHostingDropdownOpen(true);
                  }}
                  onMouseLeave={() => {
                    dropdownTimeoutRef.current = setTimeout(() => {
                      setHostingDropdownOpen(false);
                    }, 160);
                  }}
                >
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setHostingDropdownOpen(false);
                        handleNav('minecraft');
                      }}
                      className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-[var(--color-surface-2)] transition-colors text-left cursor-pointer"
                    >
                      <div className="h-7 w-7 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)] shrink-0">
                        <Gamepad2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--color-ink)]">Minecraft Hosting</span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--color-surface-2)] text-[var(--color-accent)] border border-[var(--color-line)]">AMD</span>
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-mute)] leading-tight mt-0.5">Paper, Purpur, Forge & Fabric</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHostingDropdownOpen(false);
                        handleNav('bot');
                      }}
                      className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-[var(--color-surface-2)] transition-colors text-left cursor-pointer"
                    >
                      <div className="h-7 w-7 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-ok)] shrink-0">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--color-ink)]">Discord Bot Hosting</span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--color-surface-2)] text-[var(--color-ok)] border border-[var(--color-line)]">24/7</span>
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-mute)] leading-tight mt-0.5">Node.js 22, Python 3.13 & Bun 1.2</p>
                      </div>
                    </button>
                  </div>

                  <div className="mt-1 pt-1.5 border-t border-[var(--color-line)] px-2 pb-0.5 flex items-center justify-between text-[11px]">
                    <span className="text-[var(--color-ink-mute)]">All Hosting Services</span>
                    <button
                      type="button"
                      onClick={() => {
                        setHostingDropdownOpen(false);
                        handleNav('pricing');
                      }}
                      className="text-[var(--color-accent)] hover:underline font-medium cursor-pointer"
                    >
                      View Plans →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleNav('status')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                currentPage === 'status'
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)]'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] border border-transparent'
              }`}
            >
              Infrastructure
            </button>

            <button
              type="button"
              onClick={() => handleNav('pricing')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                currentPage === 'pricing'
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)]'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] border border-transparent'
              }`}
            >
              Pricing
            </button>

            <button
              type="button"
              onClick={() => handleNav('docs')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                currentPage === 'docs'
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)]'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] border border-transparent'
              }`}
            >
              Docs
            </button>

            <button
              type="button"
              onClick={() => handleNav('about')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                currentPage === 'about'
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)]'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] border border-transparent'
              }`}
            >
              About
            </button>

            <button
              type="button"
              onClick={() => handleNav('contact')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                currentPage === 'contact'
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)]'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] border border-transparent'
              }`}
            >
              Contact
            </button>
          </nav>
        )}

        {/* ========================================================================= */}
        {/* RIGHT SECTION: Differentiated Action Bars */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* CASE A: PUBLIC HOMEPAGE RIGHT ACTIONS */}
          {isPublicPage && (
            <>
              {/* Custom Cursor Toggle Button (Only on Public pages as requested) */}
              <button
                type="button"
                onClick={toggleCursor}
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-mono transition-colors border cursor-pointer ${
                  cursorActive
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-accent)] border-[var(--color-accent)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-ink-mute)] border-[var(--color-line)] hover:text-[var(--color-ink)]'
                }`}
                title={cursorActive ? 'Disable Custom Cursor' : 'Enable Custom Cursor'}
              >
                <MousePointer className="h-3 w-3" />
                <span className="text-[10px] uppercase font-semibold">{cursorActive ? 'Cursor ON' : 'Cursor OFF'}</span>
              </button>

              {onOpenSearch && (
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="hidden sm:inline-flex items-center gap-2 px-2.5 h-8 rounded-md text-xs text-[var(--color-ink-dim)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)] border border-[var(--color-line)] transition-colors focus:outline-none cursor-pointer"
                  title="Search everything (Ctrl+K)"
                  aria-label="Search command palette"
                >
                  <Search className="h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
                  <span className="hidden md:inline text-[11px] text-[var(--color-ink-mute)]">Search</span>
                  <kbd className="inline-flex px-1 py-0.2 text-[9px] font-mono text-[var(--color-ink-mute)] bg-[var(--color-bg)] rounded border border-[var(--color-line)]">
                    ⌘K
                  </kbd>
                </button>
              )}

              {user ? (
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleNav('admin-dashboard')}
                      className="hidden md:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium bg-[var(--color-surface)] text-[var(--color-ink-dim)] border border-[var(--color-line)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                    >
                      <Shield className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                      <span>Admin</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNav('dashboard')}
                    className="btn btn-primary h-8 px-3 text-xs"
                  >
                    <Server className="h-3.5 w-3.5" />
                    <span>Control Panel</span>
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleNav('login')}
                    className="btn btn-ghost h-8 px-3 text-xs"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('register')}
                    className="btn btn-primary h-8 px-3 text-xs"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </>
          )}

          {/* CASE B: CONTROL PANEL NAVBAR ACTIONS (Only Credits, Deploy Server, and Admin) */}
          {isControlPanel && (
            <div className="flex items-center gap-2">
              {/* Wallet Credits Pill */}
              <button
                type="button"
                onClick={() => handleNav('billing')}
                className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-mono bg-[#14151b] hover:bg-[#1b1c24] border border-[#23252e] hover:border-orange-500/30 text-emerald-400 transition-colors cursor-pointer"
                title="Wallet Balance & Billing"
              >
                <Coins className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                <span className="font-semibold">${user?.credits?.toFixed(2) || '0.00'}</span>
              </button>

              {/* Primary Action: Deploy Server Button */}
              <button
                type="button"
                onClick={() => handleNav('deploy')}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold text-white bg-[#f97316] hover:bg-[#ea580c] shadow-sm transition-all cursor-pointer"
                title="Deploy a New Server Instance"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Deploy Server</span>
                <span className="sm:hidden">Deploy</span>
              </button>

              {/* Admin Panel Link (if staff) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleNav('admin-dashboard')}
                  className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold bg-[#14151b] hover:bg-[#1e2029] text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                  title="Switch to Admin Control Plane"
                >
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  <span>Admin</span>
                </button>
              )}
            </div>
          )}

          {/* CASE C: ADMIN CONTROL PLANE NAVBAR (Dashboard Button on the Right) */}
          {isAdminRoute && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleNav('dashboard')}
                className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-bold text-white bg-[#f97316] hover:bg-[#ea580c] shadow-sm transition-all cursor-pointer"
                title="Switch to Client Control Panel Dashboard"
              >
                <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                <span>Dashboard</span>
              </button>
            </div>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            id="mobile-hamburger-trigger"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMobileMenuOpen((prev) => !prev);
            }}
            className="h-8 w-8 flex items-center justify-center rounded-md text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] bg-[var(--color-surface)] border border-[var(--color-line)] lg:hidden transition-colors shrink-0 cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE NAVIGATION DRAWER */}
      {/* ========================================================================= */}
      {mobileMenuOpen && createPortal(
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 z-[9999] lg:hidden flex justify-end"
        >
          {/* Overlay mask */}
          <div
            className="fixed inset-0 bg-black/75 anim-fade-in"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMobileMenuOpen(false);
            }}
            aria-hidden="true"
          />

          {/* Drawer Slide-Over Panel */}
          <div className="relative w-full max-w-[min(88vw,340px)] bg-[#0c0d12] border-l border-[#23252e] p-5 flex flex-col justify-between h-full overflow-y-auto z-10 anim-slide-in-right">
            <div className="space-y-5">
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#23252e]">
                <AetherLogo onClick={() => handleNav(isControlPanel ? 'dashboard' : isAdminRoute ? 'admin-dashboard' : 'home')} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileMenuOpen(false);
                  }}
                  className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-white bg-[#14151b] border border-[#23252e] cursor-pointer"
                  aria-label="Close navigation drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Quick Search inside Mobile Drawer */}
              {onOpenSearch && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileMenuOpen(false);
                    onOpenSearch();
                  }}
                  className="w-full flex items-center justify-between px-3 h-10 rounded-md text-xs font-medium text-zinc-300 bg-[#14151b] border border-[#23252e] hover:text-white transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Search panel & commands</span>
                  </div>
                  <kbd className="px-1 py-0.5 text-[9px] font-mono text-zinc-400 bg-[#09090b] rounded border border-[#23252e]">⌘K</kbd>
                </button>
              )}

              {/* Cursor Toggle in Mobile Drawer (Only on public page) */}
              {isPublicPage && (
                <button
                  type="button"
                  onClick={toggleCursor}
                  className="w-full flex items-center justify-between px-3 h-10 rounded-md text-xs font-medium text-zinc-300 bg-[#14151b] border border-[#23252e] hover:text-white transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <MousePointer className={`h-3.5 w-3.5 ${cursorActive ? 'text-[#f97316]' : 'text-zinc-500'}`} />
                    <span>Custom Orange Cursor</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    cursorActive
                      ? 'bg-orange-950/40 text-orange-400 border-orange-500/40'
                      : 'bg-[#09090b] text-zinc-500 border-[#23252e]'
                  }`}>
                    {cursorActive ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}

              {/* Server Switcher in Mobile Drawer */}
              {user && !isAdminRoute && userServers.length > 0 && (
                <div className="p-3 rounded-lg bg-[#14151b] border border-[#23252e] space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                    Active Server
                  </label>
                  <select
                    value={currentServerId || 'overview'}
                    onChange={(e) => {
                      if (e.target.value === 'overview') {
                        handleNav('dashboard');
                      } else if (onSelectServer) {
                        onSelectServer(e.target.value);
                        setMobileMenuOpen(false);
                      }
                    }}
                    className="w-full bg-[#09090b] border border-[#23252e] text-zinc-200 text-xs rounded-md px-2.5 py-2 focus:outline-none focus:border-[#f97316]"
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
                </div>
              )}

              {/* Workspace Navigation for Logged-In Users */}
              {user && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 px-1">
                    {isAdminRoute ? 'Admin Plane' : 'Workspace'}
                  </div>

                  <div className="space-y-0.5">
                    {isAdminRoute ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleNav('admin-dashboard')}
                          className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'admin-dashboard' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <Sliders className="h-3.5 w-3.5" /> Overview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('admin-users')}
                          className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'admin-users' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <Users className="h-3.5 w-3.5" /> Users
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('admin-servers')}
                          className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'admin-servers' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <Server className="h-3.5 w-3.5" /> Servers
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('admin-nodes')}
                          className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'admin-nodes' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <HardDrive className="h-3.5 w-3.5" /> Nodes & Daemons
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('admin-monitoring')}
                          className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'admin-monitoring' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <Activity className="h-3.5 w-3.5" /> Infrastructure Health
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('dashboard')}
                          className="w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-semibold text-white bg-[#14151b] border border-[#23252e] hover:border-orange-500/40 text-left cursor-pointer mt-2"
                        >
                          <Server className="h-3.5 w-3.5 text-orange-400" /> Switch to Client Panel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleNav('dashboard')}
                          className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'dashboard' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('servers')}
                          className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'servers' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <Server className="h-3.5 w-3.5" /> My Servers
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('deploy')}
                          className="w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-bold text-white bg-[#f97316] hover:bg-[#ea580c] text-left cursor-pointer transition-colors shadow-sm"
                        >
                          <Plus className="h-3.5 w-3.5" /> Deploy Server
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('billing')}
                          className={`w-full flex items-center justify-between px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'billing' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <CreditCard className="h-3.5 w-3.5" /> Billing & Wallet
                          </div>
                          <span className="font-mono text-emerald-400 font-semibold">${user?.credits?.toFixed(2) || '0.00'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('afk-rewards')}
                          className={`w-full flex items-center justify-between px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'afk-rewards' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Coins className="h-3.5 w-3.5" /> AFK Rewards
                          </div>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-400 font-mono border border-amber-500/30">EARN</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('support')}
                          className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'support' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <LifeBuoy className="h-3.5 w-3.5" /> Support
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNav('settings')}
                          className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-medium text-left cursor-pointer ${currentPage === 'settings' ? 'bg-[#181920] text-[#f97316] border border-[#23252e]' : 'text-zinc-300 hover:bg-[#14151b] hover:text-white'}`}
                        >
                          <Settings className="h-3.5 w-3.5" /> Settings
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleNav('admin-dashboard')}
                            className="w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-xs font-semibold text-amber-300 bg-[#14151b] border border-amber-500/30 hover:bg-[#1f212b] text-left cursor-pointer mt-2"
                          >
                            <Shield className="h-3.5 w-3.5 text-amber-400" /> Admin Control Plane
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Public Exploration Pages */}
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 px-1">
                  {isPublicPage ? 'Explore Services' : 'Website'}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { page: 'home', label: 'Home' },
                    { page: 'about', label: 'About' },
                    { page: 'contact', label: 'Contact' },
                    { page: 'pricing', label: 'Pricing' },
                    { page: 'minecraft', label: 'Minecraft' },
                    { page: 'bot', label: 'Discord Bots' },
                    { page: 'status', label: 'Status' },
                    { page: 'docs', label: 'Docs' }
                  ].map((item) => (
                    <button
                      key={item.page}
                      type="button"
                      onClick={() => handleNav(item.page)}
                      className={`px-2.5 h-9 rounded-md text-xs font-medium text-left transition-colors cursor-pointer ${
                        currentPage === item.page
                          ? 'bg-[#181920] text-[#f97316] border border-[#23252e]'
                          : 'text-zinc-400 hover:bg-[#14151b] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Community Link */}
              <div className="p-3 rounded-lg bg-[#14151b] border border-[#23252e] space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Community</div>
                <a
                  href={activeDiscord}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="w-full h-8 px-2.5 rounded-md bg-[#09090b] hover:bg-[#181920] text-zinc-200 border border-[#23252e] text-xs font-medium flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <DiscordIcon className="h-3.5 w-3.5 text-[#f97316]" />
                    <span>Discord Server</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-zinc-500" />
                </a>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            {user ? (
              <div className="pt-4 border-t border-[#23252e] mt-4">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#14151b] border border-[#23252e]">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <img
                      src={user.avatarUrl || 'https://api.dicebear.com/7.x/identicon/svg?seed=user'}
                      alt="Avatar"
                      className="h-7 w-7 rounded-md object-cover bg-zinc-800 shrink-0"
                    />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-zinc-200 truncate">{user.displayName || user.username}</div>
                      <div className="text-[10px] text-zinc-400 font-mono truncate">{user.email}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    title="Sign Out"
                    className="p-1.5 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-[#23252e] mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleNav('login')}
                  className="btn btn-ghost h-10 w-full"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('register')}
                  className="btn btn-primary h-10 w-full"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
