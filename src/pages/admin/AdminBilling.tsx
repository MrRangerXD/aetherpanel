import React, { useState, useEffect } from 'react';
import { ShoppingBag, DollarSign, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Order } from '../../types';

export const AdminBilling: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    const res = await apiRequest('/admin/orders');
    if (res.success && res.data) {
      setOrders(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="border-b border-amber-500/20 pb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-amber-400" /> Platform Orders & Transactions
        </h1>
        <p className="text-xs text-zinc-400 mt-1">Audit platform revenue, credit deposits, and billing cycles.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading order records...</div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="p-3.5">Order ID</th>
                <th className="p-3.5">User Email</th>
                <th className="p-3.5">Plan / Service</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Method</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-900 transition-colors">
                  <td className="p-3.5 font-mono text-amber-400 font-semibold">#{o.id.slice(0, 8)}</td>
                  <td className="p-3.5 font-semibold text-white">{o.userEmail}</td>
                  <td className="p-3.5 text-zinc-300">{o.planName}</td>
                  <td className="p-3.5 font-mono text-emerald-400 font-bold">${o.amount.toFixed(2)}</td>
                  <td className="p-3.5 text-zinc-400">{o.paymentMethod}</td>
                  <td className="p-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                      {o.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right text-zinc-500 font-mono">{o.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
