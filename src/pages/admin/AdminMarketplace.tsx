import React, { useState, useEffect } from 'react';
import {
  Store, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle,
  Plus, Edit3, Trash2, Star, Download, RefreshCw, Eye, Check, X,
  Layers, Gamepad2, Bot, Cpu, Archive, Terminal, Lock, Sparkles
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { MarketplaceItem, MarketplaceStatus, MarketplaceBadge } from '../../types';

export const AdminMarketplace: React.FC = () => {
  const { user } = useAuth();

  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'create' | 'policy'>('active');

  // Status message
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reviewing Pending Item Modal
  const [reviewItem, setReviewItem] = useState<MarketplaceItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [securityNotes, setSecurityNotes] = useState<string>('');

  // Create Form
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    longDescription: '',
    category: 'minecraft',
    badge: 'official' as MarketplaceBadge,
    icon: 'Gamepad2',
    version: '1.0.0',
    compatibility: 'Minecraft 1.20.x, Spigot/Paper, All Nodes',
    installType: 'template_deploy',
    minRamMB: 2048,
    minCpuCores: 1,
    minDiskGB: 15,
    startupCommand: 'java -Xms512M -Xmx{RAM_MB}M -jar server.jar nogui',
    environmentVarsJson: '{\n  "EULA": "true",\n  "SERVER_PORT": "{PORT}"\n}',
    isFeatured: true
  });
  const [creating, setCreating] = useState<boolean>(false);

  // Fetch all marketplace items including pending/archived
  const fetchAllItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/marketplace?status=all');
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items || []);
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to load marketplace items.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllItems();
  }, []);

  // Handle Status Update (Approve / Reject / Archive)
  const handleUpdateStatus = async (itemId: string, newStatus: MarketplaceStatus) => {
    try {
      const res = await fetch(`/api/v1/marketplace/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          rejectionReason: newStatus === 'rejected' ? rejectionReason : undefined,
          securityNotes: securityNotes || 'Approved by Admin'
        })
      });

      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: `Item status updated to '${newStatus}'.` });
        setReviewItem(null);
        setRejectionReason('');
        setSecurityNotes('');
        fetchAllItems();
      } else {
        setMsg({ type: 'error', text: data.error?.message || 'Failed to update status.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Network error updating item status.' });
    }
  };

  // Toggle Featured status
  const handleToggleFeature = async (itemId: string, currentFeatured: boolean) => {
    try {
      const res = await fetch(`/api/v1/marketplace/${itemId}/feature`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFeatured: !currentFeatured })
      });
      const data = await res.json();
      if (data.success) {
        fetchAllItems();
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to toggle feature state.' });
    }
  };

  // Delete Item
  const handleDeleteItem = async (itemId: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete '${name}' from Marketplace?`)) return;

    try {
      const res = await fetch(`/api/v1/marketplace/${itemId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: `'${name}' removed from marketplace.` });
        fetchAllItems();
      } else {
        setMsg({ type: 'error', text: data.error?.message || 'Delete failed.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Network error deleting item.' });
    }
  };

  // Handle Create Official Item
  const handleCreateOfficial = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMsg(null);

    try {
      let parsedEnv = {};
      try {
        if (createForm.environmentVarsJson.trim()) {
          parsedEnv = JSON.parse(createForm.environmentVarsJson);
        }
      } catch (e) {
        alert('Invalid JSON in Environment Variables field.');
        setCreating(false);
        return;
      }

      const payload = {
        name: createForm.name,
        description: createForm.description,
        longDescription: createForm.longDescription || createForm.description,
        category: createForm.category,
        badge: createForm.badge,
        icon: createForm.icon,
        version: createForm.version,
        compatibility: createForm.compatibility,
        installType: createForm.installType,
        requirements: {
          minRamMB: Number(createForm.minRamMB),
          minCpuCores: Number(createForm.minCpuCores),
          minDiskGB: Number(createForm.minDiskGB)
        },
        startupCommand: createForm.startupCommand,
        environmentVars: parsedEnv
      };

      const res = await fetch('/api/v1/marketplace/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: 'Official Marketplace Item created successfully!' });
        setCreateForm({
          name: '',
          description: '',
          longDescription: '',
          category: 'minecraft',
          badge: 'official',
          icon: 'Gamepad2',
          version: '1.0.0',
          compatibility: 'Minecraft 1.20.x, Spigot/Paper, All Nodes',
          installType: 'template_deploy',
          minRamMB: 2048,
          minCpuCores: 1,
          minDiskGB: 15,
          startupCommand: 'java -Xms512M -Xmx{RAM_MB}M -jar server.jar nogui',
          environmentVarsJson: '{\n  "EULA": "true",\n  "SERVER_PORT": "{PORT}"\n}',
          isFeatured: true
        });
        setActiveTab('active');
        fetchAllItems();
      } else {
        setMsg({ type: 'error', text: data.error?.message || 'Failed to create item.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Network error creating item.' });
    } finally {
      setCreating(false);
    }
  };

  const activeItems = items.filter(i => i.status === 'active');
  const pendingItems = items.filter(i => i.status === 'pending');
  const archivedItems = items.filter(i => i.status === 'archived' || i.status === 'rejected');
  const totalDeploys = items.reduce((sum, i) => sum + (i.downloadsCount || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-3xl bg-zinc-950 border border-amber-500/20 p-6 md:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Admin Control Plane</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              Marketplace & Submissions Management
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm">
              Review community submissions, enforce security policies, feature items, and publish official templates.
            </p>
          </div>

          <button
            onClick={() => fetchAllItems()}
            className="px-4 py-2 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-semibold hover:text-white transition-colors flex items-center gap-2 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload Marketplace Data</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
            <span className="text-xs text-zinc-400">Live Active Items</span>
            <div className="text-2xl font-bold text-white font-mono">{activeItems.length}</div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
            <span className="text-xs text-amber-300 font-medium">Pending Approvals</span>
            <div className="text-2xl font-bold text-amber-400 font-mono">{pendingItems.length}</div>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
            <span className="text-xs text-zinc-400">Total Real Deploys</span>
            <div className="text-2xl font-bold text-emerald-400 font-mono">{totalDeploys}</div>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
            <span className="text-xs text-zinc-400">Archived / Rejected</span>
            <div className="text-2xl font-bold text-zinc-400 font-mono">{archivedItems.length}</div>
          </div>
        </div>
      </div>

      {/* Message notification */}
      {msg && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between ${
          msg.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
            : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
        }`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="underline">Dismiss</button>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex border-b border-zinc-800 text-sm overflow-x-auto">
        {[
          { id: 'active', label: `Active Items (${activeItems.length})`, icon: Store },
          { id: 'pending', label: `Approval Queue (${pendingItems.length})`, icon: ShieldAlert, badgeCount: pendingItems.length },
          { id: 'create', label: 'Create Official Item', icon: Plus },
          { id: 'policy', label: 'Safety & Execution Policy', icon: Lock }
        ].map(t => {
          const IconComp = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-5 py-3 font-semibold text-xs border-b-2 transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <IconComp className="h-4 w-4" />
              <span>{t.label}</span>
              {t.badgeCount && t.badgeCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black font-extrabold text-[10px]">
                  {t.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ACTIVE ITEMS */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          <div className="bg-zinc-950 rounded-3xl border border-zinc-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="p-4">Item & Author</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Badge</th>
                    <th className="p-4">Deploys (Real)</th>
                    <th className="p-4">Rating (Real)</th>
                    <th className="p-4">Featured</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {activeItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500">
                        No active marketplace items found.
                      </td>
                    </tr>
                  ) : (
                    activeItems.map(i => (
                      <tr key={i.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white">{i.name}</div>
                          <div className="text-[11px] text-zinc-400">by {i.author} • v{i.version}</div>
                        </td>
                        <td className="p-4 capitalize font-mono text-amber-400">
                          {i.category}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-900 border border-zinc-800 text-zinc-300">
                            {i.badge}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-semibold text-zinc-200">
                          {i.downloadsCount || 0}
                        </td>
                        <td className="p-4 font-mono font-semibold text-amber-400">
                          ★ {i.rating > 0 ? i.rating.toFixed(1) : '0.0'} ({i.reviewsCount || 0})
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleFeature(i.id, i.isFeatured)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
                              i.isFeatured
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-white'
                            }`}
                          >
                            {i.isFeatured ? '★ Featured' : 'Unfeatured'}
                          </button>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleUpdateStatus(i.id, 'archived')}
                            title="Archive Item"
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                          >
                            Archive
                          </button>
                          <button
                            onClick={() => handleDeleteItem(i.id, i.name)}
                            title="Delete Item"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING APPROVAL QUEUE */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingItems.length === 0 ? (
            <div className="p-12 text-center bg-zinc-950 rounded-3xl border border-zinc-800/80 space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Queue is Clear!</h3>
              <p className="text-zinc-400 text-xs">There are no pending user submissions awaiting admin approval at this moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingItems.map(item => (
                <div key={item.id} className="p-6 rounded-3xl bg-zinc-950 border border-amber-500/30 space-y-4 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Pending Admin Audit
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">{item.name}</h3>
                      <p className="text-xs text-zinc-400">Submitted by <strong>{item.author}</strong> on {new Date(item.submittedAt || item.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
                    {item.description}
                  </p>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-zinc-900 text-amber-300 truncate">
                      <strong>Command:</strong> {item.startupCommand || 'None specified'}
                    </div>
                    {item.securityNotes && (
                      <div className={`p-2.5 rounded-xl text-[11px] font-sans ${item.securityValidated ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}>
                        <strong>Scanner Note:</strong> {item.securityNotes}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={() => setReviewItem(item)}
                      className="w-full py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Audit & Approve / Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AUDIT & APPROVE MODAL */}
      {reviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-xl bg-zinc-950 border border-amber-500/40 rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white">Audit Marketplace Submission</h3>
              <button onClick={() => setReviewItem(null)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400">Item Title:</label>
                <div className="text-sm font-bold text-white">{reviewItem.name}</div>
              </div>

              <div>
                <label className="text-zinc-400">Author:</label>
                <div className="text-zinc-200">{reviewItem.author} ({reviewItem.authorId})</div>
              </div>

              <div>
                <label className="text-zinc-400">Startup Command:</label>
                <pre className="p-3 rounded-xl bg-zinc-900 text-amber-300 font-mono overflow-x-auto mt-1">
                  {reviewItem.startupCommand || 'None'}
                </pre>
              </div>

              <div>
                <label className="text-zinc-400">Admin Audit Notes:</label>
                <input
                  type="text"
                  value={securityNotes}
                  onChange={e => setSecurityNotes(e.target.value)}
                  placeholder="e.g. Scanned script parameters. Verified non-privileged execution."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white mt-1 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400">Rejection Reason (if rejecting):</label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="e.g. Unverified binary source URL or insecure startup script."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white mt-1 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-800">
              <button
                onClick={() => handleUpdateStatus(reviewItem.id, 'rejected')}
                className="px-4 py-2.5 rounded-xl bg-rose-500/20 text-rose-300 font-semibold text-xs hover:bg-rose-500/30 transition-colors"
              >
                Reject Submission
              </button>
              <button
                onClick={() => handleUpdateStatus(reviewItem.id, 'active')}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-extrabold text-xs hover:bg-emerald-400 transition-colors flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>Approve & Publish to Marketplace</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CREATE OFFICIAL ITEM */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateOfficial} className="bg-zinc-950 rounded-3xl border border-zinc-800/80 p-6 space-y-6">
          <h3 className="text-lg font-bold text-white">Create Official Marketplace Item</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Name</label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Category</label>
              <select
                value={createForm.category}
                onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
              >
                <option value="minecraft">Minecraft</option>
                <option value="bot">Bots</option>
                <option value="template">Server Template</option>
                <option value="tool">Tool</option>
                <option value="utility">Utility</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Badge Tier</label>
              <select
                value={createForm.badge}
                onChange={e => setCreateForm({ ...createForm, badge: e.target.value as any })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
              >
                <option value="official">Official (AetherPanel Core)</option>
                <option value="verified">Verified Third-Party</option>
                <option value="community">Community</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Short Summary</label>
            <input
              type="text"
              required
              value={createForm.description}
              onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Detailed Long Description</label>
            <textarea
              rows={3}
              value={createForm.longDescription}
              onChange={e => setCreateForm({ ...createForm, longDescription: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Version</label>
              <input
                type="text"
                value={createForm.version}
                onChange={e => setCreateForm({ ...createForm, version: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Min RAM (MB)</label>
              <input
                type="number"
                value={createForm.minRamMB}
                onChange={e => setCreateForm({ ...createForm, minRamMB: Number(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Compatibility</label>
              <input
                type="text"
                value={createForm.compatibility}
                onChange={e => setCreateForm({ ...createForm, compatibility: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Startup Command</label>
            <input
              type="text"
              value={createForm.startupCommand}
              onChange={e => setCreateForm({ ...createForm, startupCommand: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-amber-300 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Environment Vars (JSON)</label>
            <textarea
              rows={3}
              value={createForm.environmentVarsJson}
              onChange={e => setCreateForm({ ...createForm, environmentVarsJson: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-300 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="px-6 py-3 rounded-2xl bg-amber-500 text-black font-extrabold text-xs hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Publishing...' : 'Publish Official Marketplace Item'}
          </button>
        </form>
      )}

      {/* TAB 4: SAFETY & EXECUTION POLICY */}
      {activeTab === 'policy' && (
        <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-6 text-xs text-zinc-300 leading-relaxed">
          <div className="flex items-center gap-3 text-amber-400 font-bold text-sm">
            <Lock className="h-5 w-5" />
            <span>AetherPanel Execution Policy & Security Verification Matrix</span>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <h4 className="font-bold text-white">1. Metric Integrity Policy</h4>
              <p>
                AetherPanel strictly forbids artificial download counts, fake ratings, or simulated reviews. All metrics on marketplace cards reflect verified real server deployments and actual user reviews.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <h4 className="font-bold text-white">2. Static Code Analysis & Sandboxing</h4>
              <p>
                Every submission is pre-scanned against restricted execution keywords (e.g. unverified curl piping, arbitrary root escalation, dangerous filesystem operations). Submissions containing flagged patterns are held in the Pending Admin Audit queue.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <h4 className="font-bold text-white">3. Secrets & API Key Isolation</h4>
              <p>
                Bot tokens, database credentials, and secret environment variables are never exposed in public client scripts or stored unencrypted. All startup variables are injected dynamically into isolated container process environments.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminMarketplace;
