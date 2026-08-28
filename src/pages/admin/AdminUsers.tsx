import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Shield, ShieldCheck, DollarSign, Ban, CheckCircle, Edit3, Trash2, X, RefreshCw, Key, Lock, Loader2, Cpu } from 'lucide-react';
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

  // Password Reset Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Allocation Modal
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [allocationLimit, setAllocationLimit] = useState<number>(1);
  const [allocAction, setAllocAction] = useState<'set' | 'grant' | 'remove'>('set');
  const [allocAmount, setAllocAmount] = useState<number>(1);

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('user');
  const [createCredits, setCreateCredits] = useState<number>(0);
  const [createError, setCreateError] = useState<string | null>(null);

  // Feedback message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createEmail || !createUsername || !createPassword) {
      setCreateError('Email, username, and password are required.');
      return;
    }

    if (createPassword.length < 6) {
      setCreateError('Password must be at least 6 characters.');
      return;
    }

    setActionLoading(true);
    const res = await apiRequest('/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: createEmail,
        username: createUsername,
        displayName: createDisplayName || createUsername,
        password: createPassword,
        role: createRole,
        credits: createCredits
      })
    });
    setActionLoading(false);

    if (res.success) {
      showToast('success', res.message || `User ${createEmail} created successfully.`);
      setShowCreateModal(false);
      setCreateEmail('');
      setCreateUsername('');
      setCreateDisplayName('');
      setCreatePassword('');
      setCreateRole('user');
      setCreateCredits(0);
      fetchUsers();
    } else {
      setCreateError(res.error?.message || 'Failed to create user');
    }
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

  const handleAdjustAllocation = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    const res = await apiRequest('/admin/allocations/adjust', {
      method: 'POST',
      body: JSON.stringify({
        userId: selectedUser.id,
        action: allocAction,
        amount: allocAction === 'set' ? undefined : allocAmount,
        serverLimit: allocAction === 'set' ? allocationLimit : undefined
      })
    });
    setActionLoading(false);
    if (res.success) {
      showToast('success', res.message || 'User server allocations updated successfully');
      setShowAllocationModal(false);
      fetchUsers();
    } else {
      showToast('error', res.error?.message || 'Failed to adjust server allocations');
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setActionLoading(true);
    const res = await apiRequest(`/admin/users/${selectedUser.id}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    });
    setActionLoading(false);

    if (res.success) {
      showToast('success', `Password successfully updated for ${selectedUser.email}`);
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordError(res.error?.message || 'Failed to change password');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to permanently delete user ${user.email}? This action cannot be undone.`)) {
      return;
    }
    let res = await apiRequest(`/admin/users/${user.id}`, { method: 'DELETE' });
    if (!res.success && res.error?.code === 'USER_HAS_SERVERS') {
      if (window.confirm(`${res.error.message}\nDo you want to FORCE delete this user and terminate all their active servers?`)) {
        res = await apiRequest(`/admin/users/${user.id}?force=true`, { method: 'DELETE' });
      }
    }

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
          <p className="text-xs text-zinc-400 mt-1">Manage user roles, adjust credit balances, change passwords, and suspend accounts.</p>
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

          <button
            onClick={() => { setCreateError(null); setShowCreateModal(true); }}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-lg transition-all"
          >
            <Plus className="h-4 w-4" /> Create User
          </button>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500 text-xs font-mono">Loading user directory...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 text-xs">No users matching search query.</div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-mono uppercase text-zinc-400">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Balance</th>
                <th className="px-6 py-4">Allocation Quota</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">
                        {u.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{u.displayName || u.username}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {u.authProvider ? u.authProvider.toUpperCase() : 'EMAIL'}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                      <option value="support">Support</option>
                    </select>
                  </td>

                  <td className="px-6 py-4 font-mono font-bold text-emerald-400">
                    ${(u.credits ?? 0).toFixed(2)}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {u.serverLimit !== undefined ? u.serverLimit : 1} max
                      </span>
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setAllocationLimit(u.serverLimit !== undefined ? u.serverLimit : 1);
                          setShowAllocationModal(true);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                        title="Edit Server Allocation"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                      u.isSuspended ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {u.isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => { setSelectedUser(u); setCreditDelta(10); setCreditMode('add'); setShowCreditModal(true); }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1"
                        title="Adjust User Balance"
                      >
                        <DollarSign className="h-3.5 w-3.5" /> Credits
                      </button>

                      <button
                        onClick={() => { setSelectedUser(u); setNewPassword(''); setConfirmPassword(''); setPasswordError(null); setShowPasswordModal(true); }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1"
                        title="Reset User Password"
                      >
                        <Key className="h-3.5 w-3.5" /> Password
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

      {/* Allocation Limit Modal */}
      {showAllocationModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-400" /> Manage Server Allocations
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">User: <strong className="text-white">{selectedUser.email}</strong></p>
              </div>
              <button onClick={() => setShowAllocationModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Breakdown */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
              <div>
                <div className="text-[10px] uppercase font-mono text-zinc-500">Base Plan</div>
                <div className="text-sm font-bold font-mono text-white mt-0.5">
                  {selectedUser.baseServerAllocations ?? 1}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono text-zinc-500">Extra Granted</div>
                <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                  +{selectedUser.adminGrantedAllocations ?? 0}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono text-zinc-500">Total Limit</div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                  {selectedUser.role === 'admin' || selectedUser.role === 'super_admin'
                    ? 'Unlimited'
                    : (selectedUser.serverLimit ?? ((selectedUser.baseServerAllocations ?? 1) + (selectedUser.adminGrantedAllocations ?? 0)))}
                </div>
              </div>
            </div>

            {/* Action Modes */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setAllocAction('grant')}
                className={`py-1.5 rounded-lg font-medium transition ${
                  allocAction === 'grant' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                + Grant Extra
              </button>
              <button
                type="button"
                onClick={() => setAllocAction('remove')}
                className={`py-1.5 rounded-lg font-medium transition ${
                  allocAction === 'remove' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                - Remove Extra
              </button>
              <button
                type="button"
                onClick={() => setAllocAction('set')}
                className={`py-1.5 rounded-lg font-medium transition ${
                  allocAction === 'set' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                = Set Limit
              </button>
            </div>

            {allocAction === 'set' ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Set Total Allocation Limit</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={allocationLimit}
                  onChange={(e) => setAllocationLimit(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {allocAction === 'grant' ? 'Number of Extra Allocations to Grant' : 'Number of Extra Allocations to Remove'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={allocAmount}
                    onChange={(e) => setAllocAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  {[1, 2, 5].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAllocAmount(amt)}
                      className="px-2.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-300 border border-zinc-800"
                    >
                      {allocAction === 'grant' ? `+${amt}` : `-${amt}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Allocations are shared across all server types (Minecraft, Discord bots, etc.). Cannot reduce limits below user's active server count.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAllocationModal(false)}
                className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleAdjustAllocation}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-xs text-zinc-950 font-bold rounded-xl flex items-center gap-1.5 shadow-lg"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{actionLoading ? 'Saving...' : 'Apply Allocation Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" /> Reset User Password
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">User: <strong className="text-white">{selectedUser.email}</strong></p>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                {passwordError}
              </div>
            )}

            <div>
              <label className="block text-xs text-zinc-300 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleChangePassword}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-xs text-zinc-950 font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{actionLoading ? 'Updating...' : 'Set Password'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleCreateUser} className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-400" /> Create New User Account
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Provision a new user directly into the panel directory.</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  placeholder="johndoe"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={createDisplayName}
                  onChange={(e) => setCreateDisplayName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Role</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as UserRole)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="user">User</option>
                  <option value="support">Support</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">Initial Credits ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createCredits}
                  onChange={(e) => setCreateCredits(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-xs text-zinc-950 font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{actionLoading ? 'Creating...' : 'Create Account'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
