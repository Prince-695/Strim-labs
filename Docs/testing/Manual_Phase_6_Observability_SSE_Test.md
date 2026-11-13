# Phase 6: Observability Dashboard, Metrics Engine & Real-Time SSE - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test guide for **Phase 6: Observability Dashboard, Multi-Tier Metrics Engine (Raw Events / 1m Rollups / 1h Rollups), Logarithmic Percentiles, and Real-Time SSE Streaming** of the STRIM Labs backend.

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

## 1. Setup Test Account, Organization, Project & Telemetry Data

Create and verify an owner account, set up an organization and project, and ingest sample telemetry events so metrics have real data to aggregate.

### 1.1 Owner Account & Email Verification
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "observability-dev@strimlabs.dev",
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
    "name": "Observability Corp",
    "slug": "obs-corp-'"$(date +%s)"'"
  }' > /tmp/org_create.json

ORG_ID=$(cat /tmp/org_create.json | jq -r '.data.id')

# Create Project
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkout API",
    "slug": "checkout-api-'"$(date +%s)"'",
    "base_url": "https://api.checkout.example.com"
  }' > /tmp/proj_create.json

PROJECT_ID=$(cat /tmp/proj_create.json | jq -r '.data.id')
echo "Organization ID: ${ORG_ID}"
echo "Target Project ID: ${PROJECT_ID}"
```

### 1.3 Ingest Sample Telemetry Events
Send a batch of events with different statuses and latencies to seed the metrics engine:

```bash
curl -i -s -X POST "${API_URL}/v1/ingest/events" \
  -H "X-API-Key: ${PROJECT_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "checkout-svc",
    "events": [
      {
        "method": "GET",
        "path": "/cart",
        "route": "/cart",
        "status": 200,
        "duration_ms": 12.4,
        "bytes": 512
      },
      {
        "method": "POST",
        "path": "/cart/items",
        "route": "/cart/items",
        "status": 201,
        "duration_ms": 45.2,
        "bytes": 1024
      },
      {
        "method": "POST",
        "path": "/checkout/pay",
        "route": "/checkout/pay",
        "status": 500,
        "duration_ms": 320.0,
        "bytes": 256
      },
      {
        "method": "GET",
        "path": "/orders/123",
        "route": "/orders/{id}",
        "status": 404,
        "duration_ms": 8.1,
        "bytes": 128
      }
    ]
  }'

# Allow batcher a moment to process buffered telemetry
sleep 1
```

---

## 2. Metrics Overview (`GET /v1/organizations/:orgID/projects/:projectID/metrics/overview`)

### 2.1 Default 15-Minute Overview
Fetches current window metrics (RPS, total requests, percentiles p50/p90/p95/p99, error rate) compared with the prior period.

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/overview?range=15m" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "current": {
      "rps": 0.0044,
      "requests": 4,
      "p50": 28.8,
      "p90": 200.0,
      "p95": 280.0,
      "p99": 312.0,
      "avg": 96.4,
      "error_rate": 0.25,
      "success_rate": 0.75,
      "timeouts": 0
    },
    "previous": {
      "requests": 0,
      "p95": 0,
      "error_rate": 0,
      "rps": 0
    }
  }
}
```

### 2.2 Extended Ranges (1h, 24h, 7d, 30d)
Verify that multi-tier resolution dynamically switches:
- `range=1h` or `range=24h`: queries aggregated 1-minute rollups (`request_rollup_1m`).
- `range=7d` or `range=30d`: queries aggregated 1-hour rollups (`request_rollup_1h`).

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/overview?range=24h" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

---

## 3. Metrics Timeseries (`GET /v1/organizations/:orgID/projects/:projectID/metrics/timeseries`)

### 3.1 Timeseries Queries (RPS, P95, Error Rate)
Test discrete time bucket series with automatic step calculation:

```bash
# Query P95 latency timeseries over 15 minutes
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/timeseries?metric=p95&range=15m" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .

# Query Error Rate timeseries over 1 hour
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/timeseries?metric=error_rate&range=1h" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

**Expected Response Format:**
Empty intervals serialize as `null` values per API Spec 10.2:
```json
{
  "success": true,
  "data": {
    "metric": "p95",
    "unit": "ms",
    "step": "1m",
    "series": [
      {
        "key": "all",
        "points": [
          ["2026-11-13T15:40:00Z", null],
          ["2026-11-13T15:41:00Z", 280.0],
          ["2026-11-13T15:42:00Z", null]
        ]
      }
    ]
  }
}
```

---

## 4. Endpoints Metrics & Health Classification (`GET /v1/organizations/:orgID/projects/:projectID/metrics/endpoints`)

### 4.1 Endpoint Health Classification
Health rules evaluated:
- **`healthy`**: Error rate $\le 1\%$ and $P_{95} \le 500\text{ms}$.
- **`degraded`**: $1\% < \text{Error rate} \le 5\%$ OR $500\text{ms} < P_{95} \le 2000\text{ms}$.
- **`failing`**: $\text{Error rate} > 5\%$ OR $P_{95} > 2000\text{ms}$.
- **`no_data`**: 0 requests recorded in query window.

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/endpoints?range=15m" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

### 4.2 Endpoint Sorting & Search Filtering
```bash
# Sort by highest P95 latency
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/endpoints?sort=-p95" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .

# Search for specific route
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/endpoints?q=cart" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

---

## 5. Status Codes Distribution (`GET /v1/organizations/:orgID/projects/:projectID/metrics/status-codes`)

Fetches HTTP response status distributions grouped by status classes (`2xx`, `3xx`, `4xx`, `5xx`) and individual status codes.

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/status-codes?range=15m" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "classes": {
      "2xx": 2,
      "3xx": 0,
      "4xx": 1,
      "5xx": 1
    },
    "codes": [
      { "status": 200, "count": 1 },
      { "status": 201, "count": 1 },
      { "status": 404, "count": 1 },
      { "status": 500, "count": 1 }
    ]
  }
}
```

---

## 6. Host Infrastructure Metrics (`GET /v1/organizations/:orgID/projects/:projectID/metrics/hosts`)

When no infrastructure host agents are attached, this gracefully returns `connected: false` per API Spec 10.5:

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/hosts" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "connected": false,
    "series": []
  }
}
```

---

## 7. Real-Time SSE Stream (`GET /v1/organizations/:orgID/projects/:projectID/metrics/stream`)

### 7.1 Connect and Receive Live Stream
Connect with `curl -N` (no buffering). The server immediately flushes headers and an initial `overview` snapshot, then periodic snapshots every interval (e.g. `2s`) and `: ping` heartbeat comments every 15s.

```bash
curl -N -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/stream?interval=2s" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```

**Expected Stream Output:**
```
event: overview
id: 1
data: {"ts":"2026-11-13T15:45:00Z","rps":0.0044,"p95":280.0,"p99":312.0,"error_rate":0.25,"requests_last_interval":4}

: ping

event: overview
id: 2
data: {"ts":"2026-11-13T15:45:02Z","rps":0.0044,"p95":280.0,"p99":312.0,"error_rate":0.25,"requests_last_interval":4}
```

### 7.2 Max Concurrent Streams Limit (5 per User & Project)
Attempting to open more than 5 concurrent SSE streams under the same account returns `429 Too Many Requests`:

```bash
# In 5 separate background processes:
for i in {1..5}; do
  curl -N -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/stream" \
    -H "Authorization: Bearer ${OWNER_TOKEN}" > /dev/null &
done

# The 6th connection attempt is blocked:
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/stream" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```

**Expected Response:**
```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Maximum concurrent SSE streams reached (limit: 5)"
  }
}
```

---

## 8. Multi-Tenancy & RBAC Verification

Verify that project viewers, members, admins, and owners can access metrics, while unauthorized outsiders are blocked.

### 8.1 Outsider Blocked (`403 Forbidden`)
```bash
# Create an unrelated user
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "outsider@othercorp.com",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Bob",
    "last_name": "Outsider"
  }' > /tmp/outsider_signup.json

OUTSIDER_TOKEN=$(cat /tmp/outsider_signup.json | jq -r '.data.access_token')

curl -s -X POST "${API_URL}/v1/auth/otp/send" \
  -H "Authorization: Bearer ${OUTSIDER_TOKEN}"
curl -s -X POST "${API_URL}/v1/auth/otp/verify" \
  -H "Authorization: Bearer ${OUTSIDER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"otp": "123456"}'

# Access metrics without membership
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/metrics/overview" \
  -H "Authorization: Bearer ${OUTSIDER_TOKEN}"
```

**Expected Response:**
```
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not a member of this organization"
  }
}
```

---

## Summary Matrix

| Metric Endpoint | Method | Path | Allowed Roles | Cache TTL |
|---|---|---|---|---|
| Metrics Overview | GET | `/v1/organizations/:orgID/projects/:projectID/metrics/overview` | `viewer+` | 10s |
| Metrics Timeseries | GET | `/v1/organizations/:orgID/projects/:projectID/metrics/timeseries` | `viewer+` | 10s |
| Endpoints Health & Metrics | GET | `/v1/organizations/:orgID/projects/:projectID/metrics/endpoints` | `viewer+` | 10s |
| Status Codes Distribution | GET | `/v1/organizations/:orgID/projects/:projectID/metrics/status-codes` | `viewer+` | 10s |
| Hosts Metrics | GET | `/v1/organizations/:orgID/projects/:projectID/metrics/hosts` | `viewer+` | 10s |
| Real-Time SSE Stream | GET | `/v1/organizations/:orgID/projects/:projectID/metrics/stream` | `viewer+` | Real-time (max 5 streams) |
