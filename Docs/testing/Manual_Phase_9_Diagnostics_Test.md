# Phase 9: Diagnostics Engine - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test guide for **Phase 9: Diagnostics Engine** of the STRIM Labs backend. It verifies volume-weighted slow endpoint rankings, performance regression detection against historical periods and load test baselines, architectural bottleneck correlation hints (`kind: hint`), and multi-tenant RBAC enforcement.

---

## 🛠️ Environment Prerequisites

Set your target API base URL:

```bash
export API_URL="http://localhost:8080"
```

Verify that the API server is healthy:

```bash
curl -i -X GET "${API_URL}/health"
```

---

## 1. Setup Test Account, Organization & Verified Project

Diagnostics analysis operates on collected telemetry and load test baselines within an organization's project.

### 1.1 Owner Account & Authentication
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "diagnostics-lead@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Grace",
    "last_name": "Hopper"
  }' > /tmp/owner_signup.json

OWNER_TOKEN=$(cat /tmp/owner_signup.json | jq -r '.data.access_token')

# Request and verify OTP code (printed in server console logs)
curl -s -X POST "${API_URL}/v1/auth/otp/send" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"

# Replace 123456 with the logged OTP code
curl -s -X POST "${API_URL}/v1/auth/otp/verify" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"otp": "123456"}'
```

### 1.2 Create Organization & Project
```bash
# Create Organization
curl -s -X POST "${API_URL}/v1/organizations" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Diagnostics Research Org",
    "slug": "diagnostics-org-'"$(date +%s)"'"
  }' > /tmp/org_create.json

ORG_ID=$(cat /tmp/org_create.json | jq -r '.data.id')

# Create Project
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-Commerce Microservices",
    "slug": "ecommerce-api-'"$(date +%s)"'",
    "base_url": "https://api.github.com"
  }' > /tmp/proj_create.json

PROJECT_ID=$(cat /tmp/proj_create.json | jq -r '.data.id')
API_KEY=$(cat /tmp/proj_create.json | jq -r '.data.api_key')

echo "Org ID: ${ORG_ID}"
echo "Project ID: ${PROJECT_ID}"
echo "API Key: ${API_KEY}"
```

---

## 2. Ingest Telemetry Events

Send simulated real-world telemetry representing different endpoint behavior profiles:
- `/api/checkout`: moderate volume, high latency (large volume-weighted impact score)
- `/api/health`: high volume, ultra-fast latency (low impact score)
- `/api/orders`: tail latency dispersion (P99 >> P50) and error bursts

```bash
# 1. Ingest batch of events
curl -s -X POST "${API_URL}/v1/ingest/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "events": [
      {"method": "POST", "path": "/api/checkout", "status": 200, "duration_ms": 250},
      {"method": "POST", "path": "/api/checkout", "status": 200, "duration_ms": 280},
      {"method": "POST", "path": "/api/checkout", "status": 200, "duration_ms": 310},
      {"method": "POST", "path": "/api/checkout", "status": 500, "duration_ms": 400},
      {"method": "GET", "path": "/api/health", "status": 200, "duration_ms": 5},
      {"method": "GET", "path": "/api/health", "status": 200, "duration_ms": 6},
      {"method": "GET", "path": "/api/orders", "status": 200, "duration_ms": 15},
      {"method": "GET", "path": "/api/orders", "status": 200, "duration_ms": 18},
      {"method": "GET", "path": "/api/orders", "status": 200, "duration_ms": 250}
    ]
  }' | jq .
```

---

## 3. Slow Endpoints Ranking (Volume-Weighted Impact Score)

Traditional sorting by raw latency creates false alarms (e.g., an endpoint called once taking 500ms ranks above an endpoint taking 200ms called 50,000 times). STRIM Labs uses:
$$\text{Impact Score} = \text{Requests} \times P_{95}$$

### 3.1 Query Slow Endpoints
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/diagnostics/slow-endpoints?range=1h&limit=10&min_requests=1" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

**Expected JSON Structure:**
```json
{
  "success": true,
  "message": "Slow endpoints retrieved successfully",
  "data": {
    "range": "1h",
    "total_evaluated": 3,
    "endpoints": [
      {
        "method": "POST",
        "route": "/api/checkout",
        "service": "api",
        "requests": 4,
        "p50_ms": 280.0,
        "p95_ms": 386.5,
        "p99_ms": 397.3,
        "error_rate": 0.25,
        "impact_score": 1546.0
      },
      {
        "method": "GET",
        "route": "/api/orders",
        "service": "api",
        "requests": 3,
        "p50_ms": 18.0,
        "p95_ms": 226.6,
        "p99_ms": 245.3,
        "error_rate": 0.0,
        "impact_score": 679.8
      }
    ]
  }
}
```

### 3.2 Filter with Threshold
Test `min_requests` filtering:
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/diagnostics/slow-endpoints?range=1h&min_requests=10" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
Expected: `endpoints: []` since fewer than 10 requests were recorded.

---

## 4. Performance Regression Detection

Identifies latency and error rate degradation against either:
1. `baseline=previous`: The immediately preceding time window of identical length.
2. `baseline=test:{id}`: A specific completed load test experiment run.

### 4.1 Compare Against Previous Period
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/diagnostics/regressions?range=1h&baseline=previous&threshold_pct=10.0" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

### 4.2 Compare Against a Load Test Baseline
Create and complete a load test run:
```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Staging Baseline Run",
    "model": "open",
    "profile": "step",
    "targets": [
      {"method": "POST", "path": "/api/checkout", "weight": 100}
    ],
    "duration_seconds": 15,
    "step": {
      "initial_rps": 10,
      "step_rps": 10,
      "step_duration_seconds": 5,
      "max_rps": 30
    }
  }' > /tmp/lt_baseline.json

TEST_ID=$(cat /tmp/lt_baseline.json | jq -r '.data.id')
echo "Test ID: ${TEST_ID}"

# Wait for test to complete (approx 15 seconds)
sleep 16

# Query regressions against test baseline
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/diagnostics/regressions?range=1h&baseline=test:${TEST_ID}&threshold_pct=10.0" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

**Expected JSON Response:**
```json
{
  "success": true,
  "message": "Regressions evaluated successfully",
  "data": {
    "baseline": "test:lt-018f...",
    "range": "1h",
    "threshold_pct": 10.0,
    "regressions": [
      {
        "method": "POST",
        "route": "/api/checkout",
        "metric": "p95_latency",
        "baseline_value": 45.0,
        "current_value": 310.0,
        "change_pct": 588.8,
        "severity": "critical"
      }
    ]
  }
}
```

---

## 5. Architectural Bottleneck Correlation Hints

Per API.md Section 13, bottleneck observations are explicitly tagged `"kind": "hint"` with structured evidence and confidence ratings (`high`, `medium`, `low`) because telemetry correlates symptoms rather than proves single root causes.

### 5.1 Query Bottlenecks
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/diagnostics/bottlenecks?range=1h" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

**Expected JSON Response:**
```json
{
  "success": true,
  "message": "Bottleneck diagnostic hints generated successfully",
  "data": {
    "range": "1h",
    "hints": [
      {
        "kind": "hint",
        "type": "high_execution_concentration",
        "confidence": "high",
        "message": "Endpoint POST /api/checkout consumes 88.5% of total server execution time across all evaluated endpoints.",
        "evidence": {
          "endpoint_time_ms": 1240.0,
          "method": "POST",
          "route": "/api/checkout",
          "share_pct": 88.5,
          "total_time_ms": 1400.0
        }
      },
      {
        "kind": "hint",
        "type": "tail_latency_dispersion",
        "confidence": "high",
        "message": "Endpoint GET /api/orders exhibits high tail latency dispersion (P99/P50 ratio 13.6 >= 4.0).",
        "evidence": {
          "dispersion_ratio": 13.6,
          "method": "GET",
          "p50_ms": 18.0,
          "p99_ms": 245.3,
          "route": "/api/orders"
        }
      },
      {
        "kind": "hint",
        "type": "load_correlated_errors",
        "confidence": "medium",
        "message": "Elevated server error rate detected (25.0% of requests returned 5xx status codes).",
        "evidence": {
          "error_rate": 0.25,
          "total_errors": 1,
          "total_requests": 4
        }
      }
    ]
  }
}
```

---

## 6. Multi-Tenant RBAC & Isolation Verification

### 6.1 Role Access Hierarchy
- `Owner`, `Admin`, `Member`, `Viewer` can read diagnostics (`200 OK`).

### 6.2 Outsider Isolation (404 Not Found)
Create an outsider user not in the organization:
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "outsider@evilcorp.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Eve",
    "last_name": "Mallory"
  }' > /tmp/outsider.json

OUTSIDER_TOKEN=$(cat /tmp/outsider.json | jq -r '.data.access_token')

# Attempt access to diagnostics:
curl -i -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/diagnostics/slow-endpoints" \
  -H "Authorization: Bearer ${OUTSIDER_TOKEN}"

curl -i -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/diagnostics/regressions" \
  -H "Authorization: Bearer ${OUTSIDER_TOKEN}"

curl -i -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/diagnostics/bottlenecks" \
  -H "Authorization: Bearer ${OUTSIDER_TOKEN}"
```

**Expected Result**: Every request returns HTTP `404 Not Found` with message `Organization not found` — completely concealing tenant and project existence.

---

## 7. Automated Test Suite Execution

Run the complete automated diagnostics unit and integration test suite:

```bash
cd backend
go test -v -race ./internal/domain -run TestDiagnostics
go test -v -race ./internal/service -run TestDiagnostics
go test -v -race ./internal/http/handlers -run TestDiagnostics
```
All tests must pass cleanly with zero data race warnings (`-race`).
