import { AlgorithmType, GatewayMetrics, RequestLogEntry } from '../types/index.js';
import { BackendRegistry } from '../health/index.js';
import { LoadBalancerManager } from '../load-balancer/index.js';

interface SecondBucket {
  timestamp: number;
  count: number;
}

export class MetricsCollector {
  private totalLogicalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private activeRequests: number = 0;
  private timeoutCount: number = 0;
  private retryCount: number = 0;

  // Latency samples buffer (recent 1000 for accurate rolling percentiles)
  private latencySamples: number[] = [];
  private readonly maxLatencySamples = 1000;

  // Rolling request timestamps for RPS calculation (last 10 seconds)
  private rpsBuckets: SecondBucket[] = [];

  constructor(
    private registry: BackendRegistry,
    private lbManager: LoadBalancerManager
  ) {}

  incrementActiveRequests(): void {
    this.activeRequests++;
  }

  decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  recordRetry(): void {
    this.retryCount++;
  }

  recordRequest(log: {
    statusCode: number;
    latencyMs: number;
    outcome: RequestLogEntry['outcome'];
  }): void {
    this.totalLogicalRequests++;

    if (log.outcome === 'TIMEOUT') {
      this.timeoutCount++;
      this.failedRequests++;
    } else if (log.statusCode >= 200 && log.statusCode < 400) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    // Add latency sample
    this.latencySamples.push(log.latencyMs);
    if (this.latencySamples.length > this.maxLatencySamples) {
      this.latencySamples.shift();
    }

    // Add to RPS tracker
    const currentSec = Math.floor(Date.now() / 1000);
    const lastBucket = this.rpsBuckets[this.rpsBuckets.length - 1];
    if (lastBucket && lastBucket.timestamp === currentSec) {
      lastBucket.count++;
    } else {
      this.rpsBuckets.push({ timestamp: currentSec, count: 1 });
      // Keep only last 10 seconds
      if (this.rpsBuckets.length > 10) {
        this.rpsBuckets.shift();
      }
    }
  }

  calculatePercentiles(): { avg: number; p50: number; p95: number; p99: number } {
    if (this.latencySamples.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const avg = sum / sorted.length;

    const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    return {
      avg: Number(avg.toFixed(2)),
      p50: Number(p50.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      p99: Number(p99.toFixed(2))
    };
  }

  calculateRps(): number {
    const nowSec = Math.floor(Date.now() / 1000);
    // Discard buckets older than 10s
    this.rpsBuckets = this.rpsBuckets.filter((b) => nowSec - b.timestamp <= 10);

    if (this.rpsBuckets.length === 0) return 0;
    const totalCount = this.rpsBuckets.reduce((acc, b) => acc + b.count, 0);
    const timeSpan = Math.max(1, nowSec - this.rpsBuckets[0].timestamp + 1);
    return Number((totalCount / timeSpan).toFixed(2));
  }

  getSnapshot(): GatewayMetrics {
    const percentiles = this.calculatePercentiles();
    const servers = this.registry.getServers();

    const serverStats: GatewayMetrics['serverStats'] = {};
    for (const s of servers) {
      const avgLat = s.recentLatencies.length > 0
        ? s.recentLatencies.reduce((a, b) => a + b, 0) / s.recentLatencies.length
        : 0;

      const errorRate = s.totalRequests > 0
        ? Number(((s.errorCount / s.totalRequests) * 100).toFixed(1))
        : 0;

      serverStats[s.id] = {
        totalRequests: s.totalRequests,
        errorRate,
        activeRequests: s.activeRequests,
        avgLatencyMs: Number(avgLat.toFixed(2)),
        status: s.status,
        weight: s.weight,
        capacity: s.capacity,
        enabled: s.enabled
      };
    }

    return {
      totalRequests: this.totalLogicalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      requestsPerSecond: this.calculateRps(),
      activeRequests: this.activeRequests,
      avgLatencyMs: percentiles.avg,
      p50LatencyMs: percentiles.p50,
      p95LatencyMs: percentiles.p95,
      p99LatencyMs: percentiles.p99,
      timeoutCount: this.timeoutCount,
      retryCount: this.retryCount,
      currentAlgorithm: this.lbManager.getActiveAlgorithm(),
      serverStats
    };
  }
}
