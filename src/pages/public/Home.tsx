import React, { useState, useEffect } from 'react';
import {
  Gamepad2, Bot, Cpu, Zap, ShieldCheck, HardDrive, Terminal,
  Globe2, ArrowRight, CheckCircle2, Sparkles, Server, Clock, Users, Flame
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../../lib/ThemeContext';
import { useBranding } from '../../lib/BrandingContext';
import { apiRequest } from '../../lib/api';
import { Plan } from '../../types';

interface HomeProps {
  onNavigate: (page: string) => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const { accentClasses } = useTheme();
  const { pageAnimationsEnabled } = useBranding();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const res = await apiRequest('/public/plans');
        if (res.success && Array.isArray(res.data)) {
          setPlans(res.data);
        } else if (res.error) {
          console.error('Failed to load plans on home:', res.error.message);
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

  const animate = pageAnimationsEnabled && !prefersReducedMotion;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 120,
        damping: 18,
        mass: 0.8
      }
    }
  };

  const motionDivProps = animate ? {
    variants: containerVariants,
    initial: "hidden",
    animate: "visible"
  } : {};

  const motionChildProps = animate ? {
    variants: itemVariants
  } : {};

  return (
    <motion.div {...motionDivProps} className="space-y-24 py-8">
      {/* Hero Section */}
      <motion.section {...motionChildProps} className="relative overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center space-y-6 max-w-3xl mx-auto">
            
            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>AetherPanel Cloud Engine Release — Up to 35% Faster TPS</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white font-sans leading-[1.1]">
              Powerful Hosting.{' '}
              <span className={`bg-gradient-to-r ${accentClasses.gradient} bg-clip-text text-transparent`}>
                Without Complexity.
              </span>
            </h1>

            {/* Subhead */}
            <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Deploy high-performance Minecraft servers and 24/7 Discord bots in under 30 seconds. Powered by AMD Ryzen 9 7950X compute nodes, enterprise NVMe storage, and Pterodactyl-class control precision.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button
                onClick={() => onNavigate('pricing')}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-semibold text-white bg-gradient-to-r ${accentClasses.gradient} shadow-lg ${accentClasses.shadow} hover:opacity-95 transition-all flex items-center justify-center gap-2 text-sm`}
              >
                <span>View Plans & Pricing</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => onNavigate('status')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-semibold text-zinc-300 bg-zinc-900 border border-zinc-800 hover:text-white hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Globe2 className="h-4 w-4 text-emerald-400" />
                <span>Global Node Locations</span>
              </button>
            </div>

            {/* Trust Badges */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400 border-t border-zinc-900">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> 99.99% Uptime SLA</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Instant Auto-Provisioning</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Free Subdomain & DDoS Filter</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Automated File Backups</span>
            </div>

          </div>

          {/* Interactive Cloud Infrastructure Preview Card */}
          <div className="mt-14 max-w-5xl mx-auto rounded-3xl border border-zinc-800 bg-zinc-950/90 p-4 sm:p-6 shadow-2xl relative group">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-violet-600/20 to-cyan-500/20 blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
            
            <div className="relative rounded-2xl bg-zinc-900/90 border border-zinc-800 overflow-hidden">
              {/* Window Header */}
              <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block"></span>
                  <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block"></span>
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block"></span>
                  <span className="text-xs font-mono text-zinc-400 ml-2">node-us1.aetherpanel.com — Live Container Engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ● ONLINE (20.0 TPS)
                  </span>
                </div>
              </div>

              {/* Window Dashboard Preview Body */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="text-xs text-zinc-400 font-mono flex items-center justify-between">
                    <span>CPU LOAD</span>
                    <span className="text-violet-400 font-bold">14.2%</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full w-[14%]"></div>
                  </div>
                  <span className="text-[10px] text-zinc-400">AMD Ryzen 9 7950X (4 vCPU allocated)</span>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="text-xs text-zinc-400 font-mono flex items-center justify-between">
                    <span>RAM USAGE</span>
                    <span className="text-cyan-400 font-bold">3.4 GB / 8 GB</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full w-[42%]"></div>
                  </div>
                  <span className="text-[10px] text-zinc-400">DDR5 ECC 4800MHz Memory</span>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="text-xs text-zinc-400 font-mono flex items-center justify-between">
                    <span>DISK I/O</span>
                    <span className="text-emerald-400 font-bold">8.4 GB / 60 GB</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[14%]"></div>
                  </div>
                  <span className="text-[10px] text-zinc-400">PCIe 4.0 NVMe Enterprise SSD</span>
                </div>
              </div>

              {/* Terminal Logs Preview */}
              <div className="p-4 bg-black font-mono text-xs text-zinc-300 space-y-1 border-t border-zinc-800 max-h-36 overflow-hidden">
                <p className="text-emerald-400">[01:28:40 INFO]: Paper version 1.20.4-R0.1-SNAPSHOT (Java 21) initialized.</p>
                <p className="text-zinc-400">[01:28:41 INFO]: Loading 14 plugins (LuckPerms, EssentialsX, Vault, WorldEdit)...</p>
                <p className="text-cyan-400">[01:28:42 INFO]: Bound to server IP 104.22.14.88:25565 [DDoS Shield Active]</p>
                <p className="text-emerald-400">[01:28:43 SUCCESS]: Done (2.108s)! Server ready for player connections.</p>
              </div>

            </div>
          </div>
        </div>
      </motion.section>

      {/* Product Category Showcase */}
      <motion.section {...motionChildProps} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-sans">
            Choose Your Hosting Product
          </h2>
          <p className="text-sm text-zinc-400">
            Tailored hardware configurations and optimized container runtimes for gaming and bot services.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Minecraft Card */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 space-y-6 hover:border-violet-500/40 transition-all group">
            <div className="flex items-center justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 group-hover:scale-110 transition-transform">
                <Gamepad2 className="h-7 w-7" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Starts at ${minMcPrice.toFixed(2)}/mo
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Minecraft Hosting</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Full support for Paper, Purpur, Spigot, Forge, Fabric, and Velocity networks with instant modpack installation, custom subdomains, and 1-click Aikar's JVM flag tuning.
              </p>
            </div>

            <ul className="space-y-2.5 text-xs text-zinc-300">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-400" /> High Single-Core Ryzen 9 7950X (5.7GHz)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-400" /> Instant Version Switching (1.8 to 1.20+)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-400" /> Free MySQL/Postgres Database & Subdomain</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-400" /> Automated Schedule Tasks & Backups</li>
            </ul>

            <button
              onClick={() => onNavigate('minecraft')}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-zinc-800 text-white hover:bg-violet-600 transition-colors flex items-center justify-center gap-2"
            >
              <span>Explore Minecraft Plans</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Bot Hosting Card */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 space-y-6 hover:border-cyan-500/40 transition-all group">
            <div className="flex items-center justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform">
                <Bot className="h-7 w-7" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Starts at ${minBotPrice.toFixed(2)}/mo
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Discord Bot Hosting</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Persistent 24/7 background process manager for Discord, Telegram, and Twitch bots. Supporting Node.js (v18-v22), Python (3.9-3.12), Bun, and Go runtimes with auto-restart on crash.
              </p>
            </div>

            <ul className="space-y-2.5 text-xs text-zinc-300">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-400" /> 24/7 PM2-style Process Watchdog</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-400" /> Environment Variables & Secrets Manager</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-400" /> Web Console & Git Repository Deploy Support</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-400" /> Low Latency Connection to Discord Gateways</li>
            </ul>

            <button
              onClick={() => onNavigate('bot')}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-zinc-800 text-white hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2"
            >
              <span>Explore Discord Bot Plans</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

        </div>
      </motion.section>

      {/* Feature Highlights Grid */}
      <motion.section {...motionChildProps} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 border-t border-zinc-900 pt-16">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-sans">
            Engineered for Modern Game Infrastructure
          </h2>
          <p className="text-sm text-zinc-400">
            Built from the ground up to prevent downtime, reduce latency, and give you complete control over your server environment.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">AMD Ryzen 9 CPUs</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Equipped with Ryzen 9 7950X processors boosting up to 5.7GHz to deliver smooth 20.0 TPS even under heavy player loads.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">3.2 Tbps DDoS Shield</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Always-on hardware mitigation filters layer 3, 4, and 7 attacks so your game network stays online uninterrupted.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Gen4 NVMe Storage</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Enterprise PCIe 4.0 NVMe SSDs deliver 7,000 MB/s read speeds for instant chunk rendering and sub-second boot times.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Terminal className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Real-Time Web Console</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Stream live server logs, send commands directly, and inspect server metrics with zero delay over WebSocket connections.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Automated Schedules</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Schedule cron tasks for automatic daily restarts, world saves, backups, and custom in-game commands effortlessly.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Globe2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Multi-Region Locations</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Deploy your server close to your players across US East (Virginia), EU Central (Frankfurt), or Asia Pacific (Singapore).
            </p>
          </div>

        </div>
      </motion.section>

      {/* CTA Banner */}
      <motion.section {...motionChildProps} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-violet-900/40 via-zinc-900 to-cyan-900/40 border border-zinc-800 p-8 sm:p-12 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Ready to Launch Your Server?
          </h2>
          <p className="text-zinc-400 text-sm max-w-xl mx-auto">
            Join thousands of server owners and bot developers hosting on AetherPanel today. Free migration assistance available.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('register')}
              className={`px-8 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r ${accentClasses.gradient} shadow-lg hover:opacity-95 transition-all text-sm`}
            >
              Create Free Account
            </button>
            <button
              onClick={() => onNavigate('pricing')}
              className="px-8 py-3.5 rounded-xl font-semibold text-zinc-300 bg-zinc-900 border border-zinc-800 hover:text-white hover:bg-zinc-800 transition-all text-sm"
            >
              Browse All Plans
            </button>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};
