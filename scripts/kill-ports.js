#!/usr/bin/env node
import { execSync } from 'node:child_process';

const ports = [3001, 3002, 3003, 8080, 5173];

console.log(`Checking and freeing ports: ${ports.join(', ')}...`);

for (const port of ports) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && !isNaN(pid)) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            console.log(`Freed port ${port} by terminating PID ${pid}`);
          } catch {}
        }
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch {}
}

console.log('Ports are clear.');
