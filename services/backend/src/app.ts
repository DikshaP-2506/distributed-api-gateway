import express, { Express } from 'express';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/requestId.js';
import { structuredLogger } from './middleware/logger.js';
import { createApiRouter, BackendState } from './routes/api.js';

export function createApp(state: BackendState): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Middleware pipeline
  app.use(requestIdMiddleware);
  app.use(structuredLogger(state.serverId));

  // Mount routes
  const apiRouter = createApiRouter(state);
  app.use(apiRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      serverId: state.serverId,
      error: 'Not Found',
      timestamp: new Date().toISOString()
    });
  });

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[${state.serverId}] Unhandled error:`, err);
    res.status(500).json({
      serverId: state.serverId,
      error: 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  });

  return app;
}
