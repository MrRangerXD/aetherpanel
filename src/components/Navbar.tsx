import React from 'react';
import { Server, Shield, Cpu, Terminal, HelpCircle, Activity, User, LogIn, Sparkles, Search } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { AetherLogo } from './AetherLogo';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenSearch?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate, onOpenSearch }) => {
  const { user } = useAuth();
  const { accentClasses } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo */}
        <AetherLogo onClick={() => onNavigate('home')} />

        {/* Navigation links */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => onNavigate('home')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'home' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            Home
          </button>
          <button
            onClick={() => onNavigate('minecraft')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'minecraft' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            Minecraft
          </button>
          <button
            onClick={() => onNavigate('bot')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'bot' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            Discord Bots
          </button>
          <button
            onClick={() => onNavigate('pricing')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'pricing' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            Pricing
          </button>
          <button
            onClick={() => onNavigate('status')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${currentPage === 'status' ? 'text-white bg-zinc-800/60' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Status
          </button>
          <button
            onClick={() => onNavigate('docs')}
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-zinc-400 bg-zinc-900/80 hover:bg-zinc-800/80 hover:text-white border border-zinc-800 transition"
              title="Search everything (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-950 rounded border border-zinc-800">
                ⌘K
              </kbd>
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              {['admin', 'super_admin', 'support', 'moderator'].includes(user.role) && (
                <button
                  onClick={() => onNavigate('admin-dashboard')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Admin Panel
                </button>
              )}
              <button
                onClick={() => onNavigate('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md hover:opacity-95 transition-all`}
              >
                <Server className="h-4 w-4" />
                Control Panel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('login')}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => onNavigate('register')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md ${accentClasses.shadow} hover:opacity-95 transition-all`}
              >
                <Sparkles className="h-4 w-4" />
                Get Started
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
