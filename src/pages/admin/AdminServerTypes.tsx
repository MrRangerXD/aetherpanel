import React, { useState, useEffect } from 'react';
import {
  Layers, Plus, Search, Edit2, Trash2, Copy, RotateCcw,
  Upload, Image as ImageIcon, Palette, Eye, Check, AlertTriangle,
  Server, Shield, Sparkles, Terminal, Globe, Filter, X
} from 'lucide-react';
import { ServerType, ServerTypeTheme } from '../../types';

export const AdminServerTypesPage: React.FC = () => {
  const [serverTypes, setServerTypes] = useState<ServerType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Active target objects
  const [editingType, setEditingType] = useState<Partial<ServerType>>({});
  const [editingTheme, setEditingTheme] = useState<Partial<ServerTypeTheme>>({});
  const [deletingType, setDeletingType] = useState<ServerType | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchServerTypes();
  }, []);

  const fetchServerTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/server-types/admin');
      const json = await res.json();
      if (json.success) {
        setServerTypes(json.data || []);
      } else {
        setError(json.error?.message || 'Failed to load server types');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching server types');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const isNew = !editingType.id;
      const url = isNew ? '/api/v1/server-types/admin' : `/api/v1/server-types/admin/${editingType.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingType)
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`Server type ${isNew ? 'created' : 'updated'} successfully`);
        setIsCreateOpen(false);
        setIsEditOpen(false);
        fetchServerTypes();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(json.error?.message || 'Failed to save server type');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving server type');
    }
  };

  const handleSaveTheme = async () => {
    if (!editingType.id) return;
    setError(null);
    try {
      const res = await fetch(`/api/v1/server-types/admin/${editingType.id}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTheme)
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg('Server type theme updated successfully');
        setIsThemeEditorOpen(false);
        fetchServerTypes();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(json.error?.message || 'Failed to save theme');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving theme');
    }
  };

  const handleResetTheme = async (id: string) => {
    if (!confirm('Are you sure you want to reset this theme to system default?')) return;
    try {
      const res = await fetch(`/api/v1/server-types/admin/${id}/theme/reset`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg('Theme reset to defaults');
        fetchServerTypes();
        if (editingType.id === id) {
          setEditingTheme(json.data);
        }
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/server-types/admin/${id}/duplicate`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg('Server type duplicated successfully');
        fetchServerTypes();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(json.error?.message || 'Failed to duplicate');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deletingType) return;
    setDeleteError(null);
    try {
      const q = reassignTargetId ? `?reassignToId=${reassignTargetId}` : '';
      const res = await fetch(`/api/v1/server-types/admin/${deletingType.id}${q}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`Server type ${deletingType.name} deleted`);
        setIsDeleteOpen(false);
        setDeletingType(null);
        setReassignTargetId('');
        fetchServerTypes();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setDeleteError(json.error?.message || 'Failed to delete server type');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting server type');
    }
  };

  const handleAssetFileUpload = async (file: File, field: 'backgroundUrl' | 'iconUrl') => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('asset', file);

      const res = await fetch('/api/v1/server-types/admin/upload-asset', {
        method: 'POST',
        body: formData
      });

      const json = await res.json();
      if (json.success && json.data?.url) {
        setEditingTheme(prev => ({
          ...prev,
          [field]: json.data.url
        }));
        setSuccessMsg('Asset uploaded successfully');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(json.error?.message || 'Asset upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const categories = ['all', 'Minecraft', 'Discord Bots', 'Web & Runtime', 'Custom'];

  const filteredTypes = serverTypes.filter(st => {
    const matchesCategory = selectedCategory === 'all' || st.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.runtime.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 font-medium text-xs tracking-wider uppercase">
            <Layers className="h-4 w-4" />
            <span>Server Type & Visual Theme Management</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Server Types & Themes</h1>
          <p className="text-sm text-zinc-400">
            Define runtime specifications, default startup commands, and distinct visual theme banners for user server cards.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingType({
              name: '',
              category: 'Minecraft',
              runtime: 'Java',
              description: '',
              icon: 'Server',
              enabled: true,
              sortOrder: serverTypes.length + 1,
              defaultPort: 25565,
              defaultStartupCommand: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui'
            });
            setIsCreateOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/10 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Server Type</span>
        </button>
      </div>

      {/* Success / Error Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap ${selectedCategory === cat ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white hover:bg-zinc-800'}`}
            >
              {cat === 'all' ? 'All Types' : cat}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search server types..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Server Types Grid */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500">
          <div className="animate-spin h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-2" />
          <span>Loading server types...</span>
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="p-12 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl text-center space-y-3">
          <Layers className="h-8 w-8 text-zinc-600 mx-auto" />
          <h3 className="text-zinc-300 font-medium text-sm">No Server Types Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            No server types match your search criteria or category filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTypes.map(st => {
            const theme: Partial<ServerTypeTheme> = st.theme || {};
            const accent = theme.accentColor || '#8B5CF6';
            const bgUrl = theme.backgroundUrl || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80';

            return (
              <div
                key={st.id}
                className="group relative bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between"
              >
                {/* Visual Banner Preview */}
                <div className="relative h-36 w-full overflow-hidden bg-zinc-950">
                  <img
                    src={bgUrl}
                    alt={st.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0 transition-opacity"
                    style={{
                      backgroundColor: 'rgba(9, 9, 11, 0.65)',
                      backgroundImage: theme.gradientEnabled !== false
                        ? `linear-gradient(to bottom, rgba(9,9,11,0.2), rgba(9,9,11,0.95))`
                        : 'none'
                    }}
                  />

                  {/* Top Badge Overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider text-white shadow-md"
                      style={{ backgroundColor: `${accent}DD` }}
                    >
                      {st.category}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${st.enabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                    >
                      {st.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  {/* Runtime Icon & Title overlay */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end gap-3">
                    {theme.iconUrl ? (
                      <img src={theme.iconUrl} alt="logo" className="h-10 w-10 rounded-xl object-contain bg-zinc-900/80 p-1 border border-zinc-700/50" />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                        style={{ backgroundColor: accent }}
                      >
                        {st.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white truncate drop-shadow">{st.name}</h3>
                      <p className="text-xs text-zinc-300 font-mono truncate">{st.runtime}</p>
                    </div>
                  </div>
                </div>

                {/* Info Content */}
                <div className="p-4 space-y-3 flex-1 bg-zinc-900/90">
                  <p className="text-xs text-zinc-400 line-clamp-2 min-h-[2rem]">
                    {st.description || 'No custom description provided for this server type.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                    <div>
                      <span className="text-zinc-500 block">Default Port</span>
                      <span className="text-zinc-200 font-mono font-medium">{st.defaultPort || 'Dynamic'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Accent Color</span>
                      <div className="flex items-center gap-1.5 font-mono text-zinc-200">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                        <span>{accent}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingType(st);
                        setIsEditOpen(true);
                      }}
                      title="Edit Type Specs"
                      className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-xs flex items-center gap-1"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Specs</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingType(st);
                        setEditingTheme(st.theme || {});
                        setIsThemeEditorOpen(true);
                      }}
                      title="Customize Visual Theme"
                      className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors text-xs flex items-center gap-1 font-medium"
                    >
                      <Palette className="h-3.5 w-3.5" />
                      <span>Theme</span>
                    </button>

                    <button
                      onClick={() => handleDuplicate(st.id)}
                      title="Duplicate Type"
                      className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setDeletingType(st);
                      setIsDeleteOpen(true);
                    }}
                    title="Delete Server Type"
                    className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT SERVER TYPE MODAL */}
      {(isCreateOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <Layers className="h-4 w-4" />
                <span>{isCreateOpen ? 'Create Server Type' : 'Edit Server Type'}</span>
              </div>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setIsEditOpen(false);
                }}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveType} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Server Type Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Minecraft Java Edition"
                    value={editingType.name || ''}
                    onChange={e => setEditingType({ ...editingType, name: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Category</label>
                  <select
                    value={editingType.category || 'Minecraft'}
                    onChange={e => setEditingType({ ...editingType, category: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Minecraft">Minecraft</option>
                    <option value="Discord Bots">Discord Bots</option>
                    <option value="Web & Runtime">Web & Runtime</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Runtime Specification *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Java 17/21 or Node.js v20"
                    value={editingType.runtime || ''}
                    onChange={e => setEditingType({ ...editingType, runtime: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Default Port</label>
                  <input
                    type="number"
                    placeholder="25565"
                    value={editingType.defaultPort || ''}
                    onChange={e => setEditingType({ ...editingType, defaultPort: parseInt(e.target.value, 10) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Short summary of this server type for user deployment tooltips"
                  value={editingType.description || ''}
                  onChange={e => setEditingType({ ...editingType, description: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Default Startup Command</label>
                <input
                  type="text"
                  placeholder="e.g. java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui"
                  value={editingType.defaultStartupCommand || ''}
                  onChange={e => setEditingType({ ...editingType, defaultStartupCommand: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingType.enabled !== false}
                    onChange={e => setEditingType({ ...editingType, enabled: e.target.checked })}
                    className="rounded bg-zinc-950 border-zinc-800 text-amber-500 focus:ring-amber-500/20"
                  />
                  <span>Enable for Customer Server Deployment</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setIsEditOpen(false);
                  }}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-xl"
                >
                  Save Server Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* THEME CUSTOMIZATION EDITOR MODAL WITH LIVE CARD PREVIEW */}
      {isThemeEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-base">
                <Palette className="h-5 w-5" />
                <span>Customize Visual Theme: {editingType.name}</span>
              </div>
              <button
                onClick={() => setIsThemeEditorOpen(false)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Form Controls */}
              <div className="space-y-5 text-xs">
                {/* Background Banner */}
                <div className="space-y-2">
                  <label className="block text-zinc-300 font-medium">Background / Banner Image</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={editingTheme.backgroundUrl || ''}
                      onChange={e => setEditingTheme({ ...editingTheme, backgroundUrl: e.target.value })}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                    <label className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl cursor-pointer flex items-center gap-1.5 shrink-0">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          if (e.target.files?.[0]) {
                            handleAssetFileUpload(e.target.files[0], 'backgroundUrl');
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Runtime Logo / Icon */}
                <div className="space-y-2">
                  <label className="block text-zinc-300 font-medium">Runtime Logo / Icon Asset</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={editingTheme.iconUrl || ''}
                      onChange={e => setEditingTheme({ ...editingTheme, iconUrl: e.target.value })}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                    <label className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl cursor-pointer flex items-center gap-1.5 shrink-0">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          if (e.target.files?.[0]) {
                            handleAssetFileUpload(e.target.files[0], 'iconUrl');
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Accent Color Picker */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingTheme.accentColor || '#8B5CF6'}
                        onChange={e => setEditingTheme({ ...editingTheme, accentColor: e.target.value })}
                        className="h-9 w-12 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={editingTheme.accentColor || '#8B5CF6'}
                        onChange={e => setEditingTheme({ ...editingTheme, accentColor: e.target.value })}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Overlay Opacity ({Math.round((editingTheme.overlayOpacity || 0.6) * 100)}%)</label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.05"
                      value={editingTheme.overlayOpacity || 0.6}
                      onChange={e => setEditingTheme({ ...editingTheme, overlayOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 mt-2"
                    />
                  </div>
                </div>

                {/* Card Styles & Features */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Card Style Preset</label>
                    <select
                      value={editingTheme.cardStyle || 'default'}
                      onChange={e => setEditingTheme({ ...editingTheme, cardStyle: e.target.value as any })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="default">Default Banner Card</option>
                      <option value="compact">Compact Minimal Card</option>
                      <option value="glass">Glassmorphism Overlay</option>
                      <option value="bordered">Thick Border Accent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Status Indicator</label>
                    <select
                      value={editingTheme.statusStyle || 'pill'}
                      onChange={e => setEditingTheme({ ...editingTheme, statusStyle: e.target.value as any })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="pill">Pill Badge</option>
                      <option value="dot">Simple Dot</option>
                      <option value="pulse">Animated Pulse Glow</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTheme.gradientEnabled !== false}
                      onChange={e => setEditingTheme({ ...editingTheme, gradientEnabled: e.target.checked })}
                      className="rounded bg-zinc-950 border-zinc-800 text-amber-500 focus:ring-amber-500/20"
                    />
                    <span>Enable Dark Bottom Gradient Fade</span>
                  </label>
                </div>
              </div>

              {/* Right Column: Live Card Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <Eye className="h-4 w-4" />
                    <span>Live Server Card Preview</span>
                  </div>
                  <span>Customer View</span>
                </div>

                {/* Simulated Server Card with exact applied styling */}
                <div
                  className={`relative rounded-2xl overflow-hidden transition-all duration-300 border ${editingTheme.cardStyle === 'glass' ? 'border-2' : 'border'}`}
                  style={{
                    borderColor: editingTheme.cardStyle === 'glass' ? editingTheme.accentColor : '#27272a',
                    backgroundColor: '#18181b'
                  }}
                >
                  {/* Banner Image */}
                  <div className="relative h-44 w-full overflow-hidden bg-zinc-950">
                    <img
                      src={editingTheme.backgroundUrl || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80'}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundColor: `rgba(9, 9, 11, ${editingTheme.overlayOpacity ?? 0.6})`,
                        backgroundImage: editingTheme.gradientEnabled !== false
                          ? `linear-gradient(to bottom, rgba(9,9,11,0.1), rgba(9,9,11,0.95))`
                          : 'none'
                      }}
                    />

                    {/* Badge Overlay */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase text-white shadow-md"
                        style={{ backgroundColor: `${editingTheme.accentColor || '#8B5CF6'}EE` }}
                      >
                        {editingType.category || 'Minecraft'}
                      </span>

                      {/* Status indicator preview */}
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>ONLINE</span>
                      </span>
                    </div>

                    {/* Icon and Title */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end gap-3">
                      {editingTheme.iconUrl ? (
                        <img src={editingTheme.iconUrl} alt="icon" className="h-12 w-12 rounded-xl object-contain bg-zinc-900/90 p-1.5 border border-zinc-700/50 shadow-lg" />
                      ) : (
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg"
                          style={{ backgroundColor: editingTheme.accentColor || '#8B5CF6' }}
                        >
                          {(editingType.name || 'MC').substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-white truncate drop-shadow">Survival Realm #1</h4>
                        <p className="text-xs text-zinc-300 font-mono truncate">{editingType.runtime || 'Java Edition'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Body Specs simulation */}
                  <div className="p-4 space-y-3 bg-zinc-900/95">
                    <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                      <span>play.aetherpanel.net:25565</span>
                      <span className="text-emerald-400 font-semibold">12 / 100 Players</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                      <div>
                        <span className="text-zinc-500 block">CPU Usage</span>
                        <span className="text-zinc-200 font-mono font-medium">18.4%</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">RAM Usage</span>
                        <span className="text-zinc-200 font-mono font-medium">1.8 / 4 GB</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Storage</span>
                        <span className="text-zinc-200 font-mono font-medium">12.4 GB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => editingType.id && handleResetTheme(editingType.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset to Default Theme</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsThemeEditorOpen(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTheme}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-xl text-xs shadow-lg shadow-amber-500/10"
                >
                  Save Theme Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG WITH REASSIGNMENT */}
      {isDeleteOpen && deletingType && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-500/10 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Delete Server Type</h3>
            </div>

            <p className="text-xs text-zinc-300">
              Are you sure you want to delete <strong className="text-white">{deletingType.name}</strong>?
            </p>

            {deleteError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs space-y-2">
                <p>{deleteError}</p>
                <div className="space-y-1 pt-1">
                  <label className="block font-medium text-zinc-300">Reassign active servers to another type:</label>
                  <select
                    value={reassignTargetId}
                    onChange={e => setReassignTargetId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none"
                  >
                    <option value="">Select target server type...</option>
                    {serverTypes
                      .filter(st => st.id !== deletingType.id)
                      .map(st => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.runtime})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setDeletingType(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-xs"
              >
                Delete Server Type
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminServerTypesPage;
