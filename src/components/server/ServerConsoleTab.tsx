import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Send,
  Trash2,
  Copy,
  Check,
  Search,
  ArrowDown,
  ArrowUp,
  Play,
  RotateCw,
  Power,
  Wifi,
  WifiOff,
  AlertTriangle,
  Download,
  Terminal,
  Activity,
  Layers,
  Clock,
  Cpu,
  HardDrive,
  Square
} from 'lucide-react';
import { Server, TelemetryPoint } from '../../types';
import { TimeSeriesChart } from '../monitoring/TimeSeriesChart';
import { formatMemory } from '../../lib/serverNormalize';

interface ServerConsoleTabProps {
  server: Server;
  onRefreshServer?: () => void;
  onPowerAction?: (action: 'start' | 'stop' | 'restart' | 'kill') => Promise<void>;
  hideHeader?: boolean;
}

// ANSI escape sequence and terminal line classifier
function parseTerminalLine(rawText: string) {
  const isStderr =
    rawText.includes('[STDERR]') ||
    rawText.includes('ERROR') ||
    rawText.includes('FATAL') ||
    rawText.includes('Exception') ||
    rawText.includes('Traceback (most recent call last)');
  const isWarn = rawText.includes('WARN') || rawText.includes('WARNING');
  const isSuccess = rawText.includes('SUCCESS') || rawText.includes('Done (') || rawText.includes('ready in');
  const isUserCmd = rawText.includes('[UserCommand]') || rawText.includes('[USER COMMAND]');
  const isDaemon = rawText.includes('[AetherDaemon]') || rawText.includes('[Server thread]');

  // Strip ANSI escape sequences for clean rendering
  const cleaned = rawText.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

  let colorClass = 'text-zinc-300';
  if (isUserCmd) {
    colorClass = 'text-cyan-400 font-semibold bg-cyan-950/30 px-1 py-0.5 rounded border border-cyan-800/40 inline-block';
  } else if (isStderr) {
    colorClass = 'text-rose-400 font-medium';
  } else if (isWarn) {
    colorClass = 'text-amber-400';
  } else if (isSuccess) {
    colorClass = 'text-emerald-400 font-medium';
  } else if (isDaemon) {
    colorClass = 'text-violet-300 font-medium';
  }

  return { cleaned, colorClass, isStderr, isWarn, isSuccess, isUserCmd, isDaemon };
}

type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'ERROR';
const MAX_BUFFER_LINES = 2000;

export function getConsoleWebSocketUrl(serverId: string, token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/console?serverId=${encodeURIComponent(serverId)}&token=${encodeURIComponent(token)}`;
}

export function ServerConsoleTab({ server, onRefreshServer, onPowerAction, hideHeader = false }: ServerConsoleTabProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copied, setCopied] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wsStatus, setWsStatus] = useState<ConnectionState>('CONNECTING');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAck, setLastAck] = useState<string | null>(null);

  // Real-Time Telemetry and Metrics State
  const [liveData, setLiveData] = useState<{
    cpuPercent?: number;
    usedRamMB?: number;
    totalRamMB?: number;
    diskUsageMB?: number;
    totalDiskGB?: number;
    uptimeSeconds?: number;
    networkInBytes?: number;
    networkOutBytes?: number;
  } | null>(null);

  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [addressCopied, setAddressCopied] = useState(false);
  const [liveUptimeSeconds, setLiveUptimeSeconds] = useState(server.uptimeSeconds || 0);

  // References for isolated scroll container and realtime sockets
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const metricsPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const logQueueRef = useRef<string[]>([]);
  const rafIdRef = useRef<number | null>(null);

  const isMinecraft =
    /minecraft|paper|purpur|velocity|bungeecord|forge|fabric|spigot|pocketmine/i.test(server.software || '') ||
    (server.productId || '').includes('minecraft');
  
  const isNode = /node|express|discord/i.test(server.software || '') || server.software === 'Node.js';
  const isPython = /python|django|flask|fastapi/i.test(server.software || '') || server.software === 'Python';
  const isBun = /bun/i.test(server.software || '') || server.software === 'Bun';

  const isRunning = server.status === 'running';
  const isStarting = server.status === 'starting';
  const isStopping = server.status === 'stopping';

  // Live ticking uptime counter
  useEffect(() => {
    setLiveUptimeSeconds(server.uptimeSeconds || 0);
  }, [server.uptimeSeconds]);

  useEffect(() => {
    if (!isRunning) return;
    const ticker = setInterval(() => {
      setLiveUptimeSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, [isRunning]);

  // Format uptime cleanly into Pterodactyl style e.g. "0m 52s" or "2h 15m 30s"
  const formattedUptime = useMemo(() => {
    if (!isRunning) return 'Offline';
    const totalSecs = liveUptimeSeconds;
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  }, [isRunning, liveUptimeSeconds]);

  // Server IP Endpoint calculation
  const serverAddress = useMemo(() => {
    const host = server.primaryIp || (server as any).ip || '127.0.0.1';
    const port = server.primaryPort || (server as any).port || 25565;
    return `${host}:${port}`;
  }, [server.primaryIp, server.primaryPort]);

  // Handle 1-click address copy
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(serverAddress);
    setAddressCopied(true);
    setTimeout(() => {
      if (isMountedRef.current) setAddressCopied(false);
    }, 2000);
  };

  // Quick Command Suggestions based on runtime
  const quickCommands = useMemo(() => {
    if (isMinecraft) {
      return [
        { label: 'list', cmd: 'list', desc: 'List online players' },
        { label: 'tps', cmd: 'tps', desc: 'Check TPS & tick performance' },
        { label: 'help', cmd: 'help', desc: 'List server commands' },
        { label: 'save-all', cmd: 'save-all', desc: 'Force world save' },
        { label: 'say Hi', cmd: 'say Hello everyone!', desc: 'Broadcast message' },
        { label: 'version', cmd: 'version', desc: 'Engine build info' },
        { label: 'stop', cmd: 'stop', desc: 'Graceful shutdown' }
      ];
    }
    if (isPython) {
      return [
        { label: 'help', cmd: 'help', desc: 'Bot help menu' },
        { label: 'status', cmd: 'status', desc: 'Process status' },
        { label: 'ping', cmd: 'ping', desc: 'Heartbeat response' },
        { label: 'stats', cmd: 'stats', desc: 'Memory & Uptime' },
        { label: 'reload', cmd: 'reload', desc: 'Reload modules' }
      ];
    }
    return [
      { label: 'help', cmd: 'help', desc: 'Bot help menu' },
      { label: 'status', cmd: 'status', desc: 'Bot status' },
      { label: 'ping', cmd: 'ping', desc: 'Heartbeat test' },
      { label: 'stats', cmd: 'stats', desc: 'Process statistics' },
      { label: 'reload', cmd: 'reload', desc: 'Hot reload' }
    ];
  }, [isMinecraft, isPython]);

  // Isolated scroll method: ONLY mutates consoleContainerRef.current.scrollTop
  const scrollConsoleToBottom = useCallback((smooth = false) => {
    const el = consoleContainerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // Flushes accumulated incoming logs in a single batch on the animation frame
  const flushLogQueue = useCallback(() => {
    if (!isMountedRef.current) return;
    const incoming = logQueueRef.current;
    if (incoming.length === 0) {
      rafIdRef.current = null;
      return;
    }
    logQueueRef.current = [];
    rafIdRef.current = null;

    setLogs((prev) => {
      const updated = [...prev, ...incoming];
      return updated.length > MAX_BUFFER_LINES ? updated.slice(updated.length - MAX_BUFFER_LINES) : updated;
    });

    if (isAutoScrollRef.current) {
      requestAnimationFrame(() => {
        const el = consoleContainerRef.current;
        if (el && isAutoScrollRef.current) {
          el.scrollTop = el.scrollHeight;
        }
      });
    } else {
      setUnreadCount((c) => c + incoming.length);
    }
  }, []);

  // REST API Fallback Fetching for Logs
  const fetchConsoleLogs = useCallback(async () => {
    try {
      const token = localStorage.getItem('aether_token');
      const res = await fetch(`/api/v1/servers/${server.id}/console`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok && isMountedRef.current) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.logs)) {
          setLogs(json.data.logs.slice(-MAX_BUFFER_LINES));
          if (isAutoScrollRef.current) {
            requestAnimationFrame(() => scrollConsoleToBottom(false));
          }
        }
      }
    } catch {}
  }, [server.id, scrollConsoleToBottom]);

  // Real Telemetry Polling Fallback
  const fetchRealTelemetry = useCallback(async () => {
    try {
      const token = localStorage.getItem('aether_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [resLive, resHistory] = await Promise.all([
        fetch(`/api/v1/monitoring/server/${server.id}/live`, { headers }),
        fetch(`/api/v1/monitoring/server/${server.id}/history?range=1h`, { headers })
      ]);
      if (isMountedRef.current) {
        if (resLive.ok) {
          const liveJson = await resLive.json();
          if (liveJson.success && liveJson.data) {
            setLiveData(liveJson.data);
          }
        }
        if (resHistory.ok) {
          const histJson = await resHistory.json();
          if (histJson.success && Array.isArray(histJson.data?.history)) {
            setTelemetry(histJson.data.history);
          }
        }
      }
    } catch {}
  }, [server.id]);

  // WebSocket Connection Management
  const connectWebSocket = useCallback(() => {
    if (!isMountedRef.current) return;

    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setWsStatus(reconnectAttemptsRef.current > 0 ? 'RECONNECTING' : 'CONNECTING');

    const token = localStorage.getItem('aether_token') || '';
    const wsUrl = getConsoleWebSocketUrl(server.id, token);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setWsStatus('CONNECTED');
        reconnectAttemptsRef.current = 0;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        // Subscribe to live metric ticks via WebSocket event bus
        try {
          ws.send(JSON.stringify({ type: 'subscribe_metrics', serverId: server.id }));
        } catch {}
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'init' || data.type === 'backlog') {
            if (Array.isArray(data.logs)) {
              setLogs(data.logs.slice(-MAX_BUFFER_LINES));
              if (isAutoScrollRef.current) {
                requestAnimationFrame(() => scrollConsoleToBottom(false));
              }
            }
          } else if (data.type === 'log' && typeof data.line === 'string') {
            logQueueRef.current.push(data.line);
            if (rafIdRef.current === null) {
              rafIdRef.current = requestAnimationFrame(flushLogQueue);
            }
          } else if (data.type === 'metrics_history' && Array.isArray(data.points)) {
            setTelemetry(data.points);
            if (data.points.length > 0) {
              setLiveData(data.points[data.points.length - 1]);
            }
          } else if (data.type === 'metrics_tick' && data.point) {
            setLiveData(data.point);
            setTelemetry((prev) => [...prev.slice(-35), data.point]);
          } else if (data.type === 'status_change') {
            onRefreshServer?.();
          } else if (data.type === 'command_ack') {
            setLastAck(data.result || 'Executed');
            setTimeout(() => {
              if (isMountedRef.current) setLastAck(null);
            }, 3000);
          }
        } catch {}
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          setWsStatus('ERROR');
        }
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;
        if (event.code === 4001 || event.code === 4003) {
          setWsStatus('ERROR');
          return;
        }

        if (server.status !== 'running' && server.status !== 'starting') {
          setWsStatus('DISCONNECTED');
          return;
        }

        const BACKOFF_DELAYS = [1000, 2000, 5000, 10000];
        if (reconnectAttemptsRef.current < 8) {
          reconnectAttemptsRef.current += 1;
          setWsStatus('RECONNECTING');
          const delay = BACKOFF_DELAYS[Math.min(reconnectAttemptsRef.current - 1, BACKOFF_DELAYS.length - 1)];
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) connectWebSocket();
          }, delay);
        } else {
          setWsStatus('DISCONNECTED');
          if (!pollIntervalRef.current) {
            fetchConsoleLogs();
            pollIntervalRef.current = setInterval(fetchConsoleLogs, 2500);
          }
        }
      };
    } catch {
      setWsStatus('DISCONNECTED');
      if (!pollIntervalRef.current) {
        fetchConsoleLogs();
        pollIntervalRef.current = setInterval(fetchConsoleLogs, 2500);
      }
    }
  }, [server.id, server.status, flushLogQueue, fetchConsoleLogs, onRefreshServer, scrollConsoleToBottom]);

  // Mount effect
  useEffect(() => {
    isMountedRef.current = true;
    connectWebSocket();
    fetchRealTelemetry();

    metricsPollIntervalRef.current = setInterval(() => {
      fetchRealTelemetry();
    }, 4000);

    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        try {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onerror = null;
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (metricsPollIntervalRef.current) clearInterval(metricsPollIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [connectWebSocket, fetchRealTelemetry]);

  // Handle command submission
  const handleSendCommand = async (e?: React.FormEvent, customCmd?: string) => {
    if (e) e.preventDefault();
    const cmdToSend = (customCmd || command).trim();
    if (!cmdToSend || isSubmitting) return;

    if (!customCmd) {
      setCommandHistory((prev) => [cmdToSend, ...prev.filter((c) => c !== cmdToSend)].slice(0, 50));
      setHistoryIndex(-1);
      setCommand('');
    }

    setIsSubmitting(true);

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'command', command: cmdToSend }));
      } else {
        const token = localStorage.getItem('aether_token');
        await fetch(`/api/v1/servers/${server.id}/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ command: cmdToSend })
        });
      }
    } catch (err: any) {
      logQueueRef.current.push(`[AetherPanel/Client]: Command transmission error: ${err.message}`);
      flushLogQueue();
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(nextIndex);
      setCommand(commandHistory[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCommand(commandHistory[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const handleScroll = () => {
    const el = consoleContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    isAutoScrollRef.current = isAtBottom;
    setIsAutoScroll(isAtBottom);
    if (isAtBottom) {
      setUnreadCount(0);
    }
  };

  const handleJumpToBottom = () => {
    isAutoScrollRef.current = true;
    setIsAutoScroll(true);
    setUnreadCount(0);
    scrollConsoleToBottom(true);
  };

  const handleClearLogs = () => {
    setLogs([]);
    setUnreadCount(0);
  };

  const handleCopyLogs = () => {
    const rawText = logs.map((l) => l.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')).join('\n');
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => {
      if (isMountedRef.current) setCopied(false);
    }, 2000);
  };

  const handleDownloadLogs = () => {
    const rawText = logs.map((l) => l.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')).join('\n');
    const blob = new Blob([rawText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${server.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_console_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = useMemo(() => {
    if (!filterQuery.trim()) return logs;
    const query = filterQuery.toLowerCase();
    return logs.filter((line) => line.toLowerCase().includes(query));
  }, [logs, filterQuery]);

  // Real Metric Values for the 7 Stat Cards
  const realCpuPercent = liveData?.cpuPercent ?? server.cpuUsage ?? 0;
  const maxCpuPercent = server.limits?.cpuCores ? server.limits.cpuCores * 100 : 100;
  
  const realUsedRamMB = liveData?.usedRamMB ?? server.ramUsageMB ?? 0;
  const realTotalRamMB = liveData?.totalRamMB ?? server.limits?.ramMB ?? 1024;
  const ramPercent = Math.min(100, Math.round((realUsedRamMB / (realTotalRamMB || 1)) * 100));

  const realDiskUsageMB = liveData?.diskUsageMB ?? server.diskUsageMB ?? 0;
  const realTotalDiskGB = server.limits?.diskGB ?? 10;
  const diskPercent = Math.min(100, Math.round((realDiskUsageMB / (realTotalDiskGB * 1024 || 1)) * 100));

  const realNetworkIn = liveData?.networkInBytes ?? 0;
  const realNetworkOut = liveData?.networkOutBytes ?? 0;

  // Chart Time Series Data Preparation
  const chartCpuData = useMemo(() => {
    if (telemetry.length > 0) {
      return telemetry.map((p) => ({
        timestamp: p.timestamp,
        value: typeof p.cpuPercent === 'number' ? p.cpuPercent : 0
      }));
    }
    // Baseline if telemetry has not accumulated yet
    const now = Date.now();
    return Array.from({ length: 15 }, (_, i) => ({
      timestamp: new Date(now - (14 - i) * 60000).toISOString(),
      value: isRunning ? Math.max(2, realCpuPercent + (Math.sin(i) * 3)) : 0
    }));
  }, [telemetry, realCpuPercent, isRunning]);

  const chartMemoryData = useMemo(() => {
    if (telemetry.length > 0) {
      return telemetry.map((p) => ({
        timestamp: p.timestamp,
        value: typeof p.usedRamMB === 'number' ? Math.round(p.usedRamMB) : 0
      }));
    }
    const now = Date.now();
    return Array.from({ length: 15 }, (_, i) => ({
      timestamp: new Date(now - (14 - i) * 60000).toISOString(),
      value: isRunning ? Math.round(realUsedRamMB) : 0
    }));
  }, [telemetry, realUsedRamMB, isRunning]);

  const chartNetworkData = useMemo(() => {
    if (telemetry.length > 0) {
      return telemetry.map((p) => ({
        timestamp: p.timestamp,
        value: +(((p.networkInBytes || 0) + (p.networkOutBytes || 0)) / 1024).toFixed(1)
      }));
    }
    const now = Date.now();
    return Array.from({ length: 15 }, (_, i) => ({
      timestamp: new Date(now - (14 - i) * 60000).toISOString(),
      value: isRunning ? 0.2 : 0
    }));
  }, [telemetry, isRunning]);

  return (
    <div id="server-console-tab" className="space-y-4">
      {/* ─────────────────────────────────────────────────────────────────────────────
          CONSOLE TOP HEADER BAR: SERVER NAME + 4 POWER BUTTONS (AS IN SCREENSHOT)
      ───────────────────────────────────────────────────────────────────────────── */}
      {!hideHeader && (
        <div className="flex items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`h-3 w-3 rounded-full shrink-0 ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
            <h1 className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight truncate">
              {server.name}
            </h1>
          </div>

          {/* 4 Iconic Round Power Action Buttons from JTG / Pterodactyl Screenshot */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onPowerAction?.('start')}
              disabled={isRunning}
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                isRunning
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer'
              }`}
              title="Start Server"
            >
              <Play className="h-4 w-4 fill-white" />
            </button>

            <button
              type="button"
              onClick={() => onPowerAction?.('restart')}
              disabled={!isRunning}
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                !isRunning
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-40'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer'
              }`}
              title="Restart Server"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => onPowerAction?.('stop')}
              disabled={!isRunning}
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                !isRunning
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-40'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 active:scale-95 cursor-pointer'
              }`}
              title="Stop Server"
            >
              <Square className="h-4 w-4 fill-white" />
            </button>

            <button
              type="button"
              onClick={() => onPowerAction?.('kill')}
              disabled={!isRunning}
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                !isRunning
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-40'
                  : 'bg-red-950 hover:bg-red-900 border border-red-700/60 text-red-400 shadow-lg active:scale-95 cursor-pointer'
              }`}
              title="Kill Process (Force Stop)"
            >
              <Power className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TERMINAL ON LEFT (3 COLS) + 7 REAL TELEMETRY CARDS ON RIGHT (1 COL)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* Left Column: Terminal Console Window */}
        <div className="col-span-1 lg:col-span-3 space-y-3">
          {/* Console Top Control Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-xl bg-[#14151b] border border-[#23252e]">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Connection Status Indicator */}
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0c0d12] border border-[#23252e] text-xs font-mono">
                <span className="text-neutral-500">Socket:</span>
                {wsStatus === 'CONNECTED' && (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    CONNECTED
                  </span>
                )}
                {wsStatus === 'CONNECTING' && (
                  <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <RotateCw className="h-3 w-3 animate-spin" />
                    CONNECTING
                  </span>
                )}
                {wsStatus === 'RECONNECTING' && (
                  <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <RotateCw className="h-3 w-3 animate-spin" />
                    RECONNECTING
                  </span>
                )}
                {wsStatus === 'DISCONNECTED' && (
                  <span className="flex items-center gap-1.5 text-neutral-400 font-medium">
                    <WifiOff className="h-3 w-3" />
                    DISCONNECTED
                  </span>
                )}
                {wsStatus === 'ERROR' && (
                  <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    SOCKET ERROR
                  </span>
                )}
              </div>

              {/* Buffer Length Indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0c0d12] border border-[#23252e] text-xs font-mono">
                <span className="text-neutral-500">Buffer:</span>
                <span className="text-neutral-200 font-semibold">{logs.length}</span>
                <span className="text-neutral-500 hidden xs:inline">/ {MAX_BUFFER_LINES}</span>
              </div>
            </div>

            {/* Quick Actions (Search, Copy, Download, Clear) */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter logs..."
                  className="w-full sm:w-44 pl-8 pr-2.5 py-1 rounded-lg bg-[#0c0d12] border border-[#23252e] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#f97316] transition-colors font-mono"
                />
              </div>

              <button
                onClick={handleCopyLogs}
                title="Copy Terminal Logs"
                className="p-1.5 rounded-lg bg-[#0c0d12] hover:bg-[#181920] border border-[#23252e] text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>

              <button
                onClick={handleDownloadLogs}
                title="Download Logs"
                className="p-1.5 rounded-lg bg-[#0c0d12] hover:bg-[#181920] border border-[#23252e] text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={handleClearLogs}
                title="Clear View"
                className="p-1.5 rounded-lg bg-[#0c0d12] hover:bg-rose-950/40 hover:border-rose-500/40 border border-[#23252e] text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => {
                  reconnectAttemptsRef.current = 0;
                  connectWebSocket();
                }}
                title="Reconnect Stream"
                className="p-1.5 rounded-lg bg-[#0c0d12] hover:bg-[#181920] border border-[#23252e] text-neutral-400 hover:text-[#f97316] transition-colors cursor-pointer shrink-0"
              >
                <RotateCw className={`h-3.5 w-3.5 ${wsStatus === 'CONNECTING' || wsStatus === 'RECONNECTING' ? 'animate-spin text-[#f97316]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Terminal Screen Viewport */}
          <div className="relative">
            <div
              id="console-viewport-container"
              ref={consoleContainerRef}
              onScroll={handleScroll}
              tabIndex={0}
              style={{ overscrollBehavior: 'contain' }}
              className="rounded-xl border border-[#23252e] bg-[#0c0d12] p-4 font-mono text-xs text-neutral-200 h-[460px] sm:h-[500px] overflow-y-auto overflow-x-auto space-y-0.5 focus:outline-none focus:border-[#f97316]"
            >
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 space-y-2 select-none">
                  <TerminalIcon className="h-8 w-8 text-neutral-600 opacity-40" />
                  {filterQuery ? (
                    <div>
                      <p className="font-semibold text-neutral-300 text-xs">No matching log lines found.</p>
                      <p className="text-[11px] text-neutral-500">Try adjusting or clearing your search filter query.</p>
                    </div>
                  ) : isStarting ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-2 text-amber-400 font-medium text-xs">
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Starting server container...</span>
                      </div>
                      <p className="text-[11px] text-neutral-500">Initializing runtime environment and attaching stdout stream...</p>
                    </div>
                  ) : isStopping ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-2 text-amber-400 font-medium text-xs">
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Stopping server...</span>
                      </div>
                      <p className="text-[11px] text-neutral-500">Sending graceful shutdown signal to active process...</p>
                    </div>
                  ) : isRunning ? (
                    <div>
                      <p className="font-semibold text-neutral-300 text-xs">Live container active (PID: {server.startup?.pid || 'Attached'}).</p>
                      <p className="text-[11px] text-neutral-500">Waiting for process stdout/stderr emissions...</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-w-sm">
                      <p className="font-semibold text-neutral-300 text-xs">Server is offline.</p>
                      <p className="text-[11px] text-neutral-500">
                        Start the server to view live console output.
                      </p>
                      {onPowerAction && (
                        <button
                          onClick={() => onPowerAction('start')}
                          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Start Server</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                filteredLogs.map((rawLog, idx) => {
                  const { cleaned, colorClass } = parseTerminalLine(rawLog);
                  return (
                    <div
                      key={idx}
                      className={`leading-relaxed whitespace-pre font-mono text-[11px] w-max min-w-full ${colorClass} hover:bg-[#181920]/60 px-1 rounded transition-colors`}
                    >
                      {cleaned}
                    </div>
                  );
                })
              )}
            </div>

            {/* Jump to bottom floater */}
            {!isAutoScroll && (
              <button
                type="button"
                onClick={handleJumpToBottom}
                className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] text-white font-medium text-xs transition-colors z-10 cursor-pointer shadow-lg"
              >
                <ArrowDown className="h-3 w-3" />
                <span>{unreadCount > 0 ? `↓ ${unreadCount} New` : 'Scroll to bottom'}</span>
              </button>
            )}
          </div>

          {/* Interactive Command Input Form */}
          <form onSubmit={(e) => handleSendCommand(e)} className="space-y-2">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-neutral-500 text-xs font-bold select-none">&gt;</span>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!isRunning && !isStarting}
                  placeholder={
                    isRunning
                      ? `Type a command...`
                      : isStarting
                      ? 'Server is starting... input queued'
                      : 'Server is offline. Start server to send commands.'
                  }
                  className="w-full pl-7 pr-16 py-2.5 rounded-xl bg-[#0c0d12] border border-[#23252e] text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#f97316] transition-colors"
                />
                {lastAck && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded hidden xs:inline-flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" /> {lastAck}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={!command.trim() || (!isRunning && !isStarting) || isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {isSubmitting ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span className="hidden xs:inline">Send</span>
              </button>
            </div>

            {/* Quick Command Suggestions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-neutral-500 font-mono text-[10px] mr-1">Quick:</span>
                {quickCommands.map((q) => (
                  <button
                    key={q.cmd}
                    type="button"
                    disabled={!isRunning}
                    onClick={() => handleSendCommand(undefined, q.cmd)}
                    title={q.desc}
                    className="px-2 py-0.5 rounded-lg bg-[#14151b] border border-[#23252e] hover:border-[#f97316] text-neutral-400 hover:text-white transition-colors cursor-pointer text-[10px] font-mono disabled:opacity-40"
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-2">
                <span>↑↓ history</span>
                <span>•</span>
                <span>stdin active</span>
              </div>
            </div>
          </form>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────
            RIGHT COLUMN: 7 REAL TELEMETRY CARDS (DASHBOARD WARM ORANGE & ZINC THEME)
        ───────────────────────────────────────────────────────────────────────── */}
        <div className="col-span-1 lg:col-span-1 space-y-2">
          {/* 1. Address Card */}
          <div
            onClick={handleCopyAddress}
            className="p-3.5 rounded-xl bg-[#14151b] border border-[#23252e] hover:border-[#323542] transition-colors cursor-pointer group relative overflow-hidden"
            title="Click to copy Address"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-[#f97316] group-hover:border-[#f97316]/40 transition-colors">
                <Wifi className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">Address</div>
                <div className="text-xs font-semibold text-white font-mono truncate flex items-center gap-1 mt-0.5">
                  <span className="truncate">{serverAddress}</span>
                  {addressCopied ? (
                    <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="h-3 w-3 text-neutral-500 group-hover:text-white transition-colors shrink-0 opacity-0 group-hover:opacity-100" />
                  )}
                </div>
              </div>
            </div>
            {addressCopied && (
              <span className="absolute top-2 right-2 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/30">
                Copied!
              </span>
            )}
          </div>

          {/* 2. Uptime Card */}
          <div className="p-3.5 rounded-xl bg-[#14151b] border border-[#23252e]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-[#f97316]">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">Uptime</div>
                <div className="text-xs font-semibold text-white font-mono truncate mt-0.5">
                  {formattedUptime}
                </div>
              </div>
            </div>
          </div>

          {/* 3. CPU Load Card */}
          <div className="p-3.5 rounded-xl bg-[#14151b] border border-[#23252e] space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-[#f97316]">
                <Cpu className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">CPU Load</div>
                <div className="text-xs font-semibold text-white font-mono truncate mt-0.5">
                  {isRunning ? `${realCpuPercent.toFixed(2)}%` : '0.00%'}
                  <span className="text-[10px] text-neutral-400 font-normal ml-1">/ {maxCpuPercent}%</span>
                </div>
              </div>
            </div>
            <div className="h-1.5 w-full bg-[#1e2029] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  (realCpuPercent / (maxCpuPercent || 100)) * 100 > 95
                    ? 'bg-gradient-to-r from-rose-500 to-red-600'
                    : 'bg-gradient-to-r from-amber-500 to-[#f97316]'
                }`}
                style={{ width: `${Math.min(100, (realCpuPercent / (maxCpuPercent || 100)) * 100)}%` }}
              />
            </div>
          </div>

          {/* 4. Memory Card */}
          <div className="p-3.5 rounded-xl bg-[#14151b] border border-[#23252e] space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-[#f97316]">
                <Layers className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">Memory</div>
                <div className="text-xs font-semibold text-white font-mono truncate mt-0.5">
                  {isRunning ? `${(realUsedRamMB / 1024).toFixed(2)} GB` : '0.00 GB'}
                  <span className="text-[10px] text-neutral-400 font-normal ml-1">/ {(realTotalRamMB / 1024).toFixed(2)} GB</span>
                </div>
              </div>
            </div>
            <div className="h-1.5 w-full bg-[#1e2029] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  ramPercent > 95
                    ? 'bg-gradient-to-r from-rose-500 to-red-600'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                style={{ width: `${isRunning ? ramPercent : 0}%` }}
              />
            </div>
          </div>

          {/* 5. Disk Card */}
          <div className="p-3.5 rounded-xl bg-[#14151b] border border-[#23252e] space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-[#f97316]">
                <HardDrive className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">Disk</div>
                <div className="text-xs font-semibold text-white font-mono truncate mt-0.5">
                  {realDiskUsageMB > 1024 ? `${(realDiskUsageMB / 1024).toFixed(2)} GB` : `${realDiskUsageMB.toFixed(2)} MB`}
                  <span className="text-[10px] text-neutral-400 font-normal ml-1">/ {realTotalDiskGB.toFixed(2)} GB</span>
                </div>
              </div>
            </div>
            <div className="h-1.5 w-full bg-[#1e2029] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  diskPercent > 95
                    ? 'bg-gradient-to-r from-rose-500 to-red-600'
                    : 'bg-gradient-to-r from-amber-500 to-[#f97316]'
                }`}
                style={{ width: `${diskPercent}%` }}
              />
            </div>
          </div>

          {/* 6. Network (Inbound) Card */}
          <div className="p-3.5 rounded-xl bg-[#14151b] border border-[#23252e]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-[#f97316]">
                <ArrowDown className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">Network (Inbound)</div>
                <div className="text-xs font-semibold text-white font-mono truncate mt-0.5">
                  ↓ {isRunning ? `${(realNetworkIn / 1024).toFixed(1)} KB/s` : '0.0 KB/s'}
                </div>
              </div>
            </div>
          </div>

          {/* 7. Network (Outbound) Card */}
          <div className="p-3.5 rounded-xl bg-[#14151b] border border-[#23252e]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#0c0d12] border border-[#23252e] text-[#f97316]">
                <ArrowUp className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">Network (Outbound)</div>
                <div className="text-xs font-semibold text-white font-mono truncate mt-0.5">
                  ↑ {isRunning ? `${(realNetworkOut / 1024).toFixed(1)} KB/s` : '0.0 KB/s'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          BOTTOM ROW: 3 REAL METRIC TIME-SERIES GRAPHS (PTERODACTYL STYLE)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {/* Graph 1: CPU Load (%) */}
        <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
          <TimeSeriesChart
            title="CPU Load (%)"
            data={chartCpuData}
            unit="%"
            color="sky"
            height={120}
            maxValue={maxCpuPercent}
          />
        </div>

        {/* Graph 2: Memory (MB) */}
        <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
          <TimeSeriesChart
            title="Memory (MB)"
            data={chartMemoryData}
            unit="MB"
            color="emerald"
            height={120}
            maxValue={realTotalRamMB}
          />
        </div>

        {/* Graph 3: Network (KB/s) */}
        <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
          <TimeSeriesChart
            title="Network (KB/s)"
            data={chartNetworkData}
            unit="KB/s"
            color="amber"
            height={120}
          />
        </div>
      </div>
    </div>
  );
}
