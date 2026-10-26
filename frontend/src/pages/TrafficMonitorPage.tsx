import React, { useState, useEffect } from 'react';
import {
  Activity,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { RequestLogEntry } from '../types/index.js';
import { fetchTrafficLogs, sendManualProxyRequest } from '../services/api.js';

export const TrafficMonitorPage: React.FC = () => {
  const [logs, setLogs] = useState<RequestLogEntry[]>([]);
  const [customRoute, setCustomRoute] = useState('/api/proxy/data');
  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);

  const loadLogs = async () => {
    try {
      const data = await fetchTrafficLogs(30);
      setLogs(data);
    } catch {}
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSendRequest = async (route: string) => {
    setIsSending(true);
    try {
      const res = await sendManualProxyRequest(route);
      setLastResponse(res);
      loadLogs();
    } catch (err: any) {
      setLastResponse({ error: err.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Traffic Monitor & Inspector</h2>
          <p className="text-xs text-slate-400">
            Real-time HTTP request trace stream, latencies, and interactive endpoint testing
          </p>
        </div>
      </div>

      {/* Interactive Request Dispatcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Interactive Proxy Request Dispatcher</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'GET /info', route: '/api/proxy/info' },
            { label: 'GET /data', route: '/api/proxy/data' },
            { label: 'GET /work (50ms)', route: '/api/proxy/work?duration=50' },
            { label: 'GET /work (200ms)', route: '/api/proxy/work?duration=200' },
            { label: 'GET /slow (3s)', route: '/api/proxy/slow?delay=3000' },
            { label: 'GET /fail (500 Test)', route: '/api/proxy/fail' }
          ].map((preset) => (
            <button
              key={preset.route}
              onClick={() => {
                setCustomRoute(preset.route);
                handleSendRequest(preset.route);
              }}
              disabled={isSending}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-medium border border-slate-700 transition"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customRoute}
            onChange={(e) => setCustomRoute(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500"
            placeholder="/api/proxy/data"
          />
          <button
            onClick={() => handleSendRequest(customRoute)}
            disabled={isSending}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? 'Sending...' : 'Send'}</span>
          </button>
        </div>

        {/* Last Response Preview */}
        {lastResponse && (
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] mb-2">
              <span className="text-slate-400">Response Status: <strong className={lastResponse.status === 200 ? 'text-emerald-400' : 'text-rose-400'}>HTTP {lastResponse.status}</strong></span>
              {lastResponse.headers && (
                <div className="flex space-x-3 text-slate-400">
                  <span>Backend: <strong className="text-sky-400">{lastResponse.headers.backend}</strong></span>
                  <span>Latency: <strong className="text-slate-200">{lastResponse.headers.latencyMs}ms</strong></span>
                </div>
              )}
            </div>
            <pre className="text-slate-300 overflow-x-auto text-[11px] max-h-32">
              {JSON.stringify(lastResponse.data || lastResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Live Request Log Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Live Request Trace Stream</h3>
            <p className="text-xs text-slate-400">Recent logical requests processed through the gateway</p>
          </div>
          <span className="text-xs font-mono text-slate-500">{logs.length} entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300 font-mono">
            <thead className="text-slate-400 border-b border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Request ID</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Route</th>
                <th className="py-2.5 px-3">Routed Backend</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {logs.length > 0 ? (
                logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="py-2 px-3 text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-slate-500 truncate max-w-[100px]" title={log.requestId}>
                      {log.requestId.slice(0, 8)}...
                    </td>
                    <td className="py-2 px-3 font-semibold text-sky-400">{log.method}</td>
                    <td className="py-2 px-3 text-slate-300 truncate max-w-[150px]">{log.route}</td>
                    <td className="py-2 px-3 font-semibold text-emerald-400">{log.backendId}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.statusCode >= 200 && log.statusCode < 300
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : log.statusCode >= 400 && log.statusCode < 500
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">{log.latencyMs.toFixed(1)} ms</td>
                    <td className="py-2 px-3 text-slate-400">{log.outcome}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    No requests recorded yet. Send a test request above!
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
