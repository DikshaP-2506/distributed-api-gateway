import React, { useState, useEffect } from 'react';
import { Sidebar, TabType } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { useGatewaySocket } from './hooks/useGatewaySocket.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { ServersPage } from './pages/ServersPage.js';
import { LoadBalancingPage } from './pages/LoadBalancingPage.js';
import { TrafficMonitorPage } from './pages/TrafficMonitorPage.js';
import { ExperimentLabPage } from './pages/ExperimentLabPage.js';
import { HealthEventsPage } from './pages/HealthEventsPage.js';
import { ExperimentHistoryPage } from './pages/ExperimentHistoryPage.js';
import { fetchHealthEvents } from './services/api.js';
import { HealthTransitionEvent } from './types/index.js';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [healthEvents, setHealthEvents] = useState<HealthTransitionEvent[]>([]);

  const {
    isConnected,
    metrics,
    servers,
    lastHealthEvent,
    experimentProgress,
    refreshSnapshot
  } = useGatewaySocket();

  const loadEvents = async () => {
    try {
      const data = await fetchHealthEvents(10);
      setHealthEvents(data);
    } catch {}
  };

  useEffect(() => {
    loadEvents();
  }, [lastHealthEvent]);

  const healthyCount = servers.filter((s) => s.status === 'HEALTHY' && s.enabled).length;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        healthyCount={healthyCount}
        totalServers={servers.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          isConnected={isConnected}
          activeAlgorithm={metrics?.currentAlgorithm}
          onRefresh={refreshSnapshot}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && (
              <OverviewPage
                metrics={metrics}
                servers={servers}
                healthEvents={healthEvents}
              />
            )}

            {activeTab === 'servers' && (
              <ServersPage
                servers={servers}
                onRefresh={refreshSnapshot}
              />
            )}

            {activeTab === 'load-balancing' && (
              <LoadBalancingPage
                currentAlgorithm={metrics?.currentAlgorithm || 'round-robin'}
                servers={servers}
                onRefresh={refreshSnapshot}
              />
            )}

            {activeTab === 'traffic' && (
              <TrafficMonitorPage />
            )}

            {activeTab === 'experiment' && (
              <ExperimentLabPage
                currentAlgorithm={metrics?.currentAlgorithm || 'round-robin'}
                experimentProgress={experimentProgress}
                onExperimentComplete={refreshSnapshot}
              />
            )}

            {activeTab === 'events' && (
              <HealthEventsPage />
            )}

            {activeTab === 'history' && (
              <ExperimentHistoryPage />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
