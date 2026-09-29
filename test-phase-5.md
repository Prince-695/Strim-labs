# Strim — Phase 5 Manual Testing Guide
### Change Plans, Guardrails, Incidents & Rollback

This guide provides step-by-step commands to manually verify all deliverables of **Phase 5**.

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

2. Fetch Environment ID:
   ```bash
   CONTEXT_RES=$(curl -s -X GET http://localhost:8080/v1/org/context \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-organization-id: $ORG_ID")

   export ENV_ID=$(echo $CONTEXT_RES | jq -r '.workspaces[0].projects[0].applications[0].environments[0].id')
   echo "Target Environment: $ENV_ID"
   ```

---

## 📋 Test Suite 1: Change Plans & Controlled Rollout Lifecycle

### 1.1 Create a Change Plan with Blast Radius & Risk Score
```bash
PLAN_RES=$(curl -s -X POST http://localhost:8080/v1/change-plans \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "title": "Enable Redis caching on checkout and tune timeout",
    "description": "Enables edge cache rule for products and reduces payment timeout to 3000ms",
    "objective": "Reduce origin RPS by 50% and improve P95 latency below 300ms",
    "proposed": {
      "cache.enabled": true,
      "timeout.ms": 3000,
      "retries.max": 2
    },
    "gitCommit": "74c9ddd",
    "gitBranch": "feature/fast-checkout",
    "gitPullRequest": "https://github.com/acme/strim/pull/42"
  }')

echo $PLAN_RES | jq .
export PLAN_ID=$(echo $PLAN_RES | jq -r .id)
```
*Expected Result:*
- HTTP `201 Created`
- `state`: `"DRAFT"`
- `riskLevel`: `"LOW"` or `"MEDIUM"` with explainable `riskPayload.factors` breakdown
- `blastRadius.services`: array of dependent downstream/upstream services walked from topology
- `proposedVersionId`: created with unapproved status

---

### 1.2 Run What-If Simulation on the Change Plan
```bash
SIM_PLAN_RES=$(curl -s -X POST http://localhost:8080/v1/change-plans/$PLAN_ID/simulate \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID")

echo $SIM_PLAN_RES | jq .
```
*Expected Result:*
- HTTP `200 OK`
- `state`: transitions through `VALIDATING` → `SIMULATION_PENDING` → `SIMULATING` → `SIMULATION_PASSED` → `"APPROVAL_PENDING"`
- `simulationId`: attached to change plan record

---

### 1.3 Approve the Change Plan
```bash
APPROVE_RES=$(curl -s -X POST http://localhost:8080/v1/change-plans/$PLAN_ID/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "justification": "Simulation passed performance boundaries. Approved for staged rollout."
  }')

echo $APPROVE_RES | jq .
```
*Expected Result:*
- HTTP `200 OK`
- `state`: `"APPROVED"`
- Creates approval audit record in database

---

### 1.4 Advance Staged Canary Rollout (10% → 25% → 50% → 100%)
Step 1: 10%
```bash
curl -s -X POST http://localhost:8080/v1/change-plans/$PLAN_ID/rollout \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq '{ state: .state, rolloutPercent: .rolloutPercent }'
```
*Expected:* `{ "state": "ROLLING_OUT", "rolloutPercent": 10 }`

Step 2: 25%
```bash
curl -s -X POST http://localhost:8080/v1/change-plans/$PLAN_ID/rollout \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq '{ state: .state, rolloutPercent: .rolloutPercent }'
```
*Expected:* `{ "state": "ROLLING_OUT", "rolloutPercent": 25 }`

Step 3: 50%
```bash
curl -s -X POST http://localhost:8080/v1/change-plans/$PLAN_ID/rollout \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq '{ state: .state, rolloutPercent: .rolloutPercent }'
```
*Expected:* `{ "state": "ROLLING_OUT", "rolloutPercent": 50 }`

Step 4: 100%
```bash
FINAL_STEP=$(curl -s -X POST http://localhost:8080/v1/change-plans/$PLAN_ID/rollout \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID")

echo $FINAL_STEP | jq '{ state: .state, rolloutPercent: .rolloutPercent }'
```
*Expected:* `{ "state": "COMPLETED", "rolloutPercent": 100 }`
*At 100%, proposed Runtime Version is automatically promoted to `approved: true`.*

---

## 🛡️ Test Suite 2: Automated Guardrails & Circuit Breakers

### 2.1 Guardrail Evaluation: Safe Metrics
```bash
curl -s -X POST http://localhost:8080/v1/change-plans/$PLAN_ID/guardrail-check \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "errorRate": 0.01,
    "p95Ms": 280,
    "availability": 0.999
  }' | jq .
```
*Expected Result:*
- HTTP `200 OK`
- `action`: `"continue"`

---

### 2.2 Guardrail Evaluation: High Latency Trigger (P95 > 2000ms → PAUSE)
```bash
curl -s -X POST http://localhost:8080/v1/change-plans/$PLAN_ID/guardrail-check \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "errorRate": 0.02,
    "p95Ms": 2400,
    "availability": 0.995
  }' | jq .
```
*Expected Result:*
- HTTP `200 OK`
- `action`: `"pause"`
- Change plan state updated to `"ROLLOUT_PAUSED"`

---

### 2.3 Instant 1-Click Rollback
```bash
ROLLBACK_RES=$(curl -s -X POST http://localhost:8080/v1/change-plans/$PLAN_ID/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID")

echo $ROLLBACK_RES | jq '{ state: .state, rolloutPercent: .rolloutPercent }'
```
*Expected Result:*
- HTTP `200 OK`
- `state`: `"ROLLED_BACK"`
- `rolloutPercent`: `0`
- Restores prior runtime version with `approved: true`

---

## 🚨 Test Suite 3: Anomaly Baselines, Incidents & Factor Correlation

### 3.1 Evaluate Baseline: Normal Traffic
```bash
curl -s -X POST http://localhost:8080/v1/incidents/evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "errorRate": 0.015,
    "p95Ms": 350
  }' | jq .
```
*Expected Result:*
- HTTP `200 OK`
- `{ "triggered": false, "threshold": ... }`

---

### 3.2 Trigger Incident via Metric Surge (> mean + 3*stddev)
```bash
INCIDENT_RES=$(curl -s -X POST http://localhost:8080/v1/incidents/evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "errorRate": 0.085,
    "p95Ms": 1800
  }')

echo $INCIDENT_RES | jq .
export INCIDENT_ID=$(echo $INCIDENT_RES | jq -r .incident.id)
```
*Expected Result:*
- HTTP `200 OK`
- `triggered`: `true`
- `incident`:
  - `status`: `"open"`
  - `severity`: `"high"`
  - `factors`: contains ranked causal factors ("Error rate exceeded baseline", "Recent change plan is a potential contributing factor")
  - `timeline`: chronological sequence of root-cause events

---

### 3.3 List Incidents
```bash
curl -s -X GET "http://localhost:8080/v1/incidents?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected Result:*
- HTTP `200 OK` with active and resolved incident cards.

---

### 3.4 1-Click Rollback from Correlated Incident
```bash
curl -s -X POST "http://localhost:8080/v1/incidents/$INCIDENT_ID/rollback" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected Result:*
- HTTP `200 OK`
- Reverts the correlated change plan attached to the incident.

---

### 3.5 Resolve Incident
```bash
curl -s -X POST "http://localhost:8080/v1/incidents/$INCIDENT_ID/resolve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected Result:*
- HTTP `200 OK` with `status: "resolved"`.

---

## 📜 Test Suite 4: Policies, Hierarchical Rate Limits & Drift Detection

### 4.1 Create a Governance Policy
```bash
POLICY_RES=$(curl -s -X POST http://localhost:8080/v1/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "guardrail",
    "name": "Mandatory Staged Rollout Policy",
    "body": {
      "minStages": 4,
      "requireSimulation": true
    }
  }')

echo $POLICY_RES | jq .
export POLICY_ID=$(echo $POLICY_RES | jq -r .id)
```
*Expected Result:*
- HTTP `201 Created`
- Creates policy with initial immutable `PolicyVersion`.

---

### 4.2 Define Hierarchical Rate Limits
```bash
# Organization-wide default limit: 5000 req/min
curl -s -X POST http://localhost:8080/v1/policies/rate-limits \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "organization",
    "limit": 5000,
    "windowSeconds": 60
  }' | jq .
```

---

### 4.3 Evaluate Hierarchical Rate Limit Match
```bash
curl -s -X GET "http://localhost:8080/v1/policies/rate-limits/evaluate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected Result:*
- HTTP `200 OK` with the resolved rate limit matching the hierarchy.

---

### 4.4 Check Configuration Drift
```bash
curl -s -X POST http://localhost:8080/v1/policies/drift/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "actual": {
      "cache.enabled": false,
      "timeout.ms": 8000
    }
  }' | jq .
```
*Expected Result:*
- HTTP `200 OK`
- Creates open `DriftReport`
- `diffs`: lists mismatch between declared and actual values
- `actions`: `["inspect", "accept", "correct", "create_change_plan"]`

---

## 📖 Test Suite 5: Interactive API Documentation

1. Open **Swagger UI**:
   - URL: `http://localhost:8080/swagger`
   - Verify the presence of tags:
     - `Change Plans & Controlled Rollout` (all 8 endpoints)
     - `Incidents & Automated Rollback` (all 6 endpoints)
     - `Policies & Guardrails` (all 9 endpoints)
2. Open **Scalar API Reference**:
   - URL: `http://localhost:8080/docs`
   - Verify all request/response schemas render without schema errors.
