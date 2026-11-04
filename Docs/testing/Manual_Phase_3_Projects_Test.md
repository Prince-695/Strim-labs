# Phase 3: Projects & Target Domain Verification - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test plan for **Phase 3: Projects, Concurrency Limits, SSRF Protection & Domain Ownership Verification** of the STRIM Labs backend.

---

## 🛠️ Environment Prerequisites

Set your target API base URL:

```bash
export API_URL="http://localhost:8080"
export COOKIE_JAR="/tmp/strim_cookies_phase3.txt"
rm -f "$COOKIE_JAR"
```

Verify that the API server is healthy:

```bash
curl -i -X GET "${API_URL}/health"
```

---

## 1. Setup Test Accounts & Organization

Create and verify an owner account and setup an organization workspace:

### 1.1 Owner Account
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Alan",
    "last_name": "Turing"
  }' > /tmp/owner_signup.json

OWNER_TOKEN=$(cat /tmp/owner_signup.json | jq -r '.data.access_token')

# Send & verify email OTP (OTP printed in server logs or mock console mailer)
curl -s -X POST "${API_URL}/v1/auth/otp/send" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"

# Replace 123456 with the code logged in terminal
curl -s -X POST "${API_URL}/v1/auth/otp/verify" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"otp": "123456"}'
```

### 1.2 Create Organization
```bash
curl -s -X POST "${API_URL}/v1/organizations" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Strim Engineering",
    "slug": "strim-eng"
  }' > /tmp/org_created.json

ORG_ID=$(cat /tmp/org_created.json | jq -r '.data.id')
echo "Organization ID: ${ORG_ID}"
```

---

## 2. Project Creation & SSRF Guard Verification

### 2.1 Valid Public Project Creation
```bash
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkout API",
    "slug": "checkout-api",
    "description": "Order processing and payment service",
    "base_url": "https://api.github.com",
    "environment": "production"
  }' > /tmp/proj1.json

cat /tmp/proj1.json
PROJ_ID=$(cat /tmp/proj1.json | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Project ID: ${PROJ_ID}"
```
**Expected Response:** `201 Created` with `verification_status: "unverified"` and `health: "no_data"`.

### 2.2 SSRF Guard: Loopback & Private IP Rejection
Attempt to point a project to loopback or private ranges:
```bash
# 1. Loopback IP
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local Loopback",
    "slug": "local-loopback",
    "base_url": "http://127.0.0.1:8080"
  }'

# 2. Localhost Domain
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Localhost Test",
    "slug": "localhost-test",
    "base_url": "http://localhost:3000"
  }'

# 3. AWS / Cloud Metadata IP
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cloud Metadata Exploit",
    "slug": "cloud-metadata",
    "base_url": "http://169.254.169.254/latest/meta-data"
  }'
```
**Expected Response:** `422 Unprocessable Entity` with `error_code: "TARGET_BLOCKED"`.

---

## 3. Concurrency Control: Max 5 Projects Limit

Create additional projects until reaching the organization limit:

```bash
for i in {2..5}; do
  curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
    -H "Authorization: Bearer ${OWNER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Microservice $i\",
      \"slug\": \"microservice-$i\",
      \"base_url\": \"https://httpbin.org\"
    }"
  echo "Created project $i"
done
```

Attempt to create a 6th project:
```bash
curl -i -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Microservice 6 (Over Limit)",
    "slug": "microservice-6",
    "base_url": "https://httpbin.org"
  }'
```
**Expected Response:** `409 Conflict` with `error_code: "PROJECT_LIMIT_REACHED"`.

---

## 4. Project Retrieval & Caching

### 4.1 List Projects
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Expected Response:** Returns an array of exactly 5 projects with `endpoint_count: 0` and `health: "no_data"`.

### 4.2 Get Project Detail
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Expected Response:** Returns project metadata plus rolling statistics:
```json
{
  "stats_1h": {
    "requests": 0,
    "p95_ms": 0,
    "error_rate": 0
  }
}
```

---

## 5. Project Update & Verification Host Invalidation

Update project name and description:
```bash
curl -s -X PUT "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkout API v2",
    "description": "Updated payments pipeline"
  }' | jq .
```

Change project `base_url` host:
```bash
curl -s -X PUT "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "base_url": "https://httpbin.org"
  }' | jq .
```
**Expected Behavior:** Changing the hostname automatically resets `verification_status` to `"unverified"` and clears `verified_at`.

---

## 6. Domain Ownership Verification Flow

### 6.1 Initiate Verification Challenge
```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/verification" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"method": "dns"}' | jq .
```
**Expected Response:** `201 Created` with:
- `status`: `"pending"`
- `token`: `"strim-verify=..."`
- `instructions.dns`: `{ "type": "TXT", "host": "_strim.<host>", "value": "strim-verify=..." }`
- `instructions.file`: `{ "url": "https://<host>/.well-known/strim-verify.txt", "content": "..." }`

### 6.2 Check Verification Immediately (Unconfigured)
```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/verification/check" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Expected Response:** `200 OK` with:
- `status`: `"failed"`
- `reason`: `"No TXT records found at _strim.<host> or <host>"`

### 6.3 Get Verification Status
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/verification" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```

---

## 7. Project Deletion

Delete a project:
```bash
curl -i -s -X DELETE "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```
**Expected Response:** `200 OK` with message `"Project deleted successfully"`.

Subsequent access returns `404 Not Found`:
```bash
curl -i -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```

Now you can create another project since the active count dropped back to 4!

---

## 8. Multi-Tenancy & Zero Enumeration

Non-members attempting to access projects in an organization they do not belong to receive `404 NOT_FOUND` (preventing ID harvesting).
