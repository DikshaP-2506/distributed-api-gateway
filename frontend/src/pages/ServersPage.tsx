import React, { useState } from 'react';
import {
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Sliders,
  Power,
  RotateCcw,
  ZapOff
} from 'lucide-react';
import { BackendServer } from '../types/index.js';
import {
  updateServerWeight,
  updateServerCapacity,
  disableServer,
  enableServer,
  simulateBackendFailure
} from '../services/api.js';

interface ServersPageProps {
  servers: BackendServer[];
  onRefresh: () => void;
}

export const ServersPage: React.FC<ServersPageProps> = ({ servers, onRefresh }) => {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [capacities, setCapacities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleWeightSave = async (serverId: string) => {
    const w = weights[serverId];
    if (!w || w <= 0) return;
    setLoading((prev) => ({ ...prev, [serverId]: true }));
    try {
      await updateServerWeight(serverId, w);
      onRefresh();
    } finally {
      setLoading((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  const handleCapacitySave = async (serverId: string) => {
    const c = capacities[serverId];
    if (!c || c <= 0) return;
    setLoading((prev) => ({ ...prev, [serverId]: true }));
    try {
      await updateServerCapacity(serverId, c);
      onRefresh();
    } finally {
      setLoading((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  const handleToggleEnable = async (server: BackendServer) => {
    setLoading((prev) => ({ ...prev, [server.id]: true }));
    try {
      if (server.enabled) {
        await disableServer(server.id);
      } else {
        await enableServer(server.id);
      }
      onRefresh();
    } finally {
      setLoading((prev) => ({ ...prev, [server.id]: false }));
    }
  };

  const handleSimulateFailure = async (server: BackendServer, fail: boolean) => {
    setLoading((prev) => ({ ...prev, [server.id]: true }));
    try {
      await simulateBackendFailure(server.url, !fail);
      onRefresh();
    } catch {
      // Backend might be offline
    } finally {
      setLoading((prev) => ({ ...prev, [server.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Backend Service Nodes</h2>
          <p className="text-xs text-slate-400">
            Monitor node health, tweak weights & capacity, or trigger chaos simulations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {servers.map((server) => {
          const isHealthy = server.status === 'HEALTHY' && server.enabled;
          const isRecovering = server.status === 'RECOVERING';
          const avgLatency = server.recentLatencies.length > 0
            ? (server.recentLatencies.reduce((a, b) => a + b, 0) / server.recentLatencies.length).toFixed(1)
            : '0.0';

          return (
            <div
              key={server.id}
              className={`bg-slate-900 border rounded-xl p-5 shadow-sm transition flex flex-col justify-between ${
                !server.enabled
                  ? 'border-slate-800 opacity-60'
                  : isHealthy
                  ? 'border-emerald-500/30'
                  : isRecovering
                  ? 'border-amber-500/30'
                  : 'border-rose-500/30'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{server.id}</h3>
                      <p className="text-xs text-slate-400 font-mono truncate max-w-[170px]">{server.url}</p>
                    </div>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-mono font-medium ${
                      !server.enabled
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : isHealthy
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : isRecovering
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {!server.enabled ? 'DISABLED' : server.status}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 my-4 bg-slate-950/60 p-3 rounded-lg text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">Active Requests:</span>
                    <span className="text-sm font-bold text-slate-200">{server.activeRequests}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Processed:</span>
                    <span className="text-sm font-bold text-slate-200">{server.totalRequests}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Avg Latency:</span>
                    <span className="text-sm font-bold text-slate-200">{avgLatency} ms</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Error Count:</span>
                    <span className="text-sm font-bold text-rose-400">{server.errorCount}</span>
                  </div>
                </div>

                {/* Adaptive Score breakdown if available */}
                {server.scoreBreakdown && (
                  <div className="mb-4 p-2.5 rounded bg-slate-950/40 border border-slate-800 text-xs font-mono">
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Adaptive Penalty Score:</span>
                      <strong className="text-sky-400">{server.scoreBreakdown.score}</strong>
                    </div>
                    <div className="text-[10px] text-slate-500 flex justify-between">
                      <span>Lat: {server.scoreBreakdown.normalizedLatency}</span>
                      <span>Load: {server.scoreBreakdown.normalizedLoad}</span>
                      <span>Err: {server.scoreBreakdown.normalizedErrorRate}</span>
                    </div>
                  </div>
                )}

                {/* Configuration Controls */}
                <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
                  {/* Weight Editor */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 font-mono">Weight:</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        defaultValue={server.weight}
                        onChange={(e) =>
                          setWeights((prev) => ({ ...prev, [server.id]: parseInt(e.target.value, 10) }))
                        }
                        className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-center text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500"
                      />
                      <button
                        onClick={() => handleWeightSave(server.id)}
                        disabled={loading[server.id]}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                      >
                        Set
                      </button>
                    </div>
                  </div>

                  {/* Capacity Editor */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 font-mono">Capacity:</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        defaultValue={server.capacity}
                        onChange={(e) =>
                          setCapacities((prev) => ({ ...prev, [server.id]: parseInt(e.target.value, 10) }))
                        }
                        className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-center text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500"
                      />
                      <button
                        onClick={() => handleCapacitySave(server.id)}
                        disabled={loading[server.id]}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Enable/Disable and Chaos Simulation */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => handleToggleEnable(server)}
                  disabled={loading[server.id]}
                  className={`w-full py-1.5 px-3 rounded text-xs font-medium flex items-center justify-center space-x-1.5 transition ${
                    server.enabled
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{server.enabled ? 'Disable Node' : 'Enable Node'}</span>
                </button>

                {/* Chaos Injection */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSimulateFailure(server, true)}
                    disabled={loading[server.id]}
                    className="py-1 px-2 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-medium flex items-center justify-center space-x-1 transition"
                    title="Simulate node degradation or crash"
                  >
                    <ZapOff className="w-3 h-3" />
                    <span>Fail Node</span>
                  </button>

                  <button
                    onClick={() => handleSimulateFailure(server, false)}
                    disabled={loading[server.id]}
                    className="py-1 px-2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium flex items-center justify-center space-x-1 transition"
                    title="Simulate node recovery"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Recover Node</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
