import React, { useState, useEffect } from 'react';
import { Gamepad2, Bot, Check, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';
import { Plan } from '../../types';

interface PricingProps {
  onNavigate: (page: string, params?: any) => void;
}

export const Pricing: React.FC<PricingProps> = ({ onNavigate }) => {
  const { accentClasses } = useTheme();
  const [activeCategory, setActiveCategory] = useState<'minecraft' | 'bot'>('minecraft');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/public/plans')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setPlans(data.data);
        }
      })
      .catch(err => console.error('Failed to load plans:', err))
      .finally(() => setLoading(false));
  }, []);

  const activePlans = plans.filter(p => {
    if (activeCategory === 'minecraft') {
      return p.productId === 'prod_minecraft' || p.id.startsWith('plan_mc_');
    }
    return p.productId === 'prod_bot' || p.id.startsWith('plan_bot_');
  });

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
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
        </div>
      ) : activePlans.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          No active plans available for this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {activePlans.map((p) => {
            const price = billingCycle === 'yearly' ? (p.priceYearly / 12).toFixed(2) : p.priceMonthly.toFixed(2);
            return (
              <div
                key={p.id}
                className={`rounded-3xl p-6 bg-zinc-900/80 border flex flex-col justify-between relative transition-all ${
                  p.isPopular ? 'border-violet-500 shadow-xl shadow-violet-500/10 bg-zinc-900' : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {p.isPopular && (
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
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span>{p.ramMB >= 1024 ? `${p.ramMB / 1024}GB RAM` : `${p.ramMB}MB RAM`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span>{p.cpuCores} vCPU Core{p.cpuCores > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span>{p.diskGB}GB NVMe Storage</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span>{p.backupLimit} Backup Slot{p.backupLimit > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span>{p.databaseLimit} Database Instance{p.databaseLimit > 1 ? 's' : ''}</span>
                    </div>
                    {p.features && p.features.slice(0, 2).map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('deploy', { planId: p.id, productCategory: activeCategory })}
                  className={`w-full mt-6 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                    p.isPopular
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
      )}
    </div>
  );
};
