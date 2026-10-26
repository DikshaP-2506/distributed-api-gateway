import { describe, it, expect, beforeEach } from 'vitest';
import { RoundRobinLoadBalancer } from '../../src/load-balancer/roundRobin.js';
import { WeightedRoundRobinLoadBalancer } from '../../src/load-balancer/weightedRoundRobin.js';
import { LeastConnectionsLoadBalancer } from '../../src/load-balancer/leastConnections.js';
import { AdaptiveLoadBalancer } from '../../src/load-balancer/adaptive.js';
import { BackendServer } from '../../src/types/index.js';

function createMockServer(id: string, overrides: Partial<BackendServer> = {}): BackendServer {
  return {
    id,
    url: `http://localhost:${3000 + parseInt(id.replace(/\D/g, '') || '1')}`,
    status: 'HEALTHY',
    weight: 1,
    capacity: 50,
    activeRequests: 0,
    totalRequests: 0,
    recentLatencies: [],
    errorCount: 0,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    enabled: true,
    lastHealthCheck: null,
    lastError: null,
    ...overrides
  };
}

describe('Load Balancer Unit Tests', () => {
  let s1: BackendServer;
  let s2: BackendServer;
  let s3: BackendServer;

  beforeEach(() => {
    s1 = createMockServer('server-1', { weight: 5 });
    s2 = createMockServer('server-2', { weight: 3 });
    s3 = createMockServer('server-3', { weight: 2 });
  });

  describe('Round Robin', () => {
    it('should cycle through healthy servers sequentially', () => {
      const rr = new RoundRobinLoadBalancer();
      const servers = [s1, s2, s3];

      const r1 = rr.selectServer({ servers });
      const r2 = rr.selectServer({ servers });
      const r3 = rr.selectServer({ servers });
      const r4 = rr.selectServer({ servers });

      expect(r1?.id).toBe('server-1');
      expect(r2?.id).toBe('server-2');
      expect(r3?.id).toBe('server-3');
      expect(r4?.id).toBe('server-1');
    });

    it('should exclude unhealthy servers from selection', () => {
      const rr = new RoundRobinLoadBalancer();
      s2.status = 'UNHEALTHY';
      const servers = [s1, s2, s3];

      const selections = [
        rr.selectServer({ servers })?.id,
        rr.selectServer({ servers })?.id,
        rr.selectServer({ servers })?.id
      ];

      expect(selections).toEqual(['server-1', 'server-3', 'server-1']);
      expect(selections).not.toContain('server-2');
    });

    it('should exclude disabled servers from selection', () => {
      const rr = new RoundRobinLoadBalancer();
      s1.enabled = false;
      const servers = [s1, s2, s3];

      const selections = [
        rr.selectServer({ servers })?.id,
        rr.selectServer({ servers })?.id
      ];

      expect(selections).toEqual(['server-2', 'server-3']);
    });

    it('should return null when no servers are eligible', () => {
      const rr = new RoundRobinLoadBalancer();
      s1.status = 'UNHEALTHY';
      s2.status = 'UNHEALTHY';
      s3.status = 'UNHEALTHY';

      expect(rr.selectServer({ servers: [s1, s2, s3] })).toBeNull();
    });
  });

  describe('Weighted Round Robin', () => {
    it('should distribute requests proportionally to weights (5:3:2)', () => {
      const wrr = new WeightedRoundRobinLoadBalancer();
      const servers = [s1, s2, s3]; // weights: 5, 3, 2 -> total 10

      const counts: Record<string, number> = { 'server-1': 0, 'server-2': 0, 'server-3': 0 };

      // 100 requests should yield exactly 50:30:20
      for (let i = 0; i < 100; i++) {
        const selected = wrr.selectServer({ servers });
        if (selected) {
          counts[selected.id]++;
        }
      }

      expect(counts['server-1']).toBe(50);
      expect(counts['server-2']).toBe(30);
      expect(counts['server-3']).toBe(20);
    });

    it('should smoothly interleave selections without clustering', () => {
      const wrr = new WeightedRoundRobinLoadBalancer();
      const servers = [s1, s2, s3]; // weights: 5, 3, 2

      const sequence: string[] = [];
      for (let i = 0; i < 10; i++) {
        sequence.push(wrr.selectServer({ servers })!.id);
      }

      // Smooth WRR shouldn't pick server-1 five times consecutively at the start
      const firstThree = sequence.slice(0, 3);
      expect(firstThree).not.toEqual(['server-1', 'server-1', 'server-1']);
      expect(sequence.filter((id) => id === 'server-1').length).toBe(5);
      expect(sequence.filter((id) => id === 'server-2').length).toBe(3);
      expect(sequence.filter((id) => id === 'server-3').length).toBe(2);
    });
  });

  describe('Least Connections', () => {
    it('should select server with the lowest active request count', () => {
      const lc = new LeastConnectionsLoadBalancer();
      s1.activeRequests = 8;
      s2.activeRequests = 2;
      s3.activeRequests = 5;

      const selected = lc.selectServer({ servers: [s1, s2, s3] });
      expect(selected?.id).toBe('server-2');
    });

    it('should break ties using lowest recent latency', () => {
      const lc = new LeastConnectionsLoadBalancer();
      s1.activeRequests = 3;
      s1.recentLatencies = [120, 130]; // avg 125ms
      s2.activeRequests = 3;
      s2.recentLatencies = [40, 50];   // avg 45ms
      s3.activeRequests = 10;

      const selected = lc.selectServer({ servers: [s1, s2, s3] });
      expect(selected?.id).toBe('server-2');
    });
  });

  describe('Adaptive Load Balancing', () => {
    it('should assign higher penalty scores to servers with high latency and error rates', () => {
      const adaptive = new AdaptiveLoadBalancer();

      // Fast, zero-error server
      s1.recentLatencies = [15, 20];
      s1.activeRequests = 1;
      s1.totalRequests = 100;
      s1.errorCount = 0;

      // Degraded server: high latency, error rate
      s2.recentLatencies = [800, 950];
      s2.activeRequests = 25;
      s2.totalRequests = 100;
      s2.errorCount = 30; // 30% error rate

      const score1 = adaptive.calculateServerScore(s1);
      const score2 = adaptive.calculateServerScore(s2);

      expect(score1.score).toBeLessThan(score2.score);

      const selected = adaptive.selectServer({ servers: [s1, s2] });
      expect(selected?.id).toBe('server-1');
    });

    it('should adapt when weights are dynamically modified', () => {
      const adaptive = new AdaptiveLoadBalancer();
      adaptive.setWeights({ latencyWeight: 0.8, loadWeight: 0.1 });
      const weights = adaptive.getWeights();

      expect(weights.latencyWeight).toBe(0.8);
      expect(weights.loadWeight).toBe(0.1);
    });
  });
});
