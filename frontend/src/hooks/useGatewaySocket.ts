import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { BackendServer, GatewayMetrics, HealthTransitionEvent } from '../types/index.js';
import { fetchOverview, fetchServers } from '../services/api.js';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080';

export function useGatewaySocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<GatewayMetrics | null>(null);
  const [servers, setServers] = useState<BackendServer[]>([]);
  const [lastHealthEvent, setLastHealthEvent] = useState<HealthTransitionEvent | null>(null);
  const [experimentProgress, setExperimentProgress] = useState<{ completed: number; total: number; percent: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const refreshSnapshot = async () => {
    try {
      const [overviewData, serversData] = await Promise.all([
        fetchOverview(),
        fetchServers()
      ]);
      setMetrics(overviewData.metrics);
      setServers(serversData);
    } catch {
      // Gateway might be initializing
    }
  };

  useEffect(() => {
    const socket = io(GATEWAY_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      refreshSnapshot();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('metrics:update', (data: GatewayMetrics) => {
      setMetrics(data);
    });

    socket.on('servers:update', (data: BackendServer[]) => {
      setServers(data);
    });

    socket.on('server:health', (event: HealthTransitionEvent) => {
      setLastHealthEvent(event);
      refreshSnapshot();
    });

    socket.on('experiment:progress', (data: { completed: number; total: number; percent: number }) => {
      setExperimentProgress(data);
    });

    socket.on('experiment:completed', () => {
      setExperimentProgress(null);
      refreshSnapshot();
    });

    // Initial fetch
    refreshSnapshot();

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    isConnected,
    metrics,
    servers,
    lastHealthEvent,
    experimentProgress,
    refreshSnapshot
  };
}
