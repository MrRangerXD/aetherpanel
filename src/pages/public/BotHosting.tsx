import React, { useState } from 'react';
import { Bot, CheckCircle2, Terminal, Cpu, Zap, ArrowRight } from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';

interface BotHostingProps {
  onNavigate: (page: string, params?: any) => void;
}

export const BotHosting: React.FC<BotHostingProps> = ({ onNavigate }) => {
  const { accentClasses } = useTheme();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      id: 'plan_bot_starter',
      name: 'Bot Starter',
      ram: '512MB RAM',
      cpu: '0.5 vCPU',
      storage: '5GB SSD Storage',
      monthly: 1.99,
      yearly: 19.99,
      features: ['Single Shard Discord Bot', 'Node.js & Python Runtimes', '1 Backup Slot', '24/7 PM2 Watchdog', 'Web Terminal Logs']
    },
    {
      id: 'plan_bot_pro',
      name: 'Bot Pro',
      isPopular: true,
      ram: '2GB RAM',
      cpu: '1.5 vCPU',
      storage: '15GB SSD Storage',
      monthly: 4.99,
      yearly: 49.99,
      features: ['Multi-Guild Discord / Telegram', 'Node.js, Python, Bun, Go', '3 Backup Slots', '2 MySQL/Postgres DBs', 'Auto-restart on Crash']
    }
  ];

  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto space-y-4 px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-400">
          <Bot className="h-4 w-4" />
          <span>24/7 Discord & Telegram Bot Process Hosting</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
          Keep Your Bots Online 24/7/365
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
          Forget home servers and PC restarts. Deploy Discord.js, Discord.py, or custom bot scripts with low-latency gateway connections, process watchdogs, and environment variable protection.
        </p>

        {/* Toggle Billing */}
        <div className="pt-6 flex items-center justify-center gap-3">
          <span className={`text-xs font-medium ${billingCycle === 'monthly' ? 'text-white font-bold' : 'text-zinc-500'}`}>Monthly Billing</span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="w-12 h-6 rounded-full bg-zinc-800 p-1 flex items-center transition-colors relative"
          >
            <div className={`h-4 w-4 rounded-full bg-cyan-500 transition-transform ${billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'}`} />
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
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {plans.map((p) => {
            const price = billingCycle === 'yearly' ? (p.yearly / 12).toFixed(2) : p.monthly.toFixed(2);
            return (
              <div
                key={p.id}
                className={`rounded-3xl p-8 bg-zinc-900/80 border flex flex-col justify-between relative transition-all ${
                  p.isPopular ? 'border-cyan-500 shadow-xl shadow-cyan-500/10 bg-zinc-900' : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {p.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-cyan-600 text-white uppercase tracking-wider shadow-md">
                    Most Popular
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{p.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-white">${price}</span>
                      <span className="text-xs text-zinc-400">/mo</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
                    <div className="text-cyan-400 font-semibold">{p.ram}</div>
                    <div className="text-zinc-300">{p.cpu}</div>
                    <div className="text-zinc-400">{p.storage}</div>
                  </div>

                  <ul className="space-y-2.5 text-xs text-zinc-300 pt-2 border-t border-zinc-800">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => onNavigate('deploy', { planId: p.id, productCategory: 'bot' })}
                  className="w-full mt-8 py-3.5 rounded-xl font-semibold text-xs bg-cyan-600 hover:bg-cyan-500 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  <span>Deploy {p.name}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
