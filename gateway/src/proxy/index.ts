import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { BackendRegistry } from '../health/index.js';
import { LoadBalancerManager } from '../load-balancer/index.js';
import { MetricsCollector } from '../metrics/index.js';
import { GatewayDatabase } from '../database/index.js';
import { BackendServer, RequestLogEntry } from '../types/index.js';

export interface ProxyOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export class RequestProxyHandler {
  private timeoutMs: number;
  private maxRetries: number;

  constructor(
    private registry: BackendRegistry,
    private lbManager: LoadBalancerManager,
    private metrics: MetricsCollector,
    private db?: GatewayDatabase,
    options?: ProxyOptions
  ) {
    this.timeoutMs = options?.timeoutMs || 8000;
    this.maxRetries = options?.maxRetries || 1; // 1 initial + 1 retry max for safe requests
  }

  async handleProxyRequest(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    req.headers['x-request-id'] = requestId;

    // Map `/api/proxy/*` to `/api/*` on backend
    const targetPath = req.originalUrl.replace(/^\/api\/proxy/, '/api');
    const isIdempotent = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());

    this.metrics.incrementActiveRequests();

    const excludedServerIds = new Set<string>();
    let attempts = 0;
    let lastError: Error | null = null;
    let selectedServer: BackendServer | null = null;
    let responseStatus = 500;
    let outcome: RequestLogEntry['outcome'] = 'GATEWAY_ERROR';

    try {
      while (attempts <= (isIdempotent ? this.maxRetries : 0)) {
        attempts++;

        // Filter out previously failed backends for this request
        const availableServers = this.registry
          .getServers()
          .filter((s) => !excludedServerIds.has(s.id));

        selectedServer = this.lbManager.selectServer({
          servers: availableServers,
          requestId,
          method: req.method,
          path: targetPath
        });

        if (!selectedServer) {
          // No eligible server left
          if (attempts > 1) {
            // We retried once and ran out of servers
            break;
          }

          const durationMs = Date.now() - startTime;
          this.metrics.recordRequest({ statusCode: 503, latencyMs: durationMs, outcome: 'GATEWAY_ERROR' });

          res.status(503).json({
            error: 'No healthy backend servers available',
            statusCode: 503,
            requestId,
            timestamp: new Date().toISOString()
          });
          return;
        }

        if (attempts > 1) {
          this.metrics.recordRetry();
        }

        this.registry.recordRequestStart(selectedServer.id);

        try {
          const targetUrl = `${selectedServer.url}${targetPath}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

          const headersToForward: Record<string, string> = {
            'x-request-id': requestId,
            'accept': req.headers['accept'] || 'application/json'
          };

          if (req.headers['content-type']) {
            headersToForward['content-type'] = req.headers['content-type'] as string;
          }

          const fetchOptions: RequestInit = {
            method: req.method,
            headers: headersToForward,
            signal: controller.signal
          };

          if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase()) && req.body) {
            fetchOptions.body = JSON.stringify(req.body);
          }

          const response = await fetch(targetUrl, fetchOptions);
          clearTimeout(timeoutId);

          const durationMs = Date.now() - startTime;
          responseStatus = response.status;

          // Record completed request in registry
          const isErrorStatus = responseStatus >= 500;
          this.registry.recordRequestComplete(selectedServer.id, durationMs, isErrorStatus);

          // Classify outcome
          if (responseStatus >= 200 && responseStatus < 400) {
            outcome = 'SUCCESS';
          } else if (responseStatus >= 400 && responseStatus < 500) {
            outcome = 'CLIENT_ERROR';
          } else {
            outcome = 'SERVER_ERROR';
          }

          // Forward response headers
          res.setHeader('x-request-id', requestId);
          res.setHeader('x-backend-server', selectedServer.id);
          res.setHeader('x-load-balancer-algorithm', this.lbManager.getActiveAlgorithm());
          res.setHeader('x-gateway-latency-ms', durationMs.toString());

          const contentType = response.headers.get('content-type') || 'application/json';
          res.setHeader('content-type', contentType);
          res.status(responseStatus);

          const responseData = await response.text();
          res.send(responseData);

          // Record metrics and log
          this.metrics.recordRequest({ statusCode: responseStatus, latencyMs: durationMs, outcome });
          if (this.db) {
            this.db.insertRequestLog({
              requestId,
              backendId: selectedServer.id,
              method: req.method,
              route: targetPath,
              statusCode: responseStatus,
              latencyMs: durationMs,
              outcome,
              timestamp: new Date().toISOString()
            });
          }
          return;
        } catch (fetchErr: any) {
          const durationMs = Date.now() - startTime;
          this.registry.recordRequestComplete(selectedServer.id, durationMs, true);

          if (fetchErr.name === 'AbortError') {
            outcome = 'TIMEOUT';
            lastError = new Error(`Request to ${selectedServer.id} timed out after ${this.timeoutMs}ms`);
            // Do not retry on timeout if request might have been processed
            break;
          } else {
            // Network connection error: exclude this server and retry if eligible
            excludedServerIds.add(selectedServer.id);
            lastError = fetchErr;
            if (!isIdempotent) {
              break;
            }
          }
        }
      }

      // If we reach here, request failed after all attempts
      const durationMs = Date.now() - startTime;
      const isTimeout = outcome === 'TIMEOUT';
      const statusCode = isTimeout ? 504 : 502;
      const message = isTimeout
        ? 'Gateway Timeout: Backend did not respond within configured threshold'
        : (lastError ? `Bad Gateway: ${lastError.message}` : 'Bad Gateway');

      this.metrics.recordRequest({ statusCode, latencyMs: durationMs, outcome: isTimeout ? 'TIMEOUT' : 'GATEWAY_ERROR' });

      if (this.db && selectedServer) {
        this.db.insertRequestLog({
          requestId,
          backendId: selectedServer.id,
          method: req.method,
          route: targetPath,
          statusCode,
          latencyMs: durationMs,
          outcome: isTimeout ? 'TIMEOUT' : 'GATEWAY_ERROR',
          timestamp: new Date().toISOString()
        });
      }

      res.status(statusCode).json({
        error: message,
        statusCode,
        requestId,
        attempts,
        lastBackend: selectedServer?.id || 'none',
        timestamp: new Date().toISOString()
      });
    } finally {
      this.metrics.decrementActiveRequests();
    }
  }
}
