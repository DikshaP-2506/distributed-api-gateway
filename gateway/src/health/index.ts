import { EventEmitter } from 'node:events';
import { BackendServer, HealthTransitionEvent, ServerHealthState } from '../types/index.js';
import { GatewayDatabase } from '../database/index.js';

export interface HealthMonitorConfig {
  checkIntervalMs: number;
  checkTimeoutMs: number;
  unhealthyThreshold: number;
  recoveryThreshold: number;
}

export class BackendRegistry extends EventEmitter {
  private servers: Map<string, BackendServer> = new Map();
  private checkTimer: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;
  private config: HealthMonitorConfig;
  private db?: GatewayDatabase;

  constructor(
    initialServers: Array<{ id: string; url: string; weight?: number; capacity?: number }>,
    config?: Partial<HealthMonitorConfig>,
    db?: GatewayDatabase
  ) {
    super();
    this.db = db;
    this.config = {
      checkIntervalMs: config?.checkIntervalMs || 2000,
      checkTimeoutMs: config?.checkTimeoutMs || 1000,
      unhealthyThreshold: config?.unhealthyThreshold || 3,
      recoveryThreshold: config?.recoveryThreshold || 2
    };

    // Load persisted configs if available
    const savedConfigs = this.db ? this.db.getBackendConfigs() : [];
    const configMap = new Map<string, any>(savedConfigs.map((c) => [c.server_id, c]));

    for (const s of initialServers) {
      const saved = configMap.get(s.id);
      const weight = saved ? saved.weight : (s.weight ?? 1);
      const capacity = saved ? saved.capacity : (s.capacity ?? 50);
      const enabled = saved ? Boolean(saved.enabled) : true;

      const server: BackendServer = {
        id: s.id,
        url: s.url,
        status: 'HEALTHY',
        weight,
        capacity,
        activeRequests: 0,
        totalRequests: 0,
        recentLatencies: [],
        errorCount: 0,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        enabled,
        lastHealthCheck: null,
        lastError: null,
        currentWeight: 0
      };

      this.servers.set(s.id, server);

      if (this.db) {
        this.db.upsertBackendConfig({
          id: server.id,
          url: server.url,
          weight: server.weight,
          capacity: server.capacity,
          enabled: server.enabled
        });
      }
    }
  }

  getServers(): BackendServer[] {
    return Array.from(this.servers.values());
  }

  getServer(id: string): BackendServer | undefined {
    return this.servers.get(id);
  }

  getEligibleServers(): BackendServer[] {
    return Array.from(this.servers.values()).filter(
      (s) => (s.status === 'HEALTHY' || s.status === 'RECOVERING') && s.enabled
    );
  }

  startHealthChecks(): void {
    if (this.checkTimer) return;
    this.runHealthChecks(); // Immediate initial run
    this.checkTimer = setInterval(() => {
      this.runHealthChecks();
    }, this.config.checkIntervalMs);
  }

  stopHealthChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  async runHealthChecks(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const checks = Array.from(this.servers.values()).map((server) =>
        this.checkSingleServer(server)
      );
      await Promise.allSettled(checks);
    } finally {
      this.isChecking = false;
    }
  }

  private async checkSingleServer(server: BackendServer): Promise<void> {
    const healthUrl = `${server.url}/health`;
    const previousState = server.status;
    let isHealthy = false;
    let errorReason = '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.checkTimeoutMs);

      const response = await fetch(healthUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const body = await response.json() as any;
        if (body.status === 'healthy') {
          isHealthy = true;
        } else {
          errorReason = `Backend reported unhealthy status: ${body.status || 'unknown'}`;
        }
      } else {
        errorReason = `HTTP ${response.status} ${response.statusText}`;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        errorReason = `Health check timed out after ${this.config.checkTimeoutMs}ms`;
      } else {
        errorReason = `Connection failed: ${err.message || 'Network error'}`;
      }
    }

    server.lastHealthCheck = new Date().toISOString();

    if (isHealthy) {
      server.consecutiveSuccesses++;
      server.consecutiveFailures = 0;
      server.lastError = null;

      if (server.status === 'UNHEALTHY') {
        // First success after being unhealthy -> transition to RECOVERING
        this.transitionState(server, 'RECOVERING', `Health check passed (${server.consecutiveSuccesses}/${this.config.recoveryThreshold})`);
      } else if (server.status === 'RECOVERING') {
        if (server.consecutiveSuccesses >= this.config.recoveryThreshold) {
          // Reached recovery threshold -> transition to HEALTHY
          this.transitionState(server, 'HEALTHY', `Recovered after ${server.consecutiveSuccesses} consecutive successful checks`);
        }
      }
    } else {
      server.consecutiveFailures++;
      server.consecutiveSuccesses = 0;
      server.lastError = errorReason;

      if (server.status === 'HEALTHY' || server.status === 'RECOVERING') {
        if (server.consecutiveFailures >= this.config.unhealthyThreshold) {
          this.transitionState(server, 'UNHEALTHY', `${errorReason} (${server.consecutiveFailures} consecutive failures)`);
        }
      }
    }
  }

  private transitionState(server: BackendServer, newState: ServerHealthState, reason: string): void {
    const previousState = server.status;
    if (previousState === newState) return;

    server.status = newState;
    const event: HealthTransitionEvent = {
      backendId: server.id,
      previousState,
      currentState: newState,
      reason,
      timestamp: new Date().toISOString()
    };

    console.log(`[HealthMonitor] Server ${server.id} state changed: ${previousState} -> ${newState} (${reason})`);

    if (this.db) {
      this.db.insertHealthEvent(event);
    }

    this.emit('healthTransition', event);
  }

  // Admin controls
  updateWeight(serverId: string, weight: number): boolean {
    const server = this.servers.get(serverId);
    if (!server || weight <= 0) return false;
    server.weight = weight;
    if (this.db) {
      this.db.updateBackendWeight(serverId, weight);
    }
    this.emit('serverConfigUpdated', server);
    return true;
  }

  updateCapacity(serverId: string, capacity: number): boolean {
    const server = this.servers.get(serverId);
    if (!server || capacity <= 0) return false;
    server.capacity = capacity;
    if (this.db) {
      this.db.updateBackendCapacity(serverId, capacity);
    }
    this.emit('serverConfigUpdated', server);
    return true;
  }

  setServerEnabled(serverId: string, enabled: boolean): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;
    server.enabled = enabled;
    if (this.db) {
      this.db.updateBackendEnabled(serverId, enabled);
    }
    this.emit('serverConfigUpdated', server);
    return true;
  }

  recordRequestStart(serverId: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.activeRequests++;
    }
  }

  recordRequestComplete(serverId: string, latencyMs: number, isError: boolean): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.activeRequests = Math.max(0, server.activeRequests - 1);
      server.totalRequests++;

      if (isError) {
        server.errorCount++;
      }

      // Keep recent 50 latencies for rolling average
      server.recentLatencies.push(latencyMs);
      if (server.recentLatencies.length > 50) {
        server.recentLatencies.shift();
      }
    }
  }
}
