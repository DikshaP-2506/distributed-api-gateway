import React from 'react';
import {
  LayoutDashboard,
  Server,
  Scale,
  Activity,
  FlaskConical,
  History,
  ShieldAlert
} from 'lucide-react';

export type TabType = 'overview' | 'servers' | 'load-balancing' | 'traffic' | 'experiment' | 'events' | 'history';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  healthyCount: number;
  totalServers: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  healthyCount,
  totalServers
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'servers', label: 'Backend Servers', icon: Server, badge: `${healthyCount}/${totalServers}` },
    { id: 'load-balancing', label: 'Load Balancing', icon: Scale },
    { id: 'traffic', label: 'Traffic Monitor', icon: Activity },
    { id: 'experiment', label: 'Experiment Lab', icon: FlaskConical },
    { id: 'events', label: 'Health Events', icon: ShieldAlert },
    { id: 'history', label: 'Experiment History', icon: History }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold shadow-inner">
          <Scale className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-100 tracking-tight">API Gateway</h1>
          <p className="text-xs text-slate-400 font-mono">Distributed Mesh</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    healthyCount === totalServers
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer System Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="text-xs text-slate-400 space-y-1">
          <div className="flex justify-between">
            <span>Environment:</span>
            <span className="text-slate-200 font-mono">Distributed</span>
          </div>
          <div className="flex justify-between">
            <span>Protocol:</span>
            <span className="text-slate-200 font-mono">HTTP/1.1 + WS</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
