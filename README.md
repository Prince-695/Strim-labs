<div align="center">

# STRIM Labs

### Real-Time API Load Testing & Breaking Point Detection Engine

*Find your API's breaking point before production does.*

[![Bun](https://img.shields.io/badge/Runtime-Bun%201.2+-000000?style=flat&logo=bun)](https://bun.sh)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=flat&logo=next.js)](https://nextjs.org)
[![Hono](https://img.shields.io/badge/Backend-Hono%20Modular-E36002?style=flat&logo=hono)](https://hono.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20100%25-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-00C968?style=flat)](LICENSE)

[**Live Demo Preview**](#live-demo-target) &bull;
[**Quickstart (60s)**](#quickstart) &bull;
[**Architecture**](#architecture) &bull;
[**4 Load Presets**](#4-canonical-load-presets) &bull;
[**CI/CD Regression Gate**](#cicd-regression-gate) &bull;
[**API Reference**](#api-reference)

---

</div>

## Overview

**STRIM Labs** is a developer-first API load testing and capacity benchmarking platform. It replaces heavy, scripted testing tools (JMeter, K6, Locust) with a high-throughput, native Bun execution engine, intuitive 1-click presets, and real-time empirical capacity analysis.

Instead of outputting raw log dumps or subjective pass/fail guesses, STRIM mathematically determines your API's **3-Zone Capacity Spectrum**:

```text
 0 RPS ─────────────────── Sustainable Target ─────────────── Saturation Knee ─────────────── Critical Cliff ───>
           [ Safe Band ]                     [ Saturation Knee ]            [ Breaking Cliff ]
           • Latency < 50ms                  • Latency Curvature Inflects   • Errors / 429 Surge
           • 0.0% Error Rate                 • Queue Contention Begins      • Worker Exhaustion
```

---

## Key Features

### 1. 4 Canonical Zero-Config Load Presets
No complex test scripting required. Execute battle-tested load shapes with 1 click:
- **Smoke Probe** (`10 VUs · 10s · Sustained`): Basic sanity check for auth, token validation, and database connection pools.
- **Capacity Ramp** (`50 VUs · 30s · Ramp-Up`): Linear concurrency increase to identify the exact **Saturation Knee**.
- **Spike Surge** (`150 VUs · 15s · Instant Burst`): Sudden traffic spike to evaluate worker elasticity and queue absorption.
- **Breaking Point Hunt** (`300 VUs · 45s · Aggressive Ramp`): Stress to saturation to find the ceiling capacity and failure modes (429 rate limit vs. 504 gateway timeout).

### 2. 500ms Streaming Telemetry & Sub-200ms Abort Control
- Real-time Server-Sent Events (SSE) telemetry dials streaming **Throughput (RPS)**, **P95 Tail Latency (ms)**, and **Active VUs** with zero database polling overhead.
- Live HTTP status code pills (`2xx`, `429`, `5xx`).
- **Emergency Abort Switch**: Immediately terminates all socket connections in `< 200ms` if your upstream server begins to degrade.

### 3. Evidence-Based Diagnostics (Zero Theatre)
Every completed benchmark run produces an empirical, zero-guess diagnosis card:
- **Observed Facts**: Verified metrics (exact peak RPS, tail latency spike, error distribution).
- **Qualified Hypothesis**: Concrete architectural diagnoses (e.g. *"HTTP 429 rate limits triggered at 640 RPS; inspect reverse proxy token bucket configuration"*).
- **Actionable Engineering Steps**: Prioritized fixes for connection pools, worker threads, or gateway limits.

### 4. Run-to-Run Regression Comparison Studio
- Side-by-side run comparison (Production Baseline vs Candidate PR).
- **In-Studio Tolerance Adjuster**: Live sliders for *Max Latency Degradation Tolerance (%)*, *Max Error Rate Tolerance (%)*, and *Min Throughput Retention (%)*.
- Instant **PASS / FAIL / INCONCLUSIVE** deployment verdict for GitHub Actions and GitLab CI.

### 5. Curated Engineering Design System
- Built with a minimal, developer-first aesthetic inspired by HackerRank and Wispr Flow.
- Dual theme support:
  - **Light Mode**: `#F7F9F8` background with `#00C968` emerald accent.
  - **Dark Mode**: `#0B1015` background with `#00E575` high-contrast neon accent.
- Tabular numerals (`tnum`) across all dials, metrics, and timestamps to eliminate UI jitter during live streams.

---

## Architecture

STRIM is structured as a clean, modular TypeScript monorepo powered by Bun workspaces:

```text
strim-labs/
├── apps/
│   ├── server/           # Hono API + Native Bun multi-worker HTTP load engine + SSE broadcaster
│   └── web/              # Next.js 16 App Router + Tailwind CSS + Lucide + Recharts
├── packages/
│   ├── db/               # Prisma ORM schema & client (PostgreSQL)
│   ├── shared/           # Saturation knee mathematical analyzer & comparison gate engine
│   └── tsconfig/         # Shared TypeScript configurations
└── infra/                # Docker Compose for local PostgreSQL
```

### Component Flow

```mermaid
flowchart LR
    subgraph Client
        Browser["Next.js Console (/runner)"]
        CI["CI/CD Pipeline (GitHub Actions)"]
    end

    subgraph STRIM Server
        API["Hono REST Endpoints (/v1/load-tests)"]
        Engine["Native Bun Multi-Worker Runner"]
        RingBuffer["In-Memory 500ms Ring Buffer"]
    end

    subgraph Upstream
        Target["Target API Endpoint"]
    end

    Browser -->|Launch Benchmark| API
    CI -->|POST /v1/load-tests| API
    API --> Engine
    Engine -->|High-Concurrency HTTP| Target
    Target -->|Responses & Latencies| Engine
    Engine --> RingBuffer
    RingBuffer -->|Server-Sent Events (SSE)| Browser
    API -->|Verdict (PASS / FAIL)| CI
```

---

## Quickstart

### Prerequisites
- [Bun](https://bun.sh) (v1.2 or higher)
- [Docker](https://www.docker.com) & Docker Compose (for local PostgreSQL)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Prince-695/Strim.git
cd Strim
bun install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/strim?schema=public"
JWT_SECRET="strim-super-secret-development-jwt-key"
PORT=8080
NEXT_PUBLIC_API_URL="http://localhost:8080"
```

### 3. Start Database & Seed
```bash
# Start PostgreSQL container
docker compose -f infra/docker-compose.yml up -d

# Push schema and seed pre-configured demo targets and runs
bun run db:push
bun run db:seed
```

### 4. Run Development Servers
```bash
bun run dev
```

- **Web Console**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:8080](http://localhost:8080)
- **API Health Check**: [http://localhost:8080/health](http://localhost:8080/health)

### Pre-Seeded Demo Account
- **Email**: `priya@acme.test`
- **Password**: `password123`

---

## Live Demo Target

Don't have an API to benchmark right now? STRIM includes a built-in local target:
1. Open [http://localhost:3000/runner](http://localhost:3000/runner).
2. Click **"Use Local Demo API"** (sets target to `http://localhost:3001/health`).
3. Click **"Smoke Probe"** and hit **"Launch Test Run"**.
4. Watch live telemetry stream in real-time with zero external setup.

---

## CI/CD Regression Gate

Block performance regressions before merging pull requests.

### GitHub Actions Workflow (`.github/workflows/strim.yml`)

```yaml
name: STRIM Performance Regression Gate
on: [pull_request]

jobs:
  benchmark-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger STRIM Capacity Test
        run: |
          RESPONSE=$(curl -s -X POST https://api.strim.dev/v1/load-tests \
            -H "Authorization: Bearer ${{ secrets.STRIM_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "projectId": "${{ secrets.STRIM_PROJECT_ID }}",
              "name": "PR #${{ github.event.number }} Gate",
              "profile": "RAMP_UP",
              "concurrency": 50,
              "durationSec": 30
            }')
          echo "Test response: $RESPONSE"
```

---

## REST API Reference

All requests require `Authorization: Bearer <API_KEY_OR_JWT>` and optionally `x-organization-id: <ORG_ID>`.

### 1. Trigger Load Test
```http
POST /v1/load-tests
Content-Type: application/json

{
  "projectId": "proj_12345",
  "name": "Release v2.4 Capacity Probe",
  "profile": "RAMP_UP",
  "concurrency": 50,
  "durationSec": 30
}
```

### 2. Stream Live Telemetry (SSE)
```http
GET /v1/load-tests/:id/stream
Accept: text/event-stream
```
Streams continuous 500ms granularity chunks:
```json
{
  "timestamp": "2026-10-24T21:00:00.000Z",
  "rps": 480,
  "activeVUs": 50,
  "p50Ms": 28,
  "p95Ms": 42,
  "p99Ms": 68,
  "errorCount": 0,
  "statusCodes": { "200": 480 }
}
```

### 3. Abort Running Test
```http
POST /v1/load-tests/:id/abort
```
Cancels all in-flight workers in `< 200ms` and updates status to `CANCELLED`.

### 4. Compare Two Runs
```http
GET /v1/compare?runA=<BASELINE_ID>&runB=<CANDIDATE_ID>
```
Returns latency delta, throughput delta, error delta, and overall performance verdict.

---

## Security & Responsible Testing

- **SSRF Protection**: All target URLs undergo strict loopback and private IP validation before worker socket allocation.
- **Secret Encryption**: Bearer tokens and authorization headers are encrypted at rest with AES-256-GCM.
- **Fail-Safe Sockets**: Multi-worker executors respect timeout ceilings and enforce immediate connection teardown upon manual abort or server crash.

---

## License

Distributed under the [MIT License](LICENSE). &copy; 2026 Strim Labs.
