#!/usr/bin/env node
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const idNum = process.argv[2] || '1';
const serverId = `server-${idNum}`;
const port = 3000 + parseInt(idNum, 10);

console.log(`Starting ${serverId} on port ${port}...`);

const serverPath = path.resolve(__dirname, '../services/backend/dist/server.js');

const child = fork(serverPath, [], {
  env: {
    ...process.env,
    SERVER_ID: serverId,
    PORT: port.toString(),
    VERSION: '1.0.0',
    NODE_ENV: 'development'
  },
  stdio: 'inherit'
});

child.on('exit', (code) => {
  console.log(`[${serverId}] Exited with code ${code}`);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
