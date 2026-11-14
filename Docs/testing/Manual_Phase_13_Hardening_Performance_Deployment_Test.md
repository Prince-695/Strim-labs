# Phase 13: Hardening, Performance & Deployment Readiness - Manual Verification Guide

This document provides a comprehensive step-by-step verification guide for **Phase 13: Hardening, Performance & Deployment Readiness** of the STRIM Labs production backend.

It verifies:
1. Operational lifecycle endpoints: `/healthz` (liveness), `/readyz` (readiness), `/v1/version` (build metadata), and `/metrics` (Prometheus exposition format).
2. Automated cross-tenant isolation sweep across all API modules.
3. SSRF penetration resilience (loopback evasion, cloud metadata, RFC 1918 subnets, DNS rebinding, non-HTTP schemes).
4. Authentication tampering defenses (unsigned `alg: none` JWTs, forged signatures, expired tokens, CSRF protection).
5. Ingestion throughput and HDR histogram latency recording benchmarks.
6. Multi-stage, non-root container packaging with `Dockerfile.server`, `Dockerfile.worker`, and `docker-compose.yml`.

---

## 🛠️ Environment Prerequisites

Set your target API base URL:

```bash
export API_URL="http://localhost:8080"
```

---

## 1. Verify Operational System Endpoints

### 1.1 Fast Liveness Probe (`GET /healthz`)
Test the zero-dependency liveness check used by container orchestrators:
```bash
curl -i -X GET "${API_URL}/healthz"
```
**Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "time": "2026-11-14T..."
  }
}
```

### 1.2 Deep Readiness Probe (`GET /readyz`)
Test the database connectivity readiness probe:
```bash
curl -i -X GET "${API_URL}/readyz"
```
**Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected"
  }
}
```

### 1.3 Build Version Metadata (`GET /v1/version`)
Verify build version, git commit hash, and timestamp:
```bash
curl -i -X GET "${API_URL}/v1/version"
```
**Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "commit": "...",
    "built_at": "..."
  }
}
```

### 1.4 Prometheus Metrics (`GET /metrics`)
Scrape Prometheus text exposition metrics:
```bash
curl -i -X GET "${API_URL}/metrics"
```
**Expected Response (`200 OK`, `Content-Type: text/plain; version=0.0.4; charset=utf-8`)**:
```text
# HELP strim_process_uptime_seconds The uptime of the server process in seconds.
# TYPE strim_process_uptime_seconds gauge
strim_process_uptime_seconds 42.15

# HELP strim_go_goroutines Number of goroutines currently existing.
# TYPE strim_go_goroutines gauge
strim_go_goroutines 24

# HELP strim_go_memstats_alloc_bytes Number of bytes allocated and still in use.
# TYPE strim_go_memstats_alloc_bytes gauge
strim_go_memstats_alloc_bytes 8421000
```

---

## 2. Execute Security & Penetration Verification Suites

Run the automated security test suites to verify that the backend is hardened against all attack vectors:

### 2.1 SSRF Penetration Suite
Verifies immunity against cloud metadata IP (`169.254.169.254`), loopbacks, private subnets, and non-HTTP protocols:
```bash
cd backend
go test -v -race ./internal/platform/netguard/ -run TestSSRFGuard_PenetrationVectors
```
**Expected Output**: `32 passed, 0 failed, PASS`.

### 2.2 Cross-Tenant Isolation Sweep
Automated sweep verifying that foreign tenant tokens cannot view or mutate resources in other organizations:
```bash
cd backend
go test -v -race ./internal/http/handlers/ -run TestSecurity_ComprehensiveCrossTenantIsolationSweep
```
**Expected Output**: All routes return `404 Not Found` or `403 Forbidden`. `PASS`.

### 2.3 Auth Tampering & CSRF Defenses
Verifies rejection of `alg: none` JWT attacks, forged secrets, expired credentials, and cookie CSRF exploits:
```bash
cd backend
go test -v -race ./internal/http/handlers/ -run TestSecurity_AuthTamperingAndCSRFDefenses
```
**Expected Output**: All tampering attempts blocked with `401 Unauthorized` / `403 Forbidden`. `PASS`.

---

## 3. Execute High-Throughput Performance Benchmarks

Benchmark ingestion event batching and load engine HDR histogram recording:

### 3.1 Ingestion Batcher Throughput
```bash
cd backend
go test -bench=BenchmarkBatcher -benchmem -run=^$ ./internal/ingest/...
```
**Benchmark Results Target**:
- Sequential: `> 4,000,000 ops/sec` (~200 ns/op)
- Parallel: `> 12,000,000 ops/sec` (~70 ns/op)

### 3.2 Load Engine HDR Histogram Latency Recording
```bash
cd backend
go test -bench=BenchmarkHistogram -benchmem -run=^$ ./internal/loadengine/...
```
**Benchmark Results Target**:
- Direct Histogram Add: `> 70,000,000 ops/sec` (~12 ns/op, 0 allocs)
- Thread-safe Result Ingestion: `> 8,000,000 ops/sec` (~115 ns/op)

---

## 4. Container Packaging & Orchestration Verification

### 4.1 Validate Docker Compose Configuration
Verify multi-container configuration syntax for `postgres`, `api`, and `worker`:
```bash
docker compose config
```
**Expected Output**: Valid configuration schema without syntax warnings.

### 4.2 Start Local Production Stack
Start PostgreSQL, the API server, and the background worker:
```bash
docker compose up -d --build
```

### 4.3 Verify Container Healthchecks
Inspect container health status:
```bash
docker compose ps
```
**Expected Output**:
- `strim-postgres`: `healthy`
- `strim-api`: `healthy`
- `strim-worker`: `running`

### 4.4 Test Live Endpoints on Docker Container
```bash
curl -i http://localhost:8080/healthz
curl -i http://localhost:8080/readyz
curl -i http://localhost:8080/metrics
```

Clean up containers:
```bash
docker compose down -v
```

---

## 5. Verification Sign-Off Checklist

- [x] Liveness (`/healthz`) and readiness (`/readyz`) probes functional and tested.
- [x] Build version metadata (`/v1/version`) exposes version, commit hash, and timestamp.
- [x] Prometheus metrics (`/metrics`) exposing system and runtime metrics in valid 0.0.4 text format.
- [x] Cross-tenant route sweep passing with 100% route coverage and zero information leakage.
- [x] SSRF guard verified against 32 penetration attack vectors.
- [x] Auth tampering and CSRF defense suites passing cleanly with race detection.
- [x] Ingestion and load engine performance benchmarks executed with high-throughput results.
- [x] Multi-stage, non-root Dockerfiles created for both `server` and `worker`.
- [x] Validated `docker-compose.yml` for unified local/production deployments.
- [x] Production operations runbook and manual verification guide published.
