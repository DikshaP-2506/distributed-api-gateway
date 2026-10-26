# Project Report: Distributed API Gateway with Intelligent Load Balancing and Fault Tolerance

**Course / Domain**: Computer Engineering - Distributed Computing  
**Project Type**: Distributed Systems Micro-Project  
**Author**: Diksha P.  
**System Version**: 1.0.0  

---

## Abstract

In modern cloud-native infrastructures, API gateways are critical components that govern ingress traffic, orchestrate upstream services, protect backend nodes against overload, and mask transient infrastructure failures. This report presents the design, theoretical foundations, implementation, and empirical evaluation of a **Distributed API Gateway with Intelligent Load Balancing and Fault Tolerance**. The system connects multiple independent backend service instances through a high-performance central gateway capable of switching between four distinct load-balancing algorithms (Round Robin, Smooth Weighted Round Robin, Least Connections, and an explainable Adaptive Multi-Criteria Scoring Model) at runtime with zero downtime. Automated periodic health checks enforce explicit state transitions (`HEALTHY`, `UNHEALTHY`, `RECOVERING`) to isolate degraded nodes without service disruption. Real-time telemetry is pushed to an interactive React dashboard via WebSockets and persisted to an embedded SQLite database. Empirical load experiments confirm that the gateway achieves predictable load distribution, eliminates cluster burstiness, and provides robust fault isolation under chaos injection.

---

## 1. Introduction

Distributed computing systems decompose monolithic applications into collections of independent, network-connected microservices. However, client-to-service communication introduces significant operational complexities: client applications should not be burdened with tracking individual service IP addresses, balancing load, or handling server failures.

An **API Gateway** acts as a reverse proxy, decoupling external clients from internal service topologies. By centralizing request routing, load balancing, health monitoring, and metrics collection, the gateway simplifies client interactions while enabling upstream services to scale horizontally and evolve independently.

This micro-project implements a complete, production-grade distributed API gateway designed to demonstrate genuine distributed systems behavior on local and containerized environments.

---

## 2. Problem Statement

Standard ingress routers often suffer from key structural limitations:
1. **Coarse-Grained Scheduling**: Traditional round-robin routing treats all backend servers as identical, leading to queue buildup when hardware capabilities differ or request processing times vary.
2. **Delayed Failure Detection**: Without active health probing, gateways continue dispatching client requests to dead nodes until network timeouts accumulate, degrading user experience.
3. **Rigid Operational Configurations**: Modifying algorithm strategies or server weights typically requires gateway process restarts, causing brief connection drops.
4. **Lack of Transparent Telemetry**: Operational dashboards often display coarse-grained averages rather than critical high-percentile tail latencies ($P_{95}, P_{99}$).

---

## 3. Project Objectives

The project set out to achieve the following specific goals:
1. **Multiple Independent Nodes**: Implement three independently running backend services operating in distinct process spaces or containers.
2. **Intelligent Algorithmic Balancing**: Implement and contrast four load-balancing algorithms:
   - Round Robin
   - Smooth Weighted Round Robin (Nginx algorithm)
   - Least Connections
   - Adaptive Multi-Criteria Scoring
3. **Zero-Downtime Reconfiguration**: Allow dynamic switching of algorithms and server parameters (weights, capacities) via an administrative REST API.
4. **Proactive Fault Isolation & Recovery**: Implement an active health monitor that trips degraded nodes after 3 failures and restores recovered nodes only after 2 consecutive successful checks.
5. **Real-Time Telemetry & Persistence**: Build an observability dashboard with Socket.IO updates and SQLite audit persistence.
6. **Empirical Benchmarking**: Execute repeatable, concurrent load tests to measure wall-clock throughput, average latency, and percentile profiles.

---

## 4. Theoretical Background

### 4.1 Load Balancing Strategies

#### A. Round Robin
Iterates circularly across a fixed server set:
$$\text{NextIndex} = (C + 1) \pmod N$$
While optimal for uniform tasks on homogeneous hardware, it exhibits high variance under heterogenous workloads.

#### B. Smooth Weighted Round Robin
Traditional weighted algorithms (e.g. assigning weight 5 to $S_1$ and 1 to $S_2$) often generate bursts of 5 consecutive requests to $S_1$ followed by 1 to $S_2$. The smooth algorithm maintains a running accumulator $C_i$ for each node:
1. For each eligible node $i$: $C_i \leftarrow C_i + W_i$
2. Choose $k = \arg\max(C_i)$
3. Deduct total weight: $C_k \leftarrow C_k - \sum W_i$
4. Route to node $k$

This guarantees that over $\sum W_i$ iterations, node $i$ receives exactly $W_i$ requests with uniform interleaving, minimizing momentary queue spikes.

#### C. Least Connections
Routes traffic to the server with the fewest active TCP connections:
$$k = \arg\min(A_i)$$
Where $A_i$ is tracked with $O(1)$ increments at request entry and decrements in guaranteed cleanup blocks. Ties are resolved by selecting the server with the lowest recent average latency.

#### D. Adaptive Multi-Criteria Scoring
Computes a normalized composite penalty score:
$$\text{Score}_i = (w_{\text{lat}} \cdot \hat{L}_i) + (w_{\text{load}} \cdot \hat{A}_i) + (w_{\text{err}} \cdot \hat{E}_i) + (w_{\text{cap}} \cdot \hat{U}_i)$$
Where:
- $\hat{L}_i = \min(1.0, \bar{L}_i / 1000\text{ms})$: Exponentially smoothed latency.
- $\hat{A}_i = \min(1.0, A_i / \text{Cap}_i)$: Active connection density.
- $\hat{E}_i = \text{Errors}_i / \max(1, \text{TotalReq}_i)$: Normalized error rate.
- $\hat{U}_i = A_i / \text{Cap}_i$: Capacity utilization.

The server with the **lowest composite penalty score** is selected.

### 4.2 Fault Isolation & Flapping Prevention
To prevent "flapping" (rapid oscillations between healthy and unhealthy states due to transient jitter), the system employs asymmetric hysteresis thresholds:
- **Unhealthy Threshold**: Requires $K_{\text{down}} = 3$ consecutive failures before taking a node out of rotation.
- **Recovery Threshold**: Requires $K_{\text{up}} = 2$ consecutive successful health probes before restoring a node to full rotation.

---

## 5. Methodology & System Implementation

### 5.1 Architecture & Stack
- **Language**: TypeScript 5.7+ running on Node.js v22.17.
- **Reverse Proxy**: Built on Express with `node:http` and `fetch` streaming, supporting `AbortController` timeouts and bounded retries.
- **Database**: SQLite utilizing Node 22's built-in `node:sqlite` engine (`DatabaseSync`), ensuring zero external native compiler toolchain dependencies.
- **Frontend**: React 19, Vite 6, Tailwind CSS, Recharts for time-series charts, and Lucide icons.
- **WebSocket Protocol**: Socket.IO for pushing 1-second aggregated telemetry pulses and immediate health transition alerts.

### 5.2 Concurrency & State Integrity
All active request counters are incremented prior to socket dispatch and decremented in `finally` blocks. This ensures that even in cases of unexpected upstream network disconnects, timeouts, or process aborts, active connection counters are strictly preserved and never drift negatively.

---

## 6. Experimental Setup & Results

### 6.1 Setup
- **Workload**: 100 concurrent requests dispatched per run.
- **Concurrency**: 10 simultaneous worker threads.
- **Endpoint**: `/api/proxy/work?duration=15` (simulated asynchronous workload of 15ms per request).
- **Nodes**: 3 independent backend nodes:
  - `server-1` (Weight: 5)
  - `server-2` (Weight: 3)
  - `server-3` (Weight: 2)

### 6.2 Empirical Measurements

| Algorithm | Throughput (req/s) | Avg Latency (ms) | P50 Latency (ms) | P95 Latency (ms) | Request Distribution ($S_1 : S_2 : S_3$) |
|---|---|---|---|---|---|
| **Round Robin** | **76.22** | 127.46 | 124.0 | 203.0 | **33 : 34 : 33** |
| **Weighted Round Robin** | **87.11** | 110.70 | 108.0 | 141.0 | **50 : 30 : 20** |
| **Least Connections** | **82.99** | 116.77 | 112.0 | 141.0 | **30 : 39 : 31** |
| **Adaptive Load Balancing** | **84.75** | 114.12 | 110.0 | 162.0 | **36 : 35 : 29** |

### 6.3 Analysis of Observations
1. **Distribution Precision**:
   - **Round Robin** achieved a near-perfect equal allocation ($33\%, 34\%, 33\%$).
   - **Weighted Round Robin** allocated exactly $50:30:20$ requests, strictly adhering to the configured $5:3:2$ ratios without any sequential burst clustering.
2. **Throughput & Tail Latency**:
   - **Weighted Round Robin** delivered the highest throughput ($87.11\text{ req/s}$) and the lowest average latency ($110.7\text{ms}$), as the heaviest server (`server-1`, weight 5) received the highest proportion of traffic while operating within its capacity limit.
   - **Least Connections** reduced tail latency ($P_{95} = 141\text{ms}$ vs $203\text{ms}$ in Round Robin) by immediately reallocating requests away from temporarily delayed instances.
3. **Fault Tolerance Verification**:
   - Injecting a failure into `server-1` triggered 3 consecutive failed health pings ($6\text{s}$ elapsed), causing an automated transition to `UNHEALTHY`. Subsequent traffic was routed exclusively to $S_2$ and $S_3$ with $0\%$ request drop.
   - Restoring `server-1` triggered a transition to `RECOVERING` at check 1, and back to `HEALTHY` at check 2, automatically re-admitting the node to the active pool.
   - Disabling all servers simultaneously resulted in a graceful HTTP 503 fallback.

---

## 7. Known Limitations & Future Work

### Limitations
1. **Single Gateway Node**: The gateway currently runs as a single coordinator; in large-scale multi-datacenter environments, multiple gateway instances would require a distributed consensus mechanism (e.g. Raft) or shared state layer.
2. **HTTP/1.1 Upstream**: Upstream proxy communication currently uses HTTP/1.1; adding HTTP/2 multiplexing or gRPC protocol support would further reduce socket overhead.

### Future Work
1. **Dynamic Weight Auto-Tuning**: Implement reinforcement learning to automatically tune weights and capacity thresholds based on long-term hardware CPU/memory metrics.
2. **Distributed Rate Limiting**: Implement a Token Bucket or Leaky Bucket algorithm backed by Redis to enforce per-client rate limits.

---

## 8. Conclusion

The Distributed API Gateway successfully demonstrates all foundational principles of distributed systems design: transparent request routing, dynamic algorithmic balancing, resilient fault isolation, and comprehensive live telemetry. Through empirical verification across multiple benchmarks and chaos injections, the system proves that intelligent load balancing and proactive health hysteresis significantly improve cluster throughput and eliminate single-node bottlenecks.

---

## References

1. Coulouris, G., Dollimore, J., Kindberg, T., & Blair, G. (2011). *Distributed Systems: Concepts and Design* (5th ed.). Addison-Wesley.
2. Tanenbaum, A. S., & van Steen, M. (2017). *Distributed Systems: Principles and Paradigms* (3rd ed.). CreateSpace Independent Publishing.
3. Nginx Documentation (2024). *Smooth Weighted Round Robin Balancing Algorithm*.
4. Newman, S. (2021). *Building Microservices: Designing Fine-Grained Systems* (2nd ed.). O'Reilly Media.
5. Node.js Foundation (2024). *Node.js v22 SQLite Standard Module Documentation (`node:sqlite`)*.
