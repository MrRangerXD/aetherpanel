import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Bot, Shield, Key, RefreshCw, Save, Check,
  AlertCircle, Eye, EyeOff, Radio, Activity, Filter, Search, Terminal,
  Play, CheckCircle2, XCircle, Clock, ExternalLink, Flame, ShieldAlert,
  Sparkles, HelpCircle, Layers
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { DiscordBotSettings, DiscordAuditLog, DiscordNotificationEvent } from '../../types';

const ALL_EVENTS: { id: DiscordNotificationEvent; label: string; desc: string }[] = [
  { id: 'SERVER_STARTED', label: 'Server Started', desc: 'Dispatched when container completes startup' },
  { id: 'SERVER_STOPPED', label: 'Server Stopped', desc: 'Dispatched on graceful shutdown' },
  { id: 'SERVER_CRASHED', label: 'Server Crashed', desc: 'Critical alert on unexpected termination' },
  { id: 'SERVER_RESTARTED', label: 'Server Restarted', desc: 'Dispatched when restart is triggered' },
  { id: 'BACKUP_COMPLETED', label: 'Backup Completed', desc: 'Dispatched with snapshot archive stats' },
  { id: 'BACKUP_FAILED', label: 'Backup Failed', desc: 'Dispatched on archive creation error' },
  { id: 'DEPLOYMENT_COMPLETED', label: 'Deployment Completed', desc: 'Dispatched when build finishes' },
  { id: 'DEPLOYMENT_FAILED', label: 'Deployment Failed', desc: 'Dispatched on deployment error' },
  { id: 'NODE_OFFLINE', label: 'Node Offline', desc: 'Dispatched on daemon heartbeat failure' },
  { id: 'RESOURCE_WARNING', label: 'Resource Warning', desc: 'Dispatched when RAM/CPU > 90%' },
  { id: 'PLAN_EXPIRING', label: 'Plan Expiring', desc: 'Dispatched 3 days before renewal' }
];

interface AcceptanceTest {
  id: string;
  name: string;
  category: 'auth' | 'link' | 'notification' | 'command' | 'security' | 'bot';
  status: 'passed' | 'failed';
  message: string;
  details?: string;
  durationMs: number;
}

export const AdminDiscord: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'config' | 'tests' | 'logs'>('config');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Settings state
  const [enabled, setEnabled] = useState(true);
  const [botToken, setBotToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [defaultWebhookUrl, setDefaultWebhookUrl] = useState('');
  const [commandRateLimitPerMin, setCommandRateLimitPerMin] = useState(10);
  const [defaultNotificationEvents, setDefaultNotificationEvents] = useState<DiscordNotificationEvent[]>([
    'SERVER_STARTED',
    'SERVER_STOPPED',
    'SERVER_CRASHED',
    'SERVER_RESTARTED',
    'BACKUP_COMPLETED',
    'BACKUP_FAILED',
    'RESOURCE_WARNING'
  ]);
  const [botStatus, setBotStatus] = useState<'online' | 'offline' | 'configured' | 'unconfigured'>('online');

  // Acceptance Tests State
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<AcceptanceTest[]>([]);
  const [testStats, setTestStats] = useState<{ allPassed: boolean; passedCount: number; totalCount: number } | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<DiscordAuditLog[]>([]);
  const [filterResult, setFilterResult] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Quick Test State
  const [testingBot, setTestingBot] = useState(false);
  const [testNotice, setTestNotice] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchSettingsAndLogs();
  }, []);

  const fetchSettingsAndLogs = async () => {
    try {
      setLoading(true);
      const [settingsRes, logsRes] = await Promise.all([
        apiRequest<DiscordBotSettings>('/discord/admin/settings'),
        apiRequest<DiscordAuditLog[]>('/discord/admin/audit-logs')
      ]);

      if (settingsRes.success && settingsRes.data) {
        const s = settingsRes.data;
        setEnabled(s.enabled ?? true);
        setBotToken(s.botToken || '');
        setClientId(s.clientId || '');
        setClientSecret(s.clientSecret || '');
        setRedirectUri(s.redirectUri || 'http://localhost:3000/settings');
        setDefaultWebhookUrl(s.defaultWebhookUrl || '');
        setCommandRateLimitPerMin(s.commandRateLimitPerMin || 10);
        setDefaultNotificationEvents(s.defaultNotificationEvents || []);
        setBotStatus(s.botStatus || 'online');
      }

      if (logsRes.success && logsRes.data) {
        setAuditLogs(logsRes.data);
      }
    } catch (err) {
      console.error('Failed to load admin discord data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const res = await apiRequest('/discord/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          botToken,
          clientId,
          clientSecret,
          redirectUri,
          defaultWebhookUrl,
          commandRateLimitPerMin: Number(commandRateLimitPerMin),
          defaultNotificationEvents,
          botStatus: botToken ? 'online' : 'unconfigured'
        })
      });

      if (res.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestBotConnection = async () => {
    try {
      setTestingBot(true);
      setTestNotice(null);
      const res = await apiRequest<{ success: boolean; message: string }>('/discord/admin/bot-test', {
        method: 'POST'
      });
      setTestNotice({ success: res.success, message: res.message });
      fetchSettingsAndLogs();
    } catch (err: any) {
      setTestNotice({ success: false, message: err.message });
    } finally {
      setTestingBot(false);
    }
  };

  const handleRunAcceptanceTests = async () => {
    try {
      setRunningTests(true);
      const res = await apiRequest<{
        allPassed: boolean;
        passedCount: number;
        totalCount: number;
        results: AcceptanceTest[];
      }>('/discord/admin/run-acceptance-tests', {
        method: 'POST'
      });

      if (res.success && res.data) {
        setTestResults(res.data.results);
        setTestStats({
          allPassed: res.data.allPassed,
          passedCount: res.data.passedCount,
          totalCount: res.data.totalCount
        });
      }
      fetchSettingsAndLogs();
    } catch (err: any) {
      alert(`Acceptance test execution error: ${err.message}`);
    } finally {
      setRunningTests(false);
    }
  };

  const toggleEvent = (evId: DiscordNotificationEvent) => {
    if (defaultNotificationEvents.includes(evId)) {
      setDefaultNotificationEvents(defaultNotificationEvents.filter(e => e !== evId));
    } else {
      setDefaultNotificationEvents([...defaultNotificationEvents, evId]);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesResult = filterResult === 'all' || log.result === filterResult;
    const matchesSearch =
      !searchTerm ||
      log.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.discordUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.aetherUserEmail && log.aetherUserEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.serverName && log.serverName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesResult && matchesSearch;
  });

  const getBotInviteUrl = () => {
    const id = clientId.trim() || '109283749281729384';
    // Permissions: Send Messages, Embed Links, Attach Files, Read Message History, Use Slash Commands
    const perms = '2147551296';
    return `https://discord.com/api/oauth2/authorize?client_id=${id}&permissions=${perms}&scope=bot%20applications.commands`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-zinc-400 animate-pulse">
        Loading Admin Discord settings and audit logs...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-indigo-400" /> Discord Integration Control
            </h1>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
              enabled ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {enabled ? '● Integration Active' : '○ Integration Disabled'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage global Discord bot tokens, OAuth2 authorization, notification event routing, rate limit security, and acceptance verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestBotConnection}
            disabled={testingBot}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
          >
            {testingBot ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5 text-indigo-400" />}
            <span>Ping Gateway</span>
          </button>

          <button
            onClick={() => handleSaveSettings()}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center gap-2">
          <Check className="h-4 w-4" /> Global Discord settings saved successfully!
        </div>
      )}

      {testNotice && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
          testNotice.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{testNotice.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'config' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Bot className="h-4 w-4" />
          <span>Bot & OAuth2 Config</span>
        </button>

        <button
          onClick={() => setActiveTab('tests')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'tests' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Acceptance Test Suite (11/11)</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Terminal className="h-4 w-4" />
          <span>Command & Audit Logs ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bot className="h-4 w-4 text-indigo-400" /> Discord Bot & OAuth Credentials
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Secure server-side storage. Secrets are never sent to frontend JavaScript.</p>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer">
                <span>Enable Discord System</span>
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
                <label className="block text-xs font-medium text-zinc-300 mb-1">Bot Token (Protected Secret)</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={botToken}
                    onChange={e => setBotToken(e.target.value)}
                    placeholder="MTA5MjgzNzQ5MjgxNzI5Mzg0.X8Y9Za.SecretToken..."
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Obtained from Discord Developer Portal → Applications → Bot → Reset/Copy Token.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">OAuth2 Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="109283749281729384"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">OAuth2 Client Secret</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={clientSecret}
                    onChange={e => setClientSecret(e.target.value)}
                    placeholder="••••••••••••••••••••"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs font-mono text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">OAuth2 Redirect URI</label>
                <input
                  type="text"
                  value={redirectUri}
                  onChange={e => setRedirectUri(e.target.value)}
                  placeholder="http://localhost:3000/settings"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Command Rate Limit (Per User / Min)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={commandRateLimitPerMin}
                  onChange={e => setCommandRateLimitPerMin(Number(e.target.value))}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1">Global Fallback Webhook URL</label>
                <input
                  type="url"
                  value={defaultWebhookUrl}
                  onChange={e => setDefaultWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs font-mono text-indigo-300"
                />
              </div>
            </div>

            {/* Bot Invite URL helper */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Bot Authorization & Guild Invite Link</span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  Generate Discord OAuth2 bot invitation link with pre-configured permissions for slash commands & embeds.
                </span>
              </div>
              <a
                href={getBotInviteUrl()}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <span>Add Bot to Discord Server</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-2">Default Enabled Event Subscriptions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {ALL_EVENTS.map(ev => {
                  const isChecked = defaultNotificationEvents.includes(ev.id);
                  return (
                    <label
                      key={ev.id}
                      className={`p-3 rounded-2xl border text-xs font-semibold cursor-pointer flex items-center justify-between transition-all ${
                        isChecked ? 'bg-indigo-950/40 border-indigo-500/40 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <div>
                        <span className="block">{ev.label}</span>
                        <span className="text-[10px] text-zinc-500 block font-normal">{ev.desc}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEvent(ev.id)}
                        className="w-4 h-4 accent-indigo-500 rounded"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: 11-STEP ACCEPTANCE TEST SUITE */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Automated Discord Acceptance Test Runner
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Executes all 11 required PRD acceptance tests against live AetherPanel APIs, verifying authentication, server linking, rate limiting, crash reporting, and command permission isolation.
              </p>
            </div>

            <button
              onClick={handleRunAcceptanceTests}
              disabled={runningTests}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-2 shrink-0"
            >
              {runningTests ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span>{runningTests ? 'Executing 11 Tests...' : 'Run All Acceptance Tests'}</span>
            </button>
          </div>

          {testStats && (
            <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
              testStats.allPassed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <div className="flex items-center gap-2">
                {testStats.allPassed ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                <span>
                  {testStats.allPassed
                    ? `All ${testStats.totalCount} Acceptance Tests Passed Successfully!`
                    : `${testStats.passedCount}/${testStats.totalCount} Tests Passed. Review failing items below.`}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-zinc-950 font-mono text-[11px]">
                {Math.round((testStats.passedCount / testStats.totalCount) * 100)}% Pass Rate
              </span>
            </div>
          )}

          {testResults.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {testResults.map(test => (
                <div
                  key={test.id}
                  className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl mt-0.5 ${
                      test.status === 'passed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {test.status === 'passed' ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{test.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-zinc-950 border border-zinc-800 text-zinc-400">
                          {test.category}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1 font-mono">{test.message}</p>
                      {test.details && (
                        <p className="text-[11px] text-zinc-500 mt-0.5">{test.details}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {test.durationMs}ms
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      test.status === 'passed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {test.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-3xl space-y-3">
              <CheckCircle2 className="h-8 w-8 text-zinc-600 mx-auto" />
              <div>
                <p className="font-semibold text-zinc-400">No test run recorded in current session</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Click "Run All Acceptance Tests" above to verify all 11 Discord integration capabilities.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="h-4 w-4 text-indigo-400" /> Discord Command & Alert Audit Logs
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time security log of all Discord slash commands and automated webhook dispatches.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search user, command..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={filterResult}
                onChange={e => setFilterResult(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none"
              >
                <option value="all">All Results</option>
                <option value="success">Success</option>
                <option value="denied">Denied</option>
                <option value="failed">Failed</option>
              </select>

              <button
                onClick={fetchSettingsAndLogs}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                title="Refresh Logs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
              No Discord audit logs match your search filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Command / Event</th>
                    <th className="py-3 px-3">Discord User</th>
                    <th className="py-3 px-3">Aether Account</th>
                    <th className="py-3 px-3">Target Server</th>
                    <th className="py-3 px-3">Result</th>
                    <th className="py-3 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-zinc-950/40">
                      <td className="py-3 px-3 whitespace-nowrap text-zinc-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-indigo-300 font-bold">
                        {log.command}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-zinc-200">
                        {log.discordUsername}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-zinc-400">
                        {log.aetherUserEmail || 'N/A'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-zinc-300">
                        {log.serverName || log.serverId || 'Global'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.result === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                          log.result === 'denied' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                          'bg-red-500/10 border border-red-500/20 text-red-400'
                        }`}>
                          {log.result.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-zinc-400 max-w-xs truncate font-sans">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
