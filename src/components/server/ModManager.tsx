import React, { useState, useEffect, useCallback } from 'react';
import { Server, InstalledMod, ModrinthProject, ModDependency } from '../../types';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import {
  Boxes, Search, Download, Trash2, Power, RefreshCw, ExternalLink,
  Layers, UploadCloud, CheckCircle, X, Check, ShieldCheck
} from 'lucide-react';

interface ModManagerProps {
  server: Server;
}

export const ModManager: React.FC<ModManagerProps> = ({ server }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'installed' | 'search' | 'modpack'>('installed');

  // Installed State
  const [installed, setInstalled] = useState<InstalledMod[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search State
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'modrinth' | 'curseforge' | 'hangar'>('modrinth');
  const [searchResults, setSearchResults] = useState<ModrinthProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [detectedLoader, setDetectedLoader] = useState('fabric');

  // Dependencies Modal State
  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [dependencies, setDependencies] = useState<ModDependency[]>([]);
  const [selectedOptionals, setSelectedOptionals] = useState<string[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [installingDeps, setInstallingDeps] = useState(false);

  // Modpack Import State
  const [mrpackPath, setMrpackPath] = useState('');
  const [importingPack, setImportingPack] = useState(false);

  // Fetch installed mods
  const fetchInstalled = useCallback(async () => {
    setLoadingInstalled(true);
    try {
      const res = await apiRequest<InstalledMod[]>(
        `/servers/${server.id}/mods/installed`
      );
      if (res.success) {
        setInstalled(res.data || []);
        if (res.detectedLoader) setDetectedLoader(res.detectedLoader);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch installed mods');
    } finally {
      setLoadingInstalled(false);
    }
  }, [server.id, toast]);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  // Toggle Mod Enabled/Disabled
  const handleToggle = async (mod: InstalledMod) => {
    setActionLoading(mod.filename);
    try {
      const res = await apiRequest<{ success: boolean; enabled: boolean; message: string; restartRequired: boolean }>(
        `/servers/${server.id}/mods/${encodeURIComponent(mod.filename)}/toggle`,
        { method: 'POST' }
      );
      if (res.success) {
        toast.success(res.message);
        if (res.restartRequired) toast.info('Restart server to apply changes.');
        await fetchInstalled();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle mod');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Mod
  const handleDelete = async (filename: string) => {
    setActionLoading(filename);
    try {
      const res = await apiRequest<{ success: boolean; message: string; restartRequired: boolean }>(
        `/servers/${server.id}/mods/${encodeURIComponent(filename)}`,
        { method: 'DELETE' }
      );
      if (res.success) {
        toast.success(res.message);
        await fetchInstalled();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete mod');
    } finally {
      setActionLoading(null);
    }
  };

  // Auto-fetch popular mods on search tab activation
  useEffect(() => {
    if (activeTab === 'search' && searchResults.length === 0 && !searching) {
      handleSearch(undefined, source, '');
    }
  }, [activeTab]);

  // Search Mods across Modrinth, CurseForge & Hangar
  const handleSearch = async (e?: React.FormEvent, overrideSource?: 'modrinth' | 'curseforge' | 'hangar', queryOverride?: string) => {
    if (e) e.preventDefault();
    const activeSrc = overrideSource || source;
    const queryStr = queryOverride !== undefined ? queryOverride : query;
    setSearching(true);
    try {
      const res = await apiRequest<ModrinthProject[]>(
        `/servers/${server.id}/mods/search?source=${activeSrc}&q=${encodeURIComponent(queryStr.trim())}`
      );
      if (res.success) {
        setSearchResults(res.data || []);
        if (res.loader) setDetectedLoader(res.loader);
      }
    } catch (err: any) {
      toast.error(err.message || `${activeSrc} search failed`);
    } finally {
      setSearching(false);
    }
  };

  // Open Dependencies & Install Modal
  const handleOpenDependencies = async (project: ModrinthProject) => {
    setSelectedProject(project);
    setLoadingDeps(true);
    setSelectedOptionals([]);
    const pId = (project as any).project_id || project.id || (project as any).slug;
    try {
      const res = await apiRequest<ModDependency[]>(
        `/servers/${server.id}/mods/dependencies/${encodeURIComponent(pId)}`
      );
      if (res.success) {
        setDependencies(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve mod dependencies');
    } finally {
      setLoadingDeps(false);
    }
  };

  // Install With Dependencies
  const handleInstallWithDeps = async () => {
    if (!selectedProject) return;
    setInstallingDeps(true);
    const pId = (selectedProject as any).project_id || selectedProject.id || (selectedProject as any).slug;
    try {
      const res = await apiRequest<{ success: boolean; message: string; restartRequired: boolean; installed: string[] }>(
        `/servers/${server.id}/mods/install-with-deps`,
        {
          method: 'POST',
          body: JSON.stringify({
            projectId: pId,
            includeOptional: selectedOptionals
          })
        }
      );
      if (res.success) {
        toast.success(res.message);
        if (res.restartRequired) toast.info('Restart server to load installed mods.');
        setSelectedProject(null);
        await fetchInstalled();
      }
    } catch (err: any) {
      toast.error(err.message || 'Installation failed');
    } finally {
      setInstallingDeps(false);
    }
  };

  // Import Modpack (.mrpack)
  const handleImportPack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mrpackPath.trim()) return;
    setImportingPack(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string; restartRequired: boolean }>(
        `/servers/${server.id}/mods/import-pack`,
        {
          method: 'POST',
          body: JSON.stringify({ mrpackPath: mrpackPath.trim() })
        }
      );
      if (res.success) {
        toast.success(res.message);
        if (res.restartRequired) toast.info('Restart server to launch modpack.');
        setMrpackPath('');
        setActiveTab('installed');
        await fetchInstalled();
      }
    } catch (err: any) {
      toast.error(err.message || 'Modpack import failed');
    } finally {
      setImportingPack(false);
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
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[var(--color-accent)]" />
            <h2 className="text-xl font-bold text-[var(--color-ink)]">Mod Manager</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
              {detectedLoader}
            </span>
          </div>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1">
            Install and manage Fabric, Forge, and NeoForge mods across Modrinth, CurseForge, and Hangar
          </p>
        </div>

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
            Browse Mods (Modrinth / CurseForge / Hangar)
          </button>
          <button
            onClick={() => setActiveTab('modpack')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'modpack'
                ? 'bg-[var(--color-accent)] text-black'
                : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
            }`}
          >
            .mrpack Import
          </button>
        </div>
      </div>

      {/* Installed Tab */}
      {activeTab === 'installed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-ink-dim)]">
              {installed.length} mod{installed.length === 1 ? '' : 's'} in{' '}
              <code className="text-[var(--color-ink)]">mods/</code>
            </span>
            <button
              onClick={fetchInstalled}
              disabled={loadingInstalled}
              className="btn px-3 py-1.5 text-xs border border-[var(--color-line)] flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingInstalled ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingInstalled ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="surface h-14 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : installed.length === 0 ? (
            <div className="surface p-12 text-center rounded-lg border border-[var(--color-line)]">
              <Boxes className="w-10 h-10 mx-auto text-[var(--color-ink-mute)] mb-3" />
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">No mods installed</h3>
              <p className="text-xs text-[var(--color-ink-dim)] mt-1 max-w-sm mx-auto">
                No .jar files found in your server's mods directory. Use the Modrinth search tab to install compatible mods.
              </p>
              <button
                onClick={() => setActiveTab('search')}
                className="btn-primary mt-4 px-4 py-2 text-xs font-semibold"
              >
                Browse Mods
              </button>
            </div>
          ) : (
            <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
              {installed.map(mod => {
                const isDis = !mod.enabled;
                const isLoading = actionLoading === mod.filename;
                return (
                  <div
                    key={mod.filename}
                    className={`p-3 sm:p-4 flex items-center justify-between gap-4 transition-colors ${
                      isDis ? 'opacity-60 bg-[var(--color-surface-2)]/30' : 'hover:bg-[var(--color-surface-2)]/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg border ${
                        mod.enabled
                          ? 'border-[var(--color-accent)]/30 text-[var(--color-accent)] bg-[var(--color-accent)]/5'
                          : 'border-[var(--color-line)] text-[var(--color-ink-mute)] bg-[var(--color-surface-2)]'
                      }`}>
                        <Boxes className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs sm:text-sm font-semibold text-[var(--color-ink)] truncate">
                            {mod.name || mod.filename}
                          </span>
                          {mod.version && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-surface-3)] text-[var(--color-ink-dim)] font-mono">
                              v{mod.version}
                            </span>
                          )}
                          {isDis && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-line)] text-[var(--color-ink-mute)]">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[var(--color-ink-dim)] mt-0.5 font-mono">
                          <span>{formatBytes(mod.size)}</span>
                          <span>&bull;</span>
                          <span>{new Date(mod.modified).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggle(mod)}
                        disabled={isLoading}
                        title={mod.enabled ? 'Disable mod' : 'Enable mod'}
                        className={`btn p-2 text-xs rounded-md border ${
                          mod.enabled
                            ? 'border-[var(--color-ok)]/40 text-[var(--color-ok)] hover:bg-[var(--color-ok)]/10'
                            : 'border-[var(--color-line)] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(mod.filename)}
                        disabled={isLoading}
                        title="Delete mod"
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

      {/* Search Mods Tab */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Repository Source Selector */}
            <div className="flex items-center gap-1.5 p-1 bg-[#14151b] border border-[#23252e] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setSource('modrinth');
                  if (query.trim()) handleSearch(undefined, 'modrinth');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  source === 'modrinth' ? 'bg-[#f97316] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Modrinth
              </button>
              <button
                type="button"
                onClick={() => {
                  setSource('curseforge');
                  if (query.trim()) handleSearch(undefined, 'curseforge');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  source === 'curseforge' ? 'bg-[#f97316] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                CurseForge
              </button>
              <button
                type="button"
                onClick={() => {
                  setSource('hangar');
                  if (query.trim()) handleSearch(undefined, 'hangar');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  source === 'hangar' ? 'bg-[#f97316] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Hangar (PaperMC)
              </button>
            </div>

            <span className="text-[11px] text-neutral-400 font-mono">
              Source: <span className="text-white font-semibold capitalize">{source}</span> &bull; Loader: <span className="text-[#f97316] font-semibold uppercase">{detectedLoader}</span>
            </span>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder={
                  source === 'curseforge'
                    ? `Search CurseForge ${detectedLoader} mods for Minecraft ${server.version || ''}...`
                    : source === 'hangar'
                    ? `Search Hangar plugins/addons for Minecraft ${server.version || ''}...`
                    : `Search Modrinth ${detectedLoader} mods for Minecraft ${server.version || ''}...`
                }
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="field w-full pl-9 pr-3 py-2 text-xs bg-[#14151b] border border-[#23252e] rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#f97316]"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-[#f97316]/20 transition-all cursor-pointer"
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
                {query ? 'No matching mods found for this loader and version.' : `Enter a search query to browse ${detectedLoader} mods.`}
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
                        <Boxes className="w-5 h-5" />
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
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
                    {(() => {
                      const itemSource = (project as any).source || source;
                      const externalUrl = itemSource === 'curseforge'
                        ? `https://www.curseforge.com/minecraft/mc-mods/${project.slug}`
                        : itemSource === 'hangar'
                        ? `https://hangar.papermc.io/${(project as any).author || 'papermc'}/${project.slug}`
                        : `https://modrinth.com/mod/${project.slug}`;
                      const label = itemSource === 'curseforge'
                        ? 'CurseForge Page'
                        : itemSource === 'hangar'
                        ? 'Hangar Page'
                        : 'Modrinth Page';
                      return (
                        <a
                          href={externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] flex items-center gap-1"
                        >
                          {label}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      );
                    })()}

                    <button
                      onClick={() => handleOpenDependencies(project)}
                      className="btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Install with Dependencies
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modpack Import Tab */}
      {activeTab === 'modpack' && (
        <div className="surface p-6 rounded-lg border border-[var(--color-line)] w-full max-w-3xl space-y-4">
          <div className="flex items-center gap-3 border-b border-[var(--color-line)] pb-4">
            <div className="p-3 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-ink)]">Import Modrinth Modpack (.mrpack)</h3>
              <p className="text-xs text-[var(--color-ink-dim)] mt-0.5">
                Automatically parse modrinth.index.json, download server-supported mods, and extract overrides
              </p>
            </div>
          </div>

          <form onSubmit={handleImportPack} className="space-y-4">
            <div>
              <label className="label text-xs block mb-1">Path to .mrpack on server</label>
              <input
                type="text"
                required
                placeholder="e.g. uploads/Fabulously-Optimized.mrpack"
                value={mrpackPath}
                onChange={e => setMrpackPath(e.target.value)}
                className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
              <span className="text-[11px] text-[var(--color-ink-mute)] block mt-1">
                Upload your .mrpack file via File Manager first, then enter its relative path here.
              </span>
            </div>

            <button
              type="submit"
              disabled={importingPack}
              className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
            >
              {importingPack ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {importingPack ? 'Importing Modpack...' : 'Start Modpack Import'}
            </button>
          </form>
        </div>
      )}

      {/* Dependencies & Install Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="surface w-full max-w-lg rounded-lg border border-[var(--color-line)] p-5 space-y-4 bg-[var(--color-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">
                  Install {selectedProject.title}
                </h3>
                <p className="text-xs text-[var(--color-ink-dim)]">Dependency Resolution</p>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-[var(--color-ink-dim)]">
                The following dependencies were detected for this mod on Modrinth:
              </div>

              {loadingDeps ? (
                <div className="py-6 text-center text-xs text-[var(--color-ink-dim)]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--color-accent)]" />
                  Resolving dependency tree...
                </div>
              ) : dependencies.length === 0 ? (
                <div className="p-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] text-xs text-[var(--color-ink-dim)] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--color-ok)]" />
                  No external dependencies required. Ready for direct installation.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {dependencies.map(dep => {
                    const isRequired = dep.type === 'required';
                    const isChecked = isRequired || selectedOptionals.includes(dep.projectId);
                    return (
                      <div
                        key={dep.projectId}
                        className="p-2.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={isRequired || dep.isInstalled}
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedOptionals([...selectedOptionals, dep.projectId]);
                              } else {
                                setSelectedOptionals(selectedOptionals.filter(id => id !== dep.projectId));
                              }
                            }}
                            className="rounded border-[var(--color-line)] text-[var(--color-accent)]"
                          />
                          <div>
                            <span className="font-semibold text-[var(--color-ink)]">{dep.name}</span>
                            <span className="block text-[10px] text-[var(--color-ink-dim)]">
                              {isRequired ? 'Required dependency' : 'Optional recommendation'}
                            </span>
                          </div>
                        </div>

                        {dep.isInstalled ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-ok)]/10 text-[var(--color-ok)] border border-[var(--color-ok)]/30 font-mono">
                            Already installed
                          </span>
                        ) : isRequired ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-mono">
                            Auto-installs
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-line)]">
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="btn px-4 py-2 text-xs border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInstallWithDeps}
                disabled={installingDeps}
                className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              >
                {installingDeps ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Confirm & Install
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ModManager;
