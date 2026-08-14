import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Announcement } from '../../types';

export const AdminAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // New Announcement
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'info' | 'maintenance' | 'update' | 'warning'>('info');

  const fetchAnnouncements = async () => {
    const res = await apiRequest('/admin/announcements');
    if (res.success && res.data) {
      setAnnouncements(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    await apiRequest('/admin/announcements/create', {
      method: 'POST',
      body: JSON.stringify({ title, content, type })
    });
    setTitle('');
    setContent('');
    setShowModal(false);
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    await apiRequest(`/admin/announcements/${id}`, { method: 'DELETE' });
    fetchAnnouncements();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-amber-400" /> Platform System Announcements
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Publish maintenance banners, version updates, or status notices.</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Publish Notice
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading announcements...</div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div key={a.id} className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-2 flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono capitalize border ${
                    a.type === 'maintenance' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    a.type === 'warning' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    'bg-violet-500/10 text-violet-400 border-violet-500/20'
                  }`}>
                    {a.type}
                  </span>
                  <span className="text-[10px] text-zinc-500">{a.createdAt}</span>
                </div>

                <h3 className="text-base font-bold text-white">{a.title}</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">{a.content}</p>
              </div>

              <button onClick={() => handleDelete(a.id)} className="p-2 text-zinc-500 hover:text-rose-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAnnouncement} className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">Create System Notice</h3>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Scheduled Datacenter Maintenance"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Notice Category</label>
              <select
                value={type}
                onChange={(e: any) => setType(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white capitalize"
              >
                <option value="info">Info</option>
                <option value="maintenance">Maintenance</option>
                <option value="update">Update</option>
                <option value="warning">Warning</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="Details regarding upcoming node updates..."
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs text-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 bg-amber-500 text-xs text-zinc-950 font-bold rounded-xl">
                Publish
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
