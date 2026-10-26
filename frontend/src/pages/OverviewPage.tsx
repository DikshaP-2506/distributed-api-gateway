import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Gauge,
  Server,
  Zap,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { BackendServer, GatewayMetrics, HealthTransitionEvent } from '../types/index.js';
import { MetricCard } from '../components/MetricCard.js';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface OverviewPageProps {
  metrics: GatewayMetrics | null;
  servers: BackendServer[];
  healthEvents: HealthTransitionEvent[];
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  metrics,
  servers,
  healthEvents
}) => {
  const healthyCount = servers.filter((s) => s.status === 'HEALTHY' && s.enabled).length;
  const totalServers = servers.length;

  const totalReq = metrics?.totalRequests || 0;
  const succReq = metrics?.successfulRequests || 0;
  const successRate = totalReq > 0 ? ((succReq / totalReq) * 100).toFixed(1) : '100.0';

  // Server distribution data for charts
  const distributionData = servers.map((s) => ({
    name: s.id,
    requests: s.totalRequests,
    active: s.activeRequests,
    weight: s.weight,
    status: s.status
  }));

  const COLORS = ['#38bdf8', '#34d399', '#a78bfa', '#f472b6', '#fbbf24'];

  const latencyData = [
    { name: 'Avg', latency: metrics?.avgLatencyMs || 0 },
    { name: 'P50', latency: metrics?.p50LatencyMs || 0 },
    { name: 'P95', latency: metrics?.p95LatencyMs || 0 },
    { name: 'P99', latency: metrics?.p99LatencyMs || 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / System Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">System Overview</h2>
          <p className="text-xs text-slate-400">Real-time status of the distributed gateway cluster</p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400">Cluster Status:</span>
          <span
            className={`px-2.5 py-0.5 rounded-full font-medium ${
              healthyCount === totalServers
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : healthyCount > 0
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {healthyCount === totalServers ? 'Fully Healthy' : healthyCount > 0 ? 'Degraded' : 'All Down'}
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="TOTAL REQUESTS"
          value={metrics?.totalRequests.toLocaleString() || '0'}
          subValue={`${metrics?.requestsPerSecond || 0} req/s`}
          icon={Activity}
          color="sky"
        />
        <MetricCard
          title="SUCCESS RATE"
          value={`${successRate}%`}
          subValue={`${succReq} ok / ${metrics?.failedRequests || 0} err`}
          icon={CheckCircle2}
          color="emerald"
        />
        <MetricCard
          title="AVG / P95 LATENCY"
          value={`${metrics?.avgLatencyMs || 0} ms`}
          subValue={`P95: ${metrics?.p95LatencyMs || 0} ms`}
          icon={Clock}
          color="indigo"
        />
        <MetricCard
          title="ACTIVE / HEALTHY"
          value={`${metrics?.activeRequests || 0} active`}
          subValue={`${healthyCount}/${totalServers} nodes online`}
          icon={Server}
          color={healthyCount === totalServers ? 'emerald' : 'amber'}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Distribution Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Request Distribution by Node</h3>
              <p className="text-xs text-slate-400">Total requests forwarded to each backend instance</p>
            </div>
            <span className="text-xs font-mono text-slate-500">Live</span>
          </div>

          <div className="h-64">
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
                    {distributionData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-500">
                No server data available
              </div>
            )}
          </div>
        </div>

        {/* Latency Percentiles Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Latency Percentiles (ms)</h3>
              <p className="text-xs text-slate-400">Rolling window latency profile (Avg, P50, P95, P99)</p>
            </div>
            <span className="text-xs font-mono text-slate-500">Rolling Buffer</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                />
                <Bar dataKey="latency" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Server Mini-Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Backend Nodes Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {servers.map((server) => {
            const isHealthy = server.status === 'HEALTHY' && server.enabled;
            const isDegraded = server.status === 'RECOVERING';
            return (
              <div
                key={server.id}
                className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sm text-slate-100">{server.id}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                        isHealthy
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isDegraded
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {server.status}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Weight: {server.weight}</span>
                </div>

                <div className="text-xs text-slate-400 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>Active:</span>
                    <span className="text-slate-200">{server.activeRequests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Processed:</span>
                    <span className="text-slate-200">{server.totalRequests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Endpoint:</span>
                    <span className="text-slate-400 truncate max-w-[150px]">{server.url}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Health Events Ticker */}
      {healthEvents.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">Recent Health & Fault Transitions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-slate-400 border-b border-slate-800 uppercase font-mono">
                <tr>
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Server</th>
                  <th className="py-2 px-3">Transition</th>
                  <th className="py-2 px-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {healthEvents.slice(0, 5).map((evt, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-2 px-3 text-slate-400">{new Date(evt.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 px-3 font-semibold text-sky-400">{evt.backendId}</td>
                    <td className="py-2 px-3">
                      <span className="text-slate-400">{evt.previousState}</span>
                      <span className="text-slate-600 mx-1.5">→</span>
                      <span
                        className={
                          evt.currentState === 'HEALTHY'
                            ? 'text-emerald-400 font-bold'
                            : 'text-rose-400 font-bold'
                        }
                      >
                        {evt.currentState}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300 truncate max-w-xs">{evt.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
