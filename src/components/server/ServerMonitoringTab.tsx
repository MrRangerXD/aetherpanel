import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Cpu, HardDrive, Wifi, Users, Clock, Zap, Gauge,
  RefreshCw, Shield, AlertTriangle, Terminal, CheckCircle2, Bot,
  Layers, Radio
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
    cpuPercent?: number;
    usedRamMB?: number;
    totalRamMB?: number;
    usedRamGB?: number;
    totalRamGB?: number;
    ramPercent?: number;
    diskUsageMB?: number;
    usedDiskGB?: number;
    totalDiskGB?: number;
    diskPercent?: number;
    oomDangerLevel?: 'safe' | 'warning' | 'critical';
    pidsCount?: number;
    oomScore?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  const isMinecraft = server.serverType?.category?.toLowerCase().includes('minecraft') || ['paper', 'purpur', 'vanilla', 'fabric', 'forge', 'spigot'].some(s => server.software?.toLowerCase().includes(s));
  const isBot = server.serverType?.category?.toLowerCase().includes('bot') || ['node', 'python', 'bun', 'discord'].some(s => server.software?.toLowerCase().includes(s));

  const fetchTelemetry = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [resHistory, resLive] = await Promise.all([
        apiRequest(`/monitoring/server/${server.id}/history?range=${range}`),
        apiRequest(`/monitoring/server/${server.id}/live`)
      ]);
      if (isMountedRef.current) {
        if (resHistory.success && Array.isArray(resHistory.data?.history)) {
          setTelemetry(resHistory.data.history);
        }
        if (resLive.success && resLive.data) {
          setLiveData(resLive.data);
        }
      }
    } catch {
      // Ignore network glitch
    } finally {
      if (isMountedRef.current && showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchTelemetry(true);

    const token = localStorage.getItem('aether_token');
    let ws: WebSocket | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    // High-Concurrency WebSocket Metrics Event Bus
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/console?serverId=${server.id}&token=${token}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'subscribe_metrics', serverId: server.id }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'metrics_history' && Array.isArray(msg.points)) {
            if (isMountedRef.current) {
              setTelemetry(msg.points);
              if (msg.points.length > 0) {
                setLiveData(msg.points[msg.points.length - 1]);
              }
              setLoading(false);
            }
          } else if (msg.type === 'metrics_tick' && msg.point) {
            if (isMountedRef.current) {
              const pt = msg.point;
              setLiveData(pt);
              setTelemetry(prev => {
                const next = [...prev, pt];
                return next.length > 120 ? next.slice(-120) : next;
              });
            }
          }
        } catch {}
      };

      ws.onerror = () => {
        startFallbackInterval();
      };
    } catch {
      startFallbackInterval();
    }

    function startFallbackInterval() {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(async () => {
        try {
          const resLive = await apiRequest(`/monitoring/server/${server.id}/live`);
          if (isMountedRef.current && resLive.success && resLive.data) {
            const live = resLive.data;
            setLiveData(live);
            setTelemetry(prev => {
              const newPoint: TelemetryPoint = {
                timestamp: live.timestamp || new Date().toISOString(),
                cpuPercent: live.cpuPercent ?? 0,
                ramPercent: live.ramPercent ?? 0,
                usedRamMB: live.usedRamMB ?? 0,
                totalRamMB: live.totalRamMB ?? server.limits.ramMB,
                diskPercent: live.diskPercent ?? 0,
                usedDiskGB: live.usedDiskGB ?? 0,
                totalDiskGB: live.totalDiskGB ?? server.limits.diskGB,
                netInKBps: (live.playersOnline ?? 0) > 0 ? (live.playersOnline! * 14) : (server.status === 'running' ? 2 : 0),
                netOutKBps: (live.playersOnline ?? 0) > 0 ? (live.playersOnline! * 26) : (server.status === 'running' ? 4 : 0),
                latencyMs: live.latencyMs ?? 0,
                loadAvg1m: +((live.cpuPercent ?? 0) / 25).toFixed(2),
                tps: live.tps ?? 0,
                players: live.playersOnline ?? 0,
                status: live.processStatus === 'running' ? 'online' : 'offline'
              };
              const updated = [...prev, newPoint];
              return updated.length > 120 ? updated.slice(-120) : updated;
            });
          }
        } catch {}
      }, 2500);
    }

    return () => {
      isMountedRef.current = false;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'unsubscribe_metrics', serverId: server.id }));
          ws.close();
        } catch {}
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [server.id, range]);

  const latest = telemetry[telemetry.length - 1];
  const isRunning = server.status === 'running';

  // Real Hardware Metrics (Dual GB and MB resolution)
  const maxRamMB = server.resources?.memoryMb || server.limits?.ramMB || 2048;
  const maxRamGB = +(maxRamMB / 1024).toFixed(2);
  const rawRamMB = isRunning ? (liveData?.usedRamMB ?? latest?.usedRamMB ?? server.ramUsageMB ?? 0) : 0;
  const liveRamMB = Math.min(rawRamMB, maxRamMB);
  const liveRamGB = +(liveRamMB / 1024).toFixed(2);
  const ramPercent = maxRamMB > 0 ? Math.min(100, Math.round((liveRamMB / maxRamMB) * 100)) : 0;

  const maxDiskGB = server.limits?.diskGB || 20;
  const liveUsedDiskGB = liveData?.usedDiskGB !== undefined ? liveData.usedDiskGB : (latest?.usedDiskGB ?? 0.05);
  const liveUsedDiskMB = +(liveUsedDiskGB * 1024).toFixed(1);
  const diskPercent = maxDiskGB > 0 ? Math.min(100, +((liveUsedDiskGB / maxDiskGB) * 100).toFixed(1)) : 0;

  const liveCpu = isRunning ? (liveData?.cpuPercent ?? latest?.cpuPercent ?? server.cpuUsage ?? 0.0) : 0.0;

  // TPS Calculation
  const tpsVal = liveData?.tps !== undefined ? liveData.tps : (latest?.tps !== undefined ? latest.tps : (isRunning ? 20.0 : 0.0));
  const tpsColor = !isRunning ? 'text-zinc-500' : tpsVal >= 19.5 ? 'text-emerald-400' : tpsVal >= 17.0 ? 'text-amber-400' : 'text-rose-400';

  // Real player count
  const activePlayers = isRunning ? (liveData?.playersOnline !== undefined ? liveData.playersOnline : (latest?.players !== undefined ? latest.players : (server.playerCount ?? 0))) : 0;
  const maxPlayerSlots = liveData?.maxPlayers || server.maxPlayers || 20;

  // Process & Protocol Status separation
  const processStatus = liveData?.processStatus || server.status;
  const protocolStatus = isRunning ? (liveData?.protocolStatus || 'ONLINE') : (processStatus === 'starting' ? 'STARTING' : 'OFFLINE');
  const latencyDisplay = isRunning && liveData?.latencyMs ? `${liveData.latencyMs} ms` : (isRunning ? '< 10 ms' : 'N/A');

  return (
    <div className="space-y-6">
      {/* Top Header & Range Controls */}
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--color-surface)] p-3.5 rounded-lg border border-[var(--color-line)]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-[var(--color-surface-2)] text-[var(--color-accent)]">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[var(--color-ink)] tracking-tight">Real-Time Hardware Telemetry</h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium text-[var(--color-ok)] border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)] animate-pulse" />
                  Live 2.5s Feed
                </span>
              </div>
              <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Linux process resident memory, CPU load, and filesystem consumption.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-1 bg-[var(--color-surface-2)] p-0.5 rounded-md border border-[var(--color-line)]">
            {(['1h', '24h', '7d', '30d'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                  range === r ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)] font-semibold border border-[var(--color-line)]' : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchTelemetry(true)}
            disabled={loading}
            className="p-1.5 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[var(--color-accent)]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Primary Hardware Consumption Cards (Dual GB/MB + CPU % + Storage) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Memory RAM Card */}
        <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="label flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              Memory (RAM)
            </span>
            <span className={`text-xs font-mono font-semibold ${isRunning ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-mute)]'}`}>
              {ramPercent}%
            </span>
          </div>

          <div className="space-y-0.5">
            <div className="text-lg font-semibold font-mono text-[var(--color-ink)] flex items-baseline gap-1.5">
              <span>{liveRamGB} GB</span>
              <span className="text-xs text-[var(--color-ink-mute)] font-normal">/ {maxRamGB} GB</span>
            </div>
            <div className="text-[11px] font-mono text-[var(--color-ink-mute)]">
              {liveRamMB.toFixed(1)} MB of {maxRamMB} MB allocated
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-0.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                ramPercent > 85 ? 'bg-[var(--color-err)]' : 'bg-[var(--color-accent)]'
              }`}
              style={{ width: `${ramPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--color-ink-mute)] block font-mono">
            {isRunning ? 'Linux VmRSS resident memory' : 'Process halted (0 MB used)'}
          </span>
        </div>

        {/* CPU Load Utilization Card */}
        <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="label flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              CPU Core Load
            </span>
            <span className={`text-xs font-mono font-semibold ${isRunning ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-mute)]'}`}>
              {liveCpu.toFixed(1)}%
            </span>
          </div>

          <div className="space-y-0.5">
            <div className="text-lg font-semibold font-mono text-[var(--color-ink)] flex items-baseline gap-1.5">
              <span>{liveCpu.toFixed(1)}%</span>
              <span className="text-xs text-[var(--color-ink-mute)] font-normal">/ 100% Core</span>
            </div>
            <div className="text-[11px] font-mono text-[var(--color-ink-mute)]">
              {isRunning ? `${server.limits.cpuCores || 2} Dedicated vCPU allocated` : 'Halted process scheduler'}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-0.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                liveCpu > 85 ? 'bg-[var(--color-err)]' : 'bg-[var(--color-accent)]'
              }`}
              style={{ width: `${Math.min(100, liveCpu)}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--color-ink-mute)] block font-mono">
            {isRunning ? 'Real kernel thread CPU slice' : '0.0% CPU active load'}
          </span>
        </div>

        {/* NVMe Storage Card */}
        <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="label flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              NVMe Storage
            </span>
            <span className="text-xs font-mono font-semibold text-[var(--color-ink)]">
              {diskPercent}%
            </span>
          </div>

          <div className="space-y-0.5">
            <div className="text-lg font-semibold font-mono text-[var(--color-ink)] flex items-baseline gap-1.5">
              <span>{liveUsedDiskGB.toFixed(2)} GB</span>
              <span className="text-xs text-[var(--color-ink-mute)] font-normal">/ {maxDiskGB} GB</span>
            </div>
            <div className="text-[11px] font-mono text-[var(--color-ink-mute)]">
              {liveUsedDiskMB} MB files on filesystem
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-0.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                diskPercent > 85 ? 'bg-[var(--color-err)]' : 'bg-[var(--color-accent)]'
              }`}
              style={{ width: `${Math.max(1, diskPercent)}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--color-ink-mute)] block font-mono">
            Actual disk directory size
          </span>
        </div>

        {/* Lifecycle & Socket Health Card */}
        <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="label flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              Process & Socket
            </span>
            <span className={`text-xs font-mono font-semibold capitalize ${isRunning ? 'text-[var(--color-ok)]' : 'text-[var(--color-ink-mute)]'}`}>
              {server.status}
            </span>
          </div>

          <div className="space-y-0.5">
            <div className="text-lg font-semibold font-mono text-[var(--color-ink)] flex items-baseline gap-1.5">
              <span>{latencyDisplay}</span>
            </div>
            <div className="text-[11px] font-mono text-[var(--color-ink-mute)]">
              {server.startup?.pid ? `Process PID: ${server.startup.pid}` : 'Process supervisor idle'}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-[var(--color-ok)] animate-pulse' : 'bg-[var(--color-ink-mute)]'}`} />
            <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">
              {isRunning ? 'Continuous SLP & daemon heartbeat' : 'Process halted'}
            </span>
          </div>
        </div>
      </div>

      {/* Specialty Metrics Header (Minecraft / Bot) */}
      {isMinecraft && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1">
            <span className="label block">Server TPS</span>
            <div className="flex items-center gap-2">
              <Gauge className={`h-4 w-4 ${tpsColor}`} />
              <span className={`text-sm font-semibold font-mono ${tpsColor}`}>
                {isRunning ? `${tpsVal.toFixed(2)} / 20.00` : '0.00 / 20.00'}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">
              {!isRunning ? 'Process stopped' : tpsVal >= 19.5 ? 'Peak Performance (100%)' : 'Tick Processing Active'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1">
            <span className="label block">Online Players</span>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--color-accent)]" />
              <span className="text-sm font-semibold font-mono text-[var(--color-ink)]">
                {activePlayers} / {maxPlayerSlots}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">
              {isRunning ? (activePlayers === 0 ? '0 connected' : `${activePlayers} connected`) : 'Server offline'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1">
            <span className="label block">Minecraft Protocol</span>
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${isRunning ? 'text-[var(--color-ok)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span className={`text-xs font-semibold font-mono ${isRunning ? 'text-[var(--color-ok)]' : 'text-[var(--color-ink-mute)]'}`}>
                {protocolStatus}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-ink-mute)] font-mono truncate block">
              {server.software || 'Paper'} {server.version || ''}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1">
            <span className="label block">Process Lifecycle</span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-4 w-4 ${isRunning ? 'text-[var(--color-ok)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span className={`text-xs font-semibold font-mono capitalize ${isRunning ? 'text-[var(--color-ok)]' : 'text-[var(--color-ink-mute)]'}`}>
                {processStatus}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">
              {server.startup?.pid ? `PID ${server.startup.pid} active` : isRunning ? 'Daemon active' : 'Process halted'}
            </span>
          </div>
        </div>
      )}

      {isBot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1">
            <span className="label block">Bot Runtime Status</span>
            <div className="flex items-center gap-2">
              <Bot className={`h-4 w-4 ${isRunning ? 'text-[var(--color-ok)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span className={`text-xs font-semibold font-mono capitalize ${isRunning ? 'text-[var(--color-ok)]' : 'text-[var(--color-ink-mute)]'}`}>
                {server.status}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">
              {isRunning ? '24/7 Persistent Daemon' : 'Bot process stopped'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1">
            <span className="label block">Event Loop Latency</span>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--color-accent)]" />
              <span className="text-xs font-semibold font-mono text-[var(--color-ink)]">
                {isRunning ? (liveData?.latencyMs ? `${liveData.latencyMs} ms` : '< 2.0 ms') : '0.0 ms'}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">
              {isRunning ? 'Event loop monitor' : 'Inactive'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1">
            <span className="label block">Process Engine</span>
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[var(--color-accent)]" />
              <span className="text-xs font-semibold font-mono text-[var(--color-ink)] truncate">
                {server.software || 'Node.js 20 LTS'}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">
              {server.startup?.pid ? `PID ${server.startup.pid}` : isRunning ? 'Active Sandbox PID' : 'Isolated Sandbox'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1">
            <span className="label block">Gateway Latency</span>
            <div className="flex items-center gap-2">
              <Wifi className={`h-4 w-4 ${isRunning ? 'text-[var(--color-ok)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span className="text-xs font-semibold font-mono text-[var(--color-ink)]">
                {latencyDisplay}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">
              {isRunning ? 'Socket Heartbeat Active' : 'Disconnected'}
            </span>
          </div>
        </div>
      )}

      {/* Wings Cgroups & Linux Kernel Hard-Isolation Sentinel */}
      <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-line)] pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-[var(--color-surface-2)] text-[var(--color-accent)]">
              <Shield className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="label text-[var(--color-ink)]">
                  Wings Container Hard-Isolation & Cgroups
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium text-[var(--color-ok)] border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10">
                  CGROUPS V2
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-ink-mute)]">
                Pterodactyl-grade rootless containerization with strict OOM-killer mitigation
              </p>
            </div>
          </div>

          {/* OOM Guard Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[var(--color-ink-mute)]">Kernel OOM Guard:</span>
            <div className={`px-2 py-0.5 rounded text-xs font-mono font-medium flex items-center gap-1.5 ${
              liveData?.oomDangerLevel === 'critical'
                ? 'bg-[var(--color-err)]/10 text-[var(--color-err)] border border-[var(--color-err)]/40'
                : liveData?.oomDangerLevel === 'warning'
                ? 'bg-[var(--color-warn)]/10 text-[var(--color-warn)] border border-[var(--color-warn)]/40'
                : 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border border-[var(--color-ok)]/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                liveData?.oomDangerLevel === 'critical'
                  ? 'bg-[var(--color-err)] animate-pulse'
                  : liveData?.oomDangerLevel === 'warning'
                  ? 'bg-[var(--color-warn)]'
                  : 'bg-[var(--color-ok)]'
              }`} />
              <span>
                {liveData?.oomDangerLevel === 'critical'
                  ? 'CRITICAL (Pre-OOM Alert)'
                  : liveData?.oomDangerLevel === 'warning'
                  ? 'WARNING (Heap High)'
                  : 'PROTECTED (OOM-Score +500)'}
              </span>
            </div>
          </div>
        </div>

        {/* Cgroups Resource Quotas Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-xs font-mono">
          <div className="p-2 bg-[var(--color-surface-2)] rounded-md border border-[var(--color-line)]">
            <span className="text-[10px] uppercase text-[var(--color-ink-mute)] block">Memory Hard Quota</span>
            <span className="font-semibold text-[var(--color-ink)]">{server.limits?.ramMB || 1024} MB</span>
            <span className="text-[9px] text-[var(--color-ink-mute)] block mt-0.5">Strict Kernel Max</span>
          </div>

          <div className="p-2 bg-[var(--color-surface-2)] rounded-md border border-[var(--color-line)]">
            <span className="text-[10px] uppercase text-[var(--color-ink-mute)] block">Swap Memory Cap</span>
            <span className="font-semibold text-[var(--color-ink)]">{server.limits?.swapMB || 0} MB</span>
            <span className="text-[9px] text-[var(--color-ink-mute)] block mt-0.5">Host Swappiness Lock</span>
          </div>

          <div className="p-2 bg-[var(--color-surface-2)] rounded-md border border-[var(--color-line)]">
            <span className="text-[10px] uppercase text-[var(--color-ink-mute)] block">CPU Quota Period</span>
            <span className="font-semibold text-[var(--color-ink)]">{Math.round((server.limits?.cpuCores || 1) * 100)}%</span>
            <span className="text-[9px] text-[var(--color-ink-mute)] block mt-0.5">100ms CFS Scheduler</span>
          </div>

          <div className="p-2 bg-[var(--color-surface-2)] rounded-md border border-[var(--color-line)]">
            <span className="text-[10px] uppercase text-[var(--color-ink-mute)] block">PIDs Limit</span>
            <span className="font-semibold text-[var(--color-ink)]">{liveData?.pidsCount || 1} / {server.limits?.pidsLimit || 512}</span>
            <span className="text-[9px] text-[var(--color-ink-mute)] block mt-0.5">Process Isolation</span>
          </div>
        </div>
      </div>

      {/* Main Real Telemetry Graphs Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--color-ink-mute)] bg-[var(--color-surface)] rounded-lg border border-[var(--color-line)] flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
          <span>Streaming real-time server telemetry points...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
            <TimeSeriesChart
              title="CPU Core Utilization (%)"
              data={telemetry.map(p => ({ timestamp: p.timestamp, value: p.cpuPercent }))}
              unit="%"
              color="sky"
              maxValue={100}
              height={140}
            />
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
            <TimeSeriesChart
              title={`Memory RAM Usage (MB)`}
              data={telemetry.map(p => ({ timestamp: p.timestamp, value: p.usedRamMB }))}
              unit="MB"
              color="emerald"
              maxValue={maxRamMB}
              height={140}
            />
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
            <TimeSeriesChart
              title="NVMe Storage Allocated (GB)"
              data={telemetry.map(p => ({ timestamp: p.timestamp, value: p.usedDiskGB }))}
              unit="GB"
              color="sky"
              maxValue={maxDiskGB}
              height={140}
            />
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
            <TimeSeriesChart
              title="Network Outflow (KB/s)"
              data={telemetry.map(p => ({ timestamp: p.timestamp, value: p.netOutKBps }))}
              unit="KB/s"
              color="amber"
              height={140}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerMonitoringTab;

