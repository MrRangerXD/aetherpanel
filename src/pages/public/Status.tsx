import React, { useEffect, useState } from 'react';
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Server,
  Cpu, Bell, Shield, Clock,
  ChevronDown, ChevronRight, Wifi, Send, Check,
  Calendar, AlertOctagon, X
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
  const [autoRefresh] = useState(true);
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
        return 'text-[var(--color-ok)] bg-[var(--color-ok)]/10 border-[var(--color-ok)]/30';
      case 'degraded':
        return 'text-[var(--color-warn)] bg-[var(--color-warn)]/10 border-[var(--color-warn)]/30';
      case 'partial_outage':
      case 'major_outage':
        return 'text-[var(--color-err)] bg-[var(--color-err)]/10 border-[var(--color-err)]/30';
      case 'maintenance':
        return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30';
      default:
        return 'text-[var(--color-ink-dim)] surface-2 border-[var(--color-line)]';
    }
  };

  const getStatusIcon = (status: StatusComponentState) => {
    switch (status) {
      case 'operational':
        return <CheckCircle2 className="h-4 w-4 text-[var(--color-ok)]" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-[var(--color-warn)]" />;
      case 'partial_outage':
        return <AlertOctagon className="h-4 w-4 text-[var(--color-err)]" />;
      case 'major_outage':
        return <XCircle className="h-4 w-4 text-[var(--color-err)]" />;
      case 'maintenance':
        return <Clock className="h-4 w-4 text-[var(--color-accent)]" />;
      default:
        return <Activity className="h-4 w-4 text-[var(--color-ink-mute)]" />;
    }
  };

  const getDayColor = (state: StatusComponentState) => {
    switch (state) {
      case 'operational':
        return 'bg-[var(--color-ok)] hover:opacity-80';
      case 'degraded':
        return 'bg-[var(--color-warn)] hover:opacity-80';
      case 'partial_outage':
      case 'major_outage':
        return 'bg-[var(--color-err)] hover:opacity-80';
      case 'maintenance':
        return 'bg-[var(--color-accent)] hover:opacity-80';
      default:
        return 'bg-[var(--color-line)]';
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
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[var(--color-line)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md surface-2 border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)]">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--color-ink)] tracking-tight">System Status</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-[var(--color-ok)]/10 text-[var(--color-ok)] border border-[var(--color-ok)]/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)] animate-pulse" /> Live Pulse
                </span>
              </div>
              <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">Real-time infrastructure health and uptime verification.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setShowSubscribeModal(true)}
              className="btn btn-ghost text-xs py-1.5"
            >
              <Bell className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span>Subscribe to Alerts</span>
            </button>

            <button
              onClick={() => fetchStatus(true)}
              disabled={loading}
              className="btn btn-ghost text-xs py-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[var(--color-accent)]' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Hero Overall Status Banner */}
        <div className="surface p-5 rounded-lg border border-[var(--color-line)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-md surface-2 border border-[var(--color-line)] flex items-center justify-center">
              {data ? getStatusIcon(data.overallStatus) : <Activity className="h-5 w-5 text-[var(--color-ink-mute)]" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-ink)] tracking-tight">
                {data?.overallStatusMessage || 'Connecting to Telemetry...'}
              </h2>
              <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">
                Last checked: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'Checking...'} (Auto-refreshes every 30s)
              </p>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-md surface-2 border border-[var(--color-line)] text-right">
            <span className="label block">90-Day SLA Uptime</span>
            <span className="text-sm font-bold font-mono text-[var(--color-ok)]">{data?.avgSla || '99.99%'}</span>
          </div>
        </div>

        {/* Scheduled Maintenance Announcement */}
        {data?.scheduledMaintenances && data.scheduledMaintenances.length > 0 && (
          <div className="space-y-2.5">
            {data.scheduledMaintenances.map(maint => (
              <div key={maint.id} className="surface p-4 rounded-lg border border-[var(--color-accent)]/30 flex items-start gap-3">
                <div className="p-1.5 rounded-md surface-2 text-[var(--color-accent)] mt-0.5 border border-[var(--color-line)]">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--color-ink)]">{maint.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
                      {maint.status === 'in_progress' ? 'Active' : 'Scheduled'}
                    </span>
                  </div>
                  <p className="text-[var(--color-ink-dim)] mt-1">{maint.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[var(--color-ink-mute)] mt-1.5 font-mono text-[11px]">
                    <span>Window: {new Date(maint.scheduledStartTime).toUTCString()} — {new Date(maint.scheduledEndTime).toUTCString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active Incidents Banner */}
        {data?.activeIncidents && data.activeIncidents.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="label flex items-center gap-1.5 text-[var(--color-warn)]">
              <AlertTriangle className="h-3.5 w-3.5" /> Active Incidents
            </h3>
            {data.activeIncidents.map(inc => (
              <div key={inc.id} className="surface p-4 rounded-lg border border-[var(--color-warn)]/40 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-ink)]">{inc.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-[var(--color-warn)]/10 text-[var(--color-warn)] border border-[var(--color-warn)]/30 font-medium">
                        {inc.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-ink-dim)] mt-0.5">{inc.description}</p>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--color-ink-mute)] whitespace-nowrap">
                    Started {new Date(inc.startedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[var(--color-line)]">
                  {inc.timeline.map((item, idx) => (
                    <div key={item.id || idx} className="text-xs flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warn)] mt-1.5 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--color-ink)] capitalize">{item.status}</span>
                          <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[var(--color-ink-dim)] mt-0.5">{item.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cluster Metrics */}
        {data?.systemMetrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
            <div className="surface p-3.5 rounded-lg">
              <span className="label block">Compute Nodes</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Server className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span className="text-sm font-bold font-mono text-[var(--color-ink)]">
                  {data.systemMetrics.onlineComputeNodes} / {data.systemMetrics.totalComputeNodes} Online
                </span>
              </div>
            </div>

            <div className="surface p-3.5 rounded-lg">
              <span className="label block">Running Servers</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Cpu className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span className="text-sm font-bold font-mono text-[var(--color-ink)]">
                  {data.systemMetrics.runningServers} Instances
                </span>
              </div>
            </div>

            <div className="surface p-3.5 rounded-lg">
              <span className="label block">Cluster Latency</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Wifi className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span className="text-sm font-bold font-mono text-[var(--color-ink)]">
                  ~{data.systemMetrics.avgLatencyMs} ms
                </span>
              </div>
            </div>

            <div className="surface p-3.5 rounded-lg">
              <span className="label block">Security Status</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Shield className="h-3.5 w-3.5 text-[var(--color-ok)]" />
                <span className="text-sm font-bold font-mono text-[var(--color-ok)]">Nominal</span>
              </div>
            </div>
          </div>
        )}

        {/* Infrastructure Components */}
        <div className="space-y-6">
          {Object.entries(componentsByGroup).map(([groupName, groupComponents]) => (
            <div key={groupName} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="label">
                  {groupName}
                </h3>
                <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">90 Days Ago — Today</span>
              </div>

              <div className="space-y-2">
                {groupComponents.map(comp => (
                  <div
                    key={comp.id}
                    className="surface p-3.5 rounded-lg border border-[var(--color-line)] space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--color-ink)]">{comp.name}</span>
                          {comp.latencyMs !== undefined && (
                            <span className="px-1.5 py-0.2 rounded surface-2 border border-[var(--color-line)] text-[10px] font-mono text-[var(--color-ink-dim)]">
                              {comp.latencyMs}ms
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-mute)] mt-0.5">{comp.details || comp.description}</p>
                      </div>

                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${getStatusColor(comp.status)}`}>
                          {getStatusIcon(comp.status)}
                          <span className="capitalize">{comp.status.replace('_', ' ')}</span>
                        </span>
                      </div>
                    </div>

                    {/* 90-Day Uptime Graph Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center gap-[2px] h-6 w-full overflow-hidden rounded-[4px] surface-2 p-1 border border-[var(--color-line)]">
                        {comp.history90Days && comp.history90Days.length > 0 ? (
                          comp.history90Days.map((day, idx) => (
                            <div
                              key={day.date || idx}
                              onMouseEnter={() => setHoveredDay({ compId: comp.id, day })}
                              onMouseLeave={() => setHoveredDay(null)}
                              className={`flex-1 h-full rounded-[1px] cursor-pointer ${getDayColor(day.status)}`}
                              title={`${day.date}: ${day.status} (${day.uptimePercent}%)`}
                            />
                          ))
                        ) : (
                          <div className="w-full text-center text-[10px] text-[var(--color-ink-mute)] py-0.5">Telemetry loading...</div>
                        )}
                      </div>

                      {hoveredDay && hoveredDay.compId === comp.id && (
                        <div className="p-1 rounded surface-2 border border-[var(--color-line)] text-center text-[10px] font-mono text-[var(--color-ink-dim)]">
                          <span>{hoveredDay.day.date}</span>: <span className="capitalize text-[var(--color-ok)]">{hoveredDay.day.status}</span> ({hoveredDay.day.uptimePercent}% availability)
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
        <div className="space-y-3 pt-5 border-t border-[var(--color-line)]">
          <div className="flex items-center justify-between">
            <h3 className="label">
              Past Incidents & Maintenance
            </h3>
            <span className="text-[11px] text-[var(--color-ink-mute)] font-mono">Past 90 days</span>
          </div>

          {data?.pastIncidents && data.pastIncidents.length > 0 ? (
            <div className="space-y-2">
              {data.pastIncidents.map(inc => {
                const isExpanded = !!expandedIncidents[inc.id];
                return (
                  <div key={inc.id} className="surface p-3.5 rounded-lg border border-[var(--color-line)] space-y-1.5">
                    <div
                      onClick={() => toggleIncident(inc.id)}
                      className="flex items-start justify-between gap-2 cursor-pointer select-none"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors">
                            {inc.title}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--color-ok)]/10 text-[var(--color-ok)] border border-[var(--color-ok)]/30">
                            Resolved
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--color-ink-mute)] font-mono block mt-0.5">
                          {new Date(inc.startedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] p-0.5">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </div>
                    </div>

                    <p className="text-xs text-[var(--color-ink-dim)]">{inc.description}</p>

                    {isExpanded && (
                      <div className="space-y-1.5 pt-2 border-t border-[var(--color-line)]">
                        <span className="label block">Timeline</span>
                        {inc.timeline.map((item, idx) => (
                          <div key={item.id || idx} className="text-xs flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)] mt-1.5 shrink-0" />
                            <div>
                              <span className="text-[var(--color-ink-mute)] font-mono text-[10px]">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} —{' '}
                              </span>
                              <span className="text-[var(--color-ink-dim)]">{item.message}</span>
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
            <div className="surface p-6 rounded-lg text-center">
              <CheckCircle2 className="h-5 w-5 text-[var(--color-ok)] mx-auto mb-1.5" />
              <p className="text-xs text-[var(--color-ink-dim)]">No incidents reported in the past 90 days. All systems operational.</p>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center pt-6 pb-2 text-xs text-[var(--color-ink-mute)] space-y-0.5">
          <p>Real-Time Health Engine • Monitored via direct daemon telemetry.</p>
        </div>

      </div>

      {/* Subscribe Modal */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 anim-fade-in">
          <div className="w-full max-w-sm rounded-lg surface border border-[var(--color-line)] p-5 space-y-3 anim-scale-in">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2.5">
              <div className="flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-[var(--color-accent)]" />
                <h3 className="text-xs font-semibold text-[var(--color-ink)]">Subscribe to Status Alerts</h3>
              </div>
              <button
                onClick={() => setShowSubscribeModal(false)}
                className="btn-icon"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[var(--color-ink-mute)]">
              Receive updates when infrastructure incidents are declared or resolved.
            </p>

            {subSuccess ? (
              <div className="p-2.5 rounded-md bg-[var(--color-ok)]/10 border border-[var(--color-ok)]/30 text-[var(--color-ok)] text-xs flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>{subSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2.5">
                <div>
                  <label className="label block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="sysadmin@example.com"
                    value={subEmail}
                    onChange={e => setSubEmail(e.target.value)}
                    className="field w-full px-2.5 py-1.5 text-xs rounded-md"
                  />
                </div>

                <div>
                  <label className="label block mb-1">Discord Webhook</label>
                  <input
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={subWebhook}
                    onChange={e => setSubWebhook(e.target.value)}
                    className="field w-full px-2.5 py-1.5 text-xs rounded-md"
                  />
                </div>

                <div className="flex justify-end gap-1.5 pt-1 border-t border-[var(--color-line)]">
                  <button
                    type="button"
                    onClick={() => setShowSubscribeModal(false)}
                    className="btn btn-ghost text-xs py-1.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={subLoading || (!subEmail && !subWebhook)}
                    className="btn btn-primary text-xs py-1.5 flex items-center gap-1"
                  >
                    {subLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    <span>Confirm</span>
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
