import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Check, X, RefreshCw, Power } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Coupon } from '../../types';

export const AdminCoupons: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // New Coupon Modal
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState(20);
  const [usageLimit, setUsageLimit] = useState<number | ''>('');

  // Toast feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchCoupons = async () => {
    const res = await apiRequest('/admin/coupons');
    if (res.success && res.data) {
      setCoupons(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Toast Notification */}
      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between transition-all ${
          feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Tag className="h-6 w-6 text-amber-400" /> Promotional Coupons & Vouchers
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Create and manage discount codes, usage limits, and redemption vouchers.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCoupons}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all shrink-0"
            title="Refresh Coupons"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition-all"
          >
            <Plus className="h-4 w-4" /> Create Promo Code
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading coupons...</div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="p-3.5">Promo Code</th>
                <th className="p-3.5">Discount Rate</th>
                <th className="p-3.5">Usage / Limit</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    No promotional coupons registered. Click 'Create Promo Code' to start a promotion.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900 transition-colors">
                    <td className="p-3.5 font-mono text-amber-400 font-bold uppercase text-sm">{c.code}</td>
                    <td className="p-3.5 font-mono text-emerald-400 font-bold">
                      {c.discountType === 'percent' ? `${c.discountValue}% OFF` : `$${c.discountValue.toFixed(2)} CREDITS`}
                    </td>
                    <td className="p-3.5 text-zinc-300 font-mono">
                      {c.timesUsed} / {c.usageLimit ? `${c.usageLimit} max` : '∞ unlimited'}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
                        c.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}>
                        {c.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleCoupon(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            c.isActive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {c.isActive ? 'Disable' : 'Enable'}
                        </button>

                        <button
                          onClick={() => handleDeleteCoupon(c)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
                          title="Delete Coupon"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Coupon Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCoupon} className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Create Promo Code</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Coupon Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. AETHER2026"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white uppercase font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Discount Type</label>
                <select
                  value={discountType}
                  onChange={(e: any) => setDiscountType(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Balance ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">Discount Value</label>
                <input
                  type="number"
                  min="1"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Usage Limit (Optional)</label>
              <input
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value ? Number(e.target.value) : '')}
                placeholder="Unlimited if left empty"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-xs text-zinc-950 font-bold rounded-xl shadow-md"
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

