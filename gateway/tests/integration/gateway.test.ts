import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createGatewayApp } from '../../src/app.js';
import { BackendRegistry } from '../../src/health/index.js';
import { LoadBalancerManager } from '../../src/load-balancer/index.js';
import { MetricsCollector } from '../../src/metrics/index.js';
import { RequestProxyHandler } from '../../src/proxy/index.js';
import { ExperimentRunner } from '../../src/experiments/runner.js';
import { GatewayDatabase } from '../../src/database/index.js';
import fs from 'node:fs';

describe('Gateway HTTP Integration Tests', () => {
  let app: Express;
  let registry: BackendRegistry;
  let lbManager: LoadBalancerManager;
  let metrics: MetricsCollector;
  let experimentRunner: ExperimentRunner;
  let proxyHandler: RequestProxyHandler;
  let db: GatewayDatabase;
  const testDbPath = './data/test_gateway.sqlite';

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }

    db = new GatewayDatabase(testDbPath);
    registry = new BackendRegistry(
      [
        { id: 'server-1', url: 'http://localhost:3001', weight: 5, capacity: 50 },
        { id: 'server-2', url: 'http://localhost:3002', weight: 3, capacity: 50 }
      ],
      undefined,
      db
    );
    lbManager = new LoadBalancerManager('round-robin');
    metrics = new MetricsCollector(registry, lbManager);
    experimentRunner = new ExperimentRunner(db);
    proxyHandler = new RequestProxyHandler(registry, lbManager, metrics, db);

    app = createGatewayApp({
      registry,
      lbManager,
      metrics,
      proxyHandler,
      experimentRunner,
      db,
      port: 8080
    });
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('GET /health returns 200 with gateway status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.component).toBe('api-gateway');
  });

  it('GET /admin/servers returns configured backend servers', async () => {
    const res = await request(app).get('/admin/servers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.servers)).toBe(true);
    expect(res.body.servers.length).toBe(2);
    expect(res.body.servers[0].id).toBe('server-1');
  });

  it('PUT /admin/config/algorithm switches the load balancing algorithm', async () => {
    const res = await request(app)
      .put('/admin/config/algorithm')
      .send({ algorithm: 'least-connections' });

    expect(res.status).toBe(200);
    expect(res.body.algorithm).toBe('least-connections');
    expect(lbManager.getActiveAlgorithm()).toBe('least-connections');
  });

  it('PUT /admin/config/algorithm rejects invalid algorithm name', async () => {
    const res = await request(app)
      .put('/admin/config/algorithm')
      .send({ algorithm: 'random-walk' });

    expect(res.status).toBe(400);
  });

  it('PUT /admin/servers/:id/weight modifies server weight', async () => {
    const res = await request(app)
      .put('/admin/servers/server-1/weight')
      .send({ weight: 12 });

    expect(res.status).toBe(200);
    expect(registry.getServer('server-1')?.weight).toBe(12);
  });

  it('POST /admin/servers/:id/disable and /enable controls server availability', async () => {
    const disableRes = await request(app).post('/admin/servers/server-1/disable');
    expect(disableRes.status).toBe(200);
    expect(registry.getServer('server-1')?.enabled).toBe(false);

    const enableRes = await request(app).post('/admin/servers/server-1/enable');
    expect(enableRes.status).toBe(200);
    expect(registry.getServer('server-1')?.enabled).toBe(true);
  });

  it('returns 503 when no healthy backend servers are available', async () => {
    registry.setServerEnabled('server-1', false);
    registry.setServerEnabled('server-2', false);

    const res = await request(app).get('/api/proxy/data');
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('No healthy backend servers available');
  });
});
