import React, { useState, useEffect, useCallback } from 'react';
import { Server, InstalledPlugin, ModrinthProject, ModrinthVersion, PluginUpdate } from '../../types';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import {
  Package, Search, Download, Trash2, Power, RefreshCw, AlertTriangle,
  ExternalLink, CheckCircle, Clock, Link, Check, X
} from 'lucide-react';

interface PluginManagerProps {
  server: Server;
}

export const PluginManager: React.FC<PluginManagerProps> = ({ server }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'installed' | 'search'>('installed');

  // Installed State
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(true);
  const [updates, setUpdates] = useState<PluginUpdate[]>([]);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search State
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ModrinthProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Direct URL Install State
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [directUrl, setDirectUrl] = useState('');
  const [directFilename, setDirectFilename] = useState('');
  const [installingDirect, setInstallingDirect] = useState(false);

  // Fetch installed plugins
  const fetchInstalled = useCallback(async () => {
    setLoadingInstalled(true);
    try {
      const res = await apiRequest<InstalledPlugin[]>(
        `/servers/${server.id}/plugins/installed`
      );
      if (res.success) {
        setInstalled(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch installed plugins');
    } finally {
      setLoadingInstalled(false);
    }
  }, [server.id, toast]);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  // Check for updates
  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const res = await apiRequest<PluginUpdate[]>(
        `/servers/${server.id}/plugins/updates`
      );
      if (res.success) {
        setUpdates(res.data || []);
        if (res.data?.length === 0) {
          toast.info('All installed plugins are up to date!');
        } else {
          toast.warning(`Found ${res.data.length} plugin update(s) available.`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to check plugin updates');
    } finally {
      setCheckingUpdates(false);
    }
  };

  // Toggle Plugin Enabled/Disabled
  const handleToggle = async (plugin: InstalledPlugin) => {
    setActionLoading(plugin.filename);
    try {
      const res = await apiRequest<{ success: boolean; enabled: boolean; message: string; restartRequired: boolean }>(
        `/servers/${server.id}/plugins/${encodeURIComponent(plugin.filename)}/toggle`,
        { method: 'POST' }
      );
      if (res.success) {
        toast.success(res.message);
        if (res.restartRequired) {
          toast.info('Restart server for changes to take effect.');
        }
        await fetchInstalled();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle plugin state');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Plugin
  const handleDelete = async (filename: string) => {
    setActionLoading(filename);
    try {
      const res = await apiRequest<{ success: boolean; message: string; restartRequired: boolean }>(
        `/servers/${server.id}/plugins/${encodeURIComponent(filename)}`,
        { method: 'DELETE' }
      );
      if (res.success) {
        toast.success(res.message);
        await fetchInstalled();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete plugin');
    } finally {
      setActionLoading(null);
    }
  };

  // Search Modrinth
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await apiRequest<ModrinthProject[]>(
        `/servers/${server.id}/plugins/search?q=${encodeURIComponent(query.trim())}`
      );
      if (res.success) {
        setSearchResults(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Modrinth search failed');
    } finally {
      setSearching(false);
    }
  };

  // Open Version Picker for Modrinth Project
  const handleOpenVersions = async (project: ModrinthProject) => {
    setSelectedProject(project);
    setLoadingVersions(true);
    try {
      const res = await apiRequest<ModrinthVersion[]>(
        `/servers/${server.id}/plugins/versions/${project.id}`
      );
      if (res.success) {
        setVersions(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load project versions');
    } finally {
      setLoadingVersions(false);
    }
  };

  // Install Specific Version
  const handleInstallVersion = async (projectId: string, versionId: string) => {
    setActionLoading(versionId);
    try {
      const res = await apiRequest<{ success: boolean; message: string; restartRequired: boolean }>(
        `/servers/${server.id}/plugins/install`,
        {
          method: 'POST',
          body: JSON.stringify({ projectId, versionId })
        }
      );
      if (res.success) {
        toast.success(res.message);
        if (res.restartRequired) {
          toast.info('Restart server to load new plugin.');
        }
        setSelectedProject(null);
        await fetchInstalled();
      }
    } catch (err: any) {
      toast.error(err.message || 'Installation failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Direct URL Install
  const handleDirectInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUrl || !directFilename) return;
    setInstallingDirect(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/servers/${server.id}/plugins/install-file`,
        {
          method: 'POST',
          body: JSON.stringify({ url: directUrl.trim(), filename: directFilename.trim() })
        }
      );
      if (res.success) {
        toast.success(res.message);
        setShowDirectModal(false);
        setDirectUrl('');
        setDirectFilename('');
        await fetchInstalled();
      }
    } catch (err: any) {
      toast.error(err.message || 'Direct install failed');
    } finally {
      setInstallingDirect(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-line)] pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-ink)]">
            <Package className="w-5 h-5 text-[var(--color-accent)]" />
            Plugin Manager
          </h2>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1">
            Browse, install, and configure Spigot/Paper plugins powered by Modrinth API
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--color-surface-2)] p-1 rounded-lg border border-[var(--color-line)]">
            <button
              onClick={() => setActiveTab('installed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'installed'
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
              }`}
            >
              Installed ({installed.length})
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'search'
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
              }`}
            >
              Search Modrinth
            </button>
          </div>

          <button
            onClick={() => setShowDirectModal(true)}
            className="btn px-3 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-accent)] flex items-center gap-1.5"
          >
            <Link className="w-3.5 h-3.5" />
            Direct URL
          </button>
        </div>
      </div>

      {/* Installed Tab */}
      {activeTab === 'installed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-ink-dim)]">
              {installed.length} plugin{installed.length === 1 ? '' : 's'} in{' '}
              <code className="text-[var(--color-ink)]">plugins/</code>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCheckUpdates}
                disabled={checkingUpdates}
                className="btn px-3 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-accent)] flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdates ? 'animate-spin' : ''}`} />
                Check Updates
              </button>
              <button
                onClick={fetchInstalled}
                disabled={loadingInstalled}
                className="btn px-3 py-1.5 text-xs border border-[var(--color-line)]"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Updates notice banner */}
          {updates.length > 0 && (
            <div className="surface p-4 border border-[var(--color-warn)] bg-[var(--color-warn)]/5 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-warn)]">
                <AlertTriangle className="w-4 h-4" />
                {updates.length} Outdated Plugin{updates.length === 1 ? '' : 's'} Detected
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {updates.map(u => (
                  <div key={u.filename} className="flex items-center justify-between p-2 rounded bg-[var(--color-surface)] border border-[var(--color-line)]">
                    <div>
                      <span className="font-mono font-medium text-[var(--color-ink)]">{u.filename}</span>
                      <span className="block text-[10px] text-[var(--color-ink-dim)]">
                        {u.currentVersion || 'Current'} &rarr; <span className="text-[var(--color-ok)]">{u.latestVersion}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingInstalled ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="surface h-14 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : installed.length === 0 ? (
            <div className="surface p-12 text-center rounded-lg border border-[var(--color-line)]">
              <Package className="w-10 h-10 mx-auto text-[var(--color-ink-mute)] mb-3" />
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">No plugins installed</h3>
              <p className="text-xs text-[var(--color-ink-dim)] mt-1 max-w-sm mx-auto">
                No .jar files detected in your server's plugins directory. Search Modrinth or upload directly.
              </p>
              <button
                onClick={() => setActiveTab('search')}
                className="btn-primary mt-4 px-4 py-2 text-xs font-semibold"
              >
                Browse Plugins
              </button>
            </div>
          ) : (
            <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
              {installed.map(plugin => {
                const isDis = !plugin.enabled;
                const isLoading = actionLoading === plugin.filename;
                return (
                  <div
                    key={plugin.filename}
                    className={`p-3 sm:p-4 flex items-center justify-between gap-4 transition-colors ${
                      isDis ? 'opacity-60 bg-[var(--color-surface-2)]/30' : 'hover:bg-[var(--color-surface-2)]/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg border ${
                        plugin.enabled
                          ? 'border-[var(--color-accent)]/30 text-[var(--color-accent)] bg-[var(--color-accent)]/5'
                          : 'border-[var(--color-line)] text-[var(--color-ink-mute)] bg-[var(--color-surface-2)]'
                      }`}>
                        <Package className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs sm:text-sm font-semibold text-[var(--color-ink)] truncate">
                            {plugin.name || plugin.filename}
                          </span>
                          {plugin.version && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-surface-3)] text-[var(--color-ink-dim)] font-mono">
                              v{plugin.version}
                            </span>
                          )}
                          {isDis && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-line)] text-[var(--color-ink-mute)]">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[var(--color-ink-dim)] mt-0.5 font-mono">
                          <span>{formatBytes(plugin.size)}</span>
                          <span>&bull;</span>
                          <span>{new Date(plugin.modified).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggle(plugin)}
                        disabled={isLoading}
                        title={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
                        className={`btn p-2 text-xs rounded-md border ${
                          plugin.enabled
                            ? 'border-[var(--color-ok)]/40 text-[var(--color-ok)] hover:bg-[var(--color-ok)]/10'
                            : 'border-[var(--color-line)] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(plugin.filename)}
                        disabled={isLoading}
                        title="Delete plugin"
                        className="btn p-2 text-xs rounded-md border border-[var(--color-line)] hover:border-[var(--color-err)] hover:text-[var(--color-err)]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Search Modrinth Tab */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-dim)]" />
              <input
                type="text"
                placeholder="Search Spigot / Paper plugins (e.g. EssentialsX, LuckPerms, Vault)..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="field w-full pl-9 pr-3 py-2 text-xs bg-[var(--color-surface)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] placeholder-[var(--color-ink-mute)]"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
            >
              {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Search
            </button>
          </form>

          {searching ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="surface h-20 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="surface p-12 text-center rounded-lg border border-[var(--color-line)]">
              <Search className="w-8 h-8 mx-auto text-[var(--color-ink-mute)] mb-2" />
              <p className="text-xs text-[var(--color-ink-dim)]">
                {query ? 'No matching plugins found. Try a different keyword.' : 'Type a query above to search Modrinth.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.map(project => (
                <div
                  key={project.id}
                  className="surface p-4 rounded-lg border border-[var(--color-line)] flex flex-col justify-between hover:border-[var(--color-line-soft)] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {project.icon_url ? (
                      <img
                        src={project.icon_url}
                        alt={project.title}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[var(--color-line)]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center shrink-0 border border-[var(--color-line)] text-[var(--color-accent)]">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-[var(--color-ink)] truncate">
                          {project.title}
                        </h4>
                        <span className="text-[10px] text-[var(--color-ink-dim)] font-mono shrink-0">
                          {project.downloads.toLocaleString()} dl
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-ink-dim)] mt-1 line-clamp-2">
                        {project.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {project.categories.slice(0, 3).map(cat => (
                          <span
                            key={cat}
                            className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--color-surface-2)] text-[var(--color-ink-dim)] font-mono"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
                    <a
                      href={`https://modrinth.com/plugin/${project.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] flex items-center gap-1"
                    >
                      View on Modrinth
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      onClick={() => handleOpenVersions(project)}
                      className="btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Versions & Install
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Version Selector Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="surface w-full max-w-xl max-h-[85vh] rounded-lg border border-[var(--color-line)] flex flex-col overflow-hidden bg-[var(--color-surface)]">
            <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">
                  Install {selectedProject.title}
                </h3>
                <p className="text-xs text-[var(--color-ink-dim)]">Select version compatible with Minecraft {server.version || 'server'}</p>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {loadingVersions ? (
                <div className="py-8 text-center text-xs text-[var(--color-ink-dim)]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--color-accent)]" />
                  Loading version manifest...
                </div>
              ) : versions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--color-ink-dim)]">
                  No versions found for this project.
                </div>
              ) : (
                versions.slice(0, 15).map(ver => {
                  const isInstalling = actionLoading === ver.id;
                  const isCompatible = (ver as any).compatible !== false;
                  return (
                    <div
                      key={ver.id}
                      className="p-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[var(--color-ink)]">
                            {ver.version_number}
                          </span>
                          <span className="text-[10px] text-[var(--color-ink-dim)] truncate">
                            {ver.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] text-[var(--color-ink-dim)]">
                          <span>MC: {ver.game_versions.slice(0, 3).join(', ')}</span>
                          <span>&bull;</span>
                          <span>{new Date(ver.date_published).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleInstallVersion(selectedProject.id, ver.id)}
                        disabled={isInstalling}
                        className="btn-primary px-3 py-1.5 text-xs font-semibold shrink-0 flex items-center gap-1.5"
                      >
                        {isInstalling ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Install
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Direct URL Modal */}
      {showDirectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleDirectInstall}
            className="surface w-full max-w-md rounded-lg border border-[var(--color-line)] p-5 space-y-4 bg-[var(--color-surface)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                <Link className="w-4 h-4 text-[var(--color-accent)]" />
                Direct Plugin Download
              </h3>
              <button
                type="button"
                onClick={() => setShowDirectModal(false)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label text-xs block mb-1">Direct .jar Download URL</label>
              <input
                type="url"
                required
                placeholder="https://example.com/downloads/Plugin.jar"
                value={directUrl}
                onChange={e => {
                  setDirectUrl(e.target.value);
                  if (!directFilename) {
                    try {
                      const pathname = new URL(e.target.value).pathname;
                      const base = pathname.split('/').pop() || '';
                      if (base) setDirectFilename(base);
                    } catch {}
                  }
                }}
                className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
            </div>

            <div>
              <label className="label text-xs block mb-1">Target Filename</label>
              <input
                type="text"
                required
                placeholder="MyPlugin.jar"
                value={directFilename}
                onChange={e => setDirectFilename(e.target.value)}
                className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDirectModal(false)}
                className="btn px-4 py-2 text-xs border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={installingDirect}
                className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              >
                {installingDirect ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Download & Install
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default PluginManager;
