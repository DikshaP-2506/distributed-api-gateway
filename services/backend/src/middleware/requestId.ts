import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'] as string | undefined;
  const requestId = incomingId && incomingId.trim().length > 0 ? incomingId.trim() : crypto.randomUUID();

  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
