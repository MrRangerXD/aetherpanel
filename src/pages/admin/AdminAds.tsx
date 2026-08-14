import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { AdItem, AdPlacement, AdType } from '../../types';
import { Sparkles, Plus, Trash2, Edit3, Eye, MousePointerClick, CheckCircle, XCircle, RefreshCw, X } from 'lucide-react';

export const AdminAds: React.FC = () => {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState<AdItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [type, setType] = useState<AdType>('banner');
  const [placement, setPlacement] = useState<AdPlacement>('dashboard');
  const [priority, setPriority] = useState(5);
  const [frequencyCapPerSession, setFrequencyCapPerSession] = useState(5);

  const fetchAds = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res: any = await apiRequest('/ads/admin/list');
      if (res.success) {
        setAds(res.ads || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch advertisements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const handleOpenCreate = () => {
    setEditingAd(null);
    setTitle('');
    setDescription('');
    setImageUrl('');
    setDestinationUrl('');
    setType('banner');
    setPlacement('dashboard');
    setPriority(5);
    setFrequencyCapPerSession(5);
    setShowModal(true);
  };

  const handleOpenEdit = (ad: AdItem) => {
    setEditingAd(ad);
    setTitle(ad.title);
    setDescription(ad.description);
    setImageUrl(ad.imageUrl || '');
    setDestinationUrl(ad.destinationUrl);
    setType(ad.type);
    setPlacement(ad.placement);
    setPriority(ad.priority);
    setFrequencyCapPerSession(ad.frequencyCapPerSession);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !destinationUrl) return;

    try {
      setLoading(true);
      if (editingAd) {
        await apiRequest(`/ads/admin/${editingAd.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title, description, imageUrl, destinationUrl, type, placement, priority, frequencyCapPerSession
          })
        });
      } else {
        await apiRequest('/ads/admin/create', {
          method: 'POST',
          body: JSON.stringify({
            title, description, imageUrl, destinationUrl, type, placement, priority, frequencyCapPerSession
          })
        });
      }
      setShowModal(false);
      fetchAds();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save advertisement.');
      setLoading(false);
    }
  };

  const handleToggleActive = async (ad: AdItem) => {
    try {
      await apiRequest(`/ads/admin/${ad.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !ad.isActive })
      });
      fetchAds();
    } catch (err) {
      // Ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this advertisement campaign permanently?')) return;
    try {
      await apiRequest(`/ads/admin/${id}`, { method: 'DELETE' });
      fetchAds();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete advertisement.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-400" />
            Ad Campaign Manager
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Configure native placements, sponsored banners, frequency caps, and track live CTR metrics.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs rounded-xl shadow-md transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Ad Campaign
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-4 rounded-xl">
          {errorMsg}
        </div>
      )}

      {loading && ads.length === 0 ? (
        <div className="py-12 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-violet-500" />
          <span>Loading campaigns...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map(ad => {
            const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0';
            return (
              <div key={ad.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      {ad.placement}
                    </span>
                    <button
                      onClick={() => handleToggleActive(ad)}
                      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${
                        ad.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                      }`}
                    >
                      {ad.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {ad.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>

                  <h3 className="text-sm font-bold text-white mt-3">{ad.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{ad.description}</p>
                </div>

                <div className="space-y-3 pt-3 border-t border-zinc-800">
                  <div className="grid grid-cols-3 gap-2 text-center bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                    <div>
                      <span className="text-[10px] text-zinc-500 block flex items-center justify-center gap-1">
                        <Eye className="w-3 h-3 text-zinc-400" /> Impressions
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-200 mt-0.5 block">{ad.impressions}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block flex items-center justify-center gap-1">
                        <MousePointerClick className="w-3 h-3 text-violet-400" /> Clicks
                      </span>
                      <span className="text-xs font-mono font-bold text-violet-400 mt-0.5 block">{ad.clicks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">CTR</span>
                      <span className="text-xs font-mono font-bold text-emerald-400 mt-0.5 block">{ctr}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(ad)}
                      className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(ad.id)}
                      className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">
                {editingAd ? 'Edit Ad Campaign' : 'Create New Ad Campaign'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Campaign Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Upgrade to NVMe Pro Nodes"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Promotional subtitle or callout text..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Destination URL *</label>
                <input
                  type="text"
                  required
                  value={destinationUrl}
                  onChange={e => setDestinationUrl(e.target.value)}
                  placeholder="e.g. /pricing or https://..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Ad Type</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as AdType)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="banner">Banner</option>
                    <option value="card">Native Card</option>
                    <option value="announcement">Announcement</option>
                    <option value="sponsored">Sponsored</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Placement Surface</label>
                  <select
                    value={placement}
                    onChange={e => setPlacement(e.target.value as AdPlacement)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="dashboard">Dashboard</option>
                    <option value="server_list">Server List</option>
                    <option value="server_page">Server Page</option>
                    <option value="file_manager">File Manager</option>
                    <option value="billing">Billing</option>
                    <option value="public">Public Landing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Priority (1-10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={priority}
                    onChange={e => setPriority(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Session Frequency Cap</label>
                  <input
                    type="number"
                    min={1}
                    value={frequencyCapPerSession}
                    onChange={e => setFrequencyCapPerSession(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors shadow-md"
                >
                  Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
