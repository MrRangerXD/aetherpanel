import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { AfkSession, RewardTransaction, AfkSettings } from '../../types';
import {
  Coins, Play, Square, ShieldCheck, History, Award, Zap, AlertCircle, RefreshCw
} from 'lucide-react';

export const AfkRewards: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [todayEarnedCredits, setTodayEarnedCredits] = useState(0);
  const [settings, setSettings] = useState<AfkSettings>({
    enabled: true,
    creditsPerInterval: 5,
    intervalMinutes: 10,
    dailyMaxCredits: 100,
    weeklyMaxCredits: 500,
    minAccountAgeDays: 0
  });

  const [activeSession, setActiveSession] = useState<AfkSession | null>(null);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);

  // Session timer states
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [heartbeatStatus, setHeartbeatStatus] = useState<string>('Idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch AFK Status & Wallet Data
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMsg(null);
      const [statusRes, walletRes]: any[] = await Promise.all([
        apiRequest('/afk/status'),
        apiRequest('/afk/wallet')
      ]);

      if (statusRes.success) {
        setUserCredits(statusRes.userCredits);
        setTodayEarnedCredits(statusRes.todayEarnedCredits);
        setSettings(statusRes.settings);
        setActiveSession(statusRes.activeSession);
      }

      if (walletRes.success) {
        setTransactions(walletRes.transactions || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load AFK reward wallet data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Send Heartbeat to server
  const sendHeartbeat = useCallback(async (sessId: string) => {
    try {
      setHeartbeatStatus('Syncing heartbeat with server...');
      const res: any = await apiRequest('/afk/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sessId })
      });

      if (res.success) {
        setHeartbeatStatus('Heartbeat verified');
        setUserCredits(res.totalCredits);
        if (res.awardedCredits > 0) {
          setTodayEarnedCredits(prev => prev + res.awardedCredits);
        }
      }
    } catch (err: any) {
      setHeartbeatStatus('Heartbeat error');
    }
  }, []);

  // Timer & Heartbeat setup when active session exists
  useEffect(() => {
    if (!activeSession) {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setSecondsElapsed(0);
      return;
    }

    const startMs = new Date(activeSession.startedAt).getTime();
    setSecondsElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));

    timerIntervalRef.current = setInterval(() => {
      setSecondsElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);

    const intervalSeconds = Math.min(60, settings.intervalMinutes * 60);
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat(activeSession.id);
    }, intervalSeconds * 1000);

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeSession, settings.intervalMinutes, sendHeartbeat]);

  const handleStartAfk = async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      setErrorMsg(null);
      const res: any = await apiRequest('/afk/start', { method: 'POST' });

      if (res.success) {
        setActiveSession(res.session);
        setSecondsElapsed(0);
        setHeartbeatStatus('AFK Session active');
        fetchData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start AFK session.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStopAfk = async () => {
    if (!activeSession) return;
    try {
      setLoading(true);
      await apiRequest('/afk/stop', {
        method: 'POST',
        body: JSON.stringify({ sessionId: activeSession.id })
      });
      setActiveSession(null);
      setHeartbeatStatus('Stopped');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to stop AFK session.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const dailyProgressPercent = Math.min(100, Math.round((todayEarnedCredits / settings.dailyMaxCredits) * 100));

  if (loading && !activeSession) {
    return (
      <div className="surface p-12 text-center rounded-lg text-xs text-[var(--color-ink-dim)] space-y-2">
        <RefreshCw className="w-5 h-5 animate-spin text-[var(--color-accent)] mx-auto" />
        <span>Loading AFK Rewards & Wallet...</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-line)] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2">
            <Coins className="w-5 h-5 text-[var(--color-accent)]" />
            <span>AFK Rewards & Wallet</span>
          </h1>
          <p className="text-xs text-[var(--color-ink-mute)] mt-1">
            Earn hosting credits by keeping your control plane active in your browser.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="btn btn-ghost text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[var(--color-accent)]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-md bg-[var(--color-err)]/10 border border-[var(--color-err)]/30 text-[var(--color-err)] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="surface p-4 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="label">Available Credits</span>
            <Coins className="w-3.5 h-3.5 text-[var(--color-ink-mute)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-ink)] font-mono">+{userCredits.toLocaleString()} Credits</p>
          <p className="text-[10px] text-[var(--color-ink-mute)]">Ready for server renewals</p>
        </div>

        <div className="surface p-4 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="label">Today's Earnings</span>
            <Award className="w-3.5 h-3.5 text-[var(--color-ink-mute)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-ink)] font-mono">+{todayEarnedCredits} / {settings.dailyMaxCredits}</p>
          <div className="w-full bg-[var(--color-surface-2)] rounded-full h-1 mt-2 overflow-hidden border border-[var(--color-line)]">
            <div
              className="bg-[var(--color-accent)] h-full transition-all duration-300"
              style={{ width: `${dailyProgressPercent}%` }}
            />
          </div>
        </div>

        <div className="surface p-4 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="label">AFK Rate</span>
            <Zap className="w-3.5 h-3.5 text-[var(--color-ink-mute)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-ink)] font-mono">+{settings.creditsPerInterval} Credits</p>
          <p className="text-[10px] text-[var(--color-ink-mute)]">Every {settings.intervalMinutes} min active</p>
        </div>
      </div>

      {/* AFK Control Panel */}
      <div className="surface p-5 sm:p-6 rounded-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeSession ? 'bg-[var(--color-ok)] animate-pulse' : 'bg-[var(--color-ink-mute)]'}`} />
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">AFK Loyalty Session</h2>
            </div>
            <p className="text-xs text-[var(--color-ink-mute)] max-w-lg leading-relaxed">
              Keep this tab open while managing your servers to automatically earn reward credits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeSession ? (
              <button
                onClick={handleStopAfk}
                className="btn btn-danger text-xs py-2 px-4 flex items-center gap-2"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Session</span>
              </button>
            ) : (
              <button
                onClick={handleStartAfk}
                className="btn btn-primary text-xs py-2 px-5 flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start AFK Session</span>
              </button>
            )}
          </div>
        </div>

        {activeSession && (
          <div className="pt-4 border-t border-[var(--color-line)] grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] space-y-0.5">
              <span className="label">Active Time</span>
              <p className="text-xl font-mono font-bold text-[var(--color-accent)]">{formatTime(secondsElapsed)}</p>
            </div>

            <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] space-y-0.5">
              <span className="label">Earned This Session</span>
              <p className="text-xl font-mono font-bold text-[var(--color-ok)]">+{activeSession.earnedCredits} Credits</p>
            </div>

            <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] space-y-0.5">
              <span className="label">Sync Status</span>
              <p className="text-xs font-medium text-[var(--color-ink)] mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-ok)] shrink-0" />
                <span>{heartbeatStatus}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History Ledger */}
      <div className="surface p-5 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>Reward Transaction Ledger</span>
          </h3>
          <span className="text-xs text-[var(--color-ink-mute)] font-mono">{transactions.length} Entries</span>
        </div>

        {transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-ink-mute)]">
            No reward transactions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--color-line)]">
            <table className="w-full text-left text-xs">
              <thead className="surface-2 text-[var(--color-ink-mute)] label border-b border-[var(--color-line)]">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-[var(--color-surface-2)] transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[var(--color-ink-mute)] text-[11px]">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono surface-2 border border-[var(--color-line)] text-[var(--color-ink-dim)]">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[var(--color-ink)]">{tx.description}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-medium ${tx.amount >= 0 ? 'text-[var(--color-ok)]' : 'text-[var(--color-err)]'}`}>
                      {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
