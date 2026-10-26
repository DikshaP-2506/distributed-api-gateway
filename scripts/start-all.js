#!/usr/bin/env node
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendScript = path.resolve(__dirname, '../services/backend/dist/server.js');
const gatewayScript = path.resolve(__dirname, '../gateway/dist/server.js');

const children = [];

function startBackend(serverId, port) {
  console.log(`[Init] Starting ${serverId} on port ${port}...`);
  const child = fork(backendScript, [], {
    env: {
      ...process.env,
      SERVER_ID: serverId,
      PORT: port.toString(),
      VERSION: '1.0.0',
      NODE_ENV: 'development'
    },
    stdio: 'inherit'
  });
  children.push(child);
}

function startGateway() {
  console.log(`[Init] Starting API Gateway on port 8080...`);
  const child = fork(gatewayScript, [], {
    env: {
      ...process.env,
      GATEWAY_PORT: '8080',
      DEFAULT_ALGORITHM: 'round-robin',
      BACKEND_SERVERS: 'http://localhost:3001,http://localhost:3002,http://localhost:3003',
      DATABASE_PATH: './data/gateway.sqlite',
      NODE_ENV: 'development'
    },
    stdio: 'inherit'
  });
  children.push(child);
}

// Start 3 independent backend instances
startBackend('server-1', 3001);
startBackend('server-2', 3002);
startBackend('server-3', 3003);

// Wait 1 second and start gateway
setTimeout(() => {
  startGateway();
}, 1000);

function shutdown() {
  console.log('\n[Orchestrator] Shutting down all services...');
  for (const child of children) {
    try {
      child.kill('SIGINT');
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
