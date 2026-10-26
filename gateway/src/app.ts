import express, { Express } from 'express';
import cors from 'cors';
import { BackendRegistry } from './health/index.js';
import { LoadBalancerManager } from './load-balancer/index.js';
import { MetricsCollector } from './metrics/index.js';
import { RequestProxyHandler } from './proxy/index.js';
import { ExperimentRunner } from './experiments/runner.js';
import { GatewayDatabase } from './database/index.js';
import { createAdminRouter } from './routes/admin.js';

export interface GatewayAppContext {
  registry: BackendRegistry;
  lbManager: LoadBalancerManager;
  metrics: MetricsCollector;
  proxyHandler: RequestProxyHandler;
  experimentRunner: ExperimentRunner;
  db?: GatewayDatabase;
  port: number;
}

export function createGatewayApp(ctx: GatewayAppContext): Express {
  const app = express();

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Accept']
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Gateway's own health status
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      component: 'api-gateway',
      activeAlgorithm: ctx.lbManager.getActiveAlgorithm(),
      timestamp: new Date().toISOString()
    });
  });

  // Mount Admin API routes
  const adminRouter = createAdminRouter(
    ctx.registry,
    ctx.lbManager,
    ctx.metrics,
    ctx.experimentRunner,
    ctx.db,
    ctx.port
  );
  app.use('/admin', adminRouter);

  // Mount Proxy routes
  app.all('/api/proxy/*', (req, res) => {
    ctx.proxyHandler.handleProxyRequest(req, res);
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error: 'Not Found',
      hint: 'API Gateway routes are mounted at /api/proxy/* and administrative endpoints at /admin/*',
      timestamp: new Date().toISOString()
    });
  });

  // Global Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Gateway] Unhandled error:', err);
    res.status(500).json({
      error: 'Internal Gateway Error',
      timestamp: new Date().toISOString()
    });
  });

  return app;
}
