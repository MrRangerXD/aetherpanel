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
      <div className="surface rounded-lg p-8 text-center text-xs font-mono text-ink-mute anim-shimmer">
        Loading Discord integration configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="surface rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" /> Discord Alerts & Webhook Bridge
            </h2>

            {/* Webhook Status Badge */}
            {!enabled ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-line text-ink-mute">
                Inactive
              </span>
            ) : !webhookUrl ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-warn/10 border border-warn/25 text-warn flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-warn" /> Unconfigured
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-ok/10 border border-ok/25 text-ok">
                Active
              </span>
            )}

            {/* Global Bot Status Badge */}
            {botGatewayStatus && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                botGatewayStatus.status === 'CONNECTED'
                  ? 'bg-ok/10 border-ok/25 text-ok'
                  : botGatewayStatus.status === 'CONNECTING'
                  ? 'bg-accent/10 border-accent/25 text-accent'
                  : 'bg-surface-2 border-line text-ink-mute'
              }`}>
                {botGatewayStatus.status === 'CONNECTED' ? `Bot: ${botGatewayStatus.botUsername || 'Online'}` : `Bot: ${botGatewayStatus.status}`}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-mute mt-1">
            Dispatch real-time server lifecycle and hardware events directly into Discord channels.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>Save Changes</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-lg bg-ok/10 border border-ok/25 text-xs text-ok flex items-center gap-2">
          <Check className="h-4 w-4" /> Discord server integration settings updated successfully.
        </div>
      )}

      {/* Webhook & Channel Link Form */}
      <form onSubmit={handleSaveSettings} className="surface rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-mute flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-accent" /> Channel Link Configuration
          </h3>

          <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="w-3.5 h-3.5 accent-accent rounded"
            />
            <span>Enable Discord Alerts</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="label mb-1">Discord Webhook URL</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz"
              className="field w-full font-mono text-xs"
            />
            <p className="text-[11px] text-ink-mute mt-1">
              Create a webhook in your Discord server under Channel Settings → Integrations → Webhooks.
            </p>
          </div>

          <div>
            <label className="label mb-1">Target Channel Name</label>
            <input
              type="text"
              value={channelName}
              onChange={e => setChannelName(e.target.value)}
              placeholder="#server-alerts"
              className="field w-full text-xs"
            />
          </div>

          <div>
            <label className="label mb-1">Anti-Spam Cooldown (Seconds)</label>
            <input
              type="number"
              min="10"
              max="600"
              value={cooldownSeconds}
              onChange={e => setCooldownSeconds(Number(e.target.value))}
              className="field w-full font-mono text-xs"
            />
          </div>

          <div>
            <label className="label mb-1">Mention Role ID (Optional)</label>
            <input
              type="text"
              value={mentionRoleId}
              onChange={e => setMentionRoleId(e.target.value)}
              placeholder="e.g. 109283749281729384"
              className="field w-full font-mono text-xs"
            />
          </div>

          <div>
            <label className="label mb-1">Mention User ID (Optional)</label>
            <input
              type="text"
              value={mentionUserId}
              onChange={e => setMentionUserId(e.target.value)}
              placeholder="e.g. 987654321012345678"
              className="field w-full font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-line">
          <div>
            <span className="text-xs font-medium text-ink block">Allow Interactive Slash Commands</span>
            <span className="text-[11px] text-ink-mute block mt-0.5">
              Allow authorized Discord subusers to trigger `/server start`, `/server stop`, and `/server backup`.
            </span>
          </div>
          <input
            type="checkbox"
            checked={allowServerCommands}
            onChange={e => setAllowServerCommands(e.target.checked)}
            className="w-3.5 h-3.5 accent-accent rounded"
          />
        </div>
      </form>

      {/* Event Notification Subscriptions */}
      <div className="surface rounded-lg p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-mute flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-accent" /> Event Notification Subscriptions
        </h3>
        <p className="text-xs text-ink-mute">
          Select which automated server lifecycle events trigger rich embed notifications on Discord.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {ALL_EVENTS.map(ev => {
            const isChecked = enabledEvents.includes(ev.id);
            return (
              <div
                key={ev.id}
                onClick={() => toggleEvent(ev.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  isChecked
                    ? 'bg-accent/10 border-accent/40'
                    : 'bg-surface-2 border-line hover:border-line-soft'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${isChecked ? 'text-accent' : 'text-ink'}`}>{ev.label}</span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 accent-accent rounded pointer-events-none"
                  />
                </div>
                <p className="text-[10px] text-ink-mute mt-1 leading-snug">{ev.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Webhook Tester & Interactive Command Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Webhook Tester */}
        <div className="surface rounded-lg p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-mute flex items-center gap-2">
            <Send className="h-3.5 w-3.5 text-accent" /> Test Notification Dispatcher
          </h3>
          <p className="text-xs text-ink-mute">
            Dispatch a test notification embed to verify Discord webhook delivery and payload formatting.
          </p>

          <div className="space-y-3">
            <div>
              <label className="label mb-1">Select Event Type</label>
              <select
                value={testEvent}
                onChange={e => setTestEvent(e.target.value as DiscordNotificationEvent)}
                className="field w-full text-xs"
              >
                {ALL_EVENTS.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.label} ({ev.category})</option>
                ))}
              </select>
            </div>

            {testNotice && (
              <div className={`p-2.5 rounded-lg border text-xs font-mono ${
                testNotice.success ? 'bg-ok/10 border-ok/25 text-ok' : 'bg-err/10 border-err/25 text-err'
              }`}>
                {testNotice.message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTestEvent('SERVER_CRASHED');
                  handleTestWebhook();
                }}
                disabled={testingWebhook}
                className="btn btn-ghost border-line text-xs font-mono justify-center"
              >
                <Flame className="h-3.5 w-3.5 text-err" />
                <span>Simulate Crash</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTestEvent('BACKUP_COMPLETED');
                  handleTestWebhook();
                }}
                disabled={testingWebhook}
                className="btn btn-ghost border-line text-xs font-mono justify-center"
              >
                <Check className="h-3.5 w-3.5 text-ok" />
                <span>Simulate Backup</span>
              </button>
            </div>

            <button
              onClick={handleTestWebhook}
              disabled={testingWebhook}
              className="btn btn-primary w-full justify-center"
            >
              {testingWebhook ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>{testingWebhook ? 'Dispatching...' : 'Dispatch Test Notification'}</span>
            </button>
          </div>
        </div>

        {/* Interactive Discord Command Console */}
        <div className="surface rounded-lg p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-mute flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-accent" /> Discord Command Console
          </h3>
          <p className="text-xs text-ink-mute">
            Simulate Discord slash command execution with authorization and live state updates.
          </p>

          {/* Quick Action Pills */}
          <div className="flex flex-wrap gap-1">
            {[
              { cmd: '/server status', label: 'Status', icon: Terminal },
              { cmd: '/server list', label: 'List All', icon: Terminal },
              { cmd: '/server start', label: 'Start', icon: Play },
              { cmd: '/server stop', label: 'Stop', icon: Square },
              { cmd: '/server restart', label: 'Restart', icon: RotateCw },
              { cmd: '/server console', label: 'Logs', icon: Terminal },
              { cmd: '/server stats', label: 'Telemetry', icon: Radio },
              { cmd: '/server backup', label: 'Backup', icon: Database },
              { cmd: '/user info', label: 'Profile', icon: Shield },
              { cmd: '/ping', label: 'Ping', icon: Radio }
            ].map(item => (
              <button
                key={item.cmd}
                onClick={() => {
                  setCmdInput(item.cmd);
                  handleRunCommand(item.cmd);
                }}
                className="px-2 py-0.5 rounded bg-surface-2 hover:bg-surface-3 border border-line text-[10px] font-mono text-ink-dim hover:text-ink flex items-center gap-1 transition-colors"
              >
                <item.icon className="h-2.5 w-2.5 text-ink-mute" />
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
              className="field flex-1 font-mono text-xs"
            />
            <button
              onClick={() => handleRunCommand()}
              disabled={executingCmd}
              className="btn btn-primary"
            >
              {executingCmd ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Run</span>
            </button>
          </div>

          {/* Formatted Discord Embed Preview Card */}
          {cmdResult && (
            <div className="p-3.5 rounded-lg bg-surface-2 border border-line space-y-2">
              <div className="flex items-center justify-between border-b border-line pb-1.5">
                <span className="text-[10px] font-mono uppercase text-ink-mute">Bot Response Preview</span>
                <span className={`text-[10px] font-mono font-semibold ${cmdResult.success ? 'text-ok' : 'text-err'}`}>
                  {cmdResult.success ? '200 OK' : 'Error'}
                </span>
              </div>

              {cmdResult.embed ? (
                <div className="p-3 rounded-lg bg-surface-3 border-l-2 border-accent text-ink space-y-2">
                  <h4 className="text-xs font-semibold text-ink">
                    {cmdResult.embed.title}
                  </h4>
                  <p className="text-xs text-ink-dim whitespace-pre-line leading-relaxed">{cmdResult.embed.description}</p>

                  {cmdResult.embed.fields && cmdResult.embed.fields.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line text-[11px]">
                      {cmdResult.embed.fields.map((f: any, idx: number) => (
                        <div key={idx} className={f.inline === false ? 'col-span-2' : ''}>
                          <span className="font-mono text-ink-mute block text-[10px] uppercase">{f.name}</span>
                          <span className="text-ink font-mono whitespace-pre-line">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] font-mono text-ink-mute pt-1 flex items-center justify-between border-t border-line">
                    <span>{cmdResult.embed.footer?.text || 'AetherPanel Bot'}</span>
                    <span>{new Date(cmdResult.embed.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-mono text-err">{cmdResult.message}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Discord Command Reference Card */}
      <div className="surface rounded-lg p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-mute flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-accent" /> Command Reference
        </h3>
        <p className="text-xs text-ink-mute">
          When your Discord user is linked and has subuser permissions, these commands can be executed in any guild channel:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {[
            { cmd: '/server list', desc: 'Lists all servers with runtime status and assigned ports' },
            { cmd: '/server status [id]', desc: 'Displays CPU %, RAM usage, uptime, and primary IP' },
            { cmd: '/server start <id>', desc: 'Initiates container boot sequence' },
            { cmd: '/server stop <id>', desc: 'Sends SIGTERM graceful shutdown signal' },
            { cmd: '/server restart <id>', desc: 'Reboots server container with health checks' },
            { cmd: '/server kill <id>', desc: 'Forcefully terminates unresponsive process (SIGKILL)' },
            { cmd: '/server command <id> <text>', desc: 'Dispatches command to live console stdin' },
            { cmd: '/server console <id>', desc: 'Fetches recent stdout/stderr log stream' },
            { cmd: '/server backup <id>', desc: 'Triggers filesystem snapshot and tarball creation' },
            { cmd: '/server stats <id>', desc: 'Real-time telemetry and resource quotas' },
            { cmd: '/user info', desc: 'Shows credits balance and active resource allocations' },
            { cmd: '/ping', desc: 'Tests bot gateway latency and socket heartbeat' }
          ].map(c => (
            <div key={c.cmd} className="p-2.5 rounded-lg bg-surface-2 border border-line space-y-0.5">
              <span className="font-mono text-xs font-semibold text-accent block">{c.cmd}</span>
              <p className="text-[10px] text-ink-mute leading-snug">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
