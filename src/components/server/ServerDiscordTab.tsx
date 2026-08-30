import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Send, Bell, Shield, Zap, RefreshCw, Save, Check,
  AlertTriangle, Terminal, Play, Square, RotateCw, Database, Radio, Flame
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { ServerDiscordLink, DiscordNotificationEvent } from '../../types';
import { useToast } from '../../lib/ToastContext';

interface ServerDiscordTabProps {
  serverId: string;
  serverName: string;
}

const ALL_EVENTS: { id: DiscordNotificationEvent; label: string; category: string; description: string }[] = [
  { id: 'SERVER_STARTED', label: 'Server Started', category: 'Lifecycle', description: 'Triggers when server finishes startup and becomes online.' },
  { id: 'SERVER_STOPPED', label: 'Server Stopped', category: 'Lifecycle', description: 'Triggers when server gracefully shuts down.' },
  { id: 'SERVER_CRASHED', label: 'Server Crashed', category: 'Lifecycle', description: 'Triggers on unexpected process termination or error.' },
  { id: 'SERVER_RESTARTED', label: 'Server Restarted', category: 'Lifecycle', description: 'Triggers when server restart sequence is initiated.' },
  { id: 'BACKUP_COMPLETED', label: 'Backup Completed', category: 'Backups', description: 'Triggers when filesystem backup archive is created.' },
  { id: 'BACKUP_FAILED', label: 'Backup Failed', category: 'Backups', description: 'Triggers if backup compression fails or storage is full.' },
  { id: 'DEPLOYMENT_COMPLETED', label: 'Deployment Completed', category: 'Deploy', description: 'Triggers when automated deployment finishes.' },
  { id: 'DEPLOYMENT_FAILED', label: 'Deployment Failed', category: 'Deploy', description: 'Triggers on build or deployment failure.' },
  { id: 'NODE_OFFLINE', label: 'Node Offline', category: 'System', description: 'Triggers if host daemon loses heartbeat connectivity.' },
  { id: 'RESOURCE_WARNING', label: 'Resource Warning', category: 'System', description: 'Triggers when RAM/CPU exceeds 90% threshold.' },
  { id: 'PLAN_EXPIRING', label: 'Plan Expiring', category: 'Billing', description: 'Triggers 3 days before billing renewal deadline.' }
];

export const ServerDiscordTab: React.FC<ServerDiscordTabProps> = ({ serverId, serverName }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Bot Status State
  const [botGatewayStatus, setBotGatewayStatus] = useState<{
    status: string;
    botUsername: string | null;
    configured: boolean;
    enabled: boolean;
  } | null>(null);

  // Form State
  const [enabled, setEnabled] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('#server-alerts');
  const [enabledEvents, setEnabledEvents] = useState<DiscordNotificationEvent[]>([
    'SERVER_STARTED',
    'SERVER_STOPPED',
    'SERVER_CRASHED',
    'SERVER_RESTARTED',
    'BACKUP_COMPLETED',
    'BACKUP_FAILED',
    'RESOURCE_WARNING'
  ]);
  const [mentionRoleId, setMentionRoleId] = useState('');
  const [mentionUserId, setMentionUserId] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(60);
  const [allowServerCommands, setAllowServerCommands] = useState(true);

  // Webhook Test State
  const [testEvent, setTestEvent] = useState<DiscordNotificationEvent>('SERVER_STARTED');
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testNotice, setTestNotice] = useState<{ success: boolean; message: string } | null>(null);

  // Slash Command Terminal Simulator State
  const [cmdInput, setCmdInput] = useState('/server status');
  const [executingCmd, setExecutingCmd] = useState(false);
  const [cmdResult, setCmdResult] = useState<{ success: boolean; message: string; embed?: any } | null>(null);

  useEffect(() => {
    fetchLinkSettings();
  }, [serverId]);

  const fetchLinkSettings = async () => {
    try {
      setLoading(true);
      const [linkRes, botStatusRes] = await Promise.all([
        apiRequest<ServerDiscordLink>(`/discord/server/${serverId}`),
        apiRequest<any>('/discord/bot-status')
      ]);

      if (linkRes.success && linkRes.data) {
        setEnabled(linkRes.data.enabled);
        setWebhookUrl(linkRes.data.webhookUrl || '');
        setChannelName(linkRes.data.channelName || '#server-alerts');
        setEnabledEvents(linkRes.data.enabledEvents || []);
        setMentionRoleId(linkRes.data.mentionRoleId || '');
        setMentionUserId(linkRes.data.mentionUserId || '');
        setCooldownSeconds(linkRes.data.cooldownSeconds || 60);
        setAllowServerCommands(linkRes.data.allowServerCommands ?? true);
      }

      if (botStatusRes.success && botStatusRes.data) {
        setBotGatewayStatus(botStatusRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch server discord link:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await apiRequest(`/discord/server/${serverId}`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          webhookUrl,
          channelName,
          enabledEvents,
          mentionRoleId,
          mentionUserId,
          cooldownSeconds: Number(cooldownSeconds),
          allowServerCommands
        })
      });

      if (res.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        toast.error(res.error?.message || 'Failed to save settings.');
      }
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = (eventId: DiscordNotificationEvent) => {
    if (enabledEvents.includes(eventId)) {
      setEnabledEvents(enabledEvents.filter(e => e !== eventId));
    } else {
      setEnabledEvents([...enabledEvents, eventId]);
    }
  };

  const handleTestWebhook = async () => {
    try {
      setTestingWebhook(true);
      setTestNotice(null);
      const res = await apiRequest<{ success: boolean; message: string }>(`/discord/server/${serverId}/test-webhook`, {
        method: 'POST',
        body: JSON.stringify({ event: testEvent })
      });
      setTestNotice({ success: res.success, message: res.message });
    } catch (err: any) {
      setTestNotice({ success: false, message: err.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleRunCommand = async (cmdToRun?: string) => {
    const finalCmd = cmdToRun || cmdInput;
    if (!finalCmd.trim()) return;

    try {
      setExecutingCmd(true);
      setCmdResult(null);

      const res = await apiRequest<{ embed: any }>('/discord/command', {
        method: 'POST',
        body: JSON.stringify({
          command: finalCmd,
          serverId
        })
      });

      setCmdResult({
        success: res.success,
        message: res.message,
        embed: res.data?.embed
      });
    } catch (err: any) {
      setCmdResult({
        success: false,
        message: err.message || 'Execution error.'
      });
    } finally {
      setExecutingCmd(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-zinc-400 animate-pulse">
        Loading Discord integration configuration...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-400" /> Discord Integration & Alerts
            </h2>

            {/* Webhook Status Badge */}
            {!enabled ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 border border-zinc-700 text-zinc-400">
                ○ Webhook Disabled
              </span>
            ) : !webhookUrl ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                ⚠️ Webhook Unconfigured
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                ● Webhook Active
              </span>
            )}

            {/* Global Bot Status Badge */}
            {botGatewayStatus && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                botGatewayStatus.status === 'CONNECTED'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : botGatewayStatus.status === 'CONNECTING'
                  ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                  : botGatewayStatus.status === 'CONFIGURED'
                  ? 'bg-slate-500/10 border border-slate-500/20 text-slate-300'
                  : botGatewayStatus.status === 'NOT_CONFIGURED'
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
              }`}>
                {botGatewayStatus.status === 'CONNECTED' ? `● Bot: ${botGatewayStatus.botUsername || 'Online'}` : `○ Bot: ${botGatewayStatus.status}`}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Link server alerts to Discord channels via Webhooks and grant command permissions to authorized users.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 shrink-0"
        >
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>Save Integration</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center gap-2">
          <Check className="h-4 w-4" /> Discord server integration settings updated successfully!
        </div>
      )}

      {/* Webhook & Channel Link Form */}
      <form onSubmit={handleSaveSettings} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Radio className="h-4 w-4 text-violet-400" /> Webhook Channel Link Configuration
          </h3>

          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer">
            <span>Enable Discord Alerts</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-300 mb-1">Discord Webhook URL</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-indigo-300 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Create a webhook in your Discord server under Channel Settings → Integrations → Webhooks.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Target Channel Name</label>
            <input
              type="text"
              value={channelName}
              onChange={e => setChannelName(e.target.value)}
              placeholder="#server-alerts"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Anti-Spam Cooldown (Seconds)</label>
            <input
              type="number"
              min="10"
              max="600"
              value={cooldownSeconds}
              onChange={e => setCooldownSeconds(Number(e.target.value))}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Mention Role ID (Optional)</label>
            <input
              type="text"
              value={mentionRoleId}
              onChange={e => setMentionRoleId(e.target.value)}
              placeholder="e.g. 109283749281729384"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs font-mono text-zinc-300 placeholder:text-zinc-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Mention User ID (Optional)</label>
            <input
              type="text"
              value={mentionUserId}
              onChange={e => setMentionUserId(e.target.value)}
              placeholder="e.g. 987654321012345678"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs font-mono text-zinc-300 placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
          <div>
            <span className="text-xs font-bold text-white block">Allow Interactive Slash Commands</span>
            <span className="text-[11px] text-zinc-400 block mt-0.5">
              Allow linked Discord accounts with server access to execute `/server start`, `/server stop`, `/server backup`.
            </span>
          </div>
          <input
            type="checkbox"
            checked={allowServerCommands}
            onChange={e => setAllowServerCommands(e.target.checked)}
            className="w-4 h-4 accent-indigo-600 rounded"
          />
        </div>
      </form>

      {/* Event Notification Subscriptions */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-400" /> Event Notification Subscriptions
        </h3>
        <p className="text-xs text-zinc-400">
          Select which automated server lifecycle events trigger rich embed notifications on Discord.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {ALL_EVENTS.map(ev => {
            const isChecked = enabledEvents.includes(ev.id);
            return (
              <div
                key={ev.id}
                onClick={() => toggleEvent(ev.id)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  isChecked
                    ? 'bg-indigo-950/30 border-indigo-500/40 text-white'
                    : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{ev.label}</span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by parent div
                    className="w-4 h-4 accent-indigo-500 rounded"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{ev.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Webhook Tester & Interactive Command Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Webhook Tester */}
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Send className="h-4 w-4 text-emerald-400" /> Test Notification Dispatcher
          </h3>
          <p className="text-xs text-zinc-400">
            Dispatch a real test notification embed to verify Discord webhook delivery and embed formatting.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Select Event Type</label>
              <select
                value={testEvent}
                onChange={e => setTestEvent(e.target.value as DiscordNotificationEvent)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white"
              >
                {ALL_EVENTS.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.label} ({ev.category})</option>
                ))}
              </select>
            </div>

            {testNotice && (
              <div className={`p-3 rounded-xl border text-xs font-medium ${
                testNotice.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
              }`}>
                {testNotice.message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setTestEvent('SERVER_CRASHED');
                  handleTestWebhook();
                }}
                disabled={testingWebhook}
                className="py-2 px-3 rounded-xl bg-red-950/40 hover:bg-red-950/60 border border-red-800/40 text-[11px] font-semibold text-red-300 flex items-center justify-center gap-1.5"
              >
                <Flame className="h-3.5 w-3.5 text-red-400" />
                <span>Simulate Crash</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTestEvent('BACKUP_COMPLETED');
                  handleTestWebhook();
                }}
                disabled={testingWebhook}
                className="py-2 px-3 rounded-xl bg-purple-950/40 hover:bg-purple-950/60 border border-purple-800/40 text-[11px] font-semibold text-purple-300 flex items-center justify-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5 text-purple-400" />
                <span>Simulate Backup</span>
              </button>
            </div>

            <button
              onClick={handleTestWebhook}
              disabled={testingWebhook}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-2"
            >
              {testingWebhook ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>{testingWebhook ? 'Dispatching Webhook...' : 'Dispatch Test Notification'}</span>
            </button>
          </div>
        </div>

        {/* Interactive Discord Command Console */}
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Terminal className="h-4 w-4 text-cyan-400" /> Discord Slash Command Console
          </h3>
          <p className="text-xs text-zinc-400">
            Simulate Discord slash command execution with real authorization and server state updates.
          </p>

          {/* Quick Action Pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { cmd: '/server status', label: 'Status', icon: Terminal },
              { cmd: '/server start', label: 'Start', icon: Play },
              { cmd: '/server stop', label: 'Stop', icon: Square },
              { cmd: '/server restart', label: 'Restart', icon: RotateCw },
              { cmd: '/server backup', label: 'Backup', icon: Database }
            ].map(item => (
              <button
                key={item.cmd}
                onClick={() => {
                  setCmdInput(item.cmd);
                  handleRunCommand(item.cmd);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-cyan-300 flex items-center gap-1"
              >
                <item.icon className="h-3 w-3" />
                <span>{item.cmd}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={cmdInput}
              onChange={e => setCmdInput(e.target.value)}
              placeholder="/server status"
              className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => handleRunCommand()}
              disabled={executingCmd}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
            >
              {executingCmd ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Execute</span>
            </button>
          </div>

          {/* Formatted Discord Embed Preview Card */}
          {cmdResult && (
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <span className="text-[10px] font-mono uppercase text-zinc-500">Discord Bot Response Preview</span>
                <span className={`text-[10px] font-bold ${cmdResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {cmdResult.success ? '200 OK' : '403 Forbidden / Error'}
                </span>
              </div>

              {cmdResult.embed ? (
                <div className="p-3.5 rounded-xl bg-[#2b2d31] border-l-4 border-indigo-500 text-white space-y-2 font-sans">
                  <h4 className="text-xs font-bold flex items-center gap-1.5 text-white">
                    {cmdResult.embed.title}
                  </h4>
                  <p className="text-xs text-zinc-300 whitespace-pre-line">{cmdResult.embed.description}</p>

                  {cmdResult.embed.fields && cmdResult.embed.fields.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-700/60 text-[11px]">
                      {cmdResult.embed.fields.map((f: any, idx: number) => (
                        <div key={idx}>
                          <span className="font-bold text-zinc-400 block text-[10px]">{f.name}</span>
                          <span className="text-zinc-200 font-mono">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[9px] text-zinc-400 pt-1 flex items-center justify-between border-t border-zinc-700/40">
                    <span>{cmdResult.embed.footer?.text || 'AetherPanel Bot'}</span>
                    <span>{new Date(cmdResult.embed.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-red-400">{cmdResult.message}</p>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
