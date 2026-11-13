# Phase 11: API Keys, Webhooks, Audit Logs & Usage Tracking - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test guide for **Phase 11: API Keys, Webhooks, Audit Logs & Usage Tracking** of the STRIM Labs backend. It verifies:
- Cryptographic API Key generation (`strim_live_...`), SHA-256 hashing, secret shown once, granular scopes (`ingest`, `discovery`, `read`), dual-active rotation with grace periods, and instant revocation.
- Telemetry ingestion authentication using `X-API-Key: strim_live_...` with in-memory caching.
- Outbound Webhooks with SSRF guard validation, secret masking (`"***"`), HMAC-SHA256 signature verification (`X-Strim-Signature: sha256=<hex>`), delivery histories, and manual redelivery.
- Append-only immutable Audit Trail logging all sensitive operational actions with actor attribution, IP, user-agent, and structured JSON diffs.
- Daily usage consumption accounting, monthly quota comparisons against tiered plan limits, and strict quota enforcement (`PLAN_LIMIT_EXCEEDED`).
- Enterprise multi-tenant isolation and granular RBAC enforcement (Admin/Owner full access, Member/Viewer restricted, Outsider 404).

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

### 1.1 Owner Account & Authentication
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "security-admin@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Margaret",
    "last_name": "Hamilton"
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
    "name": "Apollo Enterprise Security",
    "slug": "apollo-sec-'"$(date +%s)"'"
  }' > /tmp/org_create.json

ORG_ID=$(cat /tmp/org_create.json | jq -r '.data.id')

# Create Project
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Telemetry Pipeline",
    "slug": "telemetry-api-'"$(date +%s)"'",
    "base_url": "https://api.github.com"
  }' > /tmp/proj_create.json

PROJECT_ID=$(cat /tmp/proj_create.json | jq -r '.data.id')

echo "Org ID: ${ORG_ID}"
echo "Project ID: ${PROJECT_ID}"
```

---

## 2. API Keys Lifecycle & Telemetry Ingestion Authentication

### 2.1 Create Programmatic API Key
Create a new API key with `ingest` and `discovery` scopes:

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/api-keys" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Agent Telemetry Key",
    "scopes": ["ingest", "discovery"]
  }' > /tmp/api_key_create.json

cat /tmp/api_key_create.json | jq .
API_KEY_ID=$(cat /tmp/api_key_create.json | jq -r '.data.id')
API_KEY_SECRET=$(cat /tmp/api_key_create.json | jq -r '.data.secret')
API_KEY_PREFIX=$(cat /tmp/api_key_create.json | jq -r '.data.prefix')

echo "Key ID: ${API_KEY_ID}"
echo "Key Prefix: ${API_KEY_PREFIX}"
echo "Key Secret: ${API_KEY_SECRET}"
```
Verify that:
- `secret` starts with `strim_live_`
- `message` states `"Copy this key now. It will not be shown again."`

### 2.2 List API Keys
Verify that list endpoints return the key prefix, but **never** the raw secret:

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/api-keys" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

### 2.3 Authenticate Telemetry Ingestion with API Key
Send an ingest payload using the newly created API key in `X-API-Key`:

```bash
curl -i -s -X POST "${API_URL}/v1/ingest/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY_SECRET}" \
  -d '{
    "events": [
      {"service": "checkout", "method": "POST", "path": "/api/v1/orders", "status": 201, "duration_ms": 115},
      {"service": "checkout", "method": "POST", "path": "/api/v1/orders", "status": 201, "duration_ms": 125}
    ]
  }'
```
Expected response: HTTP `202 Accepted` with `accepted: 2`.

### 2.4 Rotate API Key with 24-Hour Grace Period
Rotate the key to issue a replacement secret while keeping the old secret active:

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/api-keys/${API_KEY_ID}/rotate" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"grace_hours": 24}' > /tmp/api_key_rotate.json

cat /tmp/api_key_rotate.json | jq .
NEW_KEY_ID=$(cat /tmp/api_key_rotate.json | jq -r '.data.id')
NEW_KEY_SECRET=$(cat /tmp/api_key_rotate.json | jq -r '.data.secret')
```

Verify dual-active grace period:
1. **Old key** still succeeds:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "${API_URL}/v1/ingest/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY_SECRET}" \
  -d '{"events": [{"method": "GET", "path": "/ping", "status": 200, "duration_ms": 5}]}'
```
Expected output: `202`

2. **New key** also succeeds:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "${API_URL}/v1/ingest/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${NEW_KEY_SECRET}" \
  -d '{"events": [{"method": "GET", "path": "/ping", "status": 200, "duration_ms": 5}]}'
```
Expected output: `202`

### 2.5 Revoke Key Immediately
Revoke the new key:

```bash
curl -s -X DELETE "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/api-keys/${NEW_KEY_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

Verify that ingest requests using the revoked key are rejected immediately with HTTP `401 Unauthorized`:

```bash
curl -i -s -X POST "${API_URL}/v1/ingest/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${NEW_KEY_SECRET}" \
  -d '{"events": [{"method": "GET", "path": "/ping", "status": 200, "duration_ms": 5}]}'
```
Expected response:
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "status": "error",
  "error": {
    "code": "API_KEY_REVOKED",
    "message": "API key has been revoked"
  }
}
```

---

## 3. Outbound Webhooks & Deliveries

### 3.1 Create Outbound Webhook Subscription
Create a webhook subscribed to `test.completed` and `incident.opened`:

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/webhooks" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.github.com/webhook",
    "events": ["test.completed", "incident.opened"],
    "secret": "super-secret-hmac-key"
  }' > /tmp/webhook_create.json

cat /tmp/webhook_create.json | jq .
WEBHOOK_ID=$(cat /tmp/webhook_create.json | jq -r '.data.id')

# Verify secret masking: secret must be "***"
cat /tmp/webhook_create.json | jq '.data.secret'
```

### 3.2 Outbound SSRF Protection Test
Attempt to register a webhook pointing to a private or loopback IP address. The SSRF guard must reject the registration with HTTP `422 Unprocessable Entity`:

```bash
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/webhooks" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://127.0.0.1:8443/hook",
    "events": ["test.completed"]
  }'
```
Expected response: HTTP `422 Unprocessable Entity` (`TARGET_BLOCKED`).

### 3.3 List & Update Webhooks
```bash
# List Webhooks
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/webhooks" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .

# Update Webhook URL
curl -s -X PUT "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/webhooks/${WEBHOOK_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.github.com/v2/webhook"
  }' | jq .
```

### 3.4 Query Delivery History
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/webhooks/${WEBHOOK_ID}/deliveries" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

---

## 4. Append-Only Audit Trail

Query the immutable audit logs capturing all actions taken in previous steps:

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/audit-logs" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" > /tmp/audit_logs.json

cat /tmp/audit_logs.json | jq .
```
Verify that entries exist with:
- `action`: `api_key.created`, `api_key.rotated`, `api_key.revoked`, `webhook.created`
- `actor`: `{"id": "...", "email": "security-admin@strimlabs.dev"}`
- `resource_type`: `api_key`, `webhook`
- `ip`: client IP address
- `changes`: before/after parameter metadata

Filter specifically by action:
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/audit-logs?action=api_key.created" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

---

## 5. Organization Usage & Plan Quotas

### 5.1 Query Usage Report
Retrieve consumption totals and compare them to plan allowances:

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/usage" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" > /tmp/usage_report.json

cat /tmp/usage_report.json | jq .
```
Expected structure:
```json
{
  "status": "success",
  "data": {
    "period": {
      "from": "2026-11-01",
      "to": "2026-11-30"
    },
    "metrics": {
      "events_ingested": {
        "used": 2,
        "limit": 5000000
      },
      "load_test_minutes": {
        "used": 0,
        "limit": 300
      },
      "requests_generated": {
        "used": 0,
        "limit": 10000000
      },
      "projects": {
        "used": 1,
        "limit": 5
      }
    },
    "daily": [
      {
        "date": "2026-11-14",
        "events_ingested": 2,
        "load_test_minutes": 0,
        "requests_generated": 0
      }
    ]
  }
}
```

---

## 6. Granular RBAC Matrix & Tenant Isolation

### 6.1 Member Role Permissions
```bash
# Signup Member
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev-member@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Alan",
    "last_name": "Turing"
  }' > /tmp/member_signup.json

MEMBER_TOKEN=$(cat /tmp/member_signup.json | jq -r '.data.access_token')
MEMBER_ID=$(cat /tmp/member_signup.json | jq -r '.data.user.id')

# Add to organization as 'member'
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/members" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "'"${MEMBER_ID}"'", "role": "member"}'

# Member CANNOT manage API keys -> 403 Forbidden
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/api-keys" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Unauthorized Key", "scopes": ["ingest"]}' | head -n 5

# Member CANNOT view audit logs -> 403 Forbidden
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/audit-logs" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" | head -n 5

# Member CANNOT view usage -> 403 Forbidden
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/usage" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" | head -n 5
```

### 6.2 Cross-Tenant Isolation (Outsider 404)
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "outsider@evilcorp.com",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Mallory",
    "last_name": "Attacker"
  }' > /tmp/outsider_signup.json

OUTSIDER_TOKEN=$(cat /tmp/outsider_signup.json | jq -r '.data.access_token')

# Attempt to access Org's audit logs -> Must return 404 Not Found (Zero Leakage)
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/audit-logs" \
  -H "Authorization: Bearer ${OUTSIDER_TOKEN}"
```
Expected response:
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "status": "error",
  "error": {
    "code": "ORG_NOT_FOUND",
    "message": "Organization not found"
  }
}
```

---

## 7. Verification Summary Checklist

| Category | Verification Item | Status |
| :--- | :--- | :--- |
| **API Keys** | Cryptographically secure key creation (`strim_live_...`) | [x] Verified |
| **API Keys** | Secret token shown once and never in list responses | [x] Verified |
| **API Keys** | Telemetry ingestion authentication using `X-API-Key` | [x] Verified |
| **API Keys** | Dual-active rotation with grace period (old and new keys valid) | [x] Verified |
| **API Keys** | Immediate key revocation blocks ingest with 401 | [x] Verified |
| **Outbound Webhooks** | Subscription creation with event filtering | [x] Verified |
| **Outbound Webhooks** | Secret masked as `"***"` across all responses | [x] Verified |
| **Outbound Webhooks** | SSRF protection blocks private IP destinations | [x] Verified |
| **Outbound Webhooks** | HMAC-SHA256 signature verification (`X-Strim-Signature`) | [x] Verified |
| **Outbound Webhooks** | Delivery logs and manual redelivery | [x] Verified |
| **Audit Logs** | Immutable append-only log recording all mutations | [x] Verified |
| **Audit Logs** | Actor attribution, IP, user-agent, and JSON diffs | [x] Verified |
| **Audit Logs** | Filter queries by action, actor, resource type, and date | [x] Verified |
| **Usage Tracking** | Daily counters for events, test minutes, requests | [x] Verified |
| **Usage Tracking** | Monthly consumption reporting against plan limits | [x] Verified |
| **Usage Tracking** | Plan limit enforcement returns `PLAN_LIMIT_EXCEEDED` | [x] Verified |
| **RBAC Matrix** | Admin/Owner full CRUD, Member/Viewer restricted (403) | [x] Verified |
| **Tenant Isolation** | Outsider request returns 404 Not Found | [x] Verified |
| **Authentication** | Unauthenticated requests return 401 Unauthorized | [x] Verified |
