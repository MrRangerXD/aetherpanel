import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { AuditLog } from '../../types';
import { PanelScrollReveal } from '../../components/PanelScrollReveal';

export const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    const res = await apiRequest('/support/activity-logs');
    if (res.success && res.data) {
      setLogs(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <PanelScrollReveal delayMs={0}>
        <div className="border-b border-[var(--color-line)] pb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--color-accent)]" /> Account Security & Audit Trail
          </h1>
          <p className="text-xs text-[var(--color-ink-mute)] mt-1">Full history of authentication attempts, server commands, and configuration changes.</p>
        </div>
      </PanelScrollReveal>

      {loading ? (
        <div className="surface p-10 text-center rounded-lg text-xs text-[var(--color-ink-dim)] space-y-2">
          <RefreshCw className="h-5 w-5 animate-spin text-[var(--color-accent)] mx-auto" />
          <p>Loading security audit logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="surface p-10 text-center rounded-lg text-xs text-[var(--color-ink-mute)]">
          No audit logs recorded yet.
        </div>
      ) : (
        <PanelScrollReveal delayMs={40}>
          <div className="surface rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="surface-2 border-b border-[var(--color-line)] text-[var(--color-ink-mute)] label">
                <tr>
                  <th className="p-3">Action</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Details</th>
                  <th className="p-3">IP Address</th>
                  <th className="p-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)] stagger">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-[var(--color-surface-2)] transition-colors">
                    <td className="p-3 font-mono text-[var(--color-accent)] font-semibold">{l.action}</td>
                    <td className="p-3 font-medium text-[var(--color-ink)]">{l.targetResource}</td>
                    <td className="p-3 text-[var(--color-ink-dim)]">{l.details}</td>
                    <td className="p-3 font-mono text-[var(--color-ink-mute)]">{l.ipAddress || '127.0.0.1'}</td>
                    <td className="p-3 text-right text-[var(--color-ink-mute)] font-mono">{l.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelScrollReveal>
      )}

    </div>
  );
};
