# Phase 2: Multi-Tenancy, Organizations, Members & RBAC - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test plan for **Phase 2: Users, Organizations, Members, RBAC & Multi-Tenancy** of the STRIM Labs backend.

---

## 🛠️ Environment Prerequisites

Set your target API base URL and prepare authentication variables:

```bash
export API_URL="http://localhost:8080"
export COOKIE_JAR="/tmp/strim_cookies_phase2.txt"
rm -f "$COOKIE_JAR"
```

Verify that the API server is healthy:

```bash
curl -i -X GET "${API_URL}/health"
```

---

## 1. Setup Test Accounts

Create and verify two accounts for testing tenant isolation and permissions:

### 1.1 Owner Account
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@acme.corp",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Ada",
    "last_name": "Lovelace"
  }' > /tmp/owner_signup.json

# Extract tokens and user ID
OWNER_TOKEN=$(cat /tmp/owner_signup.json | jq -r '.data.access_token')
OWNER_ID=$(cat /tmp/owner_signup.json | jq -r '.data.user.id')

# Verify Owner Email
curl -s -X POST "${API_URL}/v1/auth/otp/send" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"

# (Check console logs for the 6-digit OTP)
curl -s -X POST "${API_URL}/v1/auth/otp/verify" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"otp": "123456"}'
```

### 1.2 Team Member Account
```bash
curl -s -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "engineer@acme.corp",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Charles",
    "last_name": "Babbage"
  }' > /tmp/member_signup.json

MEMBER_TOKEN=$(cat /tmp/member_signup.json | jq -r '.data.access_token')
MEMBER_ID=$(cat /tmp/member_signup.json | jq -r '.data.user.id')

# Verify Member Email
curl -s -X POST "${API_URL}/v1/auth/otp/send" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}"

curl -s -X POST "${API_URL}/v1/auth/otp/verify" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"otp": "123456"}'
```

---

## 2. User Profile & One-Time Username Claiming

### 2.1 Public Availability Check (`GET /v1/users/username?u=...`)
```bash
# Check available username
curl -i -X GET "${API_URL}/v1/users/username?u=adalovelace"

# Check reserved username (must return available: false)
curl -i -X GET "${API_URL}/v1/users/username?u=admin"
```

### 2.2 Retrieve Current Profile (`GET /v1/users/me`)
```bash
curl -i -X GET "${API_URL}/v1/users/me" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```
**Expected HTTP Status**: `200 OK`

### 2.3 One-Time Username Claim (`POST /v1/users/username`)
```bash
curl -i -X POST "${API_URL}/v1/users/username" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"username": "adalovelace"}'
```
**Expected HTTP Status**: `200 OK`

### 2.4 Second Username Claim Attempt (Must Fail)
```bash
curl -i -X POST "${API_URL}/v1/users/username" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"username": "newusername"}'
```
**Expected HTTP Status**: `409 Conflict` (`error_code: USERNAME_ALREADY_SET`)

### 2.5 Update User Profile (`PUT /v1/users/update`)
```bash
curl -i -X PUT "${API_URL}/v1/users/update" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Augusta Ada", "last_name": "King"}'
```
**Expected HTTP Status**: `200 OK`

---

## 3. Organizations Lifecycle & Hard Limit of 3

### 3.1 Create 1st Organization (`POST /v1/organizations`)
```bash
curl -s -X POST "${API_URL}/v1/organizations" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Strim Labs Global",
    "slug": "strim-labs-global",
    "description": "Primary cloud workspace"
  }' > /tmp/org1.json

ORG_ID=$(cat /tmp/org1.json | jq -r '.data.id')
echo "Created Organization ID: ${ORG_ID}"
```
**Expected HTTP Status**: `201 Created`  
**Expected Response**: `role: owner`, `member_count: 1`

### 3.2 Reserved Slug Validation (Must Fail)
```bash
curl -i -X POST "${API_URL}/v1/organizations" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Admin Portal", "slug": "admin"}'
```
**Expected HTTP Status**: `400 Bad Request` (`error_code: RESERVED_SLUG`)

### 3.3 Duplicate Slug Validation (Must Fail)
```bash
curl -i -X POST "${API_URL}/v1/organizations" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Duplicate Org", "slug": "strim-labs-global"}'
```
**Expected HTTP Status**: `409 Conflict` (`error_code: SLUG_TAKEN`)

### 3.4 Create 2nd and 3rd Organizations
```bash
curl -s -X POST "${API_URL}/v1/organizations" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Strim Staging", "slug": "strim-staging"}'

curl -s -X POST "${API_URL}/v1/organizations" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Strim Dev", "slug": "strim-dev"}'
```
**Expected HTTP Status**: Both return `201 Created`

### 3.5 Attempting to Create a 4th Organization (Must Fail)
```bash
curl -i -X POST "${API_URL}/v1/organizations" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Strim Sandbox", "slug": "strim-sandbox"}'
```
**Expected HTTP Status**: `409 Conflict` (`error_code: ORG_LIMIT_REACHED`)

### 3.6 List Organizations (`GET /v1/organizations`)
```bash
curl -i -X GET "${API_URL}/v1/organizations" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```
**Expected HTTP Status**: `200 OK` (Array containing exactly 3 organizations)

---

## 4. Multi-Tenancy Isolation & Concealment

### 4.1 Cross-Tenant Access by Non-Member (`GET /v1/organizations/{orgID}`)
Accessing an organization by a user who is not a member:
```bash
curl -i -X GET "${API_URL}/v1/organizations/${ORG_ID}" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}"
```
**Expected HTTP Status**: `404 Not Found` (`error_code: NOT_FOUND`)  
> **Security Guarantee**: Non-members receive `404`, never `403`, eliminating tenant existence sniffing.

---

## 5. Members Management & RBAC Hierarchy

### 5.1 Add Member (`POST /v1/organizations/{orgID}/members`)
Owner adds Charles as a `member`:
```bash
curl -i -X POST "${API_URL}/v1/organizations/${ORG_ID}/members" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "engineer@acme.corp",
    "role": "member"
  }'
```
**Expected HTTP Status**: `201 Created`

### 5.2 Attempt to Add with `owner` Role (Must Fail)
```bash
curl -i -X POST "${API_URL}/v1/organizations/${ORG_ID}/members" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "another@acme.corp",
    "role": "owner"
  }'
```
**Expected HTTP Status**: `403 Forbidden` (`error_code: FORBIDDEN_ROLE`)

### 5.3 Member Accesses Organization Now
Now that Charles is a member, accessing the organization succeeds:
```bash
curl -i -X GET "${API_URL}/v1/organizations/${ORG_ID}" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}"
```
**Expected HTTP Status**: `200 OK`

### 5.4 RBAC Enforcement: Member Attempts Admin Action (Must Fail)
A regular `member` attempts to update organization settings:
```bash
curl -i -X PUT "${API_URL}/v1/organizations/${ORG_ID}" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacked Name"}'
```
**Expected HTTP Status**: `403 Forbidden` (`error_code: FORBIDDEN_ROLE`)

### 5.5 Promote Member to Admin (`PUT /v1/organizations/{orgID}/members/{userID}/role`)
Owner promotes Charles to `admin`:
```bash
curl -i -X PUT "${API_URL}/v1/organizations/${ORG_ID}/members/${MEMBER_ID}/role" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```
**Expected HTTP Status**: `200 OK`

### 5.6 Admin Immunity Rule: Admin Cannot Demote Owner (Must Fail)
Charles (now `admin`) attempts to demote Ada (`owner`):
```bash
curl -i -X PUT "${API_URL}/v1/organizations/${ORG_ID}/members/${OWNER_ID}/role" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"role": "viewer"}'
```
**Expected HTTP Status**: `403 Forbidden` (`error_code: FORBIDDEN_ROLE`)

### 5.7 Self-Modification Guard: Admin Cannot Change Own Role (Must Fail)
Charles attempts to change his own role:
```bash
curl -i -X PUT "${API_URL}/v1/organizations/${ORG_ID}/members/${MEMBER_ID}/role" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"role": "viewer"}'
```
**Expected HTTP Status**: `400 Bad Request` (`error_code: CANNOT_MODIFY_OWN_ROLE`)

### 5.8 Voluntary Leave (`POST /v1/organizations/{orgID}/members/leave`)
Charles voluntarily leaves the workspace:
```bash
curl -i -X POST "${API_URL}/v1/organizations/${ORG_ID}/members/leave" \
  -H "Authorization: Bearer ${MEMBER_TOKEN}"
```
**Expected HTTP Status**: `200 OK`

### 5.9 Sole Owner Leave Protection (Must Fail)
Ada (the only remaining owner) attempts to leave:
```bash
curl -i -X POST "${API_URL}/v1/organizations/${ORG_ID}/members/leave" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```
**Expected HTTP Status**: `422 Unprocessable Entity` (`error_code: LAST_OWNER`)

---

## 6. Organization Deletion with Confirmation

### 6.1 Mismatched Slug Confirmation (Must Fail)
```bash
curl -i -X DELETE "${API_URL}/v1/organizations/${ORG_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"confirm_slug": "wrong-slug"}'
```
**Expected HTTP Status**: `422 Unprocessable Entity` (`error_code: CONFIRMATION_MISMATCH`)

### 6.2 Valid Slug Confirmation (Soft Deletion)
```bash
curl -i -X DELETE "${API_URL}/v1/organizations/${ORG_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"confirm_slug": "strim-labs-global"}'
```
**Expected HTTP Status**: `200 OK`

### 6.3 Verification of Deletion
```bash
curl -i -X GET "${API_URL}/v1/organizations/${ORG_ID}" \
  -H "Authorization: Bearer ${OWNER_TOKEN}"
```
**Expected HTTP Status**: `404 Not Found`
