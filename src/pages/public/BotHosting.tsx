import React, { useState, useEffect } from 'react';
import { Bot, Check, ArrowRight } from 'lucide-react';
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

  return (
    <div className="space-y-12 py-8">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto space-y-3 px-4">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md surface-2 border border-[var(--color-line)] text-xs font-mono text-[var(--color-accent)]">
          <Bot className="h-3.5 w-3.5" />
          <span>Discord & App Containers</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-ink)] tracking-tight">
          24/7 Discord & App Hosting
        </h1>
        <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed max-w-xl mx-auto font-normal">
          Deploy Discord.js, Python, or Bun bots with low-latency gateway connections, process watchdogs, and encrypted environment variables.
        </p>

        {/* Toggle Billing */}
        <div className="pt-3 flex items-center justify-center gap-2.5">
          <span className={`text-xs ${billingCycle === 'monthly' ? 'text-[var(--color-ink)] font-semibold' : 'text-[var(--color-ink-mute)]'}`}>Monthly</span>
          <button
            type="button"
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="w-9 h-5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-line)] p-0.5 flex items-center cursor-pointer"
          >
            <div className={`h-3.5 w-3.5 rounded-full bg-[var(--color-accent)] transition-transform ${billingCycle === 'yearly' ? 'translate-x-4' : ''}`} />
          </button>
          <span className={`text-xs flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'text-[var(--color-ink)] font-semibold' : 'text-[var(--color-ink-mute)]'}`}>
            <span>Yearly</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded text-[var(--color-ok)] border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10 font-mono font-medium">
              17% OFF
            </span>
          </span>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--color-accent)] border-t-transparent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => {
              const price = billingCycle === 'yearly' ? (p.priceYearly / 12).toFixed(2) : p.priceMonthly.toFixed(2);
              const isFree = p.priceMonthly === 0;

              return (
                <div
                  key={p.id}
                  className={`rounded-lg p-5 surface border flex flex-col justify-between transition-colors hover:border-[var(--color-accent)]/50 ${
                    p.isPopular ? 'border-[var(--color-accent)] bg-[var(--color-surface-2)]' : 'border-[var(--color-line)]'
                  }`}
                >
                  <div className="space-y-3.5">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-[var(--color-ink)]">{p.name}</h3>
                        {isFree ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--color-ok)] border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10">
                            FREE
                          </span>
                        ) : p.isPopular ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--color-accent)] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10">
                            POPULAR
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--color-ink-dim)] mt-0.5 line-clamp-2">
                        {p.description || 'Node.js, Python & Bun bot container.'}
                      </p>
                      <div className="mt-2.5 flex items-baseline gap-1">
                        {isFree ? (
                          <span className="text-2xl font-bold text-[var(--color-ok)] font-sans">FREE</span>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-[var(--color-ink)] font-mono tabular-nums">${price}</span>
                            <span className="text-xs text-[var(--color-ink-mute)] font-mono">/mo</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Specs Box */}
                    <div className="p-3 rounded-md surface-2 border border-[var(--color-line)] space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="label">RAM</span>
                        <span className="text-[var(--color-ink)] font-medium">{p.ramMB >= 1024 ? `${p.ramMB / 1024} GB RAM` : `${p.ramMB} MB`}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="label">CPU</span>
                        <span className="text-[var(--color-ink)] font-medium">{p.cpuCores} vCPU Core{p.cpuCores > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="label">Disk</span>
                        <span className="text-[var(--color-ink)] font-medium">{p.diskGB} GB NVMe</span>
                      </div>
                    </div>

                    {/* Feature Checklist */}
                    <ul className="space-y-1.5 text-xs text-[var(--color-ink-dim)] pt-1 border-t border-[var(--color-line)]">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-[var(--color-ok)] shrink-0" />
                        <span>{p.backupLimit} Backup Slot{p.backupLimit > 1 ? 's' : ''}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-[var(--color-ok)] shrink-0" />
                        <span>{p.databaseLimit} MySQL Database{p.databaseLimit > 1 ? 's' : ''}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-[var(--color-ok)] shrink-0" />
                        <span>Node.js 22, Python 3.12, Bun</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-[var(--color-ok)] shrink-0" />
                        <span>24/7 Process Watchdog</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => onNavigate('deploy', { planId: p.id, productCategory: 'bot' })}
                      className="btn btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                    >
                      <span>Deploy {p.name}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
