import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, Clock, RefreshCw, Zap, ShieldCheck,
  Server, ArrowRight, AlertCircle, Copy, Check, Sparkles, Activity
} from 'lucide-react';
import { CryptoInvoice } from '../../types';
import { apiRequest } from '../../lib/api';

interface RealtimeTransactionTrackerProps {
  invoice?: CryptoInvoice | null;
  onRefresh?: () => void;
  onSimulateStep?: (action?: 'detect' | 'confirm' | 'auto_complete') => void;
  isSimulating?: boolean;
}

export const RealtimeTransactionTracker: React.FC<RealtimeTransactionTrackerProps> = ({
  invoice,
  onRefresh,
  onSimulateStep,
  isSimulating = false
}) => {
  const [copiedTx, setCopiedTx] = useState(false);

  if (!invoice) {
    return (
      <div className="p-6 rounded-3xl bg-zinc-950/80 border border-amber-500/20 text-center space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Activity className="w-6 h-6 animate-pulse" />
        </div>
        <h4 className="text-sm font-bold text-white">No Active Transaction In-Flight</h4>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Start a new LTC / Crypto payment or submit a UPI UTR to watch real-time blockchain status updates and automated server activation in action.
        </p>
      </div>
    );
  }

  // Calculate current step (1 to 4) based on invoice status
  let currentStep = 1;
  if (invoice.status === 'detected') currentStep = 2;
  if (invoice.status === 'confirming') currentStep = 3;
  if (invoice.status === 'paid') currentStep = 4;
  if (invoice.status === 'expired') currentStep = 0;

  const steps = [
    {
      step: 1,
      title: 'Invoice Created',
      desc: `$${invoice.amountUsd.toFixed(2)} USD → ${invoice.cryptoAmount} ${invoice.cryptoCoin}`,
      detail: `Generated at ${new Date(invoice.createdAt).toLocaleTimeString()}`
    },
    {
      step: 2,
      title: 'Network Broadcast Detected',
      desc: invoice.txHash ? `TxID: ${invoice.txHash.slice(0, 10)}...` : 'Scanning Mempool & Nodes...',
      detail: 'Transaction seen on decentralized network'
    },
    {
      step: 3,
      title: 'Block Confirmations',
      desc: `Confirmations: ${invoice.confirmations} / ${invoice.requiredConfirmations}`,
      detail: invoice.confirmations >= 1 ? '1st Block Validated' : 'Waiting for miner inclusion'
    },
    {
      step: 4,
      title: 'Settled & Server Activated',
      desc: invoice.purpose === 'server_deploy' ? 'Server Instance Auto-Provisioned' : 'Wallet Balance Credited',
      detail: '256-Bit Ledger Verification Complete'
    }
  ];

  const handleCopyTx = () => {
    if (!invoice.txHash) return;
    navigator.clipboard.writeText(invoice.txHash);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 2000);
  };

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 border border-amber-500/30 shadow-2xl space-y-6 relative overflow-hidden">
      {/* Gold Ambient Background Glow */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Zap className="w-4 h-4 animate-pulse" />
            </span>
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              Real-Time Transaction Pipeline
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
                LIVE NODE MONITORED
              </span>
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Tracking Invoice <span className="font-mono text-amber-300 font-semibold">#{invoice.id.slice(-8)}</span> ({invoice.cryptoAmount} {invoice.cryptoCoin})
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {invoice.status === 'pending' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Awaiting Payment
            </span>
          )}
          {invoice.status === 'detected' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Broadcast Detected
            </span>
          )}
          {invoice.status === 'confirming' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-500/10 text-violet-300 border border-violet-500/30 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Confirming ({invoice.confirmations}/{invoice.requiredConfirmations})
            </span>
          )}
          {invoice.status === 'paid' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-4 h-4" />
              Confirmed & Activated
            </span>
          )}
          {invoice.status === 'expired' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Expired
            </span>
          )}
        </div>
      </div>

      {/* Visual Pipeline Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 relative">
        {steps.map((s) => {
          const isCompleted = currentStep > s.step;
          const isCurrent = currentStep === s.step;
          const isPending = currentStep < s.step;

          return (
            <div
              key={s.step}
              className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-3 relative ${
                isCurrent
                  ? 'bg-gradient-to-b from-amber-500/10 to-amber-500/5 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                  : isCompleted
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-500 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  isCompleted
                    ? 'bg-emerald-500 text-black'
                    : isCurrent
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-500/30 animate-pulse'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : s.step}
                </span>

                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Step 0{s.step}
                </span>
              </div>

              <div>
                <h4 className={`text-xs font-bold ${isCurrent ? 'text-amber-300' : isCompleted ? 'text-white' : 'text-zinc-400'}`}>
                  {s.title}
                </h4>
                <p className="text-[11px] font-mono text-zinc-300 mt-0.5 truncate">
                  {s.desc}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1">
                  {s.detail}
                </p>
              </div>

              {/* Progress Line Highlight for current step */}
              {isCurrent && (
                <div className="h-1 w-full bg-amber-400/30 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 animate-pulse w-2/3 rounded-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transaction Details & Simulation Bar */}
      <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
          <span>Deposit Address: <strong className="text-amber-300">{invoice.payAddress.slice(0, 12)}...{invoice.payAddress.slice(-6)}</strong></span>
          {invoice.txHash && (
            <span className="flex items-center gap-1 text-zinc-300">
              TxID: <strong className="text-emerald-400">{invoice.txHash.slice(0, 10)}...</strong>
              <button onClick={handleCopyTx} className="hover:text-white p-1">
                {copiedTx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </span>
          )}
        </div>

        {/* Developer / Interactive Simulation Controls */}
        {onSimulateStep && invoice.status !== 'paid' && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-zinc-400">Interactive Simulation:</span>
            <button
              onClick={() => onSimulateStep()}
              disabled={isSimulating}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Advance Step
            </button>
            <button
              onClick={() => onSimulateStep('auto_complete')}
              disabled={isSimulating}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs transition shadow-md shadow-emerald-500/20 flex items-center gap-1 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              Instant Complete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
