# Phase 7: Load Testing Engine & Distributed Execution - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test guide for **Phase 7: Load Testing Engine & Distributed Execution** of the STRIM Labs backend. It verifies all aspects of load testing: open/closed concurrency models, profile schedulers (sustained, ramp, spike, step), coordinated omission elimination, live SSE progress streaming, target header encryption/masking, SSRF protection, project domain verification enforcement, and RBAC matrix enforcement.

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

Load tests require a verified project domain. We will create an owner account, set up an organization and project, and simulate domain verification.

### 1.1 Owner Account & Authentication
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "loadtest-lead@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "James",
    "last_name": "Gosling"
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
    "name": "Load Test Engineering Corp",
    "slug": "loadtest-corp-'"$(date +%s)"'"
  }' > /tmp/org_create.json

ORG_ID=$(cat /tmp/org_create.json | jq -r '.data.id')

# Create Project with an external test host (e.g. httpbin.org or mock host)
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Performance Target API",
    "slug": "perf-api-'"$(date +%s)"'",
    "base_url": "https://httpbin.org"
  }' > /tmp/proj_create.json

PROJECT_ID=$(cat /tmp/proj_create.json | jq -r '.data.id')
echo "Organization ID: ${ORG_ID}"
echo "Project ID: ${PROJECT_ID}"
```

---

## 2. Safety & Verification Guardrails

### 2.1 Verify Project Domain Ownership Enforcement (`422 TARGET_NOT_VERIFIED`)
Attempting to create a load test against an unverified project domain must be rejected with `TARGET_NOT_VERIFIED` and include a verification link.

```bash
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Unverified Test Attempt",
    "model": "open",
    "profile": "sustained",
    "config": {
      "duration": 10,
      "rate": 50,
      "targets": [
        {
          "method": "GET",
          "url": "https://httpbin.org/get",
          "weight": 100
        }
      ]
    }
  }'
```
**Expected Response:**
- Status: `422 Unprocessable Entity`
- Code: `TARGET_NOT_VERIFIED`
- Details contains `verify_url` linking to project verification instructions.

### 2.2 Verify SSRF Protection (`422 TARGET_BLOCKED`)
Attempting to run a test targeting private IP ranges, loopback (`127.0.0.1`), metadata endpoints (`169.254.169.254`), or internal domains must be blocked.

```bash
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SSRF Attack Attempt",
    "model": "open",
    "profile": "sustained",
    "config": {
      "duration": 10,
      "rate": 10,
      "targets": [
        {
          "method": "GET",
          "url": "http://169.254.169.254/latest/meta-data/",
          "weight": 100
        }
      ]
    }
  }'
```
**Expected Response:**
- Status: `422 Unprocessable Entity`
- Code: `TARGET_BLOCKED`

### 2.3 Verify Plan Limits (`422 PLAN_LIMIT_EXCEEDED`)
Test configuration exceeding plan thresholds (e.g. >1000 RPS, >500 VUs, >1800s duration, or >20 targets) must be blocked.

```bash
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Excessive RPS Test",
    "model": "open",
    "profile": "sustained",
    "config": {
      "duration": 30,
      "rate": 5000,
      "targets": [
        {"method": "GET", "url": "https://httpbin.org/get", "weight": 100}
      ]
    }
  }'
```
**Expected Response:**
- Status: `422 Unprocessable Entity`
- Code: `PLAN_LIMIT_EXCEEDED`

---

## 3. Creating & Running Load Tests

To proceed with load testing, the project must be verified. In a local/test environment, verification can be achieved via DNS/HTTP verification or updating the database verification flag for the project.

### 3.1 Create Open-Model Load Test with Sensitive Headers
Create an open-model load test with sustained 25 RPS for 15 seconds. Note that sensitive authentication headers (`Authorization`, `X-API-Key`) must be stored encrypted and returned masked (`"***"`).

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-open-run-$(date +%s)" \
  -d '{
    "name": "Checkout Open Model Baseline",
    "model": "open",
    "profile": "sustained",
    "config": {
      "duration": 15,
      "rate": 25,
      "timeout": 5,
      "targets": [
        {
          "method": "GET",
          "url": "https://httpbin.org/get",
          "weight": 70,
          "headers": {
            "Authorization": "Bearer secret_api_token_12345",
            "User-Agent": "STRIM-LoadEngine/1.0"
          }
        },
        {
          "method": "POST",
          "url": "https://httpbin.org/post",
          "weight": 30,
          "headers": {
            "X-API-Key": "my-confidential-key",
            "Content-Type": "application/json"
          },
          "body": "{\"item_id\": 42, \"quantity\": 1}"
        }
      ]
    }
  }' > /tmp/load_test_open.json

LOAD_TEST_ID=$(cat /tmp/load_test_open.json | jq -r '.data.id')
echo "Created Load Test ID: ${LOAD_TEST_ID}"
```
**Validation:**
- In response JSON, `Authorization` and `X-API-Key` headers are masked as `"***"`.
- Plaintext headers like `User-Agent` and `Content-Type` are preserved.
- Status is initially `"queued"`.

### 3.2 Idempotency-Key Protection
Resending the exact same request with the identical `Idempotency-Key` header returns the existing load test record rather than creating a duplicate job:

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-open-run-$(date +%s)" \
  -d '{ ... same payload ... }'
```

### 3.3 Concurrent Run Lock (`409 TEST_ALREADY_RUNNING`)
Attempting to launch a second load test while another test is currently running in the same project or organization is prevented:

```bash
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Conflicting Second Test",
    "model": "open",
    "profile": "sustained",
    "config": {
      "duration": 10,
      "rate": 10,
      "targets": [{"method": "GET", "url": "https://httpbin.org/get", "weight": 100}]
    }
  }'
```
**Expected Response:**
- Status: `409 Conflict`
- Code: `TEST_ALREADY_RUNNING`

---

## 4. Real-Time Progress Monitoring via SSE

Clients can stream live test telemetry using the Server-Sent Events endpoint:

```bash
curl -N -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Accept: text/event-stream" \
  "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/progress"
```

**Expected Event Stream:**
```text
event: snapshot
data: {"test_id":"...","status":"running","elapsed_s":0,"duration_s":15,"current_rps":0,"p95_ms":0,"error_rate":0,"active_vus":0}

event: tick
data: {"test_id":"...","second":1,"requests":25,"successes":25,"errors":0,"latency_p50":32.1,"latency_p90":48.2,"latency_p95":55.0,"latency_p99":70.4,"generator_saturated":false}

event: tick
data: {"test_id":"...","second":2,"requests":25,"successes":25,"errors":0,"latency_p50":31.8,"latency_p90":47.9,"latency_p95":54.6,"latency_p99":68.1,"generator_saturated":false}

...

event: status
data: {"test_id":"...","status":"completed","error":""}

event: end
data: {"test_id":"...","status":"completed","summary":"Test completed successfully"}
```

---

## 5. Controlling & Querying Load Tests

### 5.1 Inspect Test Details (`GET /load-tests/:id`)
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Validation:**
- Returns test metadata, current status, and masked headers in target configs.

### 5.2 Stop an Active Load Test (`POST /load-tests/:id/stop`)
Tests can be gracefully aborted within 2 seconds:

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/stop" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Validation:**
- Status transitions to `"stopped"`.
- SSE stream emits `event: status` with `"status": "stopped"` and `event: end`.

### 5.3 Rerun a Load Test (`POST /load-tests/:id/rerun`)
Clones the configuration of an existing test into a new test run:

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/rerun" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Validation:**
- Creates a new test record with identical configuration and returns status `"queued"`.

### 5.4 Query Stepped Timeseries (`GET /load-tests/:id/timeseries`)
Retrieve per-second time-series metrics:

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/timeseries?step=1s" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Validation:**
- Array of time-series points containing:
  - `timestamp`
  - `second`
  - `requests`, `successes`, `errors`
  - `p50_ms`, `p90_ms`, `p95_ms`, `p99_ms`
  - `bytes_transferred`
  - `generator_saturated`

### 5.5 Query Cumulative Results (`GET /load-tests/:id/results`)
Retrieve final aggregated test summary and logarithmic latency histogram:

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/results" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Validation:**
- `total_requests`, `successful_requests`, `failed_requests`, `error_rate`
- `min_latency_ms`, `avg_latency_ms`, `max_latency_ms`
- Percentiles: `p50_latency_ms`, `p90_latency_ms`, `p95_latency_ms`, `p99_latency_ms`
- `status_code_distribution`: map of HTTP status codes (e.g. `{"200": 375}`)
- `endpoint_results`: per-target metrics breakdown
- `latency_buckets`: 64-bucket logarithmic distribution

---

## 6. Closed-Model (Virtual Users) Execution

Create a closed-model test using 20 Virtual Users (VUs) with think-time:

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Closed Model VU Concurrency Test",
    "model": "closed",
    "profile": "sustained",
    "config": {
      "duration": 10,
      "vus": 20,
      "think_time_ms": 100,
      "timeout": 5,
      "targets": [
        {
          "method": "GET",
          "url": "https://httpbin.org/get",
          "weight": 100
        }
      ]
    }
  }' | jq .
```

---

## 7. Role-Based Access Control (RBAC) Matrix

Verify that multi-tenant permission boundaries are strictly enforced:

| Role | List / Get Detail | SSE Progress | Timeseries / Results | Create / Rerun / Stop | Delete |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Admin / Owner** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Member** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ 403 Forbidden |
| **Viewer** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ 403 Forbidden | ❌ 403 Forbidden |
| **Outsider** | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 404 Not Found |

### 7.1 Verify Viewer Restrictions
```bash
# Viewer attempts to stop a test -> 403 Forbidden
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/stop" \
  -H "Authorization: Bearer ${VIEWER_TOKEN}"
```

### 7.2 Verify Outsider Isolation
```bash
# Outsider from another organization queries test -> 404 Not Found
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}" \
  -H "Authorization: Bearer ${OUTSIDER_TOKEN}"
```

---

## 8. Summary Checklist

- [x] Unverified project domains correctly rejected with `TARGET_NOT_VERIFIED` (422).
- [x] SSRF-vulnerable targets (private IPs, loopback, link-local) rejected with `TARGET_BLOCKED` (422).
- [x] Plan caps (max RPS, max VUs, max duration, target limit) enforced with `PLAN_LIMIT_EXCEEDED` (422).
- [x] Sensitive target headers (`Authorization`, `X-API-Key`, `Cookie`) encrypted at rest with AES-256-GCM.
- [x] Sensitive headers redacted as `"***"` in all API responses.
- [x] Idempotency keys prevent duplicate load test creation.
- [x] Concurrent test locks prevent simultaneous runs per project and organization.
- [x] Distributed Worker claims jobs using PostgreSQL `FOR UPDATE SKIP LOCKED`.
- [x] Worker heartbeats every 5s and reclaims stale jobs after 30s crash timeout.
- [x] Open-model runner measures latency from intended send time ($T_{\text{intended}}$) eliminating coordinated omission.
- [x] Closed-model runner supports virtual user pools with configurable think times.
- [x] Logarithmic histogram aggregates real-time $P_{50}, P_{90}, P_{95}, P_{99}$ percentiles.
- [x] Real-time SSE progress streams `snapshot`, `tick`, `status`, and `end` events with client disconnect handling.
- [x] Graceful stop aborts active runs within 2 seconds.
- [x] Full RBAC matrix enforced across Admin, Member, Viewer, and non-member isolation.
