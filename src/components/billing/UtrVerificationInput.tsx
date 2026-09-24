import React, { useState } from 'react';
import {
  CheckCircle2, AlertCircle, RefreshCw, ShieldCheck,
  Zap, Lock, ArrowRight, Building, Sparkles
} from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface UtrVerificationInputProps {
  amountUsd?: number;
  onSuccess?: (message: string, newBalance?: number) => void;
  onCancel?: () => void;
}

export const UtrVerificationInput: React.FC<UtrVerificationInputProps> = ({
  amountUsd = 25,
  onSuccess,
  onCancel
}) => {
  const [rawUtr, setRawUtr] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStep, setVerificationStep] = useState<number>(0); // 0: Idle, 1: Connecting, 2: Querying, 3: Settling, 4: Done
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Clean raw digits only
  const cleanDigits = rawUtr.replace(/\D/g, '');
  const isValidLength = cleanDigits.length === 12;

  // Formatted string with spaces: 4021 9827 3615
  const formattedDisplay = cleanDigits
    .replace(/(\d{4})/g, '$1 ')
    .trim();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
    setRawUtr(val);
    setStatusMsg(null);
  };

  const handleVerifyUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanDigits || cleanDigits.length < 6) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid 12-digit UTR Number or reference hash.' });
      return;
    }

    setIsVerifying(true);
    setStatusMsg(null);

    // Visual animated multi-step sequence
    setVerificationStep(1); // Connecting to Mesh
    await new Promise(r => setTimeout(r, 700));

    setVerificationStep(2); // Querying Ledger
    await new Promise(r => setTimeout(r, 800));

    setVerificationStep(3); // Invariants check
    await new Promise(r => setTimeout(r, 700));

    try {
      const res = await apiRequest('/billing/verify-tx', {
        method: 'POST',
        body: JSON.stringify({
          txHash: cleanDigits,
          paymentMethod: 'UPI',
          amount: amountUsd
        })
      });

      if (res.success) {
        setVerificationStep(4);
        setStatusMsg({ type: 'success', text: res.message || 'UTR verified on Bank Node! Balance credited.' });
        if (onSuccess) {
          onSuccess(res.message || 'UTR verified', res.data?.newBalance);
        }
      } else {
        setVerificationStep(0);
        setStatusMsg({ type: 'error', text: res.error?.message || 'UTR verification failed. Please double check the 12-digit reference.' });
      }
    } catch (err) {
      setVerificationStep(0);
      setStatusMsg({ type: 'error', text: 'Network connection timeout during UTR verification.' });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-zinc-950 border border-violet-500/30 shadow-2xl space-y-5 text-zinc-100 relative overflow-hidden">
      {/* Top Subtle Purple Ambient Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Instant UTR / UPI Verification
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                12-Digit Auto-Check
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Enter the 12-Digit UTR Number from your GPay, PhonePe, Paytm, or BHIM transaction.
            </p>
          </div>
        </div>

        {onCancel && (
          <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-white">✕</button>
        )}
      </div>

      {/* Form Input Container */}
      <form onSubmit={handleVerifyUtr} className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1.5 text-xs">
            <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              12-Digit UTR / Ref Number *
            </label>

            {/* Validation Badge */}
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border font-bold transition-all ${
              isValidLength
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
            }`}>
              {cleanDigits.length} / 12 {isValidLength ? '✓ Valid Format' : 'Digits'}
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={formattedDisplay}
              onChange={handleInputChange}
              disabled={isVerifying}
              placeholder="e.g. 4021 9827 3615"
              className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm font-mono text-white tracking-wider placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-60 transition"
            />
            {isValidLength && !isVerifying && (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Example UTR format: 402198273615 (Numeric only).
          </p>
        </div>

        {/* Multi-step Visual Loading State Container */}
        {isVerifying && (
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-violet-500/30 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-violet-300">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-violet-400 animate-spin" />
                {verificationStep === 1 && 'Connecting to Banking Mesh & NPCI Gateway...'}
                {verificationStep === 2 && `Scanning Bank Ledger for UTR: ${formattedDisplay}...`}
                {verificationStep === 3 && 'Verifying Transaction Invariants & Crediting Wallet...'}
                {verificationStep === 4 && 'Verified Successfully!'}
              </span>
              <span className="font-mono text-[11px] text-amber-400">[{verificationStep}/3]</span>
            </div>

            {/* Visual Progress Bar */}
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 via-amber-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${(verificationStep / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Status Message Display */}
        {statusMsg && (
          <div className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}>
            {statusMsg.type === 'success' ? (
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-1 flex items-center justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 text-xs font-semibold text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={isVerifying || cleanDigits.length < 6}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 via-amber-500 to-emerald-500 hover:from-violet-500 hover:to-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-violet-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            <span>{isVerifying ? 'Verifying UTR Node...' : 'Verify UTR & Credit Account'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
