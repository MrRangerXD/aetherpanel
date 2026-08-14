import React, { useState } from 'react';
import { Gamepad2, Bot, Check, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';

interface PricingProps {
  onNavigate: (page: string, params?: any) => void;
}

export const Pricing: React.FC<PricingProps> = ({ onNavigate }) => {
  const { accentClasses } = useTheme();
  const [activeCategory, setActiveCategory] = useState<'minecraft' | 'bot'>('minecraft');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const minecraftPlans = [
    {
      id: 'plan_mc_starter',
      name: 'Starter Tier',
      priceMonthly: 3.99,
      priceYearly: 39.99,
      ramMB: '2GB DDR5',
      cpuCores: '1 Core Ryzen 9',
      diskGB: '15GB NVMe',
      backups: 2,
      databases: 1,
      popular: false
    },
    {
      id: 'plan_mc_basic',
      name: 'Basic Tier',
      priceMonthly: 7.99,
      priceYearly: 79.99,
      ramMB: '4GB DDR5',
      cpuCores: '2 Cores Ryzen 9',
      diskGB: '30GB NVMe',
      backups: 3,
      databases: 2,
      popular: false
    },
    {
      id: 'plan_mc_pro',
      name: 'Pro Tier',
      priceMonthly: 14.99,
      priceYearly: 149.99,
      ramMB: '8GB DDR5',
      cpuCores: '4 Cores Ryzen 9',
      diskGB: '60GB NVMe',
      backups: 5,
      databases: 3,
      popular: true
    },
    {
      id: 'plan_mc_ultra',
      name: 'Ultra Network',
      priceMonthly: 29.99,
      priceYearly: 299.99,
      ramMB: '16GB DDR5',
      cpuCores: '8 Cores Ryzen 9',
      diskGB: '120GB NVMe',
      backups: 10,
      databases: 5,
      popular: false
    }
  ];

  const botPlans = [
    {
      id: 'plan_bot_starter',
      name: 'Bot Starter',
      priceMonthly: 1.99,
      priceYearly: 19.99,
      ramMB: '512MB RAM',
      cpuCores: '0.5 Core',
      diskGB: '5GB SSD',
      backups: 1,
      databases: 1,
      popular: false
    },
    {
      id: 'plan_bot_pro',
      name: 'Bot Pro',
      priceMonthly: 4.99,
      priceYearly: 49.99,
      ramMB: '2GB RAM',
      cpuCores: '1.5 Cores',
      diskGB: '15GB SSD',
      backups: 3,
      databases: 2,
      popular: true
    }
  ];

  const activePlans = activeCategory === 'minecraft' ? minecraftPlans : botPlans;

  return (
    <div className="space-y-12 py-8 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Transparent, Scalable Pricing</h1>
        <p className="text-sm text-zinc-400">
          No hidden fees or bandwidth limits. Select your product and deploy your server instantly.
        </p>

        {/* Category Switcher */}
        <div className="pt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setActiveCategory('minecraft')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeCategory === 'minecraft' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="h-4 w-4" />
            <span>Minecraft Hosting</span>
          </button>
          <button
            onClick={() => setActiveCategory('bot')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeCategory === 'bot' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <Bot className="h-4 w-4" />
            <span>Discord Bot Hosting</span>
          </button>
        </div>

        {/* Billing Cycle Switcher */}
        <div className="pt-2 flex items-center justify-center gap-3">
          <span className={`text-xs ${billingCycle === 'monthly' ? 'text-white font-bold' : 'text-zinc-500'}`}>Monthly</span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="w-11 h-6 rounded-full bg-zinc-800 p-1 flex items-center relative"
          >
            <div className={`h-4 w-4 rounded-full bg-violet-500 transition-transform ${billingCycle === 'yearly' ? 'translate-x-5' : ''}`} />
          </button>
          <span className={`text-xs ${billingCycle === 'yearly' ? 'text-white font-bold' : 'text-zinc-500'}`}>
            Yearly (17% OFF)
          </span>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {activePlans.map((p) => {
          const price = billingCycle === 'yearly' ? (p.priceYearly / 12).toFixed(2) : p.priceMonthly.toFixed(2);
          return (
            <div
              key={p.id}
              className={`rounded-3xl p-6 bg-zinc-900/80 border flex flex-col justify-between relative transition-all ${
                p.popular ? 'border-violet-500 shadow-xl shadow-violet-500/10 bg-zinc-900' : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white uppercase tracking-wider">
                  Popular Choice
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">{p.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">${price}</span>
                  <span className="text-xs text-zinc-400">/mo</span>
                </div>

                <div className="space-y-2 text-xs pt-4 border-t border-zinc-800 text-zinc-300">
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {p.ramMB}</div>
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {p.cpuCores}</div>
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {p.diskGB}</div>
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {p.backups} Backup Slots</div>
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {p.databases} DB Instances</div>
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Free Subdomain & Port</div>
                </div>
              </div>

              <button
                onClick={() => onNavigate('deploy', { planId: p.id, productCategory: activeCategory })}
                className={`w-full mt-6 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                  p.popular
                    ? `bg-gradient-to-r ${accentClasses.gradient} text-white shadow-md hover:opacity-95`
                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                }`}
              >
                <span>Deploy Now</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
