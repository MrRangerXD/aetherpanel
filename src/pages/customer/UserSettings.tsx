import React, { useState, useEffect } from 'react';
import {
  User, Key, Shield, Check, Copy, RefreshCw, Save, Sparkles,
  MousePointer, Palette, MessageSquare, Link, Unlink, ExternalLink,
  Plus, Trash2, Globe, Send, AlertCircle, Radio, Terminal, ShieldCheck,
  CheckCircle2, Lock
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { THEME_PRESETS, FONT_OPTIONS } from '../../lib/theme';
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
    activeFontId, setActiveFontId,
    allowUserCustomization,
    backgroundBlur, setBackgroundBlur,
    backgroundOverlayOpacity, setBackgroundOverlayOpacity
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

      // Fetch real Discord OAuth URL from server
      const urlRes = await apiRequest<{ url: string }>('/auth/discord/url');
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
          const checkTimer = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkTimer);
              setConnectingDiscord(false);
            }
          }, 1000);

          const handleMsg = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const type = event.data?.type;
            if (type === 'AETHERPANEL_DISCORD_OAUTH_SUCCESS' || type === 'DISCORD_AUTH_SUCCESS') {
              clearInterval(checkTimer);
              window.removeEventListener('message', handleMsg);
              if (event.data?.token) {
                localStorage.setItem('aether_token', event.data.token);
              }
              if (event.data?.discordAccount) {
                setDiscordAccount(event.data.discordAccount);
              }
              fetchDiscordStatus();
              refreshUser();
              setDiscordNotice('✅ Discord account authorized and linked successfully!');
              setConnectingDiscord(false);
            } else if (type === 'AETHERPANEL_DISCORD_OAUTH_ERROR' || type === 'DISCORD_AUTH_ERROR') {
              clearInterval(checkTimer);
              window.removeEventListener('message', handleMsg);
              setDiscordNotice(`Authorization Cancelled or Failed: ${event.data?.error || 'User declined access'}`);
              setConnectingDiscord(false);
            }
          };
          window.addEventListener('message', handleMsg);
          return;
        } else {
          setDiscordNotice('OAuth Popup window was blocked by browser settings. Please allow popups for AetherPanel.');
        }
      } else {
        setDiscordNotice('Not Configured: Configure Discord OAuth in Platform Settings.');
      }
    } catch (err: any) {
      setDiscordNotice(`Not Configured: ${err.message || 'Configure Discord OAuth in Platform Settings.'}`);
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

      {/* Visual Themes & Personalization */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Palette className="h-4 w-4 text-amber-400" /> Interface Personalization
          </h3>
          {!allowUserCustomization && (
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/50 flex items-center gap-1.5 shadow-sm">
              <Shield className="h-3.5 w-3.5 text-amber-500" />
              <span>LOCKED BY ADMIN</span>
            </span>
          )}
        </div>

        {!allowUserCustomization ? (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-500/80 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-400 leading-relaxed">
              <div className="font-semibold text-white">System theme settings are authoritative</div>
              Platform-wide styling is locked by system administrators to maintain AetherPanel's consistent luxury identity. Personal customization controls are currently disabled.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Theme Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">Select Visual Theme</label>
                <div className="grid grid-cols-2 gap-2">
                  {THEME_PRESETS.map((p) => {
                    const isSelected = activeThemeId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActiveThemeId(p.id)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-zinc-800/90 border-amber-500 ring-1 ring-amber-500/30'
                            : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900/60'
                        }`}
                      >
                        <span className="text-xs font-bold text-white">{p.name}</span>
                        <div className="flex gap-1">
                          {p.previewColors.map((color, i) => (
                            <span key={i} className="w-3.5 h-3.5 rounded-full border border-black/40" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">Select Typography</label>
                <select
                  value={activeFontId}
                  onChange={(e) => setActiveFontId(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.category})</option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Applies high-legibility displaying and body typeface styling globally across AetherPanel modules.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {/* Custom Cursor Toggle */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Interactive Custom Cursor</div>
                  <div className="text-[10px] text-zinc-500">Premium glowing aura outer ring.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customCursorEnabled}
                    onChange={(e) => setCustomCursorEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Animations Toggle */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Layout Transitions</div>
                  <div className="text-[10px] text-zinc-500">Smooth kinetic route movements.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={animationsEnabled}
                    onChange={(e) => setAnimationsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Promotional Ads Toggle */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Platform Sponsor Cards</div>
                  <div className="text-[10px] text-zinc-500">Support development by enabling.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adsEnabled}
                    onChange={(e) => setAdsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

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
