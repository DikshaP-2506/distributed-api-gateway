import { EventEmitter } from 'node:events';
import { AlgorithmType, ExperimentRun } from '../types/index.js';
import { GatewayDatabase } from '../database/index.js';

export interface ExperimentParams {
  experimentName: string;
  algorithm: AlgorithmType;
  totalRequests: number;
  concurrency: number;
  endpoint: string; // e.g. '/api/proxy/work?duration=20' or '/api/proxy/data'
  gatewayPort: number;
}

export class ExperimentRunner extends EventEmitter {
  private isRunning: boolean = false;
  private shouldAbort: boolean = false;

  constructor(private db?: GatewayDatabase) {
    super();
  }

  isBusy(): boolean {
    return this.isRunning;
  }

  abort(): void {
    if (this.isRunning) {
      this.shouldAbort = true;
    }
  }

  async runExperiment(params: ExperimentParams): Promise<ExperimentRun> {
    if (this.isRunning) {
      throw new Error('An experiment is already in progress.');
    }

    this.isRunning = true;
    this.shouldAbort = false;

    const startedAt = new Date().toISOString();
    const wallClockStart = Date.now();

    this.emit('experimentStarted', {
      name: params.experimentName,
      algorithm: params.algorithm,
      totalRequests: params.totalRequests,
      concurrency: params.concurrency,
      startedAt
    });

    const latencies: number[] = [];
    const distribution: Record<string, number> = {};
    let successCount = 0;
    let failureCount = 0;
    let completedRequests = 0;

    // Queue of request indices
    let nextIndex = 0;
    const total = Math.min(Math.max(1, params.totalRequests), 5000);
    const concurrency = Math.min(Math.max(1, params.concurrency), 50);

    const worker = async () => {
      while (nextIndex < total && !this.shouldAbort) {
        const _currentIdx = nextIndex++;
        const reqStart = Date.now();

        try {
          const targetUrl = `http://127.0.0.1:${params.gatewayPort}${params.endpoint}`;
          const res = await fetch(targetUrl, {
            headers: { 'Accept': 'application/json' }
          });

          const latency = Date.now() - reqStart;
          latencies.push(latency);

          const backendServer = res.headers.get('x-backend-server') || 'unknown';
          distribution[backendServer] = (distribution[backendServer] || 0) + 1;

          if (res.ok) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch {
          const latency = Date.now() - reqStart;
          latencies.push(latency);
          failureCount++;
          distribution['failed-network'] = (distribution['failed-network'] || 0) + 1;
        } finally {
          completedRequests++;
          if (completedRequests % Math.max(1, Math.floor(total / 10)) === 0 || completedRequests === total) {
            this.emit('experimentProgress', {
              completed: completedRequests,
              total,
              percent: Math.round((completedRequests / total) * 100)
            });
          }
        }
      }
    };

    // Run pool of concurrent workers
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    const wallClockEnd = Date.now();
    const completedAt = new Date().toISOString();
    const elapsedSeconds = Math.max(0.001, (wallClockEnd - wallClockStart) / 1000);
    const throughputRps = Number((completedRequests / elapsedSeconds).toFixed(2));

    // Calculate percentiles
    const sorted = [...latencies].sort((a, b) => a - b);
    const avgLatency = sorted.length > 0
      ? Number((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2))
      : 0;
    const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    const runResult: ExperimentRun = {
      experimentName: params.experimentName,
      algorithm: params.algorithm,
      totalRequests: completedRequests,
      concurrency: params.concurrency,
      successCount,
      failureCount,
      averageLatencyMs: avgLatency,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      throughputRps,
      distribution,
      startedAt,
      completedAt
    };

    if (this.db) {
      const runId = this.db.insertExperimentRun(runResult);
      runResult.id = runId;
    }

    this.isRunning = false;
    this.shouldAbort = false;

    this.emit('experimentCompleted', runResult);
    return runResult;
  }
}
