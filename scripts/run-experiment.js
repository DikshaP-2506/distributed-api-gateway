#!/usr/bin/env node

/**
 * Automated Experiment Runner
 * Executes a controlled benchmark across all four load balancing algorithms:
 * 1. Round Robin
 * 2. Weighted Round Robin
 * 3. Least Connections
 * 4. Adaptive Load Balancing
 *
 * Saves results to the Gateway SQLite database and displays comparative metrics.
 */

const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:8080';

const algorithms = [
  'round-robin',
  'weighted-round-robin',
  'least-connections',
  'adaptive'
];

async function runSingleExperiment(algo, count = 100, concurrency = 10, workDelay = 15) {
  // 1. Switch algorithm on gateway
  await fetch(`${gatewayUrl}/admin/config/algorithm`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ algorithm: algo })
  });

  // Short pause to ensure state is settled
  await new Promise((r) => setTimeout(r, 500));

  // 2. Trigger experiment via gateway API
  const res = await fetch(`${gatewayUrl}/admin/experiments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      experimentName: `Benchmark-${algo}`,
      algorithm: algo,
      totalRequests: count,
      concurrency,
      endpoint: `/api/proxy/work?duration=${workDelay}`,
      workDuration: workDelay
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed experiment for ${algo}: ${text}`);
  }

  const data = await res.json();
  return data.result;
}

async function main() {
  console.log(`\n========================================================================`);
  console.log(`  Distributed API Gateway - 4-Algorithm Comparative Benchmark Suite`);
  console.log(`========================================================================`);
  console.log(`  Gateway:      ${gatewayUrl}`);
  console.log(`  Requests/run: 100`);
  console.log(`  Concurrency:  10`);
  console.log(`  Work Delay:   15ms`);
  console.log(`------------------------------------------------------------------------\n`);

  const results = [];

  for (const algo of algorithms) {
    process.stdout.write(`  Running experiment for [${algo.padEnd(21)}] ... `);
    try {
      const res = await runSingleExperiment(algo, 100, 10, 15);
      results.push(res);
      console.log(`DONE! (${res.throughputRps} rps, P95: ${res.p95LatencyMs}ms)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  console.log(`\n========================================================================`);
  console.log(`  COMPARATIVE PERFORMANCE EVALUATION MATRIX`);
  console.log(`========================================================================`);
  console.log(`  Algorithm              Throughput    Avg Lat    P95 Lat    Distribution (s1:s2:s3)`);
  console.log(`  ------------------------------------------------------------------------`);

  for (const r of results) {
    const s1 = r.distribution['server-1'] || 0;
    const s2 = r.distribution['server-2'] || 0;
    const s3 = r.distribution['server-3'] || 0;
    const distStr = `${s1}:${s2}:${s3}`;

    console.log(
      `  ${r.algorithm.padEnd(22)} ` +
      `${(r.throughputRps + ' rps').padEnd(13)} ` +
      `${(r.averageLatencyMs + 'ms').padEnd(10)} ` +
      `${(r.p95LatencyMs + 'ms').padEnd(10)} ` +
      `${distStr}`
    );
  }

  console.log(`========================================================================\n`);
}

main().catch((err) => {
  console.error('Benchmark suite error:', err);
  process.exit(1);
});
