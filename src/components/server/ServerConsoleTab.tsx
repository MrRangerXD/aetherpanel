import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Send,
  Trash2,
  Copy,
  Check,
  Search,
  ArrowDown,
  Play,
  RotateCw,
  Power,
  Wifi,
  WifiOff,
  AlertTriangle,
  Download,
  Terminal,
  Activity,
  Layers
} from 'lucide-react';
import { Server } from '../../types';

interface ServerConsoleTabProps {
  server: Server;
  onRefreshServer?: () => void;
  onPowerAction?: (action: 'start' | 'stop' | 'restart' | 'kill') => Promise<void>;
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

export function ServerConsoleTab({ server, onRefreshServer, onPowerAction }: ServerConsoleTabProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copied, setCopied] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'polling' | 'disconnected'>('connecting');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAck, setLastAck] = useState<string | null>(null);

  // References for isolated scroll container and realtime sockets
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const isMinecraft =
    /minecraft|paper|purpur|velocity|bungeecord|forge|fabric|spigot|bedrock|pocketmine/i.test(server.software || '') ||
    (server.productId || '').includes('minecraft');
  
  const isNode = /node|express|discord/i.test(server.software || '') || server.software === 'Node.js';
  const isPython = /python|django|flask|fastapi/i.test(server.software || '') || server.software === 'Python';
  const isBun = /bun/i.test(server.software || '') || server.software === 'Bun';

  const isRunning = server.status === 'running';
  const isStarting = server.status === 'starting';
  const isStopping = server.status === 'stopping';

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

  // REST API Fallback Fetching
  const fetchConsoleLogs = useCallback(async () => {
    try {
      const token = localStorage.getItem('aether_token');
      const res = await fetch(`/api/v1/servers/${server.id}/console`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.logs)) {
          setLogs(json.data.logs);
          if (isAutoScrollRef.current) {
            requestAnimationFrame(() => scrollConsoleToBottom(false));
          }
        }
      }
    } catch {}
  }, [server.id, scrollConsoleToBottom]);

  // WebSocket Connection Management
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setWsStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('aether_token') || '';
    const wsUrl = `${protocol}//${window.location.host}/ws/console/${server.id}?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        reconnectAttemptsRef.current = 0;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'init' || data.type === 'backlog') {
            if (Array.isArray(data.logs)) {
              setLogs(data.logs);
              if (isAutoScrollRef.current) {
                requestAnimationFrame(() => scrollConsoleToBottom(false));
              }
            }
          } else if (data.type === 'log' && typeof data.line === 'string') {
            setLogs((prev) => {
              const updated = [...prev, data.line];
              return updated.length > 1500 ? updated.slice(updated.length - 1500) : updated;
            });

            if (isAutoScrollRef.current) {
              requestAnimationFrame(() => {
                const el = consoleContainerRef.current;
                if (el && isAutoScrollRef.current) {
                  el.scrollTop = el.scrollHeight;
                }
              });
            } else {
              setUnreadCount((c) => c + 1);
            }
          } else if (data.type === 'status_change') {
            onRefreshServer?.();
          } else if (data.type === 'command_ack') {
            setLastAck(data.result || 'Executed');
            setTimeout(() => setLastAck(null), 3000);
          }
        } catch {}
      };

      ws.onerror = () => {
        switchToPolling();
      };

      ws.onclose = () => {
        if (reconnectAttemptsRef.current < 5) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 8000);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        } else {
          switchToPolling();
        }
      };
    } catch {
      switchToPolling();
    }
  }, [server.id, onRefreshServer, scrollConsoleToBottom]);

  const switchToPolling = useCallback(() => {
    setWsStatus('polling');
    if (!pollIntervalRef.current) {
      fetchConsoleLogs();
      pollIntervalRef.current = setInterval(fetchConsoleLogs, 2500);
    }
  }, [fetchConsoleLogs]);

  // Connect on mount or when server.id changes, with strict cleanup
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Handle scroll events in the isolated viewport
  const handleScroll = () => {
    const el = consoleContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAtBottom = distanceFromBottom <= 40;

    isAutoScrollRef.current = isAtBottom;
    setIsAutoScroll(isAtBottom);

    if (isAtBottom) {
      setUnreadCount(0);
    }
  };

  // Jump to bottom action
  const handleJumpToBottom = () => {
    isAutoScrollRef.current = true;
    setIsAutoScroll(true);
    setUnreadCount(0);
    scrollConsoleToBottom(true);
  };

  // Command submission: Dispatches to WebSocket / REST and keeps page scroll stationary
  const handleSendCommand = async (e?: React.FormEvent, customCmd?: string) => {
    if (e) e.preventDefault();
    const cmdToSend = (customCmd !== undefined ? customCmd : command).trim();
    if (!cmdToSend) return;

    setCommandHistory((prev) => [cmdToSend, ...prev.filter((c) => c !== cmdToSend)].slice(0, 30));
    setHistoryIndex(-1);
    setCommand('');
    setIsSubmitting(true);

    let sentViaWs = false;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'command', command: cmdToSend }));
        sentViaWs = true;
      } catch {}
    }

    if (!sentViaWs) {
      try {
        const token = localStorage.getItem('aether_token');
        const res = await fetch(`/api/v1/servers/${server.id}/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ command: cmdToSend })
        });
        const data = await res.json();
        if (data.data?.result) {
          setLastAck(data.data.result);
          setTimeout(() => setLastAck(null), 3000);
        }
      } catch {}
    }

    setIsSubmitting(false);

    // If user was following live logs, scroll to bottom without affecting parent page
    if (isAutoScrollRef.current) {
      requestAnimationFrame(() => scrollConsoleToBottom(true));
    }
  };

  // Keyboard navigation (History Up/Down)
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

  // Filter logs by search query
  const filteredLogs = useMemo(() => {
    if (!filterQuery.trim()) return logs;
    const q = filterQuery.toLowerCase();
    return logs.filter((l) => l.toLowerCase().includes(q));
  }, [logs, filterQuery]);

  const handleCopyLogs = () => {
    const text = logs.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearLogs = () => {
    setLogs([]);
    setUnreadCount(0);
  };

  const handleDownloadLogs = () => {
    const text = logs.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${server.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_console_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleManualReconnect = () => {
    reconnectAttemptsRef.current = 0;
    connectWebSocket();
  };

  return (
    <div id="server-console-tab" className="space-y-4">
      {/* Console Top Control & Status Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Connection Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-500">Live Stream:</span>
            {wsStatus === 'connected' && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Connected
              </span>
            )}
            {wsStatus === 'connecting' && (
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <RotateCw className="h-3 w-3 animate-spin" />
                Connecting...
              </span>
            )}
            {wsStatus === 'reconnecting' && (
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <RotateCw className="h-3 w-3 animate-spin" />
                Reconnecting...
              </span>
            )}
            {wsStatus === 'polling' && (
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Wifi className="h-3 w-3" />
                Polling Fallback
              </span>
            )}
            {wsStatus === 'disconnected' && (
              <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                <WifiOff className="h-3 w-3" />
                Connection Lost
              </span>
            )}
          </div>

          {/* Buffer Capacity Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-500">Buffer:</span>
            <span className="text-zinc-300 font-bold">{logs.length}</span>
            <span className="text-zinc-600 hidden xs:inline">/ 1500 lines</span>
          </div>

          {/* Runtime Type Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/30 border border-zinc-850 text-xs font-mono text-zinc-400">
            {isMinecraft ? (
              <span className="text-amber-400">Minecraft {server.software || 'Paper'}</span>
            ) : isNode ? (
              <span className="text-emerald-400">Node.js Runtime</span>
            ) : isPython ? (
              <span className="text-blue-400">Python Runtime</span>
            ) : isBun ? (
              <span className="text-amber-300">Bun Runtime</span>
            ) : (
              <span className="text-zinc-400">Custom Container</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search/Filter Bar */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full sm:w-44 pl-8 pr-3 py-2 sm:py-1.5 rounded-xl bg-black/50 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all font-mono"
            />
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopyLogs}
            title="Copy Console Output"
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Download Logs Button */}
          <button
            onClick={handleDownloadLogs}
            title="Download Logs as File"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          {/* Clear Button */}
          <button
            onClick={handleClearLogs}
            title="Clear Console View"
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-rose-950/40 hover:border-rose-800 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-rose-400 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Clear</span>
          </button>

          {/* Reconnect / Refresh Button */}
          <button
            onClick={handleManualReconnect}
            title="Reconnect Console Stream"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer shrink-0"
          >
            <RotateCw className={`h-3.5 w-3.5 ${wsStatus === 'connecting' || wsStatus === 'reconnecting' ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Independent Terminal Viewport Container (STRICTLY ISOLATED SCROLL) */}
      <div className="relative">
        <div
          id="console-viewport-container"
          ref={consoleContainerRef}
          onScroll={handleScroll}
          tabIndex={0}
          style={{ overscrollBehavior: 'contain' }}
          className="rounded-2xl border border-zinc-800 bg-[#08080a] p-3 sm:p-4 font-mono text-xs text-zinc-300 h-[380px] sm:h-[480px] overflow-y-auto overflow-x-auto space-y-1 shadow-2xl selection:bg-amber-500/30 selection:text-white touch-scroll focus:outline-none focus:border-zinc-700"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-3 select-none">
              <TerminalIcon className="h-10 w-10 text-zinc-700" />
              {filterQuery ? (
                <div>
                  <p className="font-semibold text-zinc-400">No matching log lines found.</p>
                  <p className="text-[11px] text-zinc-600">Try adjusting or clearing your search filter query.</p>
                </div>
              ) : isStarting ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-amber-400 font-semibold">
                    <RotateCw className="h-4 w-4 animate-spin" />
                    <span>Starting server container...</span>
                  </div>
                  <p className="text-[11px] text-zinc-600">Initializing runtime environment and attaching stdout stream...</p>
                </div>
              ) : isStopping ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-amber-400 font-semibold">
                    <RotateCw className="h-4 w-4 animate-spin" />
                    <span>Stopping server...</span>
                  </div>
                  <p className="text-[11px] text-zinc-600">Sending graceful shutdown signal to active process...</p>
                </div>
              ) : isRunning ? (
                <div>
                  <p className="font-semibold text-zinc-400">Live container active (PID: {server.startup?.pid || 'Attached'}).</p>
                  <p className="text-[11px] text-zinc-600">Waiting for process stdout/stderr emissions...</p>
                </div>
              ) : (
                <div className="space-y-2 max-w-sm">
                  <p className="font-semibold text-zinc-400">Server is offline.</p>
                  <p className="text-[11px] text-zinc-600">
                    Start the server to view live console output.
                  </p>
                  {onPowerAction && (
                    <button
                      onClick={() => onPowerAction('start')}
                      className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg transition-all cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start Server Now
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
                  className={`leading-relaxed whitespace-pre font-mono text-[11px] w-max min-w-full ${colorClass} hover:bg-zinc-900/40 px-1 rounded transition-colors`}
                >
                  {cleaned}
                </div>
              );
            })
          )}
        </div>

        {/* Floating "Jump to Latest" indicator when scrolled up (Clicking scrolls ONLY the console) */}
        {!isAutoScroll && (
          <button
            type="button"
            onClick={handleJumpToBottom}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-2xl transition-all z-10 cursor-pointer animate-fade-in"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span>{unreadCount > 0 ? `↓ ${unreadCount} New Log${unreadCount > 1 ? 's' : ''}` : 'Jump to Latest ↓'}</span>
          </button>
        )}
      </div>

      {/* Interactive Command Input Form (Page Scroll Completely Isolated) */}
      <form onSubmit={(e) => handleSendCommand(e)} className="space-y-2">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-3.5 sm:top-3 font-mono text-amber-400 text-xs font-bold select-none">&gt;</span>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isRunning && !isStarting}
              placeholder={
                isRunning
                  ? `Type ${isMinecraft ? 'Minecraft command (e.g. list, help, tps)' : 'runtime command / stdin'}...`
                  : isStarting
                  ? 'Server is starting... input queued'
                  : 'Server is offline. Start server to send commands.'
              }
              className={`w-full rounded-xl bg-zinc-950 border pl-8 pr-16 sm:pr-24 py-3 sm:py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none transition-all ${
                isRunning || isStarting
                  ? 'border-zinc-800 focus:border-amber-500'
                  : 'border-zinc-800/60 bg-zinc-950/60 opacity-70 cursor-not-allowed'
              }`}
            />
            {lastAck && (
              <span className="absolute right-3 top-3 sm:top-2.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded hidden xs:inline">
                ✓ {lastAck}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!command.trim() || (!isRunning && !isStarting) || isSubmitting}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shrink-0 cursor-pointer ${
              command.trim() && (isRunning || isStarting)
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20 active:scale-95'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span className="hidden xs:inline">Send</span>
          </button>
        </div>

        {/* Quick Command Suggestions & Status Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-zinc-500 font-mono text-[11px] mr-1">Quick:</span>
            {quickCommands.map((q) => (
              <button
                key={q.cmd}
                type="button"
                disabled={!isRunning}
                onClick={() => handleSendCommand(undefined, q.cmd)}
                title={q.desc}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all flex items-center ${
                  isRunning
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-amber-500/50 hover:bg-zinc-850 cursor-pointer active:scale-95'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">
            <span>↑↓ history</span>
            <span>•</span>
            <span>stdin active</span>
          </div>
        </div>
      </form>
    </div>
  );
}
