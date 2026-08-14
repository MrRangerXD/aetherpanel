import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { AfkSettings, RewardTransaction, User } from '../../types';
import { Coins, Save, History, PlusCircle, RefreshCw, AlertCircle } from 'lucide-react';

export const AdminRewards: React.FC = () => {
  const [settings, setSettings] = useState<AfkSettings>({
    enabled: true,
    creditsPerInterval: 5,
    intervalMinutes: 10,
    dailyMaxCredits: 100,
    weeklyMaxCredits: 500,
    minAccountAgeDays: 0
  });

  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual adjustment modal state
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(10);
  const [adjustDescription, setAdjustDescription] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [settingsRes, txRes, usersRes]: any[] = await Promise.all([
        apiRequest('/afk/admin/settings'),
        apiRequest('/afk/admin/transactions'),
        apiRequest('/admin/users')
      ]);

      if (settingsRes.success && settingsRes.settings) {
        setSettings(settingsRes.settings);
      }
      if (txRes.success) {
        setTransactions(txRes.transactions || []);
      }
      if (usersRes.success) {
        setUsers(usersRes.users || []);
        if (usersRes.users?.length > 0 && !adjustUserId) {
          setAdjustUserId(usersRes.users[0].id);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load reward administration settings.');
    } finally {
      setLoading(false);
    }
  }, [adjustUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMsg(null);
      setErrorMsg(null);
      const res = await apiRequest<{ success: boolean; settings: AfkSettings }>('/afk/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });

      if (res.success) {
        setSuccessMsg('AFK Reward settings updated successfully.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update AFK settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleManualAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustUserId || !adjustDescription) return;

    try {
      setSaving(true);
      setSuccessMsg(null);
      setErrorMsg(null);

      const res: any = await apiRequest('/afk/admin/adjust', {
        method: 'POST',
        body: JSON.stringify({
          userId: adjustUserId,
          amount: adjustAmount,
          description: adjustDescription
        })
      });

      if (res.success) {
        setSuccessMsg(`Balance adjusted successfully. New user credits: ${res.newBalance}`);
        setAdjustDescription('');
        fetchData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to adjust user credit balance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-400" />
            Reward & AFK System Controls
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Configure global credit reward rates, daily caps, anti-cheat limits, and manage user wallet ledgers.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="self-start sm:self-auto px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl border border-zinc-700/50 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs p-4 rounded-xl">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Global AFK Settings Form */}
        <form onSubmit={handleSaveSettings} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white pb-3 border-b border-zinc-800">
            Global AFK Reward Parameters
          </h2>

          <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <div>
              <span className="text-xs font-semibold text-white">Enable AFK System</span>
              <p className="text-[11px] text-zinc-500">Allow customers to earn loyalty credits by keeping control plane tabs active</p>
            </div>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={e => setSettings({ ...settings, enabled: e.target.checked })}
              className="w-4 h-4 accent-violet-600 rounded"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Credits per Interval</label>
              <input
                type="number"
                min={1}
                value={settings.creditsPerInterval}
                onChange={e => setSettings({ ...settings, creditsPerInterval: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Interval Duration (Minutes)</label>
              <input
                type="number"
                min={1}
                value={settings.intervalMinutes}
                onChange={e => setSettings({ ...settings, intervalMinutes: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Daily Maximum Credits</label>
              <input
                type="number"
                min={10}
                value={settings.dailyMaxCredits}
                onChange={e => setSettings({ ...settings, dailyMaxCredits: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Weekly Maximum Credits</label>
              <input
                type="number"
                min={50}
                value={settings.weeklyMaxCredits}
                onChange={e => setSettings({ ...settings, weeklyMaxCredits: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </form>

        {/* Manual Credit Adjustment */}
        <form onSubmit={handleManualAdjust} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white pb-3 border-b border-zinc-800 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-violet-400" />
            Manual User Balance Adjustment
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Select Customer Account</label>
              <select
                value={adjustUserId}
                onChange={e => setAdjustUserId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.email}) - Current: {u.credits || 0} credits
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Adjustment Amount (+/- Credits)</label>
              <input
                type="number"
                value={adjustAmount}
                onChange={e => setAdjustAmount(Number(e.target.value))}
                placeholder="e.g. 50 or -20"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Reason Note *</label>
              <input
                type="text"
                required
                value={adjustDescription}
                onChange={e => setAdjustDescription(e.target.value)}
                placeholder="e.g. Promotional loyalty credit grant or refund correction"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Coins className="w-4 h-4" />
              Apply Credit Adjustment
            </button>
          </div>
        </form>
      </div>

      {/* Global Transaction Ledger */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-violet-400" />
          Global Reward Transaction Audit Log
        </h3>

        {transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
            No transaction records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {transactions.slice(0, 30).map(tx => (
                  <tr key={tx.id} className="hover:bg-zinc-850/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-zinc-400">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono text-zinc-300">{tx.userId}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        tx.type === 'AFK_REWARD' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                        tx.type === 'ADMIN_ADJUSTMENT' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">{tx.description}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
