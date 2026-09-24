import React, { useState, useEffect } from 'react';
import {
  Coins, QrCode, Copy, Check, RefreshCw, AlertCircle, ShieldCheck,
  CheckCircle2, Server, ArrowRight, Zap, Clock, ExternalLink, Sparkles, Crown
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { CryptoInvoice } from '../../types';

interface CryptoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amountUsd: number;
  purpose: 'deposit' | 'server_deploy';
  serverPayload?: any;
  onSuccess?: (invoice: CryptoInvoice, serverResult?: any) => void;
}

export const CryptoPaymentModal: React.FC<CryptoPaymentModalProps> = ({
  isOpen,
  onClose,
  amountUsd,
  purpose,
  serverPayload,
  onSuccess
}) => {
  const [selectedCoin, setSelectedCoin] = useState<'LTC' | 'USDT' | 'BTC' | 'ETH' | 'SOL'>('LTC');
  const [invoice, setInvoice] = useState<CryptoInvoice | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [userTxHash, setUserTxHash] = useState('');
  const [isSubmittingHash, setIsSubmittingHash] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activationResult, setActivationResult] = useState<any | null>(null);

  // Time remaining countdown in seconds (15 min)
  const [timeLeft, setTimeLeft] = useState<number>(900);

  // Generate invoice when modal opens or coin changes
  const createCryptoInvoice = async (coin: 'LTC' | 'USDT' | 'BTC' | 'ETH' | 'SOL') => {
    setIsGenerating(true);
    setStatusMessage(null);
    setActivationResult(null);
    try {
      const res = await apiRequest('/billing/crypto/create-invoice', {
        method: 'POST',
        body: JSON.stringify({
          amount: amountUsd,
          cryptoCoin: coin,
          purpose,
          serverPayload
        })
      });

      if (res.success && res.data) {
        setInvoice(res.data);
        setTimeLeft(900);
      } else {
        setStatusMessage(res.error?.message || 'Failed to generate crypto payment request.');
      }
    } catch (err) {
      setStatusMessage('Network error while initializing crypto gateway.');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      createCryptoInvoice(selectedCoin);
    } else {
      setInvoice(null);
      setActivationResult(null);
      setStatusMessage(null);
      setUserTxHash('');
    }
  }, [isOpen]);

  // Countdown timer effect
  useEffect(() => {
    if (!invoice || invoice.status === 'paid' || invoice.status === 'expired') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setInvoice(inv => inv ? { ...inv, status: 'expired' } : null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [invoice?.id, invoice?.status]);

  // Real-time Blockchain status polling every 3.5 seconds
  useEffect(() => {
    if (!invoice || invoice.status === 'paid' || invoice.status === 'expired') return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await apiRequest(`/billing/crypto/invoice/${invoice.id}`);
        if (res.success && res.data) {
          setInvoice(res.data);
          if (res.data.status === 'paid') {
            if (onSuccess) onSuccess(res.data, res.data.createdServerId);
          }
        }
      } catch (err) {
        console.error('[CryptoPollErr]', err);
      }
    }, 3500);

    return () => clearInterval(pollInterval);
  }, [invoice?.id, invoice?.status]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSimulateStep = async (action?: 'detect' | 'confirm' | 'auto_complete') => {
    if (!invoice) return;
    setIsSimulating(true);
    setStatusMessage(null);

    const res = await apiRequest('/billing/crypto/simulate-step', {
      method: 'POST',
      body: JSON.stringify({
        invoiceId: invoice.id,
        action,
        txHash: userTxHash || undefined
      })
    });

    if (res.success && res.data) {
      setInvoice(res.data.invoice);
      if (res.data.serverActivation) {
        setActivationResult(res.data.serverActivation);
      }
      if (res.data.invoice.status === 'paid') {
        setStatusMessage('Payment verified on Blockchain node! Account credited / server activated.');
        if (onSuccess) onSuccess(res.data.invoice, res.data.serverActivation);
      }
    } else {
      setStatusMessage(res.error?.message || 'Simulation failed.');
    }
    setIsSimulating(false);
  };

  const handleSubmitTxHash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !userTxHash.trim()) return;

    setIsSubmittingHash(true);
    setStatusMessage(null);

    const res = await apiRequest('/billing/crypto/submit-hash', {
      method: 'POST',
      body: JSON.stringify({
        invoiceId: invoice.id,
        txHash: userTxHash.trim()
      })
    });

    if (res.success && res.data) {
      setInvoice(res.data.invoice);
      if (res.data.serverActivation) {
        setActivationResult(res.data.serverActivation);
      }
      setStatusMessage('Transaction Hash received! Payment confirmed & server activated.');
      if (onSuccess) onSuccess(res.data.invoice, res.data.serverActivation);
    } else {
      setStatusMessage(res.error?.message || 'Transaction hash verification failed.');
    }
    setIsSubmittingHash(false);
  };

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const coinBadges = [
    { coin: 'LTC', name: 'Litecoin', color: 'from-blue-500 to-indigo-600', text: 'Lowest Network Fee' },
    { coin: 'USDT', name: 'USDT (TRC20)', color: 'from-emerald-500 to-teal-600', text: 'Stable USD' },
    { coin: 'BTC', name: 'Bitcoin', color: 'from-amber-500 to-orange-600', text: 'Primary Crypto' },
    { coin: 'ETH', name: 'Ethereum', color: 'from-purple-500 to-violet-600', text: 'Smart Contracts' },
    { coin: 'SOL', name: 'Solana', color: 'from-fuchsia-500 to-pink-600', text: 'Sub-Second Speeds' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-amber-500/40 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden text-zinc-100 my-8">
        
        {/* Luxury Gold Shimmer Top Accent Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.8)]" />

        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
              <Crown className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2 tracking-tight">
                Premium Crypto Invoice
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Secure Node
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {purpose === 'server_deploy' ? 'Complete direct cryptocurrency payment to activate cluster instance' : 'Recharge account credit via secure decentralized ledger verification'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-2.5 rounded-xl transition-all hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">

          {/* Coin Selector */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 block mb-2.5">
              Select Payment Currency Network
            </label>
            <div className="grid grid-cols-5 gap-2">
              {coinBadges.map(item => (
                <button
                  key={item.coin}
                  onClick={() => {
                    setSelectedCoin(item.coin as any);
                    createCryptoInvoice(item.coin as any);
                  }}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center ${
                    selectedCoin === item.coin
                      ? 'border-amber-500/80 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'border-zinc-900 bg-zinc-950 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-sm font-extrabold">{item.coin}</span>
                  <span className="text-[9px] font-medium tracking-wide opacity-80 mt-1 truncate max-w-full">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generated Invoice State */}
          {isGenerating ? (
            <div className="py-16 text-center space-y-4">
              <RefreshCw className="w-9 h-9 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs text-zinc-400 font-semibold tracking-wider uppercase">Generating secure payment node & QR...</p>
            </div>
          ) : invoice ? (
            <div className="space-y-6">

              {/* Status Header & Timer */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900 flex items-center justify-between shadow-inner">
                <div className="flex items-center space-x-3">
                  {invoice.status === 'pending' && (
                    <div className="flex items-center space-x-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span className="text-xs font-semibold text-amber-400 tracking-wider">MONITORING BLOCKCHAIN...</span>
                    </div>
                  )}

                  {invoice.status === 'detected' && (
                    <div className="flex items-center space-x-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      <span className="text-xs font-bold text-blue-400 tracking-wider">TRANSACTION DETECTED!</span>
                    </div>
                  )}

                  {invoice.status === 'confirming' && (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                      <span className="text-xs font-semibold text-blue-300 font-mono tracking-wide">
                        CONFIRMING ({invoice.confirmations}/{invoice.requiredConfirmations})
                      </span>
                    </div>
                  )}

                  {invoice.status === 'paid' && (
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-400 tracking-wider">LEDGER PAYMENT VERIFIED!</span>
                    </div>
                  )}

                  {invoice.status === 'expired' && (
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-semibold text-rose-400 tracking-wider">INVOICE EXPIRED</span>
                    </div>
                  )}
                </div>

                {invoice.status !== 'paid' && invoice.status !== 'expired' && (
                  <div className="flex items-center space-x-1.5 text-xs text-zinc-400 font-mono bg-zinc-900 px-3 py-1 rounded-xl border border-zinc-800">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold tabular-nums">{formatTime(timeLeft)}</span>
                  </div>
                )}
              </div>

              {/* Amount & QR Details Card */}
              {invoice.status !== 'paid' ? (
                <div className="p-6 rounded-3xl bg-zinc-900/90 border border-zinc-800 grid grid-cols-1 md:grid-cols-12 gap-6 items-center shadow-md">
                  {/* QR Code */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center p-3.5 bg-white rounded-2xl shadow-xl border border-zinc-200 space-y-2.5">
                    <img
                      src={invoice.qrCodeUrl}
                      alt="Crypto QR Code"
                      className="w-36 h-36 object-contain"
                    />
                    <div className="flex items-center justify-between gap-1.5 w-full">
                      <button
                        type="button"
                        onClick={() => handleCopy(invoice.payAddress + '?amount=' + invoice.cryptoAmount, 'qr_link')}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-zinc-950 text-amber-400 hover:bg-zinc-900 text-[10px] font-mono font-bold flex items-center justify-center gap-1 border border-zinc-850 transition"
                      >
                        {copiedField === 'qr_link' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'qr_link' ? 'QR Copied!' : 'Copy QR'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Transfer Instructions */}
                  <div className="md:col-span-7 space-y-5">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium mb-1.5">
                        <span>SEND EXACT AMOUNT</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(invoice.cryptoAmount.toString(), 'amount')}
                          className="text-[10px] font-mono text-amber-400 hover:underline flex items-center gap-1"
                        >
                          {copiedField === 'amount' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedField === 'amount' ? 'Copied' : 'Copy Amount'}</span>
                        </button>
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">{invoice.cryptoAmount}</span>
                        <span className="text-base font-extrabold text-amber-400">{invoice.cryptoCoin}</span>
                        <span className="text-xs text-zinc-500 font-mono tabular-nums">(${invoice.amountUsd.toFixed(2)} USD)</span>
                      </div>
                    </div>

                    {/* Deposit Wallet Address with Copy */}
                    <div>
                      <p className="text-[11px] text-zinc-400 font-semibold mb-1.5">RECIPIENT DEPOSIT ADDRESS ({invoice.cryptoCoin})</p>
                      <div className="flex items-center space-x-2 bg-zinc-950 border border-zinc-850 rounded-2xl p-3">
                        <code className="text-xs text-amber-300 font-mono break-all flex-1 tracking-tight select-all">
                          {invoice.payAddress}
                        </code>
                        <button
                          onClick={() => handleCopy(invoice.payAddress, 'address')}
                          className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs transition flex items-center space-x-1 shadow-md shadow-amber-500/10 shrink-0"
                        >
                          {copiedField === 'address' ? <Check className="w-3.5 h-3.5 text-zinc-950" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === 'address' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Paid / Activated Celebration Panel */
                <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-4 animate-scale-up">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                    <Sparkles className="w-8 h-8 animate-bounce text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-extrabold text-white tracking-tight">Payment Verified on Cluster Nodes</h4>
                    <p className="text-xs text-emerald-400 mt-1 leading-relaxed">
                      {purpose === 'server_deploy'
                        ? 'Your Minecraft / Bot node instance was automatically allocated and started successfully!'
                        : `VVIP Account Credits updated. $${invoice.amountUsd.toFixed(2)} USD has been credited to your wallet.`}
                    </p>
                  </div>

                  {/* Server activation info card */}
                  {activationResult?.server && (
                    <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-left space-y-2">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                          <Server className="w-4 h-4 text-amber-400" />
                          {activationResult.server.name}
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          RUNNING
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 font-mono">
                        <div><span className="text-zinc-500 font-sans">Endpoint:</span> <span className="text-amber-400 font-bold">{activationResult.server.primaryIp}:{activationResult.server.primaryPort}</span></div>
                        <div><span className="text-zinc-500 font-sans">Runtime:</span> {activationResult.server.software}</div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={onClose}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg transition-all"
                    >
                      Done / Close
                    </button>
                  </div>
                </div>
              )}

              {/* TxID Submit & Acceleration Form (When not yet paid) */}
              {invoice.status !== 'paid' && invoice.status !== 'expired' && (
                <div className="space-y-4 pt-2">
                  <form onSubmit={handleSubmitTxHash} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-3">
                    <label className="text-[11px] font-semibold text-zinc-400 block uppercase tracking-wide">
                      Already sent payment? Enter your Transaction Hash / TxID for auto-detection:
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={userTxHash}
                        onChange={e => setUserTxHash(e.target.value)}
                        placeholder="Paste Blockchain TxID hash..."
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingHash || !userTxHash.trim()}
                        className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-extrabold text-xs flex items-center space-x-1.5 transition-all shadow-md shrink-0"
                      >
                        {isSubmittingHash ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        <span>Verify Hash</span>
                      </button>
                    </div>
                  </form>

                  {/* Dev / Test Instant Simulator button */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs">
                    <span className="text-zinc-500">Need instant confirmation for testing?</span>
                    <button
                      type="button"
                      onClick={() => handleSimulateStep('auto_complete')}
                      disabled={isSimulating}
                      className="text-amber-400 hover:text-amber-300 font-bold underline flex items-center gap-1.5 transition"
                    >
                      {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>Auto Simulate Blockchain Node Confirmation</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Status or Error Notice */}
              {statusMessage && (
                <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-amber-300 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

            </div>
          ) : null}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center space-x-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>256-Bit Encrypted Decentralized Node Verification</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold transition border border-zinc-850"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

