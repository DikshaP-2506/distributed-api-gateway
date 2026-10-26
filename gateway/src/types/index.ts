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
  currentWeight?: number; // Used for smooth weighted round robin
}

export interface SelectionContext {
  servers: BackendServer[];
  requestId?: string;
  method?: string;
  path?: string;
}

export interface LoadBalancer {
  readonly name: AlgorithmType;
  selectServer(context: SelectionContext): BackendServer | null;
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

export interface AdaptiveWeights {
  latencyWeight: number; // default: 0.40
  loadWeight: number;    // default: 0.30
  errorWeight: number;   // default: 0.20
  capacityWeight: number;// default: 0.10
}
