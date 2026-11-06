import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag, Plus, Trash2, Check, X, RefreshCw, Power, Search, Filter,
  Percent, DollarSign, CheckCircle2, Sparkles, Copy, BarChart3, Clock
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Coupon } from '../../types';

export const AdminCoupons: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'percent' | 'fixed'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');

  // New Coupon Modal
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState(20);
  const [usageLimit, setUsageLimit] = useState<number | ''>('');

  // Toast feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    showToast('success', `Coupon '${text}' copied to clipboard`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const fetchCoupons = async () => {
    setLoading(true);
    const res = await apiRequest('/admin/coupons');
    if (res.success && res.data) {
      setCoupons(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  // Filtered coupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      const matchesSearch = c.code.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesType = typeFilter === 'all' || c.discountType === typeFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && c.isActive) ||
        (statusFilter === 'disabled' && !c.isActive);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [coupons, searchQuery, typeFilter, statusFilter]);

  // Analytics Metrics
  const metrics = useMemo(() => {
    const total = coupons.length;
    const activeCount = coupons.filter((c) => c.isActive).length;
    const totalRedemptions = coupons.reduce((acc, c) => acc + (c.timesUsed || 0), 0);
    const avgDiscount = total > 0 ? Math.round(coupons.reduce((acc, c) => acc + (c.discountValue || 0), 0) / total) : 0;
    return { total, activeCount, totalRedemptions, avgDiscount };
  }, [coupons]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    const res = await apiRequest('/admin/coupons/create', {
      method: 'POST',
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        usageLimit: usageLimit ? Number(usageLimit) : undefined
      })
    });

    if (res.success) {
      showToast('success', res.message || 'Promo coupon created successfully');
      setCode('');
      setDiscountValue(20);
      setUsageLimit('');
      setShowModal(false);
      fetchCoupons();
    } else {
      showToast('error', res.error?.message || 'Failed to create coupon');
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Are you sure you want to delete coupon '${coupon.code}'?`)) return;

    const res = await apiRequest(`/admin/coupons/${coupon.id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('success', `Coupon '${coupon.code}' deleted`);
      fetchCoupons();
    } else {
      showToast('error', res.error?.message || 'Failed to delete coupon');
    }
  };

  const handleToggleCoupon = async (coupon: Coupon) => {
    const res = await apiRequest(`/admin/coupons/${coupon.id}/toggle`, { method: 'PATCH' });
    if (res.success) {
      showToast('success', res.message || `Coupon ${coupon.code} updated`);
      fetchCoupons();
    } else {
      showToast('error', res.error?.message || 'Failed to toggle coupon');
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#23252e] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#f97316]/10 border border-[#f97316]/30 flex items-center justify-center text-[#f97316]">
              <Tag className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Promotional Coupons & Vouchers
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Create and monitor dynamic discount codes, usage limits, and redemption vouchers across all customer plans.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCoupons}
            className="p-2.5 rounded-xl bg-[#14151b] border border-[#23252e] hover:bg-[#1a1b24] text-neutral-300 transition-all shrink-0 cursor-pointer"
            title="Refresh Coupons"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-[#f97316]' : ''}`} />
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#f97316]/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create Promo Code
          </button>
        </div>
      </div>

      {/* Analytics Overview Cards (Full Width) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#14151b] border border-[#23252e] space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
            <span>TOTAL PROMOS</span>
            <Tag className="h-4 w-4 text-[#f97316]" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics.total}</div>
          <div className="text-[11px] text-neutral-500">
            <span className="text-emerald-400 font-semibold">{metrics.activeCount} active</span> campaigns
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#14151b] border border-[#23252e] space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
            <span>TOTAL REDEMPTIONS</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics.totalRedemptions}</div>
          <div className="text-[11px] text-neutral-500">Lifetime voucher checkouts</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#14151b] border border-[#23252e] space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
            <span>AVG DISCOUNT</span>
            <Percent className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics.avgDiscount}%</div>
          <div className="text-[11px] text-neutral-500">Average savings per promo</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#14151b] border border-[#23252e] space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
            <span>CAMPAIGN HEALTH</span>
            <Sparkles className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">Active</div>
          <div className="text-[11px] text-neutral-500">Checkout discount engine ready</div>
        </div>
      </div>

      {/* Search, Filter & Quick Toolbar */}
      <div className="p-4 rounded-2xl bg-[#14151b] border border-[#23252e] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search promo codes (e.g. WELCOME20, AETHER50)..."
            className="w-full bg-[#0c0d12] border border-[#23252e] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#f97316]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e: any) => setTypeFilter(e.target.value)}
            className="bg-[#0c0d12] border border-[#23252e] rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-[#f97316] cursor-pointer"
          >
            <option value="all">All Discount Types</option>
            <option value="percent">Percentage Only (%)</option>
            <option value="fixed">Fixed Balance ($)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="bg-[#0c0d12] border border-[#23252e] rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-[#f97316] cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled Only</option>
          </select>
        </div>
      </div>

      {/* Main Table / Data Grid (Expansive & Responsive) */}
      {loading ? (
        <div className="p-16 text-center rounded-2xl bg-[#14151b] border border-[#23252e] space-y-3">
          <RefreshCw className="h-8 w-8 text-[#f97316] animate-spin mx-auto" />
          <div className="text-xs text-neutral-400">Loading coupons and promotional vouchers...</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#23252e] bg-[#14151b] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0c0d12] border-b border-[#23252e] text-neutral-400 font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">PROMO CODE</th>
                  <th className="py-3 px-4">DISCOUNT RATE</th>
                  <th className="py-3 px-4">USAGE / LIMIT</th>
                  <th className="py-3 px-4">PROGRESS</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#23252e]">
                {filteredCoupons.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-neutral-500">
                      <Tag className="h-8 w-8 mx-auto mb-2 text-neutral-600 opacity-60" />
                      <p className="text-sm font-semibold text-neutral-300">No promo coupons match your criteria.</p>
                      <p className="text-xs text-neutral-500 mt-1">Try resetting the filter or click "Create Promo Code".</p>
                    </td>
                  </tr>
                ) : (
                  filteredCoupons.map((c) => {
                    const usagePct = c.usageLimit && c.usageLimit > 0
                      ? Math.min(100, Math.round((c.timesUsed / c.usageLimit) * 100))
                      : null;

                    return (
                      <tr key={c.id} className="hover:bg-[#181922] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-amber-400 font-bold uppercase text-sm tracking-wider">
                              {c.code}
                            </span>
                            <button
                              onClick={() => copyToClipboard(c.code)}
                              className="p-1 rounded text-neutral-500 hover:text-white transition-colors cursor-pointer"
                              title="Copy code"
                            >
                              {copiedCode === c.code ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {c.discountType === 'percent' ? `${c.discountValue}% OFF` : `$${c.discountValue.toFixed(2)} CREDITS`}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-neutral-300 font-mono">
                          {c.timesUsed} / {c.usageLimit ? `${c.usageLimit} max` : '∞ unlimited'}
                        </td>

                        <td className="py-3.5 px-4 min-w-[120px]">
                          {usagePct !== null ? (
                            <div className="space-y-1">
                              <div className="w-full bg-[#0c0d12] h-1.5 rounded-full overflow-hidden border border-[#23252e]">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    usagePct > 90 ? 'bg-rose-500' : usagePct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${usagePct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-neutral-500 font-mono">{usagePct}% redeemed</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-500 font-mono">No Cap</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border font-semibold ${
                              c.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                            }`}
                          >
                            {c.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleCoupon(c)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                                c.isActive
                                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              {c.isActive ? 'Disable' : 'Enable'}
                            </button>

                            <button
                              onClick={() => handleDeleteCoupon(c)}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
                              title="Delete Coupon"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Coupon Modal with Orihost Styling */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCoupon}
            className="w-full max-w-md bg-[#0c0d12] border border-[#23252e] p-6 rounded-2xl space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-[#23252e] pb-3">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-[#f97316]" />
                <h3 className="text-base font-bold text-white">Create Promo Code</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-500 hover:text-neutral-300 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Coupon Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. WELCOME20, AETHER50"
                className="w-full rounded-xl bg-[#14151b] border border-[#23252e] p-2.5 text-xs text-white uppercase font-mono focus:outline-none focus:border-[#f97316]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Discount Type</label>
                <select
                  value={discountType}
                  onChange={(e: any) => setDiscountType(e.target.value)}
                  className="w-full rounded-xl bg-[#14151b] border border-[#23252e] p-2.5 text-xs text-white focus:outline-none focus:border-[#f97316] cursor-pointer"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Balance ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Discount Value</label>
                <input
                  type="number"
                  min="1"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#14151b] border border-[#23252e] p-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#f97316]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Usage Limit (Optional)</label>
              <input
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value ? Number(e.target.value) : '')}
                placeholder="Leave blank for unlimited"
                className="w-full rounded-xl bg-[#14151b] border border-[#23252e] p-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#f97316]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#23252e]">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-[#14151b] border border-[#23252e] text-xs text-neutral-300 rounded-xl hover:bg-[#1a1b24] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#f97316] hover:bg-[#ea580c] text-xs text-white font-bold rounded-xl shadow-lg shadow-[#f97316]/20 cursor-pointer"
              >
                Save Coupon
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
