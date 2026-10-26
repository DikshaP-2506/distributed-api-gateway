# Distributed API Gateway: Architecture Specification

This document details the internal design, request life cycle, concurrency controls, failover mechanics, and data models of the Distributed API Gateway system.

---

## 1. Architectural Philosophy

The gateway is designed as a **stateless reverse-proxy and orchestrator** that delegates stateful observations (metrics, health events, experiment logs) to an embedded SQLite repository and broadcasts telemetry via WebSockets.

Core architectural tenets:
1. **Separation of Concerns**: Routing decisions are made purely in-memory in $O(1)$ time without database blocking.
2. **Defensive Concurrency**: Active connections and counters are incremented at entry and strictly decremented in `finally` blocks to guarantee zero counter drift.
3. **Graceful Degradation**: When a backend degrades or crashes, the system isolates it within the threshold window and returns bounded fallback responses (HTTP 503) only when zero eligible nodes remain.

---

## 2. Component Diagram

```
+-----------------------------------------------------------------------------------------+
|                                    GATEWAY CORE                                         |
|                                                                                         |
|  +--------------------+    +--------------------+    +-------------------------------+  |
|  |  Express Router    | -> | Proxy Handler      | -> | LoadBalancerManager           |  |
|  |  - /api/proxy/*    |    | - Header Injection |    | - Round Robin                 |  |
|  |  - /admin/*        |    | - Bounded Retries  |    | - Smooth Weighted Round Robin |  |
|  +--------------------+    | - Timeout Control  |    | - Least Connections           |  |
|                            +--------------------+    | - Adaptive Multi-Criteria     |  |
|                                     |                +-------------------------------+  |
|                                     v                                                   |
|                            +--------------------+                                       |
|                            | Backend Registry   | <-------------------------+           |
|                            | - Health State     |                           |           |
|                            | - Active Counters  |                           |           |
|                            +--------------------+                           |           |
|                                     |                                       |           |
|          +--------------------------+--------------------------+            |           |
|          v                                                     v            v           |
|  +--------------------+                             +-------------------------------+   |
|  |  Metrics Engine    |                             |  Health Checker (Timer: 2s)   |   |
|  |  - Rolling P50/P95 |                             |  - Consecutive Failures >= 3  |   |
|  |  - RPS Buckets     |                             |  - Consecutive Passes >= 2    |   |
|  +--------------------+                             +-------------------------------+   |
|          |                                                     |                        |
|          v                                                     v                        |
|  +-----------------------------------------------------------------------------------+  |
|  |                            GatewayDatabase (SQLite)                               |  |
|  |  - backend_config  |  request_logs  |  health_events  |  experiment_runs           |  |
|  +-----------------------------------------------------------------------------------+  |
|                                     |                                                   |
|                                     v                                                   |
|  +-----------------------------------------------------------------------------------+  |
|  |                    GatewayWebSocketManager (Socket.IO Broadcast)                  |  |
|  +-----------------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

## 3. End-to-End Request Flow

When an external client sends a request to `/api/proxy/data`:

1. **Ingress & ID Tagging**:
   - Gateway intercepts the request.
   - Generates a UUID v4 `X-Request-ID` or preserves an incoming one.
   - Records start timestamp with millisecond resolution.
2. **Server Selection**:
   - `ProxyHandler` queries `LoadBalancerManager.selectServer()`.
   - The active algorithm evaluates only **healthy** and **enabled** nodes.
   - If no healthy nodes are found, gateway immediately halts and returns **HTTP 503 Service Unavailable**.
3. **In-Flight Accounting**:
   - `BackendRegistry.recordRequestStart(server.id)` increments `server.activeRequests`.
   - `MetricsCollector.incrementActiveRequests()` increments cluster-wide active gauge.
4. **Upstream Forwarding**:
   - Request is dispatched to backend URL (`http://server:port/api/data`) using an HTTP client with an `AbortController` timeout (default: 8000ms).
   - Upstream headers include `x-request-id` and `accept`.
5. **Failover & Bounded Retries**:
   - If the request fails due to network disconnection (`ECONNREFUSED` or timeout) and the method is **idempotent** (`GET`, `HEAD`), the failed backend is added to an `excludedServerIds` set.
   - The gateway retries the request once against an **alternate eligible healthy backend**.
   - Non-idempotent methods (`POST`, `PUT`, `DELETE`) are never retried to prevent double-execution.
6. **Egress & Cleanup**:
   - In a `finally` block, `server.activeRequests` and gateway `activeRequests` are decremented.
   - The response is sent to the client with `x-backend-server`, `x-request-id`, and `x-gateway-latency-ms` headers.
   - Asynchronously, `request_logs` is updated in SQLite and metrics are updated.

---

## 4. Health Check & State Transition State Machine

Each backend node transitions between four explicit states:

```
[ UNHEALTHY ] <--- (3 Failures) --- [ HEALTHY ]
      |                                    ^
      | (1st Check Passes)                 | (2nd Consecutive Pass)
      v                                    |
[ RECOVERING ] ----------------------------+
```

### State Definitions
- **HEALTHY**: Eligible for all traffic routing. Consecutive failures = 0.
- **UNHEALTHY**: Excluded from the load balancer pool. Health check pings continue every 2 seconds.
- **RECOVERING**: Intermediate state after 1 successful check while unhealthy. Node is not yet returned to full service until the configured recovery threshold (2 consecutive successes) is achieved.
- **DRAINING / DISABLED**: Administratively turned off. Excluded from routing regardless of health ping status.

---

## 5. Load Balancing Mathematical Formulations

### A. Round Robin
Maintains an atomic sequence counter $C$:
$$\text{Index} = C \pmod N$$
Where $N$ is the number of eligible servers. The counter wraps safely to prevent integer overflow.

### B. Smooth Weighted Round Robin
To prevent request clustering (e.g. sending 5 requests in a row to a server with weight 5), each server maintains an effective configured weight $W_i$ and a runtime accumulator $C_i$:
1. $C_i \leftarrow C_i + W_i \quad \forall i$
2. Select server $k = \arg\max(C_i)$
3. $C_k \leftarrow C_k - \sum_{i=1}^N W_i$
4. Route request to server $k$

This guarantees that over $\sum W_i$ requests, server $i$ receives exactly $W_i$ requests, interleaved uniformly.

### C. Least Connections
Tracks active in-flight TCP requests $A_i$ per server:
$$k = \arg\min(A_i)$$
Ties are resolved by selecting the candidate with the lowest rolling average latency $\bar{L}_i$.

### D. Adaptive Load Balancing
A multi-objective optimization penalty function evaluates dynamic performance variables:
$$\text{Score}_i = w_{\text{lat}} \cdot \hat{L}_i + w_{\text{load}} \cdot \hat{A}_i + w_{\text{err}} \cdot \hat{E}_i + w_{\text{cap}} \cdot \hat{U}_i$$
Where:
- $\hat{L}_i = \min(1.0, \bar{L}_i / 1000\text{ms})$: Normalized moving latency.
- $\hat{A}_i = \min(1.0, A_i / \text{Cap}_i)$: Active connection density.
- $\hat{E}_i = \text{Errors}_i / \max(1, \text{TotalReq}_i)$: Normalized error rate.
- $\hat{U}_i = A_i / \text{Cap}_i$: Capacity saturation.
- Default weights: $w_{\text{lat}} = 0.40, w_{\text{load}} = 0.30, w_{\text{err}} = 0.20, w_{\text{cap}} = 0.10$.

The server with the **lowest composite penalty score** is selected.

---

## 6. Database Schema & Indexing

The embedded SQLite database consists of four tables:

```sql
CREATE TABLE backend_config (
  server_id TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  capacity INTEGER NOT NULL DEFAULT 50,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE request_logs (
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
CREATE INDEX idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX idx_request_logs_backend ON request_logs(backend_id);

CREATE TABLE health_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backend_id TEXT NOT NULL,
  previous_state TEXT NOT NULL,
  current_state TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_health_events_created_at ON health_events(created_at);

CREATE TABLE experiment_runs (
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
CREATE INDEX idx_experiment_runs_started_at ON experiment_runs(started_at);
```
