import React, { useState, useEffect, useCallback } from 'react';
import { Server, OnlinePlayer, OpPlayer, WhitelistPlayer, BannedPlayer, BannedIp } from '../../types';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import {
  Users, Crown, ListCheck, Ban, Plus, Trash2, UserX, Shield,
  RefreshCw, CheckCircle, Search, X, AlertCircle
} from 'lucide-react';

interface PlayerManagerProps {
  server: Server;
}

export const PlayerManager: React.FC<PlayerManagerProps> = ({ server }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'online' | 'ops' | 'whitelist' | 'bans'>('online');

  // Online Players State
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);

  // Operators State
  const [ops, setOps] = useState<OpPlayer[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);

  // Whitelist State
  const [whitelist, setWhitelist] = useState<WhitelistPlayer[]>([]);
  const [loadingWhitelist, setLoadingWhitelist] = useState(false);

  // Bans State
  const [bannedPlayers, setBannedPlayers] = useState<BannedPlayer[]>([]);
  const [bannedIps, setBannedIps] = useState<BannedIp[]>([]);
  const [loadingBans, setLoadingBans] = useState(false);

  // Common Action Loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals / Input State
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTargetType, setModalTargetType] = useState<'op' | 'whitelist' | 'ban' | 'ban-ip'>('op');
  const [inputPlayerName, setInputPlayerName] = useState('');
  const [inputReason, setInputReason] = useState('');

  // Fetch online players
  const fetchOnline = useCallback(async () => {
    setLoadingOnline(true);
    try {
      const res = await apiRequest<OnlinePlayer[]>(
        `/servers/${server.id}/players/online`
      );
      if (res.success) {
        setOnlinePlayers(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch online players');
    } finally {
      setLoadingOnline(false);
    }
  }, [server.id, toast]);

  // Fetch OPs
  const fetchOps = useCallback(async () => {
    setLoadingOps(true);
    try {
      const res = await apiRequest<OpPlayer[]>(
        `/servers/${server.id}/players/ops`
      );
      if (res.success) {
        setOps(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch operators');
    } finally {
      setLoadingOps(false);
    }
  }, [server.id, toast]);

  // Fetch Whitelist
  const fetchWhitelist = useCallback(async () => {
    setLoadingWhitelist(true);
    try {
      const res = await apiRequest<WhitelistPlayer[]>(
        `/servers/${server.id}/players/whitelist`
      );
      if (res.success) {
        setWhitelist(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch whitelist');
    } finally {
      setLoadingWhitelist(false);
    }
  }, [server.id, toast]);

  // Fetch Bans
  const fetchBans = useCallback(async () => {
    setLoadingBans(true);
    try {
      const res = await apiRequest<{ players: BannedPlayer[]; ips: BannedIp[] }>(
        `/servers/${server.id}/players/bans`
      );
      if (res.success) {
        setBannedPlayers(res.data?.players || []);
        setBannedIps(res.data?.ips || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch ban list');
    } finally {
      setLoadingBans(false);
    }
  }, [server.id, toast]);

  useEffect(() => {
    if (activeTab === 'online') fetchOnline();
    if (activeTab === 'ops') fetchOps();
    if (activeTab === 'whitelist') fetchWhitelist();
    if (activeTab === 'bans') fetchBans();
  }, [activeTab, fetchOnline, fetchOps, fetchWhitelist, fetchBans]);

  // Quick Player Actions (Kick, Ban, Op)
  const handleQuickAction = async (action: 'kick' | 'ban' | 'op' | 'deop', player: string) => {
    setActionLoading(`${action}_${player}`);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/servers/${server.id}/players/${action}`,
        {
          method: 'POST',
          body: JSON.stringify({ player, reason: `Action performed by admin via control panel` })
        }
      );
      if (res.success) {
        toast.success(res.message);
        if (activeTab === 'online') fetchOnline();
        if (activeTab === 'ops') fetchOps();
        if (activeTab === 'bans') fetchBans();
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to perform ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Remove from list (Deop, Unwhitelist, Pardon)
  const handleRemoveFromList = async (list: 'ops' | 'whitelist' | 'banned-players' | 'banned-ips', target: string) => {
    setActionLoading(`${list}_${target}`);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/servers/${server.id}/players/${list}/${encodeURIComponent(target)}`,
        { method: 'DELETE' }
      );
      if (res.success) {
        toast.success(res.message);
        if (list === 'ops') fetchOps();
        if (list === 'whitelist') fetchWhitelist();
        if (list.startsWith('banned')) fetchBans();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove player');
    } finally {
      setActionLoading(null);
    }
  };

  // Add to List Submit (Modal)
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPlayerName.trim()) return;

    setActionLoading('modal_submit');
    try {
      if (modalTargetType === 'op') {
        const res = await apiRequest<{ success: boolean; message: string }>(
          `/servers/${server.id}/players/ops`,
          { method: 'POST', body: JSON.stringify({ player: inputPlayerName.trim() }) }
        );
        if (res.success) {
          toast.success(res.message);
          fetchOps();
        }
      } else if (modalTargetType === 'whitelist') {
        const res = await apiRequest<{ success: boolean; message: string }>(
          `/servers/${server.id}/players/whitelist`,
          { method: 'POST', body: JSON.stringify({ player: inputPlayerName.trim() }) }
        );
        if (res.success) {
          toast.success(res.message);
          fetchWhitelist();
        }
      } else if (modalTargetType === 'ban') {
        const res = await apiRequest<{ success: boolean; message: string }>(
          `/servers/${server.id}/players/banned-players`,
          { method: 'POST', body: JSON.stringify({ player: inputPlayerName.trim(), reason: inputReason.trim() }) }
        );
        if (res.success) {
          toast.success(res.message);
          fetchBans();
        }
      } else if (modalTargetType === 'ban-ip') {
        const res = await apiRequest<{ success: boolean; message: string }>(
          `/servers/${server.id}/players/banned-ips`,
          { method: 'POST', body: JSON.stringify({ ip: inputPlayerName.trim(), reason: inputReason.trim() }) }
        );
        if (res.success) {
          toast.success(res.message);
          fetchBans();
        }
      }

      setShowAddModal(false);
      setInputPlayerName('');
      setInputReason('');
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-line)] pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-ink)]">
            <Users className="w-5 h-5 text-[var(--color-accent)]" />
            Player Management
          </h2>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1">
            Real-time player monitoring, permission levels, whitelist enforcement, and ban enforcement
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--color-surface-2)] p-1 rounded-lg border border-[var(--color-line)]">
            <button
              onClick={() => setActiveTab('online')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'online'
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Online ({onlinePlayers.length})
            </button>
            <button
              onClick={() => setActiveTab('ops')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'ops'
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              OPs ({ops.length})
            </button>
            <button
              onClick={() => setActiveTab('whitelist')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'whitelist'
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
              }`}
            >
              <ListCheck className="w-3.5 h-3.5" />
              Whitelist ({whitelist.length})
            </button>
            <button
              onClick={() => setActiveTab('bans')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'bans'
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              Bans ({bannedPlayers.length + bannedIps.length})
            </button>
          </div>
        </div>
      </div>

      {/* Online Players Tab */}
      {activeTab === 'online' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-ink-dim)]">
              {server.status === 'running'
                ? `${onlinePlayers.length} active player(s) detected via server console buffer`
                : 'Server is offline. Online player detection is active when running.'}
            </span>
            <button
              onClick={fetchOnline}
              disabled={loadingOnline}
              className="btn px-3 py-1.5 text-xs border border-[var(--color-line)] flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOnline ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingOnline ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="surface h-14 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : onlinePlayers.length === 0 ? (
            <div className="surface p-12 text-center rounded-lg border border-[var(--color-line)]">
              <Users className="w-10 h-10 mx-auto text-[var(--color-ink-mute)] mb-3" />
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">No players online</h3>
              <p className="text-xs text-[var(--color-ink-dim)] mt-1">
                {server.status === 'running'
                  ? 'No player join logs detected in current session.'
                  : 'Start the server to allow players to connect.'}
              </p>
            </div>
          ) : (
            <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
              {onlinePlayers.map(p => {
                const isOp = ops.some(o => o.name.toLowerCase() === p.name.toLowerCase());
                return (
                  <div key={p.name} className="p-3 sm:p-4 flex items-center justify-between gap-4 hover:bg-[var(--color-surface-2)]/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={p.avatarUrl || `https://minotar.net/avatar/${p.name}/64.png`}
                        alt={p.name}
                        className="w-9 h-9 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)]"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[var(--color-ink)] font-mono">{p.name}</span>
                          {isOp && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-warn)]/10 text-[var(--color-warn)] border border-[var(--color-warn)]/30 font-semibold flex items-center gap-1">
                              <Crown className="w-3 h-3" /> OP
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--color-ok)] flex items-center gap-1 mt-0.5 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)]" /> Online
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOp ? (
                        <button
                          onClick={() => handleQuickAction('deop', p.name)}
                          disabled={actionLoading === `deop_${p.name}`}
                          className="btn px-2.5 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-warn)] text-[var(--color-warn)]"
                        >
                          De-OP
                        </button>
                      ) : (
                        <button
                          onClick={() => handleQuickAction('op', p.name)}
                          disabled={actionLoading === `op_${p.name}`}
                          className="btn px-2.5 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-warn)] text-[var(--color-ink-dim)] hover:text-[var(--color-warn)]"
                        >
                          Make OP
                        </button>
                      )}

                      <button
                        onClick={() => handleQuickAction('kick', p.name)}
                        disabled={actionLoading === `kick_${p.name}`}
                        className="btn px-2.5 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-err)] hover:text-[var(--color-err)]"
                      >
                        Kick
                      </button>

                      <button
                        onClick={() => handleQuickAction('ban', p.name)}
                        disabled={actionLoading === `ban_${p.name}`}
                        className="btn-danger px-2.5 py-1.5 text-xs"
                      >
                        Ban
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Operators (OPs) Tab */}
      {activeTab === 'ops' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-ink-dim)]">
              Operators have full command access according to <code className="text-[var(--color-ink)]">ops.json</code>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setModalTargetType('op');
                  setShowAddModal(true);
                }}
                className="btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Operator
              </button>
              <button
                onClick={fetchOps}
                disabled={loadingOps}
                className="btn px-3 py-1.5 text-xs border border-[var(--color-line)]"
              >
                Refresh
              </button>
            </div>
          </div>

          {loadingOps ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="surface h-14 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : ops.length === 0 ? (
            <div className="surface p-12 text-center rounded-lg border border-[var(--color-line)]">
              <Crown className="w-10 h-10 mx-auto text-[var(--color-ink-mute)] mb-3" />
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">No operators defined</h3>
              <p className="text-xs text-[var(--color-ink-dim)] mt-1">
                ops.json is currently empty. Add trusted players as operators.
              </p>
            </div>
          ) : (
            <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
              {ops.map(o => (
                <div key={o.name} className="p-3 sm:p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={`https://minotar.net/avatar/${o.name}/64.png`}
                      alt={o.name}
                      className="w-9 h-9 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)]"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[var(--color-ink)] font-mono">{o.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-surface-3)] text-[var(--color-ink-dim)] font-mono">
                          Level {o.level}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--color-ink-dim)] font-mono truncate block mt-0.5">
                        UUID: {o.uuid}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveFromList('ops', o.name)}
                    disabled={actionLoading === `ops_${o.name}`}
                    className="btn p-2 text-xs rounded-md border border-[var(--color-line)] hover:border-[var(--color-err)] hover:text-[var(--color-err)]"
                    title="Remove Operator"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Whitelist Tab */}
      {activeTab === 'whitelist' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-ink-dim)]">
              Enforced players in <code className="text-[var(--color-ink)]">whitelist.json</code>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setModalTargetType('whitelist');
                  setShowAddModal(true);
                }}
                className="btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add to Whitelist
              </button>
              <button
                onClick={fetchWhitelist}
                disabled={loadingWhitelist}
                className="btn px-3 py-1.5 text-xs border border-[var(--color-line)]"
              >
                Refresh
              </button>
            </div>
          </div>

          {loadingWhitelist ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="surface h-14 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : whitelist.length === 0 ? (
            <div className="surface p-12 text-center rounded-lg border border-[var(--color-line)]">
              <ListCheck className="w-10 h-10 mx-auto text-[var(--color-ink-mute)] mb-3" />
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Whitelist is empty</h3>
              <p className="text-xs text-[var(--color-ink-dim)] mt-1">
                Add players to allow them through when white-list=true in server.properties.
              </p>
            </div>
          ) : (
            <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
              {whitelist.map(w => (
                <div key={w.name} className="p-3 sm:p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={`https://minotar.net/avatar/${w.name}/64.png`}
                      alt={w.name}
                      className="w-9 h-9 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)]"
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-sm text-[var(--color-ink)] font-mono">{w.name}</span>
                      <span className="text-[11px] text-[var(--color-ink-dim)] font-mono truncate block mt-0.5">
                        UUID: {w.uuid}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveFromList('whitelist', w.name)}
                    disabled={actionLoading === `whitelist_${w.name}`}
                    className="btn p-2 text-xs rounded-md border border-[var(--color-line)] hover:border-[var(--color-err)] hover:text-[var(--color-err)]"
                    title="Remove from Whitelist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bans Tab */}
      {activeTab === 'bans' && (
        <div className="space-y-6">
          {/* Banned Players */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                <Ban className="w-4 h-4 text-[var(--color-err)]" />
                Banned Players ({bannedPlayers.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setModalTargetType('ban');
                    setShowAddModal(true);
                  }}
                  className="btn-danger px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ban Player
                </button>
                <button
                  onClick={() => {
                    setModalTargetType('ban-ip');
                    setShowAddModal(true);
                  }}
                  className="btn px-3 py-1.5 text-xs border border-[var(--color-line)]"
                >
                  Ban IP
                </button>
              </div>
            </div>

            {loadingBans ? (
              <div className="surface h-14 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
            ) : bannedPlayers.length === 0 ? (
              <div className="surface p-8 text-center rounded-lg border border-[var(--color-line)]">
                <p className="text-xs text-[var(--color-ink-dim)]">No players currently banned.</p>
              </div>
            ) : (
              <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
                {bannedPlayers.map(b => (
                  <div key={b.name} className="p-3 sm:p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={`https://minotar.net/avatar/${b.name}/64.png`}
                        alt={b.name}
                        className="w-9 h-9 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)]"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-sm text-[var(--color-err)] font-mono">{b.name}</span>
                        <div className="text-[11px] text-[var(--color-ink-dim)] mt-0.5 space-x-2">
                          <span>Reason: <strong className="text-[var(--color-ink)]">{b.reason}</strong></span>
                          <span>&bull;</span>
                          <span>By: {b.source}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveFromList('banned-players', b.name)}
                      disabled={actionLoading === `banned-players_${b.name}`}
                      className="btn px-3 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-ok)] hover:text-[var(--color-ok)]"
                    >
                      Pardon
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Banned IPs */}
          {bannedIps.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--color-warn)]" />
                Banned IP Addresses ({bannedIps.length})
              </h3>
              <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
                {bannedIps.map(ip => (
                  <div key={ip.ip} className="p-3 sm:p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="font-mono text-xs sm:text-sm font-semibold text-[var(--color-ink)]">{ip.ip}</span>
                      <span className="block text-[11px] text-[var(--color-ink-dim)] mt-0.5">
                        Reason: {ip.reason} &bull; By: {ip.source}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveFromList('banned-ips', ip.ip)}
                      disabled={actionLoading === `banned-ips_${ip.ip}`}
                      className="btn px-3 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-ok)] hover:text-[var(--color-ok)]"
                    >
                      Pardon IP
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleModalSubmit}
            className="surface w-full max-w-md rounded-lg border border-[var(--color-line)] p-5 space-y-4 bg-[var(--color-surface)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)]">
                {modalTargetType === 'op' && 'Add Operator (OP)'}
                {modalTargetType === 'whitelist' && 'Add to Whitelist'}
                {modalTargetType === 'ban' && 'Ban Player'}
                {modalTargetType === 'ban-ip' && 'Ban IP Address'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label text-xs block mb-1">
                {modalTargetType === 'ban-ip' ? 'IP Address' : 'Minecraft Username'}
              </label>
              <input
                type="text"
                required
                placeholder={modalTargetType === 'ban-ip' ? '192.168.1.1' : 'PlayerName'}
                value={inputPlayerName}
                onChange={e => setInputPlayerName(e.target.value)}
                className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
            </div>

            {(modalTargetType === 'ban' || modalTargetType === 'ban-ip') && (
              <div>
                <label className="label text-xs block mb-1">Ban Reason</label>
                <input
                  type="text"
                  placeholder="Griefing, exploiting, or violating server rules"
                  value={inputReason}
                  onChange={e => setInputReason(e.target.value)}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn px-4 py-2 text-xs border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading === 'modal_submit'}
                className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              >
                {actionLoading === 'modal_submit' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default PlayerManager;
