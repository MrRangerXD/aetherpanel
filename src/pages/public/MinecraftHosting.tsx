import React, { useState } from 'react';
import { Gamepad2, CheckCircle2, Shield, Cpu, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';

interface MinecraftHostingProps {
  onNavigate: (page: string, params?: any) => void;
}

export const MinecraftHosting: React.FC<MinecraftHostingProps> = ({ onNavigate }) => {
  const { accentClasses } = useTheme();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      id: 'plan_mc_starter',
      name: 'Starter Tier',
      ram: '2GB DDR5 RAM',
      cpu: '1 vCPU Ryzen 9',
      storage: '15GB NVMe',
      monthly: 3.99,
      yearly: 39.99,
      features: ['Up to 10 Players', 'Paper / Spigot / Vanilla', '1 Backup Slot', 'Free Subdomain', '2.5Gbps Protection']
    },
    {
      id: 'plan_mc_basic',
      name: 'Basic Tier',
      ram: '4GB DDR5 RAM',
      cpu: '2 vCPU Ryzen 9',
      storage: '30GB NVMe',
      monthly: 7.99,
      yearly: 79.99,
      features: ['Up to 25 Players', 'Plugins Supported', '3 Backup Slots', '1 MySQL Database', 'Custom Port Included']
    },
    {
      id: 'plan_mc_pro',
      name: 'Pro Tier',
      isPopular: true,
      ram: '8GB DDR5 RAM',
      cpu: '4 vCPU Ryzen 9',
      storage: '60GB NVMe',
      monthly: 14.99,
      yearly: 149.99,
      features: ['Unlimited Players', 'Modpacks / Forge / Fabric', '5 Backup Slots', '3 MySQL Databases', 'Priority Support']
    },
    {
      id: 'plan_mc_ultra',
      name: 'Ultra Network',
      ram: '16GB DDR5 RAM',
      cpu: '8 vCPU Ryzen 9',
      storage: '120GB NVMe',
      monthly: 29.99,
      yearly: 299.99,
      features: ['Large Server Networks', 'Velocity / BungeeCord', '10 Backup Slots', '5 MySQL Databases', 'VIP Enterprise SLA']
    }
  ];

  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto space-y-4 px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-semibold text-violet-400">
          <Gamepad2 className="h-4 w-4" />
          <span>High-Performance Minecraft Hosting</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
          Uncompromised Minecraft Performance
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
          Powered by dedicated AMD Ryzen 9 7950X processors and Gen4 NVMe SSDs. Instant automated provisioning for Paper, Purpur, Spigot, Fabric, Forge, and Geyser Crossplay.
        </p>

        {/* Toggle Billing */}
        <div className="pt-6 flex items-center justify-center gap-3">
          <span className={`text-xs font-medium ${billingCycle === 'monthly' ? 'text-white font-bold' : 'text-zinc-500'}`}>Monthly Billing</span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="w-12 h-6 rounded-full bg-zinc-800 p-1 flex items-center transition-colors relative"
          >
            <div className={`h-4 w-4 rounded-full bg-violet-500 transition-transform ${billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          <span className={`text-xs font-medium flex items-center gap-1 ${billingCycle === 'yearly' ? 'text-white font-bold' : 'text-zinc-500'}`}>
            Yearly Billing
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Save 17%
            </span>
          </span>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => {
            const price = billingCycle === 'yearly' ? (p.yearly / 12).toFixed(2) : p.monthly.toFixed(2);
            return (
              <div
                key={p.id}
                className={`rounded-3xl p-6 bg-zinc-900/80 border flex flex-col justify-between relative transition-all ${
                  p.isPopular ? 'border-violet-500 shadow-xl shadow-violet-500/10 bg-zinc-900' : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {p.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white uppercase tracking-wider shadow-md">
                    Most Popular
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{p.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">${price}</span>
                      <span className="text-xs text-zinc-400">/mo</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
                    <div className="text-violet-400 font-semibold">{p.ram}</div>
                    <div className="text-zinc-300">{p.cpu}</div>
                    <div className="text-zinc-400">{p.storage}</div>
                  </div>

                  <ul className="space-y-2 text-xs text-zinc-300 pt-2 border-t border-zinc-800">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => onNavigate('deploy', { planId: p.id, productCategory: 'minecraft' })}
                  className={`w-full mt-6 py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
                    p.isPopular
                      ? `bg-gradient-to-r ${accentClasses.gradient} text-white shadow-md hover:opacity-95`
                      : 'bg-zinc-800 text-white hover:bg-zinc-700'
                  }`}
                >
                  <span>Deploy {p.name}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
