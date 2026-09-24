import React, { useState, useEffect } from 'react';
import {
  CreditCard, DollarSign, Tag, Check, RefreshCw, PlusCircle, ArrowUpRight,
  ShieldCheck, ShoppingBag, QrCode, Building, Copy, CheckCircle2, FileText,
  Clock, Server, Flame, Sparkles, Printer, Download, Search, Filter, AlertCircle,
  Coins, Cpu, HardDrive, MemoryStick, HelpCircle, ChevronRight, Zap, Crown, Activity
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Order, PaymentGatewaySettings, CryptoInvoice } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { CryptoPaymentModal } from '../../components/billing/CryptoPaymentModal';
import { RealtimeTransactionTracker } from '../../components/billing/RealtimeTransactionTracker';
import { LuxuryLtcQrCard } from '../../components/billing/LuxuryLtcQrCard';
import { UtrVerificationInput } from '../../components/billing/UtrVerificationInput';

interface BillingProps {
  onNavigate: (page: string, params?: any) => void;
}

interface BillingStats {
  credits: number;
  currency: string;
  activeServersCount: number;
  monthlyBurnRate: number;
  totalSpent: number;
  totalDeposited: number;
  totalOrders: number;
  pendingOrdersCount: number;
}

interface ServerSubscription {
  serverId: string;
  serverName: string;
  software: string;
  version: string;
  status: string;
  planId: string;
  planName: string;
  productName: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  autoRenew: boolean;
  createdAt: string;
  nextRenewalAt: string;
  limits?: {
    ramMB: number;
    cpuCores: number;
    diskGB: number;
  };
}

interface InvoiceDetail {
  invoiceNumber: string;
  orderId: string;
  date: string;
  status: string;
  company: {
    name: string;
    address: string;
    city: string;
    country: string;
    taxId: string;
    supportEmail: string;
    website: string;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    address: string;
  };
  items: {
    description: string;
    billingCycle: string;
    unitPrice: number;
    quantity: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  paymentMethod: string;
  transactionRef: string;
  notes: string;
}

export const Billing: React.FC<BillingProps> = ({ onNavigate }) => {
  const { user, refreshUser } = useAuth();
  const { accentClasses } = useTheme();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'orders' | 'calculator' | 'vouchers'>('overview');

  // Core Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<ServerSubscription[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [renewingServerId, setRenewingServerId] = useState<string | null>(null);
  const [renewSuccessMsg, setRenewSuccessMsg] = useState<string | null>(null);

  // Active Real-Time Crypto Invoice for Pipeline Tracker
  const [activeCryptoInvoice, setActiveCryptoInvoice] = useState<CryptoInvoice | null>(null);
  const [isSimulatingTracker, setIsSimulatingTracker] = useState(false);

  // Search & Filters for Orders
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');

  // Deposit Modal State
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState<number>(25);
  const [customAmountInput, setCustomAmountInput] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'upi' | 'crypto' | 'bank'>('stripe');
  const [selectedCryptoCoin, setSelectedCryptoCoin] = useState<'LTC' | 'USDT' | 'BTC' | 'ETH' | 'SOL'>('LTC');
  const [transactionRef, setTransactionRef] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Payment Gateways Data
  const [gateways, setGateways] = useState<any | null>(null);

  // Coupon & Voucher State
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherMessage, setVoucherMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRedeemingVoucher, setIsRedeemingVoucher] = useState(false);

  // Invoice Receipt Modal State
  const [viewInvoice, setViewInvoice] = useState<InvoiceDetail | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Resource Cost Calculator State
  const [calcRamGB, setCalcRamGB] = useState<number>(4);
  const [calcCpuCores, setCalcCpuCores] = useState<number>(2);
  const [calcDiskGB, setCalcDiskGB] = useState<number>(30);
  const [calcBackups, setCalcBackups] = useState<number>(2);
  const [calcBillingCycle, setCalcBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const fetchAllBillingData = async () => {
    setLoading(true);
    try {
      const [statsRes, ordersRes, subsRes, gwRes] = await Promise.all([
        apiRequest('/billing/stats'),
        apiRequest('/billing/orders'),
        apiRequest('/billing/subscriptions'),
        apiRequest('/billing/payment-methods')
      ]);

      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (ordersRes.success && ordersRes.data) setOrders(ordersRes.data);
      if (subsRes.success && subsRes.data) setSubscriptions(subsRes.data);
      if (gwRes.success && gwRes.data) setGateways(gwRes.data);
    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllBillingData();

    // Auto-create initial live LTC invoice for tracker pipeline if none exists
    const initLiveInvoice = async () => {
      try {
        const res = await apiRequest('/billing/crypto/create-invoice', {
          method: 'POST',
          body: JSON.stringify({ amount: 25, cryptoCoin: 'LTC', purpose: 'deposit' })
        });
        if (res.success && res.data) {
          setActiveCryptoInvoice(res.data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    initLiveInvoice();
  }, []);

  // Polling for active crypto invoice transaction pipeline
  useEffect(() => {
    if (!activeCryptoInvoice || activeCryptoInvoice.status === 'paid' || activeCryptoInvoice.status === 'expired') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await apiRequest(`/billing/crypto/invoice/${activeCryptoInvoice.id}`);
        if (res.success && res.data) {
          const oldStatus = activeCryptoInvoice.status;
          setActiveCryptoInvoice(res.data);
          
          if (res.data.status === 'paid' && oldStatus !== 'paid') {
            await refreshUser();
            await fetchAllBillingData();
          }
        }
      } catch (e) {
        console.error('Error polling active invoice:', e);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeCryptoInvoice, refreshUser]);

  const handleSimulateTrackerStep = async (action?: 'detect' | 'confirm' | 'auto_complete') => {
    let inv = activeCryptoInvoice;
    if (!inv) {
      const initRes = await apiRequest('/billing/crypto/create-invoice', {
        method: 'POST',
        body: JSON.stringify({ amount: 25, cryptoCoin: 'LTC', purpose: 'deposit' })
      });
      if (initRes.success && initRes.data) {
        inv = initRes.data;
        setActiveCryptoInvoice(inv);
      } else {
        return;
      }
    }

    setIsSimulatingTracker(true);
    try {
      const res = await apiRequest('/billing/crypto/simulate-step', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: inv.id, action })
      });
      if (res.success && res.data) {
        setActiveCryptoInvoice(res.data.invoice);
        if (res.data.invoice.status === 'paid') {
          await refreshUser();
          await fetchAllBillingData();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulatingTracker(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleAddCredits = async () => {
    const finalAmount = customAmountInput ? parseFloat(customAmountInput) : creditAmount;
    if (isNaN(finalAmount) || finalAmount < 1) {
      setPaymentMsg({ type: 'error', text: 'Minimum deposit amount is $1.00.' });
      return;
    }

    setIsProcessingPayment(true);
    setPaymentMsg(null);

    const res = await apiRequest('/billing/add-credits', {
      method: 'POST',
      body: JSON.stringify({
        amount: finalAmount,
        paymentMethod:
          selectedMethod === 'upi' ? 'UPI / QR Code Scan' :
          selectedMethod === 'bank' ? 'Bank Wire Transfer' :
          selectedMethod === 'crypto' ? `Crypto (${selectedCryptoCoin})` :
          'Instant Card (Stripe Verified)',
        cryptoCoin: selectedMethod === 'crypto' ? selectedCryptoCoin : undefined,
        transactionRef: ['upi', 'bank', 'crypto'].includes(selectedMethod) ? transactionRef.trim() : undefined
      })
    });

    if (res.success) {
      await refreshUser();
      await fetchAllBillingData();
      setPaymentMsg({ type: 'success', text: res.message || 'Payment successfully processed!' });
      setTransactionRef('');
      setCustomAmountInput('');
      setTimeout(() => {
        setShowAddCreditsModal(false);
        setPaymentMsg(null);
      }, 2000);
    } else {
      setPaymentMsg({ type: 'error', text: res.error?.message || 'Payment submission failed.' });
    }
    setIsProcessingPayment(false);
  };

  const handleAutoVerifyTx = async () => {
    if (!transactionRef.trim()) {
      setPaymentMsg({ type: 'error', text: 'Please enter your TxID / Hash or 12-Digit UTR Number.' });
      return;
    }

    const finalAmount = customAmountInput ? parseFloat(customAmountInput) : creditAmount;
    setIsProcessingPayment(true);
    setPaymentMsg(null);

    const res = await apiRequest('/billing/verify-tx', {
      method: 'POST',
      body: JSON.stringify({
        txHash: transactionRef.trim(),
        paymentMethod: selectedMethod === 'upi' ? 'UPI' : 'Crypto',
        cryptoCoin: selectedMethod === 'crypto' ? selectedCryptoCoin : undefined,
        amount: finalAmount
      })
    });

    if (res.success) {
      await refreshUser();
      await fetchAllBillingData();
      setPaymentMsg({ type: 'success', text: res.message || 'Transaction verified on Blockchain! Account credited.' });
      setTransactionRef('');
      setCustomAmountInput('');
      setTimeout(() => {
        setShowAddCreditsModal(false);
        setPaymentMsg(null);
      }, 2000);
    } else {
      setPaymentMsg({ type: 'error', text: res.error?.message || 'Verification failed. Please check TxID or UTR.' });
    }
    setIsProcessingPayment(false);
  };

  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;

    setIsRedeemingVoucher(true);
    setVoucherMessage(null);

    const res = await apiRequest('/billing/redeem-coupon', {
      method: 'POST',
      body: JSON.stringify({ code: voucherCode.trim() })
    });

    if (res.success) {
      setVoucherMessage({ type: 'success', text: res.message || 'Voucher redeemed successfully!' });
      setVoucherCode('');
      await refreshUser();
      await fetchAllBillingData();
    } else {
      setVoucherMessage({ type: 'error', text: res.error?.message || 'Invalid or expired voucher code.' });
    }
    setIsRedeemingVoucher(false);
  };

  const handleRenewServer = async (serverId: string, serverName: string) => {
    setRenewingServerId(serverId);
    setRenewSuccessMsg(null);

    const res = await apiRequest(`/billing/subscriptions/${serverId}/renew`, {
      method: 'POST'
    });

    if (res.success) {
      setRenewSuccessMsg(`Server '${serverName}' successfully renewed for 30 days!`);
      await refreshUser();
      await fetchAllBillingData();
      setTimeout(() => setRenewSuccessMsg(null), 4000);
    } else {
      alert(res.error?.message || 'Failed to renew server subscription.');
    }
    setRenewingServerId(null);
  };

  const handleOpenInvoice = async (orderId: string) => {
    setLoadingInvoice(true);
    const res = await apiRequest(`/billing/invoices/${orderId}`);
    if (res.success && res.data) {
      setViewInvoice(res.data);
    } else {
      alert('Unable to generate invoice at this time.');
    }
    setLoadingInvoice(false);
  };

  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === 'all' || o.status.toLowerCase() === statusFilter.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      o.id.toLowerCase().includes(q) ||
      o.planName.toLowerCase().includes(q) ||
      (o.transactionRef && o.transactionRef.toLowerCase().includes(q)) ||
      (o.paymentMethod && o.paymentMethod.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  // Calculate dynamic custom server price in calculator
  const calcRamPrice = calcRamGB * 1.50;
  const calcCpuPrice = calcCpuCores * 2.00;
  const calcDiskPrice = calcDiskGB * 0.10;
  const calcBackupPrice = calcBackups * 0.50;
  const calcMonthlyTotal = calcRamPrice + calcCpuPrice + calcDiskPrice + calcBackupPrice;
  const calcYearlyTotal = calcMonthlyTotal * 12 * 0.85;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Premium Top Header Banner */}
      <div className="relative overflow-hidden p-6 rounded-3xl bg-zinc-950 border border-zinc-900 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-violet-500/0 to-transparent pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <Crown className="h-6 w-6 text-amber-400 animate-pulse" /> 
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Crown Ledger & Wallet
            </span>
          </h1>
          <p className="text-xs text-zinc-400">
            Premium account credits, real-time node billing logs, live server subscriptions, and gold voucher redemptions.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => onNavigate('deploy')}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 hover:text-white hover:bg-zinc-850 hover:border-zinc-700 transition"
          >
            <Server className="h-4 w-4 inline mr-2 text-amber-400" /> Deploy Premium Instance
          </button>
          
          <button
            onClick={() => setShowAddCreditsModal(true)}
            className="px-5 py-2.5 rounded-xl font-extrabold text-xs text-zinc-950 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 shadow-lg shadow-amber-500/10 flex items-center gap-2 transition-all duration-300 scale-100 hover:scale-[1.02]"
          >
            <PlusCircle className="h-4 w-4 text-zinc-950" /> Add Wallet Funds
          </button>
        </div>
      </div>

      {/* Luxury Metrics & Wallet Balance Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Premium Available Balance Card */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-amber-500/30 space-y-2 relative overflow-hidden group shadow-[0_0_20px_rgba(245,158,11,0.05)]">
          <div className="absolute top-0 right-0 p-3 text-amber-500/10 group-hover:text-amber-500/20 transition-colors">
            <Crown className="w-12 h-12" />
          </div>
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span className="font-extrabold uppercase tracking-widest text-amber-400/95 flex items-center gap-1.5">
              Available Credits
            </span>
            <span className="font-semibold text-emerald-400 font-mono">
              USD ($)
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight tabular-nums pt-1">
            ${user?.credits !== undefined ? user.credits.toFixed(2) : (stats?.credits.toFixed(2) || '0.00')}
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-zinc-800 text-[11px] text-zinc-450 font-medium">
            <span>VIP Auto-Renew Ready</span>
            <button
              onClick={() => setShowAddCreditsModal(true)}
              className="text-amber-400 hover:text-amber-300 font-extrabold flex items-center gap-0.5 transition"
            >
              Add Funds <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Monthly Burn Rate */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2 relative overflow-hidden group">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span className="font-extrabold uppercase tracking-widest text-zinc-400/90">Monthly Burn Rate</span>
            <span className="p-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-400">
              <Flame className="h-4 w-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-amber-400 font-mono tracking-tight tabular-nums pt-1">
            ${stats?.monthlyBurnRate?.toFixed(2) || '0.00'}
            <span className="text-xs text-zinc-500 font-normal font-sans ml-1">/mo</span>
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-zinc-800 text-[11px] text-zinc-450 font-medium">
            <span>{subscriptions.length} Running Clusters</span>
            <span className="font-mono text-zinc-300">
              {stats?.credits && stats.monthlyBurnRate > 0
                ? `~${Math.floor(stats.credits / stats.monthlyBurnRate * 30)} days runway`
                : 'Unlimited'}
            </span>
          </div>
        </div>

        {/* Active Subscriptions */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2 relative overflow-hidden group">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span className="font-extrabold uppercase tracking-widest text-zinc-400/90">Premium Instances</span>
            <span className="p-1.5 rounded-lg bg-violet-500/5 border border-violet-500/10 text-violet-400">
              <Server className="h-4 w-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight tabular-nums pt-1">
            {subscriptions.length}
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-zinc-800 text-[11px] text-zinc-450 font-medium">
            <span>Live Core Nodes</span>
            <button onClick={() => setActiveTab('subscriptions')} className="text-violet-400 hover:text-violet-300 font-bold transition">
              Manage All
            </button>
          </div>
        </div>

        {/* Total Invoices Paid */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2 relative overflow-hidden group">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span className="font-extrabold uppercase tracking-widest text-zinc-400/90">Verified Invoices</span>
            <span className="p-1.5 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-cyan-400">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight tabular-nums pt-1">
            {orders.length}
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-zinc-800 text-[11px] text-zinc-450 font-medium">
            <span>{orders.filter(o => o.status === 'paid').length} Paid Receipts</span>
            <button onClick={() => setActiveTab('orders')} className="text-cyan-400 hover:text-cyan-300 font-bold transition">
              View History
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Wallet & Overview', icon: DollarSign },
          { id: 'subscriptions', label: `Active Servers (${subscriptions.length})`, icon: Server },
          { id: 'orders', label: `Invoices & Ledger (${orders.length})`, icon: FileText },
          { id: 'calculator', label: 'Resource Calculator', icon: Cpu },
          { id: 'vouchers', label: 'Promo & Vouchers', icon: Tag }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {renewSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <span>{renewSuccessMsg}</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW & QUICK WALLET */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Real-Time Transaction Status Pipeline Component */}
          {gateways?.crypto?.enabled !== false && (
            <RealtimeTransactionTracker
              invoice={activeCryptoInvoice}
              onRefresh={fetchAllBillingData}
              onSimulateStep={handleSimulateTrackerStep}
              isSimulating={isSimulatingTracker}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Quick Deposit & Gateways Summary */}
            <div className="lg:col-span-2 space-y-6">
              {/* Luxury LTC & Crypto Copy-to-Clipboard QR Code Generator */}
              {gateways?.crypto?.enabled !== false && (
                <LuxuryLtcQrCard
                  amountUsd={creditAmount}
                  walletAddress={gateways?.crypto?.ltcAddress || 'ltc1q3w4e5r6t7y8u9i0o1p2a3s4d5f6g7h8j9k0l'}
                  onLaunchProcessor={() => setShowCryptoModal(true)}
                />
              )}

              <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" /> Instant Account Recharge
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Deposit credits seamlessly using Credit Card, UPI QR scan, Crypto, or Bank Wire.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddCreditsModal(true)}
                    className="text-xs font-semibold text-amber-400 hover:underline"
                  >
                    Custom Amount
                  </button>
                </div>

                {/* Preset Deposit Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[10, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        setCreditAmount(amt);
                        setCustomAmountInput('');
                        setShowAddCreditsModal(true);
                      }}
                      className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-amber-500/50 text-left transition group"
                    >
                      <div className="text-xs text-zinc-400">Recharge</div>
                      <div className="text-xl font-black text-white font-mono group-hover:text-amber-400 transition">
                        ${amt}.00
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                        +${amt}.00 credits
                      </div>
                    </button>
                  ))}
                </div>

                {/* Supported Gateways Banner */}
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-300">Accepted Gateways:</span>
                  <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span className="flex items-center gap-1 text-cyan-400">
                      <CreditCard className="h-3.5 w-3.5" /> Visa / MC / AMEX
                    </span>
                    <span className="flex items-center gap-1 text-violet-400">
                      <QrCode className="h-3.5 w-3.5" /> UPI & QR Scan
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <Coins className="h-3.5 w-3.5" /> USDT / BTC / SOL
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Building className="h-3.5 w-3.5" /> Wire / NEFT
                    </span>
                  </div>
                </div>
              </div>

            {/* Recent Orders Preview */}
            <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-amber-400" /> Recent Transactions
                </h3>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs text-amber-400 hover:underline font-semibold"
                >
                  View All Orders →
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500 bg-zinc-950 rounded-2xl border border-zinc-900">
                  No billing transactions recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-zinc-850 rounded-2xl border border-zinc-850 bg-zinc-950 overflow-hidden shadow-inner">
                  {orders.slice(0, 4).map((o) => (
                    <div key={o.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/40 transition">
                      <div className="space-y-1">
                        <div className="font-bold text-white text-xs flex items-center gap-3">
                          <span className="tracking-tight">{o.planName}</span>
                          <span className="text-zinc-650" aria-hidden="true">·</span>
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider ${
                            o.status === 'paid' ? 'text-emerald-400' :
                            o.status === 'pending' ? 'text-amber-400 font-bold animate-pulse' :
                            'text-rose-450'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              o.status === 'paid' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' :
                              o.status === 'pending' ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]' :
                              'bg-rose-500'
                            }`} />
                            {o.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          ID: #{o.id.replace('ord_', '').slice(0, 8).toUpperCase()} <span className="text-zinc-700">/</span> {o.paymentMethod}
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <div className="font-mono font-black text-emerald-400 text-xs tabular-nums">${o.amount.toFixed(2)}</div>
                        <button
                          onClick={() => handleOpenInvoice(o.id)}
                          className="text-[10px] text-zinc-500 hover:text-white transition font-medium underline"
                        >
                          View Receipt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Promo Code Voucher Redemption & Deployment Shortlink */}
          <div className="space-y-6">
            {/* Promo Code Box */}
            <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white flex items-center gap-2">
                  <Tag className="h-4 w-4 text-violet-400" /> Gift & Voucher Code
                </span>
                <span className="text-[10px] text-violet-400 font-mono">e.g. FREE5 / WELCOME20</span>
              </div>
              <p className="text-xs text-zinc-400">
                Redeem promotional gift codes directly for account credits.
              </p>

              <form onSubmit={handleRedeemVoucher} className="space-y-2.5">
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="ENTER VOUCHER CODE..."
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-white uppercase font-mono placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={isRedeemingVoucher || !voucherCode.trim()}
                  className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs disabled:opacity-50 transition"
                >
                  {isRedeemingVoucher ? 'Redeeming...' : 'Redeem Voucher'}
                </button>
              </form>

              {voucherMessage && (
                <div className={`p-3 rounded-xl border text-xs ${
                  voucherMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {voucherMessage.text}
                </div>
              )}
            </div>

            {/* Quick Deploy Server Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" /> Launch Next Server
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Deploy high-performance Paper, Purpur, Fabric, Node.js, or Bun servers with instant port binding.
              </p>
              <button
                onClick={() => onNavigate('deploy')}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs shadow-lg shadow-amber-500/10 transition"
              >
                Open Server Provisioner →
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* TAB 2: ACTIVE SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-amber-400" /> Active Server Subscriptions ({subscriptions.length})
            </h2>
            <button
              onClick={() => onNavigate('deploy')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-black font-bold text-xs hover:bg-amber-300 transition"
            >
              + Add Server
            </button>
          </div>

          {subscriptions.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <Server className="h-8 w-8 text-zinc-600 mx-auto" />
              <div className="text-sm font-bold text-white">No Active Servers Found</div>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                You haven't provisioned any Minecraft or Bot hosting servers yet.
              </p>
              <button
                onClick={() => onNavigate('deploy')}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-black font-bold text-xs"
              >
                Deploy Your First Server
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subscriptions.map((sub) => (
                <div key={sub.serverId} className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-850 hover:border-amber-500/20 transition-all flex flex-col justify-between shadow-[0_0_15px_rgba(0,0,0,0.2)]">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-extrabold text-sm text-white truncate">{sub.serverName}</div>
                      <span className={`flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider ${
                        sub.status === 'active' ? 'text-emerald-400' : 'text-zinc-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          sub.status === 'active' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'bg-zinc-650'
                        }`} />
                        {sub.status}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-zinc-400">
                        <span className="font-semibold">Plan Tier:</span>
                        <span className="text-white font-extrabold flex items-center gap-1">
                          {sub.planName.toLowerCase().includes('premium') || sub.priceMonthly > 10 ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : null}
                          {sub.planName}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-400">
                        <span className="font-semibold">Engine / Runtime:</span>
                        <span className="text-amber-400 font-mono font-bold tracking-tight">{sub.software} {sub.version}</span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-400">
                        <span className="font-semibold">Monthly Cost:</span>
                        {sub.priceMonthly === 0 ? (
                          <span className="text-emerald-400 font-extrabold tracking-widest text-[10px]">
                            FREE PLAN
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-mono font-black tabular-nums">${sub.priceMonthly.toFixed(2)} / mo</span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-400 flex items-center justify-between font-medium">
                      <span className="flex items-center gap-1.5 text-zinc-500">
                        <Clock className="h-3.5 w-3.5 text-amber-400" /> Next Renewal:
                      </span>
                      <span className="font-mono text-zinc-300 font-bold">
                        {new Date(sub.nextRenewalAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-850/80 mt-4 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onNavigate('server-manage', { serverId: sub.serverId })}
                      className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-bold text-center border border-zinc-700/65 transition hover:text-white"
                    >
                      Manage
                    </button>
                    <button
                      onClick={() => handleRenewServer(sub.serverId, sub.serverName)}
                      disabled={renewingServerId === sub.serverId}
                      className="flex-1 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold text-center transition disabled:opacity-50"
                    >
                      {renewingServerId === sub.serverId ? 'Renewing...' : 'Renew Early'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INVOICES & ORDER LEDGER */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-amber-400" /> Invoices & Transaction History
            </h2>

            <div className="flex items-center gap-2">
              {/* Search Bar */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search invoice or ID..."
                  className="bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-400 space-y-2">
              <RefreshCw className="h-5 w-5 animate-spin text-amber-400 mx-auto" />
              <p>Loading invoice records...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl text-xs text-zinc-400">
              No matching transactions or receipts found.
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                  <tr>
                    <th className="p-3.5">Invoice #</th>
                    <th className="p-3.5">Description / Plan</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Gateway / Method</th>
                    <th className="p-3.5">Transaction Ref / TxID</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-zinc-850/60 transition-colors">
                      <td className="p-3.5 font-mono text-amber-400 font-semibold">
                        #{o.id.replace('ord_', '').slice(0, 8)}
                      </td>
                      <td className="p-3.5 font-semibold text-white">{o.planName}</td>
                      <td className="p-3.5 font-mono text-emerald-400 font-bold">${o.amount.toFixed(2)}</td>
                      <td className="p-3.5 text-zinc-300">{o.paymentMethod}</td>
                      <td className="p-3.5 font-mono text-zinc-400">{o.transactionRef || '-'}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border capitalize ${
                          o.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          o.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-zinc-400 font-mono text-[11px]">{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleOpenInvoice(o.id)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition inline-flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RESOURCE PRICING CALCULATOR */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
          {/* Sliders Box */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu className="h-4 w-4 text-amber-400" /> Interactive Resource Cost Calculator
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Customize your ideal RAM, vCPU cores, and high-speed NVMe storage specs to preview billing rates.
              </p>
            </div>

            {/* RAM Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <MemoryStick className="h-4 w-4 text-amber-400" /> Dedicated Memory (RAM)
                </span>
                <span className="font-mono font-bold text-amber-400">{calcRamGB} GB RAM (${calcRamPrice.toFixed(2)}/mo)</span>
              </div>
              <input
                type="range"
                min="1"
                max="32"
                step="1"
                value={calcRamGB}
                onChange={(e) => setCalcRamGB(parseInt(e.target.value, 10))}
                className="w-full accent-amber-400 bg-zinc-950 h-2 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>1 GB (Lightweight Bot)</span>
                <span>8 GB (Modded Server)</span>
                <span>32 GB (Mega Network)</span>
              </div>
            </div>

            {/* CPU Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-cyan-400" /> Compute vCPU Threads
                </span>
                <span className="font-mono font-bold text-cyan-400">{calcCpuCores} vCPU (${calcCpuPrice.toFixed(2)}/mo)</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={calcCpuCores}
                onChange={(e) => setCalcCpuCores(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 bg-zinc-950 h-2 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>1 Core</span>
                <span>4 Cores</span>
                <span>8 Dedicated Cores</span>
              </div>
            </div>

            {/* NVMe Disk Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4 text-emerald-400" /> PCIe 4.0 NVMe Storage
                </span>
                <span className="font-mono font-bold text-emerald-400">{calcDiskGB} GB SSD (${calcDiskPrice.toFixed(2)}/mo)</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="5"
                value={calcDiskGB}
                onChange={(e) => setCalcDiskGB(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-400 bg-zinc-950 h-2 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>10 GB</span>
                <span>100 GB</span>
                <span>200 GB</span>
              </div>
            </div>
          </div>

          {/* Pricing Preview Summary Card */}
          <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Estimated Cost Summary</h3>

              {/* Cycle Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
                <button
                  onClick={() => setCalcBillingCycle('monthly')}
                  className={`py-2 rounded-xl text-xs font-semibold transition ${
                    calcBillingCycle === 'monthly' ? 'bg-amber-400 text-black font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setCalcBillingCycle('yearly')}
                  className={`py-2 rounded-xl text-xs font-semibold transition ${
                    calcBillingCycle === 'yearly' ? 'bg-amber-400 text-black font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Yearly (-15%)
                </button>
              </div>

              <div className="space-y-2 text-xs border-t border-b border-zinc-800 py-3">
                <div className="flex justify-between text-zinc-400">
                  <span>RAM ({calcRamGB} GB):</span>
                  <span className="text-white font-mono">${calcRamPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>CPU ({calcCpuCores} vCPU):</span>
                  <span className="text-white font-mono">${calcCpuPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Storage ({calcDiskGB} GB NVMe):</span>
                  <span className="text-white font-mono">${calcDiskPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Included Backups (2 slots):</span>
                  <span className="text-white font-mono">$1.00</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-zinc-400">Calculated Rate</div>
                <div className="text-3xl font-black text-emerald-400 font-mono">
                  ${calcBillingCycle === 'yearly' ? calcYearlyTotal.toFixed(2) : calcMonthlyTotal.toFixed(2)}
                  <span className="text-xs text-zinc-400 font-sans font-normal ml-1">
                    /{calcBillingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('deploy')}
              className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs shadow-lg shadow-amber-500/10 transition flex items-center justify-center gap-2"
            >
              <span>Deploy Server with these Specs</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: PROMO & VOUCHERS */}
      {activeTab === 'vouchers' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Tag className="h-4 w-4 text-violet-400" /> Promotional Vouchers & Special Credits
            </h2>
            <p className="text-xs text-zinc-400">
              Enter promotional discount vouchers or gift codes to claim platform balance discounts.
            </p>

            <form onSubmit={handleRedeemVoucher} className="flex gap-2 max-w-xl">
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="ENTER VOUCHER CODE..."
                className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white uppercase font-mono placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={isRedeemingVoucher || !voucherCode.trim()}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs disabled:opacity-50 transition shrink-0"
              >
                {isRedeemingVoucher ? 'Redeeming...' : 'Apply Code'}
              </button>
            </form>

            {voucherMessage && (
              <div className={`p-3 rounded-xl border text-xs max-w-xl ${
                voucherMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {voucherMessage.text}
              </div>
            )}
          </div>

          {/* Active Public Promotional Codes Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                  WELCOME20
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">20% OFF</span>
              </div>
              <p className="text-xs text-zinc-300 font-semibold">20% Off Server Deployment</p>
              <p className="text-[11px] text-zinc-500">Apply during deploy wizard checkout for 20% discount.</p>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-lg border border-violet-500/20">
                  FREE5
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">+$5.00</span>
              </div>
              <p className="text-xs text-zinc-300 font-semibold">$5.00 Account Starter Credit</p>
              <p className="text-[11px] text-zinc-500">Instant $5 deposit for new user testing and deployments.</p>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                  DEVGIFT
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">+$15.00</span>
              </div>
              <p className="text-xs text-zinc-300 font-semibold">Developer Community Gift</p>
              <p className="text-[11px] text-zinc-500">Claim $15 credits for running Discord & Minecraft bot servers.</p>
            </div>
          </div>
        </div>
      )}

      {/* ADD CREDITS / DEPOSIT MODAL */}
      {showAddCreditsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-400" /> Deposit Account Credits
              </h3>
              <button onClick={() => setShowAddCreditsModal(false)} className="text-xs text-zinc-400 hover:text-white">✕</button>
            </div>

            {/* 1. Deposit Amount Selection */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">1. Select Deposit Amount</label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[10, 25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setCreditAmount(amt);
                      setCustomAmountInput('');
                    }}
                    className={`p-3 rounded-2xl font-mono text-sm font-bold transition-all border ${
                      creditAmount === amt && !customAmountInput
                        ? 'bg-amber-400 text-black border-amber-300 shadow-lg'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="1"
                step="1"
                value={customAmountInput}
                onChange={(e) => setCustomAmountInput(e.target.value)}
                placeholder="Or enter custom amount in USD ($)..."
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 2. Gateway Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">2. Select Payment Method</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {gateways?.stripe?.enabled !== false && (
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('stripe')}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                      selectedMethod === 'stripe' ? 'border-amber-400 bg-amber-500/10 text-white font-bold' : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    <CreditCard className="h-5 w-5 text-cyan-400" />
                    <span className="text-[11px]">Instant Card</span>
                  </button>
                )}

                {gateways?.upi?.enabled !== false && (
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('upi')}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                      selectedMethod === 'upi' ? 'border-amber-400 bg-amber-500/10 text-white font-bold' : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    <QrCode className="h-5 w-5 text-violet-400" />
                    <span className="text-[11px]">UPI / QR</span>
                  </button>
                )}

                {gateways?.crypto?.enabled !== false && (
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('crypto')}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                      selectedMethod === 'crypto' ? 'border-amber-400 bg-amber-500/10 text-white font-bold' : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    <Coins className="h-5 w-5 text-amber-400" />
                    <span className="text-[11px]">Crypto</span>
                  </button>
                )}
              </div>
            </div>

            {/* PAYMENT GATEWAY DETAILS */}
            {selectedMethod === 'stripe' && (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Deposit Amount:</span>
                  <strong className="text-white font-mono text-sm">${(customAmountInput ? parseFloat(customAmountInput) || 0 : creditAmount).toFixed(2)}</strong>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> Instant Processing
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Credits are credited immediately to your balance upon clicking Deposit.
                  </p>
                </div>
              </div>
            )}

            {selectedMethod === 'upi' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="text-center space-y-2">
                    <div className="text-xs font-bold text-white">Scan UPI QR Code via GPay, PhonePe, Paytm, or BHIM</div>
                    <img
                      src={gateways?.upi?.qrCodeUrl || "https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=400&q=80"}
                      alt="UPI QR Code"
                      className="h-40 w-40 object-cover mx-auto rounded-2xl border border-zinc-700 shadow-xl"
                    />
                    <div className="flex items-center justify-center gap-2 bg-zinc-950 py-2 px-3 rounded-xl border border-zinc-800">
                      <span className="text-xs font-mono text-violet-400 font-bold">
                        {gateways?.upi?.upiId || 'aetherpay@okaxis'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(gateways?.upi?.upiId || 'aetherpay@okaxis', 'upi')}
                        className="text-zinc-400 hover:text-white"
                      >
                        {copiedText === 'upi' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center space-y-1">
                  <div className="font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Instant Payment Auto-Detection
                  </div>
                  <p className="text-[11px] text-zinc-400">Scan QR code from any UPI app to deposit. Funds auto-credit once received.</p>
                </div>
              </div>
            )}

            {selectedMethod === 'crypto' && (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs">
                {/* Real-time Processor Callout Banner */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border border-amber-500/40 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" /> Real-Time Live Crypto Processor
                    </div>
                    <p className="text-[11px] text-zinc-400">Exact billing amount QR code, live exchange rates & auto server delivery</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCreditsModal(false);
                      setShowCryptoModal(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all shrink-0"
                  >
                    Launch Processor
                  </button>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">Select Cryptocurrency</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(['LTC', 'USDT', 'BTC', 'ETH', 'SOL'] as const).map((coin) => (
                      <button
                        key={coin}
                        type="button"
                        onClick={() => setSelectedCryptoCoin(coin)}
                        className={`p-2 rounded-xl text-xs font-bold border transition ${
                          selectedCryptoCoin === coin
                            ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-500/20'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white'
                        }`}
                      >
                        {coin}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="flex justify-between items-center text-zinc-400 font-medium">
                    <span>Admin Deposit Wallet ({selectedCryptoCoin}):</span>
                    <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {selectedCryptoCoin === 'LTC' ? 'Litecoin Network' : selectedCryptoCoin === 'USDT' ? 'TRC-20 Network' : `${selectedCryptoCoin} Native Network`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-amber-400 bg-zinc-900 p-2.5 rounded-xl border border-zinc-800/80 break-all">
                    <span>
                      {selectedCryptoCoin === 'LTC' ? (gateways?.crypto?.ltcAddress || 'ltc1q3w4e5r6t7y8u9i0o1p2a3s4d5f6g7h8j9k0l') :
                       selectedCryptoCoin === 'USDT' ? (gateways?.crypto?.usdtAddress || 'TX9d8h7g6f5e4d3c2b1a0z9y8x7w6v5u4t3s2r1q') :
                       selectedCryptoCoin === 'BTC' ? (gateways?.crypto?.btcAddress || 'bc1q9v8t7w6x5y4z3a2b1c0d9e8f7g6h5j4k3m2n1') :
                       selectedCryptoCoin === 'ETH' ? (gateways?.crypto?.ethAddress || '0x71C56538B1D42916857723fF7463A0F1283c7490') :
                       (gateways?.crypto?.solAddress || 'SoL99AetherPanelCryptoDepositNodeWallet88XyZ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(
                        selectedCryptoCoin === 'LTC' ? (gateways?.crypto?.ltcAddress || 'ltc1q3w4e5r6t7y8u9i0o1p2a3s4d5f6g7h8j9k0l') :
                        selectedCryptoCoin === 'USDT' ? (gateways?.crypto?.usdtAddress || 'TX9d8h7g6f5e4d3c2b1a0z9y8x7w6v5u4t3s2r1q') :
                        selectedCryptoCoin === 'BTC' ? (gateways?.crypto?.btcAddress || 'bc1q9v8t7w6x5y4z3a2b1c0d9e8f7g6h5j4k3m2n1') :
                        selectedCryptoCoin === 'ETH' ? (gateways?.crypto?.ethAddress || '0x71C56538B1D42916857723fF7463A0F1283c7490') :
                        (gateways?.crypto?.solAddress || 'SoL99AetherPanelCryptoDepositNodeWallet88XyZ'),
                        'crypto'
                      )}
                      className="text-zinc-400 hover:text-white shrink-0 p-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
                    >
                      {copiedText === 'crypto' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {paymentMsg && (
              <div className={`p-3 rounded-xl border text-xs font-semibold ${
                paymentMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {paymentMsg.text}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAddCreditsModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-white"
              >
                Cancel
              </button>

              {selectedMethod === 'crypto' ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCreditsModal(false);
                    setShowCryptoModal(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                >
                  <Coins className="h-4 w-4" />
                  Launch Crypto Payment Gateway
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddCredits}
                  disabled={isProcessingPayment}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs disabled:opacity-50 transition shadow-lg shadow-amber-500/10"
                >
                  {isProcessingPayment ? 'Processing Deposit...' : `Deposit $${(customAmountInput ? parseFloat(customAmountInput) || 0 : creditAmount).toFixed(2)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAILED PRINTABLE INVOICE RECEIPT MODAL */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-3xl space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Actions */}
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-400" />
                <span className="font-bold text-white text-base font-mono">{viewInvoice.invoiceNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Printer className="h-3.5 w-3.5" /> Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setViewInvoice(null)}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Invoice Printable Sheet Content */}
            <div className="space-y-6 text-xs text-zinc-300">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <div className="text-base font-black text-white">{viewInvoice.company.name}</div>
                  <div className="text-zinc-400">{viewInvoice.company.address}</div>
                  <div className="text-zinc-400">{viewInvoice.company.city}, {viewInvoice.company.country}</div>
                  <div className="text-zinc-500 font-mono mt-1">Tax ID: {viewInvoice.company.taxId}</div>
                </div>

                <div className="sm:text-right space-y-1.5">
                  <div className="text-lg font-black text-amber-400 font-mono">{viewInvoice.invoiceNumber}</div>
                  <div className="text-zinc-400 font-mono">Date: {new Date(viewInvoice.date).toLocaleDateString()}</div>
                  <div className={`flex items-center sm:justify-end gap-1.5 text-[10px] font-extrabold uppercase tracking-widest ${
                    viewInvoice.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      viewInvoice.status === 'paid' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                    }`} />
                    <span>Status: {viewInvoice.status}</span>
                  </div>
                </div>
              </div>

              {/* Billed To */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                <div className="text-zinc-500 font-semibold">BILLED TO:</div>
                <div className="text-sm font-bold text-white">{viewInvoice.customer.name}</div>
                <div className="font-mono text-zinc-400">{viewInvoice.customer.email}</div>
                <div className="text-zinc-500 font-mono text-[11px]">Account ID: {viewInvoice.customer.id}</div>
              </div>

              {/* Items Table */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-950 border-b border-zinc-800 font-mono text-[11px] text-zinc-400">
                    <tr>
                      <th className="p-3">Item Description</th>
                      <th className="p-3">Cycle</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80 font-mono">
                    {viewInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-sans font-semibold text-white">{item.description}</td>
                        <td className="p-3 capitalize text-zinc-400">{item.billingCycle}</td>
                        <td className="p-3 text-right text-zinc-400">{item.quantity}</td>
                        <td className="p-3 text-right text-zinc-300">${item.unitPrice.toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-white">${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal:</span>
                    <span>${viewInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Tax (0%):</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Discount:</span>
                    <span>-$0.00</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-white pt-2 border-t border-zinc-800">
                    <span>Total Paid:</span>
                    <span className="text-emerald-400">${viewInvoice.total.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>

              {/* Payment Details Footer */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1 text-[11px] text-zinc-400 font-mono">
                <div>Payment Gateway: <strong className="text-zinc-200">{viewInvoice.paymentMethod}</strong></div>
                <div>Reference ID: <strong className="text-amber-400">{viewInvoice.transactionRef}</strong></div>
                <div className="text-zinc-500 pt-1 font-sans">{viewInvoice.notes}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Crypto Payment Modal */}
      <CryptoPaymentModal
        isOpen={showCryptoModal}
        onClose={() => setShowCryptoModal(false)}
        amountUsd={customAmountInput ? (parseFloat(customAmountInput) || 25) : creditAmount}
        purpose="deposit"
        onSuccess={async () => {
          await refreshUser();
          await fetchAllBillingData();
        }}
      />

    </div>
  );
};

export default Billing;
