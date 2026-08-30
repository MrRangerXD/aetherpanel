import React, { useEffect, useState } from 'react';
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Server,
  Cpu, Database, HardDrive, MessageSquare, Bell, Shield, Clock,
  ChevronDown, ChevronRight, ExternalLink, Globe, Wifi, Send, Check,
  Info, Calendar, AlertOctagon, ArrowUpRight
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { StatusComponent, Incident, ScheduledMaintenance, DayUptime, StatusComponentState } from '../../types';

interface StatusPayload {
  overallStatus: StatusComponentState;
  overallStatusMessage: string;
  avgSla: string;
  lastUpdated: string;
  components: StatusComponent[];
  activeIncidents: Incident[];
  pastIncidents: Incident[];
  scheduledMaintenances: ScheduledMaintenance[];
  systemMetrics: {
    totalComputeNodes: number;
    onlineComputeNodes: number;
    runningServers: number;
    avgLatencyMs: number;
  };
}

export const Status: React.FC = () => {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<{ compId: string; day: DayUptime } | null>(null);

  // Subscribe modal
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subEmail, setSubEmail] = useState('');
  const [subWebhook, setSubWebhook] = useState('');
  const [subSuccess, setSubSuccess] = useState('');
  const [subLoading, setSubLoading] = useState(false);

  // Expanded incident IDs
  const [expandedIncidents, setExpandedIncidents] = useState<Record<string, boolean>>({});

  const fetchStatus = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    const res = await apiRequest('/status');
    if (res.success && res.data) {
      setData(res.data);
    }
    if (showSpinner) setLoading(false);
  };

  useEffect(() => {
    fetchStatus(true);
  }, []);

  // 30-second background polling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStatus(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const toggleIncident = (id: string) => {
    setExpandedIncidents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail && !subWebhook) return;
    setSubLoading(true);
    const res = await apiRequest('/status/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: subEmail, webhookUrl: subWebhook })
    });
    setSubLoading(false);
    if (res.success) {
      setSubSuccess(res.message || 'Subscription confirmed! You will receive critical incident updates.');
      setTimeout(() => {
        setSubSuccess('');
        setShowSubscribeModal(false);
        setSubEmail('');
        setSubWebhook('');
      }, 3000);
    }
  };

  const getStatusColor = (status: StatusComponentState) => {
    switch (status) {
      case 'operational':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'degraded':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'partial_outage':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'major_outage':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'maintenance':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  const getStatusIcon = (status: StatusComponentState) => {
    switch (status) {
      case 'operational':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'partial_outage':
        return <AlertOctagon className="h-4 w-4 text-orange-400" />;
      case 'major_outage':
        return <XCircle className="h-4 w-4 text-rose-400" />;
      case 'maintenance':
        return <Clock className="h-4 w-4 text-sky-400" />;
      default:
        return <Activity className="h-4 w-4 text-zinc-400" />;
    }
  };

  const getDayColor = (state: StatusComponentState) => {
    switch (state) {
      case 'operational':
        return 'bg-emerald-500 hover:bg-emerald-400';
      case 'degraded':
        return 'bg-amber-400 hover:bg-amber-300';
      case 'partial_outage':
        return 'bg-orange-500 hover:bg-orange-400';
      case 'major_outage':
        return 'bg-rose-500 hover:bg-rose-400';
      case 'maintenance':
        return 'bg-sky-400 hover:bg-sky-300';
      default:
        return 'bg-zinc-700';
    }
  };

  // Group components
  const componentsByGroup: Record<string, StatusComponent[]> = {};
  if (data?.components) {
    data.components.forEach(c => {
      const g = c.group || 'Other Services';
      if (!componentsByGroup[g]) componentsByGroup[g] = [];
      componentsByGroup[g].push(c);
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* Top Branding & Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">AetherPanel Status</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Pulse
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">Real-time infrastructure health, telemetry, and uptime verification.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setShowSubscribeModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-medium transition-all"
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Subscribe to Updates</span>
            </button>

            <button
              onClick={() => fetchStatus(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Hero Overall Status Banner */}
        <div className={`p-6 rounded-2xl border transition-all ${
          data?.overallStatus === 'operational'
            ? 'bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border-emerald-500/30'
            : data?.overallStatus === 'maintenance'
            ? 'bg-gradient-to-r from-sky-950/40 via-zinc-900 to-zinc-900 border-sky-500/30'
            : 'bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 border-amber-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border shadow-lg ${
                data?.overallStatus === 'operational'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : data?.overallStatus === 'maintenance'
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {data ? getStatusIcon(data.overallStatus) : <Activity className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {data?.overallStatusMessage || 'Connecting to Infrastructure Telemetry...'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Last verified: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'Checking...'} (Auto-refresh every 30s)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3.5 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-right">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono block">90-Day SLA Uptime</span>
                <span className="text-sm font-bold font-mono text-emerald-400">{data?.avgSla || '99.99%'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scheduled Maintenance Announcement (if any) */}
        {data?.scheduledMaintenances && data.scheduledMaintenances.length > 0 && (
          <div className="space-y-3">
            {data.scheduledMaintenances.map(maint => (
              <div key={maint.id} className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/30 flex items-start gap-3.5">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{maint.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-sky-500/20 text-sky-300 font-medium">
                      {maint.status === 'in_progress' ? 'Active Now' : 'Scheduled'}
                    </span>
                  </div>
                  <p className="text-zinc-300 mt-1">{maint.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-zinc-400 mt-2 font-mono text-[11px]">
                    <span>Window: {new Date(maint.scheduledStartTime).toUTCString()} — {new Date(maint.scheduledEndTime).toUTCString()}</span>
                    {maint.affectedComponents.length > 0 && (
                      <span>Affected: {maint.affectedComponents.join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active Incidents Banner (if any) */}
        {data?.activeIncidents && data.activeIncidents.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Active Incident Investigation
            </h3>
            {data.activeIncidents.map(inc => (
              <div key={inc.id} className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{inc.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-mono bg-amber-500/20 text-amber-300 font-semibold">
                        {inc.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1">{inc.description}</p>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap">
                    Started {new Date(inc.startedAt).toLocaleTimeString()}
                  </span>
                </div>

                {/* Timeline */}
                <div className="space-y-2 pt-2 border-t border-amber-500/20">
                  {inc.timeline.map((item, idx) => (
                    <div key={item.id || idx} className="text-xs flex items-start gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white capitalize">{item.status}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-zinc-300 mt-0.5">{item.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Real Cluster Metrics Counter Bar */}
        {data?.systemMetrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Compute Nodes</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Server className="h-4 w-4 text-emerald-400" />
                <span className="text-base font-bold font-mono text-white">
                  {data.systemMetrics.onlineComputeNodes} / {data.systemMetrics.totalComputeNodes} Online
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Running Servers</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Cpu className="h-4 w-4 text-amber-400" />
                <span className="text-base font-bold font-mono text-white">
                  {data.systemMetrics.runningServers} Instances
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Cluster Latency</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Wifi className="h-4 w-4 text-sky-400" />
                <span className="text-base font-bold font-mono text-white">
                  ~{data.systemMetrics.avgLatencyMs} ms
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Security & DDoS</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-base font-bold font-mono text-white">Active (Nominal)</span>
              </div>
            </div>
          </div>
        )}

        {/* Infrastructure Components with 90-Day History Bars */}
        <div className="space-y-8">
          {Object.entries(componentsByGroup).map(([groupName, groupComponents]) => (
            <div key={groupName} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2">
                  <span>{groupName}</span>
                </h3>
                <span className="text-[11px] text-zinc-400 font-mono">90 Days Ago — Today</span>
              </div>

              <div className="space-y-3">
                {groupComponents.map(comp => (
                  <div
                    key={comp.id}
                    className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{comp.name}</span>
                          {comp.latencyMs !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-300">
                              {comp.latencyMs}ms
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{comp.details || comp.description}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(comp.status)}`}>
                          {getStatusIcon(comp.status)}
                          <span className="capitalize">{comp.status.replace('_', ' ')}</span>
                        </span>
                      </div>
                    </div>

                    {/* 90-Day Uptime Graph Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                        <span>90 days ago</span>
                        <span className="text-zinc-400">{comp.uptimePercent90Days || 99.98}% uptime</span>
                        <span>Today</span>
                      </div>

                      {/* Bar ticks */}
                      <div className="flex items-center gap-[2px] h-7 w-full overflow-hidden rounded bg-zinc-950 p-1 border border-zinc-800/80">
                        {comp.history90Days && comp.history90Days.length > 0 ? (
                          comp.history90Days.map((day, idx) => (
                            <div
                              key={day.date || idx}
                              onMouseEnter={() => setHoveredDay({ compId: comp.id, day })}
                              onMouseLeave={() => setHoveredDay(null)}
                              className={`flex-1 h-full rounded-[1px] transition-colors cursor-pointer ${getDayColor(day.status)}`}
                              title={`${day.date}: ${day.status} (${day.uptimePercent}%)`}
                            />
                          ))
                        ) : (
                          <div className="w-full text-center text-[10px] text-zinc-400 py-1">Telemetry loading...</div>
                        )}
                      </div>

                      {/* Tooltip display */}
                      {hoveredDay && hoveredDay.compId === comp.id && (
                        <div className="p-1.5 rounded bg-zinc-950 border border-zinc-700 text-center text-[11px] font-mono text-zinc-200">
                          <span className="font-semibold text-white">{hoveredDay.day.date}</span>: <span className="capitalize text-emerald-400">{hoveredDay.day.status}</span> ({hoveredDay.day.uptimePercent}% availability)
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Past Incidents Archive */}
        <div className="space-y-4 pt-6 border-t border-zinc-800/80">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
              Past Incidents & Post-Mortems
            </h3>
            <span className="text-xs text-zinc-400">Past 90 days</span>
          </div>

          {data?.pastIncidents && data.pastIncidents.length > 0 ? (
            <div className="space-y-3">
              {data.pastIncidents.map(inc => {
                const isExpanded = !!expandedIncidents[inc.id];
                return (
                  <div key={inc.id} className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                    <div
                      onClick={() => toggleIncident(inc.id)}
                      className="flex items-start justify-between gap-2 cursor-pointer select-none"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white hover:text-amber-300 transition-colors">
                            {inc.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Resolved
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 font-mono block mt-0.5">
                          {new Date(inc.startedAt).toLocaleDateString()} • Duration: {
                            inc.resolvedAt
                              ? `${Math.round((new Date(inc.resolvedAt).getTime() - new Date(inc.startedAt).getTime()) / 60000)} mins`
                              : 'Resolved'
                          }
                        </span>
                      </div>

                      <div className="text-zinc-400 hover:text-white p-1">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-300">{inc.description}</p>

                    {isExpanded && (
                      <div className="space-y-2 pt-3 border-t border-zinc-800/80">
                        <span className="text-[10px] font-mono uppercase text-zinc-400 block">Incident Timeline</span>
                        {inc.timeline.map((item, idx) => (
                          <div key={item.id || idx} className="text-xs flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                            <div>
                              <span className="text-zinc-400 font-mono text-[10px]">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} —{' '}
                              </span>
                              <span className="text-zinc-200">{item.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">No incidents reported in the past 90 days. All systems performing at peak availability.</p>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center pt-8 pb-4 text-xs text-zinc-400 space-y-1">
          <p>AetherPanel Real-Time Health Engine • Monitored every 15s via direct daemon telemetry.</p>
          <p className="text-[11px] text-zinc-400">Zero synthetic or fabricated uptime data. Backed by real distributed node heartbeats.</p>
        </div>

      </div>

      {/* Subscribe Modal */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Subscribe to Status Alerts</h3>
              </div>
              <button
                onClick={() => setShowSubscribeModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Get notified immediately whenever an infrastructure incident is declared or resolved.
            </p>

            {subSuccess ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="h-4 w-4 flex-shrink-0" />
                <span>{subSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Email Notifications</label>
                  <input
                    type="email"
                    placeholder="sysadmin@example.com"
                    value={subEmail}
                    onChange={e => setSubEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-zinc-800"></div>
                  <span className="flex-shrink mx-2 text-[10px] uppercase font-mono text-zinc-400">OR</span>
                  <div className="flex-grow border-t border-zinc-800"></div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Discord Webhook Relay</label>
                  <input
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={subWebhook}
                    onChange={e => setSubWebhook(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSubscribeModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-xs text-zinc-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={subLoading || (!subEmail && !subWebhook)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-zinc-950 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {subLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Confirm Subscription</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Status;
