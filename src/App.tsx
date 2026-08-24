import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
import { BrandingProvider, useBranding } from './lib/BrandingContext';
import { ToastProvider } from './lib/ToastContext';
import { ShieldAlert, RefreshCw, LogOut } from 'lucide-react';
import { apiRequest } from './lib/api';
import { Server } from './types';
import { parseUrlToRoute, routeToUrl } from './lib/routing';

// Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AdminSidebar } from './components/AdminSidebar';
import { Footer } from './components/Footer';
import { CustomCursor } from './components/CustomCursor';
import { AdBanner } from './components/AdBanner';
import { GlobalSearchModal } from './components/GlobalSearchModal';

// Public Pages
import { Home } from './pages/public/Home';
import { MinecraftHosting } from './pages/public/MinecraftHosting';
import { BotHosting } from './pages/public/BotHosting';
import { Pricing } from './pages/public/Pricing';
import { Status } from './pages/public/Status';
import { Docs } from './pages/public/Docs';
import { LegalPage } from './pages/public/LegalPage';

// Auth Pages
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';

// Customer Pages
import { Dashboard } from './pages/customer/Dashboard';
import { ServerDeployWizard } from './pages/customer/ServerDeployWizard';
import { ServerManage } from './pages/server/ServerManage';
import { ServersList } from './pages/customer/ServersList';
import { Billing } from './pages/customer/Billing';
import { SupportTickets } from './pages/customer/SupportTickets';
import { ActivityLog } from './pages/customer/ActivityLog';
import { UserSettings } from './pages/customer/UserSettings';
import { AfkRewards } from './pages/customer/AfkRewards';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminServers } from './pages/admin/AdminServers';
import { AdminProducts } from './pages/admin/AdminProducts';
import { AdminServerTypesPage } from './pages/admin/AdminServerTypes';
import { AdminNodes } from './pages/admin/AdminNodes';
import { AdminBilling } from './pages/admin/AdminBilling';
import { AdminCoupons } from './pages/admin/AdminCoupons';
import { AdminAnnouncements } from './pages/admin/AdminAnnouncements';
import { AdminSupport } from './pages/admin/AdminSupport';
import { AdminAuditLogs } from './pages/admin/AdminAuditLogs';
import { AdminApiKeys } from './pages/admin/AdminApiKeys';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminAds } from './pages/admin/AdminAds';
import { AdminRewards } from './pages/admin/AdminRewards';
import { AdminAppearance } from './pages/admin/AdminAppearance';
import { AdminBackups } from './pages/admin/AdminBackups';
import { AdminDiscord } from './pages/admin/AdminDiscord';
import { AdminMonitoring } from './pages/admin/AdminMonitoring';
import { AdminLegal } from './pages/admin/AdminLegal';
import { AdminDiagnostics } from './pages/admin/AdminDiagnostics';


function AppContent() {
  const { user, loading, logout } = useAuth();
  const { brandName, maintenanceMode, maintenanceMessage, refreshBranding } = useBranding();
  
  const [checkingMaintenance, setCheckingMaintenance] = useState(false);
  
  // Parse initial route directly from current browser URL
  const initialRoute = parseUrlToRoute(window.location.pathname, window.location.search);
  const [currentPage, setCurrentPage] = useState<string>(initialRoute.page);
  const [pageParams, setPageParams] = useState<any>(initialRoute.params);
  const [userServers, setUserServers] = useState<Server[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync state when browser navigation occurs (popstate)
  const syncRouteFromUrl = useCallback(() => {
    const route = parseUrlToRoute(window.location.pathname, window.location.search);
    setCurrentPage(route.page);
    setPageParams(route.params);
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', syncRouteFromUrl);
    return () => window.removeEventListener('popstate', syncRouteFromUrl);
  }, [syncRouteFromUrl]);

  // Programmatic navigation updating browser history
  const handleNavigate = useCallback((page: string, params?: any, options?: { replace?: boolean }) => {
    const targetUrl = routeToUrl(page, params);
    
    if (options?.replace) {
      window.history.replaceState({}, '', targetUrl);
    } else {
      window.history.pushState({}, '', targetUrl);
    }

    setCurrentPage(page);
    setPageParams(params || {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Fetch servers for quick selector when logged in
  const fetchServers = async () => {
    if (!user) return;
    const res = await apiRequest('/servers');
    if (res.success && res.data) {
      setUserServers(res.data);
    }
  };

  useEffect(() => {
    if (user) {
      fetchServers();
    } else {
      setUserServers([]);
    }
  }, [user]);

  // Route & Auth guard checks without resetting requested route
  useEffect(() => {
    if (loading) return;

    const publicPages = ['home', 'minecraft', 'bot', 'pricing', 'status', 'docs', 'terms', 'privacy', 'acceptable-use', 'legal', 'login', 'register'];
    const isPublic = publicPages.includes(currentPage);
    const isAdmin = currentPage.startsWith('admin-');

    if (!user && !isPublic) {
      // Unauthenticated access to protected route -> redirect to login with original path encoded
      const fullPath = window.location.pathname + window.location.search;
      const targetUrl = routeToUrl('login', { redirect: fullPath });
      window.history.replaceState({}, '', targetUrl);
      setCurrentPage('login');
      setPageParams({ redirect: fullPath });
    } else if (user && (currentPage === 'login' || currentPage === 'register')) {
      // Authenticated user visits auth page -> return to requested path or dashboard
      const redirectUrl = pageParams?.redirect || '/dashboard';
      window.history.replaceState({}, '', redirectUrl);
      const restored = parseUrlToRoute(redirectUrl, '');
      setCurrentPage(restored.page);
      setPageParams(restored.params);
    } else if (user && isAdmin && user.role !== 'admin' && user.role !== 'super_admin') {
      // Non-admin user visiting admin route -> redirect to customer dashboard
      handleNavigate('dashboard', {}, { replace: true });
    }
  }, [user, loading, currentPage, pageParams, handleNavigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 text-xs text-zinc-400">
          <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <span>Restoring your session...</span>
        </div>
      </div>
    );
  }

  const isPublicPage = ['home', 'minecraft', 'bot', 'pricing', 'status', 'docs', 'terms', 'privacy', 'acceptable-use', 'legal', 'login', 'register'].includes(currentPage);
  const isAdminPage = currentPage.startsWith('admin-');
  const isCustomerPage = !isPublicPage && !isAdminPage;

  if (maintenanceMode && user?.role !== 'admin' && user?.role !== 'super_admin') {
    if (isCustomerPage) {
      return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-6 relative font-sans select-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="max-w-md w-full bg-zinc-900/40 border border-zinc-800/80 p-8 rounded-3xl backdrop-blur-md text-center space-y-6 relative shadow-2xl">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center animate-pulse">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-white uppercase font-mono">System Maintenance</h1>
              <p className="text-xs text-zinc-400 font-mono">Platform Upgrades In Progress</p>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800/50 max-h-[150px] overflow-y-auto scrollbar-thin">
              {maintenanceMessage || 'AetherPanel is currently performing scheduled system upgrades. We will return online shortly.'}
            </p>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={async () => {
                  setCheckingMaintenance(true);
                  await refreshBranding();
                  setTimeout(() => setCheckingMaintenance(false), 800);
                }}
                disabled={checkingMaintenance}
                className="w-full min-h-[44px] rounded-xl text-xs font-semibold text-zinc-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-55 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-400/10"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingMaintenance ? 'animate-spin' : ''}`} />
                <span>{checkingMaintenance ? 'Checking status...' : 'Check if completed'}</span>
              </button>

              <button
                onClick={() => logout()}
                className="w-full min-h-[44px] rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-950/40 border border-zinc-800/50 hover:border-zinc-800 hover:bg-zinc-900/30 transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out of Account</span>
              </button>
            </div>
          </div>

          <div className="mt-8 text-[11px] text-zinc-600 font-mono uppercase tracking-widest">
            {brandName || 'AetherPanel'} Control Plane
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Maintenance Mode Warning Banner for Public Pages */}
      {maintenanceMode && isPublicPage && (
        <div className="bg-amber-500 text-black py-2 px-4 text-center text-xs font-bold font-mono tracking-wide shadow-md shrink-0 flex items-center justify-center gap-2 z-50">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>PLATFORM UNDER MAINTENANCE: Server deployment, billing, and write operations are temporarily frozen.</span>
        </div>
      )}

      {/* Custom GPU Cursor */}
      <CustomCursor />

      {/* Global Search Command Palette */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* Top Header Navbar */}
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenSearch={() => setIsSearchOpen(true)}
        userServers={userServers}
        currentServerId={pageParams?.serverId}
        onSelectServer={(sId) => handleNavigate('server-manage', { serverId: sId })}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* Customer Sidebar */}
        {isCustomerPage && user && (
          <Sidebar
            currentPage={currentPage}
            onNavigate={handleNavigate}
            userServers={userServers}
            currentServerId={pageParams?.serverId}
            onSelectServer={(sId) => handleNavigate('server-manage', { serverId: sId })}
          />
        )}

        {/* Admin Sidebar */}
        {isAdminPage && user && (
          <AdminSidebar
            currentPage={currentPage}
            onNavigate={handleNavigate}
          />
        )}

        {/* Content Viewport */}
        <main className="flex-1 overflow-x-hidden min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 lg:p-6">
          <div>
          {/* Public Views */}
          {currentPage === 'home' && <Home onNavigate={handleNavigate} />}
          {currentPage === 'minecraft' && <MinecraftHosting onNavigate={handleNavigate} />}
          {currentPage === 'bot' && <BotHosting onNavigate={handleNavigate} />}
          {currentPage === 'pricing' && <Pricing onNavigate={handleNavigate} />}
          {currentPage === 'status' && <Status onNavigate={handleNavigate} />}
          {currentPage === 'docs' && <Docs onNavigate={handleNavigate} />}
          {currentPage === 'terms' && <LegalPage initialSlug="terms" onNavigate={handleNavigate} />}
          {currentPage === 'privacy' && <LegalPage initialSlug="privacy" onNavigate={handleNavigate} />}
          {currentPage === 'acceptable-use' && <LegalPage initialSlug="acceptable-use" onNavigate={handleNavigate} />}
          {currentPage === 'legal' && <LegalPage initialSlug={pageParams?.initialSlug || 'terms'} onNavigate={handleNavigate} />}

          {/* Auth Views */}
          {currentPage === 'login' && <Login onNavigate={handleNavigate} />}
          {currentPage === 'register' && <Register onNavigate={handleNavigate} />}

          {/* Customer Control Panel Views */}
          {currentPage === 'dashboard' && (
            <div className="space-y-6">
              <AdBanner placement="dashboard" />
              <Dashboard
                onNavigate={handleNavigate}
                onSelectServer={(sId) => handleNavigate('server-manage', { serverId: sId })}
              />
            </div>
          )}
          {currentPage === 'servers' && (
            <div className="space-y-6">
              <AdBanner placement="server_list" />
              <ServersList onNavigate={handleNavigate} />
            </div>
          )}
          {currentPage === 'deploy' && (
            <ServerDeployWizard
              onNavigate={handleNavigate}
              onSelectServer={(sId) => handleNavigate('server-manage', { serverId: sId })}
            />
          )}
          {currentPage === 'server-manage' && (
            <ServerManage
              serverId={pageParams.serverId || userServers[0]?.id || ''}
              initialTab={pageParams.initialTab}
              onNavigate={handleNavigate}
            />
          )}
          {currentPage === 'billing' && <Billing onNavigate={handleNavigate} />}
          {currentPage === 'support' && <SupportTickets onNavigate={handleNavigate} />}
          {currentPage === 'activity' && <ActivityLog />}
          {currentPage === 'settings' && <UserSettings />}
          {currentPage === 'afk-rewards' && <AfkRewards />}

          {/* Admin Views */}
          {currentPage === 'admin-dashboard' && <AdminDashboard onNavigate={handleNavigate} />}
          {currentPage === 'admin-users' && <AdminUsers />}
          {currentPage === 'admin-servers' && <AdminServers />}
          {currentPage === 'admin-products' && <AdminProducts />}
          {currentPage === 'admin-server-types' && <AdminServerTypesPage />}
          {currentPage === 'admin-backups' && <AdminBackups onNavigate={handleNavigate} />}
          {currentPage === 'admin-nodes' && <AdminNodes />}
          {currentPage === 'admin-monitoring' && <AdminMonitoring />}
          {currentPage === 'admin-billing' && <AdminBilling />}

          {currentPage === 'admin-coupons' && <AdminCoupons />}
          {currentPage === 'admin-announcements' && <AdminAnnouncements />}
          {currentPage === 'admin-support' && <AdminSupport />}
          {currentPage === 'admin-audit-logs' && <AdminAuditLogs />}
          {currentPage === 'admin-api-keys' && <AdminApiKeys onNavigate={handleNavigate} />}
          {currentPage === 'admin-legal' && <AdminLegal />}
          {currentPage === 'admin-diagnostics' && <AdminDiagnostics />}
          {currentPage === 'admin-settings' && <AdminSettings />}
          {currentPage === 'admin-ads' && <AdminAds />}
          {currentPage === 'admin-rewards' && <AdminRewards />}
          {currentPage === 'admin-discord' && <AdminDiscord />}
          {currentPage === 'admin-appearance' && <AdminAppearance />}
          </div>

          {/* Subtle Panel Footer for Customer & Admin Pages */}
          {!isPublicPage && (
            <footer className="py-3 px-6 border-t border-zinc-900/80 bg-zinc-950/60 text-[11px] text-zinc-500 flex items-center justify-between font-mono shrink-0 mt-8">
              <span className="font-medium text-zinc-400">© 2025–2026 AetherPanel</span>
              <span className="text-[10px] text-zinc-600 hidden sm:inline">Enterprise Distributed Control Plane</span>
            </footer>
          )}
        </main>
      </div>

      {/* Footer for Public Views */}
      {isPublicPage && <Footer onNavigate={handleNavigate} />}

    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrandingProvider>
        <AuthProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AuthProvider>
      </BrandingProvider>
    </ThemeProvider>
  );
}
