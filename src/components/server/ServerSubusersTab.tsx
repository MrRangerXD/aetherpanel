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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-violet-400" />
            Subusers
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Grant other users access to manage this server with specific permissions.
          </p>
        </div>
        {canCreate && (
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all bg-violet-600 hover:bg-violet-500 text-white shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Add Subuser
        </button>
        )}
      </div>

      {error && !showAddModal && !showEditModal && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-zinc-900 rounded-xl"></div>
          <div className="h-20 bg-zinc-900 rounded-xl"></div>
        </div>
      ) : subusers.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
          <Shield className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">No Subusers Found</h3>
          <p className="text-zinc-400 max-w-md mx-auto">
            You are the only person who has access to this server. Add a subuser to collaborate.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {subusers.map(sub => {
            const isSelf = sub.userId === user?.id;
            return (
              <div key={sub.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">
                      {(sub.username || sub.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        {sub.username || sub.email}
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                            You
                          </span>
                        )}
                      </h3>
                      {sub.email && sub.username !== sub.email && (
                        <p className="text-xs text-zinc-400">{sub.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isSelf && canUpdate && (
                    <button
                      onClick={() => openEditModal(sub)}
                      className="p-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Edit Permissions"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    )}
                    {!isSelf && canDelete && (
                    <button
                      onClick={() => handleRevokeSubuser(sub.id)}
                      className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Revoke Access"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    )}
                    {isSelf && (
                      <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-1 border border-zinc-800 rounded italic cursor-help" title="You cannot modify your own server permissions.">
                        Locked
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500 font-semibold mb-2 uppercase">Permissions ({sub.permissions?.length || 0})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sub.permissions?.slice(0, 10).map(perm => (
                      <span key={perm} className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                        {perm}
                      </span>
                    ))}
                    {(sub.permissions?.length || 0) > 10 && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-zinc-800 shrink-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {showEditModal ? (
                  <>
                    <Edit2 className="h-5 w-5 text-amber-400" />
                    Edit Permissions for {showEditModal.username}
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 text-violet-400" />
                    Add New Subuser
                  </>
                )}
              </h2>
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(null); }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-300">{error}</p>
                </div>
              )}

              {showAddModal && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-zinc-300">User Email or Username</label>
                  <input
                    type="text"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. hello@example.com or user123"
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                  <p className="text-xs text-zinc-500">The user must already be registered in AetherPanel.</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-zinc-300">Permissions</label>
                  <button
                    onClick={handleSelectAllPerms}
                    className="text-xs text-violet-400 hover:text-violet-300 font-semibold"
                  >
                    {selectedPerms.length === AVAILABLE_PERMISSIONS.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {AVAILABLE_PERMISSIONS.filter(p => hasPerm(p.id)).map(perm => {
                    const isSelected = selectedPerms.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        onClick={() => handleTogglePerm(perm.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-violet-600/20 border-violet-500'
                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        <div className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded flex items-center justify-center border ${
                          isSelected ? 'bg-violet-500 border-violet-500 text-white' : 'border-zinc-600'
                        }`}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isSelected ? 'text-violet-300' : 'text-zinc-300'}`}>
                            {perm.label}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                            {perm.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-zinc-800 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(null); }}
                className="px-4 py-2.5 rounded-xl font-semibold text-zinc-400 hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={showEditModal ? handleEditSubuser : handleAddSubuser}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : showEditModal ? (
                  <>
                    <Save className="h-4 w-4" />
                    Save Permissions
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
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
