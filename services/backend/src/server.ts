import { createApp } from './app.js';
import { BackendState } from './routes/api.js';

const serverId = process.env.SERVER_ID || 'server-1';
const port = parseInt(process.env.PORT || '3001', 10);
const version = process.env.VERSION || '1.0.0';
const isSimulatedUnhealthy = process.env.SIMULATE_UNHEALTHY === 'true';

const state: BackendState = {
  serverId,
  version,
  isSimulatedUnhealthy,
  startTime: Date.now()
};

const app = createApp(state);

const server = app.listen(port, () => {
  console.log(`[${serverId}] Backend Service running on port ${port} (v${version})`);
});

// Graceful shutdown handling
function gracefulShutdown(signal: string) {
  console.log(`[${serverId}] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log(`[${serverId}] HTTP server closed successfully.`);
    process.exit(0);
  });

  // Force close if stuck
  setTimeout(() => {
    console.error(`[${serverId}] Forced shutdown after timeout.`);
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
