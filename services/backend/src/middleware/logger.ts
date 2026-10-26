import { Request, Response, NextFunction } from 'express';

export function structuredLogger(serverId: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      const requestId = (req.headers['x-request-id'] as string) || '-';

      // Avoid spamming health check logs unless unhealthy or in error
      if (req.path === '/health' && res.statusCode === 200) {
        return;
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        serverId,
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2))
      };

      console.log(`[${serverId}] [${logEntry.timestamp}] ${logEntry.method} ${logEntry.path} -> ${logEntry.statusCode} (${logEntry.durationMs}ms)`);
    });

    next();
  };
}
