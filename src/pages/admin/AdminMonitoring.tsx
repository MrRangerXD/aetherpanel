import React, { useState, useEffect } from 'react';
import {
  Activity, Server, Cpu, HardDrive, Bell, AlertTriangle, CheckCircle2,
  Clock, Plus, RefreshCw, Trash2, Edit3, Check, X, Shield, Radio,
  Send, ExternalLink, Calendar, Filter, Terminal, Wifi, ChevronDown, Layers
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import {
  Node, AlertRule, AlertIncident, Incident, ScheduledMaintenance,
  StatusComponent, TelemetryPoint
} from '../../types';
import TimeSeriesChart from '../../components/monitoring/TimeSeriesChart';

export const AdminMonitoring: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'nodes' | 'alerts' | 'incidents' | 'maintenance'>('overview');
  const [loading, setLoading] = useState(true);

  // Core Data
  const [nodes, setNodes] = useState<Node[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertIncidents, setAlertIncidents] = useState<AlertIncident[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [maintenances, setMaintenances] = useState<ScheduledMaintenance[]>([]);
  const [components, setComponents] = useState<StatusComponent[]>([]);

  // Node Telemetry Tab State
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [telemetryRange, setTelemetryRange] = useState<'1h' | '24h' | '7d' | '30d'>('1h');
  const [nodeTelemetry, setNodeTelemetry] = useState<TelemetryPoint[]>([]);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  // Modals
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<AlertRule> | null>(null);

  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    title: '',
    description: '',
    severity: 'minor' as 'minor' | 'major' | 'critical',
    status: 'investigating' as 'investigating' | 'identified' | 'monitoring' | 'resolved',
    affectedComponents: [] as string[],
    initialMessage: '',
    isPublic: true
  });

  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: '',
    description: '',
    affectedComponents: [] as string[],
    scheduledStartTime: '',
    scheduledEndTime: ''
  });

  // Timeline update modal
  const [selectedIncidentForUpdate, setSelectedIncidentForUpdate] = useState<Incident | null>(null);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'investigating' | 'identified' | 'monitoring' | 'resolved'>('monitoring');

  // Flash toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    const [overviewRes, rulesRes, incidentsRes] = await Promise.all([
      apiRequest('/status/admin/overview'),
      apiRequest('/monitoring/alerts/rules'),
      apiRequest('/monitoring/alerts/incidents')
    ]);

    if (overviewRes.success && overviewRes.data) {
      setComponents(overviewRes.data.components || []);
      setIncidents(overviewRes.data.incidents || []);
      setMaintenances(overviewRes.data.scheduledMaintenances || []);
      setNodes(overviewRes.data.nodes || []);
      if (overviewRes.data.nodes?.length > 0 && !selectedNodeId) {
        setSelectedNodeId(overviewRes.data.nodes[0].id);
      }
    }

    if (rulesRes.success && rulesRes.data) {
      setAlertRules(rulesRes.data);
    }

    if (incidentsRes.success && incidentsRes.data) {
      setAlertIncidents(incidentsRes.data);
    }

    setLoading(false);
  };

  const fetchNodeTelemetry = async (nodeId: string, range: string) => {
    if (!nodeId) return;
    setTelemetryLoading(true);
    const res = await apiRequest(`/monitoring/node/${nodeId}/history?range=${range}`);
    if (res.success && res.data?.history) {
      setNodeTelemetry(res.data.history);
    }
    setTelemetryLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedNodeId) {
      fetchNodeTelemetry(selectedNodeId, telemetryRange);
    }
  }, [selectedNodeId, telemetryRange]);

  // Alert Rule Actions
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule?.name || !editingRule?.metric) {
      showToast('error', 'Please fill required fields.');
      return;
    }

    const isEdit = !!editingRule.id;
    const url = isEdit ? `/monitoring/alerts/rules/${editingRule.id}` : '/monitoring/alerts/rules';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiRequest(url, {
      method,
      body: JSON.stringify(editingRule)
    });

    if (res.success) {
      showToast('success', `Alert rule ${isEdit ? 'updated' : 'created'}.`);
      setShowRuleModal(false);
      setEditingRule(null);
      fetchData();
    } else {
      showToast('error', res.error?.message || 'Failed to save alert rule.');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Delete this alert rule?')) return;
    const res = await apiRequest(`/monitoring/alerts/rules/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('success', 'Rule deleted.');
      fetchData();
    }
  };

  const handleTestAlert = async (ruleId?: string) => {
    const res = await apiRequest('/monitoring/alerts/test', {
      method: 'POST',
      body: JSON.stringify({
        ruleId,
        targetName: 'Node India (Delhi/Mumbai Cluster)',
        severity: 'warning',
        message: 'Simulated threshold test: CPU exceeded 92% sustained for >10 mins.'
      })
    });

    if (res.success) {
      showToast('success', 'Test alert triggered and logged to alert history.');
      fetchData();
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    const res = await apiRequest(`/monitoring/alerts/incidents/${alertId}/resolve`, { method: 'POST' });
    if (res.success) {
      showToast('success', 'Alert marked as resolved.');
      fetchData();
    }
  };

  // Incident Actions
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentForm.title || !incidentForm.description) {
      showToast('error', 'Title and description are required.');
      return;
    }

    const res = await apiRequest('/status/admin/incidents', {
      method: 'POST',
      body: JSON.stringify(incidentForm)
    });

    if (res.success) {
      showToast('success', 'Incident declared and published to status timeline.');
      setShowIncidentModal(false);
      setIncidentForm({
        title: '',
        description: '',
        severity: 'minor',
        status: 'investigating',
        affectedComponents: [],
        initialMessage: '',
        isPublic: true
      });
      fetchData();
    } else {
      showToast('error', res.error?.message || 'Failed to declare incident.');
    }
  };

  const handleAddTimelineUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentForUpdate || !updateMessage) return;

    const res = await apiRequest(`/status/admin/incidents/${selectedIncidentForUpdate.id}/timeline`, {
      method: 'POST',
      body: JSON.stringify({
        status: updateStatus,
        message: updateMessage
      })
    });

    if (res.success) {
      showToast('success', 'Incident timeline updated.');
      setSelectedIncidentForUpdate(null);
      setUpdateMessage('');
      fetchData();
    } else {
      showToast('error', res.error?.message || 'Failed to update timeline.');
    }
  };

  const handleDeleteIncident = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this incident?')) return;
    const res = await apiRequest(`/status/admin/incidents/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('success', 'Incident deleted.');
      fetchData();
    }
  };

  // Maintenance Actions
  const handleScheduleMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceForm.title || !maintenanceForm.scheduledStartTime || !maintenanceForm.scheduledEndTime) {
      showToast('error', 'Please fill required fields (Title, Start Time, End Time).');
      return;
    }

    const res = await apiRequest('/status/admin/maintenance', {
      method: 'POST',
      body: JSON.stringify(maintenanceForm)
    });

    if (res.success) {
      showToast('success', 'Maintenance scheduled.');
      setShowMaintenanceModal(false);
      setMaintenanceForm({
        title: '',
        description: '',
        affectedComponents: [],
        scheduledStartTime: '',
        scheduledEndTime: ''
      });
      fetchData();
    } else {
      showToast('error', res.error?.message || 'Failed to schedule maintenance.');
    }
  };

  const handleUpdateMaintenanceStatus = async (id: string, status: string) => {
    const res = await apiRequest(`/status/admin/maintenance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    if (res.success) {
      showToast('success', `Maintenance status updated to ${status}.`);
      fetchData();
    }
  };

  const handleDeleteMaintenance = async (id: string) => {
    if (!window.confirm('Delete this maintenance record?')) return;
    const res = await apiRequest(`/status/admin/maintenance/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('success', 'Maintenance deleted.');
      fetchData();
    }
  };

  // Calculations for overview
  const totalRamAllocatedMB = nodes.reduce((acc, n) => acc + (n.usedRamMB || 0), 0);
  const totalRamAvailableMB = nodes.reduce((acc, n) => acc + (n.totalRamMB || 0), 0);
  const totalDiskUsedGB = nodes.reduce((acc, n) => acc + (n.usedDiskGB || 0), 0);
  const totalDiskAvailableGB = nodes.reduce((acc, n) => acc + (n.totalDiskGB || 0), 0);
  const activeAlertsCount = alertIncidents.filter(a => a.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
          toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-amber-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Infrastructure Monitoring & Alerts</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Real-time cluster telemetry, alert triggers, incident management & public status sync.</p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/status"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
            <span>View Public /status</span>
          </a>

          <button
            onClick={() => handleTestAlert()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-medium transition-all"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Test Alert Trigger</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-800/80 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'overview'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Cluster Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('nodes')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'nodes'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Server className="h-4 w-4" />
          <span>Node Telemetry & Graphs</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'alerts'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>Alert Rules & Triggers</span>
          {activeAlertsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500 text-white font-bold">
              {activeAlertsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'incidents'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Incidents ({incidents.filter(i => i.status !== 'resolved').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'maintenance'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Scheduled Maintenance</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <span className="text-[11px] font-mono uppercase text-zinc-400">Compute Cluster Nodes</span>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold font-mono text-white">
                  {nodes.filter(n => n.status === 'online').length} / {nodes.length} Online
                </span>
                <Server className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">100% telemetry sync rate</span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <span className="text-[11px] font-mono uppercase text-zinc-400">Cluster RAM Allocation</span>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold font-mono text-white">
                  {(totalRamAllocatedMB / 1024).toFixed(1)} / {(totalRamAvailableMB / 1024).toFixed(1)} GB
                </span>
                <Cpu className="h-5 w-5 text-amber-400" />
              </div>
              <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.round((totalRamAllocatedMB / Math.max(1, totalRamAvailableMB)) * 100))}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <span className="text-[11px] font-mono uppercase text-zinc-400">Cluster NVMe Storage</span>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold font-mono text-white">
                  {totalDiskUsedGB} / {totalDiskAvailableGB} GB
                </span>
                <HardDrive className="h-5 w-5 text-sky-400" />
              </div>
              <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-sky-400 h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.round((totalDiskUsedGB / Math.max(1, totalDiskAvailableGB)) * 100))}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <span className="text-[11px] font-mono uppercase text-zinc-400">Active Alert Violations</span>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold font-mono text-white">
                  {activeAlertsCount} Unresolved
                </span>
                <Bell className={`h-5 w-5 ${activeAlertsCount > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">
                {activeAlertsCount > 0 ? 'Action required in Alerts tab' : 'All rule metrics within nominal bounds'}
              </span>
            </div>
          </div>

          {/* Nodes Quick Health Status Table */}
          <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight">Active Node Cluster Health & Daemon Telemetry</h3>
              <button
                onClick={() => setActiveTab('nodes')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                Inspect Telemetry Graphs →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-mono">
                    <th className="pb-3 font-semibold">Node Name & Location</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">RAM Usage</th>
                    <th className="pb-3 font-semibold">CPU Cores</th>
                    <th className="pb-3 font-semibold">Disk NVMe</th>
                    <th className="pb-3 font-semibold">Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {nodes.map(n => (
                    <tr key={n.id} className="hover:bg-zinc-850/50 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-white">{n.name}</div>
                        <div className="text-[11px] text-zinc-400 font-mono">{n.locationName} ({n.ip})</div>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          n.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${n.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <span className="capitalize">{n.status}</span>
                        </span>
                      </td>
                      <td className="py-3 font-mono text-zinc-300">
                        {n.usedRamMB} / {n.totalRamMB} MB ({Math.round(((n.usedRamMB || 0) / Math.max(1, n.totalRamMB || 1)) * 100)}%)
                      </td>
                      <td className="py-3 font-mono text-zinc-300">
                        {n.usedCpuCores || 0} / {n.totalCpuCores || 4} Cores
                      </td>
                      <td className="py-3 font-mono text-zinc-300">
                        {n.usedDiskGB || 0} / {n.totalDiskGB || 100} GB
                      </td>
                      <td className="py-3 font-mono text-zinc-400 text-[11px]">
                        {n.lastHeartbeatAt ? new Date(n.lastHeartbeatAt).toLocaleTimeString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NODE TELEMETRY & GRAPHS */}
      {activeTab === 'nodes' && (
        <div className="space-y-6">
          {/* Node & Range Selector Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-amber-400" />
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block">Select Node</label>
                <select
                  value={selectedNodeId}
                  onChange={e => setSelectedNodeId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-xs font-semibold text-white px-3 py-1.5 rounded-xl focus:outline-none focus:border-amber-500"
                >
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.name} — {n.locationName} ({n.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              {(['1h', '24h', '7d', '30d'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTelemetryRange(range)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                    telemetryRange === range
                      ? 'bg-amber-500 text-zinc-950 font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Time Series Telemetry Charts Grid */}
          {telemetryLoading ? (
            <div className="p-12 text-center text-xs text-zinc-400 bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
              <span>Streaming high-resolution node telemetry metrics...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TimeSeriesChart
                title="Compute Node CPU Utilization (%)"
                data={nodeTelemetry.map(p => ({ timestamp: p.timestamp, value: p.cpuPercent }))}
                unit="%"
                color="emerald"
                maxValue={100}
                height={160}
              />

              <TimeSeriesChart
                title="Node Memory RAM Allocation (MB)"
                data={nodeTelemetry.map(p => ({ timestamp: p.timestamp, value: p.usedRamMB }))}
                unit="MB"
                color="amber"
                height={160}
              />

              <TimeSeriesChart
                title="NVMe Storage Disk Capacity (%)"
                data={nodeTelemetry.map(p => ({ timestamp: p.timestamp, value: p.diskPercent }))}
                unit="%"
                color="sky"
                maxValue={100}
                height={160}
              />

              <TimeSeriesChart
                title="Network I/O Throughput (KB/s)"
                data={nodeTelemetry.map(p => ({ timestamp: p.timestamp, value: p.netOutKBps }))}
                unit="KB/s"
                color="purple"
                height={160}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ALERT RULES & TRIGGERS */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Configured Alert Rules</h3>
              <p className="text-xs text-zinc-400">Automated daemon threshold monitors & notification dispatchers.</p>
            </div>

            <button
              onClick={() => {
                setEditingRule({
                  name: '',
                  targetType: 'node',
                  targetId: 'all',
                  metric: 'cpu_high',
                  threshold: 90,
                  durationMinutes: 5,
                  cooldownMinutes: 15,
                  notificationChannel: 'all',
                  isEnabled: true
                });
                setShowRuleModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Alert Rule</span>
            </button>
          </div>

          {/* Active Alerts Banner */}
          {alertIncidents.filter(a => a.status === 'active').length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase text-rose-400 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Active Unresolved Threshold Violations
              </h4>

              {alertIncidents.filter(a => a.status === 'active').map(alert => (
                <div key={alert.id} className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{alert.ruleName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-mono bg-rose-500/20 text-rose-300 font-bold">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300">{alert.message}</p>
                    <span className="text-[10px] font-mono text-zinc-400 block">
                      Target: {alert.targetName} • Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => handleResolveAlert(alert.id)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold whitespace-nowrap"
                  >
                    Mark Resolved
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alertRules.map(rule => (
              <div key={rule.id} className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{rule.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                        rule.isEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {rule.isEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 block mt-0.5">
                      Target: {rule.targetType.toUpperCase()} ({rule.targetId})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setShowRuleModal(true);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-zinc-950 p-2.5 rounded-lg border border-zinc-850">
                  <div>
                    <span className="text-zinc-500 block">Threshold</span>
                    <span className="text-zinc-200 font-bold">{rule.threshold}%</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Duration</span>
                    <span className="text-zinc-200">{rule.durationMinutes} min</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Channel</span>
                    <span className="text-zinc-200 capitalize">{rule.notificationChannel}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-zinc-500 font-mono">Cooldown: {rule.cooldownMinutes}m</span>
                  <button
                    onClick={() => handleTestAlert(rule.id)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                  >
                    Simulate Rule Trigger →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: INCIDENTS MANAGEMENT */}
      {activeTab === 'incidents' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Incident Declarations & Timeline Sync</h3>
              <p className="text-xs text-zinc-400">Manage public timeline updates, root cause post-mortems, and resolution notes.</p>
            </div>

            <button
              onClick={() => setShowIncidentModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Declare New Incident</span>
            </button>
          </div>

          <div className="space-y-4">
            {incidents.map(inc => (
              <div key={inc.id} className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{inc.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                        inc.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {inc.status}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">
                        Severity: {inc.severity}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1">{inc.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedIncidentForUpdate(inc);
                        setUpdateStatus(inc.status === 'resolved' ? 'resolved' : 'monitoring');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold"
                    >
                      + Add Update
                    </button>
                    <button
                      onClick={() => handleDeleteIncident(inc.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Timeline display */}
                <div className="space-y-2 pl-2 border-l-2 border-zinc-800">
                  {inc.timeline.map((step, idx) => (
                    <div key={step.id || idx} className="text-xs space-y-0.5 pl-3 relative">
                      <span className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-amber-400" />
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white capitalize font-mono text-[11px]">{step.status}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(step.timestamp).toLocaleDateString()})
                        </span>
                      </div>
                      <p className="text-zinc-300">{step.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: SCHEDULED MAINTENANCE */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Scheduled Maintenance Windows</h3>
              <p className="text-xs text-zinc-400">Broadcast upcoming kernel upgrades, hardware servicing, and migration windows.</p>
            </div>

            <button
              onClick={() => setShowMaintenanceModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Maintenance</span>
            </button>
          </div>

          <div className="space-y-4">
            {maintenances.map(maint => (
              <div key={maint.id} className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{maint.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                        maint.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : maint.status === 'in_progress'
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {maint.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1">{maint.description}</p>
                    <div className="text-[11px] font-mono text-zinc-400 mt-2">
                      Window: {new Date(maint.scheduledStartTime).toUTCString()} — {new Date(maint.scheduledEndTime).toUTCString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {maint.status === 'scheduled' && (
                      <button
                        onClick={() => handleUpdateMaintenanceStatus(maint.id, 'in_progress')}
                        className="px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-xs font-semibold"
                      >
                        Start Now
                      </button>
                    )}
                    {maint.status === 'in_progress' && (
                      <button
                        onClick={() => handleUpdateMaintenanceStatus(maint.id, 'completed')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold"
                      >
                        Mark Completed
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMaintenance(maint.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE / EDIT ALERT RULE MODAL */}
      {showRuleModal && editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingRule.id ? 'Edit Alert Rule' : 'New Alert Rule'}
              </h3>
              <button onClick={() => setShowRuleModal(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. High Node CPU Alert (>90%)"
                  value={editingRule.name || ''}
                  onChange={e => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Target Type</label>
                  <select
                    value={editingRule.targetType || 'node'}
                    onChange={e => setEditingRule({ ...editingRule, targetType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="node">Compute Node</option>
                    <option value="server">Game / Bot Server</option>
                    <option value="api">API Gateway</option>
                    <option value="database">Database</option>
                    <option value="storage">Storage Subsystem</option>
                  </select>
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Metric Evaluated</label>
                  <select
                    value={editingRule.metric || 'cpu_high'}
                    onChange={e => setEditingRule({ ...editingRule, metric: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="cpu_high">CPU Load High</option>
                    <option value="ram_high">RAM Usage High</option>
                    <option value="disk_high">Disk Space High</option>
                    <option value="status_offline">Daemon Offline / Unreachable</option>
                    <option value="server_crashed">Server Crash / Exit Code Non-Zero</option>
                    <option value="api_latency">API Latency Spike</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Threshold (%)</label>
                  <input
                    type="number"
                    value={editingRule.threshold ?? 90}
                    onChange={e => setEditingRule({ ...editingRule, threshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    value={editingRule.durationMinutes ?? 5}
                    onChange={e => setEditingRule({ ...editingRule, durationMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Cooldown (Min)</label>
                  <input
                    type="number"
                    value={editingRule.cooldownMinutes ?? 15}
                    onChange={e => setEditingRule({ ...editingRule, cooldownMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Notification Channel</label>
                  <select
                    value={editingRule.notificationChannel || 'all'}
                    onChange={e => setEditingRule({ ...editingRule, notificationChannel: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Channels (Panel + Discord + Email)</option>
                    <option value="discord">Discord Webhook Only</option>
                    <option value="panel">Control Panel In-App Only</option>
                    <option value="email">Admin Email Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="ruleEnabled"
                    checked={editingRule.isEnabled !== false}
                    onChange={e => setEditingRule({ ...editingRule, isEnabled: e.target.checked })}
                    className="rounded text-amber-500"
                  />
                  <label htmlFor="ruleEnabled" className="text-zinc-300 font-semibold cursor-pointer">
                    Enable Rule Active Checking
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DECLARE INCIDENT MODAL */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Declare Infrastructure Incident</h3>
              <button onClick={() => setShowIncidentModal(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Incident Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elevated Latency on Node US Cluster"
                  value={incidentForm.title}
                  onChange={e => setIncidentForm({ ...incidentForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Severity</label>
                  <select
                    value={incidentForm.severity}
                    onChange={e => setIncidentForm({ ...incidentForm, severity: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="minor">Minor Degradation</option>
                    <option value="major">Major Outage</option>
                    <option value="critical">Critical System Impact</option>
                  </select>
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Initial Status</label>
                  <select
                    value={incidentForm.status}
                    onChange={e => setIncidentForm({ ...incidentForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="investigating">Investigating</option>
                    <option value="identified">Identified</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Incident Summary</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the issue, affected services, and mitigation steps currently underway..."
                  value={incidentForm.description}
                  onChange={e => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400"
                >
                  Declare Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TIMELINE UPDATE MODAL */}
      {selectedIncidentForUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Add Timeline Update</h3>
              <button onClick={() => setSelectedIncidentForUpdate(null)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddTimelineUpdate} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Update Status</label>
                <select
                  value={updateStatus}
                  onChange={e => setUpdateStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="investigating">Investigating</option>
                  <option value="identified">Identified</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="resolved">Resolved (Close Incident)</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Progress Message</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Traffic rerouted via secondary transit provider. Packet loss resolved."
                  value={updateMessage}
                  onChange={e => setUpdateMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIncidentForUpdate(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400"
                >
                  Publish Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE MAINTENANCE MODAL */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Schedule Maintenance Window</h3>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleScheduleMaintenance} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Maintenance Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Node India Hypervisor Patching"
                  value={maintenanceForm.title}
                  onChange={e => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Start Time (UTC/Local)</label>
                  <input
                    type="datetime-local"
                    required
                    value={maintenanceForm.scheduledStartTime}
                    onChange={e => setMaintenanceForm({ ...maintenanceForm, scheduledStartTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">End Time (UTC/Local)</label>
                  <input
                    type="datetime-local"
                    required
                    value={maintenanceForm.scheduledEndTime}
                    onChange={e => setMaintenanceForm({ ...maintenanceForm, scheduledEndTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Description & Expected Impact</label>
                <textarea
                  rows={3}
                  placeholder="Explain the scheduled maintenance, expected downtime if any, and recovery procedures..."
                  value={maintenanceForm.description}
                  onChange={e => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMonitoring;
