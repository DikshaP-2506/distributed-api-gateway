import { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { BackendRegistry } from '../health/index.js';
import { LoadBalancerManager } from '../load-balancer/index.js';
import { MetricsCollector } from '../metrics/index.js';
import { ExperimentRunner } from '../experiments/runner.js';
import { GatewayDatabase } from '../database/index.js';

export class GatewayWebSocketManager {
  private io: SocketIOServer;
  private metricsBroadcastInterval: NodeJS.Timeout | null = null;

  constructor(
    httpServer: HttpServer,
    private registry: BackendRegistry,
    private lbManager: LoadBalancerManager,
    private metrics: MetricsCollector,
    private experimentRunner: ExperimentRunner,
    private db?: GatewayDatabase
  ) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT']
      }
    });

    this.setupEvents();
    this.startPeriodicBroadcast();
  }

  private setupEvents(): void {
    this.io.on('connection', (socket) => {
      // Send immediate initial snapshot to connected client
      socket.emit('metrics:update', this.metrics.getSnapshot());
      socket.emit('servers:update', this.registry.getServers());

      socket.on('disconnect', () => {
        // Client disconnected
      });
    });

    // Listen to health transitions
    this.registry.on('healthTransition', (event) => {
      this.io.emit('server:health', event);
      this.io.emit('servers:update', this.registry.getServers());
    });

    // Listen to server config updates (weight, capacity, enabled)
    this.registry.on('serverConfigUpdated', (server) => {
      this.io.emit('server:updated', server);
      this.io.emit('servers:update', this.registry.getServers());
    });

    // Listen to experiment progress
    this.experimentRunner.on('experimentStarted', (data) => {
      this.io.emit('experiment:started', data);
    });

    this.experimentRunner.on('experimentProgress', (data) => {
      this.io.emit('experiment:progress', data);
    });

    this.experimentRunner.on('experimentCompleted', (data) => {
      this.io.emit('experiment:completed', data);
    });
  }

  private startPeriodicBroadcast(): void {
    // Aggregated broadcast every 1000ms
    this.metricsBroadcastInterval = setInterval(() => {
      if (this.io.sockets.sockets.size > 0) {
        this.io.emit('metrics:update', this.metrics.getSnapshot());
      }
    }, 1000);
  }

  stop(): void {
    if (this.metricsBroadcastInterval) {
      clearInterval(this.metricsBroadcastInterval);
      this.metricsBroadcastInterval = null;
    }
    this.io.close();
  }
}
