# Phase 8: Capacity Analysis and Comparison Engine - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test guide for **Phase 8: Capacity Analysis and Comparison Engine** of the STRIM Labs backend. It verifies capacity limits determination, 2-consecutive-window breaking point detection, bottleneck root cause reasoning (`latency`, `errors`, `saturation`), interactive recomputations, multi-test comparisons with regression verdicts, and multi-tenant RBAC enforcement.

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

Capacity analysis operates on load test runs within a verified project.

### 1.1 Owner Account & Authentication
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "capacity-lead@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Ada",
    "last_name": "Lovelace"
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
    "name": "Capacity Analytics Corp",
    "slug": "capacity-corp-'"$(date +%s)"'"
  }' > /tmp/org_create.json

ORG_ID=$(cat /tmp/org_create.json | jq -r '.data.id')

# Create Project with an external test host
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Orders Service",
    "slug": "orders-svc-'"$(date +%s)"'",
    "base_url": "https://httpbin.org"
  }' > /tmp/proj_create.json

PROJECT_ID=$(cat /tmp/proj_create.json | jq -r '.data.id')
echo "Organization ID: ${ORG_ID}"
echo "Project ID: ${PROJECT_ID}"
```

---

## 2. Capacity Analysis (`GET /capacity`)

### 2.1 Premature Query on In-Flight Test (`409 TEST_NOT_FINISHED`)
Querying the capacity report while a load test is running or queued must be rejected with `409 TEST_NOT_FINISHED`.

```bash
# Attempt to query capacity of an active or queued run
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${ACTIVE_TEST_ID}/capacity" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```
**Expected Response:**
- Status: `409 Conflict`
- Code: `TEST_NOT_FINISHED`
- Message: `"Load test is still active or queued; capacity report is only available after completion"`

### 2.2 Query Capacity Report for Completed Test
Once a load test finishes, the background worker daemon automatically analyzes the 1-second timeseries metrics, determines baseline latency, evaluates window health, and computes the breaking point.

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/capacity" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

**Expected Response Shape:**
```json
{
  "success": true,
  "data": {
    "id": "c7a8b3d1-...",
    "load_test_id": "8fa12b4e-...",
    "project_id": "9e2c4d7f-...",
    "sustainable_rps": 150.0,
    "breaking_point_rps": 200.0,
    "breaking_reason": "latency",
    "baseline_p95_ms": 22.4,
    "confidence": "high",
    "note": "Breaking point detected at 200 RPS due to latency",
    "thresholds": {
      "p95_multiplier": 2.0,
      "max_error_rate": 0.01,
      "min_achieved_ratio": 0.95
    },
    "windows": [
      {
        "index": 1,
        "start_second": 0,
        "end_second": 10,
        "offered_rps": 50.0,
        "achieved_rps": 50.0,
        "p95_ms": 22.0,
        "error_rate": 0.0,
        "healthy": true
      },
      {
        "index": 2,
        "start_second": 10,
        "end_second": 20,
        "offered_rps": 100.0,
        "achieved_rps": 100.0,
        "p95_ms": 26.5,
        "error_rate": 0.0,
        "healthy": true
      },
      {
        "index": 3,
        "start_second": 20,
        "end_second": 30,
        "offered_rps": 150.0,
        "achieved_rps": 150.0,
        "p95_ms": 35.0,
        "error_rate": 0.0,
        "healthy": true
      },
      {
        "index": 4,
        "start_second": 30,
        "end_second": 40,
        "offered_rps": 200.0,
        "achieved_rps": 195.0,
        "p95_ms": 68.0,
        "error_rate": 0.005,
        "healthy": false,
        "failure_reason": "latency"
      },
      {
        "index": 5,
        "start_second": 40,
        "end_second": 50,
        "offered_rps": 250.0,
        "achieved_rps": 210.0,
        "p95_ms": 125.0,
        "error_rate": 0.02,
        "healthy": false,
        "failure_reason": "latency"
      }
    ]
  },
  "message": "Capacity report retrieved successfully"
}
```

---

## 3. Interactive Capacity Recomputation (`POST /capacity/recompute`)

Users can adjust sensitivity thresholds without re-executing physical load tests.

### 3.1 "What-If" Analysis Without Overwriting Database (`save: false`)
Test how the system would be evaluated under stricter SLA thresholds (e.g., $1.5\times$ latency multiplier and $0.5\%$ error tolerance):

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/capacity/recompute" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "thresholds": {
      "p95_multiplier": 1.5,
      "max_error_rate": 0.005,
      "min_achieved_ratio": 0.98
    },
    "save": false
  }' | jq .
```
**Validation:**
- Returns the updated report reflecting the tighter thresholds.
- Subsequent `GET /capacity` queries still return the original report because `save: false`.

### 3.2 Update Persisted Capacity Report (`save: true`)
```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/capacity/recompute" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "thresholds": {
      "p95_multiplier": 3.0,
      "max_error_rate": 0.02
    },
    "save": true
  }' | jq .
```
**Validation:**
- Database record is updated with the new thresholds and recomputed limits.

---

## 4. Multi-Test Run Comparison (`POST /load-tests/compare`)

Compare 2 to 5 test runs to detect performance improvements or regressions across software releases.

### 4.1 Compare Test Execution
```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/compare" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "test_ids": [
      "8fa12b4e-...",
      "b2c3d4e5-...",
      "f6a7b8c9-..."
    ],
    "baseline_id": "8fa12b4e-..."
  }' | jq .
```

**Expected Response Shape:**
```json
{
  "success": true,
  "data": {
    "baseline_id": "8fa12b4e-...",
    "tests": [
      {
        "id": "8fa12b4e-...",
        "name": "Release v1.0",
        "avg_rps": 180.0,
        "peak_rps": 250.0,
        "p95_ms": 95.0,
        "error_rate": 0.012,
        "sustainable_rps": 150.0
      },
      {
        "id": "b2c3d4e5-...",
        "name": "Release v1.1 Optimized",
        "avg_rps": 220.0,
        "peak_rps": 320.0,
        "p95_ms": 65.0,
        "error_rate": 0.003,
        "sustainable_rps": 200.0
      },
      {
        "id": "f6a7b8c9-...",
        "name": "Release v1.2 Memory Leak Bug",
        "avg_rps": 140.0,
        "peak_rps": 210.0,
        "p95_ms": 180.0,
        "error_rate": 0.045,
        "sustainable_rps": 100.0
      }
    ],
    "deltas": [
      {
        "test_id": "b2c3d4e5-...",
        "avg_rps_pct": 22.2,
        "peak_rps_pct": 28.0,
        "p95_pct": -31.6,
        "error_rate_pct": -0.9,
        "verdict": "improved"
      },
      {
        "test_id": "f6a7b8c9-...",
        "avg_rps_pct": -22.2,
        "peak_rps_pct": -16.0,
        "p95_pct": 89.5,
        "error_rate_pct": 3.3,
        "verdict": "regressed"
      }
    ],
    "overlay": {
      "step": "5s",
      "series": [
        {
          "test_id": "8fa12b4e-...",
          "name": "Release v1.0",
          "points": [
            {"t": 0, "offered_rps": 50.0, "achieved_rps": 50.0, "p95": 20.0, "errors": 0},
            {"t": 5, "offered_rps": 100.0, "achieved_rps": 100.0, "p95": 25.0, "errors": 0}
          ]
        },
        {
          "test_id": "b2c3d4e5-...",
          "name": "Release v1.1 Optimized",
          "points": [
            {"t": 0, "offered_rps": 50.0, "achieved_rps": 50.0, "p95": 18.0, "errors": 0},
            {"t": 5, "offered_rps": 100.0, "achieved_rps": 100.0, "p95": 20.0, "errors": 0}
          ]
        }
      ]
    }
  },
  "message": "Tests compared successfully"
}
```

### 4.2 Comparison Validation Rules
- **Minimum 2 tests, maximum 5 tests**: Requesting 1 test or $>5$ tests returns `400 VALIDATION_FAILED`.
- **All tests must belong to the same project**: Cross-project comparison is rejected with `404 NOT_FOUND`.
- **All tests must be finished**: If any test is currently running or queued, returns `409 TEST_NOT_FINISHED`.
- **Baseline ID must be present in `test_ids`**: If `baseline_id` is specified but omitted from `test_ids`, returns `400 VALIDATION_FAILED`.

---

## 5. Role-Based Access Control (RBAC) Matrix

Verify that multi-tenant permission boundaries are strictly enforced:

| Role | GET /capacity | POST /capacity/recompute | POST /load-tests/compare |
| :--- | :---: | :---: | :---: |
| **Owner / Admin** | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Member** | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Viewer** | ✅ Allowed | ❌ 403 Forbidden | ✅ Allowed |
| **Outsider** | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 404 Not Found |

### 5.1 Verify Viewer Restrictions
```bash
# Viewer attempts to recompute capacity -> 403 Forbidden
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/capacity/recompute" \
  -H "Authorization: Bearer ${VIEWER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"save": true}'
```

### 5.2 Verify Outsider Isolation
```bash
# Outsider from another tenant attempts to query capacity -> 404 Not Found
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/load-tests/${LOAD_TEST_ID}/capacity" \
  -H "Authorization: Bearer ${OUTSIDER_TOKEN}"
```

---

## 6. Summary Checklist

- [x] Capacity limit and sustainable RPS determined mathematically using sliding evaluation windows.
- [x] 2-consecutive unhealthy window rule eliminates false-positive breaking points from transient spikes/GC pauses.
- [x] Failure reasons accurately classified into `latency`, `errors`, and `saturation`.
- [x] Confidence score reflects window count, generator schedule lag, and profile suitability.
- [x] Background worker automatically computes and saves `CapacityReport` on test completion.
- [x] Premature capacity queries on active runs return `409 TEST_NOT_FINISHED`.
- [x] Interactive `POST /capacity/recompute` allows "what-if" threshold adjustments with optional persistence.
- [x] Multi-test comparison compares 2 to 5 runs with percentage deltas and regression verdicts (`improved`, `regressed`, `unchanged`).
- [x] Synchronized 5-second time-series overlay generated for multi-run visualization.
- [x] Validation harness confirms capacity estimation is within $\pm 15\%$ of known synthetic bottlenecks.
- [x] Complete RBAC matrix enforced (Viewer read-only, Member recompute, Outsider 404 isolation).
