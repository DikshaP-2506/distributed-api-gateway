import React, { useState } from 'react';
import {
  Scale,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  Sliders,
  Info
} from 'lucide-react';
import { AlgorithmType, BackendServer } from '../types/index.js';
import { setAlgorithm } from '../services/api.js';

interface LoadBalancingPageProps {
  currentAlgorithm: AlgorithmType;
  servers: BackendServer[];
  onRefresh: () => void;
}

export const LoadBalancingPage: React.FC<LoadBalancingPageProps> = ({
  currentAlgorithm,
  servers,
  onRefresh
}) => {
  const [switching, setSwitching] = useState<string | null>(null);

  const algorithms = [
    {
      id: 'round-robin',
      title: 'Round Robin',
      icon: Layers,
      description: 'Sequentially cycles incoming requests across the pool of eligible, healthy backend nodes.',
      formula: 'NextIndex = (Counter + 1) % EligibleNodes.length',
      benefits: 'Zero computational overhead, perfectly balanced request counts under homogeneous server specifications.'
    },
    {
      id: 'weighted-round-robin',
      title: 'Weighted Round Robin',
      icon: Scale,
      description: 'Distributes traffic proportionally based on assigned server weights using the Smooth Interleaving (Nginx) algorithm.',
      formula: 'Server.currentWeight += Server.weight; select max(currentWeight); currentWeight -= TotalWeight',
      benefits: 'Prevents burst clustering to heavy servers, matches differing CPU/RAM server hardware specifications.'
    },
    {
      id: 'least-connections',
      title: 'Least Connections',
      icon: Cpu,
      description: 'Routes new requests dynamically to the server currently maintaining the fewest active in-flight connections.',
      formula: 'Select server with min(activeRequests), deterministic latency tie-breaking',
      benefits: 'Ideal for variable-duration requests, preventing slow requests from accumulating on a single node.'
    },
    {
      id: 'adaptive',
      title: 'Adaptive Load Balancing',
      icon: Sparkles,
      description: 'Scores servers continuously by evaluating moving latency, active load, error rates, and capacity limits.',
      formula: 'Score = (0.40 × NormLatency) + (0.30 × NormLoad) + (0.20 × NormError) + (0.10 × NormCapacity)',
      benefits: 'Automatically steers traffic away from degraded or slow servers before health check failure triggers.'
    }
  ];

  const handleSelectAlgorithm = async (algoId: AlgorithmType) => {
    setSwitching(algoId);
    try {
      await setAlgorithm(algoId);
      onRefresh();
    } finally {
      setSwitching(null);
    }
  };

  const eligibleServers = servers.filter((s) => (s.status === 'HEALTHY' || s.status === 'RECOVERING') && s.enabled);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Load Balancing Engine</h2>
          <p className="text-xs text-slate-400">
            Switch algorithms dynamically at runtime without restarting the gateway
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="text-slate-400">Eligible Pool:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
            {eligibleServers.length} / {servers.length} Nodes
          </span>
        </div>
      </div>

      {/* Algorithm Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {algorithms.map((algo) => {
          const Icon = algo.icon;
          const isActive = currentAlgorithm === algo.id;
          const isPending = switching === algo.id;

          return (
            <div
              key={algo.id}
              className={`bg-slate-900 border rounded-xl p-6 shadow-sm flex flex-col justify-between transition-all duration-200 ${
                isActive
                  ? 'border-sky-500/50 bg-slate-900/90 ring-1 ring-sky-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2.5 rounded-lg border ${
                        isActive
                          ? 'bg-sky-500/20 border-sky-400/40 text-sky-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{algo.title}</h3>
                      <span className="text-[11px] font-mono text-slate-500">{algo.id}</span>
                    </div>
                  </div>

                  {isActive && (
                    <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-4">{algo.description}</p>

                {/* Mathematical Model Formula */}
                <div className="mb-4 p-3 rounded-lg bg-slate-950/70 border border-slate-800 font-mono text-xs text-slate-300">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    Mathematical Model
                  </span>
                  <code className="text-sky-300 block overflow-x-auto text-[11px]">{algo.formula}</code>
                </div>

                <div className="text-xs text-slate-400 flex items-start space-x-1.5 mb-6">
                  <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>{algo.benefits}</span>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => handleSelectAlgorithm(algo.id as AlgorithmType)}
                disabled={isActive || isPending}
                className={`w-full py-2 px-4 rounded-lg text-xs font-medium transition flex items-center justify-center space-x-2 ${
                  isActive
                    ? 'bg-slate-800 text-slate-400 cursor-default'
                    : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
                }`}
              >
                {isActive ? (
                  <span>Currently Active</span>
                ) : isPending ? (
                  <span>Switching...</span>
                ) : (
                  <span>Activate {algo.title}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
