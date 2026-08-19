import React, { useState, useEffect } from 'react';
import {
  Activity, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Key,
  MessageSquare, HardDrive, Database, Server, Terminal, Lock, Cpu, Info
} from 'lucide-react';
import { apiRequest } from '../../lib/api';

export const AdminDiagnostics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await apiRequest('/api/v1/admin/diagnostics');
      if (res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load system diagnostics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const renderBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
      case 'CONFIGURED':
      case 'ONLINE':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> {status}
          </span>
        );
      case 'NOT_CONFIGURED':
      case 'DISCONNECTED':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" /> {status}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 shrink-0">
            <ShieldAlert className="w-3.5 h-3.5" /> {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[600px]">
        <div className="flex items-center gap-3 text-amber-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Executing System Diagnostics Pipeline...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-amber-400" /> System Diagnostics & Health Monitor
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time backend audit, subsystem health checks, and production blocker verification.
          </p>
        </div>

        <button
          onClick={fetchDiagnostics}
          disabled={refreshing}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg transition-all disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Testing...' : 'Run Diagnostics'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Authentication Subsystem */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" /> Authentication Subsystem
              </h2>
              <span className="text-[10px] text-zinc-500 font-mono">AUTH_STACK_V1</span>
            </div>

            <div className="space-y-3">
              {/* Email / Password */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">Email & Password Auth</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{data.authentication.emailPassword.message}</div>
                </div>
                {renderBadge(data.authentication.emailPassword.status)}
              </div>

              {/* Google Firebase */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-white">Google Auth (Firebase)</div>
                  {renderBadge(data.authentication.googleFirebase.status)}
                </div>
                <div className="text-[11px] text-zinc-400">{data.authentication.googleFirebase.message}</div>
                {data.authentication.googleFirebase.requiredConfig.length > 0 && (
                  <div className="pt-2 border-t border-zinc-800/60">
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1">Required Environment Variables:</span>
                    <div className="flex flex-wrap gap-1">
                      {data.authentication.googleFirebase.requiredConfig.map((item: string) => (
                        <code key={item} className="px-2 py-0.5 rounded bg-zinc-950 text-[10px] font-mono text-zinc-300 border border-zinc-800">{item}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Discord OAuth */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-white">Discord OAuth2</div>
                  {renderBadge(data.authentication.discordOAuth.status)}
                </div>
                <div className="text-[11px] text-zinc-400">{data.authentication.discordOAuth.message}</div>
                {data.authentication.discordOAuth.requiredConfig.length > 0 && (
                  <div className="pt-2 border-t border-zinc-800/60">
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1">Required Environment Variables:</span>
                    <div className="flex flex-wrap gap-1">
                      {data.authentication.discordOAuth.requiredConfig.map((item: string) => (
                        <code key={item} className="px-2 py-0.5 rounded bg-zinc-950 text-[10px] font-mono text-zinc-300 border border-zinc-800">{item}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Discord Bot Integration */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" /> Discord Bot Gateway
              </h2>
              {renderBadge(data.discordBot.status)}
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="text-xs text-zinc-300 leading-relaxed">{data.discordBot.message}</div>

              {data.discordBot.commandsRegistered && (
                <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">Registered Slash Commands:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.discordBot.commandsRegistered.map((cmd: string) => (
                      <span key={cmd} className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[11px] font-mono">
                        {cmd}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.discordBot.requiredConfig.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/60">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1">Required Bot Configuration:</span>
                  <div className="flex flex-wrap gap-1">
                    {data.discordBot.requiredConfig.map((item: string) => (
                      <code key={item} className="px-2 py-0.5 rounded bg-zinc-950 text-[10px] font-mono text-zinc-300 border border-zinc-800">{item}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. SFTP Subsystem */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-400" /> SFTP Engine Subsystem
              </h2>
              {renderBadge(data.sftp.status)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Bind Address</span>
                <span className="text-xs font-mono font-semibold text-white mt-0.5 block">{data.sftp.bindHost}:{data.sftp.configuredPort}</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Sandbox Isolation</span>
                <span className="text-xs font-semibold text-emerald-400 mt-0.5 block">{data.sftp.filesystemIsolation}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">External WAN Connectivity Status:</span>
              <p className="text-xs text-rose-400 font-medium">{data.sftp.externalReachability}</p>
              <p className="text-[11px] text-zinc-400 mt-1">
                The container sandbox routes port 3000 exclusively. External WAN SFTP ingress requires host port mapping:
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.sftp.requiredConfig.map((item: string) => (
                  <code key={item} className="px-2 py-0.5 rounded bg-zinc-950 text-[10px] font-mono text-zinc-300 border border-zinc-800">{item}</code>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Backend Core Runtime */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" /> Core Backend Runtime
              </h2>
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> ONLINE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-zinc-400 font-medium block">Database State</span>
                <span className="text-white font-semibold mt-0.5 block">{data.runtime.database.type}</span>
                <span className="text-[10px] text-zinc-500 mt-1 block">{data.runtime.database.userCount} users / {data.runtime.database.serverCount} servers</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-zinc-400 font-medium block">Session Security</span>
                <span className="text-white font-semibold mt-0.5 block">{data.runtime.sessions.type}</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-zinc-400 font-medium block">REST API Keys</span>
                <span className="text-white font-semibold mt-0.5 block">{data.runtime.apiKeys.type}</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-zinc-400 font-medium block">Process Manager</span>
                <span className="text-white font-semibold mt-0.5 block">{data.runtime.processManager.type}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
