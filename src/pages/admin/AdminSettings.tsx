import React, { useState, useEffect } from 'react';
import {
  Sliders, Save, Check, QrCode, CreditCard, Building, CheckCircle2,
  XCircle, Clock, AlertCircle, RefreshCw, GitBranch, ArrowUpCircle,
  Terminal, ShieldCheck, Cpu, HardDrive, Sparkles, Loader2, CheckCircle,
  AlertTriangle, HelpCircle, Key, Lock, Shield, Globe, ExternalLink, Copy,
  Database, Plus, Trash2, Edit3, X, Disc as DiscordIcon, Twitter, Github, Share2
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useBranding } from '../../lib/BrandingContext';
import { Order, PaymentGatewaySettings, PanelVersionInfo, UpdateJobState, AuthProviderSettings, DatabaseHost, SocialLinks, NetworkProtectionStatus } from '../../types';

export const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'auth' | 'security' | 'payments' | 'pending' | 'updates' | 'network_sftp' | 'databases' | 'network_protection'>('general');

  // Network Protection States
  const [netProtectStatus, setNetProtectStatus] = useState<NetworkProtectionStatus | null>(null);
  const [loadingNetProtect, setLoadingNetProtect] = useState(false);
  const [reconcilingRules, setReconcilingRules] = useState(false);
  const [detectingCapabilities, setDetectingCapabilities] = useState(false);
  const [netProtectMsg, setNetProtectMsg] = useState<string | null>(null);

  const fetchNetworkProtectionStatus = async () => {
    setLoadingNetProtect(true);
    try {
      const res = await apiRequest('/admin/network-protection/status');
      if (res.success && res.data) {
        setNetProtectStatus(res.data);
      }
    } catch {}
    setLoadingNetProtect(false);
  };

  const handleRunDetectCapabilities = async () => {
    setDetectingCapabilities(true);
    setNetProtectMsg(null);
    try {
      const res = await apiRequest('/admin/network-protection/detect', { method: 'POST' });
      if (res.success && res.data) {
        setNetProtectStatus(res.data);
        setNetProtectMsg(res.message || 'Capability detection completed successfully.');
      } else {
        setNetProtectMsg(res.error?.message || 'Failed to detect capabilities.');
      }
    } catch (err: any) {
      setNetProtectMsg(err.message || 'Error running capability detection.');
    }
    setDetectingCapabilities(false);
  };

  const handleReconcileRules = async () => {
    setReconcilingRules(true);
    setNetProtectMsg(null);
    try {
      const res = await apiRequest('/admin/network-protection/reconcile', { method: 'POST' });
      if (res.success && res.data) {
        setNetProtectStatus(res.data);
        setNetProtectMsg(res.message || 'Server firewall rules reconciled successfully.');
      } else {
        setNetProtectMsg(res.error?.message || 'Failed to reconcile rules.');
      }
    } catch (err: any) {
      setNetProtectMsg(err.message || 'Error reconciling server rules.');
    }
    setReconcilingRules(false);
  };

  // General Settings
  const [brandName, setBrandName] = useState('AetherPanel');
  const [brandTagline, setBrandTagline] = useState('Premium Minecraft & Discord Bot Hosting');
  const [supportEmail, setSupportEmail] = useState('support@aetherpanel.com');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [enablePlayit, setEnablePlayit] = useState(true);
  const [togglingGlobalPlayit, setTogglingGlobalPlayit] = useState(false);
  const [pageAnimationsEnabled, setPageAnimationsEnabled] = useState(true);

  // Social Links Settings
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    discord: 'https://discord.gg/aetherpanel',
    twitter: 'https://twitter.com/aetherpanel',
    github: 'https://github.com/aetherpanel'
  });
  const [savingSocialLinks, setSavingSocialLinks] = useState(false);
  const [socialLinksSuccess, setSocialLinksSuccess] = useState<string | null>(null);
  const [socialLinksError, setSocialLinksError] = useState<string | null>(null);

  // Auth Provider Settings
  const [authProviders, setAuthProviders] = useState<AuthProviderSettings>({
    emailPassword: { enabled: true },
    google: {
      enabled: true,
      firebaseApiKey: '',
      firebaseAuthDomain: '',
      firebaseProjectId: '',
      firebaseStorageBucket: '',
      firebaseMessagingSenderId: '',
      firebaseAppId: ''
    },
    discord: {
      enabled: true,
      clientId: '',
      clientSecret: '',
      redirectUri: ''
    }
  });

  // Auth Test States
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [googleTestResult, setGoogleTestResult] = useState<any>(null);
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState<any>(null);
  const [copiedDiscordUri, setCopiedDiscordUri] = useState(false);

  // Anti-Abuse & VPN Protection Settings
  const [antiAbuse, setAntiAbuse] = useState({
    enabled: false,
    provider: 'proxycheck' as 'proxycheck' | 'ipqualityscore' | 'custom',
    apiKey: '',
    blockVpn: true,
    blockProxy: true,
    blockTor: true,
    blockDatacenter: false,
    maxRiskScore: 65,
    maxRegistrationsPerIpPerDay: 2,
    loginLockoutMaxAttempts: 5,
    loginLockoutDurationSec: 300
  });
  const [testingAntiAbuse, setTestingAntiAbuse] = useState(false);
  const [antiAbuseTestResult, setAntiAbuseTestResult] = useState<any>(null);

  // System Version & Updates
  const [versionInfo, setVersionInfo] = useState<PanelVersionInfo | null>(null);
  const [updateJob, setUpdateJob] = useState<UpdateJobState | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [triggeringUpdate, setTriggeringUpdate] = useState(false);

  // Payment Gateway Settings
  const [gateways, setGateways] = useState<PaymentGatewaySettings>({
    upi: {
      enabled: true,
      upiId: 'aetherpay@upi',
      merchantName: 'AetherPanel Hosting',
      qrCodeUrl: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=400&q=80',
      instructions: 'Scan the QR code or send payment to the UPI ID. Enter the 12-digit UTR or Transaction Ref ID after payment.'
    },
    bank: {
      enabled: true,
      bankName: 'HDFC Bank / Global Web Bank',
      accountNumber: '918237192837',
      ifsc: 'HDFC0001234',
      accountHolder: 'Aether Cloud Infrastructure LLC',
      instructions: 'Transfer to Bank Account and submit your NEFT/IMPS/Wire Reference Number.'
    },
    crypto: {
      enabled: false,
      walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      network: 'USDT (TRC20 / ERC20)',
      instructions: 'Send USDT to the wallet address and submit TX Hash.'
    },
    stripe: {
      enabled: true,
      instructions: 'Instant automatic payment via Credit/Debit Card or Wallet.'
    }
  });

  // Pending Orders
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [saved, setSaved] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Network & SFTP Tab States
  const [networkSftpDetails, setNetworkSftpDetails] = useState<any>(null);
  const [fetchingNetwork, setFetchingNetwork] = useState(false);

  // Database Hosts state
  const [databaseHosts, setDatabaseHosts] = useState<DatabaseHost[]>([]);
  const [loadingDbHosts, setLoadingDbHosts] = useState(false);
  const [showAddHostModal, setShowAddHostModal] = useState(false);
  const [editingHost, setEditingHost] = useState<DatabaseHost | null>(null);
  const [hostForm, setHostForm] = useState<{
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    dbType: 'mysql' | 'postgres';
    maxDatabases?: number;
  }>({
    name: '',
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: '',
    dbType: 'mysql',
    maxDatabases: undefined
  });
  const [testingHost, setTestingHost] = useState(false);
  const [hostTestResult, setHostTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingHost, setIsSavingHost] = useState(false);
  const [hostModalError, setHostModalError] = useState<string | null>(null);

  const fetchNetworkSftpData = async () => {
    setFetchingNetwork(true);
    try {
      const sftpRes = await apiRequest('/admin/network/sftp');
      if (sftpRes.success) {
        setNetworkSftpDetails(sftpRes.data);
      }
    } catch {}
    setFetchingNetwork(false);
  };

  const fetchSettings = async () => {
    const res = await apiRequest('/admin/settings');
    if (res.success && res.data) {
      setBrandName(res.data.brandName || 'AetherPanel');
      setBrandTagline(res.data.brandTagline || '');
      setSupportEmail(res.data.supportEmail || 'support@aetherpanel.com');
      setCurrencySymbol(res.data.currencySymbol || '$');
      setRegistrationEnabled(res.data.registrationEnabled ?? true);
      setMaintenanceMode(res.data.maintenanceMode ?? false);
      setEnablePlayit(res.data.enablePlayit ?? true);
      setPageAnimationsEnabled(res.data.pageAnimationsEnabled ?? true);
      if (res.data.socialLinks) {
        setSocialLinks({
          discord: res.data.socialLinks.discord ?? '',
          twitter: res.data.socialLinks.twitter ?? '',
          github: res.data.socialLinks.github ?? ''
        });
      }
      if (res.data.paymentGateways) {
        setGateways(res.data.paymentGateways);
      }
    }
  };

  const fetchAuthProviders = async () => {
    const res = await apiRequest('/admin/auth-providers');
    if (res.success && res.data) {
      setAuthProviders(res.data);
    }
  };

  const fetchAntiAbuse = async () => {
    const res = await apiRequest('/admin/anti-abuse');
    if (res.success && res.data) {
      setAntiAbuse(res.data);
    }
  };

  const handleTestGoogle = async () => {
    setTestingGoogle(true);
    setGoogleTestResult(null);
    const res = await apiRequest('/admin/auth-providers/test-google', { method: 'POST' });
    setTestingGoogle(false);
    if (res.success && res.data) {
      setGoogleTestResult(res.data);
    } else {
      setGoogleTestResult({ status: 'ERROR', message: res.error?.message || 'Failed to test Google config' });
    }
  };

  const handleTestDiscord = async () => {
    setTestingDiscord(true);
    setDiscordTestResult(null);
    const res = await apiRequest('/admin/auth-providers/test-discord', { method: 'POST' });
    setTestingDiscord(false);
    if (res.success && res.data) {
      setDiscordTestResult(res.data);
    } else {
      setDiscordTestResult({ status: 'ERROR', message: res.error?.message || 'Failed to test Discord config' });
    }
  };

  const handleTestAntiAbuse = async () => {
    setTestingAntiAbuse(true);
    setAntiAbuseTestResult(null);
    const res = await apiRequest('/admin/anti-abuse/test', { method: 'POST' });
    setTestingAntiAbuse(false);
    if (res.success && res.data) {
      setAntiAbuseTestResult(res.data);
    } else {
      setAntiAbuseTestResult({ status: 'ERROR', message: res.error?.message || 'Failed to test Anti-Abuse' });
    }
  };

  const handleSaveAntiAbuse = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/admin/anti-abuse', {
      method: 'PUT',
      body: JSON.stringify(antiAbuse)
    });
    if (res.success) {
      setSaved(true);
      if (res.data) setAntiAbuse(res.data);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setActionMsg(res.error?.message || 'Failed to save Anti-Abuse settings.');
    }
  };

  const fetchPendingOrders = async () => {
    setLoadingOrders(true);
    const res = await apiRequest('/admin/orders?status=pending');
    if (res.success && res.data) {
      setPendingOrders(res.data);
    }
    setLoadingOrders(false);
  };

  const fetchVersionInfo = async (forceCheck = false) => {
    if (forceCheck) setCheckingUpdates(true);
    const url = forceCheck ? '/admin/update/check' : '/admin/version';
    const res = await apiRequest(url);
    if (res.success && res.data) {
      setVersionInfo(res.data);
    }
    if (forceCheck) setCheckingUpdates(false);
  };

  const fetchDatabaseHosts = async () => {
    setLoadingDbHosts(true);
    const res = await apiRequest('/admin/database-hosts');
    if (res.success && res.data) {
      setDatabaseHosts(res.data);
    }
    setLoadingDbHosts(false);
  };

  const handleTestHostConnection = async () => {
    setTestingHost(true);
    setHostTestResult(null);
    setHostModalError(null);

    const res = await apiRequest('/admin/database-hosts/test', {
      method: 'POST',
      body: JSON.stringify({
        id: editingHost?.id,
        host: hostForm.host,
        port: hostForm.port,
        username: hostForm.username,
        password: hostForm.password,
        dbType: hostForm.dbType
      })
    });

    setTestingHost(false);
    if (res.success) {
      setHostTestResult({ success: true, message: res.message || 'Connection successful!' });
    } else {
      setHostTestResult({ success: false, message: res.error?.message || 'Connection failed.' });
    }
  };

  const handleSaveDatabaseHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostForm.name || !hostForm.host || !hostForm.username) {
      setHostModalError('Name, Host, and Username are required.');
      return;
    }

    setIsSavingHost(true);
    setHostModalError(null);

    const res = await apiRequest('/admin/database-hosts', {
      method: 'POST',
      body: JSON.stringify({
        id: editingHost?.id,
        name: hostForm.name,
        host: hostForm.host,
        port: hostForm.port,
        username: hostForm.username,
        password: hostForm.password,
        dbType: hostForm.dbType,
        maxDatabases: hostForm.maxDatabases
      })
    });

    setIsSavingHost(false);
    if (res.success) {
      setShowAddHostModal(false);
      setEditingHost(null);
      setActionMsg(res.message || 'Database host saved successfully.');
      setTimeout(() => setActionMsg(null), 4000);
      fetchDatabaseHosts();
    } else {
      setHostModalError(res.error?.message || 'Failed to save database host.');
    }
  };

  const handleDeleteDatabaseHost = async (hostId: string, hostName: string) => {
    if (!window.confirm(`Are you sure you want to remove database host '${hostName}'? Existing servers may no longer connect if this provider is active.`)) return;

    const res = await apiRequest(`/admin/database-hosts/${hostId}`, {
      method: 'DELETE'
    });

    if (res.success) {
      setActionMsg(`Database host '${hostName}' removed.`);
      setTimeout(() => setActionMsg(null), 4000);
      fetchDatabaseHosts();
    } else {
      setActionMsg(res.error?.message || 'Failed to delete database host.');
    }
  };

  const pollUpdateStatus = async () => {
    const res = await apiRequest('/admin/update/status');
    if (res.success && res.data) {
      setUpdateJob(res.data);
      if (res.data.status === 'completed' || res.data.status === 'failed') {
        fetchVersionInfo(false);
      }
    }
  };

  const handleExecuteUpdate = async () => {
    if (!window.confirm('Are you sure you want to execute the panel update? A configuration snapshot will be created automatically.')) return;
    setTriggeringUpdate(true);
    const res = await apiRequest('/admin/update/execute', { method: 'POST' });
    setTriggeringUpdate(false);
    if (res.success) {
      setActionMsg('Update pipeline initiated.');
      pollUpdateStatus();
    } else {
      setActionMsg(res.error?.message || 'Failed to start update.');
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchAuthProviders();
    fetchPendingOrders();
    fetchVersionInfo();
    pollUpdateStatus();
  }, []);

  useEffect(() => {
    let timer: any;
    if (updateJob?.status === 'in_progress') {
      timer = setInterval(pollUpdateStatus, 1500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [updateJob?.status]);

  const { updateBrandNameLocally, refreshBranding, setEnablePlayitLocally, setPageAnimationsEnabledLocally, setSocialLinksLocally } = useBranding();

  const handleSaveSocialLinks = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSocialLinks(true);
    setSocialLinksSuccess(null);
    setSocialLinksError(null);

    try {
      const res = await apiRequest('/admin/settings/social-links', {
        method: 'PUT',
        body: JSON.stringify(socialLinks)
      });

      if (res.success) {
        setSocialLinksSuccess(res.message || 'Social links updated successfully.');
        setSocialLinksLocally(socialLinks);
        await refreshBranding();
        setTimeout(() => setSocialLinksSuccess(null), 4000);
      } else {
        setSocialLinksError(res.error?.message || 'Failed to update social links.');
      }
    } catch (err: any) {
      setSocialLinksError(err?.message || 'An error occurred while saving social links.');
    } finally {
      setSavingSocialLinks(false);
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        brandName,
        brandTagline,
        supportEmail,
        currencySymbol,
        registrationEnabled,
        maintenanceMode,
        enablePlayit,
        pageAnimationsEnabled,
        socialLinks
      })
    });
    if (res.success) {
      updateBrandNameLocally(brandName);
      setEnablePlayitLocally(enablePlayit);
      setPageAnimationsEnabledLocally(pageAnimationsEnabled);
      setSocialLinksLocally(socialLinks);
      await refreshBranding();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setActionMsg(res.error?.message || 'Failed to save settings');
    }
  };

  const handleToggleGlobalPlayit = async (enabled: boolean) => {
    setTogglingGlobalPlayit(true);
    setEnablePlayit(enabled);
    const res = await apiRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        brandName,
        brandTagline,
        supportEmail,
        currencySymbol,
        registrationEnabled,
        maintenanceMode,
        enablePlayit: enabled,
        pageAnimationsEnabled
      })
    });
    setTogglingGlobalPlayit(false);
    if (res.success) {
      setEnablePlayitLocally(enabled);
      setPageAnimationsEnabledLocally(pageAnimationsEnabled);
      await refreshBranding();
      setActionMsg(enabled ? 'Playit.GG has been enabled globally.' : 'Playit.GG has been disabled globally.');
      setTimeout(() => setActionMsg(null), 4000);
    } else {
      setEnablePlayit(!enabled); // revert state on error
      alert(res.error?.message || 'Failed to update Playit setting');
    }
  };

  const handleSaveAuthProviders = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/admin/auth-providers', {
      method: 'PUT',
      body: JSON.stringify(authProviders)
    });
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setActionMsg(res.error?.message || 'Failed to save authentication settings.');
    }
  };

  const handleSavePayments = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/admin/payment-settings', {
      method: 'PUT',
      body: JSON.stringify(gateways)
    });
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    const res = await apiRequest(`/admin/orders/${orderId}/approve`, { method: 'POST' });
    if (res.success) {
      setActionMsg(res.message || 'Payment approved!');
      fetchPendingOrders();
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt('Reason for rejecting payment:');
    if (reason === null) return;

    const res = await apiRequest(`/admin/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    if (res.success) {
      setActionMsg(res.message || 'Payment rejected.');
      fetchPendingOrders();
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="border-b border-amber-500/20 pb-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sliders className="h-6 w-6 text-amber-400" /> Platform Configuration
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Manage global system parameters, authentication methods, payment gateways, and updates.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap bg-zinc-900 border border-zinc-800 p-1 rounded-2xl gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-2 rounded-xl transition-all ${activeTab === 'general' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            General
          </button>
          <button
            onClick={() => { setActiveTab('auth'); fetchAuthProviders(); }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'auth' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <Shield className="h-3.5 w-3.5" /> Auth Providers
          </button>
          <button
            onClick={() => { setActiveTab('security'); fetchAntiAbuse(); }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'security' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <Lock className="h-3.5 w-3.5" /> Anti-Abuse & Security
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'payments' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <QrCode className="h-3.5 w-3.5" /> Payments & QR
          </button>
          <button
            onClick={() => { setActiveTab('pending'); fetchPendingOrders(); }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 relative ${activeTab === 'pending' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <Clock className="h-3.5 w-3.5 text-amber-400" /> Pending Approvals
            {pendingOrders.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500 text-white font-bold">
                {pendingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('network_sftp'); fetchNetworkSftpData(); }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 relative ${activeTab === 'network_sftp' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <Globe className="h-3.5 w-3.5" /> Network & SFTP
          </button>
          <button
            onClick={() => { setActiveTab('network_protection'); fetchNetworkProtectionStatus(); }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 relative ${activeTab === 'network_protection' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> Network Protection
          </button>
          <button
            onClick={() => { setActiveTab('databases'); fetchDatabaseHosts(); }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 relative ${activeTab === 'databases' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <Database className="h-3.5 w-3.5" /> Database Hosts
          </button>
          <button
            onClick={() => { setActiveTab('updates'); fetchVersionInfo(); pollUpdateStatus(); }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 relative ${activeTab === 'updates' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <ArrowUpCircle className="h-3.5 w-3.5" /> Updates
            {versionInfo?.isUpdateAvailable && (
              <span className="ml-1 h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </button>
        </div>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center gap-2">
          <Check className="h-4 w-4" /> Configuration saved successfully!
        </div>
      )}

      {actionMsg && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {actionMsg}
        </div>
      )}

      {/* TAB 1: General Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-5">
          <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-3">Branding & System Toggles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Brand Name</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Support Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tagline</label>
            <input
              type="text"
              value={brandTagline}
              onChange={(e) => setBrandTagline(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
            <div>
              <div className="text-xs font-bold text-white">Public User Registration</div>
              <div className="text-[11px] text-zinc-400">Allow new customers to create accounts.</div>
            </div>
            <input
              type="checkbox"
              checked={registrationEnabled}
              onChange={(e) => setRegistrationEnabled(e.target.checked)}
              className="h-4 w-4 accent-amber-500 rounded"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
            <div>
              <div className="text-xs font-bold text-white">Platform Maintenance Mode</div>
              <div className="text-[11px] text-zinc-400">Display maintenance banner to non-admin users.</div>
            </div>
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              className="h-4 w-4 accent-rose-500 rounded"
            />
          </div>

          {/* Playit.GG Global Integration Toggle */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-white">Playit.GG Integration</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    enablePlayit
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${enablePlayit ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                    {enablePlayit ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-zinc-200">Enable Playit.GG</div>
                <p className="text-[11px] text-zinc-400">
                  Allow customers and servers to use Playit.GG agent connectivity and claiming features.
                </p>
                <p className="text-[11px] text-zinc-500">
                  {enablePlayit
                    ? 'Playit.GG features are available throughout the panel.'
                    : 'Playit.GG features are hidden from customers.'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  disabled={togglingGlobalPlayit}
                  checked={enablePlayit}
                  onChange={(e) => handleToggleGlobalPlayit(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* Appearance & Experience — Page Animations */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-white">Appearance & Experience</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    pageAnimationsEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${pageAnimationsEnabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                    {pageAnimationsEnabled ? 'On' : 'Off'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-zinc-200">Enable Page Animations</div>
                <p className="text-[11px] text-zinc-400">
                  Control premium entrance animations for the Homepage, Login, and Signup pages.
                </p>
                <p className="text-[11px] text-zinc-500">
                  {pageAnimationsEnabled
                    ? 'Animations will run on initial public and auth page entrance.'
                    : 'Entrance animations are disabled globally for a faster feel.'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={pageAnimationsEnabled}
                  onChange={(e) => setPageAnimationsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* SOCIAL LINKS */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Share2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Social Links</h3>
                  <p className="text-[11px] text-zinc-400">Configure global Discord, X / Twitter, and GitHub profile links across the panel.</p>
                </div>
              </div>
            </div>

            {socialLinksSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" /> {socialLinksSuccess}
              </div>
            )}

            {socialLinksError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {socialLinksError}
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <DiscordIcon className="w-3.5 h-3.5 text-amber-400" /> Discord URL
                </label>
                <input
                  type="url"
                  value={socialLinks.discord}
                  onChange={(e) => setSocialLinks(prev => ({ ...prev, discord: e.target.value }))}
                  placeholder="https://discord.gg/example"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Twitter className="w-3.5 h-3.5 text-amber-400" /> X / Twitter URL
                </label>
                <input
                  type="url"
                  value={socialLinks.twitter}
                  onChange={(e) => setSocialLinks(prev => ({ ...prev, twitter: e.target.value }))}
                  placeholder="https://x.com/example"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Github className="w-3.5 h-3.5 text-amber-400" /> GitHub URL
                </label>
                <input
                  type="url"
                  value={socialLinks.github}
                  onChange={(e) => setSocialLinks(prev => ({ ...prev, github: e.target.value }))}
                  placeholder="https://github.com/example"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-zinc-500">
                Leaving a link empty will automatically hide that icon in the public footer and navigation.
              </p>
              <button
                type="button"
                onClick={() => handleSaveSocialLinks()}
                disabled={savingSocialLinks}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors shrink-0"
              >
                {savingSocialLinks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Social Links
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB: Authentication Providers */}
      {activeTab === 'auth' && (
        <form onSubmit={handleSaveAuthProviders} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">Authentication Providers & Social Logins</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Toggle sign-in methods and configure Firebase & Discord OAuth credentials.</p>
            </div>
          </div>

          {/* Email / Password Provider */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Email & Password Authentication</div>
                  <div className="text-[11px] text-zinc-400">Allow users to register and sign in with standard email credentials.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={authProviders.emailPassword?.enabled ?? true}
                  onChange={(e) => setAuthProviders(prev => ({
                    ...prev,
                    emailPassword: { enabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* Google Firebase Authentication */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Google Login (Firebase Authentication)</div>
                  <div className="text-[11px] text-zinc-400">One-click Google Sign-in and account creation powered by Firebase Auth.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={authProviders.google?.enabled ?? true}
                  onChange={(e) => setAuthProviders(prev => ({
                    ...prev,
                    google: { ...prev.google, enabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {authProviders.google?.enabled && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Firebase API Key</label>
                    <input
                      type="text"
                      value={authProviders.google?.firebaseApiKey || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        google: {
                          ...prev.google,
                          firebaseApiKey: e.target.value
                        }
                      }))}
                      placeholder="AIzaSy..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Firebase Auth Domain</label>
                    <input
                      type="text"
                      value={authProviders.google?.firebaseAuthDomain || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        google: {
                          ...prev.google,
                          firebaseAuthDomain: e.target.value
                        }
                      }))}
                      placeholder="project-id.firebaseapp.com"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Firebase Project ID</label>
                    <input
                      type="text"
                      value={authProviders.google?.firebaseProjectId || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        google: {
                          ...prev.google,
                          firebaseProjectId: e.target.value
                        }
                      }))}
                      placeholder="my-aetherpanel-app"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Firebase App ID</label>
                    <input
                      type="text"
                      value={authProviders.google?.firebaseAppId || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        google: {
                          ...prev.google,
                          firebaseAppId: e.target.value
                        }
                      }))}
                      placeholder="1:123456789:web:abcdef"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={testingGoogle}
                    onClick={handleTestGoogle}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingGoogle ? 'animate-spin text-amber-400' : ''}`} />
                    <span>{testingGoogle ? 'Verifying...' : 'Test Google Auth Configuration'}</span>
                  </button>

                  {googleTestResult && (
                    <div className={`text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 border font-mono ${
                      googleTestResult.status === 'CONFIGURED' || googleTestResult.status === 'PASS'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : googleTestResult.status === 'NOT_CONFIGURED'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {googleTestResult.status === 'CONFIGURED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>[{googleTestResult.status}] {googleTestResult.message || (googleTestResult.missingFields ? `Missing: ${googleTestResult.missingFields.join(', ')}` : '')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Discord OAuth2 */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#5865F2]/10 text-[#5865F2] border border-[#5865F2]/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Discord OAuth2 Login</div>
                  <div className="text-[11px] text-zinc-400">Allow users to log in directly with their Discord accounts.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={authProviders.discord?.enabled ?? true}
                  onChange={(e) => setAuthProviders(prev => ({
                    ...prev,
                    discord: { ...prev.discord, enabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {authProviders.discord?.enabled && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Discord Client ID (Application ID)</label>
                    <input
                      type="text"
                      value={authProviders.discord?.clientId || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        discord: { ...prev.discord, clientId: e.target.value }
                      }))}
                      placeholder="123456789012345678"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Discord Client Secret</label>
                    <input
                      type="password"
                      value={authProviders.discord?.clientSecret || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        discord: { ...prev.discord, clientSecret: e.target.value }
                      }))}
                      placeholder="••••••••••••••••"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400 p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <strong className="text-zinc-200">Discord OAuth2 Redirect URI (Current Installation):</strong>
                    <button
                      type="button"
                      onClick={() => {
                        const uriToCopy = authProviders.discord?.redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}/api/v1/auth/discord/callback` : '');
                        if (uriToCopy) {
                          navigator.clipboard.writeText(uriToCopy);
                          setCopiedDiscordUri(true);
                          setTimeout(() => setCopiedDiscordUri(false), 2000);
                        }
                      }}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedDiscordUri ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedDiscordUri ? 'Copied' : 'Copy URI'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    <code className="text-amber-400 font-mono text-xs break-all">
                      {authProviders.discord?.redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}/api/v1/auth/discord/callback` : '/api/v1/auth/discord/callback')}
                    </code>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Add this exact dynamic URI to your application inside Discord Developer Portal → OAuth2 → Redirects.
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={testingDiscord}
                    onClick={handleTestDiscord}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingDiscord ? 'animate-spin text-[#5865F2]' : ''}`} />
                    <span>{testingDiscord ? 'Verifying...' : 'Test Discord OAuth Configuration'}</span>
                  </button>

                  {discordTestResult && (
                    <div className={`text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 border font-mono ${
                      discordTestResult.status === 'CONFIGURED' || discordTestResult.status === 'PASS'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : discordTestResult.status === 'NOT_CONFIGURED'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {discordTestResult.status === 'CONFIGURED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>[{discordTestResult.status}] {discordTestResult.message || (discordTestResult.missingFields ? `Missing: ${discordTestResult.missingFields.join(', ')}` : '')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Auth Provider Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB: Security & Anti-Abuse */}
      {activeTab === 'security' && (
        <form onSubmit={handleSaveAntiAbuse} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" /> Anti-Abuse, VPN/Proxy Detection & Account Security
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Automated registration protection against VPNs, Proxies, Tor nodes, and brute-force credential stuffing.</p>
            </div>
          </div>

          {/* Master Toggle */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Enable Real-Time IP Threat Intelligence</div>
                <div className="text-[11px] text-zinc-400">Evaluate connecting registration IP addresses against proxy/VPN detection databases.</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={antiAbuse.enabled}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* IP Risk Provider Settings */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">Threat Intelligence Provider</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Intelligence Provider</label>
                <select
                  value={antiAbuse.provider}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, provider: e.target.value as any }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="proxycheck">Proxycheck.io (Recommended)</option>
                  <option value="ipqualityscore">IPQualityScore (IPQS)</option>
                  <option value="custom">Custom / Fallback</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Provider API Key</label>
                <input
                  type="password"
                  value={antiAbuse.apiKey || ''}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter Proxycheck or IPQS API key..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Leave empty to use public evaluation limits if supported by the provider.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={testingAntiAbuse}
                onClick={handleTestAntiAbuse}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingAntiAbuse ? 'animate-spin text-amber-400' : ''}`} />
                <span>{testingAntiAbuse ? 'Querying API...' : 'Test Intelligence API Connection'}</span>
              </button>

              {antiAbuseTestResult && (
                <div className={`text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 border font-mono ${
                  antiAbuseTestResult.status === 'PASS' || antiAbuseTestResult.status === 'CONFIGURED'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : antiAbuseTestResult.status === 'NOT_CONFIGURED'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {antiAbuseTestResult.status === 'PASS' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  <span>[{antiAbuseTestResult.status}] {antiAbuseTestResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Blocking Rules */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">Blocking Rules & Thresholds</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                <span className="text-xs text-zinc-200 font-medium">Block VPNs</span>
                <input
                  type="checkbox"
                  checked={antiAbuse.blockVpn}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, blockVpn: e.target.checked }))}
                  className="h-4 w-4 accent-amber-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                <span className="text-xs text-zinc-200 font-medium">Block HTTP/SOCKS Proxies</span>
                <input
                  type="checkbox"
                  checked={antiAbuse.blockProxy}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, blockProxy: e.target.checked }))}
                  className="h-4 w-4 accent-amber-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                <span className="text-xs text-zinc-200 font-medium">Block Tor Exit Nodes</span>
                <input
                  type="checkbox"
                  checked={antiAbuse.blockTor}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, blockTor: e.target.checked }))}
                  className="h-4 w-4 accent-amber-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                <span className="text-xs text-zinc-200 font-medium">Block Datacenter/Hosting IPs</span>
                <input
                  type="checkbox"
                  checked={antiAbuse.blockDatacenter}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, blockDatacenter: e.target.checked }))}
                  className="h-4 w-4 accent-amber-500 rounded"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Max IP Risk Score (0-100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={antiAbuse.maxRiskScore}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, maxRiskScore: parseInt(e.target.value) || 65 }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Default 65. Lower is stricter.</p>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Max Registrations / IP / Day</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={antiAbuse.maxRegistrationsPerIpPerDay}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, maxRegistrationsPerIpPerDay: parseInt(e.target.value) || 2 }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Prevents bulk account creation spam.</p>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Login Lockout Attempts / Duration</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={antiAbuse.loginLockoutMaxAttempts}
                    onChange={(e) => setAntiAbuse(prev => ({ ...prev, loginLockoutMaxAttempts: parseInt(e.target.value) || 5 }))}
                    className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white font-mono text-center focus:outline-none focus:border-amber-500"
                    title="Max failed attempts"
                  />
                  <input
                    type="number"
                    min={60}
                    max={3600}
                    value={antiAbuse.loginLockoutDurationSec}
                    onChange={(e) => setAntiAbuse(prev => ({ ...prev, loginLockoutDurationSec: parseInt(e.target.value) || 300 }))}
                    className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white font-mono text-center focus:outline-none focus:border-amber-500"
                    title="Lockout duration in seconds"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Max attempts / seconds locked.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10">
              <Save className="h-4 w-4" /> Save Security & Anti-Abuse Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Payment Gateways & QR Code Configuration */}
      {activeTab === 'payments' && (
        <form onSubmit={handleSavePayments} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">Payment Gateways & QR Code Billing</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Enable instant UPI QR codes, direct bank transfer info, or crypto deposit addresses.</p>
            </div>
            <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Gateways
            </button>
          </div>

          {/* UPI Gateway */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">UPI QR Code Gateway (India & Instant)</h3>
              </div>
              <input
                type="checkbox"
                checked={gateways.upi.enabled}
                onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, enabled: e.target.checked } })}
                className="h-4 w-4 accent-amber-500 rounded"
              />
            </div>

            {gateways.upi.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">UPI VPA / ID</label>
                  <input
                    type="text"
                    value={gateways.upi.upiId}
                    onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, upiId: e.target.value } })}
                    placeholder="merchant@upi"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Merchant Display Name</label>
                  <input
                    type="text"
                    value={gateways.upi.merchantName}
                    onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, merchantName: e.target.value } })}
                    placeholder="AetherPanel Hosting"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-zinc-400 font-medium mb-1">Static QR Code Image URL (Direct PNG/JPG)</label>
                  <input
                    type="text"
                    value={gateways.upi.qrCodeUrl}
                    onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, qrCodeUrl: e.target.value } })}
                    placeholder="https://i.imgur.com/your-upi-qr.png"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bank Transfer Gateway */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Bank Wire / IMPS / NEFT Details</h3>
              </div>
              <input
                type="checkbox"
                checked={gateways.bank.enabled}
                onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, enabled: e.target.checked } })}
                className="h-4 w-4 accent-amber-500 rounded"
              />
            </div>

            {gateways.bank.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={gateways.bank.bankName}
                    onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, bankName: e.target.value } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Account Holder</label>
                  <input
                    type="text"
                    value={gateways.bank.accountHolder}
                    onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, accountHolder: e.target.value } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Account Number / IBAN</label>
                  <input
                    type="text"
                    value={gateways.bank.accountNumber}
                    onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, accountNumber: e.target.value } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">IFSC / Swift / Routing Code</label>
                  <input
                    type="text"
                    value={gateways.bank.ifsc}
                    onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, ifsc: e.target.value } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      {/* TAB 3: Pending Approvals */}
      {activeTab === 'pending' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">Manual Payment Proofs Pending Approval</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Verify user transaction reference numbers or UTRs and credit user balances.</p>
            </div>
            <button
              onClick={fetchPendingOrders}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          {loadingOrders ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">Loading pending orders...</div>
          ) : pendingOrders.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
              No pending payment approvals at this time.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono">{order.id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-bold">
                        {order.paymentMethod || 'MANUAL'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-300">
                      Amount: <strong className="text-emerald-400 font-mono">${order.amount.toFixed(2)}</strong> ({order.planName})
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      Ref / UTR: <span className="text-white font-bold">{order.transactionRef || 'None provided'}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Submitted: {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleRejectOrder(order.id)}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => handleApproveOrder(order.id)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Credit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Updates & System Version */}
      {activeTab === 'updates' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-amber-400" /> AetherPanel Upstream Version & Health
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Automated Git sync, dependency checks, and migrations.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={checkingUpdates || triggeringUpdate}
                  onClick={() => fetchVersionInfo(true)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${checkingUpdates ? 'animate-spin text-amber-400' : ''}`} />
                  <span>{checkingUpdates ? 'Checking...' : 'Check for Updates'}</span>
                </button>
                {versionInfo?.isUpdateAvailable && (
                  <button
                    type="button"
                    disabled={triggeringUpdate || updateJob?.status === 'in_progress'}
                    onClick={handleExecuteUpdate}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    <span>Apply Update Now</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono uppercase text-zinc-500">Current Version</div>
                <div className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <span>v{versionInfo?.currentVersion || '2.4.0'}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">STABLE</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono uppercase text-zinc-500">Latest Available</div>
                <div className="text-base font-bold text-cyan-400 font-mono">
                  v{versionInfo?.latestVersion || '2.4.0'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono uppercase text-zinc-500">Update Status</div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-1">
                  {versionInfo?.isUpdateAvailable ? (
                    <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Update Ready</span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> System Up-to-date</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-[11px] text-zinc-500 font-mono">
                Last Checked: {versionInfo?.lastCheckedAt ? new Date(versionInfo.lastCheckedAt).toLocaleTimeString() : 'Never'}
              </div>
            </div>

            {versionInfo?.updateReleaseNotes && (
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-zinc-300">
                <span className="font-semibold text-cyan-300">Upstream Commit / Changelog: </span>
                {versionInfo.updateReleaseNotes}
              </div>
            )}
          </div>

          {/* Active Update Execution Status */}
          {updateJob && updateJob.status !== 'idle' && (
            <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-5">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Live Update Pipeline Diagnostics</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  updateJob.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : updateJob.status === 'failed'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                }`}>
                  {updateJob.status}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-300">{updateJob.currentStep}</span>
                  <span className="text-amber-400 font-mono">{updateJob.progressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${updateJob.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Terminal Logs Output */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 font-mono text-xs text-zinc-300 max-h-60 overflow-y-auto space-y-1">
                {updateJob.logs.length === 0 ? (
                  <div className="text-zinc-600">Initializing pipeline...</div>
                ) : (
                  updateJob.logs.map((l, i) => (
                    <div key={i} className={`${l.includes('❌') || l.includes('ERROR') ? 'text-rose-400 font-bold' : l.includes('✓') || l.includes('SUCCESS') ? 'text-emerald-400' : ''}`}>
                      {l}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Network & SFTP */}
      {activeTab === 'network_sftp' && (
        <div className="space-y-6">
          {fetchingNetwork ? (
            <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-3">
              <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
              <p className="text-xs text-zinc-400">Performing real-time network diagnostics and checking Playit agent...</p>
            </div>
          ) : (
            <>
              {/* Core Status Header & Badges */}
              <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-zinc-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Globe className="h-4 w-4 text-amber-400" /> Network Connectivity & Routing Mode
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Autorouting selects direct high-speed SFTP if publicly reachable, with seamless Playit.GG tunnel fallback.</p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchNetworkSftpData}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh Status
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Mode */}
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Active Routing Mode</div>
                    <div className="text-base font-bold text-white flex items-center gap-2">
                      {networkSftpDetails?.mode === 'direct' ? (
                        <>
                          <span className="text-emerald-400 font-bold uppercase tracking-wide">Direct SFTP</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">DIRECT</span>
                        </>
                      ) : networkSftpDetails?.mode === 'playit' ? (
                        <>
                          <span className="text-cyan-400 font-bold uppercase tracking-wide">Playit.GG Tunnel</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">TUNNELED</span>
                        </>
                      ) : (
                        <>
                          <span className="text-rose-400 font-bold uppercase tracking-wide">Unavailable</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">OFFLINE</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Reachability */}
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">External Reachability</div>
                    <div className="text-base font-bold flex items-center gap-2">
                      {networkSftpDetails?.reachable ? (
                        <span className="text-emerald-400 flex items-center gap-1.5 text-xs font-semibold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> REACHABLE FROM INTERNET
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1.5 text-xs font-semibold">
                          <XCircle className="h-4 w-4 text-rose-400" /> UNREACHABLE DIRECTLY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SFTP Address */}
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Dynamic SFTP Endpoint</div>
                    <div className="text-xs font-mono font-bold text-amber-400">
                      {networkSftpDetails?.host ? `${networkSftpDetails.host}:${networkSftpDetails.port}` : 'Unavailable'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: Network Protection */}
      {activeTab === 'network_protection' && (
        <div className="space-y-6">
          {loadingNetProtect ? (
            <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-3">
              <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
              <p className="text-xs text-zinc-400">Probing host firewall capabilities and reconciling server port rules...</p>
            </div>
          ) : (
            <>
              {/* Header & Main Controls */}
              <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-zinc-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-amber-400" /> Host Network Protection & Dynamic Firewall
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Non-destructive iptables/nftables/ufw firewall management, SYN flood mitigation, rate limiting, and dynamic server port allocation.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={loadingNetProtect}
                      onClick={fetchNetworkProtectionStatus}
                      className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingNetProtect ? 'animate-spin text-amber-400' : ''}`} />
                      <span>Refresh Status</span>
                    </button>

                    <button
                      type="button"
                      disabled={detectingCapabilities}
                      onClick={handleRunDetectCapabilities}
                      className="px-3.5 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${detectingCapabilities ? 'animate-spin' : ''}`} />
                      <span>{detectingCapabilities ? 'Probing...' : 'Re-run Detection'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={reconcilingRules}
                      onClick={handleReconcileRules}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${reconcilingRules ? 'animate-spin' : ''}`} />
                      <span>{reconcilingRules ? 'Reconciling...' : 'Reconcile Rules'}</span>
                    </button>
                  </div>
                </div>

                {/* Optional Action Result Notification */}
                {netProtectMsg && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0" />
                      <span>{netProtectMsg}</span>
                    </div>
                    <button onClick={() => setNetProtectMsg(null)} className="text-zinc-400 hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* 4 Primary Status Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Host Firewall */}
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Host Firewall</div>
                    <div className="text-base font-bold flex items-center gap-2">
                      {netProtectStatus?.hostFirewall === 'active' ? (
                        <>
                          <span className="text-emerald-400 uppercase tracking-wide">Active</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ONLINE</span>
                        </>
                      ) : netProtectStatus?.hostFirewall === 'restricted' ? (
                        <>
                          <span className="text-cyan-400 uppercase tracking-wide">Restricted</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">SHIELD MODE</span>
                        </>
                      ) : (
                        <>
                          <span className="text-rose-400 uppercase tracking-wide">Unavailable</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">INACTIVE</span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      Backend: <span className="text-amber-400">{netProtectStatus?.firewallBackend || 'Unknown'}</span>
                    </div>
                  </div>

                  {/* Card 2: Connection Protection */}
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Connection Shield</div>
                    <div className="text-base font-bold flex items-center gap-2">
                      {netProtectStatus?.connectionProtection === 'active' ? (
                        <span className="text-emerald-400 flex items-center gap-1.5 text-xs font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> FULL HARDENING
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1.5 text-xs font-bold">
                          <AlertTriangle className="h-4 w-4 text-amber-400" /> APP LEVEL PROTECTION
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      SYN flood limits & packet filters active
                    </div>
                  </div>

                  {/* Card 3: Panel API Protection */}
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Panel API Protection</div>
                    <div className="text-base font-bold flex items-center gap-2">
                      <span className="text-emerald-400 flex items-center gap-1.5 text-xs font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" /> RATE-LIMITED
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      240 req/min general, auth brute-force shield
                    </div>
                  </div>

                  {/* Card 4: Managed Server Ports */}
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Managed Server Ports</div>
                    <div className="text-base font-bold text-amber-400 font-mono">
                      {netProtectStatus?.managedPortCount || 0} Ports Authorized
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Automatic rule sync for created servers
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Panels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Panel 1: Dynamic Preserved Ports */}
                <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                    <Key className="h-4 w-4 text-amber-400" /> Preserved System Ports
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-white">Active SSH Port</div>
                        <div className="text-[10px] text-zinc-400">Auto-detected from sshd config</div>
                      </div>
                      <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        :{netProtectStatus?.sshPort || 22}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-white">AetherPanel Web UI</div>
                        <div className="text-[10px] text-zinc-400">Frontend & REST API</div>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        :{netProtectStatus?.panelPort || 3000}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-white">SFTP Server Daemon</div>
                        <div className="text-[10px] text-zinc-400">High-speed file transfer</div>
                      </div>
                      <span className="font-mono text-cyan-400 font-bold bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                        :{netProtectStatus?.sftpPort || 2022}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-white">AetherNode Daemon</div>
                        <div className="text-[10px] text-zinc-400">Node communication endpoint</div>
                      </div>
                      <span className="font-mono text-zinc-300 font-bold bg-zinc-800 px-2.5 py-1 rounded-lg">
                        :{netProtectStatus?.daemonPort || 8080}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Host Environment */}
                <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                    <Cpu className="h-4 w-4 text-amber-400" /> Host Environment & Privileges
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                      <div className="text-[10px] uppercase text-zinc-500 font-mono">Environment Virtualization</div>
                      <div className="font-semibold text-white">{netProtectStatus?.environment?.containerType || 'VPS / Linux Host'}</div>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                      <div className="text-[10px] uppercase text-zinc-500 font-mono">Privilege Level</div>
                      <div className="font-semibold text-emerald-400">
                        {netProtectStatus?.environment?.isRoot ? 'Privileged (Root UID 0)' : 'Unprivileged Container'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                      <div className="text-[10px] uppercase text-zinc-500 font-mono">Kernel Netfilter Control</div>
                      <div className="font-semibold text-zinc-300">
                        {netProtectStatus?.environment?.isWritable ? 'Direct Netfilter Table Injection' : 'Application-Level Shield Active'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                      <div className="text-[10px] uppercase text-zinc-500 font-mono">Last Rule Reconciliation</div>
                      <div className="font-mono text-[11px] text-zinc-400">
                        {netProtectStatus?.lastReconciled ? new Date(netProtectStatus.lastReconciled).toLocaleString() : 'Just now'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel 3: Active Protections */}
                <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                    <Lock className="h-4 w-4 text-amber-400" /> Security Rules & Pass-Through
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="text-zinc-300 font-medium">SYN Flood Mitigation</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${netProtectStatus?.activeProtections?.synFloodMitigation ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                        {netProtectStatus?.activeProtections?.synFloodMitigation ? 'KERNEL LEVEL' : 'APP LEVEL'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="text-zinc-300 font-medium">Invalid Packet Drop</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                        ACTIVE
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="text-zinc-300 font-medium">Bot Outbound Pass-Through</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                        DISCORD / DNS / HTTPS
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="text-zinc-300 font-medium">Auth Brute-Force Protection</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                        30 ATTEMPTS / 5M
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="text-zinc-300 font-medium">Isolated Rule Chains</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        NON-DESTRUCTIVE
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Managed Server Port Registry */}
              <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Globe className="h-4 w-4 text-amber-400" /> Active Server Port Firewall Registry
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Dynamically authorized inbound TCP/UDP ports allocated for Minecraft servers and Discord bots.
                    </p>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 rounded-xl bg-zinc-950 text-amber-400 border border-zinc-800 font-bold">
                    {netProtectStatus?.managedPorts?.length || 0} Total Allocated
                  </span>
                </div>

                {!netProtectStatus?.managedPorts || netProtectStatus.managedPorts.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <Globe className="h-8 w-8 text-zinc-600 mx-auto" />
                    <div className="text-xs text-zinc-400">No custom game server port rules active yet.</div>
                    <p className="text-[11px] text-zinc-500">Creating a Minecraft or application server automatically authorizes its port across the firewall backend.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500 font-mono uppercase text-[10px]">
                          <th className="py-2.5 px-3">Port</th>
                          <th className="py-2.5 px-3">Protocol</th>
                          <th className="py-2.5 px-3">Associated Server</th>
                          <th className="py-2.5 px-3">Server ID</th>
                          <th className="py-2.5 px-3 text-right">Rule Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {netProtectStatus.managedPorts.map((mp, i) => (
                          <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-amber-400">:{mp.port}</td>
                            <td className="py-3 px-3 font-mono uppercase text-zinc-300">{mp.protocol}</td>
                            <td className="py-3 px-3 text-white font-medium">{mp.serverName || 'System Server'}</td>
                            <td className="py-3 px-3 font-mono text-zinc-500 text-[11px]">{mp.serverId || 'N/A'}</td>
                            <td className="py-3 px-3 text-right">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="h-3 w-3" /> ALLOWED
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 8: DATABASE HOSTS */}
      {activeTab === 'databases' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="h-5 w-5 text-amber-400" /> Database Host Providers
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Manage dedicated MySQL and PostgreSQL host servers used to dynamically provision client server databases.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingHost(null);
                  setHostForm({
                    name: '',
                    host: '127.0.0.1',
                    port: 3306,
                    username: 'root',
                    password: '',
                    dbType: 'mysql',
                    maxDatabases: undefined
                  });
                  setHostTestResult(null);
                  setHostModalError(null);
                  setShowAddHostModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-xs font-bold text-zinc-950 rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/10"
              >
                <Plus className="h-4 w-4" /> Add Database Host
              </button>
            </div>

            {/* Environment Fallback Notice */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
              <div className="font-semibold text-zinc-300 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-amber-400" /> Environment Variable Auto-Discovery
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                If no database hosts are added here, AetherPanel will automatically fallback to standard environment variables: <code className="text-amber-300 font-mono">MYSQL_HOST</code>, <code className="text-amber-300 font-mono">MYSQL_PORT</code>, <code className="text-amber-300 font-mono">MYSQL_USER</code>, <code className="text-amber-300 font-mono">MYSQL_PASSWORD</code> or <code className="text-amber-300 font-mono">PGHOST</code>, <code className="text-amber-300 font-mono">PGPORT</code>, <code className="text-amber-300 font-mono">PGUSER</code>, <code className="text-amber-300 font-mono">PGPASSWORD</code>.
              </p>
            </div>
          </div>

          {/* Database Hosts Grid */}
          {loadingDbHosts ? (
            <div className="p-12 text-center text-xs text-zinc-400 space-y-3">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-400" />
              <p>Loading database host providers...</p>
            </div>
          ) : databaseHosts.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800 space-y-3">
              <Database className="h-10 w-10 text-zinc-600 mx-auto" />
              <div className="text-sm font-semibold text-zinc-300">No Database Hosts Configured</div>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Add an external MySQL/MariaDB or PostgreSQL instance above so users can provision isolated schemas for their Minecraft servers and Discord bots.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {databaseHosts.map((host) => (
                <div key={host.id} className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{host.name}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{host.host}:{host.port}</div>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                        host.dbType === 'postgres'
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      }`}>
                        {host.dbType}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 text-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Admin User:</span>
                        <strong className="text-white">{host.username}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Password:</span>
                        <strong className="text-zinc-500 font-mono">••••••••</strong>
                      </div>
                      {host.maxDatabases && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Max Databases:</span>
                          <strong className="text-white">{host.maxDatabases}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-2 pt-2 border-t border-zinc-800">
                    <button
                      onClick={() => {
                        setEditingHost(host);
                        setHostForm({
                          name: host.name,
                          host: host.host,
                          port: host.port,
                          username: host.username,
                          password: '',
                          dbType: host.dbType,
                          maxDatabases: host.maxDatabases
                        });
                        setHostTestResult(null);
                        setHostModalError(null);
                        setShowAddHostModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDatabaseHost(host.id, host.name)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Database Host Modal */}
      {showAddHostModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-amber-400" />
                {editingHost ? 'Edit Database Host' : 'Add Database Host Provider'}
              </h3>
              <button onClick={() => setShowAddHostModal(false)} className="text-zinc-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {hostModalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{hostModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDatabaseHost} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Provider Name</label>
                  <input
                    type="text"
                    required
                    value={hostForm.name}
                    onChange={(e) => setHostForm({ ...hostForm, name: e.target.value })}
                    placeholder="e.g. Primary MySQL Cluster"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Engine Type</label>
                  <select
                    value={hostForm.dbType}
                    onChange={(e) => {
                      const newType = e.target.value as 'mysql' | 'postgres';
                      setHostForm({
                        ...hostForm,
                        dbType: newType,
                        port: newType === 'postgres' ? 5432 : 3306
                      });
                    }}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
                  >
                    <option value="mysql">MySQL / MariaDB</option>
                    <option value="postgres">PostgreSQL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Host / IP Address</label>
                  <input
                    type="text"
                    required
                    value={hostForm.host}
                    onChange={(e) => setHostForm({ ...hostForm, host: e.target.value })}
                    placeholder="127.0.0.1 or mysql.internal"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Port</label>
                  <input
                    type="number"
                    required
                    value={hostForm.port}
                    onChange={(e) => setHostForm({ ...hostForm, port: parseInt(e.target.value, 10) || (hostForm.dbType === 'postgres' ? 5432 : 3306) })}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Master / Admin Username</label>
                  <input
                    type="text"
                    required
                    value={hostForm.username}
                    onChange={(e) => setHostForm({ ...hostForm, username: e.target.value })}
                    placeholder="root or postgres"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Master Password {editingHost && <span className="text-zinc-500 font-normal">(leave blank to keep)</span>}
                  </label>
                  <input
                    type="password"
                    value={hostForm.password}
                    onChange={(e) => setHostForm({ ...hostForm, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Test Connection Button & Result */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestHostConnection}
                  disabled={testingHost || !hostForm.host || !hostForm.username}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${testingHost ? 'animate-spin' : ''}`} />
                  <span>{testingHost ? 'Testing Host Connection...' : 'Test Connection'}</span>
                </button>

                {hostTestResult && (
                  <div className={`text-xs flex items-center gap-1.5 font-medium ${hostTestResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {hostTestResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span className="truncate max-w-xs">{hostTestResult.message}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddHostModal(false)}
                  disabled={isSavingHost}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHost}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-xs text-zinc-950 font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingHost ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Host...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Save Database Host</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
