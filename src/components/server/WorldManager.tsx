import React, { useState, useEffect, useCallback } from 'react';
import { Server, WorldItem, GameruleValue } from '../../types';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import {
  Globe, CheckCircle2, Copy, Trash2, Edit2, Sliders, UploadCloud,
  RefreshCw, Power, AlertTriangle, X, Check, FileArchive
} from 'lucide-react';

interface WorldManagerProps {
  server: Server;
}

export const WorldManager: React.FC<WorldManagerProps> = ({ server }) => {
  const { toast } = useToast();
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [activeLevelName, setActiveLevelName] = useState<string>('world');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Rename State
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  // Clone State
  const [cloneTarget, setCloneTarget] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState('');

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importArchive, setImportArchive] = useState('');
  const [importTargetName, setImportTargetName] = useState('');
  const [autoActivate, setAutoActivate] = useState(true);
  const [importing, setImporting] = useState(false);

  // Gamerules State
  const [gameruleTarget, setGameruleTarget] = useState<string | null>(null);
  const [gamerules, setGamerules] = useState<Record<string, GameruleValue>>({});
  const [loadingGamerules, setLoadingGamerules] = useState(false);
  const [savingGamerules, setSavingGamerules] = useState(false);

  // Fetch Worlds
  const fetchWorlds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<WorldItem[]>(
        `/servers/${server.id}/worlds`
      );
      if (res.success) {
        setWorlds(res.data || []);
        if (res.activeLevelName) setActiveLevelName(res.activeLevelName);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch server worlds');
    } finally {
      setLoading(false);
    }
  }, [server.id, toast]);

  useEffect(() => {
    fetchWorlds();
  }, [fetchWorlds]);

  // Activate World
  const handleActivate = async (worldName: string) => {
    setActionLoading(`activate_${worldName}`);
    try {
      const res = await apiRequest<{ success: boolean; message: string; restartRequired: boolean }>(
        `/servers/${server.id}/worlds/${encodeURIComponent(worldName)}/activate`,
        { method: 'POST' }
      );
      if (res.success) {
        toast.success(res.message);
        if (res.restartRequired) toast.info('Restart server to load activated world.');
        await fetchWorlds();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate world');
    } finally {
      setActionLoading(null);
    }
  };

  // Rename World
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !newName.trim()) return;

    setActionLoading(`rename_${renameTarget}`);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/servers/${server.id}/worlds/${encodeURIComponent(renameTarget)}/rename`,
        {
          method: 'POST',
          body: JSON.stringify({ name: newName.trim() })
        }
      );
      if (res.success) {
        toast.success(res.message);
        setRenameTarget(null);
        setNewName('');
        await fetchWorlds();
      }
    } catch (err: any) {
      toast.error(err.message || 'Rename failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Clone World
  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneTarget || !cloneName.trim()) return;

    setActionLoading(`clone_${cloneTarget}`);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/servers/${server.id}/worlds/${encodeURIComponent(cloneTarget)}/clone`,
        {
          method: 'POST',
          body: JSON.stringify({ name: cloneName.trim() })
        }
      );
      if (res.success) {
        toast.success(res.message);
        setCloneTarget(null);
        setCloneName('');
        await fetchWorlds();
      }
    } catch (err: any) {
      toast.error(err.message || 'Clone failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete World with Auto Backup Notice
  const handleDelete = async (worldName: string) => {
    setActionLoading(`delete_${worldName}`);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/servers/${server.id}/worlds/${encodeURIComponent(worldName)}`,
        { method: 'DELETE' }
      );
      if (res.success) {
        toast.success(res.message);
        await fetchWorlds();
      }
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Import World
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importArchive.trim() || !importTargetName.trim()) return;

    setImporting(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/servers/${server.id}/worlds/import`,
        {
          method: 'POST',
          body: JSON.stringify({
            archive: importArchive.trim(),
            targetName: importTargetName.trim(),
            autoUpdateProperties: autoActivate
          })
        }
      );
      if (res.success) {
        toast.success(res.message);
        setShowImportModal(false);
        setImportArchive('');
        setImportTargetName('');
        await fetchWorlds();
      }
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // Open Gamerules Modal
  const handleOpenGamerules = async (worldName: string) => {
    setGameruleTarget(worldName);
    setLoadingGamerules(true);
    try {
      const res = await apiRequest<Record<string, GameruleValue>>(
        `/servers/${server.id}/worlds/${encodeURIComponent(worldName)}/gamerules`
      );
      if (res.success) {
        setGamerules(res.data || {});
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch gamerules');
    } finally {
      setLoadingGamerules(false);
    }
  };

  // Save Gamerules
  const handleSaveGamerules = async () => {
    if (!gameruleTarget) return;
    setSavingGamerules(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string; restartRequired: boolean }>(
        `/servers/${server.id}/worlds/${encodeURIComponent(gameruleTarget)}/gamerules`,
        {
          method: 'PATCH',
          body: JSON.stringify({ changes: gamerules })
        }
      );
      if (res.success) {
        toast.success(res.message);
        if (res.restartRequired) toast.info('Restart server for gamerules to persist.');
        setGameruleTarget(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save gamerules');
    } finally {
      setSavingGamerules(false);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-line)] pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-ink)]">
            <Globe className="w-5 h-5 text-[var(--color-accent)]" />
            World Manager
          </h2>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1">
            Manage Minecraft dimensions, active level-name bindings, backup clones, and gamerule policies
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn px-3 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-accent)] flex items-center gap-1.5"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Import World Archive
          </button>
          <button
            onClick={fetchWorlds}
            disabled={loading}
            className="btn px-3 py-1.5 text-xs border border-[var(--color-line)] flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* World Cards */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="surface h-16 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
          ))}
        </div>
      ) : worlds.length === 0 ? (
        <div className="surface p-12 text-center rounded-lg border border-[var(--color-line)]">
          <Globe className="w-10 h-10 mx-auto text-[var(--color-ink-mute)] mb-3" />
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">No worlds detected</h3>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1">
            Start the server once to generate standard world containers or import a zip archive.
          </p>
        </div>
      ) : (
        <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
          {worlds.map(w => {
            const isActive = w.isActive || w.name === activeLevelName;
            return (
              <div
                key={w.name}
                className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors ${
                  isActive ? 'bg-[var(--color-accent)]/5' : 'hover:bg-[var(--color-surface-2)]/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2.5 rounded-lg border ${
                    isActive
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-line)] text-[var(--color-ink-dim)] bg-[var(--color-surface-2)]'
                  }`}>
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[var(--color-ink)] truncate">
                        {w.name}
                      </span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-accent)] text-black font-mono">
                          ACTIVE LEVEL
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--color-ink-dim)] font-mono mt-1">
                      <span>Size: {formatBytes(w.size)}</span>
                      <span>&bull;</span>
                      <span>Modified: {new Date(w.lastModified).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!isActive && (
                    <button
                      onClick={() => handleActivate(w.name)}
                      disabled={actionLoading === `activate_${w.name}`}
                      className="btn px-2.5 py-1.5 text-xs border border-[var(--color-accent)]/50 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                    >
                      Set Active
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenGamerules(w.name)}
                    className="btn px-2.5 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-ink)] flex items-center gap-1"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Gamerules
                  </button>

                  <button
                    onClick={() => {
                      setCloneTarget(w.name);
                      setCloneName(`${w.name}_copy`);
                    }}
                    className="btn p-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-ink)]"
                    title="Clone World"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setRenameTarget(w.name);
                      setNewName(w.name);
                    }}
                    className="btn p-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-ink)]"
                    title="Rename World"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {!isActive && (
                    <button
                      onClick={() => handleDelete(w.name)}
                      disabled={actionLoading === `delete_${w.name}`}
                      className="btn p-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-err)] hover:text-[var(--color-err)]"
                      title="Delete World (triggers safety auto-backup)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleRename}
            className="surface w-full max-w-sm rounded-lg border border-[var(--color-line)] p-5 space-y-4 bg-[var(--color-surface)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)]">Rename World '{renameTarget}'</h3>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label text-xs block mb-1">New World Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="btn px-4 py-2 text-xs border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary px-4 py-2 text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clone Modal */}
      {cloneTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleClone}
            className="surface w-full max-w-sm rounded-lg border border-[var(--color-line)] p-5 space-y-4 bg-[var(--color-surface)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)]">Clone World '{cloneTarget}'</h3>
              <button
                type="button"
                onClick={() => setCloneTarget(null)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label text-xs block mb-1">Target Clone Name</label>
              <input
                type="text"
                required
                value={cloneName}
                onChange={e => setCloneName(e.target.value)}
                className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCloneTarget(null)}
                className="btn px-4 py-2 text-xs border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary px-4 py-2 text-xs font-semibold"
              >
                Clone
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleImport}
            className="surface w-full max-w-md rounded-lg border border-[var(--color-line)] p-5 space-y-4 bg-[var(--color-surface)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-[var(--color-accent)]" />
                Import World Archive
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label text-xs block mb-1">Archive path on server (.zip)</label>
              <input
                type="text"
                required
                placeholder="e.g. uploads/my_world.zip"
                value={importArchive}
                onChange={e => {
                  setImportArchive(e.target.value);
                  if (!importTargetName) {
                    const clean = e.target.value.split('/').pop()?.replace(/\.zip$/i, '') || '';
                    if (clean) setImportTargetName(clean);
                  }
                }}
                className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
            </div>

            <div>
              <label className="label text-xs block mb-1">Target Folder Name</label>
              <input
                type="text"
                required
                placeholder="world_custom"
                value={importTargetName}
                onChange={e => setImportTargetName(e.target.value)}
                className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoActivate"
                checked={autoActivate}
                onChange={e => setAutoActivate(e.target.checked)}
                className="rounded border-[var(--color-line)] text-[var(--color-accent)]"
              />
              <label htmlFor="autoActivate" className="text-xs text-[var(--color-ink-dim)]">
                Automatically set as active level-name in server.properties
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="btn px-4 py-2 text-xs border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={importing}
                className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              >
                {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                Import World
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Gamerules Modal */}
      {gameruleTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="surface w-full max-w-lg max-h-[85vh] rounded-lg border border-[var(--color-line)] flex flex-col overflow-hidden bg-[var(--color-surface)]">
            <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">
                  Gamerules &bull; {gameruleTarget}
                </h3>
                <p className="text-xs text-[var(--color-ink-dim)]">Configure world-level game loop rules</p>
              </div>
              <button
                onClick={() => setGameruleTarget(null)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {loadingGamerules ? (
                <div className="py-8 text-center text-xs text-[var(--color-ink-dim)]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--color-accent)]" />
                  Loading gamerules...
                </div>
              ) : (
                Object.entries(gamerules).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="font-mono text-xs font-semibold text-[var(--color-ink)]">{key}</span>
                    </div>

                    {typeof val === 'boolean' ? (
                      <button
                        onClick={() => setGamerules({ ...gamerules, [key]: !val })}
                        className={`px-3 py-1 text-xs font-semibold rounded-md border transition-colors ${
                          val
                            ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/30'
                            : 'bg-[var(--color-surface-3)] text-[var(--color-ink-dim)] border-[var(--color-line)]'
                        }`}
                      >
                        {val ? 'True' : 'False'}
                      </button>
                    ) : (
                      <input
                        type="number"
                        value={val}
                        onChange={e => setGamerules({ ...gamerules, [key]: Number(e.target.value) })}
                        className="field w-20 px-2 py-1 text-xs text-right bg-[var(--color-surface-3)] border border-[var(--color-line)] rounded font-mono text-[var(--color-ink)]"
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-[var(--color-line)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setGameruleTarget(null)}
                className="btn px-4 py-2 text-xs border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGamerules}
                disabled={savingGamerules}
                className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              >
                {savingGamerules ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Gamerules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default WorldManager;
