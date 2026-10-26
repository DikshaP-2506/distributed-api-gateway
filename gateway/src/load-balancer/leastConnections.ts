import { BackendServer, LoadBalancer, SelectionContext, AlgorithmType } from '../types/index.js';

export class LeastConnectionsLoadBalancer implements LoadBalancer {
  readonly name: AlgorithmType = 'least-connections';
  private tieBreakerCounter: number = 0;

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

    // Find the minimum activeRequests
    let minConnections = Infinity;
    for (const server of eligible) {
      if (server.activeRequests < minConnections) {
        minConnections = server.activeRequests;
      }
    }

    // Filter candidates with minimum connections
    const candidates = eligible.filter((s) => s.activeRequests === minConnections);

    if (candidates.length === 1) {
      return candidates[0];
    }

    // Tie-breaker 1: Choose candidate with lowest recent average latency
    let minAvgLatency = Infinity;
    let lowestLatencyCandidates: BackendServer[] = [];

    for (const server of candidates) {
      const avgLat = server.recentLatencies.length > 0
        ? server.recentLatencies.reduce((a, b) => a + b, 0) / server.recentLatencies.length
        : 0;

      if (avgLat < minAvgLatency) {
        minAvgLatency = avgLat;
        lowestLatencyCandidates = [server];
      } else if (Math.abs(avgLat - minAvgLatency) < 0.1) {
        lowestLatencyCandidates.push(server);
      }
    }

    if (lowestLatencyCandidates.length === 1) {
      return lowestLatencyCandidates[0];
    }

    // Tie-breaker 2: Deterministic round-robin among remaining tied candidates
    const idx = Math.abs(this.tieBreakerCounter++) % lowestLatencyCandidates.length;
    if (this.tieBreakerCounter >= Number.MAX_SAFE_INTEGER - 1000) {
      this.tieBreakerCounter = 0;
    }

    return lowestLatencyCandidates[idx];
  }
}
