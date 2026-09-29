# Strim — Phase 2 Manual Testing Guide
### Runtime Observability, Ingestion Hardening, Request Explorer & Topology Graph

This guide provides step-by-step commands to manually verify all deliverables of **Phase 2**.

---

## 🚀 Pre-requisites & Startup

1. Ensure PostgreSQL, Redis, and ClickHouse containers are running:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```
2. Start the Strim API server:
   ```bash
   bun run --filter @strim/server dev
   ```
   *The server runs on `http://localhost:8080`.*

---

## 🔑 Step 0: Obtain Auth Token & Scoped API Key

1. Log in with seeded credentials or sign up:
   ```bash
   LOGIN_RES=$(curl -s -X POST http://localhost:8080/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "priya@acme.test", "password": "password123"}')

   export TOKEN=$(echo $LOGIN_RES | jq -r .token)
   export ORG_ID=$(echo $LOGIN_RES | jq -r '.organizations[0].id')
   echo "Logged in as Organization: $ORG_ID"
   ```

2. Fetch active Environment ID:
   ```bash
   CONTEXT_RES=$(curl -s -X GET http://localhost:8080/v1/org/context \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-organization-id: $ORG_ID")

   export ENV_ID=$(echo $CONTEXT_RES | jq -r '.workspaces[0].projects[0].applications[0].environments[0].id')
   export APP_NAME=$(echo $CONTEXT_RES | jq -r '.workspaces[0].projects[0].applications[0].name')
   echo "Target Environment: $ENV_ID ($APP_NAME)"
   ```

3. Create a scoped API key for Telemetry Ingestion:
   ```bash
   KEY_RES=$(curl -s -X POST http://localhost:8080/v1/api-keys \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-organization-id: $ORG_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Phase 2 Test Ingest Key",
       "scopes": ["telemetry:write"]
     }')

   export API_KEY=$(echo $KEY_RES | jq -r .rawKey)
   echo "Issued API Key: $API_KEY"
   ```

---

## 🧪 Test Suite 1: Telemetry Ingestion & Anti-DDoS Defense

### 1.1 Ingest Standard Telemetry Batch
```bash
curl -s -i -X POST http://localhost:8080/v1/ingest \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "schema": "strim.telemetry.v1",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "projectId": "proj_demo",
    "environment": "production",
    "events": [
      {
        "type": "request",
        "requestId": "req_'$(date +%s)'_1",
        "traceId": "trace_'$(date +%s)'",
        "method": "POST",
        "path": "/api/checkout",
        "status": 200,
        "durationMs": 42.5,
        "service": "checkout-service",
        "headers": {
          "authorization": "Bearer secret_customer_jwt",
          "cookie": "session_id=super_secret_cookie",
          "user-agent": "Mozilla/5.0"
        },
        "body": {
          "user": "alice",
          "creditCard": "4111222233334444",
          "total": 99.50
        }
      },
      {
        "type": "span",
        "requestId": "req_'$(date +%s)'_2",
        "traceId": "trace_'$(date +%s)'",
        "method": "POST",
        "path": "/charges",
        "status": 200,
        "durationMs": 28.1,
        "service": "payment-gateway"
      }
    ]
  }'
```
- **Expected Outcome**: `HTTP 202 Accepted` with `{"accepted": true, "queuedEvents": 2}`.
- Telemetry worker asynchronously consumes batch, sanitizes PII/headers, stores payload, records aggregates, and discovers `checkout-service ➔ payment-gateway` dependency.

### 1.2 Test 500KB Anti-DDoS Payload Rejection
Attempt to send an oversized payload exceeding 500KB:
```bash
# Generate a dummy payload larger than 500KB
LARGE_DATA=$(python3 -c "import json; print(json.dumps({'schema': 'strim.telemetry.v1', 'timestamp': '2026-09-29T00:00:00Z', 'projectId': 'p', 'environment': 'production', 'events': [{'type': 'request', 'data': 'x' * 600000}]}))")

curl -s -i -X POST http://localhost:8080/v1/ingest \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$LARGE_DATA"
```
- **Expected Outcome**: `HTTP 413 Payload Too Large`.
- **Response**:
  ```json
  {
    "error": "PAYLOAD_TOO_LARGE",
    "message": "Payload exceeds maximum allowed size of 500KB..."
  }
  ```

### 1.3 Ingest OpenTelemetry Traces
```bash
curl -s -i -X POST http://localhost:8080/v1/otlp/v1/traces \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_demo",
    "environment": "production",
    "resourceSpans": [
      {
        "scopeSpans": [
          {
            "spans": [
              {
                "traceId": "trace_otlp_999",
                "spanId": "span_01",
                "name": "GET /api/inventory",
                "startTimeUnixNano": "1727611200000000000",
                "endTimeUnixNano": "1727611200035000000",
                "attributes": [
                  { "key": "http.method", "value": { "stringValue": "GET" } },
                  { "key": "http.status_code", "value": { "intValue": "200" } }
                ]
              }
            ]
          }
        ]
      }
    ]
  }'
```
- **Expected Outcome**: `HTTP 202 Accepted` with `{"accepted": true}`.

---

## 📊 Test Suite 2: Runtime Observability & Health Score Breakdown

### 2.1 Fetch Runtime Overview & Explainability Breakdown
```bash
curl -s -X GET "http://localhost:8080/v1/runtime/overview?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK`.
- **Verification**:
  - `health.score`: Numerical score between 0 and 100.
  - `health.breakdown`: Contains all required factor weights:
    - `availability` (0–100)
    - `latency` (0–100)
    - `errors` (0–100)
    - `trafficAnomaly` (0–100)
    - `dependencies` (0–100)
    - `cache` (0–100)
    - `saturation` (0–100)
  - `latency`: Contains `p50`, `p95`, `p99`.
  - `traffic`: Live `rps`.

### 2.2 Query Timeseries Metrics
```bash
curl -s -X GET "http://localhost:8080/v1/runtime/timeseries?environmentId=$ENV_ID&minutes=30" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK` with 12 timeseries buckets containing `rps`, `p95Ms`, and `errorRate`.

### 2.3 Query Recent Runtime Events
```bash
curl -s -X GET "http://localhost:8080/v1/runtime/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK` with recent `REQUEST_COMPLETED` queue events.

---

## 🔍 Test Suite 3: Request Explorer & Distributed Trace Waterfall

### 3.1 Search & List Captured Requests
```bash
REQUESTS_RES=$(curl -s -X GET "http://localhost:8080/v1/requests?environmentId=$ENV_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID")

echo $REQUESTS_RES | jq .
export REQ_ID=$(echo $REQUESTS_RES | jq -r '.requests[0].id')
echo "Sample Request ID: $REQ_ID"
```
- **Expected Outcome**: `HTTP 200 OK` returning an array of ingested requests with sanitized headers.

### 3.2 Fetch Request Details
```bash
curl -s -X GET "http://localhost:8080/v1/requests/$REQ_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK` showing individual request record with `payloadRef`, duration, status, and path.

### 3.3 Inspect Trace Waterfall Timeline
```bash
curl -s -X GET "http://localhost:8080/v1/requests/$REQ_ID/trace" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK`.
- **Response Structure**:
  - `root`: Root request record.
  - `totalDurationMs`: Total end-to-end trace span duration.
  - `spans`: Ordered array of correlated spans with relative `offsetMs`, `durationMs`, and `service`.

---

## 🌐 Test Suite 4: Service Topology Graph & Blast Radius

### 4.1 Fetch Auto-Derived Topology Graph
```bash
curl -s -X GET "http://localhost:8080/v1/topology?environmentId=$ENV_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK` returning `{ nodes: [...], edges: [...] }` derived from the ingested telemetry.

### 4.2 Manually Annotate a Service Dependency Edge
```bash
curl -s -X POST "http://localhost:8080/v1/topology/annotate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "'$ENV_ID'",
    "fromName": "checkout-service",
    "toName": "fraud-detection-api"
  }' | jq .
```
- **Expected Outcome**: `HTTP 200 OK` with `manual: true`.

### 4.3 Query Upstream Dependencies (`depends`)
```bash
curl -s -X GET "http://localhost:8080/v1/topology/query?environmentId=$ENV_ID&node=checkout-service&q=depends" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: Returns array of services that `checkout-service` calls (e.g. `["payment-gateway", "fraud-detection-api"]`).

### 4.4 Query Failure Impact (`breaks`)
```bash
curl -s -X GET "http://localhost:8080/v1/topology/query?environmentId=$ENV_ID&node=payment-gateway&q=breaks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: Returns all services that would break if `payment-gateway` becomes unavailable.

### 4.5 Query Blast Radius (`blast`)
```bash
curl -s -X GET "http://localhost:8080/v1/topology/query?environmentId=$ENV_ID&node=payment-gateway&q=blast" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: Returns the set of all directly and transitively impacted nodes.

---

## 📖 Test Suite 5: Swagger UI & Scalar Documentation

1. Open your browser and navigate to:
   - **Swagger UI**: [http://localhost:8080/swagger](http://localhost:8080/swagger)
   - **Scalar API Reference**: [http://localhost:8080/docs](http://localhost:8080/docs)
2. **Phase 2 Endpoints Verification**:
   - [ ] `POST /v1/ingest` under **Telemetry Ingestion**.
   - [ ] `POST /v1/otlp/v1/traces` under **Telemetry Ingestion**.
   - [ ] `GET /v1/runtime/overview` under **Runtime Observability**.
   - [ ] `GET /v1/runtime/timeseries` under **Runtime Observability**.
   - [ ] `GET /v1/runtime/events` under **Runtime Observability**.
   - [ ] `GET /v1/requests` under **Request Explorer & Traces**.
   - [ ] `GET /v1/requests/{id}` under **Request Explorer & Traces**.
   - [ ] `GET /v1/requests/{id}/trace` under **Request Explorer & Traces**.
   - [ ] `GET /v1/topology` under **Service Topology & Blast Radius**.
   - [ ] `POST /v1/topology/annotate` under **Service Topology & Blast Radius**.
   - [ ] `GET /v1/topology/query` under **Service Topology & Blast Radius**.
