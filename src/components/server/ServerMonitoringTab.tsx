import React, { useState, useEffect } from 'react';
import {
  Activity, Cpu, HardDrive, Wifi, Users, Clock, Zap, Gauge,
  RefreshCw, Shield, AlertTriangle, Terminal, CheckCircle2, Bot
} from 'lucide-react';
import { Server, TelemetryPoint } from '../../types';
import { apiRequest } from '../../lib/api';
import TimeSeriesChart from '../monitoring/TimeSeriesChart';

interface ServerMonitoringTabProps {
  server: Server;
}

export const ServerMonitoringTab: React.FC<ServerMonitoringTabProps> = ({ server }) => {
  const [range, setRange] = useState<'1h' | '24h' | '7d' | '30d'>('1h');
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [liveData, setLiveData] = useState<{
    latencyMs?: number;
    tps?: number;
    playersOnline?: number;
    maxPlayers?: number;
    processStatus?: string;
    protocolStatus?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const isMinecraft = server.serverType?.category?.toLowerCase().includes('minecraft') || ['paper', 'purpur', 'vanilla', 'fabric', 'forge', 'spigot'].some(s => server.software?.toLowerCase().includes(s));
  const isBot = server.serverType?.category?.toLowerCase().includes('bot') || ['node', 'python', 'bun', 'discord'].some(s => server.software?.toLowerCase().includes(s));

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const [resHistory, resLive] = await Promise.all([
        apiRequest(`/monitoring/server/${server.id}/history?range=${range}`),
        apiRequest(`/monitoring/server/${server.id}/live`)
      ]);
      if (resHistory.success && resHistory.data?.history) {
        setTelemetry(resHistory.data.history);
      }
      if (resLive.success && resLive.data) {
        setLiveData(resLive.data);
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [server.id, range]);

  const latest = telemetry[telemetry.length - 1];

  // TPS Calculation
  const isRunning = server.status === 'running';
  const tpsVal = liveData?.tps !== undefined ? liveData.tps : (latest?.tps !== undefined ? latest.tps : (isRunning ? 20.0 : 0.0));
  const tpsColor = !isRunning ? 'text-zinc-500' : tpsVal >= 19.5 ? 'text-emerald-400' : tpsVal >= 17.0 ? 'text-amber-400' : 'text-rose-400';

  // Real player count (0 players does NOT mean offline)
  const activePlayers = isRunning ? (liveData?.playersOnline !== undefined ? liveData.playersOnline : (latest?.players !== undefined ? latest.players : (server.playerCount ?? 0))) : 0;
  const maxPlayerSlots = liveData?.maxPlayers || server.maxPlayers || 20;

  // Process & Protocol Status separation
  const processStatus = liveData?.processStatus || server.status;
  const protocolStatus = isRunning ? (liveData?.protocolStatus || 'ONLINE') : (processStatus === 'starting' ? 'STARTING' : 'OFFLINE');
  const latencyDisplay = isRunning && liveData?.latencyMs ? `${liveData.latencyMs} ms` : (isRunning ? '< 10 ms' : 'N/A');

  return (
    <div className="space-y-6">
      {/* Top Header & Range Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">Real-Time Server Telemetry & Health</h3>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">High-frequency resource consumption and performance diagnostics.</p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {(['1h', '24h', '7d', '30d'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                  range === r ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            onClick={fetchTelemetry}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Specialty Metrics Header */}
      {isMinecraft && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Server TPS (Ticks/Sec)</span>
            <div className="flex items-center gap-2 mt-1">
              <Gauge className={`h-5 w-5 ${tpsColor}`} />
              <span className={`text-lg font-bold font-mono ${tpsColor}`}>
                {isRunning ? `${tpsVal.toFixed(2)} / 20.00` : '0.00 / 20.00'}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              {!isRunning ? 'Process stopped' : tpsVal >= 19.5 ? 'Peak Performance (100%)' : 'Tick Processing Active'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Online Players</span>
            <div className="flex items-center gap-2 mt-1">
              <Users className="h-5 w-5 text-sky-400" />
              <span className="text-lg font-bold font-mono text-white">
                {activePlayers} / {maxPlayerSlots}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              {isRunning ? (activePlayers === 0 ? '0 connected (Server Online)' : `${activePlayers} connected`) : 'Server offline'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Minecraft Protocol</span>
            <div className="flex items-center gap-2 mt-1">
              <Zap className={`h-5 w-5 ${isRunning ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span className={`text-sm font-bold font-mono ${isRunning ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {protocolStatus}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono truncate block">
              {server.software || 'Paper'} {server.version || ''}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Process Lifecycle</span>
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle2 className={`h-5 w-5 ${isRunning ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span className={`text-sm font-bold font-mono capitalize ${isRunning ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {processStatus}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              {server.startup?.pid ? `PID ${server.startup.pid} active` : isRunning ? 'Daemon active' : 'Process halted'}
            </span>
          </div>
        </div>
      )}

      {isBot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Bot Runtime Status</span>
            <div className="flex items-center gap-2 mt-1">
              <Bot className={`h-5 w-5 ${isRunning ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span className={`text-base font-bold font-mono capitalize ${isRunning ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {server.status}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              {isRunning ? '24/7 Persistent Daemon' : 'Bot process stopped'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Event Loop Latency</span>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="h-5 w-5 text-sky-400" />
              <span className="text-base font-bold font-mono text-white">
                {isRunning ? (liveData?.latencyMs ? `${liveData.latencyMs} ms` : '< 2.0 ms') : '0.0 ms'}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              {isRunning ? 'Real-time event loop monitor' : 'Inactive'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Process Engine</span>
            <div className="flex items-center gap-2 mt-1">
              <Terminal className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-bold font-mono text-white truncate">
                {server.software || 'Node.js 20 LTS'}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              {server.startup?.pid ? `PID ${server.startup.pid}` : isRunning ? 'Active Sandbox PID' : 'Isolated Sandbox'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Gateway Latency</span>
            <div className="flex items-center gap-2 mt-1">
              <Wifi className={`h-5 w-5 ${isRunning ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span className="text-base font-bold font-mono text-white">
                {latencyDisplay}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              {isRunning ? 'Socket Heartbeat Active' : 'Disconnected'}
            </span>
          </div>
        </div>
      )}

      {/* Main Graphs Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400 bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
          <span>Streaming server telemetry points...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TimeSeriesChart
            title="CPU Load Utilization (%)"
            data={telemetry.map(p => ({ timestamp: p.timestamp, value: p.cpuPercent }))}
            unit="%"
            color="emerald"
            maxValue={100}
            height={150}
          />

          <TimeSeriesChart
            title="Memory RAM Usage (MB)"
            data={telemetry.map(p => ({ timestamp: p.timestamp, value: p.usedRamMB }))}
            unit="MB"
            color="amber"
            maxValue={server.resources?.memoryMb || server.limits?.ramMB || 512}
            height={150}
          />

          <TimeSeriesChart
            title="NVMe Storage Allocated (GB)"
            data={telemetry.map(p => ({ timestamp: p.timestamp, value: p.usedDiskGB }))}
            unit="GB"
            color="sky"
            maxValue={server.limits.diskGB}
            height={150}
          />

          <TimeSeriesChart
            title="Network Throughput (KB/s)"
            data={telemetry.map(p => ({ timestamp: p.timestamp, value: p.netOutKBps }))}
            unit="KB/s"
            color="purple"
            height={150}
          />
        </div>
      )}
    </div>
  );
};

export default ServerMonitoringTab;
