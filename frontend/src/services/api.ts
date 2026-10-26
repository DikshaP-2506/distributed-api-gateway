import { AlgorithmType, BackendServer, ExperimentRun, GatewayMetrics, HealthTransitionEvent, RequestLogEntry } from '../types/index.js';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080';

export async function fetchOverview(): Promise<{
  metrics: GatewayMetrics;
  algorithm: AlgorithmType;
  totalServers: number;
  healthyServers: number;
  activeRequests: number;
  recentHealthEvents: HealthTransitionEvent[];
}> {
  const res = await fetch(`${GATEWAY_URL}/admin/overview`);
  if (!res.ok) throw new Error('Failed to fetch overview');
  return res.json();
}

export async function fetchServers(): Promise<BackendServer[]> {
  const res = await fetch(`${GATEWAY_URL}/admin/servers`);
  if (!res.ok) throw new Error('Failed to fetch servers');
  const data = await res.json();
  return data.servers;
}

export async function setAlgorithm(algorithm: AlgorithmType): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/admin/config/algorithm`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ algorithm })
  });
  if (!res.ok) throw new Error('Failed to set algorithm');
}

export async function updateServerWeight(serverId: string, weight: number): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/admin/servers/${serverId}/weight`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight })
  });
  if (!res.ok) throw new Error('Failed to update weight');
}

export async function updateServerCapacity(serverId: string, capacity: number): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/admin/servers/${serverId}/capacity`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capacity })
  });
  if (!res.ok) throw new Error('Failed to update capacity');
}

export async function disableServer(serverId: string): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/admin/servers/${serverId}/disable`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to disable server');
}

export async function enableServer(serverId: string): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/admin/servers/${serverId}/enable`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to enable server');
}

export async function fetchTrafficLogs(limit: number = 50): Promise<RequestLogEntry[]> {
  const res = await fetch(`${GATEWAY_URL}/admin/metrics/traffic?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch traffic logs');
  const data = await res.json();
  return data.logs;
}

export async function fetchHealthEvents(limit: number = 50): Promise<HealthTransitionEvent[]> {
  const res = await fetch(`${GATEWAY_URL}/admin/health-events?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch health events');
  const data = await res.json();
  return data.events;
}

export async function fetchExperiments(): Promise<ExperimentRun[]> {
  const res = await fetch(`${GATEWAY_URL}/admin/experiments`);
  if (!res.ok) throw new Error('Failed to fetch experiments');
  const data = await res.json();
  return data.experiments;
}

export async function runExperiment(params: {
  experimentName: string;
  algorithm: AlgorithmType;
  totalRequests: number;
  concurrency: number;
  endpoint: string;
  workDuration?: number;
}): Promise<ExperimentRun> {
  const res = await fetch(`${GATEWAY_URL}/admin/experiments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to run experiment');
  }
  const data = await res.json();
  return data.result;
}

export async function abortExperiment(): Promise<void> {
  await fetch(`${GATEWAY_URL}/admin/experiments/abort`, { method: 'POST' });
}

export async function simulateBackendFailure(backendUrl: string, healthy: boolean): Promise<void> {
  await fetch(`${backendUrl}/admin/simulate-health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ healthy })
  });
}

export async function sendManualProxyRequest(route: string): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}${route}`);
  const data = await res.json().catch(() => null);
  return {
    status: res.status,
    headers: {
      backend: res.headers.get('x-backend-server'),
      requestId: res.headers.get('x-request-id'),
      latencyMs: res.headers.get('x-gateway-latency-ms'),
      algorithm: res.headers.get('x-load-balancer-algorithm')
    },
    data
  };
}
