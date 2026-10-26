#!/usr/bin/env node

/**
 * Distributed API Gateway - Load Test Tool
 *
 * Generates configurable concurrent HTTP requests through the gateway
 * and computes actual wall-clock throughput, latency percentiles, and distribution.
 *
 * Usage:
 *   node scripts/load-test.js --requests 200 --concurrency 15 --endpoint /api/proxy/data
 */

const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:8080';

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

const totalRequests = parseInt(getArg('requests', '100'), 10);
const concurrency = parseInt(getArg('concurrency', '10'), 10);
const endpoint = getArg('endpoint', '/api/proxy/data');

async function main() {
  console.log(`\n======================================================`);
  console.log(`  Distributed API Gateway - Automated Load Tester`);
  console.log(`======================================================`);
  console.log(`  Target:       ${gatewayUrl}${endpoint}`);
  console.log(`  Requests:     ${totalRequests}`);
  console.log(`  Concurrency:  ${concurrency}`);
  console.log(`------------------------------------------------------\n`);

  const latencies = [];
  const distribution = {};
  let successCount = 0;
  let failureCount = 0;
  let nextIndex = 0;

  const wallClockStart = Date.now();

  const worker = async () => {
    while (nextIndex < totalRequests) {
      const _current = nextIndex++;
      const reqStart = Date.now();
      try {
        const res = await fetch(`${gatewayUrl}${endpoint}`);
        const lat = Date.now() - reqStart;
        latencies.push(lat);

        const backend = res.headers.get('x-backend-server') || 'unknown';
        distribution[backend] = (distribution[backend] || 0) + 1;

        if (res.ok) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (err) {
        const lat = Date.now() - reqStart;
        latencies.push(lat);
        failureCount++;
        distribution['network-error'] = (distribution['network-error'] || 0) + 1;
      }
    }
  };

  const pool = Array.from({ length: concurrency }, () => worker());
  await Promise.all(pool);

  const wallClockEnd = Date.now();
  const elapsedSec = Math.max(0.001, (wallClockEnd - wallClockStart) / 1000);
  const throughput = (totalRequests / elapsedSec).toFixed(2);

  latencies.sort((a, b) => a - b);
  const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  console.log(`RESULTS:`);
  console.log(`  Elapsed Time:     ${elapsedSec.toFixed(2)}s`);
  console.log(`  Throughput:       ${throughput} req/sec`);
  console.log(`  Successful:       ${successCount}`);
  console.log(`  Failed:           ${failureCount}`);
  console.log(`  Average Latency:  ${avg} ms`);
  console.log(`  P50 Latency:      ${p50} ms`);
  console.log(`  P95 Latency:      ${p95} ms`);
  console.log(`  P99 Latency:      ${p99} ms`);
  console.log(`\nREQUEST DISTRIBUTION:`);
  for (const [server, count] of Object.entries(distribution)) {
    const pct = ((count / totalRequests) * 100).toFixed(1);
    console.log(`  ${server.padEnd(15)} : ${count.toString().padStart(4)} (${pct}%)`);
  }
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Load test error:', err);
  process.exit(1);
});
