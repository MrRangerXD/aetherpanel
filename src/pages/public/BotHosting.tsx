import React, { useState, useEffect } from 'react';
import {
  Bot, Check, ArrowRight, Shield, Zap, Terminal, HardDrive,
  Cpu, RefreshCw, Radio, Layers, Code, Play
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Plan } from '../../types';

interface BotHostingProps {
  onNavigate: (page: string, params?: any) => void;
}

export const BotHosting: React.FC<BotHostingProps> = ({ onNavigate }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const res = await apiRequest('/public/plans');
        if (res.success && Array.isArray(res.data)) {
          const botPlans = res.data.filter((p: Plan) => p.productId === 'prod_bot' || p.id.startsWith('plan_bot_'));
          setPlans(botPlans);
        }
      } catch (err) {
        console.error('Failed to load bot plans:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  const botFeatures = [
    {
      icon: Terminal,
      title: 'Multi-Language Runtimes',
      description: 'Native zero-configuration support for Node.js (v18, v20, v22), Python (3.10, 3.11, 3.12), and modern Bun.'
    },
    {
      icon: Zap,
      title: '24/7 PM2 Process Watchdog',
      description: 'Automatic crash recovery and memory threshold monitors. If your bot hits an unhandled rejection, it revives instantly.'
    },
    {
      icon: Radio,
      title: 'Ultra Low Gateway Latency',
      description: 'Direct peering to Discord Frankfurt & US-East voice and interaction gateway clusters (<5ms websocket ping).'
    },
    {
      icon: Shield,
      title: 'Encrypted Secret Storage',
      description: 'Store Discord Bot tokens, MongoDB URIs, and OpenAI API keys securely in hardware-encrypted environment vaults.'
    },
    {
      icon: HardDrive,
      title: 'Persistent JSON & SQLite DBs',
      description: 'Blazing fast Gen4 NVMe storage ideal for Quick.db, SQLite, LevelDB, or local caching without remote database delays.'
    },
    {
      icon: Code,
      title: 'Live Web Terminal & Git Sync',
      description: 'Stream realtime stdout/stderr logs, send interactive stdin commands, and auto-deploy upon git commit push.'
    }
  ];

  return (
    <div className="space-y-16 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* 1. HERO SECTION */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#14151b] border border-[#23252e] text-xs font-mono text-[#f97316] shadow-inner">
          <Bot className="h-3.5 w-3.5 text-[#f97316]" />
          <span>Discord & App Application Containers</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Reliable 24/7 <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#fb923c]">Bot Hosting</span> Cloud
        </h1>

        <p className="text-sm sm:text-base text-neutral-400 leading-relaxed max-w-2xl mx-auto font-normal">
          Deploy Discord.js, Pycord, discord.py, or Bun applications with 99.9% uptime, automated crash reboot watchdogs, and encrypted secrets.
        </p>

        {/* Toggle Billing Pill */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <span className={`text-xs font-medium transition-colors ${billingCycle === 'monthly' ? 'text-white font-bold' : 'text-neutral-400'}`}>
            Monthly Billing
          </span>

          <button
            type="button"
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="w-12 h-6 rounded-full bg-[#14151b] border border-[#23252e] p-0.5 flex items-center cursor-pointer transition-colors hover:border-[#f97316]/50"
          >
            <div className={`h-4.5 w-4.5 rounded-full bg-[#f97316] shadow-md transition-transform ${billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>

          <span className={`text-xs font-medium flex items-center gap-1.5 transition-colors ${billingCycle === 'yearly' ? 'text-white font-bold' : 'text-neutral-400'}`}>
            <span>Yearly Billing</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 font-mono font-bold">
              SAVE 17%
            </span>
          </span>
        </div>
      </div>

      {/* 2. PLANS GRID */}
      <div>
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#f97316] border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((p) => {
              const price = billingCycle === 'yearly' ? (p.priceYearly / 12).toFixed(2) : p.priceMonthly.toFixed(2);
              const isFree = p.priceMonthly === 0;

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl p-6 bg-[#14151b] border transition-all duration-200 flex flex-col justify-between relative shadow-xl hover:-translate-y-1 ${
                    p.isPopular
                      ? 'border-[#f97316] bg-gradient-to-b from-[#181924] to-[#14151b] shadow-orange-500/10'
                      : 'border-[#23252e] hover:border-[#f97316]/50'
                  }`}
                >
                  {p.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#f97316] text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                      Most Popular
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white tracking-tight">{p.name}</h3>
                        {isFree ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10">
                            FREE
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-neutral-400 bg-[#09090b] px-2 py-0.5 rounded-md border border-[#1f212b]">
                            {p.ramMB >= 1024 ? `${p.ramMB / 1024} GB` : `${p.ramMB} MB`}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed line-clamp-2">
                        {p.description || 'Node.js, Python & Bun bot environment.'}
                      </p>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        {isFree ? (
                          <span className="text-3xl font-extrabold text-emerald-400 font-mono">FREE</span>
                        ) : (
                          <>
                            <span className="text-3xl font-extrabold text-white font-mono tabular-nums">${price}</span>
                            <span className="text-xs text-neutral-400 font-mono">/month</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Specs Box */}
                    <div className="p-3.5 rounded-xl bg-[#09090b] border border-[#1f212b] space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <Cpu className="h-3 w-3 text-[#f97316]" />
                          <span>RAM</span>
                        </span>
                        <span className="text-white font-bold">{p.ramMB >= 1024 ? `${p.ramMB / 1024} GB RAM` : `${p.ramMB} MB`}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-[#f97316]" />
                          <span>CPU</span>
                        </span>
                        <span className="text-white font-bold">{p.cpuCores} vCPU Core{p.cpuCores > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <HardDrive className="h-3 w-3 text-[#f97316]" />
                          <span>Storage</span>
                        </span>
                        <span className="text-white font-bold">{p.diskGB} GB NVMe</span>
                      </div>
                    </div>

                    {/* Feature Checklist */}
                    <ul className="space-y-2 text-xs text-neutral-300 pt-2 border-t border-[#23252e]">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Node.js 22, Python 3.12, Bun 1.1</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>24/7 Automatic Reboot Watchdog</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Encrypted Environment Secrets (.env)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Real-time Interactive Web Console</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>{p.backupLimit} Automated S3 Snapshot{p.backupLimit > 1 ? 's' : ''}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={() => onNavigate('deploy', { planId: p.id, productCategory: 'bot' })}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                        p.isPopular
                          ? 'bg-[#f97316] hover:bg-[#ea580c] text-white shadow-orange-500/25'
                          : 'bg-[#181920] hover:bg-[#23252e] text-white border border-[#262834]'
                      }`}
                    >
                      <span>Deploy Bot Container</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. BOT FEATURES GRID */}
      <div className="pt-8 border-t border-[#23252e]">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Developer-First Bot Infrastructure
          </h2>
          <p className="text-xs text-neutral-400">
            Never worry about process killed errors, random restarts, or sluggish websocket replies again.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {botFeatures.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <div
                key={i}
                className="p-5 rounded-2xl bg-[#14151b] border border-[#23252e] space-y-2.5 hover:border-[#f97316]/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-[#09090b] border border-[#1f212b] flex items-center justify-center text-[#f97316]">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h4 className="text-sm font-bold text-white">{feat.title}</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
