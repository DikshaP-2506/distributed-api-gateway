import http from 'node:http';
import { createGatewayApp } from './app.js';
import { BackendRegistry } from './health/index.js';
import { LoadBalancerManager } from './load-balancer/index.js';
import { MetricsCollector } from './metrics/index.js';
import { RequestProxyHandler } from './proxy/index.js';
import { ExperimentRunner } from './experiments/runner.js';
import { GatewayDatabase } from './database/index.js';
import { GatewayWebSocketManager } from './websocket/index.js';
import { AlgorithmType } from './types/index.js';

const port = parseInt(process.env.GATEWAY_PORT || process.env.PORT || '8080', 10);
const dbPath = process.env.DATABASE_PATH || './data/gateway.sqlite';
const defaultAlgorithm = (process.env.DEFAULT_ALGORITHM || 'round-robin') as AlgorithmType;

// Parse backend server URLs from environment or use standard defaults
const rawBackendServers = process.env.BACKEND_SERVERS || 'http://localhost:3001,http://localhost:3002,http://localhost:3003';
const backendUrls = rawBackendServers.split(',').map((u) => u.trim()).filter(Boolean);

const initialServers = backendUrls.map((url, idx) => {
  const serverId = `server-${idx + 1}`;
  const defaultWeights = [5, 3, 2];
  const weight = defaultWeights[idx] || 1;
  return {
    id: serverId,
    url,
    weight,
    capacity: 50
  };
});

// Initialize subsystems
const db = new GatewayDatabase(dbPath);
const registry = new BackendRegistry(
  initialServers,
  {
    checkIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '2000', 10),
    checkTimeoutMs: parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '1000', 10),
    unhealthyThreshold: parseInt(process.env.UNHEALTHY_THRESHOLD || '3', 10),
    recoveryThreshold: parseInt(process.env.RECOVERY_THRESHOLD || '2', 10)
  },
  db
);

const lbManager = new LoadBalancerManager(defaultAlgorithm);
const metrics = new MetricsCollector(registry, lbManager);
const experimentRunner = new ExperimentRunner(db);
const proxyHandler = new RequestProxyHandler(registry, lbManager, metrics, db);

const app = createGatewayApp({
  registry,
  lbManager,
  metrics,
  proxyHandler,
  experimentRunner,
  db,
  port
});

const httpServer = http.createServer(app);
const wsManager = new GatewayWebSocketManager(
  httpServer,
  registry,
  lbManager,
  metrics,
  experimentRunner,
  db
);

// Start health checks
registry.startHealthChecks();

httpServer.listen(port, () => {
  console.log(`====================================================`);
  console.log(`  Distributed API Gateway running on port ${port}`);
  console.log(`  Active Algorithm: ${lbManager.getActiveAlgorithm()}`);
  console.log(`  Upstream Backends: ${backendUrls.join(', ')}`);
  console.log(`  Database: ${dbPath}`);
  console.log(`====================================================`);
});

// Periodic DB cleanup (older than 24h)
setInterval(() => {
  db.cleanupOldLogs(24);
}, 60 * 60 * 1000).unref();

// Graceful shutdown
function gracefulShutdown(signal: string) {
  console.log(`\n[Gateway] Received ${signal}. Starting graceful shutdown...`);
  registry.stopHealthChecks();
  wsManager.stop();

  httpServer.close(() => {
    console.log('[Gateway] HTTP server closed.');
    db.close();
    console.log('[Gateway] Database closed. Process terminating.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[Gateway] Forced shutdown after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
