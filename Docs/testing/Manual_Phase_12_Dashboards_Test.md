# Phase 12: Customizable Observability Dashboards - Manual Verification Guide

This document provides a step-by-step manual test guide for **Phase 12: Customizable Observability Dashboards** of the STRIM Labs backend. It verifies:
- Automated provisioning of the standard system default dashboard (**"API Overview"**) on project initialization.
- Default dashboard undeletable protection (**403 Forbidden / `DEFAULT_DASHBOARD_UNDELETABLE`**).
- Full custom dashboard CRUD operations with layout metadata (`x`, `y`, `w`, `h`), refresh intervals, and time ranges.
- Widget schema safety and query templating (**metric + group_by + endpoint filters**, with strict prevention of raw SQL execution).
- Maximum widget capacity ceiling (**30 widgets limit / `TOO_MANY_WIDGETS`**).
- Optimistic concurrency control via integer version counters (**409 Conflict / `VERSION_CONFLICT`** upon concurrent edit attempts).
- One-click dashboard cloning generating independent copies with distinct UUIDv7 widget IDs.
- Granular enterprise RBAC enforcement (**Member+** write/update/delete/clone, **Viewer+** read/list, **Outsider** 404 isolation).

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
    "email": "dash-lead@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Ada",
    "last_name": "Lovelace"
  }' > /tmp/owner_signup.json

OWNER_TOKEN=$(cat /tmp/owner_signup.json | jq -r '.data.access_token')

# Send and verify OTP
curl -s -X POST "${API_URL}/v1/auth/otp/send" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"

# (Input the OTP printed in the backend console logs)
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
    "name": "Observability Operations",
    "slug": "obs-ops-org"
  }' > /tmp/org.json

ORG_ID=$(cat /tmp/org.json | jq -r '.data.id')

# Create Project
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payments Microservice",
    "slug": "payments-microservice",
    "base_url": "https://api.acme.com",
    "environment": "production"
  }' > /tmp/proj.json

PROJECT_ID=$(cat /tmp/proj.json | jq -r '.data.id')
echo "ORG_ID: ${ORG_ID}, PROJECT_ID: ${PROJECT_ID}"
```

### 1.3 Add Team Members (Member & Viewer Roles)
```bash
# Add Member
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/members" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "member-engineer@strimlabs.dev",
    "role": "member"
  }'

# Add Viewer
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/members" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "viewer-analyst@strimlabs.dev",
    "role": "viewer"
  }'
```

---

## 2. Default Dashboard Auto-Seeding & Retrieval

When querying dashboards for a project, STRIM Labs automatically provisions the standard system default dashboard (**"API Overview"**) with 4 core monitoring widgets.

### 2.1 List Dashboards
```bash
curl -i -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```

**Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "019313a0-...",
      "name": "API Overview",
      "is_default": true,
      "version": 1,
      "updated_at": "2026-11-14T..."
    }
  ]
}
```

Save the default dashboard ID:
```bash
DEFAULT_DASH_ID=$(curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq -r '.data[0].id')
```

### 2.2 Retrieve Full Default Dashboard
```bash
curl -i -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards/${DEFAULT_DASH_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```

**Expected Response (`200 OK`)**:
- `name`: `"API Overview"`
- `is_default`: `true`
- `version`: `1`
- `time_range`: `"1h"`
- `refresh_seconds`: `15`
- `widgets`: Exactly 4 pre-configured widgets:
  1. `Overall P95 Latency` (`timeseries`, metric `p95`, unit `ms`)
  2. `Request Throughput` (`timeseries`, metric `rps`, unit `rps`)
  3. `Status Codes Breakdown` (`status_pie`, metric `status_codes`, group_by `status`)
  4. `Top Endpoints Summary` (`table`, metric `requests`, group_by `endpoint`)

---

## 3. Create Custom Observability Dashboard

Create a project-specific dashboard with customized grid positioning and templated metric queries.

```bash
curl -i -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkout SLOs & Latency",
    "time_range": "24h",
    "refresh_seconds": 30,
    "widgets": [
      {
        "type": "timeseries",
        "title": "Tail Latency (P99)",
        "layout": { "x": 0, "y": 0, "w": 6, "h": 4 },
        "query": { "metric": "p99", "group_by": "endpoint" },
        "options": { "unit": "ms" }
      },
      {
        "type": "stat",
        "title": "Peak Ingestion Throughput",
        "layout": { "x": 6, "y": 0, "w": 6, "h": 4 },
        "query": { "metric": "rps", "group_by": "none" },
        "options": { "unit": "rps" }
      },
      {
        "type": "status_pie",
        "title": "Error Distribution (4xx vs 5xx)",
        "layout": { "x": 0, "y": 4, "w": 12, "h": 4 },
        "query": { "metric": "status_codes", "group_by": "status" }
      }
    ]
  }' > /tmp/custom_dash.json

cat /tmp/custom_dash.json | jq .
CUSTOM_DASH_ID=$(cat /tmp/custom_dash.json | jq -r '.data.id')
echo "CUSTOM_DASH_ID: ${CUSTOM_DASH_ID}"
```

**Expected Response (`201 Created`)**:
- `name`: `"Checkout SLOs & Latency"`
- `is_default`: `false`
- `version`: `1`
- `widgets`: 3 widgets, each with a generated unique ID.

---

## 4. Optimistic Concurrency Control (Conflict Detection)

STRIM Labs protects dashboards from concurrent edit overwrites using integer `version` checking.

### 4.1 Update with Stale / Mismatched Version (Conflict)
Attempt to update using `version: 99`:
```bash
curl -i -X PUT "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards/${CUSTOM_DASH_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 99,
    "name": "Stale Update Attempt"
  }'
```

**Expected Response (`409 Conflict`)**:
```json
{
  "success": false,
  "error": "Resource version conflict: resource has been modified by another operation",
  "error_code": "VERSION_CONFLICT"
}
```

### 4.2 Update with Matching Version (Success)
Send current version (`version: 1`):
```bash
curl -i -X PUT "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards/${CUSTOM_DASH_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "name": "Checkout SLOs & Tail Latency (Production)",
    "refresh_seconds": 60
  }'
```

**Expected Response (`200 OK`)**:
- `name`: `"Checkout SLOs & Tail Latency (Production)"`
- `refresh_seconds`: `60`
- `version`: `2` (auto-incremented)

---

## 5. One-Click Dashboard Cloning

Duplicate an existing dashboard with a single request. All widget layouts and queries are cloned, and every widget receives a brand new unique ID.

### 5.1 Clone Default Dashboard
```bash
curl -i -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards/${DEFAULT_DASH_ID}/clone" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Staging API Overview"
  }' > /tmp/cloned_dash.json

cat /tmp/cloned_dash.json | jq .
CLONED_DASH_ID=$(cat /tmp/cloned_dash.json | jq -r '.data.id')
```

**Expected Response (`201 Created`)**:
- `name`: `"Staging API Overview"`
- `is_default`: `false` (clones are non-default editable dashboards)
- `version`: `1`
- `widgets`: 4 widgets with new IDs distinct from the source dashboard.

---

## 6. Delete Dashboard & Default Protection

### 6.1 Attempt to Delete Default Dashboard (Forbidden)
```bash
curl -i -X DELETE "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards/${DEFAULT_DASH_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```

**Expected Response (`403 Forbidden`)**:
```json
{
  "success": false,
  "error": "Default system dashboard cannot be deleted",
  "error_code": "DEFAULT_DASHBOARD_UNDELETABLE"
}
```

### 6.2 Delete Custom Dashboard (Success)
```bash
curl -i -X DELETE "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards/${CUSTOM_DASH_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```

**Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Dashboard deleted successfully"
}
```

Confirm that the deleted dashboard no longer exists:
```bash
curl -i -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards/${CUSTOM_DASH_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```
**Expected Response (`404 Not Found`)**.

---

## 7. Widget Schema Safety & Security Rules

### 7.1 Reject Raw SQL Execution Attempt
Clients are strictly prohibited from submitting arbitrary SQL queries:
```bash
curl -i -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Exploit Attempt",
    "widgets": [
      {
        "type": "timeseries",
        "title": "SQL Injection",
        "query": { "metric": "SELECT * FROM users" }
      }
    ]
  }'
```
**Expected Response (`400 Bad Request / VALIDATION_FAILED`)**.

### 7.2 Reject Exceeding 30 Widgets Limit
```bash
# Generating 31 widgets payload
python3 -c '
import json
widgets = [{"type": "stat", "title": f"W{i}", "query": {"metric": "rps"}} for i in range(31)]
print(json.dumps({"name": "Too Many", "widgets": widgets}))
' > /tmp/too_many_widgets.json

curl -i -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/dashboards" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/too_many_widgets.json
```
**Expected Response (`400 Bad Request / TOO_MANY_WIDGETS`)**.

---

## 8. Role-Based Access Control (RBAC) Matrix

| Endpoint | Action | Allowed Roles | Blocked Roles |
|---|---|---|---|
| `POST /dashboards` | Create dashboard | `owner`, `admin`, `member` (201) | `viewer` (403), `outsider` (404), Unauth (401) |
| `GET /dashboards` | List dashboards | `owner`, `admin`, `member`, `viewer` (200) | `outsider` (404), Unauth (401) |
| `GET /dashboards/:id` | Get dashboard details | `owner`, `admin`, `member`, `viewer` (200) | `outsider` (404), Unauth (401) |
| `PUT /dashboards/:id` | Update dashboard | `owner`, `admin`, `member` (200) | `viewer` (403), `outsider` (404), Unauth (401) |
| `POST /dashboards/:id/clone`| Clone dashboard | `owner`, `admin`, `member` (201) | `viewer` (403), `outsider` (404), Unauth (401) |
| `DELETE /dashboards/:id` | Delete dashboard | `owner`, `admin`, `member` (200) | `viewer` (403), `outsider` (404), Unauth (401) |

---

## 9. Verification Sign-Off Checklist

- [x] Auto-provisioned standard default dashboard ("API Overview") with 4 core widgets.
- [x] Default dashboard deletion blocked with `DEFAULT_DASHBOARD_UNDELETABLE` (403).
- [x] Full CRUD functionality for custom user-configured dashboards.
- [x] Optimistic locking enforcing `version` counter consistency (409 Conflict on mismatch).
- [x] Maximum 30 widgets ceiling enforced (`TOO_MANY_WIDGETS`).
- [x] Safe templated queries with strict prevention of raw SQL statements.
- [x] Seamless one-click dashboard cloning with distinct widget IDs.
- [x] Granular RBAC permissions with complete cross-tenant isolation.
- [x] Automated test matrix and race condition detection passing cleanly (`make ci`).
