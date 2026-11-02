import React, { useState, useEffect, useCallback } from 'react';
import { Server, SubUser, SubUserCandidate } from '../../types';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import {
  Users, UserPlus, Shield, Trash2, Edit2, Clock, Check, X,
  Search, Calendar, Activity, AlertCircle, RefreshCw
} from 'lucide-react';

interface SubUsersProps {
  server: Server;
}

const PERMISSION_GROUPS: Record<string, { label: string; perms: { id: string; label: string; desc: string }[] }> = {
  Control: {
    label: 'Console & Power',
    perms: [
      { id: 'console.view', label: 'View Console', desc: 'Allows viewing real-time output' },
      { id: 'console.send', label: 'Send Commands', desc: 'Allows executing server commands' },
      { id: 'server.start', label: 'Start Server', desc: 'Power on server' },
      { id: 'server.stop', label: 'Stop Server', desc: 'Clean shutdown' },
      { id: 'server.restart', label: 'Restart Server', desc: 'Reboot server process' },
      { id: 'server.kill', label: 'Kill Process', desc: 'Force terminate hung process' }
    ]
  },
  Files: {
    label: 'File System & SFTP',
    perms: [
      { id: 'files.view', label: 'Browse Files', desc: 'Read file tree' },
      { id: 'files.create', label: 'Create Files', desc: 'New files and directories' },
      { id: 'files.edit', label: 'Edit Content', desc: 'Modify and save files' },
      { id: 'files.delete', label: 'Delete Files', desc: 'Permanently remove files' },
      { id: 'files.upload', label: 'Upload Files', desc: 'Browser upload support' },
      { id: 'sftp.connect', label: 'SFTP Connect', desc: 'Direct SFTP credentials access' }
    ]
  },
  Extensions: {
    label: 'Plugins, Mods & Worlds',
    perms: [
      { id: 'plugins.manage', label: 'Manage Plugins', desc: 'Install, toggle, and delete Bukkit plugins' },
      { id: 'mods.manage', label: 'Manage Mods', desc: 'Install and configure Fabric/Forge mods' },
      { id: 'worlds.manage', label: 'Manage Worlds', desc: 'Activate, backup, and import dimensions' },
      { id: 'properties.edit', label: 'Edit Properties', desc: 'Change server.properties settings' }
    ]
  },
  Administration: {
    label: 'Backups, Database & Subusers',
    perms: [
      { id: 'backups.view', label: 'View Backups', desc: 'Inspect available snapshots' },
      { id: 'backups.create', label: 'Create Backups', desc: 'Snapshot server filesystem' },
      { id: 'backups.restore', label: 'Restore Backups', desc: 'Overwrite server with backup' },
      { id: 'databases.manage', label: 'Manage Databases', desc: 'Create and rotate SQL databases' },
      { id: 'subusers.view', label: 'View Subusers', desc: 'View server user access list' },
      { id: 'subusers.create', label: 'Add Subusers', desc: 'Invite new subusers' },
      { id: 'subusers.update', label: 'Update Subusers', desc: 'Modify subuser permissions' },
      { id: 'subusers.delete', label: 'Remove Subusers', desc: 'Revoke subuser access' }
    ]
  }
};

export const SubUsers: React.FC<SubUsersProps> = ({ server }) => {
  const { toast } = useToast();
  const [subusers, setSubusers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Invite / Add State
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<SubUserCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<SubUserCandidate | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [searchingCandidates, setSearchingCandidates] = useState(false);

  // Edit Permissions State
  const [editingSubuser, setEditingSubuser] = useState<SubUser | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editExpiresAt, setEditExpiresAt] = useState<string>('');

  // Activity Log State
  const [viewingActivitySubuser, setViewingActivitySubuser] = useState<SubUser | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Fetch Subusers
  const fetchSubusers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<SubUser[]>(
        `/servers/${server.id}/subusers`
      );
      if (res.success) {
        setSubusers(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch subusers');
    } finally {
      setLoading(false);
    }
  }, [server.id, toast]);

  useEffect(() => {
    fetchSubusers();
  }, [fetchSubusers]);

  // Search Candidates
  useEffect(() => {
    if (!showAddModal) return;
    const timeout = setTimeout(async () => {
      setSearchingCandidates(true);
      try {
        const res = await apiRequest<SubUserCandidate[]>(
          `/servers/${server.id}/subusers/candidates?q=${encodeURIComponent(searchQuery.trim())}`
        );
        if (res.success) {
          setCandidates(res.data || []);
        }
      } catch (err) {
        // silent fail for candidate autocomplete
      } finally {
        setSearchingCandidates(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery, showAddModal, server.id]);

  // Submit Add Subuser
  const handleAddSubuser = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailOrUsername = selectedCandidate ? selectedCandidate.email : customEmail.trim();
    if (!emailOrUsername) {
      toast.error('Select an existing user or enter an email address.');
      return;
    }
    if (selectedPerms.length === 0) {
      toast.error('Select at least one permission.');
      return;
    }

    setActionLoading('add_subuser');
    try {
      const res = await apiRequest<{ success: boolean; data: SubUser }>(
        `/servers/${server.id}/subusers`,
        {
          method: 'POST',
          body: JSON.stringify({
            emailOrUsername,
            permissions: selectedPerms,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
          })
        }
      );
      if (res.success) {
        toast.success(`Subuser added successfully.`);
        setShowAddModal(false);
        setSelectedCandidate(null);
        setCustomEmail('');
        setSelectedPerms([]);
        setExpiresAt('');
        await fetchSubusers();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add subuser');
    } finally {
      setActionLoading(null);
    }
  };

  // Submit Edit Permissions
  const handleUpdateSubuser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubuser) return;

    setActionLoading(`edit_${editingSubuser.userId}`);
    try {
      const res = await apiRequest<{ success: boolean; data: SubUser }>(
        `/servers/${server.id}/subusers/${editingSubuser.userId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            permissions: editPerms,
            expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null
          })
        }
      );
      if (res.success) {
        toast.success(`Permissions updated.`);
        setEditingSubuser(null);
        await fetchSubusers();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update subuser permissions');
    } finally {
      setActionLoading(null);
    }
  };

  // Revoke Subuser
  const handleRevoke = async (sub: SubUser) => {
    setActionLoading(`delete_${sub.userId}`);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/servers/${server.id}/subusers/${sub.userId}`,
        { method: 'DELETE' }
      );
      if (res.success) {
        toast.success(res.message);
        await fetchSubusers();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke subuser');
    } finally {
      setActionLoading(null);
    }
  };

  // View Activity Logs
  const handleViewActivity = async (sub: SubUser) => {
    setViewingActivitySubuser(sub);
    setLoadingActivity(true);
    try {
      const res = await apiRequest<any[]>(
        `/servers/${server.id}/subusers/${sub.userId}/activity`
      );
      if (res.success) {
        setActivityLogs(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load subuser audit logs');
    } finally {
      setLoadingActivity(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-line)] pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-ink)]">
            <Users className="w-5 h-5 text-[var(--color-accent)]" />
            Sub-User Access & Roles
          </h2>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1">
            Grant granular permissions to team members with expiration dates and activity audit logging
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedPerms([
                'console.view', 'server.start', 'server.stop', 'server.restart', 'files.view'
              ]);
              setShowAddModal(true);
            }}
            className="btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Subuser
          </button>
          <button
            onClick={fetchSubusers}
            disabled={loading}
            className="btn px-3 py-1.5 text-xs border border-[var(--color-line)] flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Subusers List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="surface h-16 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
          ))}
        </div>
      ) : subusers.length === 0 ? (
        <div className="surface p-12 text-center rounded-lg border border-[var(--color-line)]">
          <Users className="w-10 h-10 mx-auto text-[var(--color-ink-mute)] mb-3" />
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">No subusers assigned</h3>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1 max-w-sm mx-auto">
            You are currently the sole administrator of this server. Invite moderators, builders, or co-owners.
          </p>
        </div>
      ) : (
        <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
          {subusers.map(sub => {
            const isExpired = sub.expiresAt && new Date(sub.expiresAt).getTime() < Date.now();
            return (
              <div
                key={sub.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-[var(--color-surface-2)]/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center font-bold text-xs text-[var(--color-accent)] shrink-0">
                    {sub.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--color-ink)] truncate">
                        {sub.displayName || sub.username}
                      </span>
                      <span className="text-xs text-[var(--color-ink-dim)] font-mono">
                        ({sub.email})
                      </span>
                      {isExpired && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-err)]/10 text-[var(--color-err)] border border-[var(--color-err)]/30 font-semibold font-mono">
                          EXPIRED
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-ink-dim)] mt-1 font-mono">
                      <span>{sub.permissions.length} permission{sub.permissions.length === 1 ? '' : 's'}</span>
                      <span>&bull;</span>
                      <span>
                        Expires: {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : 'Never'}
                      </span>
                      {sub.lastSeenAt && (
                        <>
                          <span>&bull;</span>
                          <span>Last active: {new Date(sub.lastSeenAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleViewActivity(sub)}
                    className="btn px-2.5 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-ink)] flex items-center gap-1"
                    title="View Action Audit Log"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Activity
                  </button>

                  <button
                    onClick={() => {
                      setEditingSubuser(sub);
                      setEditPerms([...sub.permissions]);
                      setEditExpiresAt(sub.expiresAt ? sub.expiresAt.substring(0, 10) : '');
                    }}
                    className="btn p-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-ink)]"
                    title="Edit Permissions"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleRevoke(sub)}
                    disabled={actionLoading === `delete_${sub.userId}`}
                    className="btn p-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-err)] hover:text-[var(--color-err)]"
                    title="Revoke Subuser"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Subuser Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubuser}
            className="surface w-full max-w-2xl max-h-[90vh] rounded-lg border border-[var(--color-line)] flex flex-col overflow-hidden bg-[var(--color-surface)]"
          >
            <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">Add Sub-User</h3>
                <p className="text-xs text-[var(--color-ink-dim)]">Select user and assign server capabilities</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {/* User Selection */}
              <div>
                <label className="label text-xs block mb-1">Search User by Username or Email</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-dim)]" />
                  <input
                    type="text"
                    placeholder="Search registered accounts..."
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setSelectedCandidate(null);
                    }}
                    className="field w-full pl-8 pr-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
                  />
                </div>

                {candidates.length > 0 && !selectedCandidate && (
                  <div className="mt-1 surface border border-[var(--color-line)] rounded-lg max-h-36 overflow-y-auto divide-y divide-[var(--color-line)] bg-[var(--color-surface-2)]">
                    {candidates.map(cand => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => {
                          setSelectedCandidate(cand);
                          setSearchQuery(`${cand.username} (${cand.email})`);
                        }}
                        className="w-full p-2 text-left text-xs hover:bg-[var(--color-surface-3)] flex items-center justify-between"
                      >
                        <span className="font-semibold text-[var(--color-ink)]">{cand.username}</span>
                        <span className="text-[11px] text-[var(--color-ink-dim)]">{cand.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Expiry Date */}
              <div>
                <label className="label text-xs block mb-1">Access Expiration (Optional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                />
              </div>

              {/* Permission Matrix */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-ink)]">Permissions</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const all: string[] = [];
                        Object.values(PERMISSION_GROUPS).forEach(g => g.perms.forEach(p => all.push(p.id)));
                        setSelectedPerms(all);
                      }}
                      className="text-[11px] text-[var(--color-accent)] hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-xs text-[var(--color-ink-mute)]">&bull;</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPerms([])}
                      className="text-[11px] text-[var(--color-ink-dim)] hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(PERMISSION_GROUPS).map(([catKey, cat]) => (
                    <div key={catKey} className="surface p-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]/50 space-y-2">
                      <div className="text-xs font-semibold text-[var(--color-accent)]">{cat.label}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {cat.perms.map(p => {
                          const checked = selectedPerms.includes(p.id);
                          return (
                            <label
                              key={p.id}
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
                                  if (e.target.checked) setSelectedPerms([...selectedPerms, p.id]);
                                  else setSelectedPerms(selectedPerms.filter(id => id !== p.id));
                                }}
                                className="mt-0.5 rounded border-[var(--color-line)] text-[var(--color-accent)]"
                              />
                              <div>
                                <span className="text-xs font-medium text-[var(--color-ink)] block">{p.label}</span>
                                <span className="text-[10px] text-[var(--color-ink-dim)] block leading-tight">{p.desc}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-line)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn px-4 py-2 text-xs border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading === 'add_subuser'}
                className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              >
                {actionLoading === 'add_subuser' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                Add Subuser
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Subuser Permissions Modal */}
      {editingSubuser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateSubuser}
            className="surface w-full max-w-2xl max-h-[90vh] rounded-lg border border-[var(--color-line)] flex flex-col overflow-hidden bg-[var(--color-surface)]"
          >
            <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">
                  Edit Permissions &bull; {editingSubuser.username}
                </h3>
                <p className="text-xs text-[var(--color-ink-dim)]">Modify server role capabilities and expiry</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSubuser(null)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="label text-xs block mb-1">Access Expiration</label>
                <input
                  type="date"
                  value={editExpiresAt}
                  onChange={e => setEditExpiresAt(e.target.value)}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                />
              </div>

              <div className="space-y-3">
                {Object.entries(PERMISSION_GROUPS).map(([catKey, cat]) => (
                  <div key={catKey} className="surface p-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]/50 space-y-2">
                    <div className="text-xs font-semibold text-[var(--color-accent)]">{cat.label}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.perms.map(p => {
                        const checked = editPerms.includes(p.id);
                        return (
                          <label
                            key={p.id}
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
                                if (e.target.checked) setEditPerms([...editPerms, p.id]);
                                else setEditPerms(editPerms.filter(id => id !== p.id));
                              }}
                              className="mt-0.5 rounded border-[var(--color-line)] text-[var(--color-accent)]"
                            />
                            <div>
                              <span className="text-xs font-medium text-[var(--color-ink)] block">{p.label}</span>
                              <span className="text-[10px] text-[var(--color-ink-dim)] block leading-tight">{p.desc}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-line)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSubuser(null)}
                className="btn px-4 py-2 text-xs border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary px-4 py-2 text-xs font-semibold"
              >
                Save Permissions
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Activity Log Modal */}
      {viewingActivitySubuser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="surface w-full max-w-xl max-h-[85vh] rounded-lg border border-[var(--color-line)] flex flex-col overflow-hidden bg-[var(--color-surface)]">
            <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">
                  Activity Audit &bull; {viewingActivitySubuser.username}
                </h3>
                <p className="text-xs text-[var(--color-ink-dim)]">Actions recorded on this server</p>
              </div>
              <button
                onClick={() => setViewingActivitySubuser(null)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {loadingActivity ? (
                <div className="py-8 text-center text-xs text-[var(--color-ink-dim)]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--color-accent)]" />
                  Loading audit log...
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--color-ink-dim)]">
                  No audit log entries recorded for this subuser on this server yet.
                </div>
              ) : (
                activityLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--color-accent)] font-mono">{log.action}</span>
                      <span className="text-[10px] text-[var(--color-ink-dim)] font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[var(--color-ink)] mt-1 font-mono">{log.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SubUsers;
