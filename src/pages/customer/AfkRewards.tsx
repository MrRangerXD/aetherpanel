import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { AfkSession, RewardTransaction, AfkSettings } from '../../types';
import {
  Coins, Play, Square, ShieldCheck, History, Award, Zap, AlertCircle, RefreshCw
} from 'lucide-react';

export const AfkRewards: React.FC = () => {
  const [loading, setLoading] = useState(true);
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

    // Timer elapsed calculation
    const startMs = new Date(activeSession.startedAt).getTime();
    setSecondsElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));

    timerIntervalRef.current = setInterval(() => {
      setSecondsElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);

    // Heartbeat every 60 seconds (or interval)
    const intervalSeconds = Math.min(60, settings.intervalMinutes * 60);
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat(activeSession.id);
    }, intervalSeconds * 1000);

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeSession, settings.intervalMinutes, sendHeartbeat]);

  // Start AFK Session
  const handleStartAfk = async () => {
    try {
      setLoading(true);
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
    }
  };

  // Stop AFK Session
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-xs text-zinc-400">
        <RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
        <span>Loading AFK Rewards & Wallet...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-400" />
            AFK Rewards & Wallet
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Earn hosting credits by keeping your AetherPanel control plane active in your browser.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="self-start sm:self-auto px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl border border-zinc-700/50 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-950/30 via-zinc-900 to-zinc-900 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Available Credits</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2">+{userCredits.toLocaleString()} Credits</p>
          <p className="text-[11px] text-zinc-500 mt-1">Ready to redeem for server upgrades</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Today's Earnings</span>
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2">+{todayEarnedCredits} / {settings.dailyMaxCredits}</p>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-violet-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${dailyProgressPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">AFK Reward Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2">+{settings.creditsPerInterval} Credits</p>
          <p className="text-[11px] text-zinc-500 mt-1">Credited every {settings.intervalMinutes} minutes active</p>
        </div>
      </div>

      {/* AFK Control Panel */}
      <div className="bg-gradient-to-r from-violet-950/30 via-zinc-900 to-zinc-950 border border-violet-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeSession ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <h2 className="text-base font-bold text-white">AFK Loyalty Session</h2>
            </div>
            <p className="text-xs text-zinc-400 max-w-xl">
              Keep this tab open while managing your panel or servers to automatically earn reward credits toward server renewals.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {activeSession ? (
              <button
                onClick={handleStopAfk}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                Stop Session
              </button>
            ) : (
              <button
                onClick={handleStartAfk}
                className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-violet-600/25 transition-all flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Start AFK Loyalty Session
              </button>
            )}
          </div>
        </div>

        {activeSession && (
          <div className="mt-6 pt-6 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Active Time</span>
              <p className="text-2xl font-mono font-bold text-violet-400 mt-1">{formatTime(secondsElapsed)}</p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Earned This Session</span>
              <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">+{activeSession.earnedCredits} Credits</p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Server Sync Status</span>
              <p className="text-xs font-medium text-zinc-300 mt-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{heartbeatStatus}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History Ledger */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-violet-400" />
            Reward Transaction Ledger
          </h3>
          <span className="text-xs text-zinc-500">{transactions.length} Total Ledger Entries</span>
        </div>

        {transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
            No reward transactions recorded yet. Start an AFK session to earn credits.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-zinc-850/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-zinc-400">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        tx.type === 'AFK_REWARD' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                        tx.type === 'ADMIN_ADJUSTMENT' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">{tx.description}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
