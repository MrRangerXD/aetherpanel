import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, DollarSign, RefreshCw, CheckCircle2, XCircle, Search,
  Filter, Coins, TrendingUp, AlertCircle, Eye, FileText
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Order } from '../../types';

export const AdminBilling: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'failed'>('all');
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const res = await apiRequest('/admin/orders');
    if (res.success && res.data) {
      setOrders(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleApproveOrder = async (orderId: string) => {
    setActionInProgressId(orderId);
    setActionMsg(null);
    const res = await apiRequest(`/admin/orders/${orderId}/approve`, { method: 'POST' });
    if (res.success) {
      setActionMsg({ type: 'success', text: `Order #${orderId.slice(0, 8)} approved and user credited!` });
      await fetchOrders();
      setTimeout(() => setActionMsg(null), 3000);
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Failed to approve order.' });
    }
    setActionInProgressId(null);
  };

  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt('Enter reason for rejection (optional):') || 'Transaction verification failed.';
    setActionInProgressId(orderId);
    setActionMsg(null);
    const res = await apiRequest(`/admin/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    if (res.success) {
      setActionMsg({ type: 'success', text: `Order #${orderId.slice(0, 8)} rejected.` });
      await fetchOrders();
      setTimeout(() => setActionMsg(null), 3000);
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Failed to reject order.' });
    }
    setActionInProgressId(null);
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status.toLowerCase() === statusFilter.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      o.id.toLowerCase().includes(q) ||
      o.userEmail.toLowerCase().includes(q) ||
      o.planName.toLowerCase().includes(q) ||
      (o.transactionRef && o.transactionRef.toLowerCase().includes(q)) ||
      (o.paymentMethod && o.paymentMethod.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  const totalRevenue = orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + (o.amount || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const pendingAmount = orders.filter(o => o.status === 'pending').reduce((sum, o) => sum + (o.amount || 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-amber-400" /> Platform Orders & Revenue Ledger
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Audit customer credit purchases, server deployments, manual UPI / Wire verifications.</p>
        </div>

        <button
          onClick={fetchOrders}
          className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Records
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <div className="text-xs text-zinc-400 flex items-center justify-between">
            <span>Total Settled Revenue</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            ${totalRevenue.toFixed(2)}
          </div>
          <p className="text-[11px] text-zinc-500">{orders.filter(o => o.status === 'paid').length} Completed Transactions</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <div className="text-xs text-zinc-400 flex items-center justify-between">
            <span>Pending Manual Approvals</span>
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {pendingCount} Orders <span className="text-sm font-normal text-zinc-400">(${pendingAmount.toFixed(2)})</span>
          </div>
          <p className="text-[11px] text-zinc-500">UPI / Crypto / Wire receipts requiring check</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <div className="text-xs text-zinc-400 flex items-center justify-between">
            <span>Total Lifetime Orders</span>
            <Coins className="h-4 w-4 text-violet-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {orders.length}
          </div>
          <p className="text-[11px] text-zinc-500">All registered server billing entries</p>
        </div>
      </div>

      {actionMsg && (
        <div className={`p-4 rounded-2xl text-xs font-semibold border flex items-center gap-2 animate-in fade-in ${
          actionMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {actionMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search email, plan, order ID, TxID..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Filter className="h-3.5 w-3.5 text-zinc-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending Approval</option>
            <option value="failed">Failed / Rejected</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400 space-y-2">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-400 mx-auto" />
          <p>Loading order records...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl text-xs text-zinc-400">
          No matching order records found.
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="p-3.5">Order ID</th>
                <th className="p-3.5">User Account</th>
                <th className="p-3.5">Plan / Description</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Payment Method</th>
                <th className="p-3.5">Ref / UTR / TxID</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Created</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredOrders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-900 transition-colors">
                  <td className="p-3.5 font-mono text-amber-400 font-semibold">#{o.id.replace('ord_', '').slice(0, 8)}</td>
                  <td className="p-3.5 font-semibold text-white truncate max-w-[160px]">{o.userEmail}</td>
                  <td className="p-3.5 text-zinc-300 font-medium">{o.planName}</td>
                  <td className="p-3.5 font-mono text-emerald-400 font-bold">${o.amount.toFixed(2)}</td>
                  <td className="p-3.5 text-zinc-300">{o.paymentMethod}</td>
                  <td className="p-3.5 font-mono text-zinc-400 text-[11px]">{o.transactionRef || '-'}</td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border capitalize ${
                      o.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      o.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold animate-pulse' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-zinc-400 font-mono text-[11px]">{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="p-3.5 text-right">
                    {o.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleApproveOrder(o.id)}
                          disabled={actionInProgressId === o.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectOrder(o.id)}
                          disabled={actionInProgressId === o.id}
                          className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-500 font-mono">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

export default AdminBilling;
