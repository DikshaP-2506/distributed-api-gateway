import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Filter } from 'lucide-react';
import { HealthTransitionEvent } from '../types/index.js';
import { fetchHealthEvents } from '../services/api.js';

export const HealthEventsPage: React.FC = () => {
  const [events, setEvents] = useState<HealthTransitionEvent[]>([]);
  const [filterBackend, setFilterBackend] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await fetchHealthEvents(100);
      setEvents(data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = filterBackend === 'all'
    ? events
    : events.filter((e) => e.backendId === filterBackend);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Health State Transitions Log</h2>
          <p className="text-xs text-slate-400">
            Immutable audit record of failure detections, threshold trips, and automated recoveries
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Filter */}
          <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterBackend}
              onChange={(e) => setFilterBackend(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none"
            >
              <option value="all">All Backends</option>
              <option value="server-1">server-1</option>
              <option value="server-2">server-2</option>
              <option value="server-3">server-3</option>
            </select>
          </div>

          <button
            onClick={loadEvents}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Events"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300 font-mono">
            <thead className="text-slate-400 border-b border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Backend ID</th>
                <th className="py-2.5 px-3">Previous State</th>
                <th className="py-2.5 px-3">New State</th>
                <th className="py-2.5 px-3">Transition Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((evt, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-sky-400">{evt.backendId}</td>
                    <td className="py-2.5 px-3 text-slate-400">{evt.previousState}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          evt.currentState === 'HEALTHY'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : evt.currentState === 'RECOVERING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {evt.currentState}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{evt.reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No health state transitions recorded yet. Fail a server in the Backend Servers tab to observe automated detection!
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
