import React, { useState, useEffect } from 'react';
import {
  History,
  Download,
  BarChart2,
  RefreshCw,
  Clock,
  Zap,
  TrendingUp
} from 'lucide-react';
import { ExperimentRun } from '../types/index.js';
import { fetchExperiments } from '../services/api.js';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';

export const ExperimentHistoryPage: React.FC = () => {
  const [experiments, setExperiments] = useState<ExperimentRun[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchExperiments();
      setExperiments(data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportCsv = () => {
    if (experiments.length === 0) return;

    const headers = [
      'ID',
      'ExperimentName',
      'Algorithm',
      'TotalRequests',
      'Concurrency',
      'SuccessCount',
      'FailureCount',
      'AverageLatencyMs',
      'P50LatencyMs',
      'P95LatencyMs',
      'ThroughputRps',
      'Distribution',
      'StartedAt',
      'CompletedAt'
    ];

    const rows = experiments.map((e) => [
      e.id || '',
      `"${e.experimentName.replace(/"/g, '""')}"`,
      e.algorithm,
      e.totalRequests,
      e.concurrency,
      e.successCount,
      e.failureCount,
      e.averageLatencyMs,
      e.p50LatencyMs,
      e.p95LatencyMs,
      e.throughputRps,
      `"${JSON.stringify(e.distribution).replace(/"/g, '""')}"`,
      e.startedAt,
      e.completedAt
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gateway_experiments_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare chart comparison data (take recent 8 runs)
  const chartData = [...experiments]
    .reverse()
    .slice(-8)
    .map((e) => ({
      name: `${e.algorithm.slice(0, 4)} (#${e.id || 0})`,
      throughput: e.throughputRps,
      p95Latency: e.p95LatencyMs,
      fullAlgo: e.algorithm
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Experiment History & Comparative Benchmarks</h2>
          <p className="text-xs text-slate-400">
            Historical benchmark runs persisted in SQLite with comparative performance analysis
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCsv}
            disabled={experiments.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Export to CSV</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh History"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Comparison Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Throughput comparison */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Throughput Comparison (req/sec)</h3>
            <p className="text-xs text-slate-400 mb-4">Higher is better under identical workloads</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="throughput" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* P95 Latency comparison */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">P95 Latency Comparison (ms)</h3>
            <p className="text-xs text-slate-400 mb-4">Lower is better for predictable tail performance</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="p95Latency" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Runs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Completed Runs Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300 font-mono">
            <thead className="text-slate-400 border-b border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Run ID</th>
                <th className="py-2.5 px-3">Experiment Name</th>
                <th className="py-2.5 px-3">Algorithm</th>
                <th className="py-2.5 px-3">Requests</th>
                <th className="py-2.5 px-3">Concurrency</th>
                <th className="py-2.5 px-3">Throughput</th>
                <th className="py-2.5 px-3">Avg Latency</th>
                <th className="py-2.5 px-3">P95 Latency</th>
                <th className="py-2.5 px-3">Distribution</th>
                <th className="py-2.5 px-3">Completed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {experiments.length > 0 ? (
                experiments.map((exp, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 text-slate-500">#{exp.id}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">{exp.experimentName}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px]">
                        {exp.algorithm}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">{exp.totalRequests}</td>
                    <td className="py-2.5 px-3 text-slate-300">{exp.concurrency}</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-400">{exp.throughputRps} rps</td>
                    <td className="py-2.5 px-3 text-slate-200">{exp.averageLatencyMs} ms</td>
                    <td className="py-2.5 px-3 text-indigo-400">{exp.p95LatencyMs} ms</td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-[140px]" title={JSON.stringify(exp.distribution)}>
                      {JSON.stringify(exp.distribution)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(exp.completedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No experiment history found yet. Launch an experiment from the Experiment Lab tab to view results and comparative charts here!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
