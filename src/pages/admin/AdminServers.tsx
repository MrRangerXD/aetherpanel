import React, { useState, useEffect } from 'react';
import { Server as ServerIcon, Search, Play, Square, RotateCw, Trash2, Edit, Cpu, Activity, HardDrive } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server } from '../../types';

export const AdminServers: React.FC = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAllServers = async () => {
    const res = await apiRequest('/admin/servers');
    if (res.success && res.data) {
      setServers(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllServers();
  }, []);

  const handlePower = async (serverId: string, action: 'start' | 'stop' | 'restart') => {
    await apiRequest(`/servers/${serverId}/power`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    fetchAllServers();
  };

  const handleDeleteServer = async (serverId: string) => {
    if (confirm('Are you sure you want to forcibly delete this server container?')) {
      await apiRequest(`/admin/servers/${serverId}`, { method: 'DELETE' });
      fetchAllServers();
    }
  };

  const filtered = servers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.primaryIp.toLowerCase().includes(search.toLowerCase()) ||
    s.software.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ServerIcon className="h-6 w-6 text-amber-400" /> Platform Containers Inventory
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Full system-wide inventory of customer server instances.</p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search servers across platform..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading server containers...</div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="p-3.5">Server Name</th>
                <th className="p-3.5">Software / Version</th>
                <th className="p-3.5">Primary IP:Port</th>
                <th className="p-3.5">Node Location</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Power / Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((s) => {
                const isRunning = s.status === 'running';

                return (
                  <tr key={s.id} className="hover:bg-zinc-900 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-white">{s.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">ID: {s.id}</div>
                    </td>

                    <td className="p-3.5 font-mono text-zinc-300">
                      {s.software} ({s.version})
                    </td>

                    <td className="p-3.5 font-mono text-violet-400">
                      {s.primaryIp}:{s.primaryPort}
                    </td>

                    <td className="p-3.5 font-mono text-zinc-400">{s.location}</td>

                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border capitalize ${
                        isRunning ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {s.status}
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isRunning ? (
                          <button
                            onClick={() => handlePower(s.id, 'start')}
                            className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handlePower(s.id, 'restart')}
                              className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white"
                            >
                              <RotateCw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handlePower(s.id, 'stop')}
                              className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white"
                            >
                              <Square className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteServer(s.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
