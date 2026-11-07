import React, { useState, useEffect } from 'react';
import {
  Gamepad2, Check, ArrowRight, Shield, Zap, HardDrive, Cpu,
  RefreshCw, Globe, Server, Sparkles, Layers, Box
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Plan } from '../../types';

interface MinecraftHostingProps {
  onNavigate: (page: string, params?: any) => void;
}

export const MinecraftHosting: React.FC<MinecraftHostingProps> = ({ onNavigate }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const res = await apiRequest('/public/plans');
        if (res.success && Array.isArray(res.data)) {
          const mcPlans = res.data.filter((p: Plan) => p.productId === 'prod_minecraft' || p.id.startsWith('plan_mc_'));
          setPlans(mcPlans);
        }
      } catch (err) {
        console.error('Failed to load MC plans:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  const features = [
    {
      icon: Zap,
      title: 'Ryzen 9 7950X Compute',
      description: 'Single-thread clock speeds up to 5.7GHz, eliminating server tick lag even with large entities and mob farms.'
    },
    {
      icon: HardDrive,
      title: 'Gen4 NVMe Storage',
      description: 'Blazing 7,000+ MB/s read and write speeds. Instant world chunk loading and effortless dimension travel.'
    },
    {
      icon: Shield,
      title: '3.2+ Tbps Game DDoS Mitigation',
      description: 'Layer 4 and Layer 7 game filtering protects against TCP/UDP reflection, SYN floods, and botnet raids.'
    },
    {
      icon: Layers,
      title: '1-Click Version Switcher',
      description: 'Support for Paper, Purpur, Fabric, Forge, Spigot, and BungeeCord across Minecraft versions 1.8 to 1.21.4.'
    },
    {
      icon: Globe,
      title: 'Free Dedicated Port & Subdomain',
      description: 'Connect directly without remembering complicated ports. Easily map your custom domain or our free subdomain.'
    },
    {
      icon: RefreshCw,
      title: 'Automated S3 World Backups',
      description: 'Daily snapshots kept safe off-site. 1-click restore whenever a world corrupts or an update breaks plugins.'
    }
  ];

  return (
    <div className="space-y-16 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* 1. HERO SECTION */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#14151b] border border-[#23252e] text-xs font-mono text-[#f97316] shadow-inner">
          <Gamepad2 className="h-3.5 w-3.5 text-[#f97316]" />
          <span>High-Performance Minecraft Cloud</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Next-Gen <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#fb923c]">Minecraft Server</span> Hosting
        </h1>

        <p className="text-sm sm:text-base text-neutral-400 leading-relaxed max-w-2xl mx-auto font-normal">
          Powered by dedicated AMD Ryzen 9 7950X cores, DDR5 RAM, and enterprise NVMe storage. Instant setup for Paper, Purpur, Fabric, and Forge.
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                            FREE TIER
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-neutral-400 bg-[#09090b] px-2 py-0.5 rounded-md border border-[#1f212b]">
                            {p.ramMB >= 1024 ? `${p.ramMB / 1024} GB` : `${p.ramMB} MB`}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed line-clamp-2">
                        {p.description || 'AMD Ryzen 9 high-tickrate Minecraft instance.'}
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

                    {/* Hardware Specs Inset Card */}
                    <div className="p-3.5 rounded-xl bg-[#09090b] border border-[#1f212b] space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <Cpu className="h-3 w-3 text-[#f97316]" />
                          <span>Memory</span>
                        </span>
                        <span className="text-white font-bold">{p.ramMB >= 1024 ? `${p.ramMB / 1024} GB RAM` : `${p.ramMB} MB`}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-[#f97316]" />
                          <span>Processor</span>
                        </span>
                        <span className="text-white font-bold">{p.cpuCores} vCPU Core{p.cpuCores > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <HardDrive className="h-3 w-3 text-[#f97316]" />
                          <span>NVMe SSD</span>
                        </span>
                        <span className="text-white font-bold">{p.diskGB} GB Storage</span>
                      </div>
                    </div>

                    {/* Feature Checklist */}
                    <ul className="space-y-2 text-xs text-neutral-300 pt-2 border-t border-[#23252e]">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>{p.backupLimit} Automated S3 Backup{p.backupLimit > 1 ? 's' : ''}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>{p.databaseLimit} MySQL Database{p.databaseLimit > 1 ? 's' : ''}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Paper, Purpur, Fabric & Forge</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Free Dedicated Port & IP</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Full SFTP & Web File Access</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={() => onNavigate('deploy', { planId: p.id, productCategory: 'minecraft' })}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                        p.isPopular
                          ? 'bg-[#f97316] hover:bg-[#ea580c] text-white shadow-orange-500/25'
                          : 'bg-[#181920] hover:bg-[#23252e] text-white border border-[#262834]'
                      }`}
                    >
                      <span>Deploy Server</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. HARDWARE & FEATURE HIGHLIGHTS */}
      <div className="pt-8 border-t border-[#23252e]">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Engineered for 20 TPS Performance
          </h2>
          <p className="text-xs text-neutral-400">
            Every node is tuned specifically for Minecraft chunk generation, redstone ticks, and entity heavy gameplay.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feat, i) => {
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
