import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { BackendServer, HealthTransitionEvent, RequestLogEntry, ExperimentRun } from '../types/index.js';

export class GatewayDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string = './data/gateway.sqlite') {
    // Ensure parent directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backend_config (
        server_id TEXT PRIMARY KEY,
        base_url TEXT NOT NULL,
        weight INTEGER NOT NULL DEFAULT 1,
        capacity INTEGER NOT NULL DEFAULT 50,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        backend_id TEXT NOT NULL,
        method TEXT NOT NULL,
        route TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        latency_ms REAL NOT NULL,
        outcome TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_request_logs_backend ON request_logs(backend_id);

      CREATE TABLE IF NOT EXISTS health_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backend_id TEXT NOT NULL,
        previous_state TEXT NOT NULL,
        current_state TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_health_events_created_at ON health_events(created_at);

      CREATE TABLE IF NOT EXISTS experiment_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        experiment_name TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        total_requests INTEGER NOT NULL,
        concurrency INTEGER NOT NULL,
        success_count INTEGER NOT NULL,
        failure_count INTEGER NOT NULL,
        average_latency_ms REAL NOT NULL,
        p50_latency_ms REAL NOT NULL,
        p95_latency_ms REAL NOT NULL,
        p99_latency_ms REAL NOT NULL,
        throughput_rps REAL NOT NULL,
        distribution TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_experiment_runs_started_at ON experiment_runs(started_at);
    `);
  }

  // Backend Config CRUD
  upsertBackendConfig(server: { id: string; url: string; weight: number; capacity: number; enabled: boolean }): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO backend_config (server_id, base_url, weight, capacity, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(server_id) DO UPDATE SET
        base_url = excluded.base_url,
        weight = excluded.weight,
        capacity = excluded.capacity,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);
    stmt.run(server.id, server.url, server.weight, server.capacity, server.enabled ? 1 : 0, now, now);
  }

  updateBackendWeight(serverId: string, weight: number): void {
    const stmt = this.db.prepare(`
      UPDATE backend_config SET weight = ?, updated_at = ? WHERE server_id = ?
    `);
    stmt.run(weight, new Date().toISOString(), serverId);
  }

  updateBackendCapacity(serverId: string, capacity: number): void {
    const stmt = this.db.prepare(`
      UPDATE backend_config SET capacity = ?, updated_at = ? WHERE server_id = ?
    `);
    stmt.run(capacity, new Date().toISOString(), serverId);
  }

  updateBackendEnabled(serverId: string, enabled: boolean): void {
    const stmt = this.db.prepare(`
      UPDATE backend_config SET enabled = ?, updated_at = ? WHERE server_id = ?
    `);
    stmt.run(enabled ? 1 : 0, new Date().toISOString(), serverId);
  }

  getBackendConfigs(): any[] {
    const stmt = this.db.prepare(`SELECT * FROM backend_config ORDER BY server_id`);
    return stmt.all();
  }

  // Request Logs
  insertRequestLog(log: RequestLogEntry): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO request_logs (request_id, backend_id, method, route, status_code, latency_ms, outcome, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(log.requestId, log.backendId, log.method, log.route, log.statusCode, log.latencyMs, log.outcome, log.timestamp);
    } catch (err) {
      console.error('[DB] Failed to insert request log:', err);
    }
  }

  getRecentRequestLogs(limit: number = 100): RequestLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, request_id as requestId, backend_id as backendId, method, route,
             status_code as statusCode, latency_ms as latencyMs, outcome, created_at as timestamp
      FROM request_logs
      ORDER BY id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as unknown as RequestLogEntry[];
  }

  // Health Events
  insertHealthEvent(event: HealthTransitionEvent): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO health_events (backend_id, previous_state, current_state, reason, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(event.backendId, event.previousState, event.currentState, event.reason, event.timestamp);
    } catch (err) {
      console.error('[DB] Failed to insert health event:', err);
    }
  }

  getRecentHealthEvents(limit: number = 50): HealthTransitionEvent[] {
    const stmt = this.db.prepare(`
      SELECT id, backend_id as backendId, previous_state as previousState,
             current_state as currentState, reason, created_at as timestamp
      FROM health_events
      ORDER BY id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as unknown as HealthTransitionEvent[];
  }

  // Experiment Runs
  insertExperimentRun(run: ExperimentRun): number {
    const stmt = this.db.prepare(`
      INSERT INTO experiment_runs (
        experiment_name, algorithm, total_requests, concurrency,
        success_count, failure_count, average_latency_ms, p50_latency_ms,
        p95_latency_ms, p99_latency_ms, throughput_rps, distribution,
        started_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      run.experimentName,
      run.algorithm,
      run.totalRequests,
      run.concurrency,
      run.successCount,
      run.failureCount,
      run.averageLatencyMs,
      run.p50LatencyMs,
      run.p95LatencyMs,
      run.p99LatencyMs,
      run.throughputRps,
      JSON.stringify(run.distribution),
      run.startedAt,
      run.completedAt
    );
    return Number(result.lastInsertRowid);
  }

  getExperimentRuns(): ExperimentRun[] {
    const stmt = this.db.prepare(`
      SELECT id, experiment_name as experimentName, algorithm, total_requests as totalRequests,
             concurrency, success_count as successCount, failure_count as failureCount,
             average_latency_ms as averageLatencyMs, p50_latency_ms as p50LatencyMs,
             p95_latency_ms as p95LatencyMs, p99_latency_ms as p99LatencyMs,
             throughput_rps as throughputRps, distribution,
             started_at as startedAt, completed_at as completedAt
      FROM experiment_runs
      ORDER BY id DESC
    `);
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      ...r,
      distribution: typeof r.distribution === 'string' ? JSON.parse(r.distribution) : r.distribution
    }));
  }

  getExperimentRunById(id: number): ExperimentRun | null {
    const stmt = this.db.prepare(`
      SELECT id, experiment_name as experimentName, algorithm, total_requests as totalRequests,
             concurrency, success_count as successCount, failure_count as failureCount,
             average_latency_ms as averageLatencyMs, p50_latency_ms as p50LatencyMs,
             p95_latency_ms as p95LatencyMs, p99_latency_ms as p99LatencyMs,
             throughput_rps as throughputRps, distribution,
             started_at as startedAt, completed_at as completedAt
      FROM experiment_runs
      WHERE id = ?
    `);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return {
      ...row,
      distribution: typeof row.distribution === 'string' ? JSON.parse(row.distribution) : row.distribution
    };
  }

  cleanupOldLogs(retentionHours: number = 24): void {
    try {
      const cutoff = new Date(Date.now() - retentionHours * 3600 * 1000).toISOString();
      const stmt = this.db.prepare('DELETE FROM request_logs WHERE created_at < ?');
      stmt.run(cutoff);
    } catch (err) {
      console.error('[DB] Log cleanup error:', err);
    }
  }

  close(): void {
    this.db.close();
  }
}
