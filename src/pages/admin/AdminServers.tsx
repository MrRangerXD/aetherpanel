import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Server as ServerIcon, Search, Play, Square, RotateCw, Trash2, 
  CheckSquare, Square as SquareOutline, AlertTriangle, X, Loader2, CheckCircle2 
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { fetchAuthoritativeMinecraftVersions, getCachedMinecraftVersions } from '../../lib/minecraftVersions';
import { Server } from '../../types';
import { useToast } from '../../lib/ToastContext';

export const AdminServers: React.FC = () => {
  const { toast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState<'restart' | 'stop' | 'delete' | null>(null);

  // Modals state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [singleDeleteServer, setSingleDeleteServer] = useState<Server | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Admin Create Server Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createServerName, setCreateServerName] = useState('Custom Server');
  const [createCategory, setCreateCategory] = useState<'minecraft' | 'bot'>('minecraft');
  const [createSoftware, setCreateSoftware] = useState('Paper');
  const [createVersion, setCreateVersion] = useState('26.2');
  const [adminMcVersions, setAdminMcVersions] = useState<string[]>([]);
  const [isLoadingAdminVersions, setIsLoadingAdminVersions] = useState(false);
  const adminVersionReqIdRef = useRef<number>(0);
  const [runtimesMap, setRuntimesMap] = useState<any>(null);
  const [createRam, setCreateRam] = useState<number>(1024);
  const [createCpu, setCreateCpu] = useState<number>(1);
  const [createDisk, setCreateDisk] = useState<number>(15);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchAllServers();
    fetchRuntimes();
    loadAdminMinecraftVersions('Paper');
  }, []);

  const loadAdminMinecraftVersions = async (software: string) => {
    const reqId = ++adminVersionReqIdRef.current;
    const cached = getCachedMinecraftVersions(software);
    if (cached && cached.versions.length > 0) {
      setAdminMcVersions(cached.versions);
      setCreateVersion(prev => (cached.versions.includes('26.2') ? '26.2' : (cached.versions.includes(prev) ? prev : cached.latest || cached.versions[0])));
      return;
    }

    setIsLoadingAdminVersions(true);
    try {
      const data = await fetchAuthoritativeMinecraftVersions(software);
      if (reqId !== adminVersionReqIdRef.current) return;
      if (data && data.versions && data.versions.length > 0) {
        setAdminMcVersions(data.versions);
        setCreateVersion(prev => (data.versions.includes('26.2') ? '26.2' : (data.versions.includes(prev) ? prev : data.latest || data.versions[0])));
      }
    } catch {
      // fallback
    } finally {
      if (reqId === adminVersionReqIdRef.current) {
        setIsLoadingAdminVersions(false);
      }
    }
  };

  const fetchRuntimes = async () => {
    try {
      const res = await apiRequest('/runtimes');
      if (res.success && res.data) {
        setRuntimesMap(res.data);
      }
    } catch (e) {}
  };

  const handleAdminCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createEmail || !createServerName) {
      setCreateError('User email and server name are required.');
      return;
    }

    setIsCreating(true);
    const res = await apiRequest('/admin/servers/create', {
      method: 'POST',
      body: JSON.stringify({
        userEmail: createEmail,
        name: createServerName,
        hostingCategory: createCategory,
        software: createSoftware,
        version: createVersion,
        ramMB: createRam,
        cpuCores: createCpu,
        diskGB: createDisk
      })
    });
    setIsCreating(false);

    if (res.success) {
      toast.success(res.message || 'Server provisioned and delivered successfully.');
      setShowCreateModal(false);
      setCreateEmail('');
      setCreateServerName('Custom Server');
      fetchAllServers();
    } else {
      setCreateError(res.error?.message || 'No user account was found with this email address.');
    }
  };

  const fetchAllServers = async () => {
    try {
      const res = await apiRequest('/admin/servers');
      if (res.success && res.data) {
        setServers(res.data);
      }
    } catch (err: any) {
      toast.error('Failed to load server inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllServers();
  }, []);

  // Filtered servers
  const filtered = useMemo(() => {
    return servers.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.primaryIp.toLowerCase().includes(search.toLowerCase()) ||
      s.software.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
    );
  }, [servers, search]);

  // Selection handlers
  const isAllSelected = filtered.length > 0 && filtered.every(s => selectedIds.includes(s.id));
  const isSomeSelected = filtered.some(s => selectedIds.includes(s.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const filteredIds = new Set(filtered.map(s => s.id));
      setSelectedIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      const filteredIds = filtered.map(s => s.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const toggleSelectServer = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  // Individual power action
  const handlePower = async (serverId: string, action: 'start' | 'stop' | 'restart') => {
    const s = servers.find(x => x.id === serverId);
    try {
      const res = await apiRequest(`/servers/${serverId}/power`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      if (res.success) {
        toast.success(`Server '${s?.name || serverId}' ${action}ed successfully.`);
      } else {
        toast.error(res.error?.message || `Failed to ${action} server.`);
      }
    } catch (err: any) {
      toast.error(`Error performing ${action} on server: ${err.message}`);
    }
    fetchAllServers();
  };

  // Single server delete
  const confirmSingleDelete = async () => {
    if (!singleDeleteServer) return;
    setIsDeletingSingle(true);
    try {
      const res = await apiRequest(`/admin/servers/${singleDeleteServer.id}`, { method: 'DELETE' });
      if (res.success) {
        toast.success(`Server '${singleDeleteServer.name}' permanently deleted.`);
        setSelectedIds(prev => prev.filter(id => id !== singleDeleteServer.id));
        setSingleDeleteServer(null);
        fetchAllServers();
      } else {
        toast.error(res.error?.message || 'Failed to delete server container.');
      }
    } catch (err: any) {
      toast.error(`Deletion error: ${err.message}`);
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Bulk Restart
  const handleBulkRestart = async () => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading('restart');
    try {
      const res = await apiRequest('/admin/servers/bulk-restart', {
        method: 'POST',
        body: JSON.stringify({ serverIds: selectedIds })
      });

      if (res.success) {
        if (res.failed === 0) {
          toast.success(res.message || `${res.succeeded} servers restarted successfully.`);
        } else {
          toast.warning(`${res.succeeded} restarted successfully, ${res.failed} failed.`);
        }
        fetchAllServers();
      } else {
        toast.error(res.error?.message || 'Failed to execute bulk restart.');
      }
    } catch (err: any) {
      toast.error(`Bulk restart failed: ${err.message}`);
    } finally {
      setBulkActionLoading(null);
    }
  };

  // Bulk Stop
  const handleBulkStop = async () => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading('stop');
    try {
      const res = await apiRequest('/admin/servers/bulk-stop', {
        method: 'POST',
        body: JSON.stringify({ serverIds: selectedIds })
      });

      if (res.success) {
        if (res.failed === 0) {
          toast.success(res.message || `${res.succeeded} servers stopped successfully.`);
        } else {
          toast.warning(`${res.succeeded} stopped successfully, ${res.failed} failed.`);
        }
        fetchAllServers();
      } else {
        toast.error(res.error?.message || 'Failed to execute bulk stop.');
      }
    } catch (err: any) {
      toast.error(`Bulk stop failed: ${err.message}`);
    } finally {
      setBulkActionLoading(null);
    }
  };

  // Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading('delete');
    try {
      const res = await apiRequest('/admin/servers/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ serverIds: selectedIds })
      });

      if (res.success) {
        if (res.failed === 0) {
          toast.success(res.message || `${res.succeeded} servers deleted permanently.`);
        } else {
          toast.warning(`${res.succeeded} deleted successfully, ${res.failed} failed.`);
        }
        setSelectedIds([]);
        setShowBulkDeleteModal(false);
        fetchAllServers();
      } else {
        toast.error(res.error?.message || 'Failed to execute bulk deletion.');
      }
    } catch (err: any) {
      toast.error(`Bulk deletion failed: ${err.message}`);
    } finally {
      setBulkActionLoading(null);
    }
  };

  // Selected servers summary objects
  const selectedServersList = servers.filter(s => selectedIds.includes(s.id));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ServerIcon className="h-6 w-6 text-amber-400" /> Platform Containers Inventory
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Full system-wide inventory of customer server instances.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search servers across platform..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer whitespace-nowrap"
          >
            <ServerIcon className="h-4 w-4" />
            <span>Create Server</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="p-3 sm:p-4 rounded-2xl bg-zinc-900 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-amber-950/10">
          <div className="flex items-center gap-2.5 text-xs text-zinc-200">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold">
              {selectedIds.length}
            </span>
            <span>{selectedIds.length === 1 ? 'server selected' : 'servers selected'}</span>
            <button
              onClick={clearSelection}
              className="text-zinc-400 hover:text-white underline ml-1 cursor-pointer text-xs"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkRestart}
              disabled={bulkActionLoading !== null}
              className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {bulkActionLoading === 'restart' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" />
              )}
              <span>Bulk Restart</span>
            </button>

            <button
              onClick={handleBulkStop}
              disabled={bulkActionLoading !== null}
              className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {bulkActionLoading === 'stop' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              <span>Bulk Stop</span>
            </button>

            <button
              onClick={() => setShowBulkDeleteModal(true)}
              disabled={bulkActionLoading !== null}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Bulk Delete</span>
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <span>Loading server containers...</span>
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                    aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="h-4 w-4 text-amber-400" />
                    ) : isSomeSelected ? (
                      <div className="h-4 w-4 rounded bg-amber-400/30 border border-amber-400 flex items-center justify-center">
                        <div className="h-1.5 w-2 bg-amber-400 rounded-xs" />
                      </div>
                    ) : (
                      <SquareOutline className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">Server Name</th>
                <th className="p-3.5">Software / Version</th>
                <th className="p-3.5">Primary IP:Port</th>
                <th className="p-3.5">Node Location</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Power / Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500 font-mono">
                    No servers found matching query.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const isRunning = s.status === 'running';
                  const isSelected = selectedIds.includes(s.id);

                  return (
                    <tr 
                      key={s.id} 
                      className={`transition-colors ${isSelected ? 'bg-amber-500/10' : 'hover:bg-zinc-900'}`}
                    >
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => toggleSelectServer(s.id)}
                          className="p-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                          aria-label={`Select server ${s.name}`}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-amber-400" />
                          ) : (
                            <SquareOutline className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-white">{s.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">ID: {s.id}</div>
                      </td>

                      <td className="p-3.5 font-mono text-zinc-300">
                        {s.software} ({s.version})
                      </td>

                      <td className="p-3.5 font-mono text-violet-400">
                        {s.primaryIp}:{s.primaryPort}
                      </td>

                      <td className="p-3.5 font-mono text-zinc-400">{s.location}</td>

                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border capitalize ${
                          isRunning ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {s.status}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isRunning ? (
                            <button
                              onClick={() => handlePower(s.id, 'start')}
                              className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                              title="Start Server"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handlePower(s.id, 'restart')}
                                className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white transition-all cursor-pointer"
                                title="Restart Server"
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handlePower(s.id, 'stop')}
                                className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                                title="Stop Server"
                              >
                                <Square className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSingleDeleteServer(s)}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                            title="Delete Server"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Single Server Delete Confirmation Modal */}
      {singleDeleteServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-rose-500/30 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Permanently Delete Server</h3>
                  <p className="text-xs text-zinc-400">This action cannot be undone.</p>
                </div>
              </div>
              <button
                onClick={() => setSingleDeleteServer(null)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-1 font-mono text-xs">
              <div className="text-zinc-300 font-bold">{singleDeleteServer.name}</div>
              <div className="text-[11px] text-zinc-500">ID: {singleDeleteServer.id}</div>
              <div className="text-[11px] text-zinc-500">{singleDeleteServer.primaryIp}:{singleDeleteServer.primaryPort}</div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Deleting this server will terminate the running container process, wipe all workspace files, delete snapshots, and free all port allocations.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSingleDeleteServer(null)}
                disabled={isDeletingSingle}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmSingleDelete}
                disabled={isDeletingSingle}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-950/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeletingSingle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>Delete Server</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-rose-500/30 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Bulk Delete {selectedIds.length} Servers</h3>
                  <p className="text-xs text-rose-400 font-semibold">Irreversible Administrative Action</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              You are about to permanently delete <strong>{selectedIds.length}</strong> server instances. All running container processes will be terminated immediately, filesystems wiped, and database records purged.
            </p>

            <div className="max-h-40 overflow-y-auto p-3 bg-zinc-950 rounded-2xl border border-zinc-800 divide-y divide-zinc-850">
              {selectedServersList.map(s => (
                <div key={s.id} className="py-1.5 flex items-center justify-between text-xs font-mono">
                  <span className="text-white font-medium truncate max-w-[200px]">{s.name}</span>
                  <span className="text-zinc-500 text-[10px]">{s.id}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={bulkActionLoading === 'delete'}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkDelete}
                disabled={bulkActionLoading === 'delete'}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-950/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                {bulkActionLoading === 'delete' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>Permanently Delete {selectedIds.length} Servers</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Create Server Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                  <ServerIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Admin Provision Server</h3>
                  <p className="text-xs text-amber-400 font-semibold">Assign custom specs & deliver to user account</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleAdminCreateServer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">User Account Email *</label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Server Name *</label>
                <input
                  type="text"
                  required
                  value={createServerName}
                  onChange={(e) => setCreateServerName(e.target.value)}
                  placeholder="Survival SMP / Bot Instance"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Hosting Category</label>
                  <select
                    value={createCategory}
                    onChange={(e) => {
                      const val = e.target.value as 'minecraft' | 'bot';
                      setCreateCategory(val);
                      if (val === 'minecraft') {
                        setCreateSoftware('Paper');
                        loadAdminMinecraftVersions('Paper');
                      } else {
                        setCreateSoftware('Node.js');
                        setCreateVersion(runtimesMap?.nodejs?.defaultVersion || '20.x');
                      }
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="minecraft">Minecraft Hosting</option>
                    <option value="bot">Discord Bot & App</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Software Engine</label>
                  <select
                    value={createSoftware}
                    onChange={(e) => {
                      const sw = e.target.value;
                      setCreateSoftware(sw);
                      if (createCategory === 'minecraft') {
                        loadAdminMinecraftVersions(sw);
                      } else if (createCategory === 'bot') {
                        const key = sw.toLowerCase().includes('python') ? 'python' : sw.toLowerCase().includes('bun') ? 'bun' : 'nodejs';
                        if (runtimesMap && runtimesMap[key]) {
                          setCreateVersion(runtimesMap[key].defaultVersion);
                        }
                      }
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {createCategory === 'minecraft' ? (
                      <>
                        <option value="Paper">Paper</option>
                        <option value="Purpur">Purpur</option>
                        <option value="Vanilla">Vanilla</option>
                        <option value="Fabric">Fabric</option>
                        <option value="Forge">Forge</option>
                      </>
                    ) : (
                      <>
                        <option value="Node.js">Node.js</option>
                        <option value="Python">Python</option>
                        <option value="Bun">Bun</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  {createCategory === 'bot' ? 'Runtime Version *' : 'Minecraft Version *'}
                  {createCategory === 'minecraft' && isLoadingAdminVersions && (
                    <Loader2 className="inline h-3 w-3 animate-spin text-amber-400 ml-1.5" />
                  )}
                </label>
                <select
                  value={createVersion}
                  onChange={(e) => setCreateVersion(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {createCategory === 'bot' ? (
                    <>
                      {runtimesMap && runtimesMap[createSoftware.toLowerCase().includes('python') ? 'python' : createSoftware.toLowerCase().includes('bun') ? 'bun' : 'nodejs']?.versions.map((ver: string) => (
                        <option key={ver} value={ver}>{ver}</option>
                      ))}
                      {!runtimesMap && <option value={createVersion}>{createVersion}</option>}
                    </>
                  ) : (
                    <>
                      {adminMcVersions.length > 0 ? (
                        adminMcVersions.map((ver, idx) => (
                          <option key={ver} value={ver}>
                            {ver} {idx === 0 && ver !== 'UNKNOWN' ? '(Latest)' : ''}
                          </option>
                        ))
                      ) : (
                        <option value="26.2">26.2 (Latest)</option>
                      )}
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">RAM (MB)</label>
                  <input
                    type="number"
                    min="256"
                    step="256"
                    value={createRam}
                    onChange={(e) => setCreateRam(parseInt(e.target.value, 10) || 1024)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">CPU Cores</label>
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={createCpu}
                    onChange={(e) => setCreateCpu(parseFloat(e.target.value) || 1)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Disk (GB)</label>
                  <input
                    type="number"
                    min="1"
                    value={createDisk}
                    onChange={(e) => setCreateDisk(parseInt(e.target.value, 10) || 15)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin text-zinc-950" /> : <ServerIcon className="h-4 w-4 text-zinc-950" />}
                  <span>Provision & Deliver Server</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
