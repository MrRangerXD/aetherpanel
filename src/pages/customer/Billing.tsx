import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Tag, Check, RefreshCw, PlusCircle, ArrowUpRight, ShieldCheck, ShoppingBag, QrCode, Building, Copy, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Order, PaymentGatewaySettings } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

interface BillingProps {
  onNavigate: (page: string, params?: any) => void;
}

export const Billing: React.FC<BillingProps> = ({ onNavigate }) => {
  const { user, refreshUser } = useAuth();
  const { accentClasses } = useTheme();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState<number>(25);
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'bank' | 'stripe'>('upi');
  const [transactionRef, setTransactionRef] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Payment gateways state from server
  const [gateways, setGateways] = useState<PaymentGatewaySettings | null>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBillingHistory = async () => {
    const res = await apiRequest('/billing/orders');
    if (res.success && res.data) {
      setOrders(res.data);
    }
    setLoading(false);
  };

  const fetchPaymentGateways = async () => {
    const res = await apiRequest('/billing/payment-methods');
    if (res.success && res.data) {
      setGateways(res.data);
    }
  };

  useEffect(() => {
    fetchBillingHistory();
    fetchPaymentGateways();
  }, []);

  const handleAddCredits = async () => {
    setIsProcessingPayment(true);
    setPaymentMsg(null);

    const res = await apiRequest('/billing/add-credits', {
      method: 'POST',
      body: JSON.stringify({
        amount: creditAmount,
        paymentMethod: selectedMethod === 'upi' ? 'UPI / QR Code' : selectedMethod === 'bank' ? 'Bank Transfer' : 'Stripe / Card',
        transactionRef: ['upi', 'bank'].includes(selectedMethod) ? transactionRef.trim() : undefined
      })
    });

    if (res.success) {
      await refreshUser();
      fetchBillingHistory();
      setPaymentMsg({ type: 'success', text: res.message || 'Payment request processed!' });
      setTransactionRef('');
      setTimeout(() => {
        setShowAddCreditsModal(false);
        setPaymentMsg(null);
      }, 2500);
    } else {
      setPaymentMsg({ type: 'error', text: res.error?.message || 'Payment failed to submit.' });
    }
    setIsProcessingPayment(false);
  };

  const handleCopyUpi = () => {
    if (gateways?.upi?.upiId) {
      navigator.clipboard.writeText(gateways.upi.upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponMessage(null);
    const res = await apiRequest('/billing/redeem-coupon', {
      method: 'POST',
      body: JSON.stringify({ code: couponCode.trim() })
    });

    if (res.success) {
      setCouponMessage({ type: 'success', text: res.data.message || 'Coupon redeemed successfully!' });
      setCouponCode('');
      await refreshUser();
      fetchBillingHistory();
    } else {
      setCouponMessage({ type: 'error', text: res.error?.message || 'Invalid or expired coupon code.' });
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing & Credit Balance</h1>
          <p className="text-xs text-zinc-400 mt-1">Manage platform balance, QR code payments, invoices, and promo codes.</p>
        </div>

        <button
          onClick={() => setShowAddCreditsModal(true)}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md flex items-center gap-2 hover:opacity-95 transition-all`}
        >
          <PlusCircle className="h-4 w-4" /> Add Account Credits
        </button>
      </div>

      {/* Account Credit Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-3 relative overflow-hidden">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Available Credits</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            ${user?.credits?.toFixed(2) || '0.00'}
          </div>
          <p className="text-[11px] text-zinc-500">Credits automatically deduct when servers renew monthly.</p>
        </div>

        {/* Promo Coupon Card */}
        <div className="md:col-span-2 p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span className="flex items-center gap-1.5 font-semibold text-white">
              <Tag className="h-4 w-4 text-violet-400" /> Redeem Promo / Voucher Code
            </span>
            <span className="text-[11px] text-violet-400 font-mono">e.g. AETHER2025</span>
          </div>

          <form onSubmit={handleRedeemCoupon} className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Enter promo or coupon code..."
              className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white uppercase font-mono placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shrink-0"
            >
              Apply Code
            </button>
          </form>

          {couponMessage && (
            <p className={`text-xs ${couponMessage.type === 'success' ? 'text-emerald-400 font-semibold' : 'text-rose-400'}`}>
              {couponMessage.text}
            </p>
          )}
        </div>
      </div>

      {/* Transaction & Order History Table */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-violet-400" /> Order & Payment History
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-400 space-y-2">
            <RefreshCw className="h-5 w-5 animate-spin text-violet-400 mx-auto" />
            <p>Loading invoice records...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl text-xs text-zinc-400">
            No transactions found yet.
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                <tr>
                  <th className="p-3.5">Order ID</th>
                  <th className="p-3.5">Item / Plan</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Payment Method</th>
                  <th className="p-3.5">Transaction Ref / UTR</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-900 transition-colors">
                    <td className="p-3.5 font-mono text-violet-400 font-semibold">#{o.id.slice(0, 8)}</td>
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
                    <td className="p-3.5 text-right text-zinc-500">{o.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Credits Modal with QR Code & Payment Methods */}
      {showAddCreditsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-violet-400" /> Deposit Account Credits
              </h3>
              <button onClick={() => setShowAddCreditsModal(false)} className="text-xs text-zinc-400 hover:text-white">✕</button>
            </div>

            {/* Select Deposit Amount */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">1. Select Deposit Amount</label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCreditAmount(amt)}
                    className={`p-3 rounded-2xl font-mono text-sm font-bold transition-all border ${
                      creditAmount === amt
                        ? 'bg-violet-600 border-violet-500 text-white shadow-lg'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Select Payment Gateway */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">2. Select Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedMethod('upi')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                    selectedMethod === 'upi' ? 'border-violet-500 bg-violet-500/10 text-white font-bold' : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <QrCode className="h-5 w-5 text-violet-400" />
                  <span className="text-xs">UPI / QR Scan</span>
                </button>

                <button
                  onClick={() => setSelectedMethod('bank')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                    selectedMethod === 'bank' ? 'border-emerald-500 bg-emerald-500/10 text-white font-bold' : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <Building className="h-5 w-5 text-emerald-400" />
                  <span className="text-xs">Bank Transfer</span>
                </button>

                <button
                  onClick={() => setSelectedMethod('stripe')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                    selectedMethod === 'stripe' ? 'border-cyan-500 bg-cyan-500/10 text-white font-bold' : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <CreditCard className="h-5 w-5 text-cyan-400" />
                  <span className="text-xs">Instant Card</span>
                </button>
              </div>
            </div>

            {/* METHOD DETAILS */}
            {selectedMethod === 'upi' && gateways?.upi && (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="text-center space-y-2">
                  <div className="text-xs font-bold text-white">Scan QR Code using PhonePe, Paytm, GPay or BHIM</div>
                  {gateways.upi.qrCodeUrl ? (
                    <img src={gateways.upi.qrCodeUrl} alt="UPI QR Code" className="h-44 w-44 object-cover mx-auto rounded-2xl border border-zinc-700 shadow-xl" />
                  ) : (
                    <div className="h-44 w-44 bg-zinc-950 border border-zinc-800 rounded-2xl mx-auto flex items-center justify-center text-xs text-zinc-500">QR Code Image</div>
                  )}
                  <div className="flex items-center justify-center gap-2 bg-zinc-950 py-2 px-3 rounded-xl border border-zinc-800">
                    <span className="text-xs font-mono text-violet-400 font-bold">{gateways.upi.upiId}</span>
                    <button onClick={handleCopyUpi} className="text-zinc-400 hover:text-white">
                      {copiedUpi ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">{gateways.upi.instructions}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-400 mb-1">Enter 12-Digit UTR / Transaction Ref ID *</label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. 402198273615"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white font-mono focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {selectedMethod === 'bank' && gateways?.bank && (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs">
                <div className="space-y-1 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <div className="text-zinc-400">Bank: <strong className="text-white">{gateways.bank.bankName}</strong></div>
                  <div className="text-zinc-400">Account No: <strong className="text-emerald-400 font-mono">{gateways.bank.accountNumber}</strong></div>
                  <div className="text-zinc-400">IFSC / SWIFT: <strong className="text-white font-mono">{gateways.bank.ifsc}</strong></div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-400 mb-1">Enter Bank Reference / NEFT Number *</label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. NEFT1293810293"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white font-mono focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {selectedMethod === 'stripe' && (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Instant Credit Amount:</span>
                  <strong className="text-white">${creditAmount.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Processing Gateway:</span>
                  <strong className="text-cyan-400">Stripe Card Verification</strong>
                </div>
              </div>
            )}

            {paymentMsg && (
              <p className={`text-xs p-3 rounded-xl border font-semibold ${
                paymentMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {paymentMsg.text}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddCreditsModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCredits}
                disabled={isProcessingPayment || (['upi', 'bank'].includes(selectedMethod) && !transactionRef.trim())}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-md disabled:opacity-50"
              >
                {isProcessingPayment ? 'Submitting...' : selectedMethod === 'stripe' ? `Pay $${creditAmount.toFixed(2)}` : 'Submit for Verification'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

