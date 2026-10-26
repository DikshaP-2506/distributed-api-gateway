import { BackendServer, LoadBalancer, SelectionContext, AlgorithmType, AdaptiveWeights } from '../types/index.js';

/**
 * Adaptive Load Balancing Algorithm
 *
 * Scoring Model:
 *   score = (w_latency * normLatency) + (w_load * normLoad) + (w_error * normError) + (w_capacity * normCapacity)
 *
 * Normalization Rules:
 *   - normLatency: Average recent latency in ms normalized against a 1000ms baseline (capped at 1.0).
 *     Uses rolling exponential moving average or recent window to avoid single-spike instability.
 *   - normLoad: Current active requests divided by configured server capacity (capped at 1.0).
 *   - normError: Historical or recent error rate (errorCount / totalRequests, clamped to [0, 1]).
 *   - normCapacity: Active request utilization (activeRequests / capacity, clamped to [0, 1]).
 *
 * Server Selection:
 *   Selects the eligible healthy backend with the LOWEST composite penalty score.
 */
export class AdaptiveLoadBalancer implements LoadBalancer {
  readonly name: AlgorithmType = 'adaptive';

  private weights: AdaptiveWeights = {
    latencyWeight: 0.40,
    loadWeight: 0.30,
    errorWeight: 0.20,
    capacityWeight: 0.10
  };

  constructor(customWeights?: Partial<AdaptiveWeights>) {
    if (customWeights) {
      this.weights = { ...this.weights, ...customWeights };
    }
  }

  getWeights(): AdaptiveWeights {
    return { ...this.weights };
  }

  setWeights(newWeights: Partial<AdaptiveWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  calculateServerScore(server: BackendServer): {
    score: number;
    normalizedLatency: number;
    normalizedLoad: number;
    normalizedErrorRate: number;
    normalizedCapacity: number;
  } {
    // 1. Latency normalization (smooth average over recent samples)
    const avgLatency = server.recentLatencies.length > 0
      ? server.recentLatencies.reduce((sum, v) => sum + v, 0) / server.recentLatencies.length
      : 10; // Default warm-up assumption of 10ms
    const normalizedLatency = Math.min(1.0, Math.max(0.0, avgLatency / 1000));

    // 2. Active load normalization relative to capacity
    const safeCapacity = Math.max(1, server.capacity);
    const normalizedLoad = Math.min(1.0, Math.max(0.0, server.activeRequests / safeCapacity));

    // 3. Error rate normalization
    const errorRate = server.totalRequests > 0
      ? Math.min(1.0, server.errorCount / server.totalRequests)
      : 0.0;
    const normalizedErrorRate = errorRate;

    // 4. Capacity utilization normalization
    const normalizedCapacity = Math.min(1.0, Math.max(0.0, server.activeRequests / safeCapacity));

    // Composite penalty score calculation
    const score =
      this.weights.latencyWeight * normalizedLatency +
      this.weights.loadWeight * normalizedLoad +
      this.weights.errorWeight * normalizedErrorRate +
      this.weights.capacityWeight * normalizedCapacity;

    return {
      score: Number(score.toFixed(4)),
      normalizedLatency: Number(normalizedLatency.toFixed(4)),
      normalizedLoad: Number(normalizedLoad.toFixed(4)),
      normalizedErrorRate: Number(normalizedErrorRate.toFixed(4)),
      normalizedCapacity: Number(normalizedCapacity.toFixed(4))
    };
  }

  selectServer(context: SelectionContext): BackendServer | null {
    const eligible = context.servers.filter(
      (s) => (s.status === 'HEALTHY' || s.status === 'RECOVERING') && s.enabled
    );

    if (eligible.length === 0) {
      return null;
    }

    if (eligible.length === 1) {
      return eligible[0];
    }

    let lowestScore = Infinity;
    let bestServer: BackendServer = eligible[0];

    for (const server of eligible) {
      const { score } = this.calculateServerScore(server);
      if (score < lowestScore) {
        lowestScore = score;
        bestServer = server;
      }
    }

    return bestServer;
  }
}
