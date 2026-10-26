import { BackendServer, LoadBalancer, SelectionContext, AlgorithmType } from '../types/index.js';

export class RoundRobinLoadBalancer implements LoadBalancer {
  readonly name: AlgorithmType = 'round-robin';
  private counter: number = 0;

  selectServer(context: SelectionContext): BackendServer | null {
    const eligible = context.servers.filter(
      (s) => (s.status === 'HEALTHY' || s.status === 'RECOVERING') && s.enabled
    );

    if (eligible.length === 0) {
      return null;
    }

    // Atomic-like increment with safe wrap-around
    const index = Math.abs(this.counter++) % eligible.length;
    if (this.counter >= Number.MAX_SAFE_INTEGER - 1000) {
      this.counter = 0;
    }

    return eligible[index];
  }

  reset(): void {
    this.counter = 0;
  }
}
