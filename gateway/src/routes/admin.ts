import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { BackendRegistry } from '../health/index.js';
import { LoadBalancerManager } from '../load-balancer/index.js';
import { MetricsCollector } from '../metrics/index.js';
import { GatewayDatabase } from '../database/index.js';
import { ExperimentRunner } from '../experiments/runner.js';
import { AlgorithmType } from '../types/index.js';

const algorithmSchema = z.object({
  algorithm: z.enum(['round-robin', 'weighted-round-robin', 'least-connections', 'adaptive'])
});

const weightSchema = z.object({
  weight: z.coerce.number().int().min(1).max(100)
});

const capacitySchema = z.object({
  capacity: z.coerce.number().int().min(1).max(1000)
});

const adaptiveWeightsSchema = z.object({
  latencyWeight: z.coerce.number().min(0).max(1).optional(),
  loadWeight: z.coerce.number().min(0).max(1).optional(),
  errorWeight: z.coerce.number().min(0).max(1).optional(),
  capacityWeight: z.coerce.number().min(0).max(1).optional()
});

const experimentSchema = z.object({
  experimentName: z.string().min(1).max(100).default('Load Test'),
  algorithm: z.enum(['round-robin', 'weighted-round-robin', 'least-connections', 'adaptive']),
  totalRequests: z.coerce.number().int().min(1).max(3000).default(100),
  concurrency: z.coerce.number().int().min(1).max(50).default(5),
  endpoint: z.string().default('/api/proxy/data'),
  workDuration: z.coerce.number().int().min(0).max(5000).optional()
});

export function createAdminRouter(
  registry: BackendRegistry,
  lbManager: LoadBalancerManager,
  metrics: MetricsCollector,
  experimentRunner: ExperimentRunner,
  db?: GatewayDatabase,
  gatewayPort: number = 8080
): Router {
  const router = Router();

  // GET /admin/overview
  router.get('/overview', (_req: Request, res: Response) => {
    const metricSnapshot = metrics.getSnapshot();
    const servers = registry.getServers();
    const healthyCount = servers.filter((s) => s.status === 'HEALTHY' && s.enabled).length;
    const healthEvents = db ? db.getRecentHealthEvents(5) : [];

    res.json({
      metrics: metricSnapshot,
      algorithm: lbManager.getActiveAlgorithm(),
      totalServers: servers.length,
      healthyServers: healthyCount,
      activeRequests: metricSnapshot.activeRequests,
      recentHealthEvents: healthEvents,
      timestamp: new Date().toISOString()
    });
  });

  // GET /admin/servers
  router.get('/servers', (_req: Request, res: Response) => {
    const servers = registry.getServers();
    const adaptiveScores = lbManager.getAdaptiveScores(servers);

    const result = servers.map((s) => {
      const scoreData = adaptiveScores.find((sc) => sc.serverId === s.id);
      return {
        ...s,
        adaptiveScore: scoreData ? scoreData.score : null,
        scoreBreakdown: scoreData || null
      };
    });

    res.json({ servers: result, timestamp: new Date().toISOString() });
  });

  // GET /admin/servers/:id
  router.get('/servers/:id', (req: Request, res: Response) => {
    const server = registry.getServer(req.params.id);
    if (!server) {
      res.status(404).json({ error: `Server ${req.params.id} not found` });
      return;
    }
    res.json({ server });
  });

  // PUT /admin/config/algorithm
  router.put('/config/algorithm', (req: Request, res: Response) => {
    const parse = algorithmSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid algorithm', details: parse.error.flatten() });
      return;
    }

    const { algorithm } = parse.data;
    const success = lbManager.setAlgorithm(algorithm as AlgorithmType);
    if (!success) {
      res.status(400).json({ error: `Unknown algorithm ${algorithm}` });
      return;
    }

    res.json({
      message: `Active load balancing algorithm changed to ${algorithm}`,
      algorithm
    });
  });

  // PUT /admin/servers/:id/weight
  router.put('/servers/:id/weight', (req: Request, res: Response) => {
    const parse = weightSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid weight (must be 1-100)', details: parse.error.flatten() });
      return;
    }

    const success = registry.updateWeight(req.params.id, parse.data.weight);
    if (!success) {
      res.status(404).json({ error: `Server ${req.params.id} not found` });
      return;
    }

    res.json({ message: `Weight updated for ${req.params.id}`, serverId: req.params.id, weight: parse.data.weight });
  });

  // PUT /admin/servers/:id/capacity
  router.put('/servers/:id/capacity', (req: Request, res: Response) => {
    const parse = capacitySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid capacity (must be 1-1000)', details: parse.error.flatten() });
      return;
    }

    const success = registry.updateCapacity(req.params.id, parse.data.capacity);
    if (!success) {
      res.status(404).json({ error: `Server ${req.params.id} not found` });
      return;
    }

    res.json({ message: `Capacity updated for ${req.params.id}`, serverId: req.params.id, capacity: parse.data.capacity });
  });

  // POST /admin/servers/:id/disable
  router.post('/servers/:id/disable', (req: Request, res: Response) => {
    const success = registry.setServerEnabled(req.params.id, false);
    if (!success) {
      res.status(404).json({ error: `Server ${req.params.id} not found` });
      return;
    }
    res.json({ message: `Server ${req.params.id} disabled from routing`, serverId: req.params.id, enabled: false });
  });

  // POST /admin/servers/:id/enable
  router.post('/servers/:id/enable', (req: Request, res: Response) => {
    const success = registry.setServerEnabled(req.params.id, true);
    if (!success) {
      res.status(404).json({ error: `Server ${req.params.id} not found` });
      return;
    }
    res.json({ message: `Server ${req.params.id} enabled for routing`, serverId: req.params.id, enabled: true });
  });

  // GET /admin/metrics/summary
  router.get('/metrics/summary', (_req: Request, res: Response) => {
    res.json(metrics.getSnapshot());
  });

  // GET /admin/metrics/traffic
  router.get('/metrics/traffic', (req: Request, res: Response) => {
    const limit = Math.min(200, parseInt((req.query.limit as string) || '50', 10));
    const logs = db ? db.getRecentRequestLogs(limit) : [];
    res.json({ logs });
  });

  // GET /admin/metrics/latency
  router.get('/metrics/latency', (_req: Request, res: Response) => {
    const percentiles = metrics.calculatePercentiles();
    res.json({
      percentiles,
      timestamp: new Date().toISOString()
    });
  });

  // GET /admin/metrics/distribution
  router.get('/metrics/distribution', (_req: Request, res: Response) => {
    const servers = registry.getServers();
    const distribution: Record<string, { requests: number; percentage: number }> = {};
    const total = servers.reduce((acc, s) => acc + s.totalRequests, 0);

    for (const s of servers) {
      const percentage = total > 0 ? Number(((s.totalRequests / total) * 100).toFixed(1)) : 0;
      distribution[s.id] = { requests: s.totalRequests, percentage };
    }

    res.json({ distribution, totalRequests: total });
  });

  // GET /admin/health-events
  router.get('/health-events', (req: Request, res: Response) => {
    const limit = Math.min(200, parseInt((req.query.limit as string) || '50', 10));
    const events = db ? db.getRecentHealthEvents(limit) : [];
    res.json({ events });
  });

  // GET /admin/config
  router.get('/config', (_req: Request, res: Response) => {
    res.json({
      activeAlgorithm: lbManager.getActiveAlgorithm(),
      adaptiveWeights: lbManager.getAdaptiveWeights(),
      gatewayPort
    });
  });

  // PUT /admin/config/adaptive-weights
  router.put('/config/adaptive-weights', (req: Request, res: Response) => {
    const parse = adaptiveWeightsSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid adaptive weights', details: parse.error.flatten() });
      return;
    }
    lbManager.setAdaptiveWeights(parse.data);
    res.json({
      message: 'Adaptive weights updated',
      adaptiveWeights: lbManager.getAdaptiveWeights()
    });
  });

  // GET /admin/experiments
  router.get('/experiments', (_req: Request, res: Response) => {
    const runs = db ? db.getExperimentRuns() : [];
    res.json({ experiments: runs });
  });

  // GET /admin/experiments/:id
  router.get('/experiments/:id', (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid experiment ID' });
      return;
    }
    const run = db ? db.getExperimentRunById(id) : null;
    if (!run) {
      res.status(404).json({ error: 'Experiment not found' });
      return;
    }
    res.json({ experiment: run });
  });

  // POST /admin/experiments
  router.post('/experiments', async (req: Request, res: Response) => {
    const parse = experimentSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid experiment parameters', details: parse.error.flatten() });
      return;
    }

    if (experimentRunner.isBusy()) {
      res.status(409).json({ error: 'Another experiment is currently running. Please wait.' });
      return;
    }

    const { experimentName, algorithm, totalRequests, concurrency, endpoint, workDuration } = parse.data;

    let targetEndpoint = endpoint;
    if (workDuration !== undefined && workDuration > 0) {
      targetEndpoint = `/api/proxy/work?duration=${workDuration}`;
    }

    // Set the requested algorithm on the gateway for the experiment
    lbManager.setAlgorithm(algorithm as AlgorithmType);

    try {
      const result = await experimentRunner.runExperiment({
        experimentName,
        algorithm: algorithm as AlgorithmType,
        totalRequests,
        concurrency,
        endpoint: targetEndpoint,
        gatewayPort
      });

      res.status(201).json({ message: 'Experiment completed successfully', result });
    } catch (err: any) {
      res.status(500).json({ error: `Experiment execution failed: ${err.message}` });
    }
  });

  // POST /admin/experiments/abort
  router.post('/admin/experiments/abort', (_req: Request, res: Response) => {
    experimentRunner.abort();
    res.json({ message: 'Experiment abort requested' });
  });

  return router;
}
