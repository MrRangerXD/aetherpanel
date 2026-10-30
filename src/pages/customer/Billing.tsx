import React, { useState, useEffect } from 'react';
import {
  CreditCard, DollarSign, Tag, PlusCircle, ArrowUpRight,
  ShieldCheck, ShoppingBag, QrCode, Building, Copy, CheckCircle2, FileText,
  Clock, Server, Flame, Sparkles, Printer, Search,
  Coins, Cpu, HardDrive, MemoryStick, ChevronRight, Zap, Crown, X, RefreshCw
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Order, CryptoInvoice } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { CryptoPaymentModal } from '../../components/billing/CryptoPaymentModal';
import { RealtimeTransactionTracker } from '../../components/billing/RealtimeTransactionTracker';
import { LuxuryLtcQrCard } from '../../components/billing/LuxuryLtcQrCard';

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
  const [, setLoadingInvoice] = useState(false);

  // Resource Cost Calculator State
  const [calcRamGB, setCalcRamGB] = useState<number>(4);
  const [calcCpuCores, setCalcCpuCores] = useState<number>(2);
  const [calcDiskGB, setCalcDiskGB] = useState<number>(30);
  const [calcBackups] = useState<number>(2);
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

  const calcRamPrice = calcRamGB * 1.50;
  const calcCpuPrice = calcCpuCores * 2.00;
  const calcDiskPrice = calcDiskGB * 0.10;
  const calcBackupPrice = calcBackups * 0.50;
  const calcMonthlyTotal = calcRamPrice + calcCpuPrice + calcDiskPrice + calcBackupPrice;
  const calcYearlyTotal = calcMonthlyTotal * 12 * 0.85;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Top Header Banner */}
      <div className="surface p-5 sm:p-6 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2 tracking-tight">
            <Crown className="h-5 w-5 text-[var(--color-accent)]" /> 
            <span>Ledger & Wallet</span>
          </h1>
          <p className="text-xs text-[var(--color-ink-mute)]">
            Account credits, node billing logs, server subscriptions, and voucher redemptions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('deploy')}
            className="btn btn-ghost"
          >
            <Server className="h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
            <span>Deploy Instance</span>
          </button>
          
          <button
            onClick={() => setShowAddCreditsModal(true)}
            className="btn btn-primary"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Add Funds</span>
          </button>
        </div>
      </div>

      {/* Metrics & Wallet Balance Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 stagger">
        {/* Available Balance Card */}
        <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/50 transition-colors">
          <div className="flex justify-between items-center text-xs">
            <span className="label">Available Credits</span>
            <span className="font-medium text-[var(--color-ok)] font-mono text-[11px]">USD ($)</span>
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)] font-mono tracking-tight tabular-nums">
            ${user?.credits !== undefined ? user.credits.toFixed(2) : (stats?.credits.toFixed(2) || '0.00')}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-line)] text-[11px] text-[var(--color-ink-dim)]">
            <span>Auto-Renew Ready</span>
            <button
              onClick={() => setShowAddCreditsModal(true)}
              className="text-[var(--color-accent)] hover:underline font-medium flex items-center gap-0.5"
            >
              Add Funds <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Monthly Burn Rate */}
        <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/50 transition-colors">
          <div className="flex justify-between items-center text-xs">
            <span className="label">Monthly Burn</span>
            <Flame className="h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)] font-mono tracking-tight tabular-nums">
            ${stats?.monthlyBurnRate?.toFixed(2) || '0.00'}
            <span className="text-xs text-[var(--color-ink-mute)] font-normal ml-1">/mo</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-line)] text-[11px] text-[var(--color-ink-dim)]">
            <span>{subscriptions.length} Running Clusters</span>
            <span className="font-mono text-[var(--color-ink)]">
              {stats?.credits && stats.monthlyBurnRate > 0
                ? `~${Math.floor(stats.credits / stats.monthlyBurnRate * 30)}d runway`
                : 'Unlimited'}
            </span>
          </div>
        </div>

        {/* Active Subscriptions */}
        <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/50 transition-colors">
          <div className="flex justify-between items-center text-xs">
            <span className="label">Instances</span>
            <Server className="h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)] font-mono tracking-tight tabular-nums">
            {subscriptions.length}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-line)] text-[11px] text-[var(--color-ink-dim)]">
            <span>Active Containers</span>
            <button onClick={() => setActiveTab('subscriptions')} className="text-[var(--color-accent)] hover:underline font-medium">
              Manage
            </button>
          </div>
        </div>

        {/* Total Invoices Paid */}
        <div className="surface p-4 rounded-lg space-y-2 hover:border-[var(--color-accent)]/50 transition-colors">
          <div className="flex justify-between items-center text-xs">
            <span className="label">Invoices</span>
            <FileText className="h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)] font-mono tracking-tight tabular-nums">
            {orders.length}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-line)] text-[11px] text-[var(--color-ink-dim)]">
            <span>{orders.filter(o => o.status === 'paid').length} Paid Receipts</span>
            <button onClick={() => setActiveTab('orders')} className="text-[var(--color-accent)] hover:underline font-medium">
              Ledger
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-[var(--color-line)] pb-1.5 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: DollarSign },
          { id: 'subscriptions', label: `Servers (${subscriptions.length})`, icon: Server },
          { id: 'orders', label: `Invoices (${orders.length})`, icon: FileText },
          { id: 'calculator', label: 'Calculator', icon: Cpu },
          { id: 'vouchers', label: 'Vouchers', icon: Tag }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)] border border-[var(--color-line)]'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {renewSuccessMsg && (
        <div className="p-3 rounded-md bg-[var(--color-ok)]/10 border border-[var(--color-ok)]/30 text-[var(--color-ok)] text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{renewSuccessMsg}</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW & QUICK WALLET */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {gateways?.crypto?.enabled !== false && (
            <RealtimeTransactionTracker
              invoice={activeCryptoInvoice}
              onRefresh={fetchAllBillingData}
              onSimulateStep={handleSimulateTrackerStep}
              isSimulating={isSimulatingTracker}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {gateways?.crypto?.enabled !== false && (
                <LuxuryLtcQrCard
                  amountUsd={creditAmount}
                  walletAddress={gateways?.crypto?.ltcAddress || 'ltc1q3w4e5r6t7y8u9i0o1p2a3s4d5f6g7h8j9k0l'}
                  onLaunchProcessor={() => setShowCryptoModal(true)}
                />
              )}

              <div className="surface p-5 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Instant Account Recharge
                    </h2>
                    <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">
                      Deposit credits using Card, UPI QR, Crypto, or Bank Wire.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddCreditsModal(true)}
                    className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                  >
                    Custom Amount
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[10, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        setCreditAmount(amt);
                        setCustomAmountInput('');
                        setShowAddCreditsModal(true);
                      }}
                      className="p-3 rounded-md surface-2 border border-[var(--color-line)] hover:border-[var(--color-accent)] text-left transition-colors cursor-pointer"
                    >
                      <div className="label">Recharge</div>
                      <div className="text-lg font-bold text-[var(--color-ink)] font-mono">
                        ${amt}.00
                      </div>
                      <div className="text-[10px] text-[var(--color-ok)] mt-0.5 font-mono">
                        +${amt}.00 credits
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-3 rounded-md surface-2 border border-[var(--color-line)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-ink-dim)]">
                  <span className="label">Gateways</span>
                  <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span className="flex items-center gap-1 text-[var(--color-ink)]">
                      <CreditCard className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Visa / MC
                    </span>
                    <span className="flex items-center gap-1 text-[var(--color-ink)]">
                      <QrCode className="h-3.5 w-3.5 text-[var(--color-accent)]" /> UPI
                    </span>
                    <span className="flex items-center gap-1 text-[var(--color-ink)]">
                      <Coins className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Crypto
                    </span>
                    <span className="flex items-center gap-1 text-[var(--color-ink)]">
                      <Building className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Wire
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Orders Preview */}
              <div className="surface p-5 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
                    <ShoppingBag className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Recent Transactions
                  </h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs text-[var(--color-accent)] hover:underline font-medium"
                  >
                    View All →
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--color-ink-mute)]">
                    No transactions recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--color-line)] rounded-md border border-[var(--color-line)] overflow-hidden">
                    {orders.slice(0, 4).map((o) => (
                      <div key={o.id} className="p-3 flex items-center justify-between hover:bg-[var(--color-surface-2)] transition-colors">
                        <div className="space-y-0.5">
                          <div className="font-medium text-[var(--color-ink)] text-xs flex items-center gap-2">
                            <span>{o.planName}</span>
                            <span className="text-[var(--color-ink-mute)]">·</span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase ${
                              o.status === 'paid' ? 'text-[var(--color-ok)]' :
                              o.status === 'pending' ? 'text-[var(--color-warn)]' :
                              'text-[var(--color-err)]'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                o.status === 'paid' ? 'bg-[var(--color-ok)]' :
                                o.status === 'pending' ? 'bg-[var(--color-warn)]' :
                                'bg-[var(--color-err)]'
                              }`} />
                              {o.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--color-ink-mute)] font-mono">
                            ID: #{o.id.replace('ord_', '').slice(0, 8).toUpperCase()} / {o.paymentMethod}
                          </div>
                        </div>

                        <div className="text-right space-y-0.5">
                          <div className="font-mono font-bold text-[var(--color-ink)] text-xs tabular-nums">${o.amount.toFixed(2)}</div>
                          <button
                            onClick={() => handleOpenInvoice(o.id)}
                            className="text-[10px] text-[var(--color-accent)] hover:underline"
                          >
                            Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Promo Code Voucher Redemption & Deployment Shortlink */}
            <div className="space-y-4">
              <div className="surface p-5 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Voucher Code
                  </span>
                  <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">e.g. FREE5</span>
                </div>
                <p className="text-xs text-[var(--color-ink-dim)]">
                  Redeem promotional gift codes directly for account credits.
                </p>

                <form onSubmit={handleRedeemVoucher} className="space-y-2">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="ENTER CODE..."
                    className="field w-full px-3 py-1.5 text-xs uppercase font-mono rounded-md"
                  />
                  <button
                    type="submit"
                    disabled={isRedeemingVoucher || !voucherCode.trim()}
                    className="btn btn-primary w-full text-xs py-1.5"
                  >
                    {isRedeemingVoucher ? 'Redeeming...' : 'Redeem Voucher'}
                  </button>
                </form>

                {voucherMessage && (
                  <div className={`p-2.5 rounded-md border text-xs ${
                    voucherMessage.type === 'success' 
                      ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/30' 
                      : 'bg-[var(--color-err)]/10 text-[var(--color-err)] border-[var(--color-err)]/30'
                  }`}>
                    {voucherMessage.text}
                  </div>
                )}
              </div>

              <div className="surface p-5 rounded-lg space-y-2">
                <h3 className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Launch Next Server
                </h3>
                <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
                  Deploy Paper, Purpur, Fabric, Node.js, or Bun servers with instant port binding.
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => onNavigate('deploy')}
                    className="btn btn-primary w-full text-xs py-1.5"
                  >
                    Open Server Provisioner →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
              <Server className="h-4 w-4 text-[var(--color-accent)]" /> Active Subscriptions ({subscriptions.length})
            </h2>
            <button
              onClick={() => onNavigate('deploy')}
              className="btn btn-primary text-xs py-1.5"
            >
              + Add Server
            </button>
          </div>

          {subscriptions.length === 0 ? (
            <div className="surface p-10 text-center rounded-lg space-y-2">
              <Server className="h-8 w-8 text-[var(--color-ink-mute)] mx-auto" />
              <div className="text-sm font-semibold text-[var(--color-ink)]">No Active Servers</div>
              <p className="text-xs text-[var(--color-ink-mute)] max-w-sm mx-auto">
                You haven't provisioned any Minecraft or Bot servers yet.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => onNavigate('deploy')}
                  className="btn btn-primary"
                >
                  Deploy First Server
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subscriptions.map((sub) => (
                <div key={sub.serverId} className="surface p-4 rounded-lg flex flex-col justify-between space-y-3">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-[var(--color-ink)] truncate">{sub.serverName}</div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase ${
                        sub.status === 'active' ? 'text-[var(--color-ok)]' : 'text-[var(--color-ink-mute)]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          sub.status === 'active' ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-ink-mute)]'
                        }`} />
                        {sub.status}
                      </span>
                    </div>

                    <div className="p-3 rounded-md surface-2 border border-[var(--color-line)] space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-[var(--color-ink-dim)]">
                        <span>Plan Tier:</span>
                        <span className="text-[var(--color-ink)] font-semibold">{sub.planName}</span>
                      </div>
                      <div className="flex justify-between items-center text-[var(--color-ink-dim)]">
                        <span>Runtime:</span>
                        <span className="font-mono text-[var(--color-accent)]">{sub.software} {sub.version}</span>
                      </div>
                      <div className="flex justify-between items-center text-[var(--color-ink-dim)]">
                        <span>Monthly Cost:</span>
                        {sub.priceMonthly === 0 ? (
                          <span className="text-[var(--color-ok)] font-mono font-medium">FREE</span>
                        ) : (
                          <span className="text-[var(--color-ink)] font-mono font-semibold">${sub.priceMonthly.toFixed(2)}/mo</span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-[var(--color-ink-dim)] flex items-center justify-between font-mono">
                      <span className="flex items-center gap-1 text-[var(--color-ink-mute)]">
                        <Clock className="h-3 w-3" /> Next Renewal:
                      </span>
                      <span>{new Date(sub.nextRenewalAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--color-line)] flex items-center gap-2">
                    <button
                      onClick={() => onNavigate('server-manage', { serverId: sub.serverId })}
                      className="btn btn-ghost flex-1 text-xs py-1"
                    >
                      Manage
                    </button>
                    <button
                      onClick={() => handleRenewServer(sub.serverId, sub.serverName)}
                      disabled={renewingServerId === sub.serverId}
                      className="btn btn-primary flex-1 text-xs py-1"
                    >
                      {renewingServerId === sub.serverId ? 'Renewing...' : 'Renew'}
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
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-[var(--color-accent)]" /> Invoices & Ledger
            </h2>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-[var(--color-ink-mute)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search invoice..."
                  className="field pl-8 pr-3 py-1.5 text-xs rounded-md"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="field px-2.5 py-1.5 text-xs rounded-md"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="surface p-10 text-center rounded-lg space-y-2">
              <RefreshCw className="h-5 w-5 animate-spin text-[var(--color-accent)] mx-auto" />
              <p className="text-xs text-[var(--color-ink-dim)]">Loading records...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="surface p-10 text-center rounded-lg text-xs text-[var(--color-ink-mute)]">
              No matching transactions or receipts found.
            </div>
          ) : (
            <div className="surface rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="surface-2 border-b border-[var(--color-line)] text-[var(--color-ink-mute)] label">
                  <tr>
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-[var(--color-surface-2)] transition-colors">
                      <td className="p-3 font-mono text-[var(--color-accent)]">
                        #{o.id.replace('ord_', '').slice(0, 8)}
                      </td>
                      <td className="p-3 font-medium text-[var(--color-ink)]">{o.planName}</td>
                      <td className="p-3 font-mono font-semibold text-[var(--color-ink)]">${o.amount.toFixed(2)}</td>
                      <td className="p-3 text-[var(--color-ink-dim)]">{o.paymentMethod}</td>
                      <td className="p-3 font-mono text-[var(--color-ink-mute)]">{o.transactionRef || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono border capitalize ${
                          o.status === 'paid' ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/30' :
                          o.status === 'pending' ? 'bg-[var(--color-warn)]/10 text-[var(--color-warn)] border-[var(--color-warn)]/30' :
                          'bg-[var(--color-err)]/10 text-[var(--color-err)] border-[var(--color-err)]/30'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3 text-[var(--color-ink-mute)] font-mono text-[11px]">{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenInvoice(o.id)}
                          className="btn btn-ghost text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 surface p-5 sm:p-6 rounded-lg space-y-5">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[var(--color-accent)]" /> Resource Cost Calculator
              </h2>
              <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">
                Adjust RAM, vCPU cores, and NVMe storage specs to preview estimated costs.
              </p>
            </div>

            {/* RAM Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-[var(--color-ink)] flex items-center gap-1.5">
                  <MemoryStick className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Memory (RAM)
                </span>
                <span className="font-mono font-bold text-[var(--color-accent)]">{calcRamGB} GB RAM (${calcRamPrice.toFixed(2)}/mo)</span>
              </div>
              <input
                type="range"
                min="1"
                max="32"
                step="1"
                value={calcRamGB}
                onChange={(e) => setCalcRamGB(parseInt(e.target.value, 10))}
                className="w-full accent-[var(--color-accent)] bg-[var(--color-surface-2)] h-1.5 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--color-ink-mute)] font-mono">
                <span>1 GB</span>
                <span>8 GB</span>
                <span>32 GB</span>
              </div>
            </div>

            {/* CPU Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-[var(--color-ink)] flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-[var(--color-accent)]" /> vCPU Compute Threads
                </span>
                <span className="font-mono font-bold text-[var(--color-accent)]">{calcCpuCores} vCPU (${calcCpuPrice.toFixed(2)}/mo)</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={calcCpuCores}
                onChange={(e) => setCalcCpuCores(parseInt(e.target.value, 10))}
                className="w-full accent-[var(--color-accent)] bg-[var(--color-surface-2)] h-1.5 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--color-ink-mute)] font-mono">
                <span>1 Core</span>
                <span>4 Cores</span>
                <span>8 Cores</span>
              </div>
            </div>

            {/* NVMe Disk Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-[var(--color-ink)] flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-[var(--color-accent)]" /> NVMe Storage
                </span>
                <span className="font-mono font-bold text-[var(--color-accent)]">{calcDiskGB} GB SSD (${calcDiskPrice.toFixed(2)}/mo)</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="5"
                value={calcDiskGB}
                onChange={(e) => setCalcDiskGB(parseInt(e.target.value, 10))}
                className="w-full accent-[var(--color-accent)] bg-[var(--color-surface-2)] h-1.5 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--color-ink-mute)] font-mono">
                <span>10 GB</span>
                <span>100 GB</span>
                <span>200 GB</span>
              </div>
            </div>
          </div>

          {/* Pricing Preview Summary Card */}
          <div className="surface p-5 rounded-lg space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--color-ink)] label">Summary</h3>

              <div className="grid grid-cols-2 gap-1.5 surface-2 p-1 rounded-md border border-[var(--color-line)]">
                <button
                  onClick={() => setCalcBillingCycle('monthly')}
                  className={`py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
                    calcBillingCycle === 'monthly' ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)]' : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setCalcBillingCycle('yearly')}
                  className={`py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
                    calcBillingCycle === 'yearly' ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)]' : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  Yearly (-15%)
                </button>
              </div>

              <div className="space-y-1.5 text-xs border-t border-b border-[var(--color-line)] py-3">
                <div className="flex justify-between text-[var(--color-ink-dim)]">
                  <span>RAM ({calcRamGB} GB):</span>
                  <span className="text-[var(--color-ink)] font-mono">${calcRamPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[var(--color-ink-dim)]">
                  <span>CPU ({calcCpuCores} vCPU):</span>
                  <span className="text-[var(--color-ink)] font-mono">${calcCpuPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[var(--color-ink-dim)]">
                  <span>Storage ({calcDiskGB} GB):</span>
                  <span className="text-[var(--color-ink)] font-mono">${calcDiskPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[var(--color-ink-dim)]">
                  <span>Backups (2 slots):</span>
                  <span className="text-[var(--color-ink)] font-mono">$1.00</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="label">Estimated Rate</div>
                <div className="text-2xl font-bold text-[var(--color-ok)] font-mono">
                  ${calcBillingCycle === 'yearly' ? calcYearlyTotal.toFixed(2) : calcMonthlyTotal.toFixed(2)}
                  <span className="text-xs text-[var(--color-ink-mute)] font-sans font-normal ml-1">
                    /{calcBillingCycle === 'yearly' ? 'yr' : 'mo'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('deploy')}
              className="btn btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
            >
              <span>Deploy with these Specs</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: PROMO & VOUCHERS */}
      {activeTab === 'vouchers' && (
        <div className="space-y-4">
          <div className="surface p-5 rounded-lg space-y-3">
            <h2 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
              <Tag className="h-4 w-4 text-[var(--color-accent)]" /> Promotional Vouchers
            </h2>
            <p className="text-xs text-[var(--color-ink-mute)]">
              Enter promotional discount vouchers or gift codes to claim credits.
            </p>

            <form onSubmit={handleRedeemVoucher} className="flex gap-2 max-w-md">
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE..."
                className="field flex-1 px-3 py-1.5 text-xs uppercase font-mono rounded-md"
              />
              <button
                type="submit"
                disabled={isRedeemingVoucher || !voucherCode.trim()}
                className="btn btn-primary text-xs py-1.5 px-4 shrink-0"
              >
                {isRedeemingVoucher ? 'Redeeming...' : 'Apply Code'}
              </button>
            </form>

            {voucherMessage && (
              <div className={`p-2.5 rounded-md border text-xs max-w-md ${
                voucherMessage.type === 'success' ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/30 font-medium' : 'bg-[var(--color-err)]/10 text-[var(--color-err)] border-[var(--color-err)]/30'
              }`}>
                {voucherMessage.text}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="surface p-4 rounded-lg space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-md border border-[var(--color-accent)]/20">
                  WELCOME20
                </span>
                <span className="text-[11px] text-[var(--color-ok)] font-medium">20% OFF</span>
              </div>
              <p className="text-xs text-[var(--color-ink)] font-medium">20% Off Server Deployment</p>
              <p className="text-[11px] text-[var(--color-ink-mute)]">Apply during deploy wizard checkout.</p>
            </div>

            <div className="surface p-4 rounded-lg space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-md border border-[var(--color-accent)]/20">
                  FREE5
                </span>
                <span className="text-[11px] text-[var(--color-ok)] font-medium">+$5.00</span>
              </div>
              <p className="text-xs text-[var(--color-ink)] font-medium">$5.00 Starter Credit</p>
              <p className="text-[11px] text-[var(--color-ink-mute)]">Instant $5 deposit for new user testing.</p>
            </div>

            <div className="surface p-4 rounded-lg space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-md border border-[var(--color-accent)]/20">
                  DEVGIFT
                </span>
                <span className="text-[11px] text-[var(--color-ok)] font-medium">+$15.00</span>
              </div>
              <p className="text-xs text-[var(--color-ink)] font-medium">Developer Community Gift</p>
              <p className="text-[11px] text-[var(--color-ink-mute)]">Claim $15 credits for running bots & nodes.</p>
            </div>
          </div>
        </div>
      )}

      {/* ADD CREDITS / DEPOSIT MODAL */}
      {showAddCreditsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 anim-fade-in">
          <div className="w-full max-w-lg surface p-5 sm:p-6 rounded-lg space-y-4 max-h-[90vh] overflow-y-auto anim-scale-in">
            <div className="flex justify-between items-center border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
                <Coins className="h-4 w-4 text-[var(--color-accent)]" /> Deposit Account Credits
              </h3>
              <button onClick={() => setShowAddCreditsModal(false)} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label block mb-1.5">1. Select Deposit Amount</label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[10, 25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setCreditAmount(amt);
                      setCustomAmountInput('');
                    }}
                    className={`p-2.5 rounded-md font-mono text-xs font-bold transition-colors border cursor-pointer ${
                      creditAmount === amt && !customAmountInput
                        ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)] border-[var(--color-accent)]'
                        : 'surface-2 border-[var(--color-line)] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
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
                placeholder="Or custom amount in USD ($)..."
                className="field w-full px-3 py-1.5 text-xs font-mono rounded-md"
              />
            </div>

            <div>
              <label className="label block mb-1.5">2. Select Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {gateways?.stripe?.enabled !== false && (
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('stripe')}
                    className={`p-2.5 rounded-md border flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                      selectedMethod === 'stripe' ? 'border-[var(--color-accent)] bg-[var(--color-surface-3)] text-[var(--color-ink)]' : 'border-[var(--color-line)] surface-2 text-[var(--color-ink-dim)]'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-[var(--color-accent)]" />
                    <span className="text-[11px]">Card</span>
                  </button>
                )}

                {gateways?.upi?.enabled !== false && (
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('upi')}
                    className={`p-2.5 rounded-md border flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                      selectedMethod === 'upi' ? 'border-[var(--color-accent)] bg-[var(--color-surface-3)] text-[var(--color-ink)]' : 'border-[var(--color-line)] surface-2 text-[var(--color-ink-dim)]'
                    }`}
                  >
                    <QrCode className="h-4 w-4 text-[var(--color-accent)]" />
                    <span className="text-[11px]">UPI / QR</span>
                  </button>
                )}

                {gateways?.crypto?.enabled !== false && (
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('crypto')}
                    className={`p-2.5 rounded-md border flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                      selectedMethod === 'crypto' ? 'border-[var(--color-accent)] bg-[var(--color-surface-3)] text-[var(--color-ink)]' : 'border-[var(--color-line)] surface-2 text-[var(--color-ink-dim)]'
                    }`}
                  >
                    <Coins className="h-4 w-4 text-[var(--color-accent)]" />
                    <span className="text-[11px]">Crypto</span>
                  </button>
                )}
              </div>
            </div>

            {selectedMethod === 'stripe' && (
              <div className="surface-2 p-3.5 rounded-md border border-[var(--color-line)] space-y-2 text-xs">
                <div className="flex justify-between text-[var(--color-ink-dim)]">
                  <span>Deposit Amount:</span>
                  <strong className="text-[var(--color-ink)] font-mono text-sm">${(customAmountInput ? parseFloat(customAmountInput) || 0 : creditAmount).toFixed(2)}</strong>
                </div>
                <div className="flex items-center gap-2 text-[var(--color-ink-mute)] text-[11px]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-ok)]" />
                  <span>Instant processing directly credited to account balance.</span>
                </div>
              </div>
            )}

            {selectedMethod === 'upi' && (
              <div className="space-y-3">
                <div className="surface-2 p-3.5 rounded-md border border-[var(--color-line)] text-center space-y-2">
                  <div className="text-xs font-medium text-[var(--color-ink)]">Scan UPI QR Code via GPay, PhonePe, Paytm, or BHIM</div>
                  <img
                    src={gateways?.upi?.qrCodeUrl || "https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=400&q=80"}
                    alt="UPI QR Code"
                    className="h-36 w-36 object-cover mx-auto rounded-md border border-[var(--color-line)]"
                  />
                  <div className="flex items-center justify-center gap-2 bg-[var(--color-surface)] py-1.5 px-3 rounded-md border border-[var(--color-line)]">
                    <span className="text-xs font-mono text-[var(--color-accent)]">
                      {gateways?.upi?.upiId || 'aetherpay@okaxis'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(gateways?.upi?.upiId || 'aetherpay@okaxis', 'upi')}
                      className="text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
                    >
                      {copiedText === 'upi' ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-ok)]" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedMethod === 'crypto' && (
              <div className="surface-2 p-3.5 rounded-md border border-[var(--color-line)] space-y-2.5 text-xs">
                <div>
                  <label className="label block mb-1">Select Cryptocurrency</label>
                  <div className="grid grid-cols-5 gap-1">
                    {(['LTC', 'USDT', 'BTC', 'ETH', 'SOL'] as const).map((coin) => (
                      <button
                        key={coin}
                        type="button"
                        onClick={() => setSelectedCryptoCoin(coin)}
                        className={`p-1.5 rounded-md text-xs font-mono transition-colors border cursor-pointer ${
                          selectedCryptoCoin === coin
                            ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)] border-[var(--color-accent)] font-semibold'
                            : 'surface border-[var(--color-line)] text-[var(--color-ink-dim)]'
                        }`}
                      >
                        {coin}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 rounded-md surface border border-[var(--color-line)] space-y-1.5">
                  <div className="flex justify-between items-center text-[var(--color-ink-dim)] text-[11px]">
                    <span>Deposit Address ({selectedCryptoCoin}):</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[var(--color-accent)] surface-2 p-2 rounded border border-[var(--color-line)] break-all">
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
                      className="text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] shrink-0"
                    >
                      {copiedText === 'crypto' ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-ok)]" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {paymentMsg && (
              <div className={`p-2.5 rounded-md border text-xs ${
                paymentMsg.type === 'success' ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/30' : 'bg-[var(--color-err)]/10 text-[var(--color-err)] border-[var(--color-err)]/30'
              }`}>
                {paymentMsg.text}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-line)]">
              <button
                type="button"
                onClick={() => setShowAddCreditsModal(false)}
                className="btn btn-ghost text-xs py-1.5"
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
                  className="btn btn-primary text-xs py-1.5 flex items-center gap-1.5"
                >
                  <Coins className="h-3.5 w-3.5" />
                  Launch Crypto Gateway
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddCredits}
                  disabled={isProcessingPayment}
                  className="btn btn-primary text-xs py-1.5"
                >
                  {isProcessingPayment ? 'Processing...' : `Deposit $${(customAmountInput ? parseFloat(customAmountInput) || 0 : creditAmount).toFixed(2)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 anim-fade-in">
          <div className="w-full max-w-xl surface p-6 rounded-lg space-y-5 max-h-[90vh] overflow-y-auto anim-scale-in">
            <div className="flex justify-between items-center border-b border-[var(--color-line)] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--color-accent)]" />
                <span className="font-mono text-sm font-semibold text-[var(--color-ink)]">{viewInvoice.invoiceNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-ghost text-xs py-1 px-2.5 inline-flex items-center gap-1"
                >
                  <Printer className="h-3 w-3" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setViewInvoice(null)}
                  className="btn-icon"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs text-[var(--color-ink-dim)]">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-[var(--color-ink)]">{viewInvoice.company.name}</div>
                  <div>{viewInvoice.company.address}</div>
                  <div>{viewInvoice.company.city}, {viewInvoice.company.country}</div>
                  <div className="text-[var(--color-ink-mute)] font-mono mt-0.5">Tax ID: {viewInvoice.company.taxId}</div>
                </div>

                <div className="sm:text-right space-y-1">
                  <div className="font-mono text-sm font-semibold text-[var(--color-ink)]">{viewInvoice.invoiceNumber}</div>
                  <div className="text-[var(--color-ink-mute)] font-mono">Date: {new Date(viewInvoice.date).toLocaleDateString()}</div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono border uppercase ${
                      viewInvoice.status === 'paid' ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/30' : 'bg-[var(--color-warn)]/10 text-[var(--color-warn)] border-[var(--color-warn)]/30'
                    }`}>
                      {viewInvoice.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-md surface-2 border border-[var(--color-line)] space-y-0.5">
                <div className="label">Billed To</div>
                <div className="text-xs font-semibold text-[var(--color-ink)]">{viewInvoice.customer.name}</div>
                <div className="font-mono text-[var(--color-ink-mute)]">{viewInvoice.customer.email}</div>
              </div>

              <div className="rounded-md border border-[var(--color-line)] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="surface-2 border-b border-[var(--color-line)] label">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5">Cycle</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Price</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)] font-mono">
                    {viewInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-sans font-medium text-[var(--color-ink)]">{item.description}</td>
                        <td className="p-2.5 capitalize text-[var(--color-ink-dim)]">{item.billingCycle}</td>
                        <td className="p-2.5 text-right text-[var(--color-ink-dim)]">{item.quantity}</td>
                        <td className="p-2.5 text-right text-[var(--color-ink-dim)]">${item.unitPrice.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-semibold text-[var(--color-ink)]">${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-48 space-y-1 font-mono text-xs">
                  <div className="flex justify-between text-[var(--color-ink-dim)]">
                    <span>Subtotal:</span>
                    <span>${viewInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-ink-dim)]">
                    <span>Tax:</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[var(--color-ink)] pt-1.5 border-t border-[var(--color-line)]">
                    <span>Total:</span>
                    <span className="text-[var(--color-ok)]">${viewInvoice.total.toFixed(2)} USD</span>
                  </div>
                </div>
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
