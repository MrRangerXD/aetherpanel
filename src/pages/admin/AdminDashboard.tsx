import React, { useState, useEffect } from 'react';
import { Sliders, Users, Server, HardDrive, DollarSign, TrendingUp, ShieldAlert, Cpu, Activity, ShoppingBag } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    const res = await apiRequest('/admin/stats');
    if (res.success && res.data) {
      setStats(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-zinc-400 space-y-2">
        <Activity className="h-6 w-6 animate-spin text-amber-400 mx-auto" />
        <p>Loading platform metrics...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="border-b border-amber-500/20 pb-5">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <ShieldAlert className="h-4 w-4" /> Platform Control Plane
        </div>
        <h1 className="text-2xl font-bold text-white">System Infrastructure Overview</h1>
        <p className="text-xs text-zinc-400 mt-1">Real-time status of compute nodes, running server containers, user accounts, and billing throughput.</p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Total Registered Users</span>
            <Users className="h-4 w-4 text-violet-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{stats?.users?.total ?? 0}</div>
          <span className="text-[10px] text-zinc-400 font-mono">{stats?.users?.active ?? 0} active accounts</span>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Total Containers</span>
            <Server className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{stats?.servers?.total ?? 0}</div>
          <span className="text-[10px] text-emerald-400 font-semibold">{stats?.servers?.running ?? 0} running</span>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Compute Nodes</span>
            <HardDrive className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{stats?.nodes?.total ?? 0}</div>
          <span className="text-[10px] text-zinc-400 font-mono">{stats?.nodes?.online ?? 0} online</span>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Total Revenue</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">${(stats?.revenue?.total ?? 0).toFixed(2)}</div>
          <span className="text-[10px] text-zinc-400 font-mono">{stats?.revenue?.ordersCount ?? 0} orders processed</span>
        </div>
      </div>

      {/* Quick Admin Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div
          onClick={() => onNavigate('admin-users')}
          className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 cursor-pointer transition-all space-y-2 group"
        >
          <Users className="h-6 w-6 text-violet-400 group-hover:scale-110 transition-transform" />
          <h3 className="text-base font-bold text-white">User Account Directory</h3>
          <p className="text-xs text-zinc-400">Manage user roles, grant account credits, suspend accounts.</p>
        </div>

        <div
          onClick={() => onNavigate('admin-servers')}
          className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 cursor-pointer transition-all space-y-2 group"
        >
          <Server className="h-6 w-6 text-cyan-400 group-hover:scale-110 transition-transform" />
          <h3 className="text-base font-bold text-white">Container Control Center</h3>
          <p className="text-xs text-zinc-400">Power action overrides, resource reallocation, server deletion.</p>
        </div>

        <div
          onClick={() => onNavigate('admin-nodes')}
          className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 cursor-pointer transition-all space-y-2 group"
        >
          <HardDrive className="h-6 w-6 text-emerald-400 group-hover:scale-110 transition-transform" />
          <h3 className="text-base font-bold text-white">Compute Node Cluster</h3>
          <p className="text-xs text-zinc-400">Monitor CPU/RAM node load, set maintenance mode.</p>
        </div>
      </div>

    </div>
  );
};
