import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../../src/metrics/index.js';
import { BackendRegistry } from '../../src/health/index.js';
import { LoadBalancerManager } from '../../src/load-balancer/index.js';

describe('Metrics Collector Unit Tests', () => {
  let metrics: MetricsCollector;
  let registry: BackendRegistry;
  let lbManager: LoadBalancerManager;

  beforeEach(() => {
    registry = new BackendRegistry([{ id: 'server-1', url: 'http://localhost:3001' }]);
    lbManager = new LoadBalancerManager('round-robin');
    metrics = new MetricsCollector(registry, lbManager);
  });

  it('should track logical requests, successes, and failures correctly', () => {
    metrics.recordRequest({ statusCode: 200, latencyMs: 25, outcome: 'SUCCESS' });
    metrics.recordRequest({ statusCode: 201, latencyMs: 30, outcome: 'SUCCESS' });
    metrics.recordRequest({ statusCode: 500, latencyMs: 15, outcome: 'SERVER_ERROR' });
    metrics.recordRequest({ statusCode: 504, latencyMs: 5000, outcome: 'TIMEOUT' });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.totalRequests).toBe(4);
    expect(snapshot.successfulRequests).toBe(2);
    expect(snapshot.failedRequests).toBe(2);
    expect(snapshot.timeoutCount).toBe(1);
  });

  it('should calculate latency percentiles accurately', () => {
    // Generate 100 sample latencies from 1ms to 100ms
    for (let i = 1; i <= 100; i++) {
      metrics.recordRequest({ statusCode: 200, latencyMs: i, outcome: 'SUCCESS' });
    }

    const percentiles = metrics.calculatePercentiles();
    expect(percentiles.avg).toBeCloseTo(50.5, 1);
    expect(percentiles.p50).toBe(51);
    expect(percentiles.p95).toBe(96);
    expect(percentiles.p99).toBe(100);
  });
});
