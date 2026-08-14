import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Shield, ShieldCheck, DollarSign, Ban, CheckCircle, Edit3, Trash2, X, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { User, UserRole } from '../../types';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Credit Modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditDelta, setCreditDelta] = useState<number>(10);
  const [creditMode, setCreditMode] = useState<'add' | 'remove' | 'set'>('add');
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Feedback message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchUsers = async () => {
    const res = await apiRequest('/admin/users');
    if (res.success && res.data) {
      setUsers(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    const res = await apiRequest(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole })
    });
    if (res.success) {
      showToast('success', `Role updated to ${newRole}`);
      fetchUsers();
    } else {
      showToast('error', res.error?.message || 'Failed to update user role');
    }
  };

  const handleToggleSuspend = async (userId: string, isSuspended: boolean) => {
    const res = await apiRequest(`/admin/users/${userId}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ isSuspended: !isSuspended })
    });
    if (res.success) {
      showToast('success', `User account ${!isSuspended ? 'suspended' : 'unsuspended'}`);
      fetchUsers();
    } else {
      showToast('error', res.error?.message || 'Failed to update account status');
    }
  };

  const handleAdjustCredits = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    const res = await apiRequest(`/admin/users/${selectedUser.id}/credits`, {
      method: 'POST',
      body: JSON.stringify({ amount: creditDelta, mode: creditMode })
    });
    setActionLoading(false);
    if (res.success) {
      showToast('success', res.message || 'User credits adjusted');
      setShowCreditModal(false);
      fetchUsers();
    } else {
      showToast('error', res.error?.message || 'Failed to adjust credits');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to permanently delete user ${user.email}? This action cannot be undone.`)) {
      return;
    }
    const res = await apiRequest(`/admin/users/${user.id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('success', `User ${user.email} deleted`);
      fetchUsers();
    } else {
      showToast('error', res.error?.message || 'Failed to delete user');
    }
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName.toLowerCase().includes(search.toLowerCase())
  );

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
            <Users className="h-6 w-6 text-amber-400" /> User Accounts Directory
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Manage user roles, adjust credit balances, suspend accounts, and view user metrics.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by name, username or email..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all shrink-0"
            title="Refresh Users"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading user directory...</div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Credits</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-900 transition-colors">
                  <td className="p-3.5">
                    <div className="font-semibold text-white">{u.displayName || u.username}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">@{u.username}</div>
                  </td>

                  <td className="p-3.5 text-zinc-300 font-mono">{u.email}</td>

                  <td className="p-3.5">
                    <select
                      value={u.role}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-amber-400 font-semibold focus:outline-none focus:border-amber-500"
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="support">Support</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>

                  <td className="p-3.5 font-mono text-emerald-400 font-bold">
                    ${(u.credits ?? 0).toFixed(2)}
                  </td>

                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
                      u.isSuspended
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {u.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>

                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setSelectedUser(u); setCreditDelta(10); setCreditMode('add'); setShowCreditModal(true); }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1"
                        title="Adjust User Balance"
                      >
                        <DollarSign className="h-3.5 w-3.5" /> Credits
                      </button>

                      <button
                        onClick={() => handleToggleSuspend(u.id, u.isSuspended)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          u.isSuspended ? 'bg-emerald-600 text-white' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                      </button>

                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                        title="Delete User"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Credit Modal */}
      {showCreditModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white">Adjust User Credits</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Target: <strong className="text-white">{selectedUser.email}</strong></p>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Current Balance: <span className="text-emerald-400 font-bold">${(selectedUser.credits ?? 0).toFixed(2)}</span></p>
              </div>
              <button onClick={() => setShowCreditModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Adjustment Action</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCreditMode('add')}
                  className={`py-1.5 rounded-xl text-xs font-semibold border ${creditMode === 'add' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                >
                  + Add
                </button>
                <button
                  type="button"
                  onClick={() => setCreditMode('remove')}
                  className={`py-1.5 rounded-xl text-xs font-semibold border ${creditMode === 'remove' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                >
                  - Deduct
                </button>
                <button
                  type="button"
                  onClick={() => setCreditMode('set')}
                  className={`py-1.5 rounded-xl text-xs font-semibold border ${creditMode === 'set' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                >
                  = Set Exact
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Amount ($ USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={creditDelta}
                onChange={(e) => setCreditDelta(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreditModal(false)}
                className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleAdjustCredits}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold rounded-xl"
              >
                {actionLoading ? 'Applying...' : 'Apply Credits'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

