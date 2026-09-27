import React, { useState, useEffect } from 'react';
import {
  Gamepad2, Bot, Cpu, Zap, ShieldCheck, HardDrive, Terminal,
  Globe2, ArrowRight, Server, Clock, ChevronDown, Shield,
  Activity, Database, Calendar, RefreshCw, Check, Copy, ExternalLink,
  FolderTree, History, CheckCircle2
} from 'lucide-react';
import { useBranding } from '../../lib/BrandingContext';
import { apiRequest } from '../../lib/api';
import { Plan } from '../../types';

interface HomeProps {
  onNavigate: (page: string, params?: any) => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const { heroDescription, brandName, homepageConfig = {} } = useBranding();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'minecraft' | 'bot'>('minecraft');
  const [copiedIp, setCopiedIp] = useState(false);

  useEffect(() => {
    const loadFaqs = async () => {
      try {
        const res = await apiRequest('/public/faqs');
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setFaqs(res.data);
          setOpenFaqId(res.data[0].id);
        } else {
          const defaultFaqs = [
            {
              id: 'faq-1',
              question: 'How fast will my server or bot deploy after checkout?',
              answer: 'Deployments are fully automated. As soon as your order is confirmed, our orchestrator allocates dedicated RAM and NVMe storage, initializes your isolated Docker container, and boots your instance in under 30 seconds.'
            },
            {
              id: 'faq-2',
              question: 'What hardware powers AetherPanel nodes?',
              answer: 'We exclusively deploy enterprise AMD Ryzen 9 7950X and 9950X processors boosting up to 5.7GHz, coupled with PCIe Gen4 enterprise NVMe arrays and ECC DDR5 5600MHz memory to prevent TPS lag and chunk hitches.'
            },
            {
              id: 'faq-3',
              question: 'Is DDoS mitigation included with every plan?',
              answer: 'Yes. Every instance is protected by always-on 3.2+ Tbps automated BGP Anycast hardware scrubbing that drops volumetric layer 3, 4, and 7 attacks without disconnecting active players or increasing packet ping.'
            },
            {
              id: 'faq-4',
              question: 'Can I migrate my existing Minecraft worlds or bot scripts?',
              answer: 'Absolutely. Use our Web SFTP manager, fast browser drag-and-drop uploader, or 1-click ZIP extractor to import existing server worlds, plugins, configuration files, and Node.js, Python, or Go scripts immediately.'
            },
            {
              id: 'faq-5',
              question: 'Can I upgrade or scale resources without losing data?',
              answer: 'Yes. Upgrading CPU cores, RAM, and NVMe disk space is seamless and instantaneous. Your databases, worlds, and configurations remain completely intact during resource reallocation.'
            }
          ];
          setFaqs(defaultFaqs);
          setOpenFaqId(defaultFaqs[0].id);
        }
      } catch (err) {
        console.error('Failed to load FAQs:', err);
      }
    };
    loadFaqs();
  }, []);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const res = await apiRequest('/public/plans');
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setPlans(res.data);
        }
      } catch (err: any) {
        console.error('Failed to load plans on home:', err.message || err);
      }
    };
    loadPlans();
  }, []);

  const mcPlans = plans.filter(p => p.productId === 'prod_minecraft' || p.id.startsWith('plan_mc_'));
  const botPlans = plans.filter(p => p.productId === 'prod_bot' || p.id.startsWith('plan_bot_'));

  const minMcPrice = mcPlans.length > 0
    ? Math.min(...mcPlans.map(p => p.priceMonthly))
    : 1.49;

  const minBotPrice = botPlans.length > 0
    ? Math.min(...botPlans.map(p => p.priceMonthly))
    : 0.99;

  const displayPlans = activeCategory === 'minecraft'
    ? (mcPlans.length > 0 ? mcPlans.slice(0, 4) : [
        { id: 'mc-basic', name: 'Starter Node', priceMonthly: 2.99, ramMB: 2048, cpuCores: 1, diskGB: 15, isPopular: false, backupLimit: 2, databaseLimit: 1 },
        { id: 'mc-pro', name: 'Performance Node', priceMonthly: 7.99, ramMB: 6144, cpuCores: 2, diskGB: 35, isPopular: true, backupLimit: 5, databaseLimit: 2 },
        { id: 'mc-ultra', name: 'Extreme Node', priceMonthly: 14.99, ramMB: 12288, cpuCores: 4, diskGB: 75, isPopular: false, backupLimit: 10, databaseLimit: 3 },
        { id: 'mc-enterprise', name: 'Network Node', priceMonthly: 24.99, ramMB: 20480, cpuCores: 6, diskGB: 150, isPopular: false, backupLimit: 15, databaseLimit: 5 }
      ])
    : (botPlans.length > 0 ? botPlans.slice(0, 4) : [
        { id: 'bot-micro', name: 'Micro Bot', priceMonthly: 0.99, ramMB: 512, cpuCores: 1, diskGB: 5, isPopular: false, backupLimit: 1, databaseLimit: 1 },
        { id: 'bot-standard', name: 'Community Bot', priceMonthly: 2.49, ramMB: 1536, cpuCores: 1, diskGB: 15, isPopular: true, backupLimit: 3, databaseLimit: 2 },
        { id: 'bot-cluster', name: 'Sharded Cluster', priceMonthly: 5.99, ramMB: 4096, cpuCores: 2, diskGB: 30, isPopular: false, backupLimit: 5, databaseLimit: 3 },
        { id: 'bot-enterprise', name: 'High-Throughput', priceMonthly: 11.99, ramMB: 8192, cpuCores: 4, diskGB: 60, isPopular: false, backupLimit: 8, databaseLimit: 5 }
      ]);

  const copyIpToClipboard = () => {
    navigator.clipboard.writeText('play.aethercloud.net:25565');
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  return (
    <div className="relative overflow-x-hidden selection:bg-amber-500 selection:text-black bg-[#060608]">

      {/* ─────────────────────────────────────────────────────────────────────────────
          SUBTLE ARCHITECTURAL AMBIENT LIGHTING
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 select-none">
        {/* Soft amber radial glow behind hero */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[840px] h-[520px] rounded-full opacity-20 blur-[150px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.4) 0%, rgba(217, 119, 6, 0.15) 45%, transparent 70%)'
          }}
        />
        {/* Subtle grid pattern */}
        <div
          className="absolute top-0 inset-x-0 h-[750px] opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M0 32h32V0' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
            maskImage: 'radial-gradient(ellipse 60% 50% at 50% 20%, black 30%, transparent 80%)'
          }}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          1. BALANCED, CINEMATIC HERO (CLEAN, RESTRAINED, NO GIANT DULL DEAD SPACE)
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-14 sm:pb-16 max-w-[1200px] mx-auto text-center flex flex-col items-center">
        
        {/* Announcement Badge */}
        {homepageConfig.showHeroBadge !== false && (
          <div className="mb-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-amber-500/25 shadow-[0_0_20px_rgba(245,158,11,0.08)] backdrop-blur-md transition-colors hover:border-amber-500/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[11px] text-zinc-300 font-medium tracking-wide">
                {homepageConfig.heroBadgeText || `POWERED BY ${brandName?.toUpperCase() || 'AETHERPANEL'} CLOUD`}
              </span>
              <span className="text-zinc-600">·</span>
              <button
                type="button"
                onClick={() => onNavigate(homepageConfig.heroBadgeLinkTarget || 'status')}
                className="text-amber-400 font-semibold text-[11px] hover:text-amber-300 transition-colors cursor-pointer"
              >
                {homepageConfig.heroBadgeLinkText || 'Hardware Status →'}
              </button>
            </div>
          </div>
        )}

        {/* Hero Headline: 48–60px Desktop, 2 Lines Max, Clean Typography */}
        <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold text-white tracking-tight leading-[1.08] max-w-[780px] mx-auto">
          {homepageConfig.heroHeadlinePrefix !== undefined && homepageConfig.heroHeadlinePrefix !== ''
            ? homepageConfig.heroHeadlinePrefix
            : 'Powerful infrastructure for'}{' '}
          <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
            {homepageConfig.heroHeadlineAccent !== undefined && homepageConfig.heroHeadlineAccent !== ''
              ? homepageConfig.heroHeadlineAccent
              : 'your next server.'}
          </span>
        </h1>

        {/* Compact Description (25–35 words) */}
        <p className="text-[15px] sm:text-base text-zinc-400 font-normal leading-[1.6] max-w-[620px] mx-auto mt-5 mb-8">
          {homepageConfig.heroDescription || heroDescription || 'Deploy high-performance Minecraft servers and 24/7 background bots with sub-millisecond network routing, automated backups, and 99.9% verified uptime.'}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onNavigate(homepageConfig.heroPrimaryCtaPage || 'register')}
            className="w-full sm:w-auto h-12 px-7 rounded-xl font-bold text-sm text-zinc-950 bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.25)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <span>{homepageConfig.heroPrimaryCtaText || 'Get Started'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              const target = homepageConfig.heroSecondaryCtaPage || 'hosting';
              if (target === 'hosting') {
                const el = document.getElementById('hosting');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else onNavigate('pricing');
              } else {
                onNavigate(target);
              }
            }}
            className="w-full sm:w-auto h-12 px-7 rounded-xl font-medium text-sm text-zinc-300 bg-zinc-900/80 hover:bg-zinc-800 hover:text-white border border-white/[0.08] hover:border-white/[0.16] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{homepageConfig.heroSecondaryCtaText || 'Explore Hosting'}</span>
          </button>
        </div>

        {/* Hero Trust Row */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-zinc-400 font-normal">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-amber-400" />
            {homepageConfig.heroBullet1 || 'Instant activation'}
          </span>
          <span className="text-zinc-700 hidden sm:inline">·</span>
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-amber-400" />
            {homepageConfig.heroBullet2 || 'No setup fees'}
          </span>
          <span className="text-zinc-700 hidden sm:inline">·</span>
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-amber-400" />
            {homepageConfig.heroBullet3 || 'Cancel anytime'}
          </span>
        </div>

      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. SPECIFICATION & TRUST RIBBON (TIGHT 64px HEIGHT, CRISP HAIRLINE BORDERS)
      ───────────────────────────────────────────────────────────────────────────── */}
      {homepageConfig.showTrustBar !== false && (
        <section className="border-y border-white/[0.06] bg-zinc-950/60 backdrop-blur-sm my-6 sm:my-8">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[66px] flex items-center justify-between">
            <div className="w-full flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs sm:text-[13px] text-zinc-300 font-medium">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{homepageConfig.trustBarItem1 || '99.99% Uptime SLA'}</span>
              </div>
              <span className="hidden md:inline text-zinc-800 select-none">|</span>
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{homepageConfig.trustBarItem2 || 'PCIe Gen4 NVMe Storage'}</span>
              </div>
              <span className="hidden md:inline text-zinc-800 select-none">|</span>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{homepageConfig.trustBarItem3 || '3.2 Tbps DDoS Protection'}</span>
              </div>
              <span className="hidden md:inline text-zinc-800 select-none">|</span>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{homepageConfig.trustBarItem4 || '<30s Instant Provisioning'}</span>
              </div>
              <span className="hidden md:inline text-zinc-800 select-none">|</span>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{homepageConfig.trustBarItem5 || '24/7 Node Telemetry'}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. TARGETED RUNTIMES (MINECRAFT & DISCORD BOTS - SLEEK PRODUCT PANELS)
      ───────────────────────────────────────────────────────────────────────────── */}
      {(homepageConfig.showMinecraftSection !== false || homepageConfig.showDiscordBotSection !== false) && (
        <section id="hosting" className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          
          {/* Section Heading */}
          <div className="max-w-2xl mb-12 sm:mb-16">
            <span className="text-[12px] font-mono uppercase tracking-wider text-amber-400 font-semibold block mb-2">
              Targeted Runtimes
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              Optimized for demanding workloads.
            </h2>
            <p className="text-[15px] text-zinc-400 mt-2 font-normal leading-relaxed">
              Tailored bare-metal configurations and container runtimes engineered specifically for gaming servers and 24/7 background bots.
            </p>
          </div>

          {/* Feature 1: Minecraft (Visual LEFT ~520px, Content RIGHT) */}
          {homepageConfig.showMinecraftSection !== false && (
            <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center ${homepageConfig.showDiscordBotSection !== false ? 'mb-20 sm:mb-28' : ''}`}>
              
              {/* Left: High-End Minecraft Product Panel */}
              <div className="lg:col-span-6 rounded-2xl bg-zinc-950/90 border border-white/[0.08] p-5 sm:p-6 shadow-2xl shadow-black/80 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                {/* Top header row */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Gamepad2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Survival SMP (Paper 1.21.4)</h4>
                      <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ONLINE · 20.0 TPS · 32 Players
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/[0.06] text-[11px] font-mono font-medium text-amber-400">
                    5.7GHz Boost
                  </span>
                </div>

                {/* Live server address banner with 1-click copy */}
                <div className="my-4 p-3 rounded-xl bg-black/60 border border-white/[0.04] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[11px] text-zinc-500 font-mono">HOST:</span>
                    <span className="text-xs font-mono text-zinc-200 truncate">play.aethercloud.net:25565</span>
                  </div>
                  <button
                    type="button"
                    onClick={copyIpToClipboard}
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono text-amber-400 border border-amber-500/20 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedIp ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedIp ? 'Copied!' : 'Copy IP'}</span>
                  </button>
                </div>

                {/* Resource Allocation Bars */}
                <div className="space-y-3 py-2 text-xs font-mono">
                  {/* Memory */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400">DDR5 ECC RAM</span>
                      <span className="text-white font-medium">6.2 / 8.0 GB (77%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full w-[77%]" />
                    </div>
                  </div>

                  {/* CPU */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400">AMD Ryzen 9 7950X Compute</span>
                      <span className="text-white font-medium">21% sustained</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full w-[21%]" />
                    </div>
                  </div>

                  {/* NVMe */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400">Gen4 NVMe Array</span>
                      <span className="text-white font-medium">18.4 / 60 GB</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-700 rounded-full w-[30%]" />
                    </div>
                  </div>
                </div>

                {/* Quick Jar selectors */}
                <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>ACTIVE JAR: PaperMC 1.21.4</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Auto-Restart OK
                  </span>
                </div>
              </div>

              {/* Right: Content */}
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  <span>{homepageConfig.mcEyebrow || 'MINECRAFT SERVER HOSTING'}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {homepageConfig.mcHeading || 'Single-thread performance built for zero tick drops.'}
                </h3>

                <p className="text-[15px] text-zinc-400 leading-relaxed font-normal">
                  {homepageConfig.mcDescription || 'Minecraft runs its core game loop on a single CPU core. We utilize AMD Ryzen 9 7950X silicon with single-thread boosts up to 5.7GHz, combined with Gen4 NVMe arrays to eliminate world-save hitches and chunk generation lag.'}
                </p>

                <ul className="space-y-2.5 pt-1 text-sm text-zinc-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-amber-400 shrink-0" />
                    <span><strong className="text-white font-medium">Instant 1-Click Installs:</strong> {homepageConfig.mcBullet1 || 'Paper, Purpur, Fabric, Forge & Modpacks'}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-amber-400 shrink-0" />
                    <span><strong className="text-white font-medium">Web SFTP & Fast Unzip:</strong> {homepageConfig.mcBullet2 || 'Upload worlds and plugins directly in browser'}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-amber-400 shrink-0" />
                    <span><strong className="text-white font-medium">Automated S3 Backups:</strong> {homepageConfig.mcBullet3 || 'Schedule daily or weekly snapshots'}</span>
                  </li>
                </ul>

                <div className="pt-3 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onNavigate('minecraft')}
                    className="h-11 px-5 rounded-xl font-semibold text-xs sm:text-sm text-zinc-950 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center gap-2 cursor-pointer shadow-sm shadow-amber-500/10"
                  >
                    <span>{homepageConfig.mcCtaText || 'Explore Minecraft'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs font-mono text-zinc-400">
                    From <strong className="text-white font-semibold">${minMcPrice.toFixed(2)}/mo</strong>
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* Feature 2: Discord Bot (REVERSED: Content LEFT, Visual RIGHT) */}
          {homepageConfig.showDiscordBotSection !== false && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Left: Content */}
              <div className="lg:col-span-6 space-y-4 order-2 lg:order-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400">
                  <Bot className="h-3.5 w-3.5" />
                  <span>{homepageConfig.botEyebrow || 'DISCORD BOT HOSTING'}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {homepageConfig.botHeading || '24/7 background process supervision and multi-runtime support.'}
                </h3>

                <p className="text-[15px] text-zinc-400 leading-relaxed font-normal">
                  {homepageConfig.botDescription || 'Keep your bots online without unexpected downtime. Our runtime supervisor monitors process exit codes, injects environment variables securely, and automatically revives terminated workers within 1.2 seconds.'}
                </p>

                <ul className="space-y-2.5 pt-1 text-sm text-zinc-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-amber-400 shrink-0" />
                    <span><strong className="text-white font-medium">Multi-Runtime:</strong> {homepageConfig.botBullet1 || 'Node.js (18, 20, 22), Python (3.9 - 3.12), Bun & Go'}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-amber-400 shrink-0" />
                    <span><strong className="text-white font-medium">Secret Token Management:</strong> {homepageConfig.botBullet2 || 'Store bot tokens securely outside git history'}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-amber-400 shrink-0" />
                    <span><strong className="text-white font-medium">Low-Latency Gateways:</strong> {homepageConfig.botBullet3 || 'Direct routes to Discord edge infrastructure'}</span>
                  </li>
                </ul>

                <div className="pt-3 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onNavigate('bot')}
                    className="h-11 px-5 rounded-xl font-semibold text-xs sm:text-sm text-zinc-950 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center gap-2 cursor-pointer shadow-sm shadow-amber-500/10"
                  >
                    <span>{homepageConfig.botCtaText || 'Explore Discord Bots'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs font-mono text-zinc-400">
                    From <strong className="text-white font-semibold">${minBotPrice.toFixed(2)}/mo</strong>
                  </span>
                </div>
              </div>

              {/* Right: High-End Discord Bot Product Panel */}
              <div className="lg:col-span-6 rounded-2xl bg-zinc-950/90 border border-white/[0.08] p-5 sm:p-6 shadow-2xl shadow-black/80 order-1 lg:order-2 relative overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Community Moderator Bot</h4>
                      <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active · 12ms WebSocket ping · 42 Guilds
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/[0.06] text-[11px] font-mono text-zinc-300">
                    Node.js 22 LTS
                  </span>
                </div>

                {/* Simulated Bot Console Stdout */}
                <div className="my-4 rounded-xl bg-black/70 border border-white/[0.04] p-3.5 text-[11px] font-mono text-zinc-400 space-y-1.5 select-none">
                  <p className="text-zinc-500">&gt; node index.js</p>
                  <p className="text-zinc-300">[BOT] Authenticating with Discord Gateway...</p>
                  <p className="text-emerald-400/90">[READY] Logged in as ModGuard#9102 (PID: 2841)</p>
                  <p className="text-zinc-400">[HEARTBEAT] Shard 0 acknowledgement received (12ms)</p>
                  <p className="text-amber-400/90">[SUPERVISOR] Auto-restart watchdog enabled</p>
                </div>

                {/* Metrics Bar */}
                <div className="grid grid-cols-3 gap-3 text-center font-mono">
                  <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/[0.04]">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider">RAM Footprint</p>
                    <p className="text-xs font-semibold text-white mt-0.5">128 MB</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/[0.04]">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Verified SLA</p>
                    <p className="text-xs font-semibold text-white mt-0.5">99.98%</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/[0.04]">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Revive Time</p>
                    <p className="text-xs font-semibold text-amber-400 mt-0.5">&lt; 1.2s</p>
                  </div>
                </div>
              </div>

            </div>
          )}

        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. BARE-METAL INFRASTRUCTURE (SPLIT: LEFT NARRATIVE, RIGHT EDGE TELEMETRY)
      ───────────────────────────────────────────────────────────────────────────── */}
      {homepageConfig.showInfrastructureSection !== false && (
        <section id="infrastructure" className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-white/[0.06]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* LEFT: Heading, narrative, specs */}
            <div className="lg:col-span-6 space-y-5">
              <span className="text-[12px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                {homepageConfig.infraEyebrow || 'Bare-Metal Hardware'}
              </span>

              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                {homepageConfig.infraHeading || 'Engineered for pure single-core speed.'}
              </h2>

              <p className="text-[15px] text-zinc-400 leading-relaxed font-normal">
                {homepageConfig.infraDescription || 'We never oversell CPU cores or place workloads behind congested shared hypervisors. Every instance is backed by enterprise AMD Ryzen hardware with direct bare-metal access.'}
              </p>

              <div className="space-y-3.5 pt-1 text-sm text-zinc-300">
                <div className="flex items-start gap-3">
                  <Cpu className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">AMD Ryzen 9 7950X / 9950X:</strong>
                    <p className="text-xs text-zinc-400 mt-0.5">Sustained 5.7GHz boost clocks for latency-critical game loops.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <HardDrive className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">Enterprise PCIe 4.0 NVMe Arrays:</strong>
                    <p className="text-xs text-zinc-400 mt-0.5">7,000 MB/s read/write speeds for instantaneous chunk loading and world saves.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">3.2 Tbps Always-On DDoS Scrubbing:</strong>
                    <p className="text-xs text-zinc-400 mt-0.5">Hardware BGP filters drop layer 3/4 volumetric attacks without player disconnects.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Globe2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">Global Tier-1 Routing:</strong>
                    <p className="text-xs text-zinc-400 mt-0.5">Strategically placed compute nodes across North America, Europe, and Asia-Pacific.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Edge Telemetry Card */}
            <div className="lg:col-span-6 rounded-2xl bg-zinc-950/90 border border-white/[0.08] p-5 sm:p-6 shadow-2xl shadow-black/80 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  GLOBAL EDGE TELEMETRY
                </span>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ALL NODES OPERATIONAL
                </span>
              </div>

              {/* Node 1: US East */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">US-East (Ashburn, VA)</span>
                  <span className="font-mono text-amber-400 font-medium">3.8 ms avg</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                  <span>Ryzen 9 7950X · 128GB DDR5 ECC</span>
                  <span className="text-emerald-400">0% loss</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-[24%]" />
                </div>
              </div>

              {/* Node 2: EU Central */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">EU-Central (Frankfurt, DE)</span>
                  <span className="font-mono text-amber-400 font-medium">7.2 ms avg</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                  <span>Ryzen 9 9950X · 192GB DDR5 ECC</span>
                  <span className="text-emerald-400">0% loss</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-[31%]" />
                </div>
              </div>

              {/* Node 3: AP East */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">AP-East (Singapore)</span>
                  <span className="font-mono text-amber-400 font-medium">11.8 ms avg</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                  <span>Ryzen 9 7950X · 128GB DDR5 ECC</span>
                  <span className="text-emerald-400">0% loss</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-[19%]" />
                </div>
              </div>

              <div className="pt-1 text-right">
                <button
                  type="button"
                  onClick={() => onNavigate('status')}
                  className="text-xs font-mono text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Infrastructure Telemetry</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. STATISTICS ROW (RESTRAINED, CRISP NUMBERS, NO GIANT BOXES)
      ───────────────────────────────────────────────────────────────────────────── */}
      {homepageConfig.showStatsSection !== false && (
        <section className="border-y border-white/[0.06] bg-zinc-950/60 py-12 sm:py-14 my-6 sm:my-8">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
              
              {/* Stat 1 */}
              <div>
                <p className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-white tracking-tight leading-none">
                  {homepageConfig.stat1Value || '99.99%' }
                </p>
                <p className="text-xs uppercase tracking-wider text-zinc-400 font-mono font-medium mt-2.5">
                  {homepageConfig.stat1Label || 'Uptime SLA'}
                </p>
              </div>

              {/* Stat 2 */}
              <div>
                <p className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-white tracking-tight leading-none">
                  {homepageConfig.stat2Value || '32+'}
                </p>
                <p className="text-xs uppercase tracking-wider text-zinc-400 font-mono font-medium mt-2.5">
                  {homepageConfig.stat2Label || 'Global PoPs'}
                </p>
              </div>

              {/* Stat 3 */}
              <div>
                <p className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-white tracking-tight leading-none">
                  {homepageConfig.stat3Value || '24/7'}
                </p>
                <p className="text-xs uppercase tracking-wider text-zinc-400 font-mono font-medium mt-2.5">
                  {homepageConfig.stat3Label || 'Monitoring'}
                </p>
              </div>

              {/* Stat 4 */}
              <div>
                <p className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-white tracking-tight leading-none">
                  {homepageConfig.stat4Value || '<30s'}
                </p>
                <p className="text-xs uppercase tracking-wider text-zinc-400 font-mono font-medium mt-2.5">
                  {homepageConfig.stat4Label || 'Deployment'}
                </p>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. PLATFORM CAPABILITIES (1 DOMINANT + 4 COMPACT SUPPORTING CARDS)
      ───────────────────────────────────────────────────────────────────────────── */}
      {homepageConfig.showFeaturesSection !== false && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          
          {/* Section Heading */}
          <div className="max-w-2xl mb-12 sm:mb-14">
            <span className="text-[12px] font-mono uppercase tracking-wider text-amber-400 font-semibold block mb-2">
              Platform Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              Everything you need. Nothing you don't.
            </h2>
            <p className="text-[15px] text-zinc-400 mt-2 font-normal">
              A comprehensive suite of management tools designed to keep your servers organized, secure, and always accessible.
            </p>
          </div>

          {/* Asymmetric Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            
            {/* Dominant Feature: Real-Time Interactive Console (7 cols) */}
            <div className="md:col-span-7 rounded-2xl bg-zinc-950/90 border border-white/[0.08] p-5 sm:p-6 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Full Duplex Real-Time Console</h3>
                    <p className="text-xs text-zinc-400">WebSocket terminal streaming with instant command execution</p>
                  </div>
                </div>

                {/* Console preview snippet */}
                <div className="rounded-xl bg-black/75 border border-white/[0.05] p-3.5 text-[11px] font-mono text-zinc-400 space-y-1.5 mb-4 select-none">
                  <p className="text-zinc-500">&gt; server.broadcast("Daily automatic backup complete")</p>
                  <p className="text-emerald-400/90">[ANNOUNCE] Broadcast dispatched to 32 connected clients</p>
                  <p className="text-zinc-400">[DAEMON] Snapshot backup synced to offsite S3 in 4.12s</p>
                  <p className="text-amber-400/90">[STATUS] Memory: 3.8GB/8.0GB · 20.0 TPS stable</p>
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Low-Latency WebSocket Session</span>
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected (11ms)
                </span>
              </div>
            </div>

            {/* 4 Supporting Features (5 cols) */}
            <div className="md:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Feature 1: File Manager */}
              <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/[0.06] flex flex-col justify-between hover:border-white/[0.12] transition-colors">
                <div className="space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <FolderTree className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">Web SFTP Manager</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    In-browser code editor, drag-and-drop file uploader, and 1-click archive extraction.
                  </p>
                </div>
              </div>

              {/* Feature 2: Automated Backups */}
              <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/[0.06] flex flex-col justify-between hover:border-white/[0.12] transition-colors">
                <div className="space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <History className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">Automated Backups</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Scheduled snapshots replicated offsite with 1-click restore functionality.
                  </p>
                </div>
              </div>

              {/* Feature 3: Cron Schedules */}
              <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/[0.06] flex flex-col justify-between hover:border-white/[0.12] transition-colors">
                <div className="space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">Task Schedules</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Automate restarts, broadcasts, and maintenance commands with standard cron syntax.
                  </p>
                </div>
              </div>

              {/* Feature 4: Managed Databases */}
              <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/[0.06] flex flex-col justify-between hover:border-white/[0.12] transition-colors">
                <div className="space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Database className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">Instant Databases</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Free isolated MySQL databases provisioned automatically for plugins and bot storage.
                  </p>
                </div>
              </div>

            </div>

          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. PRICING (MEDIUM-SIZED BALANCED CARDS, CLEAN CATEGORY TOGGLE)
      ───────────────────────────────────────────────────────────────────────────── */}
      {homepageConfig.showPricingSection !== false && (
        <section id="pricing" className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-white/[0.06]">
          
          {/* Section Heading & Category Switcher */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 sm:mb-14">
            <div>
              <span className="text-[12px] font-mono uppercase tracking-wider text-amber-400 font-semibold block mb-2">
                Predictable Pricing
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                Simple, transparent plans.
              </h2>
              <p className="text-[15px] text-zinc-400 mt-2 font-normal">
                No hidden fees, no resource overselling. Cancel or upgrade your plan anytime.
              </p>
            </div>

            {/* Category Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-zinc-900 border border-white/[0.08] text-xs font-medium self-start md:self-auto">
              <button
                type="button"
                onClick={() => setActiveCategory('minecraft')}
                className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${activeCategory === 'minecraft' ? 'bg-amber-400 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                Minecraft Hosting
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('bot')}
                className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${activeCategory === 'bot' ? 'bg-amber-400 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                Discord Bot Hosting
              </button>
            </div>
          </div>

          {/* Pricing Cards Grid (4 Column, Medium Height) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {displayPlans.map((plan) => {
              const isFeatured = plan.isPopular;
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 ${
                    isFeatured
                      ? 'bg-zinc-950 border border-amber-500/50 shadow-xl shadow-amber-500/5 relative'
                      : 'bg-zinc-950/80 border border-white/[0.06] hover:border-white/[0.14]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-base font-bold text-white">{plan.name}</h4>
                      {isFeatured && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400 text-zinc-950">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mb-5">
                      {activeCategory === 'minecraft' ? 'Dedicated game node' : '24/7 background worker'}
                    </p>

                    <div className="flex items-baseline gap-1 mb-5">
                      <span className="text-3xl sm:text-4xl font-extrabold text-white font-sans">${plan.priceMonthly.toFixed(2)}</span>
                      <span className="text-xs text-zinc-400 font-mono">/mo</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate('register')}
                      className={`w-full h-10 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        isFeatured
                          ? 'bg-amber-400 text-zinc-950 hover:bg-amber-300 font-bold'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/[0.08]'
                      }`}
                    >
                      <span>Deploy Now</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>

                    <div className="h-px bg-white/[0.06] my-5" />

                    {/* Feature List */}
                    <ul className="space-y-2.5 text-xs text-zinc-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span><strong>{(plan.ramMB / 1024).toFixed(plan.ramMB % 1024 === 0 ? 0 : 1)} GB</strong> DDR5 RAM</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span><strong>{plan.cpuCores} vCPU</strong> (5.7GHz Boost)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span><strong>{plan.diskGB} GB</strong> Gen4 NVMe</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span><strong>{plan.backupLimit || 2}</strong> Automated Backups</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span><strong>{plan.databaseLimit || 1}</strong> Free MySQL DB</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 pt-3 border-t border-white/[0.04] text-[11px] font-mono text-zinc-500 text-center">
                    3.2 Tbps DDoS Filter Included
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          8. FAQ (CLEAN ACCORDION, HAIRLINE DIVIDERS, EDITORIAL 2-COLUMN)
      ───────────────────────────────────────────────────────────────────────────── */}
      {homepageConfig.showFaqSection !== false && (
        <section id="faq" className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-white/[0.06]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* Left Column: Heading */}
            <div className="lg:col-span-5 space-y-3">
              <span className="text-[12px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                Frequently Asked Questions
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                Questions & answers.
              </h2>
              <p className="text-[15px] text-zinc-400 font-normal leading-relaxed">
                Everything you need to know about AetherPanel deployment speeds, node hardware, and data migration.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('support')}
                  className="text-xs font-mono text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Need help? Open a support ticket</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Right Column: Clean Accordion */}
            <div className="lg:col-span-7 divide-y divide-white/[0.06]">
              {faqs.map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div key={faq.id} className="py-4">
                    <button
                      type="button"
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      className="w-full flex items-center justify-between text-left text-sm sm:text-[15px] font-semibold text-white hover:text-amber-400 transition-colors cursor-pointer gap-4 py-1"
                    >
                      <span>{faq.question}</span>
                      <ChevronDown
                        className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-400' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="mt-2.5 text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal pr-6">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          9. CLOSING CALL TO ACTION (COMPACT BRAND MOMENT, INNER GLOW)
      ───────────────────────────────────────────────────────────────────────────── */}
      {homepageConfig.showCtaSection !== false && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-white/[0.06]">
          <div className="rounded-3xl bg-zinc-950 border border-white/[0.08] p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl">
            
            {/* Subtle soft ambient glow behind CTA box */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative max-w-xl mx-auto space-y-4">
              <span className="text-[12px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                {homepageConfig.ctaEyebrow || 'Ready To Deploy?'}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                {homepageConfig.ctaHeading || 'Start building on modern infrastructure today.'}
              </h2>
              <p className="text-[15px] text-zinc-400 leading-relaxed font-normal">
                {homepageConfig.ctaDescription || 'Get your Minecraft server or Discord bot up and running in under 30 seconds with 24/7 reliability.'}
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate(homepageConfig.ctaPrimaryPage || 'register')}
                  className="w-full sm:w-auto h-12 px-7 rounded-xl font-bold text-xs sm:text-sm text-zinc-950 bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-[0.98]"
                >
                  <span>{homepageConfig.ctaPrimaryText || 'Get Started Now'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate(homepageConfig.ctaSecondaryPage || 'pricing')}
                  className="w-full sm:w-auto h-12 px-7 rounded-xl font-medium text-xs sm:text-sm text-zinc-300 bg-zinc-900 hover:bg-zinc-850 hover:text-white border border-white/[0.08] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{homepageConfig.ctaSecondaryText || 'View All Plans'}</span>
                </button>
              </div>
            </div>

          </div>
        </section>
      )}

    </div>
  );
};
