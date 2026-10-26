import { BackendServer, LoadBalancer, SelectionContext, AlgorithmType } from '../types/index.js';

/**
 * Smooth Weighted Round Robin (Nginx algorithm)
 * Provides optimal interleaving without request clustering.
 *
 * Over a cycle of sum(weights), each server S is selected exactly S.weight times.
 */
export class WeightedRoundRobinLoadBalancer implements LoadBalancer {
  readonly name: AlgorithmType = 'weighted-round-robin';

  selectServer(context: SelectionContext): BackendServer | null {
    const eligible = context.servers.filter(
      (s) => (s.status === 'HEALTHY' || s.status === 'RECOVERING') && s.enabled && s.weight > 0
    );

    if (eligible.length === 0) {
      return null;
    }

    if (eligible.length === 1) {
      return eligible[0];
    }

    let totalWeight = 0;
    let selectedServer: BackendServer | null = null;
    let maxCurrentWeight = -Infinity;

    for (const server of eligible) {
      // Initialize currentWeight if not set
      if (server.currentWeight === undefined) {
        server.currentWeight = 0;
      }

      // Step 1: increment currentWeight by configured weight
      server.currentWeight += server.weight;
      totalWeight += server.weight;

      // Step 2: find server with max currentWeight
      if (server.currentWeight > maxCurrentWeight) {
        maxCurrentWeight = server.currentWeight;
        selectedServer = server;
      }
    }

    // Step 3: decrement selected server's currentWeight by totalWeight
    if (selectedServer) {
      selectedServer.currentWeight! -= totalWeight;
    }

    return selectedServer;
  }
}
