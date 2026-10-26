import { Router, Request, Response } from 'express';
import { z } from 'zod';

export interface BackendState {
  serverId: string;
  version: string;
  isSimulatedUnhealthy: boolean;
  startTime: number;
}

const workQuerySchema = z.object({
  duration: z.coerce.number().min(0).max(10000).default(50)
});

const slowQuerySchema = z.object({
  delay: z.coerce.number().min(0).max(15000).default(3000)
});

export function createApiRouter(state: BackendState): Router {
  const router = Router();

  // GET /health
  router.get('/health', (_req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    if (state.isSimulatedUnhealthy) {
      res.status(503).json({
        serverId: state.serverId,
        status: 'unhealthy',
        timestamp,
        error: 'Service in simulated degraded/unhealthy state'
      });
      return;
    }

    res.status(200).json({
      serverId: state.serverId,
      status: 'healthy',
      timestamp
    });
  });

  // POST /admin/simulate-health (toggle simulated health state for testing)
  router.post('/admin/simulate-health', (req: Request, res: Response) => {
    const { healthy } = req.body;
    state.isSimulatedUnhealthy = !healthy;
    console.log(`[${state.serverId}] Health simulation updated: isSimulatedUnhealthy=${state.isSimulatedUnhealthy}`);
    res.json({
      serverId: state.serverId,
      isSimulatedUnhealthy: state.isSimulatedUnhealthy,
      message: `Server health simulation set to ${state.isSimulatedUnhealthy ? 'UNHEALTHY' : 'HEALTHY'}`
    });
  });

  // GET /api/info
  router.get('/api/info', (_req: Request, res: Response) => {
    const uptimeSec = Math.floor((Date.now() - state.startTime) / 1000);
    res.json({
      serverId: state.serverId,
      version: state.version,
      timestamp: new Date().toISOString(),
      metadata: {
        uptimeSeconds: uptimeSec,
        nodeVersion: process.version,
        pid: process.pid,
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    });
  });

  // GET /api/data
  router.get('/api/data', (_req: Request, res: Response) => {
    res.json({
      serverId: state.serverId,
      timestamp: new Date().toISOString(),
      items: [
        { id: 1, name: `Record-A-${state.serverId}`, value: Math.floor(Math.random() * 1000) },
        { id: 2, name: `Record-B-${state.serverId}`, value: Math.floor(Math.random() * 1000) },
        { id: 3, name: `Record-C-${state.serverId}`, value: Math.floor(Math.random() * 1000) }
      ],
      total: 3
    });
  });

  // GET /api/work?duration=50
  router.get('/api/work', async (req: Request, res: Response) => {
    const parseResult = workQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        serverId: state.serverId,
        error: 'Invalid duration query parameter. Must be between 0 and 10000 ms.',
        details: parseResult.error.flatten()
      });
      return;
    }

    const { duration } = parseResult.data;
    const start = Date.now();

    // Non-blocking asynchronous work simulation
    await new Promise<void>((resolve) => setTimeout(resolve, duration));

    const actualDuration = Date.now() - start;

    res.json({
      serverId: state.serverId,
      processingDurationMs: actualDuration,
      requestedDurationMs: duration,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/slow?delay=3000
  router.get('/api/slow', async (req: Request, res: Response) => {
    const parseResult = slowQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        serverId: state.serverId,
        error: 'Invalid delay parameter. Must be between 0 and 15000 ms.',
        details: parseResult.error.flatten()
      });
      return;
    }

    const { delay } = parseResult.data;
    await new Promise<void>((resolve) => setTimeout(resolve, delay));

    res.json({
      serverId: state.serverId,
      delayMs: delay,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/fail - controlled 500 error for fault testing
  router.get('/api/fail', (_req: Request, res: Response) => {
    res.status(500).json({
      serverId: state.serverId,
      error: 'Simulated backend internal error for testing request-failure handling',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
