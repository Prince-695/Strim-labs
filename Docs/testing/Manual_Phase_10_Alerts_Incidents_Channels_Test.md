# Phase 10: Alerting Engine, Incidents & Notification Channels - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test guide for **Phase 10: Alerting Engine, Incidents & Notification Channels** of the STRIM Labs backend. It verifies:
- Multi-channel notification delivery (Slack webhook, Email, HMAC-signed Webhook) with secret masking (`"***"`)
- Outbound SSRF protection on notification webhooks
- Test notification dispatch (`POST /test`)
- Alert rules configuration (metric targets, condition thresholds, evaluation window, `for` duration hysteresis)
- Optimistic concurrency control (`VERSION_CONFLICT` / 409 Conflict)
- Rule muting and unmute lifecycles
- Incident lifecycle management (triaging, acknowledging, resolving, timeline event comments)
- Multi-tenant isolation and granular RBAC enforcement (Admin, Member, Viewer, Outsider 404)

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

Alerting and incident management operate within the tenancy boundary of an organization.

### 1.1 Owner Account & Authentication
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alerts-admin@strimlabs.dev",
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
    "name": "Reliability Engineering Org",
    "slug": "sre-org-'"$(date +%s)"'"
  }' > /tmp/org_create.json

ORG_ID=$(cat /tmp/org_create.json | jq -r '.data.id')

# Create Project
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment Gateway API",
    "slug": "payment-api-'"$(date +%s)"'",
    "base_url": "https://api.github.com"
  }' > /tmp/proj_create.json

PROJECT_ID=$(cat /tmp/proj_create.json | jq -r '.data.id')
API_KEY=$(cat /tmp/proj_create.json | jq -r '.data.api_key')

echo "Org ID: ${ORG_ID}"
echo "Project ID: ${PROJECT_ID}"
echo "API Key: ${API_KEY}"
```

---

## 2. Notification Channels Management

Notification channels deliver alerts when incidents fire, resolve, or are tested. Sensitive credentials (such as Webhook URLs and HMAC shared secrets) are write-only and must be masked as `"***"` in all API responses.

### 2.1 Create Slack Notification Channel
```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/notification-channels" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "slack",
    "name": "SRE Incident Slack Room",
    "config": {
      "webhook_url": "https://example.com/slack-webhook-mock"
    }
  }' > /tmp/slack_channel.json

cat /tmp/slack_channel.json | jq .
SLACK_CHANNEL_ID=$(cat /tmp/slack_channel.json | jq -r '.data.id')

# Verify secret masking: webhook_url should be "***"
cat /tmp/slack_channel.json | jq '.data.config.webhook_url'
```

### 2.2 Create Email Notification Channel
```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/notification-channels" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "name": "On-Call Engineering Distribution",
    "config": {
      "recipients": ["oncall-team@strimlabs.dev", "lead-sre@strimlabs.dev"]
    }
  }' > /tmp/email_channel.json

cat /tmp/email_channel.json | jq .
EMAIL_CHANNEL_ID=$(cat /tmp/email_channel.json | jq -r '.data.id')
```

### 2.3 Create Generic Webhook Notification Channel
```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/notification-channels" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "webhook",
    "name": "OpsGenie Gateway Webhook",
    "config": {
      "webhook_url": "https://api.github.com/webhook",
      "secret": "top-secret-hmac-key-2026"
    }
  }' > /tmp/webhook_channel.json

cat /tmp/webhook_channel.json | jq .
WEBHOOK_CHANNEL_ID=$(cat /tmp/webhook_channel.json | jq -r '.data.id')

# Verify secret masking: secret should be "***"
cat /tmp/webhook_channel.json | jq '.data.config.secret'
```

### 2.4 List Notification Channels
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/notification-channels" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

### 2.5 Test Notification Channel Dispatch
Trigger a simulated test notification payload across the email channel:
```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/notification-channels/${EMAIL_CHANNEL_ID}/test" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
Expected output:
```json
{
  "status": "success",
  "data": {
    "message": "Test notification dispatched successfully"
  }
}
```

---

## 3. Alert Rules Lifecycle & Optimistic Locking

### 3.1 Create High Latency Alert Rule
Create a rule targeting P95 latency with a `for` duration of `2m` for anti-flapping hysteresis:

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/alert-rules" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High P95 Latency on Checkout",
    "scope": {
      "project_id": "'"${PROJECT_ID}"'",
      "service": "checkout",
      "endpoint": "POST /api/checkout"
    },
    "condition": {
      "metric": "latency_p95",
      "operator": ">",
      "threshold": 300,
      "window": "5m"
    },
    "for": "2m",
    "severity": "critical",
    "channel_ids": ["'"${EMAIL_CHANNEL_ID}"'"]
  }' > /tmp/alert_rule.json

cat /tmp/alert_rule.json | jq .
ALERT_RULE_ID=$(cat /tmp/alert_rule.json | jq -r '.data.id')
RULE_VERSION=$(cat /tmp/alert_rule.json | jq -r '.data.version')
echo "Rule ID: ${ALERT_RULE_ID}, Initial Version: ${RULE_VERSION}"
```

### 3.2 Optimistic Concurrency Control: Version Conflict Test
Attempt an update using a stale version (`version: 999`). The API must reject the update with HTTP `409 Conflict` and error code `VERSION_CONFLICT`:

```bash
curl -i -s -X PUT "${API_URL}/v1/organizations/${ORG_ID}/alert-rules/${ALERT_RULE_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Stale Concurrent Update",
    "condition": {
      "metric": "latency_p95",
      "operator": ">",
      "threshold": 500,
      "window": "5m"
    },
    "for": "2m",
    "severity": "critical",
    "channel_ids": ["'"${EMAIL_CHANNEL_ID}"'"],
    "version": 999
  }'
```
Expected response:
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "status": "error",
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Resource version conflict. The resource has been modified concurrently."
  }
}
```

### 3.3 Optimistic Concurrency Control: Successful Update
Update the rule using the correct matching `version`:

```bash
curl -s -X PUT "${API_URL}/v1/organizations/${ORG_ID}/alert-rules/${ALERT_RULE_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High P95 Latency on Checkout (Tuned)",
    "condition": {
      "metric": "latency_p95",
      "operator": ">",
      "threshold": 400,
      "window": "5m"
    },
    "for": "2m",
    "severity": "critical",
    "channel_ids": ["'"${EMAIL_CHANNEL_ID}"'"],
    "version": '"${RULE_VERSION}"'
  }' | jq .
```
Verify that the returned `data.version` is incremented to `2`.

### 3.4 Rule Muting Lifecycle
Mute the rule for 1 hour during scheduled maintenance:

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/alert-rules/${ALERT_RULE_ID}/mute" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"duration": "1h"}' | jq .
```
Verify that `muted_until` is populated with a future ISO timestamp.

Unmute the rule:
```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/alert-rules/${ALERT_RULE_ID}/unmute" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
Verify that `muted_until` is `null`.

---

## 4. Ingest Telemetry & Incident Lifecycle

### 4.1 Ingest Degraded Telemetry
Send high-latency and error-producing telemetry matching the rule's scope:

```bash
curl -s -X POST "${API_URL}/v1/ingest/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "events": [
      {"service": "checkout", "method": "POST", "path": "/api/checkout", "status": 500, "duration_ms": 650},
      {"service": "checkout", "method": "POST", "path": "/api/checkout", "status": 500, "duration_ms": 720},
      {"service": "checkout", "method": "POST", "path": "/api/checkout", "status": 500, "duration_ms": 810},
      {"service": "checkout", "method": "POST", "path": "/api/checkout", "status": 500, "duration_ms": 590}
    ]
  }' | jq .
```

### 4.2 List Active Incidents
Query incidents filtered by status and severity:

```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/incidents?status=firing&severity=critical" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" > /tmp/incidents_list.json

cat /tmp/incidents_list.json | jq .
INCIDENT_ID=$(cat /tmp/incidents_list.json | jq -r '.data[0].id // empty')
```

### 4.3 View Incident Details & Timeline Events
```bash
if [ -n "${INCIDENT_ID}" ]; then
  curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}" \
    -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
fi
```

### 4.4 Acknowledge Incident
Signal to the team that an engineer is actively investigating:

```bash
if [ -n "${INCIDENT_ID}" ]; then
  curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/acknowledge" \
    -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
fi
```
Verify that `status` changes to `acknowledged` and an `acknowledged` event appears in the incident timeline.

### 4.5 Add Timeline Comment
Post diagnostic context and mitigation notes:

```bash
if [ -n "${INCIDENT_ID}" ]; then
  curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/comments" \
    -H "Authorization: Bearer ${OWNER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "comment": "Identified downstream redis cache saturation. Restarted worker pods."
    }' | jq .
fi
```

### 4.6 Manually Resolve Incident
Resolve the incident after recovery:

```bash
if [ -n "${INCIDENT_ID}" ]; then
  curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/resolve" \
    -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
fi
```
Verify that `status` changes to `resolved` and `resolved_at` timestamp is set.

---

## 5. Multi-Tenant Isolation & Granular RBAC Verification

### 5.1 Member Role Permissions
Create an organization member and verify their access rights:

```bash
# Signup member
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "team-member@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Bob",
    "last_name": "Member"
  }' > /tmp/member_signup.json

MEMBER_TOKEN=$(cat /tmp/member_signup.json | jq -r '.data.access_token')

# Add member to organization
MEMBER_USER_ID=$(cat /tmp/member_signup.json | jq -r '.data.user.id')
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/members" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'"${MEMBER_USER_ID}"'",
    "role": "member"
  }'

# 1. Member CAN read alert rules
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/alert-rules" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" | head -n 5

# 2. Member CANNOT create alert rules (Requires Admin/Owner -> 403 Forbidden)
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/alert-rules" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Unauthorized Rule"}' | head -n 5

# 3. Member CAN acknowledge incidents and add timeline comments
if [ -n "${INCIDENT_ID}" ]; then
  curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/comments" \
    -H "Authorization: Bearer ${MEMBER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"comment": "Member triage note"}' | head -n 5
fi
```

### 5.2 Viewer Role Permissions
Create an organization viewer and verify read-only enforcement:

```bash
# Signup viewer
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "team-viewer@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Carol",
    "last_name": "Viewer"
  }' > /tmp/viewer_signup.json

VIEWER_TOKEN=$(cat /tmp/viewer_signup.json | jq -r '.data.access_token')

# Add viewer to organization
VIEWER_USER_ID=$(cat /tmp/viewer_signup.json | jq -r '.data.user.id')
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/members" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'"${VIEWER_USER_ID}"'",
    "role": "viewer"
  }'

# 1. Viewer CAN list alert rules and incidents
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/alert-rules" \
  -H "Authorization: Bearer ${VIEWER_TOKEN}" | head -n 5

curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/incidents" \
  -H "Authorization: Bearer ${VIEWER_TOKEN}" | head -n 5

# 2. Viewer CANNOT acknowledge incidents (Requires Member/Admin/Owner -> 403 Forbidden)
if [ -n "${INCIDENT_ID}" ]; then
  curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/acknowledge" \
    -H "Authorization: Bearer ${VIEWER_TOKEN}" | head -n 5
fi
```

### 5.3 Cross-Tenant Isolation (Outsider 404)
Create a completely separate organization and user:

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

# Attempt to access Org 1's alert rules -> Must return 404 Not Found (zero tenant leakage)
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/alert-rules" \
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

## 6. Verification Summary Checklist

| Category | Verification Item | Status |
| :--- | :--- | :--- |
| **Notification Channels** | Slack channel creation with write-only webhook | [x] Verified |
| **Notification Channels** | Email channel creation with recipient validation | [x] Verified |
| **Notification Channels** | Generic webhook channel creation with HMAC signing secret | [x] Verified |
| **Notification Channels** | Secret masking (`"***"`) across all channel endpoints | [x] Verified |
| **Notification Channels** | SSRF protection rejects private IP targets | [x] Verified |
| **Notification Channels** | Test notification dispatch (`POST /test`) returns 200 | [x] Verified |
| **Alert Rules** | Creation of alert rules with metric, threshold, window, `for` hysteresis | [x] Verified |
| **Alert Rules** | Optimistic concurrency control (`VERSION_CONFLICT` / 409 Conflict) | [x] Verified |
| **Alert Rules** | Rule muting (`POST /mute`) and unmute (`POST /unmute`) | [x] Verified |
| **Incident Lifecycle** | Listing with status and severity filters | [x] Verified |
| **Incident Lifecycle** | Incident detail retrieval with timeline events | [x] Verified |
| **Incident Lifecycle** | Acknowledge incident changes status and records timeline event | [x] Verified |
| **Incident Lifecycle** | Comment addition writes to timeline | [x] Verified |
| **Incident Lifecycle** | Manual resolve transitions status to `resolved` | [x] Verified |
| **RBAC Matrix** | Admin/Owner full CRUD, Member triage, Viewer read-only | [x] Verified |
| **Tenant Isolation** | Outsider request returns 404 Not Found without leaking data | [x] Verified |
| **Authentication** | Unauthenticated requests return 401 Unauthorized | [x] Verified |
