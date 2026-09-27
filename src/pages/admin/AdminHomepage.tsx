import React, { useState, useEffect } from 'react';
import {
  Layout, Eye, Save, RefreshCw, Check, Sparkles, Sliders, ToggleLeft, ToggleRight,
  Gamepad2, Bot, HardDrive, Cpu, Terminal, ArrowRight, ShieldCheck, Activity,
  Info, ExternalLink, HelpCircle, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { useBranding } from '../../lib/BrandingContext';
import { apiRequest } from '../../lib/api';
import { HomepageConfig } from '../../types';

interface AdminHomepageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const AdminHomepage: React.FC<AdminHomepageProps> = ({ onNavigate }) => {
  const { homepageConfig, setHomepageConfigLocally, refreshBranding, brandName } = useBranding();
  const [activeTab, setActiveTab] = useState<'hero' | 'sections' | 'products' | 'stats' | 'cta'>('hero');

  // Hero States
  const [showHeroBadge, setShowHeroBadge] = useState<boolean>(homepageConfig.showHeroBadge ?? true);
  const [heroBadgeText, setHeroBadgeText] = useState<string>(homepageConfig.heroBadgeText || '');
  const [heroBadgeLinkText, setHeroBadgeLinkText] = useState<string>(homepageConfig.heroBadgeLinkText || '');
  const [heroBadgeLinkTarget, setHeroBadgeLinkTarget] = useState<string>(homepageConfig.heroBadgeLinkTarget || 'status');

  const [heroHeadlinePrefix, setHeroHeadlinePrefix] = useState<string>(homepageConfig.heroHeadlinePrefix || 'Powerful infrastructure for');
  const [heroHeadlineAccent, setHeroHeadlineAccent] = useState<string>(homepageConfig.heroHeadlineAccent || 'your next server.');
  const [heroDescription, setHeroDescription] = useState<string>(homepageConfig.heroDescription || '');

  const [heroPrimaryCtaText, setHeroPrimaryCtaText] = useState<string>(homepageConfig.heroPrimaryCtaText || 'Get Started');
  const [heroPrimaryCtaPage, setHeroPrimaryCtaPage] = useState<string>(homepageConfig.heroPrimaryCtaPage || 'register');
  const [heroSecondaryCtaText, setHeroSecondaryCtaText] = useState<string>(homepageConfig.heroSecondaryCtaText || 'Explore Hosting');
  const [heroSecondaryCtaPage, setHeroSecondaryCtaPage] = useState<string>(homepageConfig.heroSecondaryCtaPage || 'pricing');

  const [heroBullet1, setHeroBullet1] = useState<string>(homepageConfig.heroBullet1 || 'Instant activation');
  const [heroBullet2, setHeroBullet2] = useState<string>(homepageConfig.heroBullet2 || 'No setup fees');
  const [heroBullet3, setHeroBullet3] = useState<string>(homepageConfig.heroBullet3 || 'Cancel anytime');

  // Section Toggles
  const [showTrustBar, setShowTrustBar] = useState<boolean>(homepageConfig.showTrustBar ?? true);
  const [showMinecraftSection, setShowMinecraftSection] = useState<boolean>(homepageConfig.showMinecraftSection ?? true);
  const [showDiscordBotSection, setShowDiscordBotSection] = useState<boolean>(homepageConfig.showDiscordBotSection ?? true);
  const [showInfrastructureSection, setShowInfrastructureSection] = useState<boolean>(homepageConfig.showInfrastructureSection ?? true);
  const [showStatsSection, setShowStatsSection] = useState<boolean>(homepageConfig.showStatsSection ?? true);
  const [showFeaturesSection, setShowFeaturesSection] = useState<boolean>(homepageConfig.showFeaturesSection ?? true);
  const [showPricingSection, setShowPricingSection] = useState<boolean>(homepageConfig.showPricingSection ?? true);
  const [showFaqSection, setShowFaqSection] = useState<boolean>(homepageConfig.showFaqSection ?? true);
  const [showCtaSection, setShowCtaSection] = useState<boolean>(homepageConfig.showCtaSection ?? true);

  // Trust Bar Custom Items
  const [trustBarItem1, setTrustBarItem1] = useState<string>(homepageConfig.trustBarItem1 || '99.99% Uptime SLA');
  const [trustBarItem2, setTrustBarItem2] = useState<string>(homepageConfig.trustBarItem2 || 'PCIe Gen4 NVMe Storage');
  const [trustBarItem3, setTrustBarItem3] = useState<string>(homepageConfig.trustBarItem3 || '3.2 Tbps DDoS Protection');
  const [trustBarItem4, setTrustBarItem4] = useState<string>(homepageConfig.trustBarItem4 || '<30s Instant Provisioning');
  const [trustBarItem5, setTrustBarItem5] = useState<string>(homepageConfig.trustBarItem5 || '24/7 Node Telemetry');

  // Products Copy
  const [mcEyebrow, setMcEyebrow] = useState<string>(homepageConfig.mcEyebrow || 'MINECRAFT SERVER HOSTING');
  const [mcHeading, setMcHeading] = useState<string>(homepageConfig.mcHeading || 'Single-thread performance built for zero tick drops.');
  const [mcDescription, setMcDescription] = useState<string>(homepageConfig.mcDescription || '');
  const [mcBullet1, setMcBullet1] = useState<string>(homepageConfig.mcBullet1 || 'Instant 1-Click Installs: Paper, Purpur, Fabric, Forge & Modpacks');
  const [mcBullet2, setMcBullet2] = useState<string>(homepageConfig.mcBullet2 || 'Web SFTP & Fast Unzip: Upload worlds and plugins directly in browser');
  const [mcBullet3, setMcBullet3] = useState<string>(homepageConfig.mcBullet3 || 'Automated S3 Backups: Schedule daily or weekly snapshots');
  const [mcCtaText, setMcCtaText] = useState<string>(homepageConfig.mcCtaText || 'Explore Minecraft');

  const [botEyebrow, setBotEyebrow] = useState<string>(homepageConfig.botEyebrow || 'DISCORD BOT HOSTING');
  const [botHeading, setBotHeading] = useState<string>(homepageConfig.botHeading || '24/7 background process supervision and multi-runtime support.');
  const [botDescription, setBotDescription] = useState<string>(homepageConfig.botDescription || '');
  const [botBullet1, setBotBullet1] = useState<string>(homepageConfig.botBullet1 || 'Multi-Runtime: Node.js (18, 20, 22), Python (3.9 - 3.12), Bun & Go');
  const [botBullet2, setBotBullet2] = useState<string>(homepageConfig.botBullet2 || 'Secret Token Management: Store bot tokens securely outside git history');
  const [botBullet3, setBotBullet3] = useState<string>(homepageConfig.botBullet3 || 'Low-Latency Gateways: Direct routes to Discord edge infrastructure');
  const [botCtaText, setBotCtaText] = useState<string>(homepageConfig.botCtaText || 'Explore Discord Bots');

  // Stats & Infra
  const [stat1Value, setStat1Value] = useState<string>(homepageConfig.stat1Value || '99.99%');
  const [stat1Label, setStat1Label] = useState<string>(homepageConfig.stat1Label || 'Uptime SLA');
  const [stat2Value, setStat2Value] = useState<string>(homepageConfig.stat2Value || '32+');
  const [stat2Label, setStat2Label] = useState<string>(homepageConfig.stat2Label || 'Global PoPs');
  const [stat3Value, setStat3Value] = useState<string>(homepageConfig.stat3Value || '24/7');
  const [stat3Label, setStat3Label] = useState<string>(homepageConfig.stat3Label || 'Monitoring');
  const [stat4Value, setStat4Value] = useState<string>(homepageConfig.stat4Value || '<30s');
  const [stat4Label, setStat4Label] = useState<string>(homepageConfig.stat4Label || 'Deployment');

  const [infraEyebrow, setInfraEyebrow] = useState<string>(homepageConfig.infraEyebrow || 'Bare-Metal Hardware');
  const [infraHeading, setInfraHeading] = useState<string>(homepageConfig.infraHeading || 'Engineered for pure single-core speed.');
  const [infraDescription, setInfraDescription] = useState<string>(homepageConfig.infraDescription || '');

  // Final CTA
  const [ctaEyebrow, setCtaEyebrow] = useState<string>(homepageConfig.ctaEyebrow || 'Ready To Deploy?');
  const [ctaHeading, setCtaHeading] = useState<string>(homepageConfig.ctaHeading || 'Start building on modern infrastructure today.');
  const [ctaDescription, setCtaDescription] = useState<string>(homepageConfig.ctaDescription || '');
  const [ctaPrimaryText, setCtaPrimaryText] = useState<string>(homepageConfig.ctaPrimaryText || 'Get Started Now');
  const [ctaPrimaryPage, setCtaPrimaryPage] = useState<string>(homepageConfig.ctaPrimaryPage || 'register');
  const [ctaSecondaryText, setCtaSecondaryText] = useState<string>(homepageConfig.ctaSecondaryText || 'View All Plans');
  const [ctaSecondaryPage, setCtaSecondaryPage] = useState<string>(homepageConfig.ctaSecondaryPage || 'pricing');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state if homepageConfig updates
  useEffect(() => {
    if (homepageConfig) {
      if (homepageConfig.showHeroBadge !== undefined) setShowHeroBadge(homepageConfig.showHeroBadge);
      if (homepageConfig.heroBadgeText !== undefined) setHeroBadgeText(homepageConfig.heroBadgeText);
      if (homepageConfig.heroBadgeLinkText !== undefined) setHeroBadgeLinkText(homepageConfig.heroBadgeLinkText);
      if (homepageConfig.heroBadgeLinkTarget !== undefined) setHeroBadgeLinkTarget(homepageConfig.heroBadgeLinkTarget);

      if (homepageConfig.heroHeadlinePrefix) setHeroHeadlinePrefix(homepageConfig.heroHeadlinePrefix);
      if (homepageConfig.heroHeadlineAccent) setHeroHeadlineAccent(homepageConfig.heroHeadlineAccent);
      if (homepageConfig.heroDescription) setHeroDescription(homepageConfig.heroDescription);

      if (homepageConfig.heroPrimaryCtaText) setHeroPrimaryCtaText(homepageConfig.heroPrimaryCtaText);
      if (homepageConfig.heroPrimaryCtaPage) setHeroPrimaryCtaPage(homepageConfig.heroPrimaryCtaPage);
      if (homepageConfig.heroSecondaryCtaText) setHeroSecondaryCtaText(homepageConfig.heroSecondaryCtaText);
      if (homepageConfig.heroSecondaryCtaPage) setHeroSecondaryCtaPage(homepageConfig.heroSecondaryCtaPage);

      if (homepageConfig.heroBullet1) setHeroBullet1(homepageConfig.heroBullet1);
      if (homepageConfig.heroBullet2) setHeroBullet2(homepageConfig.heroBullet2);
      if (homepageConfig.heroBullet3) setHeroBullet3(homepageConfig.heroBullet3);

      if (homepageConfig.showTrustBar !== undefined) setShowTrustBar(homepageConfig.showTrustBar);
      if (homepageConfig.trustBarItem1) setTrustBarItem1(homepageConfig.trustBarItem1);
      if (homepageConfig.trustBarItem2) setTrustBarItem2(homepageConfig.trustBarItem2);
      if (homepageConfig.trustBarItem3) setTrustBarItem3(homepageConfig.trustBarItem3);
      if (homepageConfig.trustBarItem4) setTrustBarItem4(homepageConfig.trustBarItem4);
      if (homepageConfig.trustBarItem5) setTrustBarItem5(homepageConfig.trustBarItem5);

      if (homepageConfig.showMinecraftSection !== undefined) setShowMinecraftSection(homepageConfig.showMinecraftSection);
      if (homepageConfig.showDiscordBotSection !== undefined) setShowDiscordBotSection(homepageConfig.showDiscordBotSection);
      if (homepageConfig.showInfrastructureSection !== undefined) setShowInfrastructureSection(homepageConfig.showInfrastructureSection);
      if (homepageConfig.showStatsSection !== undefined) setShowStatsSection(homepageConfig.showStatsSection);
      if (homepageConfig.showFeaturesSection !== undefined) setShowFeaturesSection(homepageConfig.showFeaturesSection);
      if (homepageConfig.showPricingSection !== undefined) setShowPricingSection(homepageConfig.showPricingSection);
      if (homepageConfig.showFaqSection !== undefined) setShowFaqSection(homepageConfig.showFaqSection);
      if (homepageConfig.showCtaSection !== undefined) setShowCtaSection(homepageConfig.showCtaSection);

      if (homepageConfig.mcEyebrow) setMcEyebrow(homepageConfig.mcEyebrow);
      if (homepageConfig.mcHeading) setMcHeading(homepageConfig.mcHeading);
      if (homepageConfig.mcDescription) setMcDescription(homepageConfig.mcDescription);
      if (homepageConfig.mcBullet1) setMcBullet1(homepageConfig.mcBullet1);
      if (homepageConfig.mcBullet2) setMcBullet2(homepageConfig.mcBullet2);
      if (homepageConfig.mcBullet3) setMcBullet3(homepageConfig.mcBullet3);
      if (homepageConfig.mcCtaText) setMcCtaText(homepageConfig.mcCtaText);

      if (homepageConfig.botEyebrow) setBotEyebrow(homepageConfig.botEyebrow);
      if (homepageConfig.botHeading) setBotHeading(homepageConfig.botHeading);
      if (homepageConfig.botDescription) setBotDescription(homepageConfig.botDescription);
      if (homepageConfig.botBullet1) setBotBullet1(homepageConfig.botBullet1);
      if (homepageConfig.botBullet2) setBotBullet2(homepageConfig.botBullet2);
      if (homepageConfig.botBullet3) setBotBullet3(homepageConfig.botBullet3);
      if (homepageConfig.botCtaText) setBotCtaText(homepageConfig.botCtaText);

      if (homepageConfig.stat1Value) setStat1Value(homepageConfig.stat1Value);
      if (homepageConfig.stat1Label) setStat1Label(homepageConfig.stat1Label);
      if (homepageConfig.stat2Value) setStat2Value(homepageConfig.stat2Value);
      if (homepageConfig.stat2Label) setStat2Label(homepageConfig.stat2Label);
      if (homepageConfig.stat3Value) setStat3Value(homepageConfig.stat3Value);
      if (homepageConfig.stat3Label) setStat3Label(homepageConfig.stat3Label);
      if (homepageConfig.stat4Value) setStat4Value(homepageConfig.stat4Value);
      if (homepageConfig.stat4Label) setStat4Label(homepageConfig.stat4Label);

      if (homepageConfig.infraEyebrow) setInfraEyebrow(homepageConfig.infraEyebrow);
      if (homepageConfig.infraHeading) setInfraHeading(homepageConfig.infraHeading);
      if (homepageConfig.infraDescription) setInfraDescription(homepageConfig.infraDescription);

      if (homepageConfig.ctaEyebrow) setCtaEyebrow(homepageConfig.ctaEyebrow);
      if (homepageConfig.ctaHeading) setCtaHeading(homepageConfig.ctaHeading);
      if (homepageConfig.ctaDescription) setCtaDescription(homepageConfig.ctaDescription);
      if (homepageConfig.ctaPrimaryText) setCtaPrimaryText(homepageConfig.ctaPrimaryText);
      if (homepageConfig.ctaPrimaryPage) setCtaPrimaryPage(homepageConfig.ctaPrimaryPage);
      if (homepageConfig.ctaSecondaryText) setCtaSecondaryText(homepageConfig.ctaSecondaryText);
      if (homepageConfig.ctaSecondaryPage) setCtaSecondaryPage(homepageConfig.ctaSecondaryPage);
    }
  }, [homepageConfig]);

  const handleSaveConfig = async () => {
    setSaving(true);
    setErrorMsg(null);

    const updatedConfig: HomepageConfig = {
      showHeroBadge,
      heroBadgeText: heroBadgeText.trim(),
      heroBadgeLinkText: heroBadgeLinkText.trim(),
      heroBadgeLinkTarget: heroBadgeLinkTarget.trim(),
      heroHeadlinePrefix: heroHeadlinePrefix.trim(),
      heroHeadlineAccent: heroHeadlineAccent.trim(),
      heroDescription: heroDescription.trim(),
      heroPrimaryCtaText: heroPrimaryCtaText.trim(),
      heroPrimaryCtaPage: heroPrimaryCtaPage.trim(),
      heroSecondaryCtaText: heroSecondaryCtaText.trim(),
      heroSecondaryCtaPage: heroSecondaryCtaPage.trim(),
      heroBullet1: heroBullet1.trim(),
      heroBullet2: heroBullet2.trim(),
      heroBullet3: heroBullet3.trim(),

      showTrustBar,
      trustBarItem1: trustBarItem1.trim(),
      trustBarItem2: trustBarItem2.trim(),
      trustBarItem3: trustBarItem3.trim(),
      trustBarItem4: trustBarItem4.trim(),
      trustBarItem5: trustBarItem5.trim(),

      showMinecraftSection,
      showDiscordBotSection,
      showInfrastructureSection,
      showStatsSection,
      showFeaturesSection,
      showPricingSection,
      showFaqSection,
      showCtaSection,

      mcEyebrow: mcEyebrow.trim(),
      mcHeading: mcHeading.trim(),
      mcDescription: mcDescription.trim(),
      mcBullet1: mcBullet1.trim(),
      mcBullet2: mcBullet2.trim(),
      mcBullet3: mcBullet3.trim(),
      mcCtaText: mcCtaText.trim(),

      botEyebrow: botEyebrow.trim(),
      botHeading: botHeading.trim(),
      botDescription: botDescription.trim(),
      botBullet1: botBullet1.trim(),
      botBullet2: botBullet2.trim(),
      botBullet3: botBullet3.trim(),
      botCtaText: botCtaText.trim(),

      stat1Value: stat1Value.trim(),
      stat1Label: stat1Label.trim(),
      stat2Value: stat2Value.trim(),
      stat2Label: stat2Label.trim(),
      stat3Value: stat3Value.trim(),
      stat3Label: stat3Label.trim(),
      stat4Value: stat4Value.trim(),
      stat4Label: stat4Label.trim(),

      infraEyebrow: infraEyebrow.trim(),
      infraHeading: infraHeading.trim(),
      infraDescription: infraDescription.trim(),

      ctaEyebrow: ctaEyebrow.trim(),
      ctaHeading: ctaHeading.trim(),
      ctaDescription: ctaDescription.trim(),
      ctaPrimaryText: ctaPrimaryText.trim(),
      ctaPrimaryPage: ctaPrimaryPage.trim(),
      ctaSecondaryText: ctaSecondaryText.trim(),
      ctaSecondaryPage: ctaSecondaryPage.trim(),
    };

    try {
      const res = await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          homepageConfig: updatedConfig
        })
      });

      if (res.success) {
        setHomepageConfigLocally(updatedConfig);
        await refreshBranding();
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        setErrorMsg(res.error?.message || 'Failed to save homepage settings.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving settings.');
    }
    setSaving(false);
  };

  const handleResetToDefault = () => {
    if (!confirm('Reset all homepage customizations back to default values?')) return;

    setShowHeroBadge(true);
    setHeroBadgeText('');
    setHeroBadgeLinkText('');
    setHeroBadgeLinkTarget('status');
    setHeroHeadlinePrefix('Powerful infrastructure for');
    setHeroHeadlineAccent('your next server.');
    setHeroDescription('');
    setHeroPrimaryCtaText('Get Started');
    setHeroPrimaryCtaPage('register');
    setHeroSecondaryCtaText('Explore Hosting');
    setHeroSecondaryCtaPage('pricing');
    setHeroBullet1('Instant activation');
    setHeroBullet2('No setup fees');
    setHeroBullet3('Cancel anytime');

    setShowTrustBar(true);
    setTrustBarItem1('99.99% Uptime SLA');
    setTrustBarItem2('PCIe Gen4 NVMe Storage');
    setTrustBarItem3('3.2 Tbps DDoS Protection');
    setTrustBarItem4('<30s Instant Provisioning');
    setTrustBarItem5('24/7 Node Telemetry');

    setShowMinecraftSection(true);
    setShowDiscordBotSection(true);
    setShowInfrastructureSection(true);
    setShowStatsSection(true);
    setShowFeaturesSection(true);
    setShowPricingSection(true);
    setShowFaqSection(true);
    setShowCtaSection(true);

    setMcEyebrow('MINECRAFT SERVER HOSTING');
    setMcHeading('Single-thread performance built for zero tick drops.');
    setMcDescription('');
    setMcBullet1('Instant 1-Click Installs: Paper, Purpur, Fabric, Forge & Modpacks');
    setMcBullet2('Web SFTP & Fast Unzip: Upload worlds and plugins directly in browser');
    setMcBullet3('Automated S3 Backups: Schedule daily or weekly snapshots');
    setMcCtaText('Explore Minecraft');

    setBotEyebrow('DISCORD BOT HOSTING');
    setBotHeading('24/7 background process supervision and multi-runtime support.');
    setBotDescription('');
    setBotBullet1('Multi-Runtime: Node.js (18, 20, 22), Python (3.9 - 3.12), Bun & Go');
    setBotBullet2('Secret Token Management: Store bot tokens securely outside git history');
    setBotBullet3('Low-Latency Gateways: Direct routes to Discord edge infrastructure');
    setBotCtaText('Explore Discord Bots');

    setStat1Value('99.99%');
    setStat1Label('Uptime SLA');
    setStat2Value('32+');
    setStat2Label('Global PoPs');
    setStat3Value('24/7');
    setStat3Label('Monitoring');
    setStat4Value('<30s');
    setStat4Label('Deployment');

    setInfraEyebrow('Bare-Metal Hardware');
    setInfraHeading('Engineered for pure single-core speed.');
    setInfraDescription('');

    setCtaEyebrow('Ready To Deploy?');
    setCtaHeading('Start building on modern infrastructure today.');
    setCtaDescription('');
    setCtaPrimaryText('Get Started Now');
    setCtaPrimaryPage('register');
    setCtaSecondaryText('View All Plans');
    setCtaSecondaryPage('pricing');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Layout className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Homepage Visual Builder</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Customize every headline, badge, call-to-action, section visibility, and feature highlights on the public landing page in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/[0.06]"
              title="Open public homepage to preview"
            >
              <Eye className="h-3.5 w-3.5 text-zinc-400" />
              <span>Preview Live Page</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : savedSuccess ? (
              <Check className="h-4 w-4 stroke-[3]" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{savedSuccess ? 'Published!' : 'Save & Publish'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab('hero')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'hero'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          1. Hero Section & Headlines
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'sections'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          2. Section Toggles & Trust Bar
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'products'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          3. Minecraft & Discord Bot Copy
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'stats'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          4. Statistics & Hardware
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cta')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'cta'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          5. Final CTA Banner
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1: HERO SECTION & HEADLINES
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'hero' && (
        <div className="space-y-6">
          
          {/* Announcement Badge */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Hero Top Announcement Badge
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Displays a prominent pill with an animated amber ping above the main hero headline.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHeroBadge}
                  onChange={(e) => setShowHeroBadge(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {showHeroBadge && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Badge Announcement Text
                  </label>
                  <input
                    type="text"
                    value={heroBadgeText}
                    onChange={(e) => setHeroBadgeText(e.target.value)}
                    placeholder={`POWERED BY ${(brandName || 'AETHERPANEL').toUpperCase()} CLOUD`}
                    className="w-full h-10 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Leave empty to use brand default.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Badge Link Text
                  </label>
                  <input
                    type="text"
                    value={heroBadgeLinkText}
                    onChange={(e) => setHeroBadgeLinkText(e.target.value)}
                    placeholder="Hardware Status →"
                    className="w-full h-10 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Target Route / Page
                  </label>
                  <select
                    value={heroBadgeLinkTarget}
                    onChange={(e) => setHeroBadgeLinkTarget(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="status">Status Page (/status)</option>
                    <option value="pricing">Pricing Plans (/pricing)</option>
                    <option value="minecraft">Minecraft Hosting (/minecraft)</option>
                    <option value="bot">Discord Bot Hosting (/bot)</option>
                    <option value="docs">Documentation (/docs)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Main Headline & Description */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-zinc-800">
              Main Headline & Hero Copy
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Headline (White Text Prefix)
                </label>
                <input
                  type="text"
                  value={heroHeadlinePrefix}
                  onChange={(e) => setHeroHeadlinePrefix(e.target.value)}
                  placeholder="Powerful infrastructure for"
                  className="w-full h-10 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Headline (Orange Gradient Accent)
                </label>
                <input
                  type="text"
                  value={heroHeadlineAccent}
                  onChange={(e) => setHeroHeadlineAccent(e.target.value)}
                  placeholder="your next server."
                  className="w-full h-10 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-amber-400 focus:outline-none focus:border-amber-500 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Hero Subtitle / Description (1–2 concise lines)
              </label>
              <textarea
                rows={2}
                value={heroDescription}
                onChange={(e) => setHeroDescription(e.target.value)}
                placeholder="Deploy high-performance Minecraft servers and 24/7 background bots with instant automated setup, enterprise NVMe storage, and DDoS protection."
                className="w-full p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Action Buttons & Trust Bullets */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-zinc-800">
              Call-To-Action Buttons & Trust Highlights
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>Primary Button (Amber Gradient)</span>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Button Label</label>
                  <input
                    type="text"
                    value={heroPrimaryCtaText}
                    onChange={(e) => setHeroPrimaryCtaText(e.target.value)}
                    placeholder="Get Started"
                    className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Destination Action</label>
                  <select
                    value={heroPrimaryCtaPage}
                    onChange={(e) => setHeroPrimaryCtaPage(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="register">Register Account (/register)</option>
                    <option value="pricing">Pricing Plans (/pricing)</option>
                    <option value="minecraft">Minecraft Hosting (/minecraft)</option>
                    <option value="bot">Discord Bots (/bot)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                  <span className="h-2 w-2 rounded-full bg-zinc-400" />
                  <span>Secondary Button (Dark Outline)</span>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Button Label</label>
                  <input
                    type="text"
                    value={heroSecondaryCtaText}
                    onChange={(e) => setHeroSecondaryCtaText(e.target.value)}
                    placeholder="Explore Hosting"
                    className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Destination Action</label>
                  <select
                    value={heroSecondaryCtaPage}
                    onChange={(e) => setHeroSecondaryCtaPage(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="pricing">Pricing Plans (/pricing)</option>
                    <option value="hosting">Scroll to Workloads (#hosting)</option>
                    <option value="minecraft">Minecraft Hosting (/minecraft)</option>
                    <option value="bot">Discord Bots (/bot)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                3 Trust Highlights (displayed directly under the buttons)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={heroBullet1}
                  onChange={(e) => setHeroBullet1(e.target.value)}
                  placeholder="Instant activation"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={heroBullet2}
                  onChange={(e) => setHeroBullet2(e.target.value)}
                  placeholder="No setup fees"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={heroBullet3}
                  onChange={(e) => setHeroBullet3(e.target.value)}
                  placeholder="Cancel anytime"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 2: SECTION TOGGLES & TRUST BAR
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          
          {/* Section Visibility Switches */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-zinc-800">
              Homepage Section Visibility Toggles
            </h3>
            <p className="text-xs text-zinc-400">
              Easily turn on or off any section of your public homepage with a single click.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              
              <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Trust & Specs Bar</p>
                  <p className="text-[10px] text-zinc-400">Horizontal specification row</p>
                </div>
                <input
                  type="checkbox"
                  checked={showTrustBar}
                  onChange={(e) => setShowTrustBar(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Minecraft Showcase</p>
                  <p className="text-[10px] text-zinc-400">Dedicated game server block</p>
                </div>
                <input
                  type="checkbox"
                  checked={showMinecraftSection}
                  onChange={(e) => setShowMinecraftSection(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Discord Bot Showcase</p>
                  <p className="text-[10px] text-zinc-400">Process watchdog runtime block</p>
                </div>
                <input
                  type="checkbox"
                  checked={showDiscordBotSection}
                  onChange={(e) => setShowDiscordBotSection(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Infrastructure Section</p>
                  <p className="text-[10px] text-zinc-400">Bare-metal hardware specs</p>
                </div>
                <input
                  type="checkbox"
                  checked={showInfrastructureSection}
                  onChange={(e) => setShowInfrastructureSection(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Statistics Strip</p>
                  <p className="text-[10px] text-zinc-400">Uptime, locations, & SLA metrics</p>
                </div>
                <input
                  type="checkbox"
                  checked={showStatsSection}
                  onChange={(e) => setShowStatsSection(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Platform Features</p>
                  <p className="text-[10px] text-zinc-400">Console, SFTP & Cron cards</p>
                </div>
                <input
                  type="checkbox"
                  checked={showFeaturesSection}
                  onChange={(e) => setShowFeaturesSection(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Pricing Table</p>
                  <p className="text-[10px] text-zinc-400">Product plan cards & tiers</p>
                </div>
                <input
                  type="checkbox"
                  checked={showPricingSection}
                  onChange={(e) => setShowPricingSection(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">FAQ Accordion</p>
                  <p className="text-[10px] text-zinc-400">Questions & answers section</p>
                </div>
                <input
                  type="checkbox"
                  checked={showFaqSection}
                  onChange={(e) => setShowFaqSection(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Final Call-to-Action</p>
                  <p className="text-[10px] text-zinc-400">Closing registration banner</p>
                </div>
                <input
                  type="checkbox"
                  checked={showCtaSection}
                  onChange={(e) => setShowCtaSection(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-400"
                />
              </div>

            </div>
          </div>

          {/* Trust Bar Custom Items */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-zinc-800">
              Trust & Specifications Strip Items (5 Badges)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Item 1 (Uptime)</label>
                <input
                  type="text"
                  value={trustBarItem1}
                  onChange={(e) => setTrustBarItem1(e.target.value)}
                  placeholder="99.99% Uptime SLA"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Item 2 (Storage)</label>
                <input
                  type="text"
                  value={trustBarItem2}
                  onChange={(e) => setTrustBarItem2(e.target.value)}
                  placeholder="PCIe Gen4 NVMe Storage"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Item 3 (DDoS Filter)</label>
                <input
                  type="text"
                  value={trustBarItem3}
                  onChange={(e) => setTrustBarItem3(e.target.value)}
                  placeholder="3.2 Tbps DDoS Protection"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Item 4 (Provisioning)</label>
                <input
                  type="text"
                  value={trustBarItem4}
                  onChange={(e) => setTrustBarItem4(e.target.value)}
                  placeholder="<30s Instant Provisioning"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Item 5 (Monitoring)</label>
                <input
                  type="text"
                  value={trustBarItem5}
                  onChange={(e) => setTrustBarItem5(e.target.value)}
                  placeholder="24/7 Node Telemetry"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 3: MINECRAFT & DISCORD BOT COPY
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          
          {/* Minecraft Customizer */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 text-amber-400">
              <Gamepad2 className="h-4 w-4" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Minecraft Hosting Section Text
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Eyebrow Tag</label>
                <input
                  type="text"
                  value={mcEyebrow}
                  onChange={(e) => setMcEyebrow(e.target.value)}
                  placeholder="MINECRAFT SERVER HOSTING"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Button CTA Text</label>
                <input
                  type="text"
                  value={mcCtaText}
                  onChange={(e) => setMcCtaText(e.target.value)}
                  placeholder="Explore Minecraft"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Section Heading</label>
              <input
                type="text"
                value={mcHeading}
                onChange={(e) => setMcHeading(e.target.value)}
                placeholder="Single-thread performance built for zero tick drops."
                className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={mcDescription}
                onChange={(e) => setMcDescription(e.target.value)}
                placeholder="Minecraft runs its core game loop on a single CPU core. We utilize AMD Ryzen 9 7950X / 9950X silicon with single-thread boosts up to 5.7GHz, combined with Gen4 NVMe arrays to eliminate world-save hitches and chunk generation lag."
                className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">3 Feature Checklist Points</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={mcBullet1}
                  onChange={(e) => setMcBullet1(e.target.value)}
                  placeholder="Instant 1-Click Installs: Paper, Purpur, Fabric, Forge & Modpacks"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={mcBullet2}
                  onChange={(e) => setMcBullet2(e.target.value)}
                  placeholder="Web SFTP & Fast Unzip: Upload worlds and plugins directly in browser"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={mcBullet3}
                  onChange={(e) => setMcBullet3(e.target.value)}
                  placeholder="Automated S3 Backups: Schedule daily or weekly snapshots"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Discord Bot Customizer */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 text-amber-400">
              <Bot className="h-4 w-4" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Discord Bot Hosting Section Text
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Eyebrow Tag</label>
                <input
                  type="text"
                  value={botEyebrow}
                  onChange={(e) => setBotEyebrow(e.target.value)}
                  placeholder="DISCORD BOT HOSTING"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Button CTA Text</label>
                <input
                  type="text"
                  value={botCtaText}
                  onChange={(e) => setBotCtaText(e.target.value)}
                  placeholder="Explore Discord Bots"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Section Heading</label>
              <input
                type="text"
                value={botHeading}
                onChange={(e) => setBotHeading(e.target.value)}
                placeholder="24/7 background process supervision and multi-runtime support."
                className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={botDescription}
                onChange={(e) => setBotDescription(e.target.value)}
                placeholder="Keep your bots online without unexpected downtime. Our runtime supervisor monitors process exit codes, injects environment variables securely, and automatically revives terminated workers within 1.2 seconds."
                className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">3 Feature Checklist Points</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={botBullet1}
                  onChange={(e) => setBotBullet1(e.target.value)}
                  placeholder="Multi-Runtime: Node.js (18, 20, 22), Python (3.9 - 3.12), Bun & Go"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={botBullet2}
                  onChange={(e) => setBotBullet2(e.target.value)}
                  placeholder="Secret Token Management: Store bot tokens securely outside git history"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={botBullet3}
                  onChange={(e) => setBotBullet3(e.target.value)}
                  placeholder="Low-Latency Gateways: Direct routes to Discord edge infrastructure"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 4: STATISTICS & HARDWARE
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          
          {/* Statistics Numbers & Labels */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-zinc-800">
              Horizontal Statistics Numbers & Labels
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <label className="block text-[11px] text-zinc-400">Stat 1 Value</label>
                <input
                  type="text"
                  value={stat1Value}
                  onChange={(e) => setStat1Value(e.target.value)}
                  placeholder="99.99%"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-bold"
                />
                <label className="block text-[11px] text-zinc-400">Stat 1 Label</label>
                <input
                  type="text"
                  value={stat1Label}
                  onChange={(e) => setStat1Label(e.target.value)}
                  placeholder="Uptime SLA"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
                />
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <label className="block text-[11px] text-zinc-400">Stat 2 Value</label>
                <input
                  type="text"
                  value={stat2Value}
                  onChange={(e) => setStat2Value(e.target.value)}
                  placeholder="32+"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-bold"
                />
                <label className="block text-[11px] text-zinc-400">Stat 2 Label</label>
                <input
                  type="text"
                  value={stat2Label}
                  onChange={(e) => setStat2Label(e.target.value)}
                  placeholder="Global PoPs"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
                />
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <label className="block text-[11px] text-zinc-400">Stat 3 Value</label>
                <input
                  type="text"
                  value={stat3Value}
                  onChange={(e) => setStat3Value(e.target.value)}
                  placeholder="24/7"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-bold"
                />
                <label className="block text-[11px] text-zinc-400">Stat 3 Label</label>
                <input
                  type="text"
                  value={stat3Label}
                  onChange={(e) => setStat3Label(e.target.value)}
                  placeholder="Monitoring"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
                />
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <label className="block text-[11px] text-zinc-400">Stat 4 Value</label>
                <input
                  type="text"
                  value={stat4Value}
                  onChange={(e) => setStat4Value(e.target.value)}
                  placeholder="<30s"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-bold"
                />
                <label className="block text-[11px] text-zinc-400">Stat 4 Label</label>
                <input
                  type="text"
                  value={stat4Label}
                  onChange={(e) => setStat4Label(e.target.value)}
                  placeholder="Deployment"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
                />
              </div>
            </div>
          </div>

          {/* Infrastructure Section Copy */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-zinc-800">
              Infrastructure Story Copy
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Eyebrow Tag</label>
                <input
                  type="text"
                  value={infraEyebrow}
                  onChange={(e) => setInfraEyebrow(e.target.value)}
                  placeholder="Bare-Metal Hardware"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Section Heading</label>
                <input
                  type="text"
                  value={infraHeading}
                  onChange={(e) => setInfraHeading(e.target.value)}
                  placeholder="Engineered for pure single-core speed."
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={infraDescription}
                onChange={(e) => setInfraDescription(e.target.value)}
                placeholder="We never oversell CPU cores or place workloads behind congested shared hypervisors. Every instance is backed by enterprise AMD Ryzen hardware with direct hardware access."
                className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
              />
            </div>
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 5: FINAL CTA BANNER
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'cta' && (
        <div className="space-y-6">
          
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-zinc-800">
              Closing Call-To-Action Banner
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Eyebrow Tag</label>
                <input
                  type="text"
                  value={ctaEyebrow}
                  onChange={(e) => setCtaEyebrow(e.target.value)}
                  placeholder="Ready To Deploy?"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Banner Heading</label>
                <input
                  type="text"
                  value={ctaHeading}
                  onChange={(e) => setCtaHeading(e.target.value)}
                  placeholder="Start building on modern infrastructure today."
                  className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Supporting Description</label>
              <textarea
                rows={2}
                value={ctaDescription}
                onChange={(e) => setCtaDescription(e.target.value)}
                placeholder="Get your Minecraft server or Discord bot up and running in under 30 seconds with 24/7 reliability."
                className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <label className="block text-xs font-bold text-amber-400">Primary CTA Button</label>
                <input
                  type="text"
                  value={ctaPrimaryText}
                  onChange={(e) => setCtaPrimaryText(e.target.value)}
                  placeholder="Get Started Now"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                />
                <select
                  value={ctaPrimaryPage}
                  onChange={(e) => setCtaPrimaryPage(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                >
                  <option value="register">Register Account (/register)</option>
                  <option value="pricing">Pricing Plans (/pricing)</option>
                  <option value="minecraft">Minecraft Hosting (/minecraft)</option>
                </select>
              </div>

              <div className="space-y-2 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <label className="block text-xs font-bold text-zinc-300">Secondary CTA Button</label>
                <input
                  type="text"
                  value={ctaSecondaryText}
                  onChange={(e) => setCtaSecondaryText(e.target.value)}
                  placeholder="View All Plans"
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                />
                <select
                  value={ctaSecondaryPage}
                  onChange={(e) => setCtaSecondaryPage(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                >
                  <option value="pricing">Pricing Plans (/pricing)</option>
                  <option value="status">Status Page (/status)</option>
                  <option value="docs">Docs (/docs)</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Bottom Save Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Info className="h-4 w-4 text-amber-400" />
          <span>All changes reflect on the public homepage immediately after clicking Save & Publish.</span>
        </div>

        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/10 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : savedSuccess ? (
            <Check className="h-3.5 w-3.5 stroke-[3]" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span>{savedSuccess ? 'Settings Saved!' : 'Save & Publish Homepage'}</span>
        </button>
      </div>

    </div>
  );
};
