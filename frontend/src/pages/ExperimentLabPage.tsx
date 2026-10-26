import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  Square,
  BarChart2,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge,
  Layers
} from 'lucide-react';
import { AlgorithmType, ExperimentRun } from '../types/index.js';
import { runExperiment, abortExperiment } from '../services/api.js';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';

interface ExperimentLabPageProps {
  currentAlgorithm: AlgorithmType;
  experimentProgress: { completed: number; total: number; percent: number } | null;
  onExperimentComplete: () => void;
}

export const ExperimentLabPage: React.FC<ExperimentLabPageProps> = ({
  currentAlgorithm,
  experimentProgress,
  onExperimentComplete
}) => {
  const [algo, setAlgo] = useState<AlgorithmType>(currentAlgorithm);
  const [totalRequests, setTotalRequests] = useState<number>(100);
  const [concurrency, setConcurrency] = useState<number>(10);
  const [workDuration, setWorkDuration] = useState<number>(20);
  const [experimentName, setExperimentName] = useState<string>('Standard Workload Test');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<ExperimentRun | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStartExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setErrorMsg(null);

    try {
      const result = await runExperiment({
        experimentName,
        algorithm: algo,
        totalRequests,
        concurrency,
        endpoint: `/api/proxy/work?duration=${workDuration}`,
        workDuration
      });

      setLastResult(result);
      onExperimentComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Experiment run failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleAbort = async () => {
    try {
      await abortExperiment();
    } catch {}
  };

  const distributionChartData = lastResult
    ? Object.entries(lastResult.distribution).map(([name, count]) => ({
        name,
        requests: count
      }))
    : [];

  const COLORS = ['#38bdf8', '#34d399', '#a78bfa', '#f472b6'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Experiment & Load Testing Lab</h2>
          <p className="text-xs text-slate-400">
            Generate actual concurrent traffic to scientifically measure throughput, latency, and fault handling
          </p>
        </div>
      </div>

      {/* Experiment Setup Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <form onSubmit={handleStartExperiment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Experiment Name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Experiment Name</label>
              <input
                type="text"
                value={experimentName}
                onChange={(e) => setExperimentName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Algorithm Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Load Balancing Algorithm</label>
              <select
                value={algo}
                onChange={(e) => setAlgo(e.target.value as AlgorithmType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="round-robin">Round Robin</option>
                <option value="weighted-round-robin">Weighted Round Robin</option>
                <option value="least-connections">Least Connections</option>
                <option value="adaptive">Adaptive Load Balancing</option>
              </select>
            </div>

            {/* Total Requests */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Total Requests (10 - 2000)</label>
              <input
                type="number"
                min="10"
                max="2000"
                value={totalRequests}
                onChange={(e) => setTotalRequests(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Concurrency */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Concurrency (1 - 30)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Backend Work Duration */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Simulated Work Delay (ms)</label>
              <input
                type="number"
                min="0"
                max="2000"
                value={workDuration}
                onChange={(e) => setWorkDuration(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-end space-x-2">
              <button
                type="submit"
                disabled={isRunning}
                className="flex-1 py-2 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isRunning ? 'Running...' : 'Run Experiment'}</span>
              </button>

              {isRunning && (
                <button
                  type="button"
                  onClick={handleAbort}
                  className="py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium flex items-center justify-center transition"
                  title="Abort Experiment"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Live Progress Bar */}
        {(isRunning || experimentProgress) && (
          <div className="mt-5 p-4 rounded-lg bg-slate-950 border border-sky-500/30 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-sky-400 font-semibold">Generating & executing live HTTP requests...</span>
              <span className="text-slate-300">
                {experimentProgress ? `${experimentProgress.completed} / ${experimentProgress.total} (${experimentProgress.percent}%)` : 'Initializing...'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-150"
                style={{ width: `${experimentProgress?.percent || 5}%` }}
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Measured Results Section */}
      {lastResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs font-mono text-sky-400 uppercase tracking-wider">Experiment Results</span>
              <h3 className="text-lg font-bold text-slate-100">{lastResult.experimentName}</h3>
              <p className="text-xs text-slate-400 font-mono">
                Algorithm: <strong className="text-slate-200">{lastResult.algorithm}</strong> | Total:{' '}
                {lastResult.totalRequests} | Concurrency: {lastResult.concurrency}
              </p>
            </div>
            <div className="text-right font-mono text-xs text-slate-400">
              <span>Completed at: {new Date(lastResult.completedAt).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Results KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block mb-1">Throughput</span>
              <span className="text-2xl font-bold text-sky-400">{lastResult.throughputRps}</span>
              <span className="text-xs text-slate-500 ml-1">req/sec</span>
            </div>

            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block mb-1">Success / Fail</span>
              <span className="text-2xl font-bold text-emerald-400">{lastResult.successCount}</span>
              <span className="text-xs text-rose-400 ml-2">/ {lastResult.failureCount} err</span>
            </div>

            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block mb-1">Avg Latency</span>
              <span className="text-2xl font-bold text-slate-200">{lastResult.averageLatencyMs}</span>
              <span className="text-xs text-slate-500 ml-1">ms</span>
            </div>

            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block mb-1">P95 / P99 Latency</span>
              <span className="text-xl font-bold text-indigo-400">{lastResult.p95LatencyMs}</span>
              <span className="text-xs text-slate-400 ml-2">/ {lastResult.p99LatencyMs} ms</span>
            </div>
          </div>

          {/* Result Distribution Chart */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Request Allocation Across Backend Instances
            </h4>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
                    {distributionChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
