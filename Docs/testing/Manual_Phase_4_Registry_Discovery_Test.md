# Phase 4: API Registry & Discovery - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test guide for **Phase 4: API Registry, Path Normalization, OpenAPI Importers, Route Manifests & Discovery Runs** of the STRIM Labs backend.

---

## 🛠️ Environment Prerequisites

Set your target API base URL:

```bash
export API_URL="http://localhost:8080"
export COOKIE_JAR="/tmp/strim_cookies_phase4.txt"
rm -f "$COOKIE_JAR"
```

Verify that the API server is healthy:

```bash
curl -i -X GET "${API_URL}/health"
```

---

## 1. Setup Test Account, Organization & Project

Create and verify an owner account, setup an organization, and create a project:

### 1.1 Owner Account & Email Verification
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Grace",
    "last_name": "Hopper"
  }' > /tmp/owner_signup.json

OWNER_TOKEN=$(cat /tmp/owner_signup.json | jq -r '.data.access_token')

# Request and verify OTP code (printed in server logs or mock mailer)
curl -s -X POST "${API_URL}/v1/auth/otp/send" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"

# Replace 123456 with the logged OTP code
curl -s -X POST "${API_URL}/v1/auth/otp/verify" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"otp": "123456"}'
```

### 1.2 Create Organization & Target Project
```bash
# Create Organization
curl -s -X POST "${API_URL}/v1/organizations" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Core Platform",
    "slug": "acme-core"
  }' > /tmp/org.json

ORG_ID=$(cat /tmp/org.json | jq -r '.data.id')

# Create Project
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-Commerce Gateway",
    "slug": "ecommerce-gateway",
    "base_url": "https://api.github.com",
    "environment": "production"
  }' > /tmp/proj.json

PROJ_ID=$(cat /tmp/proj.json | jq -r '.data.id')
echo "Organization ID: ${ORG_ID}"
echo "Project ID: ${PROJ_ID}"
```

---

## 2. Ingest via OpenAPI Specification

### 2.1 Multipart Spec File Upload
Create a sample OpenAPI 3.0 specification file and import it:

```bash
cat << 'EOF' > /tmp/store_openapi.json
{
  "openapi": "3.0.0",
  "info": { "title": "Store Service", "version": "1.0.0" },
  "paths": {
    "/products": {
      "get": {
        "operationId": "listProducts",
        "tags": ["catalog", "public"],
        "summary": "List all products"
      },
      "post": {
        "operationId": "createProduct",
        "tags": ["catalog", "admin"],
        "summary": "Create product"
      }
    },
    "/products/{id}": {
      "get": {
        "operationId": "getProduct",
        "tags": ["catalog"],
        "summary": "Get product details"
      },
      "delete": {
        "operationId": "deleteProduct",
        "tags": ["catalog", "admin"]
      }
    }
  }
}
EOF

curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/discovery/openapi" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -F "file=@/tmp/store_openapi.json" | jq .
```
**Expected Response:** `200 OK` with:
- `status`: `"completed"`
- `source`: `"openapi"`
- `found`: `4`
- `created`: `4`
- `updated`: `0`

---

## 3. Ingest via Route Manifest

### 3.1 Manual Route Manifest Upload
Import routes declared in a route manifest v1 JSON format. Notice how dynamic path `/orders/123/items` is automatically normalized to `/orders/{id}/items`:

```bash
curl -s -X POST "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/discovery/manifest" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "source": "manifest",
    "service": "orders",
    "commit": "a1b2c3d",
    "routes": [
      { "method": "GET", "path": "/orders/{id}", "tags": ["orders"] },
      { "method": "POST", "path": "/orders/123/items", "tags": ["checkout"] }
    ]
  }' | jq .
```
**Expected Response:** `200 OK` with `created: 2`, `found: 2`.

---

## 4. Ingest via CI Scanner Endpoint

Simulate a CI pipeline posting discovered routes to `/v1/ingest/discovery`:

```bash
curl -s -X POST "${API_URL}/v1/ingest/discovery" \
  -H "X-Project-ID: ${PROJ_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "source": "ci",
    "service": "billing",
    "commit": "9f8e7d6",
    "branch": "main",
    "repo": "acme/billing",
    "routes": [
      { "method": "POST", "path": "/invoices/pay", "tags": ["billing", "payments"] }
    ]
  }' | jq .
```
**Expected Response:** `200 OK` with `source: "ci"`.

---

## 5. Explore & Filter the API Registry

### 5.1 List All Endpoints
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/endpoints" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Expected Response:** Returns all 7 discovered endpoints across services (`store-service`, `orders`, `billing`) with their respective tags, sources, and rolling `stats_1h`.

### 5.2 Filter by HTTP Method
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/endpoints?method=POST" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq '.data[].path_template'
```
**Expected Output:** Only POST endpoints (`/products`, `/orders/{id}/items`, `/invoices/pay`).

### 5.3 Filter by Discovery Source
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/endpoints?source=ci" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq '.data[].path_template'
```
**Expected Output:** Only endpoints discovered via CI (`/invoices/pay`).

### 5.4 Search Route Name
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/endpoints?q=product" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq '.data[].path_template'
```

### 5.5 Keyset Cursor Pagination
```bash
# Retrieve first 2 endpoints
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/endpoints?limit=2" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" > /tmp/page1.json

cat /tmp/page1.json | jq '.meta'
NEXT_CURSOR=$(cat /tmp/page1.json | jq -r '.meta.next_cursor')

# Retrieve next page using cursor
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/endpoints?limit=2&cursor=${NEXT_CURSOR}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq '.data[].path_template'
```

---

## 6. Inspect & Patch Endpoint Metadata

Get ID of one endpoint:
```bash
EP_ID=$(cat /tmp/page1.json | jq -r '.data[0].id')
echo "Target Endpoint ID: ${EP_ID}"
```

### 6.1 View Endpoint Detail with Source Provenance
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/endpoints/${EP_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Expected Output:** Detailed response showing `sources_detail` (first seen, last seen, metadata) and rolling stats.

### 6.2 Patch Tags, Note, and Status
```bash
curl -s -X PATCH "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/endpoints/${EP_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ignored",
    "note": "Internal only route; excluded from external testing",
    "tags": ["internal", "v1"]
  }' | jq .
```
**Expected Output:** Endpoint reflects `status: "ignored"`, updated note, and updated tags.

### 6.3 Reject Setting 'stale' Manually
Attempt to set status to `stale` (system-only status):
```bash
curl -i -s -X PATCH "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/endpoints/${EP_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "stale"}'
```
**Expected Response:** `400 Bad Request` ("Users can only toggle status between 'active' and 'ignored'").

---

## 7. Audit History: Discovery Runs

List historical discovery runs:
```bash
curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJ_ID}/discovery/runs" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" | jq .
```
**Expected Output:** Array of completed discovery runs showing `found`, `created`, `updated`, and execution timestamps.
