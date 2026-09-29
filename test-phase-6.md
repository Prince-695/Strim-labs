# Strim — Phase 6 Manual Testing Guide
### Grounded AI Copilot, CI Quality Gates, Provenance Lineage, Billing & Chaos Engineering

This guide provides step-by-step commands to manually verify all deliverables of **Phase 6**.

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

## 🤖 Test Suite 1: Grounded AI Copilot with Causality Hedging

### 1.1 Natural Language Query with Verified Citations & Causality Hedging
Ask questions grounded in the runtime environment state. Any unverified causal claims are automatically hedged:
```bash
AI_RES=$(curl -s -X POST http://localhost:8080/v1/ai/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "question": "What is our current system health score and did the latest deployment cause any degradation?"
  }')

echo $AI_RES | jq .
```
*Expected response:*
- `answer`: Grounded response with causal phrases softened to "is a potential contributing factor to".
- `citations`: Array of verified citations linking to runtime health snapshots, change plans, or incidents.
- `hedged`: Boolean indicating whether causality hedging was applied.
- `confidence`: Confidence rating (`Low` | `Medium` | `High`).
- `uncertaintyNotice`: Grounding disclaimer.

### 1.2 Query Audit History
Retrieve historical grounded AI questions and answers for the tenant:
```bash
curl -s -X GET "http://localhost:8080/v1/ai/queries?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```

---

## ⛓️ Test Suite 2: CI Quality Gates, Deployments & Lineage Provenance

### 2.1 Evaluate CI Quality Gate (PASS Scenario)
Simulate a CI pipeline check where simulated P95 regression is within threshold (12% vs 20% limit):
```bash
# First create a change plan to test with
PLAN_RES=$(curl -s -X POST http://localhost:8080/v1/change-plans \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "title": "CI Gate Test Plan",
    "description": "Testing automated CI gate evaluation",
    "proposed": { "cache.enabled": true },
    "gitCommit": "a1b2c3d"
  }')
export PLAN_ID=$(echo $PLAN_RES | jq -r .id)

# Evaluate gate within threshold
GATE_PASS=$(curl -s -X POST http://localhost:8080/v1/integrations/ci/gate \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "changePlanId": "'$PLAN_ID'",
    "p95RegressionPct": 12.5,
    "thresholdPct": 20.0
  }')

echo $GATE_PASS | jq .
```
*Expected output: `{ "result": "PASS", "changePlanId": "...", "reason": "P95 regression 12.5% is within acceptable threshold (<= 20%)" }`*

### 2.2 Evaluate CI Quality Gate (FAIL Scenario)
Simulate a CI pipeline check where simulated regression exceeds threshold (35% vs 20% limit):
```bash
GATE_FAIL=$(curl -s -X POST http://localhost:8080/v1/integrations/ci/gate \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "changePlanId": "'$PLAN_ID'",
    "p95RegressionPct": 35.0,
    "thresholdPct": 20.0
  }')

echo $GATE_FAIL | jq .
```
*Expected output: `{ "result": "FAIL", "changePlanId": "...", "reason": "P95 regression 35% exceeds threshold of 20%" }`*

### 2.3 Record Deployment Event
Track a production deployment event linked to commit SHA:
```bash
DEP_RES=$(curl -s -X POST http://localhost:8080/v1/integrations/deployments \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "source": "github-actions",
    "sha": "a1b2c3d",
    "metadata": { "workflow": "deploy-prod.yml", "runId": 48201 }
  }')

echo $DEP_RES | jq .
```

### 2.4 Trace End-to-End Provenance Lineage Chain
Inspect the complete audit chain from Git Commit -> Deployment -> Runtime Change -> Simulation -> Rollout -> Incidents:
```bash
curl -s -X GET "http://localhost:8080/v1/integrations/lineage/$PLAN_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```

### 2.5 Configure Paging Integration (PagerDuty / OpsGenie)
Configure a webhook channel for alerting:
```bash
PAGE_RES=$(curl -s -X POST http://localhost:8080/v1/integrations/paging \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "pagerduty",
    "config": { "routingKey": "pd_routing_live_key_9981" }
  }')

echo $PAGE_RES | jq .
```

---

## 💳 Test Suite 3: Billing, Usage Metering, Retention & Enterprise SSO

### 3.1 Fetch Billing Overview & Aggregated Usage
```bash
curl -s -X GET http://localhost:8080/v1/billing \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected output: Current plan tier (`team`), recent invoices, and aggregated telemetry event count.*

### 3.2 Generate Monthly Usage-Based Invoice
Generates an invoice using the formula `$29.00 base + $0.01 per telemetry event`:
```bash
INV_RES=$(curl -s -X POST http://localhost:8080/v1/billing/invoices/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID")

echo $INV_RES | jq .
```

### 3.3 List Historical Invoices
```bash
curl -s -X GET http://localhost:8080/v1/billing/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```

### 3.4 Update Subscription Plan Tier
```bash
curl -s -X PATCH http://localhost:8080/v1/billing/plan \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"plan": "enterprise"}' | jq .
```

### 3.5 Configure Retention Policy with Statutory Audit Floor Validation
Verify that `audit` logs require a 365-day statutory minimum floor:

1. **Attempt sub-floor audit retention (Must Fail 400):**
```bash
AUDIT_FAIL=$(curl -s -X POST http://localhost:8080/v1/retention \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"dataClass": "audit", "days": 90}')

echo $AUDIT_FAIL | jq .
```
*Expected output: `{ "error": "VALIDATION", "message": "Audit retention floor is 365 days" }` with HTTP 400.*

2. **Save compliant retention policy:**
```bash
curl -s -X POST http://localhost:8080/v1/retention \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"dataClass": "request_payloads", "days": 90}' | jq .
```

### 3.6 Trigger Compliance Retention Purge
```bash
curl -s -X POST http://localhost:8080/v1/retention/purge \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```

### 3.7 Configure Enterprise SSO (OIDC / SAML / SCIM)
```bash
curl -s -X PUT http://localhost:8080/v1/sso \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "oidc",
    "config": {
      "issuer": "https://auth.acme-corp.com",
      "clientId": "strim-enterprise-client"
    }
  }' | jq .
```

---

## ⚡ Test Suite 4: Chaos Engineering Fault Injection

### 4.1 Start Chaos Experiment (Latency Fault Injection)
Injects simulated latency fault into target service:
```bash
CHAOS_RES=$(curl -s -X POST http://localhost:8080/v1/chaos \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "kind": "latency",
    "target": "checkout-service"
  }')

echo $CHAOS_RES | jq .
export CHAOS_ID=$(echo $CHAOS_RES | jq -r .id)
```

### 4.2 List Active Chaos Experiments
```bash
curl -s -X GET "http://localhost:8080/v1/chaos?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```

### 4.3 Instant Chaos Revert
Immediately cease the injected fault and return target service to normal:
```bash
curl -s -X POST "http://localhost:8080/v1/chaos/$CHAOS_ID/revert" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
*Expected output: Status updated to `"reverted"` with `revertedAt` timestamp recorded.*

---

## 📖 Test Suite 5: Interactive OpenAPI 3.1 & Swagger Verification

Verify that all Phase 6 routes are live in the interactive OpenAPI specification:

1. **Verify OpenAPI 3.1 JSON Specification:**
   ```bash
   curl -s http://localhost:8080/v1/openapi.json | jq '.paths | keys' | grep -E 'ai|integrations|billing|retention|sso|chaos'
   ```
   *Expected output includes all Phase 6 route paths.*

2. **Open Official Swagger UI in Browser:**
   ```
   http://localhost:8080/swagger
   ```

3. **Open Scalar Interactive API Documentation in Browser:**
   ```
   http://localhost:8080/docs
   ```

---

## ✅ Phase 6 Sign-off Checklist
- [x] Grounded AI Copilot answers questions with verified citations and automatic causality hedging (`lintCausality`).
- [x] Query history audit logging records all AI interactions.
- [x] CI quality gate (`POST /v1/integrations/ci/gate`) validates PR regressions against thresholds.
- [x] GitHub webhook HMAC-SHA256 signature verification protects code event ingest.
- [x] Provenance lineage (`/lineage/:changePlanId`) establishes audit trail from Git commit to incident.
- [x] Usage-based billing aggregates telemetry events and generates compliant invoices.
- [x] Data retention policies enforce 365-day statutory minimum floor for audit data class.
- [x] Enterprise SSO supports OIDC, SAML, and SCIM provider configurations.
- [x] Chaos engineering experiments inject faults and support 1-click immediate reversion with audit tracking.
- [x] Zero documentation drift with all Phase 6 routes mounted directly in OpenAPI 3.1 spec and rendered on `/swagger` and `/docs`.
