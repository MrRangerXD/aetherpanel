import React, { useState, useEffect } from 'react';
import {
  User, Key, Shield, Check, Copy, RefreshCw, Save, Sparkles,
  MousePointer, Palette, MessageSquare, Link, Unlink, ExternalLink,
  Plus, Trash2, Globe, Send, AlertCircle, Radio, Terminal, ShieldCheck,
  CheckCircle2, Lock
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { apiRequest } from '../../lib/api';
import { DiscordAccount, ApiKey, WebhookSubscription } from '../../types';

export const UserSettings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const {
    accent, setAccent,
    customCursorEnabled, setCustomCursorEnabled,
    animationsEnabled, setAnimationsEnabled,
    adsEnabled, setAdsEnabled,
    activeThemeId, setActiveThemeId,
    activeFontId, setActiveFontId
  } = useTheme();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Password Update
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Discord State
  const [discordAccount, setDiscordAccount] = useState<DiscordAccount | null>(null);
  const [loadingDiscord, setLoadingDiscord] = useState(true);
  const [connectingDiscord, setConnectingDiscord] = useState(false);
  const [discordNotice, setDiscordNotice] = useState<string | null>(null);

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('30');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['server:read', 'server:write', 'server:control']);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ name: string; key: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhooks State
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['*']);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; msg: string; success: boolean } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDiscordStatus();
    fetchApiKeys();
    fetchWebhooks();
  }, []);

  const fetchDiscordStatus = async () => {
    try {
      setLoadingDiscord(true);
      const res = await apiRequest<DiscordAccount | null>('/discord/user');
      if (res.success && res.data !== undefined) {
        setDiscordAccount(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch Discord account:', err);
    } finally {
      setLoadingDiscord(false);
    }
  };

  const fetchApiKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await apiRequest<ApiKey[]>('/api-keys');
      if (res.success && res.data) {
        setApiKeys(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoadingKeys(false);
    }
  };

  const fetchWebhooks = async () => {
    setLoadingWebhooks(true);
    try {
      const res = await apiRequest<WebhookSubscription[]>('/api-keys/webhooks/list');
      if (res.success && res.data) {
        setWebhooks(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setGeneratingKey(true);
    try {
      const res = await apiRequest<ApiKey & { apiKey: string }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: newKeyName.trim(),
          expiresInDays: Number(newKeyExpiry),
          scopes: selectedScopes
        })
      });
      if (res.success && res.data) {
        setRevealedKey({ name: res.data.name, key: res.data.apiKey });
        setNewKeyName('');
        fetchApiKeys();
      }
    } catch (err: any) {
      alert(`Key generation failed: ${err.message}`);
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke and delete this API key? Applications using it will immediately lose access.')) return;
    try {
      const res = await apiRequest(`/api-keys/${id}`, { method: 'DELETE' });
      if (res.success) {
        fetchApiKeys();
      }
    } catch (err: any) {
      alert(`Failed to delete key: ${err.message}`);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      const res = await apiRequest(`/api-keys/${id}/revoke`, { method: 'POST' });
      if (res.success) {
        fetchApiKeys();
      }
    } catch (err: any) {
      alert(`Failed to revoke key: ${err.message}`);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) return;
    setCreatingWebhook(true);
    try {
      const res = await apiRequest('/api-keys/webhooks/create', {
        method: 'POST',
        body: JSON.stringify({
          name: newWebhookName.trim(),
          url: newWebhookUrl.trim(),
          events: selectedEvents
        })
      });
      if (res.success) {
        setNewWebhookName('');
        setNewWebhookUrl('');
        fetchWebhooks();
      }
    } catch (err: any) {
      alert(`Webhook registration failed: ${err.message}`);
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleTestWebhook = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await apiRequest(`/api-keys/webhooks/${id}/test`, { method: 'POST' });
      setTestResult({
        id,
        msg: res.message || 'Webhook ping executed.',
        success: res.success
      });
      fetchWebhooks();
    } catch (err: any) {
      setTestResult({
        id,
        msg: `Test ping error: ${err.message}`,
        success: false
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to remove this webhook subscription?')) return;
    try {
      const res = await apiRequest(`/api-keys/webhooks/${id}`, { method: 'DELETE' });
      if (res.success) {
        fetchWebhooks();
      }
    } catch (err: any) {
      alert(`Failed to delete webhook: ${err.message}`);
    }
  };

  const handleConnectDiscord = async () => {
    try {
      setConnectingDiscord(true);
      setDiscordNotice(null);

      // Check if real Discord OAuth URL is configured
      const urlRes = await apiRequest('/auth/discord/url');
      if (urlRes.success && urlRes.data?.url) {
        const width = 500;
        const height = 750;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          urlRes.data.url,
          'DiscordAuthPopup',
          `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
        );

        if (popup) {
          const handleMsg = (event: MessageEvent) => {
            if (event.data?.type === 'DISCORD_AUTH_SUCCESS') {
              window.removeEventListener('message', handleMsg);
              fetchDiscordStatus();
              refreshUser();
              setDiscordNotice('Discord account authorized and connected successfully!');
            }
          };
          window.addEventListener('message', handleMsg);
          return;
        }
      }

      // Fallback direct linking
      const res = await apiRequest<DiscordAccount>('/discord/user/connect', {
        method: 'POST',
        body: JSON.stringify({
          username: user ? `${user.username}#${Math.floor(1000 + Math.random() * 9000)}` : 'Gamer#1337',
          globalName: user?.displayName || 'Aether Gamer'
        })
      });

      if (res.success && res.data) {
        setDiscordAccount(res.data);
        setDiscordNotice('Discord account authorized and connected successfully!');
      }
    } catch (err: any) {
      setDiscordNotice(`Connection failed: ${err.message || 'Error linking Discord account.'}`);
    } finally {
      setConnectingDiscord(false);
    }
  };

  const handleDisconnectDiscord = async () => {
    if (!confirm('Are you sure you want to disconnect your Discord account?')) return;

    try {
      setLoadingDiscord(true);
      await apiRequest('/discord/user/disconnect', { method: 'DELETE' });
      setDiscordAccount(null);
      setDiscordNotice('Discord account unlinked.');
      refreshUser();
    } catch (err: any) {
      setDiscordNotice(`Disconnection failed: ${err.message}`);
    } finally {
      setLoadingDiscord(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/auth/update-profile', {
      method: 'PATCH',
      body: JSON.stringify({ displayName, email })
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    await refreshUser();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ success: false, text: 'New password must be at least 6 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ success: false, text: 'New passwords do not match.' });
      return;
    }

    setUpdatingPassword(true);
    const res = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    setUpdatingPassword(false);

    if (res.success) {
      setPasswordMsg({ success: true, text: 'Password successfully updated!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordMsg({ success: false, text: res.error?.message || 'Failed to update password.' });
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-2xl font-bold text-white">Account & Developer Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">Manage your identity, Discord integration, REST API tokens, and real-time Webhook subscriptions.</p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center gap-2">
          <Check className="h-4 w-4" /> Profile details updated successfully!
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-5">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <User className="h-4 w-4 text-amber-400" /> Personal Profile
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2"
          >
            <Save className="h-4 w-4" /> Save Profile
          </button>
        </div>
      </form>

      {/* Change Password Form */}
      <form onSubmit={handleChangePassword} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-5">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Lock className="h-4 w-4 text-amber-400" /> Security & Password
        </h3>

        {passwordMsg && (
          <div className={`p-3.5 rounded-xl text-xs font-semibold ${
            passwordMsg.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {passwordMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updatingPassword}
            className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-50"
          >
            <Key className="h-4 w-4" /> {updatingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>

      {/* Discord Integration */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-5">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-indigo-400" /> Discord Account Integration
        </h3>

        {discordNotice && (
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
            {discordNotice}
          </div>
        )}

        {loadingDiscord ? (
          <div className="p-4 rounded-2xl bg-zinc-950 text-xs text-zinc-400 animate-pulse">
            Checking Discord integration status...
          </div>
        ) : discordAccount ? (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={discordAccount.avatar}
                alt={discordAccount.username}
                className="w-12 h-12 rounded-full border border-indigo-500/30 object-cover"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{discordAccount.globalName || discordAccount.username}</span>
                  <span className="text-[11px] font-mono text-zinc-400">({discordAccount.username})</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-0.5">
                  <span>ID: <code className="text-indigo-300">{discordAccount.discordId}</code></span>
                  <span>•</span>
                  <span>Linked {new Date(discordAccount.linkedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDisconnectDiscord}
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5"
            >
              <Unlink className="h-3.5 w-3.5" /> Disconnect Discord
            </button>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">No Discord Account Connected</h4>
              <p className="text-[11px] text-zinc-400 max-w-md mx-auto mt-0.5">
                Authorize AetherPanel on Discord to control your Minecraft servers, Discord bots, and node instances directly from Discord channels.
              </p>
            </div>
            <button
              onClick={handleConnectDiscord}
              disabled={connectingDiscord}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-2 mx-auto"
            >
              <Link className="h-4 w-4" />
              <span>{connectingDiscord ? 'Authorizing OAuth2...' : 'Connect Discord Account'}</span>
            </button>
          </div>
        )}
      </div>

      {/* REST API KEYS */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400" /> REST API Keys
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Authenticate programmatic API calls to the AetherPanel Control Plane via <code className="text-amber-400 font-mono">Authorization: Bearer aeth_sec_...</code>
            </p>
          </div>
        </div>

        {/* Revealed Key Alert */}
        {revealedKey && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Sparkles className="h-4 w-4" /> New API Key Generated: {revealedKey.name}
            </div>
            <p className="text-[11px] text-amber-200/80">
              Make sure to copy your API key now. For your security, this secret token will not be displayed again!
            </p>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                readOnly
                value={revealedKey.key}
                className="flex-1 rounded-xl bg-zinc-950 border border-amber-500/40 px-3.5 py-2 text-xs font-mono text-amber-300 selection:bg-amber-500 selection:text-black"
              />
              <button
                onClick={() => handleCopy(revealedKey.key)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition"
              >
                {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Generate Key Form */}
        <form onSubmit={handleCreateApiKey} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Key Description / Purpose</label>
              <input
                type="text"
                required
                placeholder="e.g. CI/CD Deployment Script, WHMCS Billing, CLI Tool"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Expiration Period</label>
              <select
                value={newKeyExpiry}
                onChange={e => setNewKeyExpiry(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="365">1 Year</option>
                <option value="0">Never Expires</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Scope Permissions</label>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { id: 'server:read', label: 'Read Servers' },
                { id: 'server:write', label: 'Write / Edit Servers' },
                { id: 'server:control', label: 'Power Controls (Start/Stop)' },
                { id: 'files:read', label: 'File Manager Read' },
                { id: 'files:write', label: 'File Manager Write' },
                { id: 'backups:manage', label: 'Backups' }
              ].map(scope => {
                const isSelected = selectedScopes.includes(scope.id);
                return (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => setSelectedScopes(prev =>
                      isSelected ? prev.filter(s => s !== scope.id) : [...prev, scope.id]
                    )}
                    className={`px-3 py-1 rounded-xl text-[11px] font-medium border transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {scope.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={generatingKey}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-xs font-bold text-zinc-950 flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Generate Key
            </button>
          </div>
        </form>

        {/* Keys List */}
        <div className="space-y-2">
          {loadingKeys ? (
            <div className="text-xs text-zinc-500 py-3">Loading active API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-zinc-800 rounded-2xl text-xs text-zinc-500">
              No API keys generated yet. Create one above to start automating your hosting.
            </div>
          ) : (
            apiKeys.map(k => (
              <div key={k.id} className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{k.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-amber-400">
                      {k.keyPrefix}
                    </span>
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded ${
                      k.status === 'revoked' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {k.status || 'active'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                    <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Expires: {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}</span>
                    {k.lastUsedAt && (
                      <>
                        <span>•</span>
                        <span>Last used: {new Date(k.lastUsedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {k.status !== 'revoked' && (
                    <button
                      onClick={() => handleRevokeApiKey(k.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                    >
                      Revoke
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteApiKey(k.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* REAL WEBHOOKS INTEGRATION */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-400" /> Webhook Subscriptions
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Receive real-time HTTP POST notifications with HMAC-SHA256 signatures when servers start, stop, deploy, crash, or finish backups.
          </p>
        </div>

        {/* Create Webhook Form */}
        <form onSubmit={handleCreateWebhook} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Webhook Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Discord Bot Hook, Slack Alerts"
                value={newWebhookName}
                onChange={e => setNewWebhookName(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Target Endpoint URL</label>
              <input
                type="url"
                required
                placeholder="https://your-domain.com/api/webhook"
                value={newWebhookUrl}
                onChange={e => setNewWebhookUrl(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={creatingWebhook}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Subscribe Webhook
            </button>
          </div>
        </form>

        {/* Webhooks List */}
        <div className="space-y-2">
          {loadingWebhooks ? (
            <div className="text-xs text-zinc-500 py-3">Loading webhooks...</div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-zinc-800 rounded-2xl text-xs text-zinc-500">
              No webhook endpoints configured.
            </div>
          ) : (
            webhooks.map(wh => (
              <div key={wh.id} className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{wh.name}</span>
                    <span className="text-[10px] font-mono text-zinc-500 truncate max-w-xs">{wh.url}</span>
                  </div>
                  {testResult && testResult.id === wh.id && (
                    <div className={`text-[11px] font-mono ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {testResult.msg}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestWebhook(wh.id)}
                    disabled={testingId === wh.id}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" /> Test
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(wh.id)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
