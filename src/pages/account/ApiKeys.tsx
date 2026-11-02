import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import {
  Key, Plus, Trash2, ShieldAlert, Copy, Check, Clock,
  ShieldCheck, AlertTriangle, RefreshCw, X, Lock, Eye
} from 'lucide-react';

interface UserApiKey {
  id: string;
  name: string;
  description: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  status: 'active' | 'revoked' | 'expired';
  lastUsedAt: string | null;
  requestCount: number;
  createdAt: string;
}

const AVAILABLE_SCOPES = [
  { id: 'servers.read', label: 'Read Servers', desc: 'Query server list and status' },
  { id: 'servers.control', label: 'Control Servers', desc: 'Start, stop, and restart servers' },
  { id: 'servers.console', label: 'Console Logs', desc: 'Stream console logs and send commands' },
  { id: 'files.read', label: 'Read Files', desc: 'Browse and download server files' },
  { id: 'files.write', label: 'Write Files', desc: 'Upload, modify, and delete files' },
  { id: 'backups.manage', label: 'Manage Backups', desc: 'Create, restore, and delete snapshots' }
];

export const ApiKeys: React.FC<{ onNavigate?: (page: string) => void }> = () => {
  const { toast } = useToast();
  const [keys, setKeys] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create Key Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['servers.read', 'servers.control']);
  const [allowedIps, setAllowedIps] = useState('');
  const [creating, setCreating] = useState(false);

  // Revealed Key Modal (Only shown once)
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedKeyName, setRevealedKeyName] = useState('');
  const [copied, setCopied] = useState(false);

  // Fetch Keys
  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<UserApiKey[]>(
        '/api-keys/account/keys'
      );
      if (res.success) {
        setKeys(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch personal API keys');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Handle Create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      const ipList = allowedIps
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const res = await apiRequest<{ id: string; name: string; apiKey: string }>('/api-keys/account/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          expiresInDays: Number(expiresInDays) || 0,
          scopes: selectedScopes,
          allowedIps: ipList
        })
      });

      if (res.success && res.data?.apiKey) {
        toast.success(res.message);
        setShowCreateModal(false);
        setRevealedKey(res.data.apiKey);
        setRevealedKeyName(res.data.name);
        setName('');
        setDescription('');
        setAllowedIps('');
        await fetchKeys();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate API key');
    } finally {
      setCreating(false);
    }
  };

  // Revoke Key
  const handleRevoke = async (keyId: string) => {
    setActionLoading(`revoke_${keyId}`);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/api-keys/account/keys/${keyId}/revoke`,
        { method: 'POST' }
      );
      if (res.success) {
        toast.success(res.message);
        await fetchKeys();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke key');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Key
  const handleDelete = async (keyId: string) => {
    setActionLoading(`delete_${keyId}`);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/api-keys/account/keys/${keyId}`,
        { method: 'DELETE' }
      );
      if (res.success) {
        toast.success(res.message);
        await fetchKeys();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete key');
    } finally {
      setActionLoading(null);
    }
  };

  // Copy Key to Clipboard
  const handleCopy = () => {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      toast.success('API key copied to clipboard.');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-line)] pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[var(--color-ink)]">
            <Key className="w-6 h-6 text-[var(--color-accent)]" />
            Account API Keys
          </h1>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1">
            Generate personal API tokens to automate deployments, poll stats, and manage server lifecycles
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create API Key
          </button>
          <button
            onClick={fetchKeys}
            disabled={loading}
            className="btn px-3 py-2 text-xs border border-[var(--color-line)] flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Keys List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="surface h-20 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="surface p-12 text-center rounded-lg border border-[var(--color-line)]">
          <Key className="w-10 h-10 mx-auto text-[var(--color-ink-mute)] mb-3" />
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">No API keys created</h3>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1 max-w-sm mx-auto">
            You haven't generated any account API tokens yet. Create one to authenticate CLI tools and automation scripts.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary mt-4 px-4 py-2 text-xs font-semibold"
          >
            Generate First Key
          </button>
        </div>
      ) : (
        <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
          {keys.map(k => {
            const isRevoked = k.status === 'revoked';
            const isExpired = k.status === 'expired';
            return (
              <div
                key={k.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors ${
                  isRevoked || isExpired ? 'opacity-50 bg-[var(--color-surface-2)]/30' : 'hover:bg-[var(--color-surface-2)]/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--color-ink)] truncate">{k.name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-ink-dim)] border border-[var(--color-line)]">
                      {k.keyPrefix}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                        k.status === 'active'
                          ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border border-[var(--color-ok)]/30'
                          : k.status === 'revoked'
                          ? 'bg-[var(--color-err)]/10 text-[var(--color-err)] border border-[var(--color-err)]/30'
                          : 'bg-[var(--color-warn)]/10 text-[var(--color-warn)] border border-[var(--color-warn)]/30'
                      }`}
                    >
                      {k.status}
                    </span>
                  </div>

                  {k.description && (
                    <p className="text-xs text-[var(--color-ink-dim)] mt-1">{k.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-ink-dim)] mt-2 font-mono">
                    <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                    <span>&bull;</span>
                    <span>
                      Expires: {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}
                    </span>
                    <span>&bull;</span>
                    <span>Requests: {k.requestCount.toLocaleString()}</span>
                    {k.lastUsedAt && (
                      <>
                        <span>&bull;</span>
                        <span>Last used: {new Date(k.lastUsedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {k.status === 'active' && (
                    <button
                      onClick={() => handleRevoke(k.id)}
                      disabled={actionLoading === `revoke_${k.id}`}
                      className="btn px-2.5 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-err)] text-[var(--color-ink-dim)] hover:text-[var(--color-err)]"
                    >
                      Revoke
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(k.id)}
                    disabled={actionLoading === `delete_${k.id}`}
                    className="btn p-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-err)] hover:text-[var(--color-err)]"
                    title="Delete Key Metadata"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="surface w-full max-w-lg rounded-lg border border-[var(--color-line)] p-5 space-y-4 bg-[var(--color-surface)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                <Key className="w-4 h-4 text-[var(--color-accent)]" />
                Generate Account API Key
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label text-xs block mb-1">Key Description / Name</label>
              <input
                type="text"
                required
                placeholder="e.g. CI/CD Deployment Bot or Discord Bot"
                value={name}
                onChange={e => setName(e.target.value)}
                className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
            </div>

            <div>
              <label className="label text-xs block mb-1">Details / Note (Optional)</label>
              <input
                type="text"
                placeholder="Intended purpose of this token"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs block mb-1">Expiration Period</label>
                <select
                  value={expiresInDays}
                  onChange={e => setExpiresInDays(e.target.value)}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
                >
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="365">1 Year</option>
                  <option value="0">Never (No expiry)</option>
                </select>
              </div>

              <div>
                <label className="label text-xs block mb-1">IP Allowlist (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 1.2.3.4 (leave blank for any)"
                  value={allowedIps}
                  onChange={e => setAllowedIps(e.target.value)}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="label text-xs block mb-2">Scope Permissions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVAILABLE_SCOPES.map(sc => {
                  const checked = selectedScopes.includes(sc.id);
                  return (
                    <label
                      key={sc.id}
                      className={`p-2 rounded border transition-colors flex items-start gap-2 cursor-pointer ${
                        checked
                          ? 'bg-[var(--color-accent)]/5 border-[var(--color-accent)]/40'
                          : 'bg-[var(--color-surface-2)] border-[var(--color-line)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          if (e.target.checked) setSelectedScopes([...selectedScopes, sc.id]);
                          else setSelectedScopes(selectedScopes.filter(id => id !== sc.id));
                        }}
                        className="mt-0.5 rounded border-[var(--color-line)] text-[var(--color-accent)]"
                      />
                      <div>
                        <span className="text-xs font-semibold text-[var(--color-ink)] block">{sc.label}</span>
                        <span className="text-[10px] text-[var(--color-ink-dim)] block leading-tight">{sc.desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-line)]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn px-4 py-2 text-xs border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              >
                {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Generate Key
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Revealed Secret Modal */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="surface w-full max-w-md rounded-lg border border-[var(--color-accent)] p-6 space-y-4 bg-[var(--color-surface)] shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">API Key Generated</h3>
                <p className="text-xs text-[var(--color-ink-dim)]">{revealedKeyName}</p>
              </div>
            </div>

            <div className="surface p-3 rounded-lg border border-[var(--color-warn)]/50 bg-[var(--color-warn)]/5 text-xs text-[var(--color-warn)] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Make sure to copy your API key now. For your security, this key will <strong>never be shown again</strong>.
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                readOnly
                value={revealedKey}
                className="field w-full pr-10 py-2.5 px-3 text-xs font-mono bg-[var(--color-bg)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] select-all"
              />
              <button
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-accent)]"
                title="Copy to Clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-[var(--color-ok)]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={() => {
                setRevealedKey(null);
                setRevealedKeyName('');
              }}
              className="btn-primary w-full py-2.5 text-xs font-semibold"
            >
              I Have Saved My Secret Key
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default ApiKeys;
