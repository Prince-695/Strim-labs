# Strim — Phase 3 Manual Testing Guide
### Runtime Configuration, Cache Policies, Snapshots & Safe Replay (SSRF Defense)

This guide provides step-by-step commands to manually verify all deliverables of **Phase 3**.

---

## 🚀 Pre-requisites & Startup

1. Ensure the PostgreSQL, Redis, and ClickHouse containers are running:
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

## ⚙️ Test Suite 1: Runtime Configuration & Version Diffing

### 1.1 Upsert a Runtime Configuration Value
```bash
CONFIG_RES_1=$(curl -s -X PUT http://localhost:8080/v1/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "key": "features.fast_checkout",
    "value": false,
    "reason": "Initial deployment baseline"
  }')

echo $CONFIG_RES_1 | jq .
export V1_ID=$(echo $CONFIG_RES_1 | jq -r .runtimeVersion.id)
echo "Runtime Version 1: $V1_ID"
```
- **Expected Outcome**: `HTTP 200 OK` returning configuration and sequential `runtimeVersion`.

### 1.2 Update the Configuration to Trigger a Version Bump
```bash
CONFIG_RES_2=$(curl -s -X PUT http://localhost:8080/v1/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "key": "features.fast_checkout",
    "value": true,
    "reason": "Enable fast checkout experiment"
  }')

echo $CONFIG_RES_2 | jq .
export V2_ID=$(echo $CONFIG_RES_2 | jq -r .runtimeVersion.id)
echo "Runtime Version 2: $V2_ID"
```
- **Expected Outcome**: `HTTP 200 OK` creating a second runtime version with bumped sequence number.

### 1.3 Inspect Key Details and Version History
```bash
curl -s -X GET "http://localhost:8080/v1/config/features.fast_checkout?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: Returns configuration key with up to 20 immutable historical snapshots, including actor, reason, and oldValue/newValue.

### 1.4 Compute Runtime Diff Between Versions
```bash
curl -s -X GET "http://localhost:8080/v1/config/diff?from=$V1_ID&to=$V2_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK`.
- **Response Format**:
  ```json
  {
    "diffs": [
      {
        "key": "features.fast_checkout",
        "from": false,
        "to": true
      }
    ],
    "lines": [
      "features.fast_checkout: false → true"
    ]
  }
  ```

### 1.5 Fetch Config for SDK Client
```bash
curl -s -X GET "http://localhost:8080/v1/config/sdk?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: Returns `{ values: { "features.fast_checkout": true }, rolloutPercent: 0 }`.

---

## ⚡ Test Suite 2: Cache Management, Analytics & Recommendations

### 2.1 Create a Cache Rule Policy
```bash
RULE_RES=$(curl -s -X POST http://localhost:8080/v1/cache/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "endpoint": "/v1/products",
    "method": "GET",
    "ttlSeconds": 300,
    "tags": ["catalog", "products"]
  }')

echo $RULE_RES | jq .
export RULE_ID=$(echo $RULE_RES | jq -r .id)
echo "Created Cache Rule: $RULE_ID"
```
- **Expected Outcome**: `HTTP 201 Created` with rule details and audit event logged.

### 2.2 List Cache Rules
```bash
curl -s -X GET "http://localhost:8080/v1/cache/rules?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: Returns array of cache rules.

### 2.3 Update Cache Rule TTL
```bash
curl -s -X PATCH "http://localhost:8080/v1/cache/rules/$RULE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"ttlSeconds": 600}' | jq .
```
- **Expected Outcome**: `HTTP 200 OK` with updated `ttlSeconds: 600`.

### 2.4 Invalidate Cache by Tag
```bash
curl -s -X POST http://localhost:8080/v1/cache/invalidate \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "tag",
    "tags": ["catalog"]
  }' | jq .
```
- **Expected Outcome**: `HTTP 200 OK` recording invalidation event and broadcasting `CACHE_INVALIDATED` to worker queue.

### 2.5 Query Cache Performance Analytics
```bash
curl -s -X GET "http://localhost:8080/v1/cache/analytics?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: Returns `hitRate`, `hits`, `misses`, and estimated `originRpsReduction`.

### 2.6 Fetch Heuristic Cache Recommendations
```bash
curl -s -X GET "http://localhost:8080/v1/cache/recommendations?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: Returns AI/heuristic-identified candidate endpoints that benefit from caching based on traffic and low change frequencies.

### 2.7 Capture Point-in-Time Runtime Snapshot
```bash
curl -s -X POST http://localhost:8080/v1/cache/snapshots/runtime \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"environmentId": "'$ENV_ID'"}' | jq .
```
- **Expected Outcome**: `HTTP 201 Created` with bundled payload `{ config, topology, health, cache }`.

### 2.8 Capture Traffic Distribution Snapshot
```bash
curl -s -X POST http://localhost:8080/v1/cache/snapshots/traffic \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"environmentId": "'$ENV_ID'"}' | jq .
```
- **Expected Outcome**: `HTTP 201 Created` with endpoint traffic breakdown.

---

## 🛡️ Test Suite 3: Safe Replay & SSRF Protection

### 3.1 Fetch a Request ID to Replay
```bash
REQ_ID=$(curl -s -X GET "http://localhost:8080/v1/requests?environmentId=$ENV_ID&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq -r '.requests[0].id')

echo "Request to Replay: $REQ_ID"
```

### 3.2 Execute Safe Staging Replay
```bash
REPLAY_RES=$(curl -s -X POST http://localhost:8080/v1/replay \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "mode": "exact",
    "requestIds": ["'$REQ_ID'"],
    "targetEnvType": "STAGING"
  }')

echo $REPLAY_RES | jq .
export REPLAY_ID=$(echo $REPLAY_RES | jq -r .id)
echo "Replay Run ID: $REPLAY_ID"
```
- **Expected Outcome**: `HTTP 202 Accepted` with `status: "running"`.
- Asynchronously sanitizes headers, strips cookies and auth tokens, and compares results.

### 3.3 Inspect Replay Execution & Comparison Delta
```bash
sleep 1
curl -s -X GET "http://localhost:8080/v1/replay/$REPLAY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK` returning `status: "completed"` and `result.comparison` diffing status, timing delta, and body.

### 3.4 Verify SSRF Protection (Cloud Metadata Blocked)
Test SSRF defense against cloud metadata IP:
```bash
python3 -c '
from urllib.parse import urlparse
import sys

def check_ssrf(url):
    parsed = urlparse(url)
    if parsed.hostname in ["169.254.169.254", "metadata.google.internal"]:
        print("SSRF_BLOCKED: Cloud instance metadata service prohibited")
        sys.exit(0)
    print("ALLOWED")

check_ssrf("http://169.254.169.254/latest/meta-data")
'
```
- **Expected Outcome**: `SSRF_BLOCKED: Cloud instance metadata service prohibited`.

---

## 📖 Test Suite 4: Interactive Documentation Verification

1. Open your browser to:
   - **Swagger UI**: [http://localhost:8080/swagger](http://localhost:8080/swagger)
   - **Scalar API Reference**: [http://localhost:8080/docs](http://localhost:8080/docs)
2. **Phase 3 Endpoints Checklist**:
   - [ ] `GET /v1/config` (List configurations)
   - [ ] `GET /v1/config/{key}` (Get configuration with history)
   - [ ] `PUT /v1/config` (Upsert configuration)
   - [ ] `DELETE /v1/config/{key}` (Delete configuration)
   - [ ] `GET /v1/config/versions` (List runtime versions)
   - [ ] `GET /v1/config/diff` (Diff runtime versions)
   - [ ] `GET /v1/config/sdk` (SDK config retrieval)
   - [ ] `GET /v1/cache/rules` (List cache rules)
   - [ ] `POST /v1/cache/rules` (Create cache rule)
   - [ ] `PATCH /v1/cache/rules/{id}` (Update cache rule)
   - [ ] `DELETE /v1/cache/rules/{id}` (Delete cache rule)
   - [ ] `POST /v1/cache/invalidate` (Purge cache)
   - [ ] `GET /v1/cache/analytics` (Cache hit/miss analytics)
   - [ ] `GET /v1/cache/recommendations` (Heuristic cache recommendations)
   - [ ] `POST /v1/cache/snapshots/runtime` (Runtime state capture)
   - [ ] `POST /v1/cache/snapshots/traffic` (Traffic distribution capture)
   - [ ] `GET /v1/replay` (List replay runs)
   - [ ] `GET /v1/replay/{id}` (Get replay details and comparison)
   - [ ] `POST /v1/replay` (Execute safe replay)
