# Strim — Phase 1 Manual Testing Guide
### Core Foundations, Auth, Multi-Tenancy & OpenAPI Documentation

This guide provides step-by-step commands to manually verify all deliverables of **Phase 1**.

---

## 🚀 Pre-requisites & Startup

1. Ensure the PostgreSQL and Redis containers are running:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```
2. Start the Strim API server:
   ```bash
   bun run --filter @strim/server dev
   ```
   *The server runs on `http://localhost:8080`.*

---

## 🧪 Test Suite 1: Authentication & Identity

### 1.1 Sign Up New User & Provision Tenant
```bash
curl -s -X POST http://localhost:8080/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-engineer@acme.test",
    "password": "SecurePassword123!",
    "name": "Test Engineer",
    "organizationName": "Acme Test Corp"
  }' | jq .
```
- **Expected Outcome**: `HTTP 201 Created`.
- **Response**: Returns `{ token: "...", user: { id: "...", email: "..." }, organization: { id: "...", name: "Acme Test Corp", role: "OWNER" } }`.
- Note the `token` and `organization.id` for subsequent tests:
  ```bash
  export TOKEN="<paste-token-here>"
  export ORG_ID="<paste-org-id-here>"
  ```

### 1.2 Log In with Email & Password
```bash
curl -s -X POST http://localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-engineer@acme.test",
    "password": "SecurePassword123!"
  }' | jq .
```
- **Expected Outcome**: `HTTP 200 OK` with user profile and list of organizations.

### 1.3 Introspect Current Profile
```bash
curl -s -X GET http://localhost:8080/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```
- **Expected Outcome**: Returns user details and affiliated organizations.

### 1.4 Test Google OAuth 2.0 Endpoints
**Get OAuth URL:**
```bash
curl -s -X GET http://localhost:8080/v1/auth/google/url | jq .
```
- **Expected Outcome**: Returns Google OAuth consent URL containing `client_id`, `redirect_uri`, and `scope`.

**Simulate Google OAuth Callback:**
```bash
curl -s -X POST http://localhost:8080/v1/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "mock_google_auth_code_for_testing@strim.test"
  }' | jq .
```
- **Expected Outcome**: `HTTP 200 OK` auto-provisioning a new Google-authenticated user and organization with an active JWT session.

### 1.5 Refresh Session Token
```bash
curl -s -X POST http://localhost:8080/v1/auth/refresh \
  -H "Authorization: Bearer $TOKEN" | jq .
```
- **Expected Outcome**: `HTTP 200 OK` with a refreshed JWT token extended by 7 days.

---

## 🏢 Test Suite 2: Multi-Tenancy & Directory Hierarchy

### 2.1 Fetch Context Hierarchy
```bash
curl -s -X GET http://localhost:8080/v1/org/context \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK` returning the full nested tree for this organization.

### 2.2 Create a Workspace
```bash
curl -s -X POST http://localhost:8080/v1/org/workspaces \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payments Infrastructure",
    "slug": "payments"
  }' | jq .
```
- **Expected Outcome**: `HTTP 201 Created`. Save the workspace ID:
  ```bash
  export WS_ID="<paste-workspace-id>"
  ```

### 2.3 Create a Project
```bash
curl -s -X POST http://localhost:8080/v1/org/workspaces/$WS_ID/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkout API",
    "slug": "checkout-api"
  }' | jq .
```
- **Expected Outcome**: `HTTP 201 Created`. Save the project ID:
  ```bash
  export PROJ_ID="<paste-project-id>"
  ```

### 2.4 Verify Cross-Tenant Isolation
Attempt to access this workspace using another organization's ID:
```bash
curl -s -i -X GET http://localhost:8080/v1/org/workspaces/$WS_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: random_alien_org_123"
```
- **Expected Outcome**: `HTTP 403 Forbidden` with `{ "error": "TENANT_MISMATCH", "message": "No access to this organization" }`. Cross-tenant data leak is strictly blocked.

---

## 🔑 Test Suite 3: Scoped API Keys

### 3.1 Create Scoped Ingestion Key
```bash
curl -s -X POST http://localhost:8080/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Telemetry Key",
    "scopes": ["telemetry:write"]
  }' | jq .
```
- **Expected Outcome**: `HTTP 201 Created` with a prefixed key: `{ prefix: "sk_...", secret: "sk_...", scopes: ["telemetry:write"] }`.
- Save the key ID:
  ```bash
  export KEY_ID="<paste-key-id>"
  ```

### 3.2 Verify Incompatible Scope Rejection
Attempt to combine telemetry ingestion with administrative write scopes:
```bash
curl -s -i -X POST http://localhost:8080/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dangerous Combined Key",
    "scopes": ["telemetry:write", "config:write"]
  }'
```
- **Expected Outcome**: `HTTP 400 Bad Request` with message: `"Do not combine telemetry:write with administrative write scopes on one key"`.

### 3.3 Revoke API Key
```bash
curl -s -X POST http://localhost:8080/v1/api-keys/$KEY_ID/revoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK` with non-null `revokedAt` timestamp.

---

## 📜 Test Suite 4: Immutable Audit Trail

### 4.1 Query Organization Audit Logs
```bash
curl -s -X GET http://localhost:8080/v1/audit \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq .
```
- **Expected Outcome**: `HTTP 200 OK` returning an ordered log of events (workspace creation, project creation, API key issuance) with actor ID and timestamps.

### 4.2 Verify Audit Immutability Protection
Attempt to update or delete an audit record:
```bash
curl -s -i -X PATCH http://localhost:8080/v1/audit/any_audit_id \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID"

curl -s -i -X DELETE http://localhost:8080/v1/audit/any_audit_id \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID"
```
- **Expected Outcome**: `HTTP 405 Method Not Allowed` with `{ "error": "FORBIDDEN", "message": "Audit records are immutable" }`.

---

## 📖 Test Suite 5: Interactive OpenAPI & Swagger Documentation

1. Open your browser and navigate to:
   - **Swagger UI**: [http://localhost:8080/swagger](http://localhost:8080/swagger)
   - **Scalar API Reference**: [http://localhost:8080/docs](http://localhost:8080/docs)
   - **Raw OpenAPI 3.1 JSON**: [http://localhost:8080/v1/openapi.json](http://localhost:8080/v1/openapi.json)
2. **Verification Checklist**:
   - [ ] All Authentication endpoints (`/v1/auth/*`) are listed with input/output models.
   - [ ] All Directory endpoints (`/v1/org/*`) are visible under "Directory & Tenancy".
   - [ ] All API Keys endpoints (`/v1/api-keys/*`) are visible under "API Keys".
   - [ ] All Audit endpoints (`/v1/audit/*`) are visible under "Audit Logs".
   - [ ] Click "Try it out" on `GET /v1/auth/google/url` or `GET /v1/org/context` to test live execution in Swagger.
