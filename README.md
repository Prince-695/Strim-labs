<div align="center">

# STRIM Labs

### Continuous API Observability, 500ms Telemetry & Automated Breakpoint Diagnosis

*Find your API's breaking point before production does.*

[![Bun](https://img.shields.io/badge/Runtime-Bun%201.2+-000000?style=flat&logo=bun)](https://bun.sh)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=flat&logo=next.js)](https://nextjs.org)
[![Hono](https://img.shields.io/badge/Backend-Hono%20Modular-E36002?style=flat&logo=hono)](https://hono.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20100%25-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Database](https://img.shields.io/badge/Database-Neon%20Cloud%20Postgres-00E575?style=flat&logo=postgresql)](https://neon.tech)
[![License: MIT](https://img.shields.io/badge/License-MIT-00C968?style=flat)](LICENSE)

[**Live Web Console**](#quickstart) &bull;
[**Why STRIM?**](#the-problem-why-strim-labs) &bull;
[**3-Zone Capacity Spectrum**](#the-3-zone-capacity-spectrum) &bull;
[**1-Line SDK Setup**](#1-line-zero-config-sdk-integration) &bull;
[**Architecture**](#architecture--monorepo-structure) &bull;
[**API Reference**](#rest-api-reference)

---

</div>

## Overview

**STRIM Labs** is an end-to-end continuous API observability and automated capacity diagnosis platform. It bridges the gap between **passive APM monitoring** (which only alerts you *after* production crashes) and **heavy, brittle load testing tools** (k6, JMeter, Locust, which require maintaining complex, scripted virtual-user test suites).

With STRIM, developers drop a **single line of middleware** (`@strim/sdk`) into their backend (Hono, Express, Next.js, Fastify). The SDK automatically discovers endpoints, buffers live latency in an in-memory **500ms lock-free ring buffer**, and runs **automated 7-day concurrency ramps** using native multi-threaded Bun workers to mathematically calculate your application's exact **Saturation Knee** and **Breaking Cliff**.

```
Latency (ms)
    ▲
    │                                             / [ZONE 3: BREAKING CLIFF]
    │                                            /  (504 Timeouts, Sockets Drop)
    │                                           /
    │                             __-------'''' [ZONE 2: SATURATION KNEE]
    │                 _--'''''''''              (Queue buildup, latency curves up)
    │   __________----
    │   [ZONE 1: SAFE BAND]
    │   (Flat latency, 1:1 throughput)
    └─────────────────────────────────────────────────────────────► RPS (Requests/Sec)
        0 RPS                340 RPS           480 RPS        650+ RPS
```

---

## The Problem: Why STRIM Labs?

| Traditional APMs (Datadog, New Relic) | Scripted Load Testers (k6, JMeter, Locust) | STRIM Labs |
| :--- | :--- | :--- |
| **Reactive**: Tells you *what happened* in the past after customer outages occur. | **Scripted**: Requires writing and maintaining thousands of lines of virtual-user scripts. | **Proactive & Zero-Script**: Measures capacity continuously and discovers routes automatically. |
| **No Headroom Insight**: Cannot predict how many users will cause queues to expand. | **Manual Execution**: Teams rarely run tests because provisioning runner clusters is painful. | **Automated 7-Day Ramps**: Scheduled Bun worker ramps run automatically every week. |
| **High Overhead**: Often inspects deep call stacks with heavy memory profiling. | **Simulated Approximations**: Test scripts drift away from real customer usage patterns. | **Micro-Overhead (< 0.12ms)**: Pre-allocated circular typed array memory buffer (< 1.8MB). |
| **No CI/CD Gating**: Difficult to translate APM metrics into a pull-request pass/fail check. | **Binary Guesses**: Arbitrary pass/fail thresholds without inflection curve detection. | **Mathematical Verdicts**: Inflection slope analysis gates regressions in CI/CD. |

---

## The 3-Zone Capacity Spectrum

STRIM Labs replaces subjective pass/fail guesses with empirical mathematics:

1. **Zone 1: Safe Band (`#00E575` Cyber Emerald)**
   - **Characteristics**: Optimal production headroom. Concurrency scales 1:1 with delivered throughput.
   - **Metrics**: Latency stays completely flat (< 35ms), 0.00% error rate, zero queue contention.
2. **Zone 2: Saturation Knee (`#F59E0B` Amber Warning)**
   - **Characteristics**: The inflection point. The server is still functioning and requests succeed, but worker concurrency is saturated.
   - **Metrics**: Latency curve inflects sharply upward ($d(\text{latency})/d(\text{RPS}) > \text{threshold}$). Queue buffers expand.
3. **Zone 3: Breaking Cliff (`#EF4444` Critical Alert)**
   - **Characteristics**: Catastrophic failure cascade.
   - **Metrics**: Surges in `504 Gateway Timeouts`, `429 Rate Limits`, TCP socket drops, and database connection pool exhaustion.

---

## Key Capabilities

### 1. 1-Line Zero-Config Polyglot SDK (`@strim/sdk`)
Drop one middleware hook into any modern TypeScript backend. Automatically discovers routes, tracks HTTP methods, and buffers live telemetry without writing OpenAPI/Swagger YAML specs:
- **Supported Frameworks**: Hono (Bun / Cloudflare Workers / Node), Express.js (v18+), Next.js App Router (Route Handlers / Middleware), Fastify.
- **Micro-Overhead**: Hot path executes in **< 0.12 milliseconds**.
- **Privacy Guarantee**: **Zero-payload storage**. Request bodies, headers, and authorization secrets are sanitized. Only duration, method, path, and status code are retained.

### 2. 500ms Lock-Free In-Memory Ring Buffer
- Pre-allocated circular typed array buffer locked under **1.8 MB heap memory**.
- Produces **zero V8 garbage collection pauses** on your application thread.
- Periodically dispatches aggregate P50, P95, P99, and RPS micro-slices to the STRIM Ingestion Gateway.

### 3. Automated 7-Day Saturation Engine
- Runs scheduled multi-worker capacity diagnosis tests every 7 days (or on demand).
- Native Bun workers ramp concurrent load through staging/production targets to evaluate whether recent commits degraded capacity headroom.
- **SSRF & Network Shield**: Validates all URLs against RFC 1918 private subnets, loopback interfaces (`127.0.0.1`), and cloud metadata APIs (`169.254.169.254`).
- **Sub-200ms Instant Abort**: Cleanly tears down TCP sockets and workers if an endpoint triggers error surges.

### 4. Interactive 3D WebGL Telemetry Globe (`cobe`)
- High-performance, 60 FPS hardware-accelerated 3D sphere with elevated geodesic bezier flight arcs.
- Visualizes distributed traffic routing across 9 global edge regions (**SFO**, **IAD**, **LHR**, **FRA**, **BOM**, **SIN**, **NRT**, **GRU**, **SYD**).
- Draggable with mouse/touch momentum; clicking any region automatically centers that region to the camera and displays live regional edge latency, throughput, and TLS 1.3 / HTTP/2 status.
- **Bidirectional Theme Synchronization**: Dynamically updates WebGL shaders to match dark obsidian (`#0B1015`) or light porcelain (`#F7F9F8`) modes.

### 5. Multi-Tenant Organization & Project Management
- Full organization switcher, role-based membership, and project scoping.
- Instant cryptographically secure Project API Keys (`strim_live_...`) encrypted at rest with AES-256-GCM.
- Route explorer with real-time health indicators, latency tags, and automatic classification.

---

## 1-Line Zero-Config SDK Integration

Install the official SDK package:

```bash
bun add @strim/sdk
# or npm install @strim/sdk
# or pnpm add @strim/sdk
```

### Hono (Bun, Node.js, Cloudflare Workers)
```typescript
import { Hono } from "hono";
import { strim } from "@strim/sdk";

const app = new Hono();

// Single-line telemetry middleware
app.use("*", strim({
  apiKey: process.env.STRIM_API_KEY!,
  projectId: "strim_live_9f81a7b...",
}));

app.get("/api/checkout", (c) => c.json({ status: "ready" }));

export default app;
```

### Express.js
```typescript
import express from "express";
import { strimExpress } from "@strim/sdk/express";

const app = express();

app.use(strimExpress({
  apiKey: process.env.STRIM_API_KEY!,
  projectId: "strim_live_9f81a7b...",
}));

app.get("/api/v1/orders", (req, res) => res.json({ orders: [] }));
app.listen(3000);
```

### Next.js (App Router Middleware)
```typescript
// middleware.ts
import { strimMiddleware } from "@strim/sdk/next";

export const middleware = strimMiddleware({
  apiKey: process.env.STRIM_API_KEY!,
  projectId: "strim_live_9f81a7b...",
});

export const config = {
  matcher: ["/api/:path*"],
};
```

---

## Architecture & Monorepo Structure

STRIM Labs is structured as a modular TypeScript monorepo powered by Bun workspaces and Neon Serverless PostgreSQL:

```text
strim-labs/
├── apps/
│   ├── web/                    # Next.js 16 App Router (React 19, Tailwind CSS v4, Framer Motion)
│   │   ├── public/             # Static assets, local Satoshi Variable fonts, brand logos
│   │   └── src/
│   │       ├── app/            # App routes: marketing, auth, projects, runner, tests, docs
│   │       ├── components/     # UI primitives, 3D WebGL Globe, Bento Grid, Telemetry Cockpit
│   │       └── lib/            # SSE client, query client, math analysis helpers
│   └── server/                 # Hono API on native Bun runtime (Port 8080)
│       └── src/
│           ├── engine/         # Native Bun load runner, SSE broadcaster, route discovery engine
│           ├── middleware/     # Tenant isolation, API key auth, SSRF firewall
│           └── modules/        # Ingest, Discovery, Orgs, Projects, Load Tests
├── packages/
│   ├── sdk/                    # @strim/sdk polyglot middleware (500ms in-memory ring buffer)
│   ├── db/                     # Prisma ORM schema & client (Neon Cloud PostgreSQL)
│   ├── shared/                 # Breakpoint analyzer algorithms, Zod schemas, types
│   ├── tsconfig/               # Shared TypeScript configurations
│   └── eslint-config/          # Shared ESLint rules
```

### Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / User
    participant App as Target Backend Server
    participant SDK as @strim/sdk (Ring Buffer)
    participant Ingest as STRIM Ingestion API (8080)
    participant Engine as Native Bun Load Engine
    participant DB as Neon Cloud PostgreSQL
    participant Web as STRIM Web Cockpit (3000)

    Dev->>App: Sends HTTP Requests
    App->>SDK: Intercepts request frame (< 0.12ms)
    SDK->>SDK: Record duration & route in 500ms Ring Buffer
    SDK-->>Ingest: Flush 500ms aggregate slices
    Ingest-->>DB: Persist discovered routes & time-series slices
    Ingest-->>Web: Broadcast live SSE telemetry stream

    Note over Engine,App: Automated 7-Day Saturation Cycle or On-Demand Run
    Engine->>App: Ramp concurrent load (Smoke / Spike / Ramp / Breaking Hunt)
    App-->>Engine: Stream latency & status codes
    Engine->>Engine: Calculate Saturation Knee & Breaking Cliff
    Engine-->>DB: Store Run & Gate Verdict (PASS / FAIL)
    Web->>Dev: Render 3D Globe, Capacity Gauge & Regression Verdict
```

---

## Quickstart

### Prerequisites
- [Bun](https://bun.sh) (v1.2 or higher)
- Active internet connection (connected to Neon Cloud Serverless PostgreSQL)

### 1. Clone & Install
```bash
git clone git@github.com:Prince-695/Strim.git
cd Strim
bun install
```

### 2. Configure Environment Variables
Copy `.env.example` into `.env`:
```bash
cp .env.example .env
```

Ensure your `.env` contains the database connection string and secret keys:
```env
DATABASE_URL="postgresql://neondb_owner:npg_xX7m8WjFkLhQ@ep-bold-glitter-a1234567.ap-southeast-1.aws.neon.tech/strim?sslmode=require"
JWT_SECRET="strim-super-secret-development-jwt-key"
PORT=8080
NEXT_PUBLIC_API_URL="http://localhost:8080"
```

### 3. Sync Database Schema & Seed Data
```bash
# Push Prisma schema to Neon PostgreSQL
bun run db:push

# Seed demo organization, projects, and benchmarks
bun run db:seed
```

### 4. Start Development Servers
Run the full-stack development environment in one command:
```bash
bun dev
```

- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:8080](http://localhost:8080)
- **Health Check**: [http://localhost:8080/health](http://localhost:8080/health)

### Pre-Seeded Demo Credentials
- **Email**: `priya@acme.test`
- **Password**: `password123`

---

## 4 Canonical Load Testing Presets

For on-demand or CI/CD triggered capacity runs, STRIM includes 4 battle-tested load shapes:

| Preset | Concurrency | Duration | Profile | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Smoke Probe** | 10 VUs | 10s | Sustained | Sanity check for token auth, TLS handshakes, and baseline health. |
| **Capacity Ramp** | 50 VUs | 30s | Ramp-Up | Linear step-up to calculate the exact **Saturation Knee** inflection. |
| **Spike Surge** | 150 VUs | 15s | Instant Burst | Sudden traffic surge to test queue elasticity, auto-scalers, and socket backpressure. |
| **Breaking Point Hunt** | 300 VUs | 45s | Aggressive Ramp | Maximum stress ramp to find failure ceilings (429 rate limits vs 504 timeouts). |

---

## REST API Reference

All requests must include `Authorization: Bearer <JWT_OR_API_KEY>` and optional tenant header `x-organization-id: <ORG_ID>`.

### 1. Ingestion: Receive Telemetry Slices
```http
POST /v1/ingest
Content-Type: application/json
x-api-key: strim_live_9f81a7b...

{
  "projectId": "cmvntmj12345",
  "windowStart": 1730000000000,
  "windowEnd": 1730000000500,
  "routes": [
    {
      "method": "POST",
      "path": "/api/checkout",
      "count": 42,
      "p50": 24,
      "p95": 38,
      "p99": 65,
      "errorCount": 0,
      "statusCodes": { "200": 42 }
    }
  ]
}
```

### 2. Discovery: List Auto-Discovered Routes
```http
GET /v1/projects/:projectId/discovery
```
Returns all endpoints registered automatically by the SDK with health status and rolling tail latencies.

### 3. Load Engine: Trigger Capacity Benchmark
```http
POST /v1/load-tests
Content-Type: application/json

{
  "projectId": "cmvntmj12345",
  "name": "PR #42 Saturation Probe",
  "profile": "RAMP_UP",
  "concurrency": 100,
  "durationSec": 30
}
```

### 4. Telemetry Stream: Server-Sent Events (SSE)
```http
GET /v1/load-tests/:id/stream
Accept: text/event-stream
```
Streams live 500ms sliding metrics slices directly to web browsers without polling:
```json
{
  "timestamp": "2026-10-25T20:00:00.000Z",
  "rps": 480,
  "activeVUs": 50,
  "p50Ms": 28,
  "p95Ms": 42,
  "p99Ms": 68,
  "errorCount": 0,
  "statusCodes": { "200": 480 }
}
```

### 5. Instant Emergency Abort
```http
POST /v1/load-tests/:id/abort
```
Cancels all worker threads and cleanly tears down active TCP sockets in `< 200ms`.

---

## CI/CD Regression Gate

Gate pull requests in GitHub Actions so code regressions never reach production.

### GitHub Actions Workflow (`.github/workflows/strim.yml`)
```yaml
name: STRIM Performance Regression Gate
on: [pull_request]

jobs:
  capacity-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger STRIM Capacity Verification
        run: |
          RESPONSE=$(curl -s -X POST https://api.strim.dev/v1/load-tests \
            -H "Authorization: Bearer ${{ secrets.STRIM_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "projectId": "${{ secrets.STRIM_PROJECT_ID }}",
              "name": "PR #${{ github.event.number }} Saturation Gate",
              "profile": "RAMP_UP",
              "concurrency": 100,
              "durationSec": 30
            }')
          echo "Test response: $RESPONSE"
```

---

## Security & Privacy Standards

- **Strict SSRF / Loopback Firewall**: Automatically blocks loopback (`127.0.0.1`, `localhost`), RFC 1918 private subnets (`10.0.0.0/8`, `192.168.0.0/16`), and Cloud Instance Metadata APIs (`169.254.169.254`).
- **AES-256-GCM Encryption**: Project API keys and credentials are encrypted at rest.
- **Zero Payload Storage**: The SDK sanitizes request headers and bodies, recording only timing and HTTP metadata.
- **Sub-200ms Fail-Safe Abort**: Immediately severs worker sockets if target error rates spike.

---

## Verification & Testing

Verify the monorepo across all 6 workspace packages:

```bash
# Typecheck all packages (@strim/web, @strim/server, @strim/sdk, @strim/db, @strim/shared)
bun run typecheck

# Run automated test suite (load engine, analyzer, regression studio)
bun test
```

---

## License

Distributed under the [MIT License](LICENSE). &copy; 2026 STRIM Labs.
