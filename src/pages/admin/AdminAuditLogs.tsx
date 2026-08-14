import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { AuditLog } from '../../types';

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    const res = await apiRequest('/admin/audit-logs');
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
      <div className="border-b border-amber-500/20 pb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-amber-400" /> Platform Security Audit Trail
        </h1>
        <p className="text-xs text-zinc-400 mt-1">Immutable global audit history across all administrative and user operations.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading audit trail...</div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="p-3.5">Actor</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Target</th>
                <th className="p-3.5">Details</th>
                <th className="p-3.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-900 transition-colors">
                  <td className="p-3.5 font-semibold text-white">{l.actorEmail}</td>
                  <td className="p-3.5 font-mono text-amber-400 font-semibold">{l.action}</td>
                  <td className="p-3.5 text-zinc-300 font-mono">{l.targetResource}</td>
                  <td className="p-3.5 text-zinc-400">{l.details}</td>
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
