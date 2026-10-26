export type ServerHealthState = 'HEALTHY' | 'UNHEALTHY' | 'RECOVERING' | 'DRAINING';

export type AlgorithmType = 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'adaptive';

export interface BackendServer {
  id: string;
  url: string;
  status: ServerHealthState;
  weight: number;
  capacity: number;
  activeRequests: number;
  totalRequests: number;
  recentLatencies: number[];
  errorCount: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  enabled: boolean;
  lastHealthCheck: string | null;
  lastError: string | null;
  adaptiveScore?: number | null;
  scoreBreakdown?: {
    score: number;
    normalizedLatency: number;
    normalizedLoad: number;
    normalizedErrorRate: number;
    normalizedCapacity: number;
  } | null;
}

export interface GatewayMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerSecond: number;
  activeRequests: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  timeoutCount: number;
  retryCount: number;
  currentAlgorithm: AlgorithmType;
  serverStats: Record<string, {
    totalRequests: number;
    errorRate: number;
    activeRequests: number;
    avgLatencyMs: number;
    status: ServerHealthState;
    weight: number;
    capacity: number;
    enabled: boolean;
  }>;
}

export interface HealthTransitionEvent {
  id?: number;
  backendId: string;
  previousState: ServerHealthState;
  currentState: ServerHealthState;
  reason: string;
  timestamp: string;
}

export interface RequestLogEntry {
  id?: number;
  requestId: string;
  backendId: string;
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  outcome: 'SUCCESS' | 'CLIENT_ERROR' | 'SERVER_ERROR' | 'GATEWAY_ERROR' | 'TIMEOUT';
  timestamp: string;
}

export interface ExperimentRun {
  id?: number;
  experimentName: string;
  algorithm: AlgorithmType;
  totalRequests: number;
  concurrency: number;
  successCount: number;
  failureCount: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputRps: number;
  distribution: Record<string, number>;
  startedAt: string;
  completedAt: string;
}

export interface AdaptiveWeights {
  latencyWeight: number;
  loadWeight: number;
  errorWeight: number;
  capacityWeight: number;
}
