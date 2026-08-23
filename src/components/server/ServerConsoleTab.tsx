import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Clock,
  Sparkles
} from 'lucide-react';
import { Server } from '../../types';

interface ServerConsoleTabProps {
  server: Server;
  onRefreshServer?: () => void;
  onPowerAction?: (action: 'start' | 'stop' | 'restart' | 'kill') => Promise<void>;
}

// Simple ANSI & Minecraft formatting parser to clean or style terminal lines
function parseTerminalLine(rawText: string) {
  // Check for common log stream prefixes
  const isStderr = rawText.includes('[STDERR]') || rawText.includes('ERROR') || rawText.includes('FATAL') || rawText.includes('Exception');
  const isWarn = rawText.includes('WARN') || rawText.includes('WARNING');
  const isSuccess = rawText.includes('SUCCESS') || rawText.includes('Done (') || rawText.includes('ready in');
  const isUserCmd = rawText.includes('[UserCommand]') || rawText.includes('[USER COMMAND]');
  const isDaemon = rawText.includes('[AetherDaemon]');

  // Clean ANSI escape sequences for text rendering
  const cleaned = rawText.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

  let colorClass = 'text-zinc-300';
  if (isUserCmd) {
    colorClass = 'text-cyan-400 font-semibold bg-cyan-950/20 px-1 py-0.5 rounded';
  } else if (isStderr) {
    colorClass = 'text-rose-400 font-medium';
  } else if (isWarn) {
    colorClass = 'text-amber-400';
  } else if (isSuccess) {
    colorClass = 'text-emerald-400 font-medium';
  } else if (isDaemon) {
    colorClass = 'text-violet-400 font-medium';
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

  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const isMinecraft = /minecraft|paper|purpur|velocity|bungeecord|forge|fabric/i.test(server.software) || server.productId?.includes('minecraft');
  const isRunning = server.status === 'running';
  const isStarting = server.status === 'starting';
  const isStopping = server.status === 'stopping';

  // Quick Command Suggestions
  const quickCommands = useMemo(() => {
    if (isMinecraft) {
      return [
        { label: 'list', cmd: 'list', desc: 'List online players' },
        { label: 'tps', cmd: 'tps', desc: 'Check TPS & tick health' },
        { label: 'help', cmd: 'help', desc: 'List commands' },
        { label: 'save-all', cmd: 'save-all', desc: 'Force world save' },
        { label: 'say Hi', cmd: 'say Hello everyone!', desc: 'Broadcast message' },
        { label: 'version', cmd: 'version', desc: 'Server build info' },
        { label: 'stop', cmd: 'stop', desc: 'Graceful shutdown' }
      ];
    }
    return [
      { label: 'help', cmd: 'help', desc: 'Bot help menu' },
      { label: 'status', cmd: 'status', desc: 'Bot health & status' },
      { label: 'ping', cmd: 'ping', desc: 'Heartbeat test' },
      { label: 'reload', cmd: 'reload', desc: 'Reload modules' },
      { label: 'stats', cmd: 'stats', desc: 'Process memory & uptime' }
    ];
  }, [isMinecraft]);

  // REST API Fallback fetching
  const fetchConsoleLogs = async () => {
    try {
      const token = localStorage.getItem('aether_token');
      const res = await fetch(`/api/v1/servers/${server.id}/console`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.logs)) {
          setLogs(json.data.logs);
        }
      }
    } catch {}
  };

  // Connect WebSocket
  const connectWebSocket = () => {
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
            }
          } else if (data.type === 'log' && typeof data.line === 'string') {
            setLogs((prev) => {
              const updated = [...prev, data.line];
              if (updated.length > 1500) updated.shift();
              return updated;
            });
            if (!isAutoScroll) {
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
  };

  const switchToPolling = () => {
    setWsStatus('polling');
    if (!pollIntervalRef.current) {
      fetchConsoleLogs();
      pollIntervalRef.current = setInterval(fetchConsoleLogs, 2500);
    }
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [server.id]);

  // Scroll detection & auto-scrolling
  const handleScroll = () => {
    const el = consoleContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAutoScroll(isAtBottom);
    if (isAtBottom) {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (isAutoScroll) {
      consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    }
  }, [logs, isAutoScroll]);

  const scrollToBottom = () => {
    setIsAutoScroll(true);
    setUnreadCount(0);
    consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Command submission
  const handleSendCommand = async (e?: React.FormEvent, customCmd?: string) => {
    if (e) e.preventDefault();
    const cmdToSend = (customCmd !== undefined ? customCmd : command).trim();
    if (!cmdToSend) return;

    // Reset history index & record command
    setCommandHistory((prev) => [cmdToSend, ...prev.filter((c) => c !== cmdToSend)].slice(0, 30));
    setHistoryIndex(-1);
    setCommand('');
    setIsSubmitting(true);

    // Optimistic local echo
    setLogs((prev) => [...prev, `[UserCommand]: > ${cmdToSend}`]);

    // Send via WebSocket if connected, otherwise fallback to REST API
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
    setTimeout(scrollToBottom, 50);
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

  return (
    <div id="server-console-tab" className="space-y-4">
      {/* Console Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-500">Transport:</span>
            {wsStatus === 'connected' && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live WS
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
              <span className="flex items-center gap-1.5 text-zinc-500">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-500">Buffer:</span>
            <span className="text-zinc-300 font-bold">{logs.length}</span>
            <span className="text-zinc-600 hidden xs:inline">/ 1500 lines</span>
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
              placeholder="Search..."
              className="w-full sm:w-44 pl-8 pr-3 py-2 sm:py-1.5 rounded-xl bg-black/50 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all"
            />
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopyLogs}
            title="Copy Console Output"
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {/* Clear Button */}
          <button
            onClick={handleClearLogs}
            title="Clear Console View"
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-rose-950/40 hover:border-rose-800 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-rose-400 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Clear</span>
          </button>

          {/* Reload Backlog Button */}
          <button
            onClick={fetchConsoleLogs}
            title="Refresh Backlog"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer shrink-0"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="relative">
        <div
          ref={consoleContainerRef}
          onScroll={handleScroll}
          className="rounded-2xl border border-zinc-800 bg-[#08080a] p-3 sm:p-4 font-mono text-xs text-zinc-300 h-[380px] sm:h-[480px] overflow-y-auto overflow-x-auto space-y-1 shadow-2xl selection:bg-amber-500/30 selection:text-white touch-scroll"
          tabIndex={0}
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-3">
              <TerminalIcon className="h-10 w-10 text-zinc-700" />
              {filterQuery ? (
                <div>
                  <p className="font-semibold text-zinc-400">No matching log lines found.</p>
                  <p className="text-[11px] text-zinc-600">Try adjusting your filter search term.</p>
                </div>
              ) : isRunning ? (
                <div>
                  <p className="font-semibold text-zinc-400">Connected to active container.</p>
                  <p className="text-[11px] text-zinc-600">Waiting for process stdout/stderr emissions...</p>
                </div>
              ) : (
                <div className="space-y-2 max-w-sm">
                  <p className="font-semibold text-zinc-400">Server is currently offline.</p>
                  <p className="text-[11px] text-zinc-600">
                    Start the server to initialize the container sandbox and attach real-time live console output.
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
          <div ref={consoleBottomRef} />
        </div>

        {/* Floating "Jump to Bottom" button when scrolled up */}
        {!isAutoScroll && unreadCount > 0 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-xl animate-bounce transition-all z-10 cursor-pointer"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span>{unreadCount} new line{unreadCount > 1 ? 's' : ''} ↓</span>
          </button>
        )}
      </div>

      {/* Interactive Command Input Bar */}
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
                  ? `Type ${isMinecraft ? 'command (e.g. list, help, tps)' : 'bot command'}...`
                  : isStarting
                  ? 'Server starting... queued'
                  : 'Server is offline.'
              }
              className={`w-full rounded-xl bg-zinc-950 border pl-8 pr-16 sm:pr-24 py-3 sm:py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none transition-all ${
                isRunning
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
            <span>sandbox active</span>
          </div>
        </div>
      </form>
    </div>
  );
}
