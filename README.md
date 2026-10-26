# Distributed API Gateway with Intelligent Load Balancing & Fault Tolerance

A production-grade, distributed computing system featuring a central API Gateway, multiple independent backend service instances, dynamic load balancing algorithms, automated health monitoring with proactive fault isolation and recovery, real-time WebSocket observability, and persistent SQLite telemetry.

Built as a Computer Engineering Distributed Computing micro-project.

---

## 1. Project Overview

In distributed architectures, services must scale horizontally across multiple independent nodes. The **Distributed API Gateway** acts as the single entry point for incoming client traffic, intelligently routing requests, mitigating partial server failures, tracking active connection loads, and providing transparent observability without introducing single points of congestion.

### Key Highlights
- **Real Distributed Topology**: Runs three independently deployed backend services (`server-1`, `server-2`, `server-3`) alongside a central reverse proxy gateway and React dashboard.
- **4 Load Balancing Algorithms**: Round Robin, Weighted Round Robin (Smooth Nginx Interleaving), Least Connections, and an explainable Adaptive Scoring Engine.
- **Zero-Downtime Algorithm Switching**: Change balancing algorithms dynamically at runtime via administrative API or dashboard without restarting gateway processes.
- **Automated Health Monitoring**: Periodic background health checks with configurable failure thresholds (trip after 3 failures) and recovery thresholds (restore after 2 consecutive successful checks).
- **Graceful Fault Tolerance & Retries**: Automatic exclusion of dead nodes, controlled 503 fallback when no instances are available, and bounded retries for idempotent operations.
- **Live Observability**: Real-time push updates via Socket.IO pushing aggregated metrics, connection states, and health audit events to a Tailwind CSS dashboard.
- **SQLite Persistence**: Embedded database tracking request logs, health transition events, backend configurations, and load experiment runs with CSV export.

---

## 2. Problem Statement

Modern microservice architectures face frequent transient network failures, heterogeneous node capabilities, and shifting request workloads. Naive load balancers often:
1. Overload slower or resource-constrained nodes.
2. Route traffic to degraded or crashed nodes before realizing they are down.
3. Lack transparent metrics and real-time visibility into percentile latencies (P95/P99).
4. Require process restarts to alter load distribution policies.

This project addresses these challenges by implementing an intelligent API Gateway that detects failures proactively, dynamically balances load based on live performance feedback, and maintains complete telemetry.

---

## 3. System Architecture

```
                  +----------------------------------------------+
                  |         Client Browser / Dashboard           |
                  |     (React 19 + Vite + Tailwind + Socket.IO) |
                  +----------------------+-----------------------+
                                         | HTTP / WS (:5173 / :8080)
                                         v
                  +----------------------------------------------+
                  |              API GATEWAY (:8080)             |
                  |                                              |
                  |  [Reverse Proxy & Retries]                   |
                  |  [Load Balancer Engine]                      |
                  |    - Round Robin                             |
                  |    - Smooth Weighted Round Robin             |
                  |    - Least Connections                       |
                  |    - Adaptive Multi-Criteria Scoring         |
                  |                                              |
                  |  [Health Monitor & Registry]                 |
                  |  [Metrics Engine (P50/P95/P99)]              |
                  |  [Admin REST API] [WebSocket Broadcaster]    |
                  +----------------------+-----------------------+
                                         |
               +-------------------------+-------------------------+
               | (Internal Network)      | (Internal Network)      | (Internal Network)
               v                         v                         v
     +-------------------+     +-------------------+     +-------------------+
     |     server-1      |     |     server-2      |     |     server-3      |
     |  (Port: 3001)     |     |  (Port: 3002)     |     |  (Port: 3003)     |
     |  Weight: 5        |     |  Weight: 3        |     |  Weight: 2        |
     +-------------------+     +-------------------+     +-------------------+
```

---

## 4. Technology Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Lucide React, Recharts, Socket.IO Client.
- **API Gateway**: Node.js v22, TypeScript, Express, Socket.IO, Zod validation, `node:sqlite` database.
- **Backend Services**: Node.js v22, TypeScript, Express, structured JSON logging, graceful shutdown.
- **Database**: SQLite via built-in `node:sqlite` (zero native compiler toolchain requirements).
- **Testing**: Vitest for unit & integration testing, Supertest for HTTP testing, custom concurrency runner.
- **Containerization**: Docker, Docker Compose, dedicated bridge network, persistent named volumes.

---

## 5. Monorepo Structure

```
distributed-api-gateway/
├── frontend/                     # React dashboard
│   ├── src/
│   │   ├── components/           # Header, Sidebar, MetricCard
│   │   ├── pages/                # Overview, Servers, LoadBalancing, Traffic, ExperimentLab, etc.
│   │   ├── hooks/                # useGatewaySocket.ts
│   │   ├── services/             # api.ts
│   │   └── types/                # index.ts
│   ├── Dockerfile
│   └── vite.config.ts
├── gateway/                      # Central API Gateway
│   ├── src/
│   │   ├── database/             # SQLite schema and repositories
│   │   ├── experiments/          # Live experiment load testing runner
│   │   ├── health/               # Health checker and backend registry
│   │   ├── load-balancer/        # Round Robin, WRR, LeastConn, Adaptive
│   │   ├── metrics/              # RPS & rolling latency percentiles
│   │   ├── proxy/                # Reverse proxy handler and bounded retries
│   │   ├── routes/               # Admin routes (/admin/*)
│   │   ├── websocket/            # Socket.IO broadcasting manager
│   │   ├── app.ts                # Express app configuration
│   │   └── server.ts             # Gateway entrypoint & lifecycle
│   ├── tests/
│   │   ├── unit/                 # Unit tests (algorithms, metrics, health)
│   │   └── integration/          # Integration tests (HTTP routes, 503 fallback)
│   ├── Dockerfile
│   └── tsconfig.json
├── services/
│   └── backend/                  # Independent backend service instance
│       ├── src/
│       │   ├── middleware/       # Structured logger, Request ID propagator
│       │   ├── routes/           # /health, /api/info, /api/data, /api/work, /api/slow, /api/fail
│       │   ├── app.ts
│       │   └── server.ts
│       └── Dockerfile
├── scripts/
│   ├── load-test.js              # Standalone CLI load tester
│   ├── run-experiment.js         # 4-algorithm automated benchmark suite
│   ├── start-all.js              # Orchestrator to start 3 backends & gateway
│   └── start-service.js          # Individual service launcher
├── data/                         # SQLite database file directory
├── docker-compose.yml            # Multi-container orchestration
├── .env.example
├── ARCHITECTURE.md
├── TESTING.md
├── PROJECT_REPORT.md
└── README.md
```

---

## 6. Prerequisites

- **Node.js**: v20.0.0 or higher (v22.17.0+ recommended).
- **npm**: v10.0.0 or higher.
- **Docker & Docker Compose**: (Optional, for containerized execution).

---

## 7. Installation & Quick Start (Local Windows / Cross-Platform)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/DikshaP-2506/distributed-api-gateway.git
cd distributed-api-gateway
npm install
```

### 2. Build TypeScript Packages
```bash
npm run build
```

### 3. Start All Services & Gateway
In one terminal, start all three backend instances (`server-1`: 3001, `server-2`: 3002, `server-3`: 3003) and the Gateway (`8080`):
```bash
npm run start:all
```

### 4. Start the Frontend Dashboard
In a second terminal:
```bash
npm run start:frontend
```
Open **`http://localhost:5173`** in your browser.

---

## 8. Docker Compose Deployment

To build and run the entire distributed mesh in isolated Docker containers:

```bash
docker compose up --build
```

- **Frontend**: http://localhost:5173
- **Gateway**: http://localhost:8080
- **Internal Network**: Backends run isolated on `server-1:3001`, `server-2:3002`, `server-3:3003`.

To stop the containers:
```bash
docker compose down
```

To stop and reset persistent database data:
```bash
docker compose down -v
```

---

## 9. Running Automated Tests

Run the complete Vitest test suite covering unit tests and HTTP integration tests:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

All 23 automated tests pass with 100% coverage across:
- Round Robin sequential rotation and unhealthy server exclusion.
- Smooth Weighted Round Robin proportional distribution (5:3:2).
- Least Connections dynamic load steering and latency tie-breaking.
- Adaptive multi-variable scoring model.
- Health monitor threshold transitions (trip at 3 failures, recover at 2 successes).
- HTTP routing, header propagation, and 503 fallback when all nodes are disabled.

---

## 10. Load Testing & Automated Experiments

### Run Quick CLI Load Test
```bash
node scripts/load-test.js --requests 100 --concurrency 10 --endpoint /api/proxy/data
```

### Run 4-Algorithm Comparative Benchmark Suite
```bash
node scripts/run-experiment.js
```
This executes 100 concurrent requests across all four algorithms and prints a performance matrix showing throughput, average latency, P95 latency, and server allocation.

---

## 11. API Documentation

### Proxy Routes (Clients send requests here)
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/proxy/info` | Forwards to selected healthy backend `/api/info` |
| `GET` | `/api/proxy/data` | Forwards to selected backend `/api/data` |
| `GET` | `/api/proxy/work?duration=N` | Simulates async work duration ($N$ ms, 0-10000ms) |
| `GET` | `/api/proxy/slow?delay=N` | Simulates slow response for timeout testing |
| `GET` | `/api/proxy/fail` | Returns controlled 500 error for failure testing |

### Administrative Routes
| Method | Route | Description |
|---|---|---|
| `GET` | `/admin/overview` | Gateway telemetry, active algorithm, server summary |
| `GET` | `/admin/servers` | Status, metrics, weights, and scores for all backends |
| `PUT` | `/admin/config/algorithm` | Switch algorithm (`round-robin`, `weighted-round-robin`, `least-connections`, `adaptive`) |
| `PUT` | `/admin/servers/:id/weight` | Update server weight (1-100) |
| `PUT` | `/admin/servers/:id/capacity` | Update server connection capacity (1-1000) |
| `POST` | `/admin/servers/:id/disable` | Exclude server from routing pool |
| `POST` | `/admin/servers/:id/enable` | Re-include server in routing pool |
| `GET` | `/admin/health-events` | Retrieve recent audit log of health transitions |
| `GET` | `/admin/metrics/summary` | Real-time throughput, active requests, latency percentiles |
| `POST` | `/admin/experiments` | Trigger an automated concurrent experiment run |
| `GET` | `/admin/experiments` | List historical experiment runs |

---

## 12. Load Balancing Algorithms

### 1. Round Robin
Iterates sequentially across the eligible, healthy server slice using a safe modular counter:
$$\text{NextIndex} = (\text{Counter} + 1) \pmod{\text{EligibleServers.length}}$$

### 2. Smooth Weighted Round Robin (Nginx Algorithm)
Eliminates burst clustering where a server with weight 5 receives 5 consecutive requests. Over a cycle of $\sum W_i$, every server $i$ is selected exactly $W_i$ times, interleaved evenly:
1. $\forall s \in \text{Eligible}: s.\text{currentWeight} \mathrel{+}= s.\text{weight}$
2. Select $s_{\text{best}} = \arg\max(s.\text{currentWeight})$
3. $s_{\text{best}}.\text{currentWeight} \mathrel{-}= \sum_{s} s.\text{weight}$
4. Return $s_{\text{best}}$

### 3. Least Connections
Tracks active in-flight requests per backend ($\text{activeRequests}$ incremented at proxy start and decremented in a guaranteed `finally` block):
- Selects server with $\min(\text{activeRequests})$.
- Deterministic tie-breaking: selects node with lowest recent average latency; if still tied, uses round-robin index.

### 4. Adaptive Multi-Criteria Scoring
Computes a composite penalty score between 0.0 and 1.0 using normalized telemetry:
$$\text{Score} = (w_{\text{lat}} \cdot \hat{L}) + (w_{\text{load}} \cdot \hat{C}) + (w_{\text{err}} \cdot \hat{E}) + (w_{\text{cap}} \cdot \hat{U})$$
Where:
- $\hat{L} = \min(1.0, \text{AvgLatency} / 1000\text{ms})$
- $\hat{C} = \min(1.0, \text{activeRequests} / \text{capacity})$
- $\hat{E} = \text{errorCount} / \max(1, \text{totalRequests})$
- $\hat{U} = \text{activeRequests} / \text{capacity}$
- Default weights: Latency: 0.40, Load: 0.30, Error: 0.20, Capacity: 0.10.

---

## 13. Health Check & Fault Isolation Logic

```
   +--------------+   3 Consecutive Failures   +----------------+
   |   HEALTHY    | -------------------------> |   UNHEALTHY    |
   +--------------+                            +----------------+
          ^                                            |
          | 2 Consecutive                              | 1st Success
          | Successes                                  v
   +--------------+                            +----------------+
   |  RECOVERING  | <------------------------- |   RECOVERING   |
   +--------------+                            +----------------+
```
- **Interval**: 2000ms ping to `GET /health`.
- **Timeout**: 1000ms abort threshold.
- **Trip condition**: 3 consecutive failures transitions node to `UNHEALTHY` (immediately removed from routing).
- **Recovery condition**: While unhealthy, periodic checks continue. Upon 1 success $\to$ `RECOVERING`. Upon 2 consecutive successes $\to$ `HEALTHY` (restored to active routing).

---

## 14. License
MIT License. Open for educational and research usage.