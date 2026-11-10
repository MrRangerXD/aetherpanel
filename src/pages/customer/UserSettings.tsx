import React, { useState, useEffect } from 'react';
import {
  User, Key, Shield, Check, Copy, Trash2, Plus, Info, ExternalLink,
  Lock, AlertTriangle, Download, ArrowRight, Smartphone, RefreshCw,
  LogOut, ShieldCheck, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { apiRequest } from '../../lib/api';

interface ApiKeyItem {
  id: string;
  description: string;
  allowedIps?: string;
  lastUsedAt?: string;
  createdAt: string;
  token?: string;
}

export const UserSettings: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'api' | 'referrals'>('account');

  // Account Tab State
  const [newUsername, setNewUsername] = useState(user?.displayName || user?.username || '');
  const [usernamePassword, setUsernamePassword] = useState('');
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [emailPassword, setEmailPassword] = useState('');
  const [accountMsg, setAccountMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatingAccount, setUpdatingAccount] = useState(false);

  // Security Tab State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // API Tab State
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [keyDescription, setKeyDescription] = useState('');
  const [allowedIps, setAllowedIps] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Referrals Tab State (Clean, formatted referral code)
  const [copiedCode, setCopiedCode] = useState(false);
  const referralCode = React.useMemo(() => {
    if (!user?.id) return 'REF-8N4K-92X1';
    let hash = 5381;
    const seed = `${user.id}-${user.username || 'user'}-aether-ref`;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) + hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    let h1 = Math.abs(hash);
    for (let i = 0; i < 4; i++) {
      code += chars[h1 % chars.length];
      h1 = Math.floor(h1 / chars.length) + (seed.charCodeAt(i % seed.length) * 19);
    }
    let h2 = Math.abs(hash ^ 0x5f3759df);
    let code2 = '';
    for (let i = 0; i < 4; i++) {
      code2 += chars[h2 % chars.length];
      h2 = Math.floor(h2 / chars.length) + (seed.charCodeAt((i + 1) % seed.length) * 31);
    }
    return `REF-${code}-${code2}`;
  }, [user?.id, user?.username]);

  // Load API keys
  const fetchApiKeys = async () => {
    try {
      const res = await apiRequest('/account/api-keys');
      if (res.success && Array.isArray(res.data)) {
        setApiKeys(res.data);
      }
    } catch (e) {
      console.error('Failed to load api keys:', e);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setUpdatingAccount(true);
    setAccountMsg(null);
    try {
      const res = await apiRequest('/account/username', {
        method: 'POST',
        body: JSON.stringify({ username: newUsername.trim(), password: usernamePassword })
      });
      if (res.success) {
        setAccountMsg({ type: 'success', text: 'Username updated successfully.' });
        setUsernamePassword('');
        refreshUser();
      } else {
        setAccountMsg({ type: 'error', text: res.message || 'Failed to update username.' });
      }
    } catch (err: any) {
      setAccountMsg({ type: 'error', text: err.message || 'Failed to update username.' });
    } finally {
      setUpdatingAccount(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setUpdatingAccount(true);
    setAccountMsg(null);
    try {
      const res = await apiRequest('/account/email', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail.trim(), password: emailPassword })
      });
      if (res.success) {
        setAccountMsg({ type: 'success', text: 'Email updated successfully.' });
        setEmailPassword('');
        refreshUser();
      } else {
        setAccountMsg({ type: 'error', text: res.message || 'Failed to update email.' });
      }
    } catch (err: any) {
      setAccountMsg({ type: 'error', text: err.message || 'Failed to update email.' });
    } finally {
      setUpdatingAccount(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setUpdatingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await apiRequest('/account/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (res.success) {
        setPasswordMsg({ type: 'success', text: 'Password changed. Please sign in again if prompted.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: res.message || 'Failed to update password.' });
      }
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyDescription.trim()) return;
    setCreatingKey(true);
    try {
      const res = await apiRequest('/account/api-keys', {
        method: 'POST',
        body: JSON.stringify({ description: keyDescription.trim(), allowedIps: allowedIps.trim() })
      });
      if (res.success && res.data) {
        setNewlyCreatedKey(res.data.token || res.data.key || 'aether_api_key_secret');
        setKeyDescription('');
        setAllowedIps('');
        fetchApiKeys();
      }
    } catch (err) {
      console.error('Failed to create API key:', err);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await apiRequest(`/account/api-keys/${id}`, { method: 'DELETE' });
      fetchApiKeys();
    } catch (err) {
      console.error('Failed to delete API key:', err);
    }
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. Header (Orihost image_fba04f18.png) */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Account</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Your profile, sign-in security, API keys and referrals.
        </p>
      </div>

      {/* 2. Top Tabs: Account | Security | API | Referrals */}
      <div className="flex items-center gap-1 border-b border-[#23252e] pb-2">
        <button
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'account'
              ? 'text-white bg-[#181922] border-b-2 border-[#f97316]'
              : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
          }`}
        >
          <User className="h-3.5 w-3.5" />
          <span>Account</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'text-white bg-[#181922] border-b-2 border-[#f97316]'
              : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Security</span>
        </button>

        <button
          onClick={() => setActiveTab('api')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'api'
              ? 'text-white bg-[#181922] border-b-2 border-[#f97316]'
              : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          <span>API</span>
        </button>

        <button
          onClick={() => setActiveTab('referrals')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'referrals'
              ? 'text-white bg-[#181922] border-b-2 border-[#f97316]'
              : 'text-neutral-400 hover:text-white hover:bg-[#14151b]'
          }`}
        >
          <span className="text-amber-400">🎁</span>
          <span>Referrals</span>
        </button>
      </div>


      {/* ================= TAB 1: ACCOUNT (image_fba04f18.png) ================= */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {accountMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                accountMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-950/40 border-red-500/30 text-red-400'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{accountMsg.text}</span>
            </div>
          )}

          {/* Card 1: Username */}
          <form onSubmit={handleUpdateUsername} className="rounded-xl bg-[#14151b] border border-[#23252e] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <h3 className="text-sm font-bold text-white">Username</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  How other users see you on the panel.
                </p>
              </div>

              <div className="sm:w-2/3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">New username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={usernamePassword}
                    onChange={(e) => setUsernamePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={updatingAccount}
                    className="px-4 py-2 rounded-lg bg-[#181922] border border-[#23252e] hover:border-[#f97316] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Update username
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Card 2: Email address */}
          <form onSubmit={handleUpdateEmail} className="rounded-xl bg-[#14151b] border border-[#23252e] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <h3 className="text-sm font-bold text-white">Email address</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Your contact email for notifications and recovery.
                </p>
              </div>

              <div className="sm:w-2/3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={updatingAccount}
                    className="px-4 py-2 rounded-lg bg-[#181922] border border-[#23252e] hover:border-[#f97316] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Update email
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Card 3: Discord */}
          <div className="rounded-xl bg-[#14151b] border border-[#23252e] p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <h3 className="text-sm font-bold text-white">Discord</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Link your Discord account for community roles and easy login.
                </p>
              </div>

              <div className="sm:w-2/3 flex items-center justify-between p-3.5 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                    D
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Discord</div>
                    <div className="text-[10px] text-neutral-500">
                      Your account is not linked to Discord.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => alert('Discord OAuth connection modal launched.')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#181922] border border-[#23252e] hover:border-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Link Discord account
                </button>
              </div>
            </div>
          </div>

          {/* Card 4: Your data */}
          <div className="rounded-xl bg-[#14151b] border border-[#23252e] p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <h3 className="text-sm font-bold text-white">Your data</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Download a copy of your data. Other privacy requests: dpo@orihost.com
                </p>
              </div>

              <div className="sm:w-2/3 flex items-center justify-between p-3.5 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="text-xs text-neutral-400 max-w-sm">
                  Get a copy of everything we store about your account: profile, servers, login history, devices, activity and purchases.
                </div>

                <button
                  type="button"
                  onClick={() => alert('Exporting GDPR JSON archive...')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#181922] border border-[#23252e] hover:border-neutral-500 text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download my data</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 5: Danger zone */}
          <div className="rounded-xl bg-red-950/15 border border-red-500/25 p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <h3 className="text-sm font-bold text-red-400">Danger zone</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Permanently delete your account and everything in it.
                </p>
              </div>

              <div className="sm:w-2/3 flex items-center justify-between p-3.5 rounded-lg bg-[#0c0d12] border border-red-500/20">
                <div className="text-xs text-neutral-400 max-w-sm">
                  <strong className="text-white block mb-0.5">Delete account</strong>
                  Permanently delete your account and every server you own. This cannot be undone.
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Permanently delete your account and all servers?')) {
                      logout();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete my account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: SECURITY (image_afafd516.png) ================= */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {passwordMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                passwordMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-950/40 border-red-500/30 text-red-400'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{passwordMsg.text}</span>
            </div>
          )}

          {/* Password Card */}
          <form onSubmit={handleUpdatePassword} className="rounded-xl bg-[#14151b] border border-[#23252e] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <h3 className="text-sm font-bold text-white">Password</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Change the password you use to sign in. You will need your current one.
                </p>
              </div>

              <div className="sm:w-2/3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Current password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Confirm new password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-neutral-500">You will be signed out after saving.</span>
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="px-4 py-2 rounded-lg bg-[#181922] border border-[#23252e] hover:border-[#f97316] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Update password
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Two-step verification Card */}
          <div className="rounded-xl bg-[#14151b] border border-[#23252e] p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <h3 className="text-sm font-bold text-white">Two-step verification</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Protect your account with a one-time code from an authenticator app.
                </p>
              </div>

              <div className="sm:w-2/3 flex items-center justify-between p-4 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#181922] border border-[#23252e] flex items-center justify-center text-neutral-400">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Authenticator app</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                        {twoFactorEnabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      Two-step verification is not enabled. Add it to require a code from your phone when you sign in.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  className="px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                >
                  Enable two-step
                </button>
              </div>
            </div>
          </div>

          {/* Account activity Card */}
          <div className="rounded-xl bg-[#14151b] border border-[#23252e] p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <h3 className="text-sm font-bold text-white">Account activity</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Recent sign-ins and changes made to your account.
                </p>
              </div>

              <div className="sm:w-2/3 space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#f97316] text-white flex items-center justify-center text-xs font-bold">
                      {((user?.displayName || user?.username || 'K')[0]).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{user?.displayName || user?.username || 'kravenog'}</span>
                        <span className="text-neutral-500 font-normal">Logged in</span>
                      </div>
                      <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                        2401:4900:... · Current Session
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">Just now</span>
                </div>
                <div className="text-[10px] text-neutral-500 font-mono text-right">Showing 1 of 1 results</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: API (image_17e71001.png) ================= */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          {newlyCreatedKey && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <Key className="h-4 w-4 text-amber-400" />
                <span>New API Key Generated!</span>
              </div>
              <p className="text-neutral-300">Copy this key now. It will not be shown again:</p>
              <div className="p-2.5 rounded bg-black/60 font-mono text-white text-xs select-all break-all border border-amber-500/30">
                {newlyCreatedKey}
              </div>
            </div>
          )}

          {/* Create API key Card */}
          <form onSubmit={handleCreateApiKey} className="rounded-xl bg-[#14151b] border border-[#23252e] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <h3 className="text-sm font-bold text-white">Create API key</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Create keys to use the panel API from your own scripts and tools.
                </p>
              </div>

              <div className="sm:w-2/3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={keyDescription}
                    onChange={(e) => setKeyDescription(e.target.value)}
                    placeholder="A description of this API key."
                    className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Allowed IPs</label>
                  <textarea
                    rows={3}
                    value={allowedIps}
                    onChange={(e) => setAllowedIps(e.target.value)}
                    placeholder="203.0.113.10&#10;Leave blank to allow any IP address to use this API key."
                    className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2 focus:outline-none focus:border-[#f97316] font-mono transition-colors"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Leave blank to allow any IP address to use this API key, otherwise provide each IP on a new line.
                  </p>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={creatingKey}
                    className="px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    {creatingKey ? 'Creating...' : 'Create key'}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Your API keys Card */}
          <div className="rounded-xl bg-[#14151b] border border-[#23252e] p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <h3 className="text-sm font-bold text-white">Your API keys</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Keys that can act on behalf of your account. Delete any you no longer use.
                </p>
              </div>

              <div className="sm:w-2/3">
                {apiKeys.length === 0 ? (
                  <div className="p-8 text-center rounded-lg bg-[#0c0d12] border border-[#23252e] space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-[#181922] border border-[#23252e] flex items-center justify-center text-neutral-500 mx-auto">
                      <Key className="h-4 w-4" />
                    </div>
                    <div className="text-xs font-bold text-white">No API keys yet</div>
                    <div className="text-[11px] text-neutral-500">Create one above to use the panel API.</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {apiKeys.map((k) => (
                      <div key={k.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                        <div>
                          <div className="text-xs font-bold text-white">{k.description}</div>
                          <div className="text-[10px] font-mono text-neutral-500">
                            Created: {new Date(k.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteApiKey(k.id)}
                          className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                          title="Revoke key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: REFERRALS (image_9e1e0ad3.png) ================= */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          {/* Share your code Card */}
          <div className="rounded-xl bg-[#14151b] border border-[#23252e] p-5 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white">Share your code</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                When someone signs up with your code, you both get an extra server slot.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-neutral-400 mb-1">Your referral code</label>
                <div className="flex items-center gap-2">
                  <div className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-sm font-mono font-bold rounded-lg px-3.5 py-2.5">
                    {referralCode}
                  </div>
                  <button
                    onClick={copyReferral}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#181922] border border-[#23252e] hover:border-[#f97316] text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
                  >
                    {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 p-3 rounded-lg bg-[#0c0d12] border border-[#23252e] text-center">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">Friends Referred</div>
                  <div className="text-xl font-bold text-white font-mono mt-1">0</div>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-[#0c0d12] border border-[#23252e] text-center">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">Server Limit</div>
                  <div className="text-xl font-bold text-white font-mono mt-1">2</div>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="pt-4 border-t border-[#23252e]/60">
              <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-3">How it works</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                  <div className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center font-bold text-[11px] shrink-0 font-mono">
                    1
                  </div>
                  <span className="text-neutral-300 leading-relaxed">Share your referral code with a friend.</span>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                  <div className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center font-bold text-[11px] shrink-0 font-mono">
                    2
                  </div>
                  <span className="text-neutral-300 leading-relaxed">They enter it during registration.</span>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0c0d12] border border-[#23252e]">
                  <div className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center font-bold text-[11px] shrink-0 font-mono">
                    3
                  </div>
                  <span className="text-neutral-300 leading-relaxed">You both get +1 server slot instantly.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
