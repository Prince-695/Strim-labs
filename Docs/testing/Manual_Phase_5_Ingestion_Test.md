# Phase 5: Telemetry Ingestion & Time-Series Storage - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test guide for **Phase 5: Telemetry Ingestion, Gzip Decompression, Bounded Buffering, Percentile Histograms, Rollups & Backpressure** of the STRIM Labs backend.

---

## 🛠️ Environment Prerequisites

Set your target API base URL and cookie jar:

```bash
export API_URL="http://localhost:8080"
export COOKIE_JAR="/tmp/strim_cookies_phase5.txt"
rm -f "$COOKIE_JAR"
```

Verify that the API server is healthy:

```bash
curl -i -X GET "${API_URL}/health"
```

---

## 1. Setup Test Account, Organization & Project

Create and verify an owner account, set up an organization, and create a project to obtain a valid `PROJECT_ID`:

### 1.1 Owner Account & Email Verification
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "telemetry-dev@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Alan",
    "last_name": "Turing"
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
    "name": "Acme Telemetry Corp",
    "slug": "acme-telemetry-'"$(date +%s)"'"
  }' > /tmp/org_create.json

ORG_ID=$(cat /tmp/org_create.json | jq -r '.data.id')

# Create Project
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payments API",
    "slug": "payments-api-'"$(date +%s)"'",
    "base_url": "https://api.acmepayments.com"
  }' > /tmp/proj_create.json

PROJECT_ID=$(cat /tmp/proj_create.json | jq -r '.data.id')
echo "Target Project ID: ${PROJECT_ID}"
```

---

## 2. Telemetry Ingestion (`POST /v1/ingest/events`)

### 2.1 Standard JSON Batch with Automatic Path Normalization
Post a telemetry batch. Notice `/payments/order_12345` does not supply a `route` template; the server will automatically normalize it to `/payments/{id}`.

```bash
curl -i -s -X POST "${API_URL}/v1/ingest/events" \
  -H "X-API-Key: ${PROJECT_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "payments-worker",
    "events": [
      {
        "method": "POST",
        "path": "/payments/charge",
        "route": "/payments/charge",
        "status": 200,
        "duration_ms": 38.4,
        "bytes": 512
      },
      {
        "method": "GET",
        "path": "/payments/order_12345",
        "status": 200,
        "duration_ms": 19.1,
        "bytes": 1024
      },
      {
        "method": "GET",
        "path": "/payments/failed-tx",
        "status": 500,
        "duration_ms": 145.2,
        "bytes": 256
      }
    ]
  }'
```
**Expected Output:** HTTP `202 Accepted`
```json
{
  "success": true,
  "data": {
    "accepted": 3,
    "rejected": 0
  }
}
```

---

## 3. Gzip Compressed Ingestion

Telemetry SDKs compress batches before transmission. Test gzip ingestion with `Content-Encoding: gzip`:

```bash
# Generate JSON payload and gzip compress it
cat << 'EOF' > /tmp/telemetry_batch.json
{
  "service": "checkout-api",
  "events": [
    {
      "method": "POST",
      "path": "/checkout/cart",
      "status": 201,
      "duration_ms": 52.8,
      "bytes": 1420
    }
  ]
}
EOF

gzip -c /tmp/telemetry_batch.json > /tmp/telemetry_batch.json.gz

# Send compressed payload
curl -i -s -X POST "${API_URL}/v1/ingest/events" \
  -H "X-Project-ID: ${PROJECT_ID}" \
  -H "Content-Type: application/json" \
  -H "Content-Encoding: gzip" \
  --data-binary "@/tmp/telemetry_batch.json.gz"
```
**Expected Output:** HTTP `202 Accepted` with `accepted: 1`.

---

## 4. Authentication Matrix

### 4.1 Missing API Key / Project ID (Expected: 401 Unauthorized)
```bash
curl -i -s -X POST "${API_URL}/v1/ingest/events" \
  -H "Content-Type: application/json" \
  -d '{"events": [{"method": "GET", "path": "/ping", "status": 200, "duration_ms": 5}]}'
```
**Expected Output:** HTTP `401 Unauthorized` with `error_code: "UNAUTHORIZED"`.

### 4.2 Non-Existent Project Key (Expected: 404 Project Not Found)
```bash
curl -i -s -X POST "${API_URL}/v1/ingest/events" \
  -H "X-API-Key: 00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{"events": [{"method": "GET", "path": "/ping", "status": 200, "duration_ms": 5}]}'
```
**Expected Output:** HTTP `404 Not Found` with `error_code: "PROJECT_NOT_FOUND"`.

### 4.3 Bearer Header Auth Format
```bash
curl -i -s -X POST "${API_URL}/v1/ingest/events" \
  -H "Authorization: Bearer ${PROJECT_ID}" \
  -H "Content-Type: application/json" \
  -d '{"events": [{"method": "GET", "path": "/ping", "status": 200, "duration_ms": 5}]}'
```
**Expected Output:** HTTP `202 Accepted`.

---

## 5. Partial Validation & Error Reporting

The ingestion pipeline accepts valid events while reporting indices of invalid ones:

```bash
curl -i -s -X POST "${API_URL}/v1/ingest/events" \
  -H "X-API-Key: ${PROJECT_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "method": "INVALID_VERB",
        "path": "/test",
        "status": 200,
        "duration_ms": 10
      },
      {
        "method": "GET",
        "path": "",
        "status": 200,
        "duration_ms": 10
      },
      {
        "method": "GET",
        "path": "/valid-item",
        "status": 200,
        "duration_ms": 15
      }
    ]
  }'
```
**Expected Output:** HTTP `202 Accepted`
```json
{
  "success": true,
  "data": {
    "accepted": 1,
    "rejected": 2,
    "errors": [
      { "index": 0, "reason": "invalid HTTP method: INVALID_VERB" },
      { "index": 1, "reason": "path cannot be empty" }
    ]
  }
}
```

---

## 6. Clock-Skew Validation

Events older than 24 hours or more than 5 minutes in the future are rejected:

```bash
curl -i -s -X POST "${API_URL}/v1/ingest/events" \
  -H "X-API-Key: ${PROJECT_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "ts": "2020-01-01T00:00:00Z",
        "method": "GET",
        "path": "/stale-event",
        "status": 200,
        "duration_ms": 10
      }
    ]
  }'
```
**Expected Output:** HTTP `202 Accepted` with `accepted: 0, rejected: 1`, reason: `event timestamp is older than 24 hours`.

---

## 7. Runtime Route Discovery

Verify that ingested routes are automatically registered in the Phase 4 Registry with `source: runtime`:

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/endpoints?source=runtime" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Expected Output:**
List of discovered endpoints including `POST /payments/charge` and `GET /payments/{id}` showing:
```json
{
  "path_template": "/payments/{id}",
  "method": "GET",
  "sources": ["runtime"]
}
```

---

## 8. Backpressure Protection

When the bounded buffer capacity (> 95%) is saturated under extreme burst:
- The server responds with HTTP `429 Too Many Requests`.
- The `Retry-After: 2` header is included.
- Error Code: `INGEST_BACKPRESSURE`.

Clients must respect the `Retry-After` backoff and retry.
