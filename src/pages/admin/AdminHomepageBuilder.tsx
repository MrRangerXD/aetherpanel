import React, { useState, useEffect } from 'react';
import {
  LayoutTemplate, Save, RefreshCw, Eye, Check, Loader2, Sparkles,
  ToggleLeft, ToggleRight, Layers, ArrowRight, ShieldCheck, HardDrive,
  Shield, Zap, Clock, Gamepad2, Bot, Cpu, Terminal, ExternalLink, HelpCircle
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useBranding } from '../../lib/BrandingContext';
import { HomepageConfig } from '../../types';

interface AdminHomepageBuilderProps {
  onNavigate?: (page: string) => void;
}

const DEFAULT_CONFIG: HomepageConfig = {
  heroBadgeText: 'Next-Gen Game & Bot Infrastructure',
  heroBadgeLinkText: 'Hardware Status →',
  heroBadgeLinkTarget: 'status',
  showHeroBadge: true,
  heroHeadlinePrefix: 'Powerful infrastructure for',
  heroHeadlineAccent: 'your next server.',
  heroDescription: 'Deploy high-performance Minecraft servers and 24/7 background bots with instant automated setup, enterprise NVMe storage, and DDoS protection.',
  heroPrimaryCtaText: 'Get Started',
  heroPrimaryCtaPage: 'register',
  heroSecondaryCtaText: 'Explore Hosting',
  heroSecondaryCtaPage: 'hosting',
  heroBullet1: 'Instant activation',
  heroBullet2: 'No setup fees',
  heroBullet3: 'Cancel anytime',

  showTrustBar: true,
  trustBarItem1: '99.99% Uptime SLA',
  trustBarItem2: 'PCIe Gen4 NVMe Storage',
  trustBarItem3: '3.2 Tbps DDoS Protection',
  trustBarItem4: '<30s Instant Provisioning',
  trustBarItem5: '24/7 Node Telemetry',

  showMinecraftSection: true,
  showDiscordBotSection: true,
  showInfrastructureSection: true,
  showStatsSection: true,
  showFeaturesSection: true,
  showPricingSection: true,
  showFaqSection: true,
  showCtaSection: true,

  mcEyebrow: 'MINECRAFT SERVER HOSTING',
  mcHeading: 'Single-thread performance built for zero tick drops.',
  mcDescription: 'Minecraft runs its core game loop on a single CPU core. We utilize AMD Ryzen 9 7950X / 9950X silicon with single-thread boosts up to 5.7GHz, combined with Gen4 NVMe arrays to eliminate world-save hitches and chunk generation lag.',
  mcBullet1: 'Paper, Purpur, Fabric, Forge & Modpacks',
  mcBullet2: 'Upload worlds and plugins directly in browser',
  mcBullet3: 'Schedule daily or weekly snapshots',
  mcCtaText: 'Explore Minecraft',

  botEyebrow: 'DISCORD BOT HOSTING',
  botHeading: '24/7 background process supervision and multi-runtime support.',
  botDescription: 'Keep your bots online without unexpected downtime. Our runtime supervisor monitors process exit codes, injects environment variables securely, and automatically revives terminated workers within 1.2 seconds.',
  botBullet1: 'Node.js (18, 20, 22), Python (3.9 - 3.12), Bun & Go',
  botBullet2: 'Store bot tokens securely outside git history',
  botBullet3: 'Direct routes to Discord edge infrastructure',
  botCtaText: 'Explore Discord Bots',

  infraEyebrow: 'Bare-Metal Hardware',
  infraHeading: 'Engineered for pure single-core speed.',
  infraDescription: 'We never oversell CPU cores or place workloads behind congested shared hypervisors. Every instance is backed by enterprise AMD Ryzen hardware with direct hardware access.',

  stat1Value: '99.99%',
  stat1Label: 'Uptime SLA',
  stat2Value: '32+',
  stat2Label: 'Global PoPs',
  stat3Value: '24/7',
  stat3Label: 'Monitoring',
  stat4Value: '<30s',
  stat4Label: 'Deployment',

  ctaEyebrow: 'Ready To Deploy?',
  ctaHeading: 'Start building on modern infrastructure today.',
  ctaDescription: 'Get your Minecraft server or Discord bot up and running in under 30 seconds with 24/7 reliability.',
  ctaPrimaryText: 'Get Started Now',
  ctaPrimaryPage: 'register',
  ctaSecondaryText: 'View All Plans',
  ctaSecondaryPage: 'pricing'
};

export const AdminHomepageBuilder: React.FC<AdminHomepageBuilderProps> = ({ onNavigate }) => {
  const { homepageConfig: contextConfig, setHomepageConfigLocally, refreshBranding } = useBranding();
  
  const [config, setConfig] = useState<HomepageConfig>({ ...DEFAULT_CONFIG, ...contextConfig });
  const [activeTab, setActiveTab] = useState<'hero' | 'sections' | 'trust' | 'showcases' | 'stats' | 'cta' | 'preview'>('hero');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync when context changes
  useEffect(() => {
    if (contextConfig && Object.keys(contextConfig).length > 0) {
      setConfig(prev => ({ ...prev, ...contextConfig }));
    }
  }, [contextConfig]);

  const updateField = <K extends keyof HomepageConfig>(field: K, value: HomepageConfig[K]) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest('/admin/settings/homepage', {
        method: 'PUT',
        body: JSON.stringify({
          homepageConfig: config,
          heroDescription: config.heroDescription
        })
      });

      if (res.success) {
        setHomepageConfigLocally(config);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        refreshBranding();
      } else {
        setErrorMsg(res.error?.message || 'Failed to save homepage configuration.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while saving homepage configuration.');
    }
    setSaving(false);
  };

  const handleReset = () => {
    if (window.confirm('Reset all homepage fields back to default templates?')) {
      setConfig(DEFAULT_CONFIG);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Homepage Visual Builder</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                LIVE CUSTOMIZER
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-2xl">
            Design and customize every section of your public homepage without editing code. Changes apply immediately across desktop and mobile views.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('home') : window.open('/', '_blank')}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 text-zinc-400" />
            <span>View Public Site</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4 stroke-[3]" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{saveSuccess ? 'Published!' : 'Save & Publish'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('hero')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'hero' ? 'bg-amber-400 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Hero & Headlines</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'sections' ? 'bg-amber-400 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Section Visibility</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trust')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'trust' ? 'bg-amber-400 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Trust & Specs Bar</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('showcases')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'showcases' ? 'bg-amber-400 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Gamepad2 className="h-3.5 w-3.5" />
          <span>Minecraft & Bots</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'stats' ? 'bg-amber-400 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>Hardware & Stats</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cta')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'cta' ? 'bg-amber-400 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>Final Call to Action</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'preview' ? 'bg-amber-400 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Live Mini Preview</span>
        </button>
      </div>

      {/* TAB 1: HERO & HEADLINES */}
      {activeTab === 'hero' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Announcement Badge</span>
            </h3>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <div>
                <p className="text-xs font-semibold text-white">Show Announcement Badge in Hero</p>
                <p className="text-[11px] text-zinc-400">Display pill badge above the main headline</p>
              </div>
              <button
                type="button"
                onClick={() => updateField('showHeroBadge', config.showHeroBadge === false ? true : false)}
                className="cursor-pointer"
              >
                {config.showHeroBadge !== false ? (
                  <ToggleRight className="h-7 w-7 text-amber-400" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-zinc-600" />
                )}
              </button>
            </div>

            {config.showHeroBadge !== false && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Badge Title</label>
                  <input
                    type="text"
                    value={config.heroBadgeText || ''}
                    onChange={(e) => updateField('heroBadgeText', e.target.value)}
                    placeholder="e.g. Next-Gen Game & Bot Infrastructure"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Link Text</label>
                  <input
                    type="text"
                    value={config.heroBadgeLinkText || ''}
                    onChange={(e) => updateField('heroBadgeLinkText', e.target.value)}
                    placeholder="e.g. Hardware Status →"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Link Target Page</label>
                  <input
                    type="text"
                    value={config.heroBadgeLinkTarget || ''}
                    onChange={(e) => updateField('heroBadgeLinkTarget', e.target.value)}
                    placeholder="e.g. status, pricing, infrastructure"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-amber-400" />
              <span>Headline & Description</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Headline Prefix (White Text)
                </label>
                <input
                  type="text"
                  value={config.heroHeadlinePrefix || ''}
                  onChange={(e) => updateField('heroHeadlinePrefix', e.target.value)}
                  placeholder="Powerful infrastructure for"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Headline Accent (Gold/Amber Gradient)
                </label>
                <input
                  type="text"
                  value={config.heroHeadlineAccent || ''}
                  onChange={(e) => updateField('heroHeadlineAccent', e.target.value)}
                  placeholder="your next server."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-amber-400 font-medium focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Hero Description (Subtext)
              </label>
              <textarea
                rows={3}
                value={config.heroDescription || ''}
                onChange={(e) => updateField('heroDescription', e.target.value)}
                placeholder="Deploy high-performance Minecraft servers and 24/7 background bots with instant automated setup..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-400 leading-relaxed"
              />
              <p className="text-[11px] text-zinc-500 mt-1">Keep around 1–2 sentences (~25–35 words) for optimal visual hierarchy.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                <span className="text-xs font-semibold text-white block">Primary CTA Button</span>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Button Label</label>
                  <input
                    type="text"
                    value={config.heroPrimaryCtaText || ''}
                    onChange={(e) => updateField('heroPrimaryCtaText', e.target.value)}
                    placeholder="Get Started"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Target Page</label>
                  <input
                    type="text"
                    value={config.heroPrimaryCtaPage || ''}
                    onChange={(e) => updateField('heroPrimaryCtaPage', e.target.value)}
                    placeholder="register (or pricing)"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                <span className="text-xs font-semibold text-white block">Secondary CTA Button</span>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Button Label</label>
                  <input
                    type="text"
                    value={config.heroSecondaryCtaText || ''}
                    onChange={(e) => updateField('heroSecondaryCtaText', e.target.value)}
                    placeholder="Explore Hosting"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Target Page</label>
                  <input
                    type="text"
                    value={config.heroSecondaryCtaPage || ''}
                    onChange={(e) => updateField('heroSecondaryCtaPage', e.target.value)}
                    placeholder="hosting (or pricing)"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-medium text-zinc-300 mb-2">
                Hero Benefit Checklist (Displayed directly below CTAs)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={config.heroBullet1 || ''}
                  onChange={(e) => updateField('heroBullet1', e.target.value)}
                  placeholder="Instant activation"
                  className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
                />
                <input
                  type="text"
                  value={config.heroBullet2 || ''}
                  onChange={(e) => updateField('heroBullet2', e.target.value)}
                  placeholder="No setup fees"
                  className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
                />
                <input
                  type="text"
                  value={config.heroBullet3 || ''}
                  onChange={(e) => updateField('heroBullet3', e.target.value)}
                  placeholder="Cancel anytime"
                  className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECTIONS VISIBILITY */}
      {activeTab === 'sections' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Homepage Section Visibility
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Toggle individual homepage sections on or off without breaking layout or styling.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id: 'showTrustBar', name: 'Specification & Trust Bar', desc: 'Hardware SLA & security strip directly beneath hero' },
              { id: 'showMinecraftSection', name: 'Minecraft Hosting Showcase', desc: 'Survival SMP preview, Paper jar selection, 5.7GHz boost' },
              { id: 'showDiscordBotSection', name: 'Discord Bot Showcase', desc: 'Bot stdout terminal, process watchdog, Node.js & Python' },
              { id: 'showInfrastructureSection', name: 'Bare-Metal Infrastructure', desc: 'Ryzen 9 specs, PCIe 4.0 NVMe arrays, edge telemetry' },
              { id: 'showStatsSection', name: 'Statistics & Metrics Row', desc: 'Uptime SLA, PoPs count, 24/7 telemetry & deploy times' },
              { id: 'showFeaturesSection', name: 'Platform Capabilities Grid', desc: 'WebSocket console, SFTP manager, backups & cron tasks' },
              { id: 'showPricingSection', name: 'Transparent Pricing Table', desc: 'Plan cards with category switcher and specs list' },
              { id: 'showFaqSection', name: 'Frequently Asked Questions', desc: 'Accordion dropdowns with hardware and billing FAQs' },
              { id: 'showCtaSection', name: 'Final Call to Action (CTA)', desc: 'Full-width closing deployment banner before footer' },
            ].map((section) => {
              const key = section.id as keyof HomepageConfig;
              const isEnabled = config[key] !== false;
              return (
                <div
                  key={section.id}
                  className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-4"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                      <h4 className="text-xs font-semibold text-white">{section.name}</h4>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-tight">{section.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField(key, !isEnabled as any)}
                    className="cursor-pointer shrink-0"
                  >
                    {isEnabled ? (
                      <ToggleRight className="h-7 w-7 text-amber-400" />
                    ) : (
                      <ToggleLeft className="h-7 w-7 text-zinc-600" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: TRUST & SPECS BAR */}
      {activeTab === 'trust' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span>Specification & Trust Bar (5 Items)</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Customize the 5 trust badges rendered across desktop and mobile screens.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('showTrustBar', config.showTrustBar === false ? true : false)}
              className="cursor-pointer"
            >
              {config.showTrustBar !== false ? (
                <ToggleRight className="h-7 w-7 text-amber-400" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-zinc-600" />
              )}
            </button>
          </div>

          <div className="space-y-3.5">
            {[
              { field: 'trustBarItem1', label: 'Item 1 (Uptime SLA)', defaultVal: '99.99% Uptime SLA', icon: ShieldCheck },
              { field: 'trustBarItem2', label: 'Item 2 (Storage)', defaultVal: 'PCIe Gen4 NVMe Storage', icon: HardDrive },
              { field: 'trustBarItem3', label: 'Item 3 (DDoS Protection)', defaultVal: '3.2 Tbps DDoS Protection', icon: Shield },
              { field: 'trustBarItem4', label: 'Item 4 (Provisioning Time)', defaultVal: '<30s Instant Provisioning', icon: Zap },
              { field: 'trustBarItem5', label: 'Item 5 (Monitoring / Telemetry)', defaultVal: '24/7 Node Telemetry', icon: Clock },
            ].map(({ field, label, defaultVal, icon: Icon }) => (
              <div key={field} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-amber-400 shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={(config as any)[field] || ''}
                    onChange={(e) => updateField(field as any, e.target.value)}
                    placeholder={defaultVal}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MINECRAFT & BOTS */}
      {activeTab === 'showcases' && (
        <div className="space-y-6">
          {/* Minecraft Config */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-amber-400" />
                <span>Minecraft Server Showcase</span>
              </h3>
              <button
                type="button"
                onClick={() => updateField('showMinecraftSection', config.showMinecraftSection === false ? true : false)}
                className="cursor-pointer"
              >
                {config.showMinecraftSection !== false ? (
                  <ToggleRight className="h-7 w-7 text-amber-400" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-zinc-600" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Eyebrow Tag</label>
                <input
                  type="text"
                  value={config.mcEyebrow || ''}
                  onChange={(e) => updateField('mcEyebrow', e.target.value)}
                  placeholder="MINECRAFT SERVER HOSTING"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">CTA Button Text</label>
                <input
                  type="text"
                  value={config.mcCtaText || ''}
                  onChange={(e) => updateField('mcCtaText', e.target.value)}
                  placeholder="Explore Minecraft"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Heading</label>
              <input
                type="text"
                value={config.mcHeading || ''}
                onChange={(e) => updateField('mcHeading', e.target.value)}
                placeholder="Single-thread performance built for zero tick drops."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={config.mcDescription || ''}
                onChange={(e) => updateField('mcDescription', e.target.value)}
                placeholder="Minecraft runs its core game loop on a single CPU core..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-300">Feature Bullet Points</label>
              <input
                type="text"
                value={config.mcBullet1 || ''}
                onChange={(e) => updateField('mcBullet1', e.target.value)}
                placeholder="Paper, Purpur, Fabric, Forge & Modpacks"
                className="w-full px-3.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
              />
              <input
                type="text"
                value={config.mcBullet2 || ''}
                onChange={(e) => updateField('mcBullet2', e.target.value)}
                placeholder="Upload worlds and plugins directly in browser"
                className="w-full px-3.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
              />
              <input
                type="text"
                value={config.mcBullet3 || ''}
                onChange={(e) => updateField('mcBullet3', e.target.value)}
                placeholder="Schedule daily or weekly snapshots"
                className="w-full px-3.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
              />
            </div>
          </div>

          {/* Discord Bot Config */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Bot className="h-4 w-4 text-amber-400" />
                <span>Discord Bot Showcase</span>
              </h3>
              <button
                type="button"
                onClick={() => updateField('showDiscordBotSection', config.showDiscordBotSection === false ? true : false)}
                className="cursor-pointer"
              >
                {config.showDiscordBotSection !== false ? (
                  <ToggleRight className="h-7 w-7 text-amber-400" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-zinc-600" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Eyebrow Tag</label>
                <input
                  type="text"
                  value={config.botEyebrow || ''}
                  onChange={(e) => updateField('botEyebrow', e.target.value)}
                  placeholder="DISCORD BOT HOSTING"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">CTA Button Text</label>
                <input
                  type="text"
                  value={config.botCtaText || ''}
                  onChange={(e) => updateField('botCtaText', e.target.value)}
                  placeholder="Explore Discord Bots"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Heading</label>
              <input
                type="text"
                value={config.botHeading || ''}
                onChange={(e) => updateField('botHeading', e.target.value)}
                placeholder="24/7 background process supervision and multi-runtime support."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={config.botDescription || ''}
                onChange={(e) => updateField('botDescription', e.target.value)}
                placeholder="Keep your bots online without unexpected downtime..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-300">Feature Bullet Points</label>
              <input
                type="text"
                value={config.botBullet1 || ''}
                onChange={(e) => updateField('botBullet1', e.target.value)}
                placeholder="Node.js (18, 20, 22), Python (3.9 - 3.12), Bun & Go"
                className="w-full px-3.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
              />
              <input
                type="text"
                value={config.botBullet2 || ''}
                onChange={(e) => updateField('botBullet2', e.target.value)}
                placeholder="Store bot tokens securely outside git history"
                className="w-full px-3.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
              />
              <input
                type="text"
                value={config.botBullet3 || ''}
                onChange={(e) => updateField('botBullet3', e.target.value)}
                placeholder="Direct routes to Discord edge infrastructure"
                className="w-full px-3.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: HARDWARE & STATS */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Infrastructure */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Cpu className="h-4 w-4 text-amber-400" />
              <span>Infrastructure Text</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Eyebrow</label>
              <input
                type="text"
                value={config.infraEyebrow || ''}
                onChange={(e) => updateField('infraEyebrow', e.target.value)}
                placeholder="Bare-Metal Hardware"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Heading</label>
              <input
                type="text"
                value={config.infraHeading || ''}
                onChange={(e) => updateField('infraHeading', e.target.value)}
                placeholder="Engineered for pure single-core speed."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={config.infraDescription || ''}
                onChange={(e) => updateField('infraDescription', e.target.value)}
                placeholder="We never oversell CPU cores or place workloads behind congested shared hypervisors..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>
          </div>

          {/* 4 Statistics Metrics */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Live Statistics Row (4 Stat Cards)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[11px] font-mono text-zinc-400">Stat 1</span>
                <input
                  type="text"
                  value={config.stat1Value || ''}
                  onChange={(e) => updateField('stat1Value', e.target.value)}
                  placeholder="99.99%"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white font-bold text-sm"
                />
                <input
                  type="text"
                  value={config.stat1Label || ''}
                  onChange={(e) => updateField('stat1Label', e.target.value)}
                  placeholder="Uptime SLA"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 text-xs"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[11px] font-mono text-zinc-400">Stat 2</span>
                <input
                  type="text"
                  value={config.stat2Value || ''}
                  onChange={(e) => updateField('stat2Value', e.target.value)}
                  placeholder="32+"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white font-bold text-sm"
                />
                <input
                  type="text"
                  value={config.stat2Label || ''}
                  onChange={(e) => updateField('stat2Label', e.target.value)}
                  placeholder="Global PoPs"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 text-xs"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[11px] font-mono text-zinc-400">Stat 3</span>
                <input
                  type="text"
                  value={config.stat3Value || ''}
                  onChange={(e) => updateField('stat3Value', e.target.value)}
                  placeholder="24/7"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white font-bold text-sm"
                />
                <input
                  type="text"
                  value={config.stat3Label || ''}
                  onChange={(e) => updateField('stat3Label', e.target.value)}
                  placeholder="Monitoring"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 text-xs"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[11px] font-mono text-zinc-400">Stat 4</span>
                <input
                  type="text"
                  value={config.stat4Value || ''}
                  onChange={(e) => updateField('stat4Value', e.target.value)}
                  placeholder="<30s"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white font-bold text-sm"
                />
                <input
                  type="text"
                  value={config.stat4Label || ''}
                  onChange={(e) => updateField('stat4Label', e.target.value)}
                  placeholder="Deployment"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: FINAL CTA */}
      {activeTab === 'cta' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-amber-400" />
                <span>Closing Call to Action (CTA) Box</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                The high-impact banner shown before the page footer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('showCtaSection', config.showCtaSection === false ? true : false)}
              className="cursor-pointer"
            >
              {config.showCtaSection !== false ? (
                <ToggleRight className="h-7 w-7 text-amber-400" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-zinc-600" />
              )}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Eyebrow</label>
            <input
              type="text"
              value={config.ctaEyebrow || ''}
              onChange={(e) => updateField('ctaEyebrow', e.target.value)}
              placeholder="Ready To Deploy?"
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Heading</label>
            <input
              type="text"
              value={config.ctaHeading || ''}
              onChange={(e) => updateField('ctaHeading', e.target.value)}
              placeholder="Start building on modern infrastructure today."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={config.ctaDescription || ''}
              onChange={(e) => updateField('ctaDescription', e.target.value)}
              placeholder="Get your Minecraft server or Discord bot up and running in under 30 seconds..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <span className="text-xs font-semibold text-white block">Primary Button</span>
              <input
                type="text"
                value={config.ctaPrimaryText || ''}
                onChange={(e) => updateField('ctaPrimaryText', e.target.value)}
                placeholder="Get Started Now"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
              />
              <input
                type="text"
                value={config.ctaPrimaryPage || ''}
                onChange={(e) => updateField('ctaPrimaryPage', e.target.value)}
                placeholder="register"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-mono"
              />
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <span className="text-xs font-semibold text-white block">Secondary Button</span>
              <input
                type="text"
                value={config.ctaSecondaryText || ''}
                onChange={(e) => updateField('ctaSecondaryText', e.target.value)}
                placeholder="View All Plans"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
              />
              <input
                type="text"
                value={config.ctaSecondaryPage || ''}
                onChange={(e) => updateField('ctaSecondaryPage', e.target.value)}
                placeholder="pricing"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: LIVE MINI PREVIEW */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Real-Time Homepage Rendering Preview
            </h3>
            <span className="text-[11px] font-mono text-amber-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Live Sync Active
            </span>
          </div>

          {/* Mini preview canvas */}
          <div className="rounded-2xl border border-zinc-800 bg-black/90 p-6 sm:p-8 space-y-8 overflow-hidden relative shadow-2xl">
            {/* Ambient light */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />

            {/* Hero Preview */}
            <div className="text-center relative max-w-2xl mx-auto space-y-4 pt-4">
              {config.showHeroBadge !== false && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-white/[0.08] text-[11px] text-zinc-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span>{config.heroBadgeText || 'POWERED BY CLOUD'}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-amber-400">{config.heroBadgeLinkText || 'Status →'}</span>
                </div>
              )}

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {config.heroHeadlinePrefix || 'Powerful infrastructure for'}{' '}
                <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                  {config.heroHeadlineAccent || 'your next server.'}
                </span>
              </h2>

              <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
                {config.heroDescription || 'Deploy high-performance Minecraft servers and 24/7 background bots...'}
              </p>

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <div className="px-4 py-2 rounded-lg bg-amber-400 text-zinc-950 font-bold text-xs">
                  {config.heroPrimaryCtaText || 'Get Started'}
                </div>
                <div className="px-4 py-2 rounded-lg bg-zinc-900 border border-white/[0.08] text-zinc-300 text-xs">
                  {config.heroSecondaryCtaText || 'Explore Hosting'}
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-500 pt-2">
                <span>✓ {config.heroBullet1 || 'Instant activation'}</span>
                <span>✓ {config.heroBullet2 || 'No setup fees'}</span>
                <span>✓ {config.heroBullet3 || 'Cancel anytime'}</span>
              </div>
            </div>

            {/* Trust Bar Preview */}
            {config.showTrustBar !== false && (
              <div className="border-y border-white/[0.08] py-3 text-[11px] text-zinc-300 font-medium flex flex-wrap items-center justify-between gap-2">
                <span>🛡️ {config.trustBarItem1 || '99.99% Uptime SLA'}</span>
                <span>⚡ {config.trustBarItem2 || 'PCIe Gen4 NVMe'}</span>
                <span>🔒 {config.trustBarItem3 || '3.2 Tbps DDoS'}</span>
                <span>🚀 {config.trustBarItem4 || '<30s Deploy'}</span>
                <span>⏱️ {config.trustBarItem5 || '24/7 Telemetry'}</span>
              </div>
            )}

            {/* Active Sections Summary */}
            <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
              <span>Section Layout Summary:</span>
              <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                {config.showMinecraftSection !== false && <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-400">Minecraft: ON</span>}
                {config.showDiscordBotSection !== false && <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-400">Bots: ON</span>}
                {config.showInfrastructureSection !== false && <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300">Infra: ON</span>}
                {config.showStatsSection !== false && <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300">Stats: ON</span>}
                {config.showFeaturesSection !== false && <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300">Features: ON</span>}
                {config.showPricingSection !== false && <span className="px-2 py-0.5 rounded bg-zinc-900 text-emerald-400">Pricing: ON</span>}
                {config.showFaqSection !== false && <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300">FAQ: ON</span>}
                {config.showCtaSection !== false && <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-400">CTA: ON</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl">
        <span className="text-xs text-zinc-400">
          Remember to save changes to publish your new homepage configuration.
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{saveSuccess ? 'Changes Saved!' : 'Save & Publish Homepage'}</span>
        </button>
      </div>

    </div>
  );
};
