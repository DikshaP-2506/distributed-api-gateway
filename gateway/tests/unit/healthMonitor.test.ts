import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackendRegistry } from '../../src/health/index.js';
import { HealthTransitionEvent } from '../../src/types/index.js';

describe('Health Monitor Unit Tests', () => {
  let registry: BackendRegistry;

  beforeEach(() => {
    registry = new BackendRegistry(
      [
        { id: 'server-1', url: 'http://localhost:3001', weight: 1, capacity: 50 },
        { id: 'server-2', url: 'http://localhost:3002', weight: 1, capacity: 50 }
      ],
      {
        checkIntervalMs: 100,
        checkTimeoutMs: 50,
        unhealthyThreshold: 3,
        recoveryThreshold: 2
      }
    );
  });

  it('should initialize servers as HEALTHY and enabled', () => {
    const servers = registry.getServers();
    expect(servers.length).toBe(2);
    expect(servers[0].status).toBe('HEALTHY');
    expect(servers[0].enabled).toBe(true);
  });

  it('should track active requests increment and decrement safely', () => {
    registry.recordRequestStart('server-1');
    registry.recordRequestStart('server-1');
    expect(registry.getServer('server-1')?.activeRequests).toBe(2);

    registry.recordRequestComplete('server-1', 45, false);
    expect(registry.getServer('server-1')?.activeRequests).toBe(1);

    // Guaranteed floor of zero
    registry.recordRequestComplete('server-1', 50, false);
    registry.recordRequestComplete('server-1', 50, false);
    expect(registry.getServer('server-1')?.activeRequests).toBe(0);
  });

  it('should update server weight and capacity dynamically', () => {
    expect(registry.updateWeight('server-1', 10)).toBe(true);
    expect(registry.getServer('server-1')?.weight).toBe(10);

    expect(registry.updateCapacity('server-1', 100)).toBe(true);
    expect(registry.getServer('server-1')?.capacity).toBe(100);

    expect(registry.updateWeight('non-existent', 5)).toBe(false);
  });

  it('should disable and re-enable server for traffic routing', () => {
    expect(registry.setServerEnabled('server-1', false)).toBe(true);
    expect(registry.getServer('server-1')?.enabled).toBe(false);

    let eligible = registry.getEligibleServers();
    expect(eligible.map((s) => s.id)).toEqual(['server-2']);

    expect(registry.setServerEnabled('server-1', true)).toBe(true);
    expect(registry.getServer('server-1')?.enabled).toBe(true);
    eligible = registry.getEligibleServers();
    expect(eligible.length).toBe(2);
  });
});
