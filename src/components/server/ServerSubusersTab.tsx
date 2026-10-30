import React, { useState, useEffect } from 'react';
import { Server, ServerSubuser } from '../../types';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { Users, Shield, Plus, Trash2, Edit2, AlertCircle, X, Check, Save } from 'lucide-react';

interface ExtendedSubuser extends ServerSubuser {
  username?: string;
  email?: string;
  displayName?: string;
  role?: string;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'server.view', label: 'View Server', desc: 'Allows viewing basic server details' },
  { id: 'console.view', label: 'View Console', desc: 'Allows viewing live server console' },
  { id: 'console.send', label: 'Send Commands', desc: 'Allows sending commands to the console' },
  { id: 'server.start', label: 'Start Server', desc: 'Start the server' },
  { id: 'server.stop', label: 'Stop Server', desc: 'Stop the server cleanly' },
  { id: 'server.restart', label: 'Restart Server', desc: 'Restart the server' },
  { id: 'server.kill', label: 'Kill Server', desc: 'Force stop the server' },
  { id: 'server.reinstall', label: 'Reinstall Server', desc: 'Delete all files and reinstall' },
  { id: 'monitoring.view', label: 'View Monitoring', desc: 'View server resource usage' },
  { id: 'files.view', label: 'View Files', desc: 'Browse the file manager' },
  { id: 'files.create', label: 'Create Files/Folders', desc: 'Create new files or directories' },
  { id: 'files.edit', label: 'Edit Files', desc: 'Edit file contents' },
  { id: 'files.delete', label: 'Delete Files', desc: 'Delete files and folders' },
  { id: 'files.rename', label: 'Rename/Move Files', desc: 'Rename or move files' },
  { id: 'files.upload', label: 'Upload Files', desc: 'Upload files via the browser' },
  { id: 'files.download', label: 'Download Files', desc: 'Download files' },
  { id: 'sftp.connect', label: 'SFTP Connect', desc: 'Allows connecting to server via SFTP' },
  { id: 'plugins.view', label: 'View Plugins', desc: 'View installed plugins' },
  { id: 'plugins.manage', label: 'Manage Plugins', desc: 'Install, toggle, and delete plugins' },
  { id: 'backups.view', label: 'View Backups', desc: 'View server backups' },
  { id: 'backups.create', label: 'Create Backups', desc: 'Create new backups' },
  { id: 'backups.restore', label: 'Restore Backups', desc: 'Restore from a backup' },
  { id: 'backups.delete', label: 'Delete Backups', desc: 'Delete backups' },
  { id: 'backups.download', label: 'Download Backups', desc: 'Download backup archives' },
  { id: 'databases.view', label: 'View Databases', desc: 'View databases' },
  { id: 'databases.create', label: 'Create Databases', desc: 'Create new databases' },
  { id: 'databases.delete', label: 'Delete Databases', desc: 'Delete databases' },
  { id: 'schedules.view', label: 'View Schedules', desc: 'View scheduled tasks' },
  { id: 'schedules.create', label: 'Create Schedules', desc: 'Create scheduled tasks' },
  { id: 'schedules.update', label: 'Update Schedules', desc: 'Edit existing tasks' },
  { id: 'schedules.delete', label: 'Delete Schedules', desc: 'Delete scheduled tasks' },
  { id: 'startup.update', label: 'Manage Startup', desc: 'Change variables, java versions, settings' },
  { id: 'network.view', label: 'View Network', desc: 'View server network details' },
  { id: 'network.manage', label: 'Manage Network', desc: 'Manage server network and ports' },
  { id: 'settings.view', label: 'View Settings', desc: 'View server settings' },
  { id: 'settings.manage', label: 'Manage Settings', desc: 'Manage server settings' },
  { id: 'subusers.view', label: 'View Subusers', desc: 'View server subusers' },
  { id: 'subusers.create', label: 'Create Subusers', desc: 'Add new subusers' },
  { id: 'subusers.update', label: 'Update Subusers', desc: 'Edit subuser permissions' },
  { id: 'subusers.delete', label: 'Delete Subusers', desc: 'Remove subusers' },
  { id: 'activity.view', label: 'View Activity Log', desc: 'View the server audit log' },
  { id: 'discord.manage', label: 'Manage Discord', desc: 'Manage Discord bot integration' }
];

interface ServerSubusersTabProps {
  server: Server;
}

export const ServerSubusersTab: React.FC<ServerSubusersTabProps> = ({ server }) => {
  const [subusers, setSubusers] = useState<ExtendedSubuser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<ExtendedSubuser | null>(null);

  // Form State
  const [emailInput, setEmailInput] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const hasPerm = (perm: string) => {
    if (user?.role === 'admin' || user?.role === 'super_admin') return true;
    if (!server?.isSubuser) return true;
    return !!server?.permissions?.includes(perm);
  };
  const canCreate = hasPerm('subusers.create');
  const canUpdate = hasPerm('subusers.update');
  const canDelete = hasPerm('subusers.delete');

  const fetchSubusers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest(`/servers/${server.id}/subusers`);
      if (res.success) {
        setSubusers(res.data);
      } else {
        setError(res.error?.message || 'Failed to load subusers');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading subusers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubusers();
  }, [server.id]);

  const handleTogglePerm = (perm: string) => {
    setSelectedPerms(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSelectAllPerms = () => {
    const reachablePerms = AVAILABLE_PERMISSIONS.filter(p => hasPerm(p.id)).map(p => p.id);
    if (selectedPerms.length === reachablePerms.length) {
      setSelectedPerms([]);
    } else {
      setSelectedPerms(reachablePerms);
    }
  };

  const handleAddSubuser = async () => {
    if (!emailInput.trim()) return setError('Please enter a user email or username.');
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await apiRequest(`/servers/${server.id}/subusers`, {
        method: 'POST',
        body: JSON.stringify({ email: emailInput.trim(), permissions: selectedPerms })
      });
      if (res.success) {
        setSubusers([...subusers, res.data]);
        setShowAddModal(false);
        setEmailInput('');
        setSelectedPerms([]);
      } else {
        setError(res.error?.message || 'Failed to add subuser');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while adding subuser');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubuser = async () => {
    if (!showEditModal) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await apiRequest(`/servers/${server.id}/subusers/${showEditModal.id}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: selectedPerms })
      });
      if (res.success) {
        setSubusers(subusers.map(s => s.id === showEditModal.id ? res.data : s));
        setShowEditModal(null);
        setSelectedPerms([]);
      } else {
        setError(res.error?.message || 'Failed to update subuser');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating subuser');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeSubuser = async (subuserId: string) => {
    if (!window.confirm('Are you sure you want to revoke access for this subuser?')) return;
    try {
      setError(null);
      const res = await apiRequest(`/servers/${server.id}/subusers/${subuserId}`, {
        method: 'DELETE'
      });
      if (res.success) {
        setSubusers(subusers.filter(s => s.id !== subuserId));
      } else {
        setError(res.error?.message || 'Failed to revoke subuser');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while revoking subuser');
    }
  };

  const openAddModal = () => {
    setEmailInput('');
    setSelectedPerms([]);
    setError(null);
    setShowAddModal(true);
  };

  const openEditModal = (subuser: ExtendedSubuser) => {
    setShowEditModal(subuser);
    setSelectedPerms(subuser.permissions || []);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            Subusers
          </h2>
          <p className="text-ink-mute text-xs mt-0.5">
            Grant team members access to manage this server with fine-grained permissions.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openAddModal}
            className="btn btn-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Subuser
          </button>
        )}
      </div>

      {error && !showAddModal && !showEditModal && (
        <div className="p-3 bg-err/10 border border-err/25 rounded-lg flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-err shrink-0 mt-0.5" />
          <p className="text-xs text-err">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 surface rounded-lg anim-shimmer" />
          <div className="h-20 surface rounded-lg anim-shimmer" />
        </div>
      ) : subusers.length === 0 ? (
        <div className="surface rounded-lg p-10 text-center">
          <Shield className="h-8 w-8 text-ink-mute mx-auto mb-3" />
          <h3 className="text-sm font-medium text-ink mb-1">No Subusers Found</h3>
          <p className="text-xs text-ink-mute max-w-sm mx-auto">
            You are currently the only authorized user for this container. Add a subuser to grant access.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {subusers.map(sub => {
            const isSelf = sub.userId === user?.id;
            return (
              <div key={sub.id} className="surface rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-surface-2 border border-line text-accent flex items-center justify-center font-mono text-xs font-semibold">
                      {(sub.username || sub.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                        {sub.username || sub.email}
                        {isSelf && (
                          <span className="px-1.5 py-0.2 rounded bg-surface-3 text-ink-dim text-[10px] font-mono uppercase">
                            You
                          </span>
                        )}
                      </h3>
                      {sub.email && sub.username !== sub.email && (
                        <p className="text-[11px] font-mono text-ink-mute">{sub.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isSelf && canUpdate && (
                      <button
                        onClick={() => openEditModal(sub)}
                        className="btn-icon text-ink-mute hover:text-ink"
                        title="Edit Permissions"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!isSelf && canDelete && (
                      <button
                        onClick={() => handleRevokeSubuser(sub.id)}
                        className="btn-icon text-ink-mute hover:text-err"
                        title="Revoke Access"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isSelf && (
                      <span className="text-[10px] font-mono text-ink-mute bg-surface-2 px-2 py-0.5 border border-line rounded">
                        Locked
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="label mb-1.5">Permissions ({sub.permissions?.length || 0})</p>
                  <div className="flex flex-wrap gap-1">
                    {sub.permissions?.slice(0, 10).map(perm => (
                      <span key={perm} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-line text-ink-dim">
                        {perm}
                      </span>
                    ))}
                    {(sub.permissions?.length || 0) > 10 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-line text-ink-mute">
                        +{(sub.permissions?.length || 0) - 10} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="surface rounded-lg w-full max-w-2xl flex flex-col max-h-[85vh] anim-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-line shrink-0">
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                {showEditModal ? (
                  <>
                    <Edit2 className="h-4 w-4 text-accent" />
                    Edit Permissions: {showEditModal.username}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 text-accent" />
                    Add New Subuser
                  </>
                )}
              </h2>
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(null); }}
                className="btn-icon text-ink-mute hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {error && (
                <div className="p-3 bg-err/10 border border-err/25 rounded-lg flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-err shrink-0 mt-0.5" />
                  <p className="text-xs text-err">{error}</p>
                </div>
              )}

              {showAddModal && (
                <div className="space-y-1">
                  <label className="label">User Email or Username</label>
                  <input
                    type="text"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. operator@domain.com or user123"
                    className="field w-full font-mono text-xs"
                  />
                  <p className="text-[11px] text-ink-mute">The user must already have a registered account.</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label">Permissions Matrix</label>
                  <button
                    onClick={handleSelectAllPerms}
                    className="text-[11px] text-accent hover:underline font-mono"
                  >
                    {selectedPerms.length === AVAILABLE_PERMISSIONS.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_PERMISSIONS.filter(p => hasPerm(p.id)).map(perm => {
                    const isSelected = selectedPerms.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        onClick={() => handleTogglePerm(perm.id)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-accent/10 border-accent/40'
                            : 'bg-surface-2 border-line hover:border-line-soft'
                        }`}
                      >
                        <div className={`mt-0.5 flex-shrink-0 h-3.5 w-3.5 rounded flex items-center justify-center border ${
                          isSelected ? 'bg-accent border-accent text-white' : 'border-line text-transparent'
                        }`}>
                          <Check className="h-2.5 w-2.5" />
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${isSelected ? 'text-accent' : 'text-ink'}`}>
                            {perm.label}
                          </p>
                          <p className="text-[10px] text-ink-mute leading-snug">
                            {perm.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-line flex justify-end gap-2 shrink-0">
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(null); }}
                className="btn btn-ghost"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={showEditModal ? handleEditSubuser : handleAddSubuser}
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? (
                  <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : showEditModal ? (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Permissions
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Add Subuser
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
