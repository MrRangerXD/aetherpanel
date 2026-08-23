import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=7fd4ebcb"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=7fd4ebcb"; const useState = __vite__cjsImport1_react["useState"]; const useEffect = __vite__cjsImport1_react["useEffect"]; const useCallback = __vite__cjsImport1_react["useCallback"];
import { AuthProvider, useAuth } from "/src/lib/AuthContext.tsx";
import { ThemeProvider } from "/src/lib/ThemeContext.tsx";
import { BrandingProvider, useBranding } from "/src/lib/BrandingContext.tsx";
import { ShieldAlert, RefreshCw, LogOut } from "/node_modules/.vite/deps/lucide-react.js?v=7fd4ebcb";
import { apiRequest } from "/src/lib/api.ts";
import { parseUrlToRoute, routeToUrl } from "/src/lib/routing.ts";
import { Navbar } from "/src/components/Navbar.tsx";
import { Sidebar } from "/src/components/Sidebar.tsx";
import { AdminSidebar } from "/src/components/AdminSidebar.tsx";
import { Footer } from "/src/components/Footer.tsx";
import { CustomCursor } from "/src/components/CustomCursor.tsx";
import { AdBanner } from "/src/components/AdBanner.tsx";
import { GlobalSearchModal } from "/src/components/GlobalSearchModal.tsx";
import { Home } from "/src/pages/public/Home.tsx";
import { MinecraftHosting } from "/src/pages/public/MinecraftHosting.tsx";
import { BotHosting } from "/src/pages/public/BotHosting.tsx";
import { Pricing } from "/src/pages/public/Pricing.tsx";
import { Status } from "/src/pages/public/Status.tsx";
import { Docs } from "/src/pages/public/Docs.tsx";
import { LegalPage } from "/src/pages/public/LegalPage.tsx";
import { Login } from "/src/pages/auth/Login.tsx";
import { Register } from "/src/pages/auth/Register.tsx";
import { Dashboard } from "/src/pages/customer/Dashboard.tsx";
import { ServerDeployWizard } from "/src/pages/customer/ServerDeployWizard.tsx";
import { ServerManage } from "/src/pages/server/ServerManage.tsx";
import { ServersList } from "/src/pages/customer/ServersList.tsx";
import { Billing } from "/src/pages/customer/Billing.tsx";
import { SupportTickets } from "/src/pages/customer/SupportTickets.tsx";
import { ActivityLog } from "/src/pages/customer/ActivityLog.tsx";
import { UserSettings } from "/src/pages/customer/UserSettings.tsx";
import { AfkRewards } from "/src/pages/customer/AfkRewards.tsx";
import { AdminDashboard } from "/src/pages/admin/AdminDashboard.tsx";
import { AdminUsers } from "/src/pages/admin/AdminUsers.tsx";
import { AdminServers } from "/src/pages/admin/AdminServers.tsx";
import { AdminProducts } from "/src/pages/admin/AdminProducts.tsx";
import { AdminNodes } from "/src/pages/admin/AdminNodes.tsx";
import { AdminBilling } from "/src/pages/admin/AdminBilling.tsx";
import { AdminCoupons } from "/src/pages/admin/AdminCoupons.tsx";
import { AdminAnnouncements } from "/src/pages/admin/AdminAnnouncements.tsx";
import { AdminSupport } from "/src/pages/admin/AdminSupport.tsx";
import { AdminAuditLogs } from "/src/pages/admin/AdminAuditLogs.tsx";
import { AdminSettings } from "/src/pages/admin/AdminSettings.tsx";
import { AdminAds } from "/src/pages/admin/AdminAds.tsx";
import { AdminRewards } from "/src/pages/admin/AdminRewards.tsx";
import { AdminAppearance } from "/src/pages/admin/AdminAppearance.tsx";
import { AdminBackups } from "/src/pages/admin/AdminBackups.tsx";
import { AdminDiscord } from "/src/pages/admin/AdminDiscord.tsx";
import { AdminMonitoring } from "/src/pages/admin/AdminMonitoring.tsx";
import { AdminLegal } from "/src/pages/admin/AdminLegal.tsx";
import { AdminDiagnostics } from "/src/pages/admin/AdminDiagnostics.tsx";
function AppContent() {
  const { user, loading, logout } = useAuth();
  const { brandName, maintenanceMode, maintenanceMessage, refreshBranding } = useBranding();
  const [checkingMaintenance, setCheckingMaintenance] = useState(false);
  const initialRoute = parseUrlToRoute(window.location.pathname, window.location.search);
  const [currentPage, setCurrentPage] = useState(initialRoute.page);
  const [pageParams, setPageParams] = useState(initialRoute.params);
  const [userServers, setUserServers] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const syncRouteFromUrl = useCallback(() => {
    const route = parseUrlToRoute(window.location.pathname, window.location.search);
    setCurrentPage(route.page);
    setPageParams(route.params);
  }, []);
  useEffect(() => {
    window.addEventListener("popstate", syncRouteFromUrl);
    return () => window.removeEventListener("popstate", syncRouteFromUrl);
  }, [syncRouteFromUrl]);
  const handleNavigate = useCallback((page, params, options) => {
    const targetUrl = routeToUrl(page, params);
    if (options?.replace) {
      window.history.replaceState({}, "", targetUrl);
    } else {
      window.history.pushState({}, "", targetUrl);
    }
    setCurrentPage(page);
    setPageParams(params || {});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const fetchServers = async () => {
    if (!user) return;
    const res = await apiRequest("/servers");
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
  useEffect(() => {
    if (loading) return;
    const publicPages = ["home", "minecraft", "bot", "pricing", "status", "docs", "terms", "privacy", "acceptable-use", "legal", "login", "register"];
    const isPublic = publicPages.includes(currentPage);
    const isAdmin = currentPage.startsWith("admin-");
    if (!user && !isPublic) {
      const fullPath = window.location.pathname + window.location.search;
      const targetUrl = routeToUrl("login", { redirect: fullPath });
      window.history.replaceState({}, "", targetUrl);
      setCurrentPage("login");
      setPageParams({ redirect: fullPath });
    } else if (user && (currentPage === "login" || currentPage === "register")) {
      const redirectUrl = pageParams?.redirect || "/dashboard";
      window.history.replaceState({}, "", redirectUrl);
      const restored = parseUrlToRoute(redirectUrl, "");
      setCurrentPage(restored.page);
      setPageParams(restored.params);
    } else if (user && isAdmin && user.role !== "admin" && user.role !== "super_admin") {
      handleNavigate("dashboard", {}, { replace: true });
    }
  }, [user, loading, currentPage, pageParams, handleNavigate]);
  if (loading) {
    return /* @__PURE__ */ jsxDEV("div", { className: "min-h-screen bg-zinc-950 text-white flex items-center justify-center font-sans", children: /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-center gap-3 text-xs text-zinc-400", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" }, void 0, false, {
        fileName: "/app/applet/src/App.tsx",
        lineNumber: 166,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("span", { children: "Restoring your session..." }, void 0, false, {
        fileName: "/app/applet/src/App.tsx",
        lineNumber: 167,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "/app/applet/src/App.tsx",
      lineNumber: 165,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "/app/applet/src/App.tsx",
      lineNumber: 164,
      columnNumber: 7
    }, this);
  }
  const isPublicPage = ["home", "minecraft", "bot", "pricing", "status", "docs", "terms", "privacy", "acceptable-use", "legal", "login", "register"].includes(currentPage);
  const isAdminPage = currentPage.startsWith("admin-");
  const isCustomerPage = !isPublicPage && !isAdminPage;
  if (maintenanceMode && user?.role !== "admin" && user?.role !== "super_admin") {
    if (isCustomerPage) {
      return /* @__PURE__ */ jsxDEV("div", { className: "min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-6 relative font-sans select-none", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" }, void 0, false, {
          fileName: "/app/applet/src/App.tsx",
          lineNumber: 181,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "max-w-md w-full bg-zinc-900/40 border border-zinc-800/80 p-8 rounded-3xl backdrop-blur-md text-center space-y-6 relative shadow-2xl", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center animate-pulse", children: /* @__PURE__ */ jsxDEV(ShieldAlert, { className: "h-8 w-8 text-amber-500" }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 185,
            columnNumber: 15
          }, this) }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 184,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxDEV("h1", { className: "text-xl font-bold tracking-tight text-white uppercase font-mono", children: "System Maintenance" }, void 0, false, {
              fileName: "/app/applet/src/App.tsx",
              lineNumber: 189,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-zinc-400 font-mono", children: "Platform Upgrades In Progress" }, void 0, false, {
              fileName: "/app/applet/src/App.tsx",
              lineNumber: 190,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 188,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-zinc-300 leading-relaxed bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800/50 max-h-[150px] overflow-y-auto scrollbar-thin", children: maintenanceMessage || "AetherPanel is currently performing scheduled system upgrades. We will return online shortly." }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 193,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "pt-2 flex flex-col gap-2.5", children: [
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                onClick: async () => {
                  setCheckingMaintenance(true);
                  await refreshBranding();
                  setTimeout(() => setCheckingMaintenance(false), 800);
                },
                disabled: checkingMaintenance,
                className: "w-full min-h-[44px] rounded-xl text-xs font-semibold text-zinc-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-55 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-400/10",
                children: [
                  /* @__PURE__ */ jsxDEV(RefreshCw, { className: `h-3.5 w-3.5 ${checkingMaintenance ? "animate-spin" : ""}` }, void 0, false, {
                    fileName: "/app/applet/src/App.tsx",
                    lineNumber: 207,
                    columnNumber: 17
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { children: checkingMaintenance ? "Checking status..." : "Check if completed" }, void 0, false, {
                    fileName: "/app/applet/src/App.tsx",
                    lineNumber: 208,
                    columnNumber: 17
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "/app/applet/src/App.tsx",
                lineNumber: 198,
                columnNumber: 15
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                onClick: () => logout(),
                className: "w-full min-h-[44px] rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-950/40 border border-zinc-800/50 hover:border-zinc-800 hover:bg-zinc-900/30 transition-all flex items-center justify-center gap-2",
                children: [
                  /* @__PURE__ */ jsxDEV(LogOut, { className: "h-3.5 w-3.5" }, void 0, false, {
                    fileName: "/app/applet/src/App.tsx",
                    lineNumber: 215,
                    columnNumber: 17
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { children: "Sign Out of Account" }, void 0, false, {
                    fileName: "/app/applet/src/App.tsx",
                    lineNumber: 216,
                    columnNumber: 17
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "/app/applet/src/App.tsx",
                lineNumber: 211,
                columnNumber: 15
              },
              this
            )
          ] }, void 0, true, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 197,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "/app/applet/src/App.tsx",
          lineNumber: 183,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "mt-8 text-[11px] text-zinc-600 font-mono uppercase tracking-widest", children: [
          brandName || "AetherPanel",
          " Control Plane"
        ] }, void 0, true, {
          fileName: "/app/applet/src/App.tsx",
          lineNumber: 221,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "/app/applet/src/App.tsx",
        lineNumber: 180,
        columnNumber: 9
      }, this);
    }
  }
  return /* @__PURE__ */ jsxDEV("div", { className: "min-h-screen max-w-full overflow-x-hidden bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black", children: [
    maintenanceMode && isPublicPage && /* @__PURE__ */ jsxDEV("div", { className: "bg-amber-500 text-black py-2 px-4 text-center text-xs font-bold font-mono tracking-wide shadow-md shrink-0 flex items-center justify-center gap-2 z-50", children: [
      /* @__PURE__ */ jsxDEV(ShieldAlert, { className: "h-4 w-4 shrink-0" }, void 0, false, {
        fileName: "/app/applet/src/App.tsx",
        lineNumber: 234,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("span", { children: "PLATFORM UNDER MAINTENANCE: Server deployment, billing, and write operations are temporarily frozen." }, void 0, false, {
        fileName: "/app/applet/src/App.tsx",
        lineNumber: 235,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "/app/applet/src/App.tsx",
      lineNumber: 233,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV(CustomCursor, {}, void 0, false, {
      fileName: "/app/applet/src/App.tsx",
      lineNumber: 240,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(
      GlobalSearchModal,
      {
        isOpen: isSearchOpen,
        onClose: () => setIsSearchOpen(false),
        onNavigate: handleNavigate
      },
      void 0,
      false,
      {
        fileName: "/app/applet/src/App.tsx",
        lineNumber: 243,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Navbar,
      {
        currentPage,
        onNavigate: handleNavigate,
        onOpenSearch: () => setIsSearchOpen(true)
      },
      void 0,
      false,
      {
        fileName: "/app/applet/src/App.tsx",
        lineNumber: 250,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { className: "flex-1 flex flex-col md:flex-row", children: [
      isCustomerPage && user && /* @__PURE__ */ jsxDEV(
        Sidebar,
        {
          currentPage,
          onNavigate: handleNavigate,
          userServers,
          currentServerId: pageParams?.serverId,
          onSelectServer: (sId) => handleNavigate("server-manage", { serverId: sId })
        },
        void 0,
        false,
        {
          fileName: "/app/applet/src/App.tsx",
          lineNumber: 261,
          columnNumber: 11
        },
        this
      ),
      isAdminPage && user && /* @__PURE__ */ jsxDEV(
        AdminSidebar,
        {
          currentPage,
          onNavigate: handleNavigate
        },
        void 0,
        false,
        {
          fileName: "/app/applet/src/App.tsx",
          lineNumber: 272,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("main", { className: "flex-1 overflow-x-hidden min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 md:p-6", children: [
        /* @__PURE__ */ jsxDEV("div", { children: [
          currentPage === "home" && /* @__PURE__ */ jsxDEV(Home, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 282,
            columnNumber: 38
          }, this),
          currentPage === "minecraft" && /* @__PURE__ */ jsxDEV(MinecraftHosting, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 283,
            columnNumber: 43
          }, this),
          currentPage === "bot" && /* @__PURE__ */ jsxDEV(BotHosting, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 284,
            columnNumber: 37
          }, this),
          currentPage === "pricing" && /* @__PURE__ */ jsxDEV(Pricing, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 285,
            columnNumber: 41
          }, this),
          currentPage === "status" && /* @__PURE__ */ jsxDEV(Status, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 286,
            columnNumber: 40
          }, this),
          currentPage === "docs" && /* @__PURE__ */ jsxDEV(Docs, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 287,
            columnNumber: 38
          }, this),
          currentPage === "terms" && /* @__PURE__ */ jsxDEV(LegalPage, { initialSlug: "terms", onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 288,
            columnNumber: 39
          }, this),
          currentPage === "privacy" && /* @__PURE__ */ jsxDEV(LegalPage, { initialSlug: "privacy", onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 289,
            columnNumber: 41
          }, this),
          currentPage === "acceptable-use" && /* @__PURE__ */ jsxDEV(LegalPage, { initialSlug: "acceptable-use", onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 290,
            columnNumber: 48
          }, this),
          currentPage === "legal" && /* @__PURE__ */ jsxDEV(LegalPage, { initialSlug: pageParams?.initialSlug || "terms", onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 291,
            columnNumber: 39
          }, this),
          currentPage === "login" && /* @__PURE__ */ jsxDEV(Login, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 294,
            columnNumber: 39
          }, this),
          currentPage === "register" && /* @__PURE__ */ jsxDEV(Register, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 295,
            columnNumber: 42
          }, this),
          currentPage === "dashboard" && /* @__PURE__ */ jsxDEV("div", { className: "space-y-6", children: [
            /* @__PURE__ */ jsxDEV(AdBanner, { placement: "dashboard" }, void 0, false, {
              fileName: "/app/applet/src/App.tsx",
              lineNumber: 300,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV(
              Dashboard,
              {
                onNavigate: handleNavigate,
                onSelectServer: (sId) => handleNavigate("server-manage", { serverId: sId })
              },
              void 0,
              false,
              {
                fileName: "/app/applet/src/App.tsx",
                lineNumber: 301,
                columnNumber: 15
              },
              this
            )
          ] }, void 0, true, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 299,
            columnNumber: 13
          }, this),
          currentPage === "servers" && /* @__PURE__ */ jsxDEV("div", { className: "space-y-6", children: [
            /* @__PURE__ */ jsxDEV(AdBanner, { placement: "server_list" }, void 0, false, {
              fileName: "/app/applet/src/App.tsx",
              lineNumber: 309,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV(ServersList, { onNavigate: handleNavigate }, void 0, false, {
              fileName: "/app/applet/src/App.tsx",
              lineNumber: 310,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 308,
            columnNumber: 13
          }, this),
          currentPage === "deploy" && /* @__PURE__ */ jsxDEV(
            ServerDeployWizard,
            {
              onNavigate: handleNavigate,
              onSelectServer: (sId) => handleNavigate("server-manage", { serverId: sId })
            },
            void 0,
            false,
            {
              fileName: "/app/applet/src/App.tsx",
              lineNumber: 314,
              columnNumber: 13
            },
            this
          ),
          currentPage === "server-manage" && /* @__PURE__ */ jsxDEV(
            ServerManage,
            {
              serverId: pageParams.serverId || userServers[0]?.id || "",
              initialTab: pageParams.initialTab,
              onNavigate: handleNavigate
            },
            void 0,
            false,
            {
              fileName: "/app/applet/src/App.tsx",
              lineNumber: 320,
              columnNumber: 13
            },
            this
          ),
          currentPage === "billing" && /* @__PURE__ */ jsxDEV(Billing, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 326,
            columnNumber: 41
          }, this),
          currentPage === "support" && /* @__PURE__ */ jsxDEV(SupportTickets, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 327,
            columnNumber: 41
          }, this),
          currentPage === "activity" && /* @__PURE__ */ jsxDEV(ActivityLog, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 328,
            columnNumber: 42
          }, this),
          currentPage === "settings" && /* @__PURE__ */ jsxDEV(UserSettings, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 329,
            columnNumber: 42
          }, this),
          currentPage === "afk-rewards" && /* @__PURE__ */ jsxDEV(AfkRewards, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 330,
            columnNumber: 45
          }, this),
          currentPage === "admin-dashboard" && /* @__PURE__ */ jsxDEV(AdminDashboard, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 333,
            columnNumber: 49
          }, this),
          currentPage === "admin-users" && /* @__PURE__ */ jsxDEV(AdminUsers, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 334,
            columnNumber: 45
          }, this),
          currentPage === "admin-servers" && /* @__PURE__ */ jsxDEV(AdminServers, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 335,
            columnNumber: 47
          }, this),
          currentPage === "admin-products" && /* @__PURE__ */ jsxDEV(AdminProducts, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 336,
            columnNumber: 48
          }, this),
          currentPage === "admin-backups" && /* @__PURE__ */ jsxDEV(AdminBackups, { onNavigate: handleNavigate }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 337,
            columnNumber: 47
          }, this),
          currentPage === "admin-nodes" && /* @__PURE__ */ jsxDEV(AdminNodes, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 338,
            columnNumber: 45
          }, this),
          currentPage === "admin-monitoring" && /* @__PURE__ */ jsxDEV(AdminMonitoring, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 339,
            columnNumber: 50
          }, this),
          currentPage === "admin-billing" && /* @__PURE__ */ jsxDEV(AdminBilling, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 340,
            columnNumber: 47
          }, this),
          currentPage === "admin-coupons" && /* @__PURE__ */ jsxDEV(AdminCoupons, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 342,
            columnNumber: 47
          }, this),
          currentPage === "admin-announcements" && /* @__PURE__ */ jsxDEV(AdminAnnouncements, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 343,
            columnNumber: 53
          }, this),
          currentPage === "admin-support" && /* @__PURE__ */ jsxDEV(AdminSupport, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 344,
            columnNumber: 47
          }, this),
          currentPage === "admin-audit-logs" && /* @__PURE__ */ jsxDEV(AdminAuditLogs, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 345,
            columnNumber: 50
          }, this),
          currentPage === "admin-legal" && /* @__PURE__ */ jsxDEV(AdminLegal, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 346,
            columnNumber: 45
          }, this),
          currentPage === "admin-diagnostics" && /* @__PURE__ */ jsxDEV(AdminDiagnostics, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 347,
            columnNumber: 51
          }, this),
          currentPage === "admin-settings" && /* @__PURE__ */ jsxDEV(AdminSettings, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 348,
            columnNumber: 48
          }, this),
          currentPage === "admin-ads" && /* @__PURE__ */ jsxDEV(AdminAds, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 349,
            columnNumber: 43
          }, this),
          currentPage === "admin-rewards" && /* @__PURE__ */ jsxDEV(AdminRewards, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 350,
            columnNumber: 47
          }, this),
          currentPage === "admin-discord" && /* @__PURE__ */ jsxDEV(AdminDiscord, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 351,
            columnNumber: 47
          }, this),
          currentPage === "admin-appearance" && /* @__PURE__ */ jsxDEV(AdminAppearance, {}, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 352,
            columnNumber: 50
          }, this)
        ] }, void 0, true, {
          fileName: "/app/applet/src/App.tsx",
          lineNumber: 280,
          columnNumber: 11
        }, this),
        !isPublicPage && /* @__PURE__ */ jsxDEV("footer", { className: "py-3 px-6 border-t border-zinc-900/80 bg-zinc-950/60 text-[11px] text-zinc-500 flex items-center justify-between font-mono shrink-0 mt-8", children: [
          /* @__PURE__ */ jsxDEV("span", { className: "font-medium text-zinc-400", children: "© 2025–2026 AetherPanel" }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 358,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-zinc-600 hidden sm:inline", children: "Enterprise Distributed Control Plane" }, void 0, false, {
            fileName: "/app/applet/src/App.tsx",
            lineNumber: 359,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "/app/applet/src/App.tsx",
          lineNumber: 357,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "/app/applet/src/App.tsx",
        lineNumber: 279,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/app/applet/src/App.tsx",
      lineNumber: 257,
      columnNumber: 7
    }, this),
    isPublicPage && /* @__PURE__ */ jsxDEV(Footer, { onNavigate: handleNavigate }, void 0, false, {
      fileName: "/app/applet/src/App.tsx",
      lineNumber: 366,
      columnNumber: 24
    }, this)
  ] }, void 0, true, {
    fileName: "/app/applet/src/App.tsx",
    lineNumber: 230,
    columnNumber: 5
  }, this);
}
export default function App() {
  return /* @__PURE__ */ jsxDEV(ThemeProvider, { children: /* @__PURE__ */ jsxDEV(BrandingProvider, { children: /* @__PURE__ */ jsxDEV(AuthProvider, { children: /* @__PURE__ */ jsxDEV(AppContent, {}, void 0, false, {
    fileName: "/app/applet/src/App.tsx",
    lineNumber: 377,
    columnNumber: 11
  }, this) }, void 0, false, {
    fileName: "/app/applet/src/App.tsx",
    lineNumber: 376,
    columnNumber: 9
  }, this) }, void 0, false, {
    fileName: "/app/applet/src/App.tsx",
    lineNumber: 375,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/app/applet/src/App.tsx",
    lineNumber: 374,
    columnNumber: 5
  }, this);
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkFwcC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QsIHVzZUNhbGxiYWNrIH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgQXV0aFByb3ZpZGVyLCB1c2VBdXRoIH0gZnJvbSAnLi9saWIvQXV0aENvbnRleHQnO1xuaW1wb3J0IHsgVGhlbWVQcm92aWRlciB9IGZyb20gJy4vbGliL1RoZW1lQ29udGV4dCc7XG5pbXBvcnQgeyBCcmFuZGluZ1Byb3ZpZGVyLCB1c2VCcmFuZGluZyB9IGZyb20gJy4vbGliL0JyYW5kaW5nQ29udGV4dCc7XG5pbXBvcnQgeyBTaGllbGRBbGVydCwgUmVmcmVzaEN3LCBMb2dPdXQgfSBmcm9tICdsdWNpZGUtcmVhY3QnO1xuaW1wb3J0IHsgYXBpUmVxdWVzdCB9IGZyb20gJy4vbGliL2FwaSc7XG5pbXBvcnQgeyBTZXJ2ZXIgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IHBhcnNlVXJsVG9Sb3V0ZSwgcm91dGVUb1VybCB9IGZyb20gJy4vbGliL3JvdXRpbmcnO1xuXG4vLyBDb21wb25lbnRzXG5pbXBvcnQgeyBOYXZiYXIgfSBmcm9tICcuL2NvbXBvbmVudHMvTmF2YmFyJztcbmltcG9ydCB7IFNpZGViYXIgfSBmcm9tICcuL2NvbXBvbmVudHMvU2lkZWJhcic7XG5pbXBvcnQgeyBBZG1pblNpZGViYXIgfSBmcm9tICcuL2NvbXBvbmVudHMvQWRtaW5TaWRlYmFyJztcbmltcG9ydCB7IEZvb3RlciB9IGZyb20gJy4vY29tcG9uZW50cy9Gb290ZXInO1xuaW1wb3J0IHsgQ3VzdG9tQ3Vyc29yIH0gZnJvbSAnLi9jb21wb25lbnRzL0N1c3RvbUN1cnNvcic7XG5pbXBvcnQgeyBBZEJhbm5lciB9IGZyb20gJy4vY29tcG9uZW50cy9BZEJhbm5lcic7XG5pbXBvcnQgeyBHbG9iYWxTZWFyY2hNb2RhbCB9IGZyb20gJy4vY29tcG9uZW50cy9HbG9iYWxTZWFyY2hNb2RhbCc7XG5cbi8vIFB1YmxpYyBQYWdlc1xuaW1wb3J0IHsgSG9tZSB9IGZyb20gJy4vcGFnZXMvcHVibGljL0hvbWUnO1xuaW1wb3J0IHsgTWluZWNyYWZ0SG9zdGluZyB9IGZyb20gJy4vcGFnZXMvcHVibGljL01pbmVjcmFmdEhvc3RpbmcnO1xuaW1wb3J0IHsgQm90SG9zdGluZyB9IGZyb20gJy4vcGFnZXMvcHVibGljL0JvdEhvc3RpbmcnO1xuaW1wb3J0IHsgUHJpY2luZyB9IGZyb20gJy4vcGFnZXMvcHVibGljL1ByaWNpbmcnO1xuaW1wb3J0IHsgU3RhdHVzIH0gZnJvbSAnLi9wYWdlcy9wdWJsaWMvU3RhdHVzJztcbmltcG9ydCB7IERvY3MgfSBmcm9tICcuL3BhZ2VzL3B1YmxpYy9Eb2NzJztcbmltcG9ydCB7IExlZ2FsUGFnZSB9IGZyb20gJy4vcGFnZXMvcHVibGljL0xlZ2FsUGFnZSc7XG5cbi8vIEF1dGggUGFnZXNcbmltcG9ydCB7IExvZ2luIH0gZnJvbSAnLi9wYWdlcy9hdXRoL0xvZ2luJztcbmltcG9ydCB7IFJlZ2lzdGVyIH0gZnJvbSAnLi9wYWdlcy9hdXRoL1JlZ2lzdGVyJztcblxuLy8gQ3VzdG9tZXIgUGFnZXNcbmltcG9ydCB7IERhc2hib2FyZCB9IGZyb20gJy4vcGFnZXMvY3VzdG9tZXIvRGFzaGJvYXJkJztcbmltcG9ydCB7IFNlcnZlckRlcGxveVdpemFyZCB9IGZyb20gJy4vcGFnZXMvY3VzdG9tZXIvU2VydmVyRGVwbG95V2l6YXJkJztcbmltcG9ydCB7IFNlcnZlck1hbmFnZSB9IGZyb20gJy4vcGFnZXMvc2VydmVyL1NlcnZlck1hbmFnZSc7XG5pbXBvcnQgeyBTZXJ2ZXJzTGlzdCB9IGZyb20gJy4vcGFnZXMvY3VzdG9tZXIvU2VydmVyc0xpc3QnO1xuaW1wb3J0IHsgQmlsbGluZyB9IGZyb20gJy4vcGFnZXMvY3VzdG9tZXIvQmlsbGluZyc7XG5pbXBvcnQgeyBTdXBwb3J0VGlja2V0cyB9IGZyb20gJy4vcGFnZXMvY3VzdG9tZXIvU3VwcG9ydFRpY2tldHMnO1xuaW1wb3J0IHsgQWN0aXZpdHlMb2cgfSBmcm9tICcuL3BhZ2VzL2N1c3RvbWVyL0FjdGl2aXR5TG9nJztcbmltcG9ydCB7IFVzZXJTZXR0aW5ncyB9IGZyb20gJy4vcGFnZXMvY3VzdG9tZXIvVXNlclNldHRpbmdzJztcbmltcG9ydCB7IEFma1Jld2FyZHMgfSBmcm9tICcuL3BhZ2VzL2N1c3RvbWVyL0Fma1Jld2FyZHMnO1xuXG4vLyBBZG1pbiBQYWdlc1xuaW1wb3J0IHsgQWRtaW5EYXNoYm9hcmQgfSBmcm9tICcuL3BhZ2VzL2FkbWluL0FkbWluRGFzaGJvYXJkJztcbmltcG9ydCB7IEFkbWluVXNlcnMgfSBmcm9tICcuL3BhZ2VzL2FkbWluL0FkbWluVXNlcnMnO1xuaW1wb3J0IHsgQWRtaW5TZXJ2ZXJzIH0gZnJvbSAnLi9wYWdlcy9hZG1pbi9BZG1pblNlcnZlcnMnO1xuaW1wb3J0IHsgQWRtaW5Qcm9kdWN0cyB9IGZyb20gJy4vcGFnZXMvYWRtaW4vQWRtaW5Qcm9kdWN0cyc7XG5pbXBvcnQgeyBBZG1pbk5vZGVzIH0gZnJvbSAnLi9wYWdlcy9hZG1pbi9BZG1pbk5vZGVzJztcbmltcG9ydCB7IEFkbWluQmlsbGluZyB9IGZyb20gJy4vcGFnZXMvYWRtaW4vQWRtaW5CaWxsaW5nJztcbmltcG9ydCB7IEFkbWluQ291cG9ucyB9IGZyb20gJy4vcGFnZXMvYWRtaW4vQWRtaW5Db3Vwb25zJztcbmltcG9ydCB7IEFkbWluQW5ub3VuY2VtZW50cyB9IGZyb20gJy4vcGFnZXMvYWRtaW4vQWRtaW5Bbm5vdW5jZW1lbnRzJztcbmltcG9ydCB7IEFkbWluU3VwcG9ydCB9IGZyb20gJy4vcGFnZXMvYWRtaW4vQWRtaW5TdXBwb3J0JztcbmltcG9ydCB7IEFkbWluQXVkaXRMb2dzIH0gZnJvbSAnLi9wYWdlcy9hZG1pbi9BZG1pbkF1ZGl0TG9ncyc7XG5pbXBvcnQgeyBBZG1pblNldHRpbmdzIH0gZnJvbSAnLi9wYWdlcy9hZG1pbi9BZG1pblNldHRpbmdzJztcbmltcG9ydCB7IEFkbWluQWRzIH0gZnJvbSAnLi9wYWdlcy9hZG1pbi9BZG1pbkFkcyc7XG5pbXBvcnQgeyBBZG1pblJld2FyZHMgfSBmcm9tICcuL3BhZ2VzL2FkbWluL0FkbWluUmV3YXJkcyc7XG5pbXBvcnQgeyBBZG1pbkFwcGVhcmFuY2UgfSBmcm9tICcuL3BhZ2VzL2FkbWluL0FkbWluQXBwZWFyYW5jZSc7XG5pbXBvcnQgeyBBZG1pbkJhY2t1cHMgfSBmcm9tICcuL3BhZ2VzL2FkbWluL0FkbWluQmFja3Vwcyc7XG5pbXBvcnQgeyBBZG1pbkRpc2NvcmQgfSBmcm9tICcuL3BhZ2VzL2FkbWluL0FkbWluRGlzY29yZCc7XG5pbXBvcnQgeyBBZG1pbk1vbml0b3JpbmcgfSBmcm9tICcuL3BhZ2VzL2FkbWluL0FkbWluTW9uaXRvcmluZyc7XG5pbXBvcnQgeyBBZG1pbkxlZ2FsIH0gZnJvbSAnLi9wYWdlcy9hZG1pbi9BZG1pbkxlZ2FsJztcbmltcG9ydCB7IEFkbWluRGlhZ25vc3RpY3MgfSBmcm9tICcuL3BhZ2VzL2FkbWluL0FkbWluRGlhZ25vc3RpY3MnO1xuXG5cbmZ1bmN0aW9uIEFwcENvbnRlbnQoKSB7XG4gIGNvbnN0IHsgdXNlciwgbG9hZGluZywgbG9nb3V0IH0gPSB1c2VBdXRoKCk7XG4gIGNvbnN0IHsgYnJhbmROYW1lLCBtYWludGVuYW5jZU1vZGUsIG1haW50ZW5hbmNlTWVzc2FnZSwgcmVmcmVzaEJyYW5kaW5nIH0gPSB1c2VCcmFuZGluZygpO1xuICBcbiAgY29uc3QgW2NoZWNraW5nTWFpbnRlbmFuY2UsIHNldENoZWNraW5nTWFpbnRlbmFuY2VdID0gdXNlU3RhdGUoZmFsc2UpO1xuICBcbiAgLy8gUGFyc2UgaW5pdGlhbCByb3V0ZSBkaXJlY3RseSBmcm9tIGN1cnJlbnQgYnJvd3NlciBVUkxcbiAgY29uc3QgaW5pdGlhbFJvdXRlID0gcGFyc2VVcmxUb1JvdXRlKHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZSwgd2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG4gIGNvbnN0IFtjdXJyZW50UGFnZSwgc2V0Q3VycmVudFBhZ2VdID0gdXNlU3RhdGU8c3RyaW5nPihpbml0aWFsUm91dGUucGFnZSk7XG4gIGNvbnN0IFtwYWdlUGFyYW1zLCBzZXRQYWdlUGFyYW1zXSA9IHVzZVN0YXRlPGFueT4oaW5pdGlhbFJvdXRlLnBhcmFtcyk7XG4gIGNvbnN0IFt1c2VyU2VydmVycywgc2V0VXNlclNlcnZlcnNdID0gdXNlU3RhdGU8U2VydmVyW10+KFtdKTtcbiAgY29uc3QgW2lzU2VhcmNoT3Blbiwgc2V0SXNTZWFyY2hPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcblxuICAvLyBHbG9iYWwgQ3RybCtLIC8gQ21kK0sgbGlzdGVuZXJcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBoYW5kbGVLZXlEb3duID0gKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICAgIGlmICgoZS5jdHJsS2V5IHx8IGUubWV0YUtleSkgJiYgZS5rZXkgPT09ICdrJykge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHNldElzU2VhcmNoT3BlbihwcmV2ID0+ICFwcmV2KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgaGFuZGxlS2V5RG93bik7XG4gICAgcmV0dXJuICgpID0+IHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgaGFuZGxlS2V5RG93bik7XG4gIH0sIFtdKTtcblxuICAvLyBTeW5jIHN0YXRlIHdoZW4gYnJvd3NlciBuYXZpZ2F0aW9uIG9jY3VycyAocG9wc3RhdGUpXG4gIGNvbnN0IHN5bmNSb3V0ZUZyb21VcmwgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgY29uc3Qgcm91dGUgPSBwYXJzZVVybFRvUm91dGUod2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLCB3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcbiAgICBzZXRDdXJyZW50UGFnZShyb3V0ZS5wYWdlKTtcbiAgICBzZXRQYWdlUGFyYW1zKHJvdXRlLnBhcmFtcyk7XG4gIH0sIFtdKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIHN5bmNSb3V0ZUZyb21VcmwpO1xuICAgIHJldHVybiAoKSA9PiB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBzeW5jUm91dGVGcm9tVXJsKTtcbiAgfSwgW3N5bmNSb3V0ZUZyb21VcmxdKTtcblxuICAvLyBQcm9ncmFtbWF0aWMgbmF2aWdhdGlvbiB1cGRhdGluZyBicm93c2VyIGhpc3RvcnlcbiAgY29uc3QgaGFuZGxlTmF2aWdhdGUgPSB1c2VDYWxsYmFjaygocGFnZTogc3RyaW5nLCBwYXJhbXM/OiBhbnksIG9wdGlvbnM/OiB7IHJlcGxhY2U/OiBib29sZWFuIH0pID0+IHtcbiAgICBjb25zdCB0YXJnZXRVcmwgPSByb3V0ZVRvVXJsKHBhZ2UsIHBhcmFtcyk7XG4gICAgXG4gICAgaWYgKG9wdGlvbnM/LnJlcGxhY2UpIHtcbiAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7fSwgJycsIHRhcmdldFVybCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5oaXN0b3J5LnB1c2hTdGF0ZSh7fSwgJycsIHRhcmdldFVybCk7XG4gICAgfVxuXG4gICAgc2V0Q3VycmVudFBhZ2UocGFnZSk7XG4gICAgc2V0UGFnZVBhcmFtcyhwYXJhbXMgfHwge30pO1xuICAgIHdpbmRvdy5zY3JvbGxUbyh7IHRvcDogMCwgYmVoYXZpb3I6ICdzbW9vdGgnIH0pO1xuICB9LCBbXSk7XG5cbiAgLy8gRmV0Y2ggc2VydmVycyBmb3IgcXVpY2sgc2VsZWN0b3Igd2hlbiBsb2dnZWQgaW5cbiAgY29uc3QgZmV0Y2hTZXJ2ZXJzID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmICghdXNlcikgcmV0dXJuO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGFwaVJlcXVlc3QoJy9zZXJ2ZXJzJyk7XG4gICAgaWYgKHJlcy5zdWNjZXNzICYmIHJlcy5kYXRhKSB7XG4gICAgICBzZXRVc2VyU2VydmVycyhyZXMuZGF0YSk7XG4gICAgfVxuICB9O1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHVzZXIpIHtcbiAgICAgIGZldGNoU2VydmVycygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZXRVc2VyU2VydmVycyhbXSk7XG4gICAgfVxuICB9LCBbdXNlcl0pO1xuXG4gIC8vIFJvdXRlICYgQXV0aCBndWFyZCBjaGVja3Mgd2l0aG91dCByZXNldHRpbmcgcmVxdWVzdGVkIHJvdXRlXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGxvYWRpbmcpIHJldHVybjtcblxuICAgIGNvbnN0IHB1YmxpY1BhZ2VzID0gWydob21lJywgJ21pbmVjcmFmdCcsICdib3QnLCAncHJpY2luZycsICdzdGF0dXMnLCAnZG9jcycsICd0ZXJtcycsICdwcml2YWN5JywgJ2FjY2VwdGFibGUtdXNlJywgJ2xlZ2FsJywgJ2xvZ2luJywgJ3JlZ2lzdGVyJ107XG4gICAgY29uc3QgaXNQdWJsaWMgPSBwdWJsaWNQYWdlcy5pbmNsdWRlcyhjdXJyZW50UGFnZSk7XG4gICAgY29uc3QgaXNBZG1pbiA9IGN1cnJlbnRQYWdlLnN0YXJ0c1dpdGgoJ2FkbWluLScpO1xuXG4gICAgaWYgKCF1c2VyICYmICFpc1B1YmxpYykge1xuICAgICAgLy8gVW5hdXRoZW50aWNhdGVkIGFjY2VzcyB0byBwcm90ZWN0ZWQgcm91dGUgLT4gcmVkaXJlY3QgdG8gbG9naW4gd2l0aCBvcmlnaW5hbCBwYXRoIGVuY29kZWRcbiAgICAgIGNvbnN0IGZ1bGxQYXRoID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lICsgd2luZG93LmxvY2F0aW9uLnNlYXJjaDtcbiAgICAgIGNvbnN0IHRhcmdldFVybCA9IHJvdXRlVG9VcmwoJ2xvZ2luJywgeyByZWRpcmVjdDogZnVsbFBhdGggfSk7XG4gICAgICB3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoe30sICcnLCB0YXJnZXRVcmwpO1xuICAgICAgc2V0Q3VycmVudFBhZ2UoJ2xvZ2luJyk7XG4gICAgICBzZXRQYWdlUGFyYW1zKHsgcmVkaXJlY3Q6IGZ1bGxQYXRoIH0pO1xuICAgIH0gZWxzZSBpZiAodXNlciAmJiAoY3VycmVudFBhZ2UgPT09ICdsb2dpbicgfHwgY3VycmVudFBhZ2UgPT09ICdyZWdpc3RlcicpKSB7XG4gICAgICAvLyBBdXRoZW50aWNhdGVkIHVzZXIgdmlzaXRzIGF1dGggcGFnZSAtPiByZXR1cm4gdG8gcmVxdWVzdGVkIHBhdGggb3IgZGFzaGJvYXJkXG4gICAgICBjb25zdCByZWRpcmVjdFVybCA9IHBhZ2VQYXJhbXM/LnJlZGlyZWN0IHx8ICcvZGFzaGJvYXJkJztcbiAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7fSwgJycsIHJlZGlyZWN0VXJsKTtcbiAgICAgIGNvbnN0IHJlc3RvcmVkID0gcGFyc2VVcmxUb1JvdXRlKHJlZGlyZWN0VXJsLCAnJyk7XG4gICAgICBzZXRDdXJyZW50UGFnZShyZXN0b3JlZC5wYWdlKTtcbiAgICAgIHNldFBhZ2VQYXJhbXMocmVzdG9yZWQucGFyYW1zKTtcbiAgICB9IGVsc2UgaWYgKHVzZXIgJiYgaXNBZG1pbiAmJiB1c2VyLnJvbGUgIT09ICdhZG1pbicgJiYgdXNlci5yb2xlICE9PSAnc3VwZXJfYWRtaW4nKSB7XG4gICAgICAvLyBOb24tYWRtaW4gdXNlciB2aXNpdGluZyBhZG1pbiByb3V0ZSAtPiByZWRpcmVjdCB0byBjdXN0b21lciBkYXNoYm9hcmRcbiAgICAgIGhhbmRsZU5hdmlnYXRlKCdkYXNoYm9hcmQnLCB7fSwgeyByZXBsYWNlOiB0cnVlIH0pO1xuICAgIH1cbiAgfSwgW3VzZXIsIGxvYWRpbmcsIGN1cnJlbnRQYWdlLCBwYWdlUGFyYW1zLCBoYW5kbGVOYXZpZ2F0ZV0pO1xuXG4gIGlmIChsb2FkaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLWgtc2NyZWVuIGJnLXppbmMtOTUwIHRleHQtd2hpdGUgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZm9udC1zYW5zXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIgZ2FwLTMgdGV4dC14cyB0ZXh0LXppbmMtNDAwXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJoLTggdy04IHJvdW5kZWQtZnVsbCBib3JkZXItMiBib3JkZXItYW1iZXItNTAwIGJvcmRlci10LXRyYW5zcGFyZW50IGFuaW1hdGUtc3BpblwiIC8+XG4gICAgICAgICAgPHNwYW4+UmVzdG9yaW5nIHlvdXIgc2Vzc2lvbi4uLjwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgY29uc3QgaXNQdWJsaWNQYWdlID0gWydob21lJywgJ21pbmVjcmFmdCcsICdib3QnLCAncHJpY2luZycsICdzdGF0dXMnLCAnZG9jcycsICd0ZXJtcycsICdwcml2YWN5JywgJ2FjY2VwdGFibGUtdXNlJywgJ2xlZ2FsJywgJ2xvZ2luJywgJ3JlZ2lzdGVyJ10uaW5jbHVkZXMoY3VycmVudFBhZ2UpO1xuICBjb25zdCBpc0FkbWluUGFnZSA9IGN1cnJlbnRQYWdlLnN0YXJ0c1dpdGgoJ2FkbWluLScpO1xuICBjb25zdCBpc0N1c3RvbWVyUGFnZSA9ICFpc1B1YmxpY1BhZ2UgJiYgIWlzQWRtaW5QYWdlO1xuXG4gIGlmIChtYWludGVuYW5jZU1vZGUgJiYgdXNlcj8ucm9sZSAhPT0gJ2FkbWluJyAmJiB1c2VyPy5yb2xlICE9PSAnc3VwZXJfYWRtaW4nKSB7XG4gICAgaWYgKGlzQ3VzdG9tZXJQYWdlKSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi1oLXNjcmVlbiBiZy1bIzA5MDkwYl0gdGV4dC16aW5jLTEwMCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTYgcmVsYXRpdmUgZm9udC1zYW5zIHNlbGVjdC1ub25lXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhYnNvbHV0ZSB0b3AtMS8yIGxlZnQtMS8yIC10cmFuc2xhdGUteC0xLzIgLXRyYW5zbGF0ZS15LTEvMiB3LVszNTBweF0gaC1bMzUwcHhdIGJnLWFtYmVyLTUwMC81IHJvdW5kZWQtZnVsbCBibHVyLVsxMjBweF0gcG9pbnRlci1ldmVudHMtbm9uZVwiIC8+XG4gICAgICAgICAgXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYXgtdy1tZCB3LWZ1bGwgYmctemluYy05MDAvNDAgYm9yZGVyIGJvcmRlci16aW5jLTgwMC84MCBwLTggcm91bmRlZC0zeGwgYmFja2Ryb3AtYmx1ci1tZCB0ZXh0LWNlbnRlciBzcGFjZS15LTYgcmVsYXRpdmUgc2hhZG93LTJ4bFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJoLTE2IHctMTYgbXgtYXV0byByb3VuZGVkLTJ4bCBiZy1hbWJlci01MDAvMTAgYm9yZGVyIGJvcmRlci1hbWJlci01MDAvMjAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgYW5pbWF0ZS1wdWxzZVwiPlxuICAgICAgICAgICAgICA8U2hpZWxkQWxlcnQgY2xhc3NOYW1lPVwiaC04IHctOCB0ZXh0LWFtYmVyLTUwMFwiIC8+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTJcIj5cbiAgICAgICAgICAgICAgPGgxIGNsYXNzTmFtZT1cInRleHQteGwgZm9udC1ib2xkIHRyYWNraW5nLXRpZ2h0IHRleHQtd2hpdGUgdXBwZXJjYXNlIGZvbnQtbW9ub1wiPlN5c3RlbSBNYWludGVuYW5jZTwvaDE+XG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC16aW5jLTQwMCBmb250LW1vbm9cIj5QbGF0Zm9ybSBVcGdyYWRlcyBJbiBQcm9ncmVzczwvcD5cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtemluYy0zMDAgbGVhZGluZy1yZWxheGVkIGJnLXppbmMtOTUwLzgwIHAtNCByb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLXppbmMtODAwLzUwIG1heC1oLVsxNTBweF0gb3ZlcmZsb3cteS1hdXRvIHNjcm9sbGJhci10aGluXCI+XG4gICAgICAgICAgICAgIHttYWludGVuYW5jZU1lc3NhZ2UgfHwgJ0FldGhlclBhbmVsIGlzIGN1cnJlbnRseSBwZXJmb3JtaW5nIHNjaGVkdWxlZCBzeXN0ZW0gdXBncmFkZXMuIFdlIHdpbGwgcmV0dXJuIG9ubGluZSBzaG9ydGx5Lid9XG4gICAgICAgICAgICA8L3A+XG5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHQtMiBmbGV4IGZsZXgtY29sIGdhcC0yLjVcIj5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2FzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIHNldENoZWNraW5nTWFpbnRlbmFuY2UodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICBhd2FpdCByZWZyZXNoQnJhbmRpbmcoKTtcbiAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gc2V0Q2hlY2tpbmdNYWludGVuYW5jZShmYWxzZSksIDgwMCk7XG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17Y2hlY2tpbmdNYWludGVuYW5jZX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgbWluLWgtWzQ0cHhdIHJvdW5kZWQteGwgdGV4dC14cyBmb250LXNlbWlib2xkIHRleHQtemluYy05MDAgYmctYW1iZXItNDAwIGhvdmVyOmJnLWFtYmVyLTMwMCBkaXNhYmxlZDpvcGFjaXR5LTU1IHRyYW5zaXRpb24tYWxsIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yIHNoYWRvdy1sZyBzaGFkb3ctYW1iZXItNDAwLzEwXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxSZWZyZXNoQ3cgY2xhc3NOYW1lPXtgaC0zLjUgdy0zLjUgJHtjaGVja2luZ01haW50ZW5hbmNlID8gJ2FuaW1hdGUtc3BpbicgOiAnJ31gfSAvPlxuICAgICAgICAgICAgICAgIDxzcGFuPntjaGVja2luZ01haW50ZW5hbmNlID8gJ0NoZWNraW5nIHN0YXR1cy4uLicgOiAnQ2hlY2sgaWYgY29tcGxldGVkJ308L3NwYW4+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuXG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBsb2dvdXQoKX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgbWluLWgtWzQ0cHhdIHJvdW5kZWQteGwgdGV4dC14cyBmb250LXNlbWlib2xkIHRleHQtemluYy00MDAgaG92ZXI6dGV4dC13aGl0ZSBiZy16aW5jLTk1MC80MCBib3JkZXIgYm9yZGVyLXppbmMtODAwLzUwIGhvdmVyOmJvcmRlci16aW5jLTgwMCBob3ZlcjpiZy16aW5jLTkwMC8zMCB0cmFuc2l0aW9uLWFsbCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBnYXAtMlwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8TG9nT3V0IGNsYXNzTmFtZT1cImgtMy41IHctMy41XCIgLz5cbiAgICAgICAgICAgICAgICA8c3Bhbj5TaWduIE91dCBvZiBBY2NvdW50PC9zcGFuPlxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC04IHRleHQtWzExcHhdIHRleHQtemluYy02MDAgZm9udC1tb25vIHVwcGVyY2FzZSB0cmFja2luZy13aWRlc3RcIj5cbiAgICAgICAgICAgIHticmFuZE5hbWUgfHwgJ0FldGhlclBhbmVsJ30gQ29udHJvbCBQbGFuZVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi1oLXNjcmVlbiBtYXgtdy1mdWxsIG92ZXJmbG93LXgtaGlkZGVuIGJnLXppbmMtOTUwIHRleHQtemluYy0xMDAgZmxleCBmbGV4LWNvbCBmb250LXNhbnMgc2VsZWN0aW9uOmJnLWFtYmVyLTUwMCBzZWxlY3Rpb246dGV4dC1ibGFja1wiPlxuICAgICAgey8qIE1haW50ZW5hbmNlIE1vZGUgV2FybmluZyBCYW5uZXIgZm9yIFB1YmxpYyBQYWdlcyAqL31cbiAgICAgIHttYWludGVuYW5jZU1vZGUgJiYgaXNQdWJsaWNQYWdlICYmIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1hbWJlci01MDAgdGV4dC1ibGFjayBweS0yIHB4LTQgdGV4dC1jZW50ZXIgdGV4dC14cyBmb250LWJvbGQgZm9udC1tb25vIHRyYWNraW5nLXdpZGUgc2hhZG93LW1kIHNocmluay0wIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yIHotNTBcIj5cbiAgICAgICAgICA8U2hpZWxkQWxlcnQgY2xhc3NOYW1lPVwiaC00IHctNCBzaHJpbmstMFwiIC8+XG4gICAgICAgICAgPHNwYW4+UExBVEZPUk0gVU5ERVIgTUFJTlRFTkFOQ0U6IFNlcnZlciBkZXBsb3ltZW50LCBiaWxsaW5nLCBhbmQgd3JpdGUgb3BlcmF0aW9ucyBhcmUgdGVtcG9yYXJpbHkgZnJvemVuLjwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuXG4gICAgICB7LyogQ3VzdG9tIEdQVSBDdXJzb3IgKi99XG4gICAgICA8Q3VzdG9tQ3Vyc29yIC8+XG5cbiAgICAgIHsvKiBHbG9iYWwgU2VhcmNoIENvbW1hbmQgUGFsZXR0ZSAqL31cbiAgICAgIDxHbG9iYWxTZWFyY2hNb2RhbFxuICAgICAgICBpc09wZW49e2lzU2VhcmNoT3Blbn1cbiAgICAgICAgb25DbG9zZT17KCkgPT4gc2V0SXNTZWFyY2hPcGVuKGZhbHNlKX1cbiAgICAgICAgb25OYXZpZ2F0ZT17aGFuZGxlTmF2aWdhdGV9XG4gICAgICAvPlxuXG4gICAgICB7LyogVG9wIEhlYWRlciBOYXZiYXIgKi99XG4gICAgICA8TmF2YmFyXG4gICAgICAgIGN1cnJlbnRQYWdlPXtjdXJyZW50UGFnZX1cbiAgICAgICAgb25OYXZpZ2F0ZT17aGFuZGxlTmF2aWdhdGV9XG4gICAgICAgIG9uT3BlblNlYXJjaD17KCkgPT4gc2V0SXNTZWFyY2hPcGVuKHRydWUpfVxuICAgICAgLz5cblxuICAgICAgey8qIE1haW4gQm9keSBMYXlvdXQgKi99XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMSBmbGV4IGZsZXgtY29sIG1kOmZsZXgtcm93XCI+XG4gICAgICAgIFxuICAgICAgICB7LyogQ3VzdG9tZXIgU2lkZWJhciAqL31cbiAgICAgICAge2lzQ3VzdG9tZXJQYWdlICYmIHVzZXIgJiYgKFxuICAgICAgICAgIDxTaWRlYmFyXG4gICAgICAgICAgICBjdXJyZW50UGFnZT17Y3VycmVudFBhZ2V9XG4gICAgICAgICAgICBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX1cbiAgICAgICAgICAgIHVzZXJTZXJ2ZXJzPXt1c2VyU2VydmVyc31cbiAgICAgICAgICAgIGN1cnJlbnRTZXJ2ZXJJZD17cGFnZVBhcmFtcz8uc2VydmVySWR9XG4gICAgICAgICAgICBvblNlbGVjdFNlcnZlcj17KHNJZCkgPT4gaGFuZGxlTmF2aWdhdGUoJ3NlcnZlci1tYW5hZ2UnLCB7IHNlcnZlcklkOiBzSWQgfSl9XG4gICAgICAgICAgLz5cbiAgICAgICAgKX1cblxuICAgICAgICB7LyogQWRtaW4gU2lkZWJhciAqL31cbiAgICAgICAge2lzQWRtaW5QYWdlICYmIHVzZXIgJiYgKFxuICAgICAgICAgIDxBZG1pblNpZGViYXJcbiAgICAgICAgICAgIGN1cnJlbnRQYWdlPXtjdXJyZW50UGFnZX1cbiAgICAgICAgICAgIG9uTmF2aWdhdGU9e2hhbmRsZU5hdmlnYXRlfVxuICAgICAgICAgIC8+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIENvbnRlbnQgVmlld3BvcnQgKi99XG4gICAgICAgIDxtYWluIGNsYXNzTmFtZT1cImZsZXgtMSBvdmVyZmxvdy14LWhpZGRlbiBtaW4taC1bY2FsYygxMDB2aC00cmVtKV0gZmxleCBmbGV4LWNvbCBqdXN0aWZ5LWJldHdlZW4gcC00IG1kOnAtNlwiPlxuICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgey8qIFB1YmxpYyBWaWV3cyAqL31cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdob21lJyAmJiA8SG9tZSBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX0gLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnbWluZWNyYWZ0JyAmJiA8TWluZWNyYWZ0SG9zdGluZyBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX0gLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnYm90JyAmJiA8Qm90SG9zdGluZyBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX0gLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAncHJpY2luZycgJiYgPFByaWNpbmcgb25OYXZpZ2F0ZT17aGFuZGxlTmF2aWdhdGV9IC8+fVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ3N0YXR1cycgJiYgPFN0YXR1cyBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX0gLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnZG9jcycgJiYgPERvY3Mgb25OYXZpZ2F0ZT17aGFuZGxlTmF2aWdhdGV9IC8+fVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ3Rlcm1zJyAmJiA8TGVnYWxQYWdlIGluaXRpYWxTbHVnPVwidGVybXNcIiBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX0gLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAncHJpdmFjeScgJiYgPExlZ2FsUGFnZSBpbml0aWFsU2x1Zz1cInByaXZhY3lcIiBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX0gLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnYWNjZXB0YWJsZS11c2UnICYmIDxMZWdhbFBhZ2UgaW5pdGlhbFNsdWc9XCJhY2NlcHRhYmxlLXVzZVwiIG9uTmF2aWdhdGU9e2hhbmRsZU5hdmlnYXRlfSAvPn1cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdsZWdhbCcgJiYgPExlZ2FsUGFnZSBpbml0aWFsU2x1Zz17cGFnZVBhcmFtcz8uaW5pdGlhbFNsdWcgfHwgJ3Rlcm1zJ30gb25OYXZpZ2F0ZT17aGFuZGxlTmF2aWdhdGV9IC8+fVxuXG4gICAgICAgICAgey8qIEF1dGggVmlld3MgKi99XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnbG9naW4nICYmIDxMb2dpbiBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX0gLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAncmVnaXN0ZXInICYmIDxSZWdpc3RlciBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX0gLz59XG5cbiAgICAgICAgICB7LyogQ3VzdG9tZXIgQ29udHJvbCBQYW5lbCBWaWV3cyAqL31cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdkYXNoYm9hcmQnICYmIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgICAgIDxBZEJhbm5lciBwbGFjZW1lbnQ9XCJkYXNoYm9hcmRcIiAvPlxuICAgICAgICAgICAgICA8RGFzaGJvYXJkXG4gICAgICAgICAgICAgICAgb25OYXZpZ2F0ZT17aGFuZGxlTmF2aWdhdGV9XG4gICAgICAgICAgICAgICAgb25TZWxlY3RTZXJ2ZXI9eyhzSWQpID0+IGhhbmRsZU5hdmlnYXRlKCdzZXJ2ZXItbWFuYWdlJywgeyBzZXJ2ZXJJZDogc0lkIH0pfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdzZXJ2ZXJzJyAmJiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNlwiPlxuICAgICAgICAgICAgICA8QWRCYW5uZXIgcGxhY2VtZW50PVwic2VydmVyX2xpc3RcIiAvPlxuICAgICAgICAgICAgICA8U2VydmVyc0xpc3Qgb25OYXZpZ2F0ZT17aGFuZGxlTmF2aWdhdGV9IC8+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ2RlcGxveScgJiYgKFxuICAgICAgICAgICAgPFNlcnZlckRlcGxveVdpemFyZFxuICAgICAgICAgICAgICBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX1cbiAgICAgICAgICAgICAgb25TZWxlY3RTZXJ2ZXI9eyhzSWQpID0+IGhhbmRsZU5hdmlnYXRlKCdzZXJ2ZXItbWFuYWdlJywgeyBzZXJ2ZXJJZDogc0lkIH0pfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICApfVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ3NlcnZlci1tYW5hZ2UnICYmIChcbiAgICAgICAgICAgIDxTZXJ2ZXJNYW5hZ2VcbiAgICAgICAgICAgICAgc2VydmVySWQ9e3BhZ2VQYXJhbXMuc2VydmVySWQgfHwgdXNlclNlcnZlcnNbMF0/LmlkIHx8ICcnfVxuICAgICAgICAgICAgICBpbml0aWFsVGFiPXtwYWdlUGFyYW1zLmluaXRpYWxUYWJ9XG4gICAgICAgICAgICAgIG9uTmF2aWdhdGU9e2hhbmRsZU5hdmlnYXRlfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICApfVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ2JpbGxpbmcnICYmIDxCaWxsaW5nIG9uTmF2aWdhdGU9e2hhbmRsZU5hdmlnYXRlfSAvPn1cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdzdXBwb3J0JyAmJiA8U3VwcG9ydFRpY2tldHMgb25OYXZpZ2F0ZT17aGFuZGxlTmF2aWdhdGV9IC8+fVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ2FjdGl2aXR5JyAmJiA8QWN0aXZpdHlMb2cgLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnc2V0dGluZ3MnICYmIDxVc2VyU2V0dGluZ3MgLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnYWZrLXJld2FyZHMnICYmIDxBZmtSZXdhcmRzIC8+fVxuXG4gICAgICAgICAgey8qIEFkbWluIFZpZXdzICovfVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ2FkbWluLWRhc2hib2FyZCcgJiYgPEFkbWluRGFzaGJvYXJkIG9uTmF2aWdhdGU9e2hhbmRsZU5hdmlnYXRlfSAvPn1cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdhZG1pbi11c2VycycgJiYgPEFkbWluVXNlcnMgLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnYWRtaW4tc2VydmVycycgJiYgPEFkbWluU2VydmVycyAvPn1cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdhZG1pbi1wcm9kdWN0cycgJiYgPEFkbWluUHJvZHVjdHMgLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnYWRtaW4tYmFja3VwcycgJiYgPEFkbWluQmFja3VwcyBvbk5hdmlnYXRlPXtoYW5kbGVOYXZpZ2F0ZX0gLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnYWRtaW4tbm9kZXMnICYmIDxBZG1pbk5vZGVzIC8+fVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ2FkbWluLW1vbml0b3JpbmcnICYmIDxBZG1pbk1vbml0b3JpbmcgLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnYWRtaW4tYmlsbGluZycgJiYgPEFkbWluQmlsbGluZyAvPn1cblxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ2FkbWluLWNvdXBvbnMnICYmIDxBZG1pbkNvdXBvbnMgLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnYWRtaW4tYW5ub3VuY2VtZW50cycgJiYgPEFkbWluQW5ub3VuY2VtZW50cyAvPn1cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdhZG1pbi1zdXBwb3J0JyAmJiA8QWRtaW5TdXBwb3J0IC8+fVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ2FkbWluLWF1ZGl0LWxvZ3MnICYmIDxBZG1pbkF1ZGl0TG9ncyAvPn1cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdhZG1pbi1sZWdhbCcgJiYgPEFkbWluTGVnYWwgLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnYWRtaW4tZGlhZ25vc3RpY3MnICYmIDxBZG1pbkRpYWdub3N0aWNzIC8+fVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ2FkbWluLXNldHRpbmdzJyAmJiA8QWRtaW5TZXR0aW5ncyAvPn1cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdhZG1pbi1hZHMnICYmIDxBZG1pbkFkcyAvPn1cbiAgICAgICAgICB7Y3VycmVudFBhZ2UgPT09ICdhZG1pbi1yZXdhcmRzJyAmJiA8QWRtaW5SZXdhcmRzIC8+fVxuICAgICAgICAgIHtjdXJyZW50UGFnZSA9PT0gJ2FkbWluLWRpc2NvcmQnICYmIDxBZG1pbkRpc2NvcmQgLz59XG4gICAgICAgICAge2N1cnJlbnRQYWdlID09PSAnYWRtaW4tYXBwZWFyYW5jZScgJiYgPEFkbWluQXBwZWFyYW5jZSAvPn1cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIHsvKiBTdWJ0bGUgUGFuZWwgRm9vdGVyIGZvciBDdXN0b21lciAmIEFkbWluIFBhZ2VzICovfVxuICAgICAgICAgIHshaXNQdWJsaWNQYWdlICYmIChcbiAgICAgICAgICAgIDxmb290ZXIgY2xhc3NOYW1lPVwicHktMyBweC02IGJvcmRlci10IGJvcmRlci16aW5jLTkwMC84MCBiZy16aW5jLTk1MC82MCB0ZXh0LVsxMXB4XSB0ZXh0LXppbmMtNTAwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBmb250LW1vbm8gc2hyaW5rLTAgbXQtOFwiPlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LW1lZGl1bSB0ZXh0LXppbmMtNDAwXCI+wqkgMjAyNeKAkzIwMjYgQWV0aGVyUGFuZWw8L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIHRleHQtemluYy02MDAgaGlkZGVuIHNtOmlubGluZVwiPkVudGVycHJpc2UgRGlzdHJpYnV0ZWQgQ29udHJvbCBQbGFuZTwvc3Bhbj5cbiAgICAgICAgICAgIDwvZm9vdGVyPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvbWFpbj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICB7LyogRm9vdGVyIGZvciBQdWJsaWMgVmlld3MgKi99XG4gICAgICB7aXNQdWJsaWNQYWdlICYmIDxGb290ZXIgb25OYXZpZ2F0ZT17aGFuZGxlTmF2aWdhdGV9IC8+fVxuXG4gICAgPC9kaXY+XG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEFwcCgpIHtcbiAgcmV0dXJuIChcbiAgICA8VGhlbWVQcm92aWRlcj5cbiAgICAgIDxCcmFuZGluZ1Byb3ZpZGVyPlxuICAgICAgICA8QXV0aFByb3ZpZGVyPlxuICAgICAgICAgIDxBcHBDb250ZW50IC8+XG4gICAgICAgIDwvQXV0aFByb3ZpZGVyPlxuICAgICAgPC9CcmFuZGluZ1Byb3ZpZGVyPlxuICAgIDwvVGhlbWVQcm92aWRlcj5cbiAgKTtcbn1cbiJdLCJtYXBwaW5ncyI6IkFBcUtVO0FBcktWLFNBQWdCLFVBQVUsV0FBVyxtQkFBbUI7QUFDeEQsU0FBUyxjQUFjLGVBQWU7QUFDdEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxrQkFBa0IsbUJBQW1CO0FBQzlDLFNBQVMsYUFBYSxXQUFXLGNBQWM7QUFDL0MsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxpQkFBaUIsa0JBQWtCO0FBRzVDLFNBQVMsY0FBYztBQUN2QixTQUFTLGVBQWU7QUFDeEIs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