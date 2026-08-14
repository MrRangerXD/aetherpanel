import React, { useState, useEffect } from 'react';
import { Activity, Shield, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { AuditLog } from '../../types';

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="h-6 w-6 text-violet-400" /> Account Security & Audit Trail
        </h1>
        <p className="text-xs text-zinc-400 mt-1">Full immutable history of authentication attempts, server commands, and configuration changes.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400 space-y-2">
          <RefreshCw className="h-6 w-6 animate-spin text-violet-400 mx-auto" />
          <p>Loading security audit logs...</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Resource / Target</th>
                <th className="p-3.5">Details</th>
                <th className="p-3.5">IP Address</th>
                <th className="p-3.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-900 transition-colors">
                  <td className="p-3.5 font-mono text-violet-400 font-semibold">{l.action}</td>
                  <td className="p-3.5 font-semibold text-white">{l.targetResource}</td>
                  <td className="p-3.5 text-zinc-300">{l.details}</td>
                  <td className="p-3.5 font-mono text-zinc-400">{l.ipAddress || '127.0.0.1'}</td>
                  <td className="p-3.5 text-right text-zinc-500 font-mono">{l.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
