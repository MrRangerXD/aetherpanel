import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Copy, Trash2, CheckCircle, XCircle, Gamepad2, Bot, Terminal, Zap, Search, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { ServerTemplate } from '../../types';

export const AdminTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<ServerTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'minecraft' | 'bot' | 'other'>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ServerTemplate | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'minecraft' | 'bot' | 'other'>('minecraft');
  const [runtime, setRuntime] = useState<'minecraft' | 'python' | 'nodejs'>('minecraft');
  const [icon, setIcon] = useState('Gamepad2');
  const [versionsText, setVersionsText] = useState('1.20.4, 1.20.2, 1.19.4');
  const [defaultVersion, setDefaultVersion] = useState('1.20.4');
  const [startupCommand, setStartupCommand] = useState('java -Xms512M -Xmx{RAM_MB}M -jar server.jar nogui');
  const [envVarsText, setEnvVarsText] = useState('EULA=true\nSERVER_PORT={PORT}');
  const [defaultPort, setDefaultPort] = useState(25565);
  const [recommendedRamMB, setRecommendedRamMB] = useState(2048);
  const [recommendedCpuCores, setRecommendedCpuCores] = useState(1);
  const [recommendedDiskGB, setRecommendedDiskGB] = useState(15);
  const [status, setStatus] = useState<'active' | 'maintenance' | 'disabled'>('active');
  const [isPopular, setIsPopular] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    const res = await apiRequest('/templates/admin/list');
    if (res.success && res.data) {
      setTemplates(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setName('');
    setDescription('');
    setCategory('minecraft');
    setRuntime('minecraft');
    setIcon('Gamepad2');
    setVersionsText('1.20.4, 1.20.2, 1.19.4');
    setDefaultVersion('1.20.4');
    setStartupCommand('java -Xms512M -Xmx{RAM_MB}M -jar server.jar nogui');
    setEnvVarsText('EULA=true\nSERVER_PORT={PORT}');
    setDefaultPort(25565);
    setRecommendedRamMB(2048);
    setRecommendedCpuCores(1);
    setRecommendedDiskGB(15);
    setStatus('active');
    setIsPopular(false);
    setShowModal(true);
  };

  const openEditModal = (tpl: ServerTemplate) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setDescription(tpl.description || '');
    setCategory(tpl.category);
    setRuntime(tpl.runtime);
    setIcon(tpl.icon || 'Gamepad2');
    setVersionsText(tpl.versions.join(', '));
    setDefaultVersion(tpl.defaultVersion || tpl.versions[0] || '');
    setStartupCommand(tpl.startupCommand);
    
    // Convert environmentVars object to key=value text lines
    const envLines = Object.entries(tpl.environmentVars || {}).map(([k, v]) => `${k}=${v}`).join('\n');
    setEnvVarsText(envLines);
    
    setDefaultPort(tpl.defaultPort || 25565);
    setRecommendedRamMB(tpl.recommendedRamMB || 2048);
    setRecommendedCpuCores(tpl.recommendedCpuCores || 1);
    setRecommendedDiskGB(tpl.recommendedDiskGB || 15);
    setStatus(tpl.status);
    setIsPopular(Boolean(tpl.isPopular));
    setShowModal(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    // Parse versions
    const versions = versionsText.split(',').map(s => s.trim()).filter(Boolean);
    
    // Parse environment vars
    const environmentVars: Record<string, string> = {};
    envVarsText.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (key) environmentVars[key] = value;
      }
    });

    const payload = {
      name,
      description,
      category,
      runtime,
      icon,
      versions,
      defaultVersion: defaultVersion || versions[0] || '',
      startupCommand,
      environmentVars,
      defaultPort,
      recommendedRamMB,
      recommendedCpuCores,
      recommendedDiskGB,
      status,
      isPopular
    };

    let res;
    if (editingTemplate) {
      res = await apiRequest(`/templates/admin/${editingTemplate.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      res = await apiRequest('/templates/admin/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    if (res.success) {
      setActionSuccess(editingTemplate ? 'Template updated successfully' : 'Template created successfully');
      setShowModal(false);
      fetchTemplates();
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(res.error?.message || 'Failed to save template');
    }
  };

  const handleDuplicate = async (id: string) => {
    setActionError(null);
    const res = await apiRequest(`/templates/admin/${id}/duplicate`, { method: 'POST' });
    if (res.success) {
      setActionSuccess('Template duplicated');
      fetchTemplates();
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(res.error?.message || 'Failed to duplicate template');
    }
  };

  const handleDelete = async (id: string, tplName: string) => {
    if (!window.confirm(`Are you sure you want to delete template "${tplName}"?`)) return;
    setActionError(null);
    const res = await apiRequest(`/templates/admin/${id}`, { method: 'DELETE' });
    if (res.success) {
      setActionSuccess('Template deleted');
      fetchTemplates();
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(res.error?.message || 'Failed to delete template');
    }
  };

  const filteredTemplates = templates.filter(tpl => {
    const matchesSearch = tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tpl.runtime.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || tpl.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-amber-400" /> One-Click Server Templates
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Manage official production server templates for instant customer deployment.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition shadow-md shadow-amber-500/10"
        >
          <Plus className="h-4 w-4" /> Create New Template
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" /> {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" /> {actionError}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Total Templates</p>
          <p className="text-2xl font-bold text-white mt-1">{templates.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Active Templates</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{templates.filter(t => t.status === 'active').length}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Minecraft Servers</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{templates.filter(t => t.category === 'minecraft').length}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Discord & Web Bots</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{templates.filter(t => t.category === 'bot').length}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          {(['all', 'minecraft', 'bot', 'other'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition ${
                activeCategory === cat
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {cat === 'all' ? 'All Templates' : cat === 'bot' ? 'Bots & Scripts' : cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="py-12 text-center text-zinc-500 text-xs">Loading template definitions...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-xs bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
          No templates found matching filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/30 transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                      {tpl.category === 'minecraft' ? <Gamepad2 className="h-5 w-5" /> : tpl.category === 'bot' ? <Bot className="h-5 w-5" /> : <Terminal className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        {tpl.name}
                        {tpl.isPopular && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase rounded border border-amber-500/30">
                            Popular
                          </span>
                        )}
                      </h3>
                      <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">{tpl.runtime}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                      tpl.status === 'active'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : tpl.status === 'maintenance'
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}
                  >
                    {tpl.status}
                  </span>
                </div>

                <p className="text-xs text-zinc-400 mt-3 line-clamp-2 leading-relaxed">{tpl.description}</p>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/50">
                    <span className="text-[10px] text-zinc-500 block">Rec. RAM</span>
                    <span className="font-semibold text-zinc-300">{tpl.recommendedRamMB} MB</span>
                  </div>
                  <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/50">
                    <span className="text-[10px] text-zinc-500 block">Rec. CPU</span>
                    <span className="font-semibold text-zinc-300">{tpl.recommendedCpuCores} Core</span>
                  </div>
                  <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/50">
                    <span className="text-[10px] text-zinc-500 block">Versions</span>
                    <span className="font-semibold text-amber-400">{tpl.versions?.length || 0}</span>
                  </div>
                </div>

                <div className="mt-3 bg-zinc-950/80 p-2 rounded-lg border border-zinc-800/80 font-mono text-[10px] text-zinc-400 truncate">
                  <span className="text-amber-400/80">$</span> {tpl.startupCommand}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
                <button
                  onClick={() => handleDuplicate(tpl.id)}
                  title="Duplicate Template"
                  className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 rounded-md text-xs transition flex items-center gap-1"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => openEditModal(tpl)}
                  title="Edit Template"
                  className="p-1.5 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md text-xs transition flex items-center gap-1"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(tpl.id, tpl.name)}
                  title="Delete Template"
                  className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-md text-xs transition flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT TEMPLATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl my-8 p-6 space-y-5 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                {editingTemplate ? 'Edit Server Template' : 'Create One-Click Server Template'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Template Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paper 1.20.4 High Performance"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="minecraft">Minecraft Server</option>
                    <option value="bot">Discord / Application Bot</option>
                    <option value="other">Custom Web / Service</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe what this template installs and configures..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Runtime *</label>
                  <select
                    value={runtime}
                    onChange={(e) => setRuntime(e.target.value as any)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="minecraft">Java / Minecraft</option>
                    <option value="python">Python 3</option>
                    <option value="nodejs">Node.js / JavaScript</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="active">Active (Available)</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Default Port</label>
                  <input
                    type="number"
                    value={defaultPort}
                    onChange={(e) => setDefaultPort(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Rec. RAM (MB)</label>
                  <input
                    type="number"
                    value={recommendedRamMB}
                    onChange={(e) => setRecommendedRamMB(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Rec. CPU Cores</label>
                  <input
                    type="number"
                    step="0.5"
                    value={recommendedCpuCores}
                    onChange={(e) => setRecommendedCpuCores(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Rec. Disk (GB)</label>
                  <input
                    type="number"
                    value={recommendedDiskGB}
                    onChange={(e) => setRecommendedDiskGB(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Available Versions (Comma separated)</label>
                <input
                  type="text"
                  placeholder="1.20.4, 1.20.2, 1.19.4"
                  value={versionsText}
                  onChange={(e) => setVersionsText(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Startup Command *</label>
                <input
                  type="text"
                  required
                  placeholder="java -Xms512M -Xmx{RAM_MB}M -jar server.jar nogui"
                  value={startupCommand}
                  onChange={(e) => setStartupCommand(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Variables supported: &#123;RAM_MB&#125;, &#123;PORT&#125;, &#123;IP&#125;.</p>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Default Environment Variables (Key=Value per line)</label>
                <textarea
                  rows={3}
                  placeholder={"EULA=true\nSERVER_PORT={PORT}\nNODE_ENV=production"}
                  value={envVarsText}
                  onChange={(e) => setEnvVarsText(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isPopular"
                  checked={isPopular}
                  onChange={(e) => setIsPopular(e.target.checked)}
                  className="rounded border-zinc-800 bg-zinc-950 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="isPopular" className="text-zinc-300 font-medium">
                  Mark as Popular / Featured Template
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-lg transition shadow-md shadow-amber-500/10"
                >
                  {editingTemplate ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
