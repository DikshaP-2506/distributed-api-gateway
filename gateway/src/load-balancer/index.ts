import { AlgorithmType, BackendServer, LoadBalancer, SelectionContext, AdaptiveWeights } from '../types/index.js';
import { RoundRobinLoadBalancer } from './roundRobin.js';
import { WeightedRoundRobinLoadBalancer } from './weightedRoundRobin.js';
import { LeastConnectionsLoadBalancer } from './leastConnections.js';
import { AdaptiveLoadBalancer } from './adaptive.js';

export class LoadBalancerManager {
  private activeAlgorithm: AlgorithmType;
  private balancers: Map<AlgorithmType, LoadBalancer>;
  private adaptiveInstance: AdaptiveLoadBalancer;

  constructor(initialAlgorithm: AlgorithmType = 'round-robin') {
    this.activeAlgorithm = initialAlgorithm;
    this.adaptiveInstance = new AdaptiveLoadBalancer();

    this.balancers = new Map<AlgorithmType, LoadBalancer>([
      ['round-robin', new RoundRobinLoadBalancer()],
      ['weighted-round-robin', new WeightedRoundRobinLoadBalancer()],
      ['least-connections', new LeastConnectionsLoadBalancer()],
      ['adaptive', this.adaptiveInstance]
    ]);
  }

  getActiveAlgorithm(): AlgorithmType {
    return this.activeAlgorithm;
  }

  setAlgorithm(algorithm: AlgorithmType): boolean {
    if (!this.balancers.has(algorithm)) {
      return false;
    }
    this.activeAlgorithm = algorithm;
    return true;
  }

  selectServer(context: SelectionContext): BackendServer | null {
    const balancer = this.balancers.get(this.activeAlgorithm);
    if (!balancer) {
      return null;
    }
    return balancer.selectServer(context);
  }

  getAdaptiveWeights(): AdaptiveWeights {
    return this.adaptiveInstance.getWeights();
  }

  setAdaptiveWeights(weights: Partial<AdaptiveWeights>): void {
    this.adaptiveInstance.setWeights(weights);
  }

  getAdaptiveScores(servers: BackendServer[]) {
    return servers.map((s) => ({
      serverId: s.id,
      ...this.adaptiveInstance.calculateServerScore(s)
    }));
  }
}
