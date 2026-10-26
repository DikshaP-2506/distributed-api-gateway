import React, { useState } from 'react';
import { RefreshCw, Radio, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { AlgorithmType } from '../types/index.js';
import { sendManualProxyRequest } from '../services/api.js';

interface HeaderProps {
  isConnected: boolean;
  activeAlgorithm?: AlgorithmType;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  activeAlgorithm = 'round-robin',
  onRefresh
}) => {
  const [isSending, setIsSending] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; backend: string } | null>(null);

  const handleQuickRequest = async () => {
    setIsSending(true);
    try {
      const res = await sendManualProxyRequest('/api/proxy/data');
      setTestResult({
        status: res.status,
        backend: res.headers.backend || 'none'
      });
      setTimeout(() => setTestResult(null), 3000);
    } catch {
      setTestResult({ status: 500, backend: 'error' });
      setTimeout(() => setTestResult(null), 3000);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Status Badges */}
      <div className="flex items-center space-x-4">
        {/* Connection status */}
        <div
          className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium border ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          <span>{isConnected ? 'Socket Connected' : 'Disconnected'}</span>
        </div>

        {/* Algorithm Badge */}
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
          <span className="text-slate-500">ALGO:</span>
          <span className="text-sky-400 font-semibold uppercase">{activeAlgorithm}</span>
        </div>
      </div>

      {/* Right: Quick actions */}
      <div className="flex items-center space-x-3">
        {testResult && (
          <div
            className={`flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded border animate-fade-in ${
              testResult.status === 200
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {testResult.status === 200 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            <span>Routed to: <strong>{testResult.backend}</strong> (HTTP {testResult.status})</span>
          </div>
        )}

        <button
          onClick={handleQuickRequest}
          disabled={isSending}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-50"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{isSending ? 'Sending...' : 'Test Request'}</span>
        </button>

        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
