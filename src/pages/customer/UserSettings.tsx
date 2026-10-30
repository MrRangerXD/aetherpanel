import React, { useState, useEffect } from 'react';
import {
  User, Key, Shield, Check, Save,
  Palette, MessageSquare, Link, Unlink,
  Plus, Trash2, Send, Radio, Lock
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { THEME_PRESETS, FONT_OPTIONS } from '../../lib/theme';
import { apiRequest } from '../../lib/api';
import { DiscordAccount, WebhookSubscription } from '../../types';
import { useToast } from '../../lib/ToastContext';

export const UserSettings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const {
    customCursorEnabled, setCustomCursorEnabled,
    animationsEnabled, setAnimationsEnabled,
    adsEnabled, setAdsEnabled,
    activeThemeId, setActiveThemeId,
    activeFontId, setActiveFontId,
    allowUserCustomization
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
  const [selectedEvents] = useState<string[]>(['*']);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; msg: string; success: boolean } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchDiscordStatus();
    fetchWebhooks();
  }, []);

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
      toast.error(`Webhook registration failed: ${err.message}`);
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
      toast.error(`Failed to delete webhook: ${err.message}`);
    }
  };

  const handleConnectDiscord = async () => {
    try {
      setConnectingDiscord(true);
      setDiscordNotice(null);

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
              setDiscordNotice('Discord account authorized and linked successfully!');
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
    const res = await apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName, email })
    });
    if (res.success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      await refreshUser();
      toast.success('Profile updated successfully.');
    } else {
      toast.error(res.error?.message || 'Failed to update profile.');
    }
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="border-b border-[var(--color-line)] pb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)]">Account & Settings</h1>
        <p className="text-xs text-[var(--color-ink-mute)] mt-1">Manage your identity, Discord integration, and real-time Webhook subscriptions.</p>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-md bg-[var(--color-ok)]/10 border border-[var(--color-ok)]/30 text-xs font-medium text-[var(--color-ok)] flex items-center gap-2">
          <Check className="h-4 w-4" /> Profile details updated successfully!
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="surface p-5 sm:p-6 rounded-lg space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
          <User className="h-4 w-4 text-[var(--color-accent)]" /> Personal Profile
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="label block mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="field w-full px-3 py-1.5 text-xs rounded-md"
            />
          </div>

          <div>
            <label className="label block mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field w-full px-3 py-1.5 text-xs rounded-md"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="btn btn-primary text-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Profile</span>
          </button>
        </div>
      </form>

      {/* Visual Themes & Personalization */}
      <div className="surface p-5 sm:p-6 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
            <Palette className="h-4 w-4 text-[var(--color-accent)]" /> Interface Preferences
          </h3>
          {!allowUserCustomization && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md surface-2 text-[var(--color-ink-mute)] border border-[var(--color-line)] flex items-center gap-1">
              <Shield className="h-3 w-3 text-[var(--color-accent)]" />
              <span>SYSTEM CONTROLLED</span>
            </span>
          )}
        </div>

        {!allowUserCustomization ? (
          <div className="surface-2 p-3.5 rounded-md border border-[var(--color-line)] flex items-start gap-2.5">
            <Shield className="h-4 w-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
              <div className="font-semibold text-[var(--color-ink)]">Platform theme settings are authoritative</div>
              Platform styling is managed globally to ensure a clean, high-density interface across all modules.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="label block">Select Visual Theme</label>
                <div className="grid grid-cols-2 gap-2">
                  {THEME_PRESETS.map((p) => {
                    const isSelected = activeThemeId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActiveThemeId(p.id)}
                        className={`p-2.5 rounded-md border text-left flex flex-col justify-between gap-1 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)]'
                            : 'surface-2 border-[var(--color-line)] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                        }`}
                      >
                        <span className="text-xs font-semibold text-[var(--color-ink)]">{p.name}</span>
                        <div className="flex gap-1">
                          {p.previewColors.map((color, i) => (
                            <span key={i} className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="label block">Typography</label>
                <select
                  value={activeFontId}
                  onChange={(e) => setActiveFontId(e.target.value)}
                  className="field w-full px-2.5 py-1.5 text-xs font-mono rounded-md"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.category})</option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--color-ink-mute)]">
                  Applies displaying and body typeface styling across modules.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Custom Cursor Toggle */}
              <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-[var(--color-ink)]">Custom Pointer</div>
                  <div className="text-[10px] text-[var(--color-ink-mute)]">Hardware-accelerated ring pointer.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customCursorEnabled}
                    onChange={(e) => setCustomCursorEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-[var(--color-line)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                </label>
              </div>

              {/* Animations Toggle */}
              <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-[var(--color-ink)]">Transitions</div>
                  <div className="text-[10px] text-[var(--color-ink-mute)]">GPU route movements.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={animationsEnabled}
                    onChange={(e) => setAnimationsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-[var(--color-line)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                </label>
              </div>

              {/* Promotional Ads Toggle */}
              <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-[var(--color-ink)]">Sponsor Cards</div>
                  <div className="text-[10px] text-[var(--color-ink-mute)]">Support development by enabling.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adsEnabled}
                    onChange={(e) => setAdsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-[var(--color-line)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Change Password Form */}
      <form onSubmit={handleChangePassword} className="surface p-5 sm:p-6 rounded-lg space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
          <Lock className="h-4 w-4 text-[var(--color-accent)]" /> Security & Password
        </h3>

        {passwordMsg && (
          <div className={`p-2.5 rounded-md text-xs font-medium ${
            passwordMsg.success ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border border-[var(--color-ok)]/30' : 'bg-[var(--color-err)]/10 text-[var(--color-err)] border border-[var(--color-err)]/30'
          }`}>
            {passwordMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="label block mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="field w-full px-3 py-1.5 text-xs rounded-md"
            />
          </div>

          <div>
            <label className="label block mb-1">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 chars"
              className="field w-full px-3 py-1.5 text-xs rounded-md"
            />
          </div>

          <div>
            <label className="label block mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="field w-full px-3 py-1.5 text-xs rounded-md"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={updatingPassword}
            className="btn btn-ghost text-xs"
          >
            <Key className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            <span>{updatingPassword ? 'Updating...' : 'Update Password'}</span>
          </button>
        </div>
      </form>

      {/* Discord Integration */}
      <div className="surface p-5 sm:p-6 rounded-lg space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[var(--color-accent)]" /> Discord Integration
        </h3>

        {discordNotice && (
          <div className="p-2.5 rounded-md surface-2 border border-[var(--color-line)] text-xs text-[var(--color-ink-dim)]">
            {discordNotice}
          </div>
        )}

        {loadingDiscord ? (
          <div className="surface-2 p-3 rounded-md text-xs text-[var(--color-ink-mute)]">
            Checking Discord status...
          </div>
        ) : discordAccount ? (
          <div className="surface-2 p-3.5 rounded-md border border-[var(--color-line)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={discordAccount.avatar}
                alt={discordAccount.username}
                className="w-10 h-10 rounded-full border border-[var(--color-line)] object-cover"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--color-ink)]">{discordAccount.globalName || discordAccount.username}</span>
                  <span className="text-[11px] font-mono text-[var(--color-ink-mute)]">({discordAccount.username})</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-ink-mute)] mt-0.5">
                  <span>ID: <code className="text-[var(--color-accent)] font-mono">{discordAccount.discordId}</code></span>
                  <span>·</span>
                  <span>Linked {new Date(discordAccount.linkedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDisconnectDiscord}
              className="btn btn-danger text-xs py-1 px-3"
            >
              <Unlink className="h-3 w-3" />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <div className="surface-2 p-4 rounded-md border border-[var(--color-line)] text-center space-y-2">
            <div className="w-8 h-8 rounded-full surface border border-[var(--color-line)] flex items-center justify-center mx-auto text-[var(--color-accent)]">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-ink)]">No Discord Account Connected</h4>
              <p className="text-[11px] text-[var(--color-ink-mute)] max-w-sm mx-auto mt-0.5">
                Link Discord to manage alerts, bot bots, and node instances.
              </p>
            </div>
            <button
              onClick={handleConnectDiscord}
              disabled={connectingDiscord}
              className="btn btn-primary text-xs py-1.5 px-4 mx-auto"
            >
              <Link className="h-3.5 w-3.5" />
              <span>{connectingDiscord ? 'Authorizing...' : 'Connect Discord'}</span>
            </button>
          </div>
        )}
      </div>

      {/* WEBHOOKS INTEGRATION */}
      <div className="surface p-5 sm:p-6 rounded-lg space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
            <Radio className="h-4 w-4 text-[var(--color-accent)]" /> Webhook Subscriptions
          </h3>
          <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">
            Receive real-time HTTP POST notifications when servers start, stop, deploy, or backup.
          </p>
        </div>

        {/* Create Webhook Form */}
        <form onSubmit={handleCreateWebhook} className="surface-2 p-3.5 rounded-md border border-[var(--color-line)] space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="label block mb-1">Webhook Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Discord Bot Hook"
                value={newWebhookName}
                onChange={e => setNewWebhookName(e.target.value)}
                className="field w-full px-2.5 py-1.5 text-xs rounded-md"
              />
            </div>
            <div>
              <label className="label block mb-1">Target Endpoint URL</label>
              <input
                type="url"
                required
                placeholder="https://your-domain.com/api/webhook"
                value={newWebhookUrl}
                onChange={e => setNewWebhookUrl(e.target.value)}
                className="field w-full px-2.5 py-1.5 text-xs rounded-md"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={creatingWebhook}
              className="btn btn-primary text-xs py-1 px-3"
            >
              <Plus className="h-3 w-3" />
              <span>Subscribe Webhook</span>
            </button>
          </div>
        </form>

        {/* Webhooks List */}
        <div className="space-y-1.5">
          {loadingWebhooks ? (
            <div className="text-xs text-[var(--color-ink-mute)] py-2">Loading webhooks...</div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-5 border border-dashed border-[var(--color-line)] rounded-md text-xs text-[var(--color-ink-mute)]">
              No webhook endpoints configured.
            </div>
          ) : (
            webhooks.map(wh => (
              <div key={wh.id} className="p-3 rounded-md surface-2 border border-[var(--color-line)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-ink)]">{wh.name}</span>
                    <span className="text-[10px] font-mono text-[var(--color-ink-mute)] truncate max-w-xs">{wh.url}</span>
                  </div>
                  {testResult && testResult.id === wh.id && (
                    <div className={`text-[11px] font-mono ${testResult.success ? 'text-[var(--color-ok)]' : 'text-[var(--color-err)]'}`}>
                      {testResult.msg}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleTestWebhook(wh.id)}
                    disabled={testingId === wh.id}
                    className="btn btn-ghost text-xs py-1 px-2.5"
                  >
                    <Send className="h-3 w-3" />
                    <span>Test</span>
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(wh.id)}
                    className="btn btn-danger text-xs py-1 px-2.5"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
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
