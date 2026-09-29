# Strim — Phase 4 Manual Testing Guide
### Simulations, High-Throughput Load Testing & Resilience Auditing

This guide provides step-by-step commands to manually verify all deliverables of **Phase 4**.

---

## 🚀 Pre-requisites & Startup

1. Ensure infrastructure containers (PostgreSQL, Redis, ClickHouse) are running:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```
2. Start the Strim API server:
   ```bash
   bun run --filter @strim/server dev
   ```
   *The server runs on `http://localhost:8080`.*

---

## 🔑 Step 0: Obtain Auth Token & Environment ID

1. Log in with seeded admin credentials:
   ```bash
   LOGIN_RES=$(curl -s -X POST http://localhost:8080/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "priya@acme.test", "password": "password123"}')

   export TOKEN=$(echo $LOGIN_RES | jq -r .token)
   export ORG_ID=$(echo $LOGIN_RES | jq -r '.organizations[0].id')
   echo "Logged in as Organization: $ORG_ID"
   ```

2. Fetch Environment ID (Staging):
   ```bash
   CONTEXT_RES=$(curl -s -X GET http://localhost:8080/v1/org/context \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-organization-id: $ORG_ID")

   export ENV_ID=$(echo $CONTEXT_RES | jq -r '.workspaces[0].projects[0].applications[0].environments[0].id')
   echo "Target Environment: $ENV_ID"
   ```

---

## 💥 Test Suite 1: High-Throughput Load Testing & Breaking Point Analysis

### 1.1 Execute a Stress Load Test with Breaking Point & Defensive Audit
```bash
LOAD_TEST_RES=$(curl -s -X POST http://localhost:8080/v1/load-tests \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "name": "Staging Saturation Stress Test",
    "kind": "stress",
    "targetRps": 600,
    "durationSeconds": 30,
    "scale": 1.5,
    "preserveDistribution": true,
    "auditDefensivePosture": true
  }')

echo $LOAD_TEST_RES | jq .
export LOAD_TEST_ID=$(echo $LOAD_TEST_RES | jq -r .id)
```
*Expected Result:*
- HTTP `201 Created`
- `status`: `"completed"`
- `breakingPoint`:
  - `sustainableRps`: e.g. `300`
  - `degradationOnsetRps`: e.g. `600`
  - `criticalFailureRps`: e.g. `900`
  - `recommendation`: `"Keep traffic at or below 300 RPS..."`
- `result.defensivePosture`:
  - `overallGrade`: `"A"` or `"B"`
  - `rateLimitEnforced`: boolean
  - `leakedStackTraces`: `false`
  - `findings`: array of categorized audit observations

---

### 1.2 List Load Test History
```bash
curl -s -X GET "http://localhost:8080/v1/load-tests?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected Result:*
- HTTP `200 OK`
- Contains array of recent load test executions with summary metrics.

---

### 1.3 Inspect Detailed Load Test Results
```bash
curl -s -X GET "http://localhost:8080/v1/load-tests/$LOAD_TEST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected Result:*
- HTTP `200 OK`
- Full breakdown of timeline samples, latency percentiles (`p50Ms`, `p90Ms`, `p95Ms`, `p99Ms`), status code distribution, breaking point analysis, and defensive audit report.

---

### 1.4 Abort/Stop an In-Progress Load Test
```bash
curl -s -X POST "http://localhost:8080/v1/load-tests/$LOAD_TEST_ID/stop" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected Result:*
- HTTP `200 OK` with `{ "success": true, "status": "stopped" }` (or already completed).

---

### 1.5 Verify SSRF Target URL Protection
Attempt to target internal cloud link-local metadata:
```bash
curl -s -X POST http://localhost:8080/v1/load-tests \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "kind": "spike",
    "targetRps": 200,
    "targetUrl": "http://169.254.169.254/latest/meta-data"
  }' | jq .
```
*Expected Result:*
- HTTP `403 Forbidden`
- `{ "error": "FORBIDDEN", "message": "SSRF_BLOCKED: Access to cloud provider metadata service is forbidden" }`

---

## 🔮 Test Suite 2: What-If Simulations & Performance Gating

### 2.1 Run What-If Simulation: Traffic Multiplier (2.5x)
```bash
SIM_RES_1=$(curl -s -X POST http://localhost:8080/v1/simulations \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "name": "Simulate 2.5x Cyber Monday Surge",
    "change": {
      "kind": "traffic",
      "multiplier": 2.5
    }
  }')

echo $SIM_RES_1 | jq .
export SIM_ID=$(echo $SIM_RES_1 | jq -r .id)
```
*Expected Result:*
- HTTP `201 Created`
- `baseline`: initial latency and RPS
- `experiment`: scaled origin RPS (2.5x) with projected latency curve
- `comparison`: delta entries showing `p95Ms`, `p99Ms`, `errorRate`, and `originRps` deltas
- `evaluation`: `{ "passed": true, "regressed": false, "recommendation": "..." }`

---

### 2.2 Run What-If Simulation: Edge Cache Enablement
```bash
curl -s -X POST http://localhost:8080/v1/simulations \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "name": "Simulate Edge Cache On",
    "change": {
      "kind": "cache",
      "enabled": true
    }
  }' | jq .
```
*Expected Result:*
- HTTP `201 Created`
- `comparison` demonstrates:
  - `originRps` delta: negative (e.g. -70% reduction in origin pressure)
  - `p95Ms` delta: negative (e.g. -40% reduction in latency)
  - `cacheHitRate`: increased to >= 70%

---

### 2.3 Run What-If Simulation: Dependency Degradation (Regression Gate Check)
```bash
curl -s -X POST http://localhost:8080/v1/simulations \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "name": "Simulate Payment Service Latency Spike",
    "change": {
      "kind": "dependencyLatency",
      "factor": 3.5,
      "dependency": "payment-gateway"
    },
    "maxP95DeltaPct": 25
  }' | jq .
```
*Expected Result:*
- HTTP `201 Created`
- `status`: `"failed"`
- `evaluation.passed`: `false`
- `evaluation.regressed`: `true`
- `evaluation.reasons`: contains `"P95 latency increased by ... (exceeds threshold of +25%)"`
- `evaluation.recommendation`: `"Simulation failed gate criteria: critical performance or error regression detected. Approval blocked."`

---

### 2.4 List Simulations
```bash
curl -s -X GET "http://localhost:8080/v1/simulations?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected Result:*
- HTTP `200 OK` with list of simulation runs and gate evaluations.

---

### 2.5 Delete Simulation
```bash
curl -s -X DELETE "http://localhost:8080/v1/simulations/$SIM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected Result:*
- HTTP `200 OK` with `{ "success": true, "message": "Simulation deleted successfully" }`.

---

## 🛡️ Test Suite 3: Isolation Verification

### 3.1 Production Simulation Isolation
Attempting to run a simulation against a production environment directly must be rejected:
```bash
PROD_ENV_ID=$(curl -s -X GET http://localhost:8080/v1/org/context \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq -r '.workspaces[0].projects[0].applications[0].environments[] | select(.type=="PRODUCTION") | .id')

if [ -n "$PROD_ENV_ID" ]; then
  curl -s -X POST http://localhost:8080/v1/simulations \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-organization-id: $ORG_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "environmentId": "'$PROD_ENV_ID'",
      "change": { "kind": "traffic", "multiplier": 2 }
    }' | jq .
fi
```
*Expected Result:*
- HTTP `403 Forbidden`
- `{ "error": "FORBIDDEN", "message": "Simulations must not mutate production runtime state directly..." }`

---

## 📖 Test Suite 4: Interactive API Documentation

1. Open **Swagger UI**:
   - URL: `http://localhost:8080/swagger`
   - Verify the presence of:
     - Tag: `Load Testing & Resilience Auditing` (`POST /v1/load-tests`, `GET /v1/load-tests`, `GET /v1/load-tests/{id}`, `POST /v1/load-tests/{id}/stop`)
     - Tag: `Simulations & What-If Engine` (`POST /v1/simulations`, `GET /v1/simulations`, `GET /v1/simulations/{id}`, `DELETE /v1/simulations/{id}`)
2. Open **Scalar API Reference**:
   - URL: `http://localhost:8080/docs`
   - Verify all request/response schemas render without schema errors.
