import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal, Sparkles, Palette, MousePointer, ShieldCheck,
  Layout, HelpCircle, HardDrive, Search, Mail, Lock, AlertTriangle,
  Download, Upload, RotateCcw, Save, CheckCircle2, RefreshCw, Plus,
  Trash2, Edit3, Send, Check, ExternalLink, Globe, Server, Terminal,
  Sliders, ChevronRight, X, AlertCircle
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useTheme } from '../../lib/ThemeContext';
import { useBranding } from '../../lib/BrandingContext';
import { useAuth } from '../../lib/AuthContext';
import { FONT_OPTIONS, THEME_PRESETS } from '../../lib/theme';

type TabKey =
  | 'branding'
  | 'theme'
  | 'hero'
  | 'cursor'
  | 'features'
  | 'layout'
  | 'content'
  | 'deployment'
  | 'seo'
  | 'email'
  | 'security'
  | 'maintenance'
  | 'backup_restore';

interface FaqItem {
  id: string;
  category?: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export const AdminPanelCustomization: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('branding');
  const { activeFontId, setActiveFontId, setThemeAssets } = useTheme();
  const { refreshBranding, updateBrandNameLocally } = useBranding();
  const { refreshAuthConfig } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Consolidated Configuration State
  const [config, setConfig] = useState<any>({
    branding: {
      brandName: 'AetherPanel',
      brandTagline: 'High-Performance Cloud & Game Server Hosting',
      logoUrl: '',
      faviconUrl: '',
      supportEmail: 'support@aetherpanel.com',
      currencySymbol: '€',
      currencyCode: 'EUR',
      discordUrl: 'https://discord.gg/aetherpanel',
      twitterUrl: '',
      githubUrl: ''
    },
    theme: {
      accentColor: '#FF6A00',
      accentHover: '#E85D00',
      accentDim: '#CC5200',
      defaultTheme: 'dark',
      cardRadius: '8px',
      fontFamily: 'Inter'
    },
    hero: {
      enabled: true,
      autoplayInterval: 6000,
      kenBurns: true,
      pauseOnHover: true,
      slides: []
    },
    cursor: {
      enabled: true,
      defaultActive: true,
      cursorStyle: 'arrow-pointer',
      color: '#FF6A00',
      lerpFactor: 0.22,
      showTextCaret: true
    },
    features: {
      registrationEnabled: true,
      emailVerificationRequired: false,
      googleLoginEnabled: true,
      discordLoginEnabled: true,
      emailPasswordLoginEnabled: true,
      afkRewardsEnabled: true,
      ticketsEnabled: true,
      couponsEnabled: true,
      backupsEnabled: true,
      databasesEnabled: true,
      sftpEnabled: true
    },
    layout: {
      stickyNavbar: true,
      showAnnouncementBar: false,
      announcementText: '',
      footerCopyright: '© 2025–2026 AetherPanel Systems. All rights reserved.'
    },
    deployment: {
      allowedMinecraftSoftware: ['paper', 'purpur', 'fabric', 'forge', 'spigot', 'vanilla'],
      allowedBotSoftware: ['nodejs', 'python', 'bun'],
      defaultMemoryMB: 2048,
      defaultDiskMB: 10240,
      defaultCpuPercent: 100,
      instantProvisioningTimeoutSec: 30
    },
    seo: {
      siteTitle: 'AetherPanel — Premium Game & Bot Server Hosting',
      metaDescription: 'High-performance game and bot server hosting powered by AMD Ryzen 9 9950X processors, NVMe Gen4 SSDs, and instant container isolation.',
      keywords: 'game hosting, minecraft hosting, bot hosting, discord bot, nodejs hosting, python hosting, bun hosting',
      analyticsId: ''
    },
    email: {
      smtpHost: 'smtp.sendgrid.net',
      smtpPort: 587,
      smtpUser: 'apikey',
      smtpPass: '',
      senderName: 'AetherPanel Notifications',
      senderEmail: 'noreply@aetherpanel.com',
      encryption: 'tls'
    },
    security: {
      sessionLifetimeHours: 72,
      maxLoginAttempts: 5,
      lockoutDurationMinutes: 15,
      forceAdmin2FA: false,
      blockVpnProxy: true
    },
    maintenance: {
      enabled: false,
      message: 'AetherPanel is currently undergoing scheduled platform maintenance. Services will resume shortly.',
      bypassToken: 'aether-ops-admin'
    }
  });

  // FAQs State
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>('all');
  const [faqSearchQuery, setFaqSearchQuery] = useState('');
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);

  // SMTP Test State
  const [smtpTestRecipient, setSmtpTestRecipient] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);

  // Import State
  const [importJsonText, setImportJsonText] = useState('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorToast(msg);
      setTimeout(() => setErrorToast(null), 4000);
    } else {
      setSuccessToast(msg);
      setTimeout(() => setSuccessToast(null), 3500);
    }
  };

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<any>('/api/v1/admin/panel-customization');
      if (res?.data) {
        setConfig((prev: any) => ({
          ...prev,
          ...res.data,
          branding: { ...prev.branding, ...(res.data.branding || {}) },
          theme: { ...prev.theme, ...(res.data.theme || {}) },
          hero: { ...prev.hero, ...(res.data.hero || {}) },
          cursor: { ...prev.cursor, ...(res.data.cursor || {}) },
          features: { ...prev.features, ...(res.data.features || {}) },
          layout: { ...prev.layout, ...(res.data.layout || {}) },
          deployment: { ...prev.deployment, ...(res.data.deployment || {}) },
          seo: { ...prev.seo, ...(res.data.seo || {}) },
          email: { ...prev.email, ...(res.data.email || {}) },
          security: { ...prev.security, ...(res.data.security || {}) },
          maintenance: { ...prev.maintenance, ...(res.data.maintenance || {}) }
        }));
      }

      // Fetch FAQs
      const faqsRes = await apiRequest<any>('/api/v1/admin/faqs');
      if (faqsRes?.data) {
        setFaqs(faqsRes.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load panel customization', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await apiRequest<any>('/api/v1/admin/panel-customization', {
        method: 'PUT',
        body: JSON.stringify(config)
      });
      if (res?.success) {
        showToast('Panel customization successfully saved & published!');
        if (res.data) {
          setConfig((prev: any) => ({ ...prev, ...res.data }));
        }
        // Live synchronize to BrandingContext, AuthContext and ThemeContext
        await Promise.all([refreshBranding(), refreshAuthConfig()]);
        if (config.branding?.brandName) {
          updateBrandNameLocally(config.branding.brandName);
        }
        setThemeAssets({
          logoUrl: config.branding?.logoUrl || '',
          faviconUrl: config.branding?.faviconUrl || ''
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save customization', true);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    try {
      setTestingSmtp(true);
      const res = await apiRequest<any>('/api/v1/admin/panel-customization/test-smtp', {
        method: 'POST',
        body: JSON.stringify({ recipientEmail: smtpTestRecipient })
      });
      if (res?.success) {
        showToast(res.message || 'SMTP probe completed successfully!');
      }
    } catch (err: any) {
      showToast(err.message || 'SMTP test probe failed', true);
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleExportJson = async () => {
    try {
      const res = await apiRequest<any>('/api/v1/admin/panel-customization/export', { method: 'POST' });
      if (res?.data) {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `aetherpanel-customization-${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('Configuration exported as JSON');
      }
    } catch (err: any) {
      showToast(err.message || 'Export failed', true);
    }
  };

  const handleImportJson = async () => {
    try {
      if (!importJsonText.trim()) {
        showToast('Please paste a JSON configuration first', true);
        return;
      }
      const parsed = JSON.parse(importJsonText);
      const res = await apiRequest<any>('/api/v1/admin/panel-customization/import', {
        method: 'POST',
        body: JSON.stringify({ config: parsed })
      });
      if (res?.success) {
        showToast('Configuration imported successfully!');
        setImportJsonText('');
        fetchConfig();
      }
    } catch (err: any) {
      showToast('Invalid JSON: ' + (err.message || 'Failed to parse JSON file'), true);
    }
  };

  const handleResetToDefaults = async () => {
    try {
      const res = await apiRequest<any>('/api/v1/admin/panel-customization/reset', { method: 'POST' });
      if (res?.success) {
        showToast('Settings reset to factory defaults');
        setIsResetConfirmOpen(false);
        fetchConfig();
      }
    } catch (err: any) {
      showToast(err.message || 'Reset failed', true);
    }
  };

  // FAQ handlers
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq) return;
    try {
      const res = await apiRequest<any>('/api/v1/admin/faqs', {
        method: 'POST',
        body: JSON.stringify(editingFaq)
      });
      if (res?.success) {
        showToast(res.message || 'FAQ saved successfully');
        setIsFaqModalOpen(false);
        setEditingFaq(null);
        const faqsRes = await apiRequest<any>('/api/v1/admin/faqs');
        if (faqsRes?.data) setFaqs(faqsRes.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save FAQ', true);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!window.confirm('Delete this FAQ entry permanently?')) return;
    try {
      const res = await apiRequest<any>(`/api/v1/admin/faqs/${id}`, { method: 'DELETE' });
      if (res?.success) {
        showToast('FAQ deleted successfully');
        setFaqs(faqs.filter(f => f.id !== id));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete FAQ', true);
    }
  };

  const handleToggleFaqStatus = async (faq: FaqItem) => {
    try {
      const updated = { ...faq, isActive: !faq.isActive };
      const res = await apiRequest<any>('/api/v1/admin/faqs', {
        method: 'POST',
        body: JSON.stringify(updated)
      });
      if (res?.success) {
        setFaqs(faqs.map(f => f.id === faq.id ? updated : f));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle status', true);
    }
  };

  const subTabs: { key: TabKey; label: string; icon: React.FC<any>; description: string }[] = [
    { key: 'branding', label: 'Branding & Identity', icon: Globe, description: 'Brand name, logo, links & currency' },
    { key: 'theme', label: 'Theme & Accent', icon: Palette, description: 'Orange palette, contrast & radius' },
    { key: 'hero', label: 'Rotating Hero', icon: Sparkles, description: 'Service carousel & orihost-style slides' },
    { key: 'cursor', label: 'Custom Cursor', icon: MousePointer, description: 'Orange arrow cursor & pointer toggle' },
    { key: 'features', label: 'Feature Toggles', icon: SlidersHorizontal, description: 'Registration, tickets, AFK & backups' },
    { key: 'layout', label: 'Layout & Banner', icon: Layout, description: 'Navbar sticky, alert bar & footer' },
    { key: 'content', label: 'English FAQs & Content', icon: HelpCircle, description: 'English FAQ categories & policy copy' },
    { key: 'deployment', label: 'Software & Versions', icon: Server, description: 'Allowed packages, memory & CPU limits' },
    { key: 'seo', label: 'SEO & Metadata', icon: Search, description: 'Page titles, meta descriptions & tags' },
    { key: 'email', label: 'Email & SMTP', icon: Mail, description: 'SMTP relay, credentials & live test probe' },
    { key: 'security', label: 'Security & Anti-Abuse', icon: Lock, description: 'Session timeout, VPN shield & lockouts' },
    { key: 'maintenance', label: 'Maintenance Mode', icon: AlertTriangle, description: 'Live platform freeze & bypass token' },
    { key: 'backup_restore', label: 'Import / Export', icon: Download, description: 'JSON archive export & factory reset' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 text-[var(--color-accent)] animate-spin" />
          <span className="text-xs text-[var(--color-ink-mute)] font-mono">Loading Panel Customization Suite...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast notifications */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-[var(--color-surface-2)] border border-[var(--color-ok)] text-[var(--color-ink)] px-4 py-2.5 rounded-lg flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-[var(--color-ok)] shrink-0" />
          <span>{successToast}</span>
        </div>
      )}
      {errorToast && (
        <div className="fixed top-5 right-5 z-50 bg-[var(--color-surface-2)] border border-[var(--color-err)] text-[var(--color-ink)] px-4 py-2.5 rounded-lg flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4 text-[var(--color-err)] shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Header with Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--color-accent)]">
            <Sliders className="h-3.5 w-3.5" />
            <span>Master Control Hub</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)] mt-0.5">
            Panel Customization
          </h1>
          <p className="text-xs text-[var(--color-ink-mute)] mt-1">
            Configure branding, theme accents, rotating hero carousel, custom cursor, feature toggles, and runtime packages.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={fetchConfig}
            disabled={saving}
            className="btn btn-ghost text-xs h-9 px-3 flex items-center gap-2"
            title="Reload from server"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Discard</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary text-xs h-9 px-4 flex items-center gap-2"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>{saving ? 'Publishing...' : 'Save & Publish'}</span>
          </button>
        </div>
      </div>

      {/* Main Container: Sub-Sidebar + Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sub-Sidebar */}
        <div className="lg:col-span-1 space-y-1 bg-[var(--color-surface)] p-2.5 rounded-lg border border-[var(--color-line)] h-fit">
          <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--color-ink-mute)]">
            Customization Sections
          </div>
          {subTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] font-semibold'
                    : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
                <div className="min-w-0 flex-1 truncate">
                  <div className="truncate">{tab.label}</div>
                  <div className="text-[10px] text-[var(--color-ink-mute)] font-normal truncate">{tab.description}</div>
                </div>
                <ChevronRight className={`h-3 w-3 shrink-0 ${isActive ? 'text-[var(--color-accent)]' : 'opacity-0'}`} />
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-3 bg-[var(--color-surface)] p-6 rounded-lg border border-[var(--color-line)]">
          {/* TAB 1: BRANDING */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Platform & Brand Identity</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Control public platform naming, contact details, currency, and social channels.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Brand Name</label>
                  <input
                    type="text"
                    value={config.branding?.brandName || ''}
                    onChange={e => setConfig({ ...config, branding: { ...config.branding, brandName: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="e.g. AetherPanel"
                  />
                </div>
                <div>
                  <label className="label">Brand Tagline</label>
                  <input
                    type="text"
                    value={config.branding?.brandTagline || ''}
                    onChange={e => setConfig({ ...config, branding: { ...config.branding, brandTagline: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="e.g. High-Performance Cloud & Game Server Hosting"
                  />
                </div>
                <div>
                  <label className="label">Support Email</label>
                  <input
                    type="email"
                    value={config.branding?.supportEmail || ''}
                    onChange={e => setConfig({ ...config, branding: { ...config.branding, supportEmail: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="support@example.com"
                  />
                </div>
                <div>
                  <label className="label">Discord Community URL</label>
                  <input
                    type="url"
                    value={config.branding?.discordUrl || ''}
                    onChange={e => setConfig({ ...config, branding: { ...config.branding, discordUrl: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="https://discord.gg/yourserver"
                  />
                </div>
                <div>
                  <label className="label">Currency Symbol</label>
                  <input
                    type="text"
                    value={config.branding?.currencySymbol || ''}
                    onChange={e => setConfig({ ...config, branding: { ...config.branding, currencySymbol: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="€ or $ or ₹"
                  />
                </div>
                <div>
                  <label className="label">Currency ISO Code</label>
                  <input
                    type="text"
                    value={config.branding?.currencyCode || ''}
                    onChange={e => setConfig({ ...config, branding: { ...config.branding, currencyCode: e.target.value.toUpperCase() } })}
                    className="field w-full text-xs"
                    placeholder="EUR or USD or INR"
                  />
                </div>
                <div>
                  <label className="label">Custom Logo Image URL</label>
                  <input
                    type="text"
                    value={config.branding?.logoUrl || ''}
                    onChange={e => setConfig({ ...config, branding: { ...config.branding, logoUrl: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="https://example.com/logo.svg"
                  />
                  <p className="text-[10px] text-[var(--color-ink-mute)] mt-1">Direct SVG/PNG link to replace default hexagon icon across navbar, login & register.</p>
                </div>
                <div>
                  <label className="label">Custom Favicon URL</label>
                  <input
                    type="text"
                    value={config.branding?.faviconUrl || ''}
                    onChange={e => setConfig({ ...config, branding: { ...config.branding, faviconUrl: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="https://example.com/favicon.ico"
                  />
                  <p className="text-[10px] text-[var(--color-ink-mute)] mt-1">Browser tab icon URL (16x16 or 32x32 .ico / .png).</p>
                </div>
              </div>

              {/* Live Preview Box */}
              {(config.branding?.logoUrl || config.branding?.faviconUrl) && (
                <div className="p-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] flex items-center gap-4">
                  <div className="text-[11px] font-mono text-[var(--color-ink-dim)] uppercase tracking-wider">Live Asset Preview:</div>
                  {config.branding?.logoUrl && (
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-line)]">
                      <span className="text-[10px] text-[var(--color-ink-mute)]">Logo:</span>
                      <img
                        src={config.branding.logoUrl}
                        alt="Logo Preview"
                        className="h-6 w-auto object-contain max-w-[120px]"
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  {config.branding?.faviconUrl && (
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-line)]">
                      <span className="text-[10px] text-[var(--color-ink-mute)]">Favicon:</span>
                      <img
                        src={config.branding.faviconUrl}
                        alt="Favicon Preview"
                        className="h-4 w-4 object-contain"
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: THEME */}
          {activeTab === 'theme' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Theme & Color Accents</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Primary brand accent is anchored to professional orange (#FF6A00) with dark high-contrast styling.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Primary Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.theme?.accentColor || '#FF6A00'}
                      onChange={e => setConfig({ ...config, theme: { ...config.theme, accentColor: e.target.value } })}
                      className="h-9 w-12 rounded cursor-pointer border border-[var(--color-line)] bg-transparent"
                    />
                    <input
                      type="text"
                      value={config.theme?.accentColor || '#FF6A00'}
                      onChange={e => setConfig({ ...config, theme: { ...config.theme, accentColor: e.target.value } })}
                      className="field flex-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Hover Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.theme?.accentHover || '#E85D00'}
                      onChange={e => setConfig({ ...config, theme: { ...config.theme, accentHover: e.target.value } })}
                      className="h-9 w-12 rounded cursor-pointer border border-[var(--color-line)] bg-transparent"
                    />
                    <input
                      type="text"
                      value={config.theme?.accentHover || '#E85D00'}
                      onChange={e => setConfig({ ...config, theme: { ...config.theme, accentHover: e.target.value } })}
                      className="field flex-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Active / Dim Accent</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.theme?.accentDim || '#CC5200'}
                      onChange={e => setConfig({ ...config, theme: { ...config.theme, accentDim: e.target.value } })}
                      className="h-9 w-12 rounded cursor-pointer border border-[var(--color-line)] bg-transparent"
                    />
                    <input
                      type="text"
                      value={config.theme?.accentDim || '#CC5200'}
                      onChange={e => setConfig({ ...config, theme: { ...config.theme, accentDim: e.target.value } })}
                      className="field flex-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-3">
                <span className="text-xs font-mono uppercase text-[var(--color-ink-mute)]">Live UI Component Preview</span>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn btn-primary text-xs h-8 px-3">Primary Button</button>
                  <button className="btn btn-ghost text-xs h-8 px-3">Ghost Button</button>
                  <button className="btn btn-danger text-xs h-8 px-3">Danger Button</button>
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
                    Active Badge
                  </span>
                </div>
              </div>

              {/* Typography & Global Font System */}
              <div className="space-y-3 pt-2">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-ink)] uppercase font-mono tracking-wider">
                    Typography & Global Font System
                  </h3>
                  <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">
                    Click any typography package below to instantly switch the active font across the entire web client.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FONT_OPTIONS.map((f) => {
                    const isSelected = (config.theme?.fontFamily || activeFontId) === f.id;
                    return (
                      <div
                        key={f.id}
                        onClick={() => {
                          setActiveFontId(f.id);
                          setConfig({
                            ...config,
                            theme: { ...config.theme, fontFamily: f.id }
                          });
                        }}
                        className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-[var(--color-surface-2)] border-[var(--color-accent)] shadow-sm'
                            : 'bg-[var(--color-surface)] border-[var(--color-line)] hover:border-[var(--color-line-soft)] hover:bg-[var(--color-surface-2)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--color-ink)]">{f.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-ink-dim)] uppercase">
                              {f.category}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
                            )}
                          </div>
                        </div>

                        <p
                          className="text-xs text-[var(--color-ink-dim)] truncate py-1"
                          style={{ fontFamily: f.fontFamily }}
                        >
                          {f.sample}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HERO */}
          {activeTab === 'hero' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Rotating Homepage Hero Carousel</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Control the high-impact Orihost-style rotating service carousel for active platform products (Bot Hosting & Minecraft Hosting).</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                  <div>
                    <div className="text-xs font-medium text-[var(--color-ink)]">Enable Hero Carousel</div>
                    <div className="text-[10px] text-[var(--color-ink-mute)]">Rotate services on homepage</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.hero?.enabled ?? true}
                    onChange={e => setConfig({ ...config, hero: { ...config.hero, enabled: e.target.checked } })}
                    className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="label">Autoplay Interval (ms)</label>
                  <input
                    type="number"
                    step="500"
                    min="2000"
                    max="15000"
                    value={config.hero?.autoplayInterval || 6000}
                    onChange={e => setConfig({ ...config, hero: { ...config.hero, autoplayInterval: parseInt(e.target.value) || 6000 } })}
                    className="field w-full text-xs font-mono"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                  <div>
                    <div className="text-xs font-medium text-[var(--color-ink)]">Pause on Hover</div>
                    <div className="text-[10px] text-[var(--color-ink-mute)]">Stop timer on mouseover</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.hero?.pauseOnHover ?? true}
                    onChange={e => setConfig({ ...config, hero: { ...config.hero, pauseOnHover: e.target.checked } })}
                    className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>
              </div>

              {/* Service Slides List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-ink)]">Configured Service Slides ({config.hero?.slides?.length || 0})</span>
                </div>

                <div className="space-y-2">
                  {(config.hero?.slides || []).map((slide: any, idx: number) => (
                    <div key={slide.id || idx} className="p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--color-accent)]">{slide.service}</span>
                          <span className="text-xs font-semibold text-[var(--color-ink)]">— {slide.headline}</span>
                          <span className="text-[10px] font-mono text-[var(--color-ok)]">{slide.price}{slide.period}</span>
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-mute)] truncate mt-0.5">{slide.subheadline}</p>
                      </div>
                      <div className="text-xs font-mono text-[var(--color-ink-dim)]">
                        Slide #{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CURSOR */}
          {activeTab === 'cursor' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Real Custom Cursor Engine</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Orange pointer arrow and pointing hand cursor matching Orihost design with GPU-accelerated lerp.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                  <div>
                    <div className="text-xs font-medium text-[var(--color-ink)]">Master Cursor Enabled</div>
                    <div className="text-[10px] text-[var(--color-ink-mute)]">Activate custom cursor on site</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.cursor?.enabled ?? true}
                    onChange={e => setConfig({ ...config, cursor: { ...config.cursor, enabled: e.target.checked } })}
                    className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                  <div>
                    <div className="text-xs font-medium text-[var(--color-ink)]">Default Active for Visitors</div>
                    <div className="text-[10px] text-[var(--color-ink-mute)]">Visitors start with cursor enabled</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.cursor?.defaultActive ?? true}
                    onChange={e => setConfig({ ...config, cursor: { ...config.cursor, defaultActive: e.target.checked } })}
                    className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="label">Cursor Style</label>
                  <select
                    value={config.cursor?.cursorStyle || 'arrow-pointer'}
                    onChange={e => setConfig({ ...config, cursor: { ...config.cursor, cursorStyle: e.target.value } })}
                    className="field w-full text-xs"
                  >
                    <option value="arrow-pointer">Orange Pointer Arrow & Hand (Requested)</option>
                    <option value="ring-dot">Minimalist Ring & Dot</option>
                  </select>
                </div>

                <div>
                  <label className="label">Cursor Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.cursor?.color || '#FF6A00'}
                      onChange={e => setConfig({ ...config, cursor: { ...config.cursor, color: e.target.value } })}
                      className="h-9 w-12 rounded cursor-pointer border border-[var(--color-line)] bg-transparent"
                    />
                    <input
                      type="text"
                      value={config.cursor?.color || '#FF6A00'}
                      onChange={e => setConfig({ ...config, cursor: { ...config.cursor, color: e.target.value } })}
                      className="field flex-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Interactive Test Area */}
              <div className="p-5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-2">
                <span className="text-xs font-mono uppercase text-[var(--color-ink-mute)]">Interactive Hover Sandbox</span>
                <p className="text-xs text-[var(--color-ink-dim)]">Hover over these interactive buttons to preview the orange pointer transform into a pointing hand:</p>
                <div className="flex items-center gap-3 pt-2">
                  <button className="btn btn-primary text-xs h-8 px-4">Hover Me (Hand)</button>
                  <a href="#test" onClick={e => e.preventDefault()} className="text-xs text-[var(--color-accent)] underline">
                    Hover Link (Hand)
                  </a>
                  <input type="text" placeholder="Type here (Text Caret)..." className="field text-xs h-8 px-2 w-48" />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Platform Feature Toggles</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Globally enable or disable customer-facing features and subsystems.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'registrationEnabled', label: 'User Registration', desc: 'Allow new visitors to create accounts' },
                  { key: 'emailVerificationRequired', label: 'Email Verification', desc: 'Require verified email before deployment' },
                  { key: 'googleLoginEnabled', label: 'Google Sign-In Button', desc: 'Show Google login/register option on auth pages' },
                  { key: 'discordLoginEnabled', label: 'Discord Sign-In Button', desc: 'Show Discord OAuth button on auth pages' },
                  { key: 'emailPasswordLoginEnabled', label: 'Email & Password Login', desc: 'Allow standard email & password sign-in' },
                  { key: 'afkRewardsEnabled', label: 'AFK Coin Rewards', desc: 'Enable passive coin generation system' },
                  { key: 'ticketsEnabled', label: 'Support Tickets Queue', desc: 'Customer ticket dispatch & resolution' },
                  { key: 'couponsEnabled', label: 'Discount Coupons', desc: 'Promo codes & checkout discounts' },
                  { key: 'backupsEnabled', label: 'Server Snapshot Backups', desc: 'Allow manual & scheduled backup archives' },
                  { key: 'databasesEnabled', label: 'Managed MySQL/PG Databases', desc: 'User database creation on nodes' },
                  { key: 'sftpEnabled', label: 'SFTP File Subsystem', desc: 'Remote SFTP access on port 2022' }
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                    <div>
                      <div className="text-xs font-medium text-[var(--color-ink)]">{item.label}</div>
                      <div className="text-[10px] text-[var(--color-ink-mute)]">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.features?.[item.key] ?? true}
                      onChange={e => setConfig({ ...config, features: { ...config.features, [item.key]: e.target.checked } })}
                      className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: LAYOUT */}
          {activeTab === 'layout' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Layout & Global Header/Footer</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Control sticky navigation, top announcement ribbons, and footer branding.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                  <div>
                    <div className="text-xs font-medium text-[var(--color-ink)]">Sticky Navigation Header</div>
                    <div className="text-[10px] text-[var(--color-ink-mute)]">Fix navbar to top of viewport during scroll</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.layout?.stickyNavbar ?? true}
                    onChange={e => setConfig({ ...config, layout: { ...config.layout, stickyNavbar: e.target.checked } })}
                    className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                  <div>
                    <div className="text-xs font-medium text-[var(--color-ink)]">Show Announcement Ribbon</div>
                    <div className="text-[10px] text-[var(--color-ink-mute)]">Display top alert banner across all public pages</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.layout?.showAnnouncementBar ?? false}
                    onChange={e => setConfig({ ...config, layout: { ...config.layout, showAnnouncementBar: e.target.checked } })}
                    className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="label">Announcement Banner Text</label>
                  <input
                    type="text"
                    value={config.layout?.announcementText || ''}
                    onChange={e => setConfig({ ...config, layout: { ...config.layout, announcementText: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="e.g. 🚀 Welcome to AetherPanel — AMD Ryzen 9 9950X nodes live now!"
                  />
                </div>

                <div>
                  <label className="label">Footer Copyright Notice</label>
                  <input
                    type="text"
                    value={config.layout?.footerCopyright || ''}
                    onChange={e => setConfig({ ...config, layout: { ...config.layout, footerCopyright: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="© 2025–2026 AetherPanel Systems. All rights reserved."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ENGLISH CONTENT & FAQS */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-ink)]">English Knowledgebase & FAQs</h2>
                  <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Manage professional English FAQs across 6 structured categories.</p>
                </div>
                <button
                  onClick={() => {
                    setEditingFaq({
                      id: '',
                      category: 'Getting Started',
                      question: '',
                      answer: '',
                      sortOrder: faqs.length + 1,
                      isActive: true
                    });
                    setIsFaqModalOpen(true);
                  }}
                  className="btn btn-primary text-xs h-8 px-3 flex items-center gap-1.5 self-start"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add English FAQ</span>
                </button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
                  <input
                    type="text"
                    value={faqSearchQuery}
                    onChange={e => setFaqSearchQuery(e.target.value)}
                    placeholder="Search English FAQs..."
                    className="field w-full pl-9 text-xs"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {['all', 'Getting Started', 'Billing', 'Servers', 'Technical', 'Security', 'Support'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFaqCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        faqCategoryFilter === cat
                          ? 'bg-[var(--color-accent)] text-[#0B0B0C] font-semibold'
                          : 'bg-[var(--color-surface-2)] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* FAQ List */}
              <div className="space-y-2">
                {faqs
                  .filter(f => faqCategoryFilter === 'all' || f.category === faqCategoryFilter)
                  .filter(f => !faqSearchQuery || f.question.toLowerCase().includes(faqSearchQuery.toLowerCase()) || f.answer.toLowerCase().includes(faqSearchQuery.toLowerCase()))
                  .map(faq => (
                    <div key={faq.id} className="p-3.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-accent)] border border-[var(--color-line)]">
                            {faq.category || 'General'}
                          </span>
                          <span className="text-xs font-semibold text-[var(--color-ink)]">{faq.question}</span>
                          {!faq.isActive && (
                            <span className="text-[10px] text-[var(--color-warn)] font-mono">(Disabled)</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">{faq.answer}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleFaqStatus(faq)}
                          className={`btn btn-ghost text-[10px] h-7 px-2 font-mono ${faq.isActive ? 'text-[var(--color-ok)]' : 'text-[var(--color-ink-mute)]'}`}
                          title="Toggle active status"
                        >
                          {faq.isActive ? 'Active' : 'Hidden'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingFaq(faq);
                            setIsFaqModalOpen(true);
                          }}
                          className="btn btn-ghost text-xs h-7 w-7 p-0"
                          title="Edit FAQ"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFaq(faq.id)}
                          className="btn btn-ghost text-xs h-7 w-7 p-0 hover:text-[var(--color-err)]"
                          title="Delete FAQ"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 8: DEPLOYMENT & VERSIONS */}
          {activeTab === 'deployment' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Software Runtimes & Version Deployment</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Strict software-driven version selection. Selecting software strictly locks deployment to verified catalogs.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Default Container Memory (MB)</label>
                  <input
                    type="number"
                    step="512"
                    value={config.deployment?.defaultMemoryMB || 2048}
                    onChange={e => setConfig({ ...config, deployment: { ...config.deployment, defaultMemoryMB: parseInt(e.target.value) || 2048 } })}
                    className="field w-full text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="label">Default NVMe Storage (MB)</label>
                  <input
                    type="number"
                    step="1024"
                    value={config.deployment?.defaultDiskMB || 10240}
                    onChange={e => setConfig({ ...config, deployment: { ...config.deployment, defaultDiskMB: parseInt(e.target.value) || 10240 } })}
                    className="field w-full text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="label">Default CPU Allocation (%)</label>
                  <input
                    type="number"
                    step="25"
                    min="50"
                    max="800"
                    value={config.deployment?.defaultCpuPercent || 100}
                    onChange={e => setConfig({ ...config, deployment: { ...config.deployment, defaultCpuPercent: parseInt(e.target.value) || 100 } })}
                    className="field w-full text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="label">Instant Provision Timeout (Sec)</label>
                  <input
                    type="number"
                    min="10"
                    max="120"
                    value={config.deployment?.instantProvisioningTimeoutSec || 30}
                    onChange={e => setConfig({ ...config, deployment: { ...config.deployment, instantProvisioningTimeoutSec: parseInt(e.target.value) || 30 } })}
                    className="field w-full text-xs font-mono"
                  />
                </div>
              </div>

              {/* Supported Software Badges */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-semibold text-[var(--color-ink)]">Enabled Software Catalogs</span>
                <div className="p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-3">
                  <div>
                    <div className="text-xs font-mono text-[var(--color-accent)] mb-1">Minecraft Server Software:</div>
                    <div className="flex flex-wrap gap-2">
                      {['Paper (1.8.8 – 1.21.4)', 'Purpur (1.16.5 – 1.21.4)', 'Fabric', 'Forge', 'Spigot', 'Vanilla'].map(pkg => (
                        <span key={pkg} className="px-2.5 py-1 rounded bg-[var(--color-surface-3)] text-[var(--color-ink)] text-[11px] font-mono border border-[var(--color-line)]">
                          ✓ {pkg}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-[var(--color-accent)] mb-1">Bot & App Runtimes:</div>
                    <div className="flex flex-wrap gap-2">
                      {['Node.js (v18, v20, v22 LTS)', 'Python (3.10, 3.11, 3.12, 3.13)', 'Bun (v1.0, v1.1+)'].map(pkg => (
                        <span key={pkg} className="px-2.5 py-1 rounded bg-[var(--color-surface-3)] text-[var(--color-ink)] text-[11px] font-mono border border-[var(--color-line)]">
                          ✓ {pkg}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: SEO & METADATA */}
          {activeTab === 'seo' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Search Engine Optimization (SEO)</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Control search engine title tags, descriptions, OpenGraph cards, and analytics tracking.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Global Page Title</label>
                  <input
                    type="text"
                    value={config.seo?.siteTitle || ''}
                    onChange={e => setConfig({ ...config, seo: { ...config.seo, siteTitle: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="AetherPanel — Premium Game & Bot Server Hosting"
                  />
                </div>

                <div>
                  <label className="label">Meta Description</label>
                  <textarea
                    rows={3}
                    value={config.seo?.metaDescription || ''}
                    onChange={e => setConfig({ ...config, seo: { ...config.seo, metaDescription: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="High-performance game and bot server hosting powered by AMD Ryzen 9 9950X processors..."
                  />
                </div>

                <div>
                  <label className="label">Meta Keywords</label>
                  <input
                    type="text"
                    value={config.seo?.keywords || ''}
                    onChange={e => setConfig({ ...config, seo: { ...config.seo, keywords: e.target.value } })}
                    className="field w-full text-xs font-mono"
                    placeholder="game hosting, minecraft hosting, bot hosting, discord bot"
                  />
                </div>

                <div>
                  <label className="label">Google Analytics / Measurement ID</label>
                  <input
                    type="text"
                    value={config.seo?.analyticsId || ''}
                    onChange={e => setConfig({ ...config, seo: { ...config.seo, analyticsId: e.target.value } })}
                    className="field w-full text-xs font-mono"
                    placeholder="G-XXXXXXXXXX"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: EMAIL & SMTP */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Email & SMTP Delivery Engine</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Configure transactional SMTP delivery for verification codes, password resets, and invoices.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">SMTP Host</label>
                  <input
                    type="text"
                    value={config.email?.smtpHost || ''}
                    onChange={e => setConfig({ ...config, email: { ...config.email, smtpHost: e.target.value } })}
                    className="field w-full text-xs font-mono"
                    placeholder="smtp.sendgrid.net"
                  />
                </div>

                <div>
                  <label className="label">SMTP Port</label>
                  <input
                    type="number"
                    value={config.email?.smtpPort || 587}
                    onChange={e => setConfig({ ...config, email: { ...config.email, smtpPort: parseInt(e.target.value) || 587 } })}
                    className="field w-full text-xs font-mono"
                    placeholder="587 or 465"
                  />
                </div>

                <div>
                  <label className="label">SMTP Username</label>
                  <input
                    type="text"
                    value={config.email?.smtpUser || ''}
                    onChange={e => setConfig({ ...config, email: { ...config.email, smtpUser: e.target.value } })}
                    className="field w-full text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="label">SMTP Password</label>
                  <input
                    type="password"
                    value={config.email?.smtpPass || ''}
                    onChange={e => setConfig({ ...config, email: { ...config.email, smtpPass: e.target.value } })}
                    className="field w-full text-xs font-mono"
                    placeholder="••••••••••••••••"
                  />
                </div>

                <div>
                  <label className="label">Sender Display Name</label>
                  <input
                    type="text"
                    value={config.email?.senderName || ''}
                    onChange={e => setConfig({ ...config, email: { ...config.email, senderName: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="AetherPanel Notifications"
                  />
                </div>

                <div>
                  <label className="label">Sender Email Address</label>
                  <input
                    type="email"
                    value={config.email?.senderEmail || ''}
                    onChange={e => setConfig({ ...config, email: { ...config.email, senderEmail: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
              </div>

              {/* Live SMTP Test Probe */}
              <div className="p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-3">
                <span className="text-xs font-semibold text-[var(--color-ink)]">Test SMTP Connection</span>
                <p className="text-xs text-[var(--color-ink-mute)]">Dispatch a test probe message to verify authentication and TLS handshakes.</p>
                <div className="flex items-center gap-2 max-w-md">
                  <input
                    type="email"
                    value={smtpTestRecipient}
                    onChange={e => setSmtpTestRecipient(e.target.value)}
                    placeholder="test@yourdomain.com"
                    className="field flex-1 text-xs"
                  />
                  <button
                    onClick={handleTestSmtp}
                    disabled={testingSmtp}
                    className="btn btn-primary text-xs h-9 px-3 flex items-center gap-1.5 shrink-0"
                  >
                    {testingSmtp ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>{testingSmtp ? 'Sending...' : 'Send Test'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: SECURITY & ABUSE */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Security, Sessions & Anti-Abuse</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Enforce login lockout protections, session limits, and proxy shields.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Session Lifetime (Hours)</label>
                  <input
                    type="number"
                    value={config.security?.sessionLifetimeHours || 72}
                    onChange={e => setConfig({ ...config, security: { ...config.security, sessionLifetimeHours: parseInt(e.target.value) || 72 } })}
                    className="field w-full text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="label">Max Failed Logins Before Lockout</label>
                  <input
                    type="number"
                    value={config.security?.maxLoginAttempts || 5}
                    onChange={e => setConfig({ ...config, security: { ...config.security, maxLoginAttempts: parseInt(e.target.value) || 5 } })}
                    className="field w-full text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="label">Lockout Duration (Minutes)</label>
                  <input
                    type="number"
                    value={config.security?.lockoutDurationMinutes || 15}
                    onChange={e => setConfig({ ...config, security: { ...config.security, lockoutDurationMinutes: parseInt(e.target.value) || 15 } })}
                    className="field w-full text-xs font-mono"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                  <div>
                    <div className="text-xs font-medium text-[var(--color-ink)]">Block Known VPN & Proxies</div>
                    <div className="text-[10px] text-[var(--color-ink-mute)]">Filter high-risk anonymous IP ranges</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.security?.blockVpnProxy ?? true}
                    onChange={e => setConfig({ ...config, security: { ...config.security, blockVpnProxy: e.target.checked } })}
                    className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 12: MAINTENANCE */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Platform Maintenance Mode</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">When active, normal customer write actions and deployments are frozen.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-ink)]">Maintenance Mode Status</div>
                    <div className="text-[10px] text-[var(--color-ink-mute)]">Enable to show public upgrade banner and freeze customer provisioning</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.maintenance?.enabled ?? false}
                    onChange={e => setConfig({ ...config, maintenance: { ...config.maintenance, enabled: e.target.checked } })}
                    className="h-5 w-5 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="label">Custom Maintenance Banner Message</label>
                  <textarea
                    rows={3}
                    value={config.maintenance?.message || ''}
                    onChange={e => setConfig({ ...config, maintenance: { ...config.maintenance, message: e.target.value } })}
                    className="field w-full text-xs"
                    placeholder="AetherPanel is undergoing scheduled upgrades..."
                  />
                </div>

                <div>
                  <label className="label">Secret Admin Bypass Token</label>
                  <input
                    type="text"
                    value={config.maintenance?.bypassToken || ''}
                    onChange={e => setConfig({ ...config, maintenance: { ...config.maintenance, bypassToken: e.target.value } })}
                    className="field w-full text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 13: IMPORT / EXPORT */}
          {activeTab === 'backup_restore' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Configuration Import & Export</h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Export panel settings to a JSON archive, restore from a backup, or reset to factory defaults.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export */}
                <div className="p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
                    <Download className="h-4 w-4 text-[var(--color-accent)]" />
                    <span>Export Configuration</span>
                  </div>
                  <p className="text-xs text-[var(--color-ink-mute)]">Download current customization suite as a portable JSON file.</p>
                  <button
                    onClick={handleExportJson}
                    className="btn btn-ghost text-xs h-9 px-3 flex items-center gap-2 border border-[var(--color-line)]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download JSON Archive</span>
                  </button>
                </div>

                {/* Factory Reset */}
                <div className="p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-err)]">
                    <RotateCcw className="h-4 w-4" />
                    <span>Factory Reset</span>
                  </div>
                  <p className="text-xs text-[var(--color-ink-mute)]">Revert all panel customization parameters to default values.</p>
                  <button
                    onClick={() => setIsResetConfirmOpen(true)}
                    className="btn btn-danger text-xs h-9 px-3 flex items-center gap-2"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset to Defaults</span>
                  </button>
                </div>
              </div>

              {/* Import Area */}
              <div className="p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
                  <Upload className="h-4 w-4 text-[var(--color-accent)]" />
                  <span>Import Configuration JSON</span>
                </div>
                <p className="text-xs text-[var(--color-ink-mute)]">Paste configuration JSON below to apply and override settings:</p>
                <textarea
                  rows={6}
                  value={importJsonText}
                  onChange={e => setImportJsonText(e.target.value)}
                  placeholder="Paste JSON config object here..."
                  className="field w-full text-xs font-mono"
                />
                <button
                  onClick={handleImportJson}
                  className="btn btn-primary text-xs h-9 px-4 flex items-center gap-2"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Validate & Apply Config</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FAQ Edit/Create Modal */}
      {isFaqModalOpen && editingFaq && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[var(--color-surface)] border border-[var(--color-line)] rounded-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-line)]">
              <h3 className="text-sm font-bold text-[var(--color-ink)]">
                {editingFaq.id ? 'Edit English FAQ' : 'Add New English FAQ'}
              </h3>
              <button
                onClick={() => setIsFaqModalOpen(false)}
                className="text-[var(--color-ink-mute)] hover:text-[var(--color-ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFaq} className="space-y-4">
              <div>
                <label className="label">Category</label>
                <select
                  value={editingFaq.category || 'Getting Started'}
                  onChange={e => setEditingFaq({ ...editingFaq, category: e.target.value })}
                  className="field w-full text-xs"
                >
                  <option value="Getting Started">Getting Started</option>
                  <option value="Billing">Billing</option>
                  <option value="Servers">Servers</option>
                  <option value="Technical">Technical</option>
                  <option value="Security">Security</option>
                  <option value="Support">Support</option>
                </select>
              </div>

              <div>
                <label className="label">Question (English)</label>
                <input
                  type="text"
                  required
                  value={editingFaq.question}
                  onChange={e => setEditingFaq({ ...editingFaq, question: e.target.value })}
                  className="field w-full text-xs"
                  placeholder="e.g. How fast will my server be online after ordering?"
                />
              </div>

              <div>
                <label className="label">Answer (English)</label>
                <textarea
                  rows={4}
                  required
                  value={editingFaq.answer}
                  onChange={e => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                  className="field w-full text-xs"
                  placeholder="e.g. Provisioning is completely automated..."
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs text-[var(--color-ink)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingFaq.isActive}
                    onChange={e => setEditingFaq({ ...editingFaq, isActive: e.target.checked })}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  <span>Active & Published</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFaqModalOpen(false)}
                    className="btn btn-ghost text-xs h-8 px-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary text-xs h-8 px-4"
                  >
                    Save FAQ
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-err)]/50 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2 text-[var(--color-err)] text-sm font-bold">
              <AlertTriangle className="h-5 w-5" />
              <span>Confirm Factory Reset</span>
            </div>
            <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
              Are you sure you want to revert all panel customization settings to system factory defaults?
              Your custom theme colors, rotating hero slides, and layout settings will be reset.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="btn btn-ghost text-xs h-8 px-3"
              >
                Cancel
              </button>
              <button
                onClick={handleResetToDefaults}
                className="btn btn-danger text-xs h-8 px-4"
              >
                Reset All Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
