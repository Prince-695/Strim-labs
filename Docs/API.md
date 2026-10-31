# STRIM Labs: API Design

Companion to `PRD.md` and `Implementation_phases.md`. This is the contract between backend and frontend. Swagger (generated from annotations) must always match this document.

**Base URL:** `https://api.strimlabs.dev` (local: `http://localhost:8080`)
**Version prefix:** `/v1`
**Format:** JSON, `snake_case`, UTF-8
**Docs UI:** `/swagger/index.html` (Basic Auth)

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Shared Objects](#2-shared-objects)
3. [Auth APIs](#3-authentication-apis)
4. [User APIs](#4-user-apis)
5. [Organization APIs](#5-organization-apis)
6. [Member APIs](#6-member-apis)
7. [Project APIs](#7-project-apis)
8. [Registry and Discovery APIs](#8-registry-and-discovery-apis)
9. [Ingestion APIs](#9-ingestion-apis)
10. [Metrics APIs](#10-metrics-apis)
11. [Load Test APIs](#11-load-test-apis)
12. [Capacity and Compare APIs](#12-capacity-and-compare-apis)
13. [Diagnostics APIs](#13-diagnostics-apis)
14. [Dashboard APIs](#14-dashboard-apis)
15. [Alert, Incident, Channel APIs](#15-alert-incident-and-channel-apis)
16. [API Key and Webhook APIs](#16-api-key-and-webhook-apis)
17. [Audit and Usage APIs](#17-audit-and-usage-apis)
18. [System APIs](#18-system-apis)
19. [SSE Contracts](#19-sse-contracts)
20. [Rate Limits](#20-rate-limits)
21. [Permissions Matrix](#21-permissions-matrix)
22. [Error Catalog](#22-error-catalog)
23. [Swagger Rules and Templates](#23-swagger-rules-and-templates)
24. [Design Checklist](#24-design-checklist-for-every-new-endpoint)

---

## 1. Conventions

### 1.1 Authentication Modes

| Mode | How | Used by |
|---|---|---|
| **User session** | `Authorization: Bearer <access_token>` **or** `access_token` HttpOnly cookie | Dashboard, Swagger |
| **Project API key** | `X-API-Key: strim_live_xxxxxxxx` | Ingestion, CI scanner |
| **Public** | none | signup, login, username check, OAuth |

Token lookup order: Bearer header → (if `Referer` contains `/swagger/`, stop: no cookie fallback) → cookie.

### 1.2 URL Rules

- Plural nouns, lowercase, kebab-case: `/load-tests`, `/api-keys`.
- Nesting follows ownership: `/v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID}`.
- Actions that are not CRUD use a verb sub-path with `POST`: `/stop`, `/rerun`, `/acknowledge`.
- IDs are UUIDs. A resource outside your tenant returns `404`, never `403`.
- No trailing slashes.

Prefix used in this document:

```
{ORG}  = /v1/organizations/{orgID}
{PRJ}  = /v1/organizations/{orgID}/projects/{projectID}
```

### 1.3 Universal Envelope

Every response, success or error, has this shape.

```go
type Response struct {
    Success      bool        `json:"success"`
    Message      string      `json:"message,omitempty"`
    AccessToken  string      `json:"access_token,omitempty"`
    Data         interface{} `json:"data,omitempty"`
    Error        string      `json:"error,omitempty"`
    ErrorCode    string      `json:"error_code,omitempty"`
    Details      interface{} `json:"details,omitempty"`
    Meta         *PageMeta   `json:"meta,omitempty"`
    RequestID    string      `json:"request_id,omitempty"`
    ResponseTime string      `json:"response_time"`
}

type PageMeta struct {
    Limit      int    `json:"limit"`
    NextCursor string `json:"next_cursor,omitempty"`
    HasMore    bool   `json:"has_more"`
    Total      *int   `json:"total,omitempty"` // only where cheap
}
```

**Success example**

```json
{
  "success": true,
  "data": { "id": "0192f1b2-7c1e-7a3b-9d0a-3f5b6c7d8e9f", "name": "Acme Corp" },
  "request_id": "req_01JABCXYZ",
  "response_time": "12.4ms"
}
```

**Error example**

```json
{
  "success": false,
  "error": "You can belong to at most 3 organizations.",
  "error_code": "ORG_LIMIT_REACHED",
  "request_id": "req_01JABCXYZ",
  "response_time": "3.1ms"
}
```

**Validation error example** (`400`)

```json
{
  "success": false,
  "error": "Validation failed",
  "error_code": "VALIDATION_FAILED",
  "details": [
    { "field": "slug", "rule": "min", "message": "slug must be at least 2 characters" },
    { "field": "name", "rule": "required", "message": "name is required" }
  ],
  "request_id": "req_01JABCXYZ",
  "response_time": "1.9ms"
}
```

### 1.4 Pagination (cursor based)

Request: `?limit=50&cursor=<opaque>` (default 50, max 200). Response `meta.next_cursor` is passed back as `cursor`. Cursors are opaque base64 and must not be parsed by clients.

### 1.5 Sorting and Filtering

`?sort=-created_at` (prefix `-` = descending). Allowed sort fields are listed per endpoint. Filters use plain query params (`?status=running&method=GET`). Unknown params are ignored; invalid values return `400`.

### 1.6 Time Parameters

Either `range` or `from` + `to`:

| Param | Example | Notes |
|---|---|---|
| `range` | `15m`, `1h`, `6h`, `24h`, `7d`, `30d` | Relative to now |
| `from`, `to` | `2026-11-01T10:00:00Z` | RFC 3339 UTC, `to` > `from` |
| `step` | `10s`, `1m`, `5m`, `1h` | Optional; server picks a sane default and may raise it to keep ≤ 500 points |

### 1.7 Headers

| Header | Direction | Purpose |
|---|---|---|
| `X-Request-ID` | in/out | Correlation ID; generated if absent |
| `Idempotency-Key` | in | Safe retries for `POST /load-tests`, webhook redeliver |
| `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` | out | Rate limit state |
| `Retry-After` | out | On `429` and `503` |
| `ETag` / `If-Match` | in/out | Optional on dashboards and alert rules (alternative to `version`) |
| `Content-Encoding: gzip` | in | Accepted on ingest endpoints |

### 1.8 Concurrency Control

Mutable config resources (`dashboards`, `alert-rules`) carry `version` (integer). `PUT` must send the current `version`; mismatch returns `409 VERSION_CONFLICT` with the latest object in `details`.

### 1.9 Status Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created (also `Location` header) |
| 202 | Accepted (async work queued) |
| 204 | No content (rarely used; envelope is preferred, so we return 200 with message) |
| 400 | Malformed or validation failure |
| 401 | Missing, invalid or expired credentials |
| 403 | Authenticated, role too low (only inside a tenant you belong to) |
| 404 | Not found or not yours |
| 409 | Conflict, limit reached, duplicate, version mismatch |
| 422 | Business rule violation |
| 429 | Rate limited |
| 500 / 503 | Server error / overloaded |

### 1.10 Cookies

| Cookie | Content | Flags | TTL |
|---|---|---|---|
| `access_token` | JWT | HttpOnly, Secure, SameSite=Lax, Path=/ | 15 min |
| `refresh_token` | Opaque random string | HttpOnly, Secure, SameSite=Lax, Path=/v1/auth | 7 days |

Mutating requests authenticated by cookie must carry an `Origin` header that matches the allowlist (CSRF protection).

---

## 2. Shared Objects

Fields shown are the response shape. Timestamps are RFC 3339 UTC.

### User
```json
{
  "id": "uuid", "email": "dev@acme.com", "first_name": "Asha", "last_name": "Patel",
  "username": "asha", "is_verified": true, "created_at": "2026-11-01T10:00:00Z"
}
```

### Organization
```json
{
  "id": "uuid", "name": "Acme Corp", "slug": "acme-corp", "description": "Building the future",
  "role": "owner", "member_count": 3, "project_count": 2, "created_at": "…"
}
```
`role` is the caller's role in that org.

### OrgMemberDetail
```json
{
  "user_id": "uuid", "email": "x@acme.com", "first_name": "Ravi", "last_name": "Shah",
  "username": "ravi", "role": "member", "joined_at": "…"
}
```

### Project
```json
{
  "id": "uuid", "org_id": "uuid", "name": "Checkout API", "slug": "checkout-api",
  "description": "", "base_url": "https://api.acme.com", "environment": "production",
  "verification_status": "verified", "endpoint_count": 42, "health": "healthy",
  "created_at": "…", "updated_at": "…"
}
```
`environment`: `development | staging | production`. `health`: `healthy | degraded | failing | no_data`.

### Endpoint (registry item)
```json
{
  "id": "uuid", "method": "POST", "path_template": "/orders/{id}/items",
  "service": "orders", "tags": ["checkout"], "status": "active",
  "sources": ["openapi", "runtime"], "first_seen": "…", "last_seen": "…",
  "stats_1h": { "requests": 12044, "rps": 3.3, "p95_ms": 182, "error_rate": 0.004 }
}
```
`status`: `active | stale | ignored`. `sources`: `openapi | ci | manifest | runtime`.

### MetricSummary
```json
{
  "requests": 120440, "rps": 33.4, "success_rate": 0.991, "error_rate": 0.009, "timeouts": 12,
  "latency_ms": { "p50": 42, "p95": 180, "p99": 420, "avg": 61, "max": 2300 },
  "status_codes": { "2xx": 119000, "3xx": 0, "4xx": 900, "5xx": 540 }
}
```

### LoadTest
```json
{
  "id": "uuid", "name": "Checkout ramp", "status": "running",
  "config": { "…see 11.1…" },
  "summary": null,
  "created_by": "uuid", "created_at": "…", "started_at": "…", "finished_at": null,
  "flags": { "generator_saturated": false }
}
```
`status`: `queued | running | completed | failed | stopped`.

### CapacityReport
```json
{
  "test_id": "uuid", "sustainable_rps": 420, "breaking_point_rps": 560,
  "reason": "latency", "confidence": "high",
  "thresholds": { "p95_multiplier": 2.0, "max_error_rate": 0.01, "min_achieved_ratio": 0.95 },
  "baseline_p95_ms": 85,
  "summary_text": "Handles about 420 RPS. Starts failing at 560 RPS because p95 latency passes 2x baseline.",
  "windows": [ { "offered_rps": 400, "achieved_rps": 399, "p95_ms": 90, "error_rate": 0.0, "healthy": true } ]
}
```
`reason`: `latency | errors | saturation | not_reached`. `confidence`: `high | medium | low`.

---

## 3. Authentication APIs

Prefix `/v1/auth`. Tag: **Auth**.

### 3.1 `POST /v1/auth/signup`
Public, rate limit 5/min per IP.

Request
```json
{ "email": "dev@acme.com", "password": "S3cure!pass", "first_name": "Asha", "last_name": "Patel" }
```
Rules: email valid and unique (case-insensitive); password 8 to 72 chars, not in common list; names 1 to 50 chars.

Response `201`: sets both cookies; body:
```json
{
  "success": true,
  "message": "Account created. Please verify your email.",
  "access_token": "eyJhbGciOi…",
  "data": { "user": { "…User…" }, "refresh_token": "opaque…" },
  "response_time": "88ms"
}
```
Errors: `400 VALIDATION_FAILED`, `409 EMAIL_TAKEN`, `429 RATE_LIMITED`.

### 3.2 `POST /v1/auth/login`
Public, 5/min.

Request `{ "email": "dev@acme.com", "password": "…" }`
Response `200`: same body as signup. Errors: `401 INVALID_CREDENTIALS` (same message for unknown email and wrong password), `429`.
After 10 failed attempts for an account in 15 minutes: `429 ACCOUNT_LOCKED` with `Retry-After`.

### 3.3 `POST /v1/auth/refresh`
Public (needs refresh token).

Request: cookie `refresh_token`, or body `{ "refresh_token": "…" }`.
Behavior: validates, **rotates** (old token marked used, new issued), returns a new access token and sets new cookies.
Errors: `401 TOKEN_EXPIRED`, `401 TOKEN_REUSED` (whole session family revoked; user must log in again).

### 3.4 `POST /v1/auth/logout`
User. Revokes refresh token in DB, adds access token `jti` to the in-memory denylist until expiry, clears cookies. Response `200 { "success": true, "message": "Logged out" }`. Always succeeds even if the token is already expired.

### 3.4 `GET /v1/auth/me`
User. Response:
```json
{ "success": true, "data": { "user": { "…User…" }, "is_verified": true, "session_id": "uuid", "expires_at": "…" } }
```

### 3.5 `POST /v1/auth/forgot-password`
Public, 5/min. Request `{ "email": "…" }`. Always returns `200` with the same message whether or not the email exists ("If the account exists, a code was sent"). OTP: 6 digits, valid 10 min, resend cooldown 60 s.

### 3.6 `POST /v1/auth/reset-password`
Public, 5/min. Request `{ "email": "…", "otp": "123456", "new_password": "…" }`. Revokes all sessions. Errors: `400 OTP_INVALID`, `400 OTP_EXPIRED`, `429 OTP_ATTEMPTS_EXCEEDED` (5 tries).

### 3.7 `POST /v1/auth/change-password`
User, 5/min. Request `{ "old_password": "…", "new_password": "…" }`. Revokes all other sessions; current stays. Errors: `400 INVALID_PASSWORD`.

### 3.8 `POST /v1/auth/otp/send`
User, 5/min. Sends email-verification OTP. `409 ALREADY_VERIFIED` if verified.

### 3.9 `POST /v1/auth/otp/verify`
User, 5/min. Request `{ "otp": "123456" }`. Sets `is_verified = true`. Response returns refreshed user.

### 3.10 `GET /v1/auth/{provider}/login`
Public. `provider` = `google | github`. Query `origin` (must be in allowlist). Response `200 { "data": { "url": "https://accounts.google.com/…" } }`. State and PKCE verifier stored in a signed short-lived cookie.

### 3.11 `GET /v1/auth/{provider}/callback`
Public. Query `code`, `state`. Verifies state, exchanges code, finds or creates user (links by verified email), sets cookies, `302` redirect to `{origin}/oauth/callback?status=success`. On failure redirect with `?status=error&code=…`.

### 3.12 `GET /v1/auth/sessions` (P1)
User. Lists active sessions: id, user agent, IP, created_at, last_used_at, `current: bool`.

### 3.13 `DELETE /v1/auth/sessions/{sessionID}` (P1)
User. Revokes one session.

---

## 4. User APIs

Prefix `/v1/users`. Tag: **Users**.

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | `/username?u=asha` | Public | query `u` | `{ "username": "asha", "available": false }` |
| GET | `/me` | User | none | `User` |
| POST | `/username` | Verified | `{ "username": "asha" }` | `User` |
| PUT | `/update` | Verified | `{ "first_name": "…", "last_name": "…" }` | `User` |

Username rules: 3 to 20 chars, `[a-z0-9_]`, starts with a letter, not reserved, case-insensitive unique. One-time: second call returns `409 USERNAME_ALREADY_SET`. Taken: `409 USERNAME_TAKEN`.

---

## 5. Organization APIs

Prefix `/v1/organizations`. Tag: **Organizations**. All require **Verified**.

### 5.1 `POST /v1/organizations`
Request
```json
{ "name": "Acme Corp", "slug": "acme-corp", "description": "Building the future" }
```
Rules: name 2 to 100; slug 2 to 50, `[a-z0-9-]`, no leading or trailing dash, not reserved (`admin`, `api`, `app`, `www`, `settings`, ...); description ≤ 500.
Behavior (one transaction): lock user (advisory lock) → count memberships → if ≥ 3 reject → insert org → insert owner membership.
Response `201 data: Organization`. Errors: `409 ORG_LIMIT_REACHED`, `409 SLUG_TAKEN`.

### 5.2 `GET /v1/organizations`
Lists the caller's orgs with `role`. Max 3 items, so no pagination.

### 5.3 `GET /v1/organizations/{orgID}`
viewer+. Response `Organization`.

### 5.4 `PUT /v1/organizations/{orgID}`
admin+. Request `{ "name": "…", "description": "…" }`. Slug is immutable in v1.

### 5.5 `DELETE /v1/organizations/{orgID}`
owner only. Request body `{ "confirm_slug": "acme-corp" }` (must equal slug; protects against accidents). Soft delete, cascade purge after 7 days. Errors: `422 CONFIRMATION_MISMATCH`.

---

## 6. Member APIs

Prefix `{ORG}/members`. Tag: **Members**.

### 6.1 `POST {ORG}/members` (admin+)
Request `{ "email": "ravi@acme.com", "role": "member" }` (`admin | member | viewer`; owners cannot be created here).
Rules: user must exist (`404 USER_NOT_FOUND`); not already a member (`409 ALREADY_MEMBER`); target must be in fewer than 3 orgs (`409 TARGET_ORG_LIMIT_REACHED`); admins and owners may both add `admin` members; the `owner` role can never be assigned through this route.
Response `201 data: OrgMemberDetail`.

### 6.2 `GET {ORG}/members` (viewer+)
Query `role`, `q` (name or email search), `limit`, `cursor`. Sort `joined_at`.

### 6.3 `PUT {ORG}/members/{userID}/role` (admin+)
Request `{ "role": "admin" }`.
Rules: cannot change an owner's role; cannot change your own role; at least one owner must remain (`422 LAST_OWNER`). Ownership transfer is a separate P2 endpoint.

### 6.4 `DELETE {ORG}/members/{userID}` (admin+)
Rules: cannot remove an owner (`403 FORBIDDEN_ROLE`); removing yourself uses `/members/leave`.

### 6.5 `POST {ORG}/members/leave` (member+, P1)
Caller leaves. `422 LAST_OWNER` if sole owner.

### 6.6 `POST {ORG}/invitations` (admin+, P1)
Request `{ "email": "new@person.com", "role": "viewer" }`. Sends a signed link valid 7 days. Accepting counts toward the 3-org limit at accept time.

---

## 7. Project APIs

Prefix `{ORG}/projects`. Tag: **Projects**.

### 7.1 `POST {ORG}/projects` (admin+)
Request
```json
{
  "name": "Checkout API", "slug": "checkout-api", "description": "Orders and payments",
  "base_url": "https://api.acme.com", "environment": "production"
}
```
Rules: max **5** projects per org (`409 PROJECT_LIMIT_REACHED`); slug unique inside org; `base_url` must be `http(s)`, no credentials in URL, host must not resolve to a private or internal address (`422 TARGET_BLOCKED`).
Response `201 data: Project` (verification_status `unverified`).

### 7.2 `GET {ORG}/projects` (viewer+)
Returns up to 5 items with `health` and `endpoint_count`.

### 7.3 `GET {PRJ}` (viewer+)
Project plus quick stats:
```json
{ "…Project…": "", "stats_1h": { "requests": 0, "p95_ms": 0, "error_rate": 0 }, "last_event_at": "…", "last_test": { "id": "uuid", "status": "completed" } }
```

### 7.4 `PUT {PRJ}` (admin+)
Request: any of `name`, `description`, `base_url`, `environment`. Changing `base_url` host resets verification to `unverified`.

### 7.5 `DELETE {PRJ}` (admin+)
Soft delete, purge after 7 days. Running tests are stopped first.

### 7.6 Verification

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `{PRJ}/verification` | admin+ | Start; returns instructions |
| POST | `{PRJ}/verification/check` | admin+ | Run the check now |
| GET | `{PRJ}/verification` | viewer+ | Current status |

`POST {PRJ}/verification` request `{ "method": "dns" }` (`dns | file | header`). Response:
```json
{
  "success": true,
  "data": {
    "status": "pending", "method": "dns", "token": "strim-verify=8f3a9c…",
    "instructions": {
      "dns": { "type": "TXT", "host": "_strim.api.acme.com", "value": "strim-verify=8f3a9c…" },
      "file": { "url": "https://api.acme.com/.well-known/strim-verify.txt", "content": "8f3a9c…" }
    },
    "expires_at": "…"
  }
}
```
Check result: `status` = `verified | pending | failed`, with `reason` (e.g. `TXT record not found`). Verified status is valid for 30 days.

---

## 8. Registry and Discovery APIs

Tags: **Registry**, **Discovery**.

### 8.1 `GET {PRJ}/endpoints` (viewer+)
Query: `q`, `method`, `tag`, `source`, `status`, `service`, `sort` (`path_template`, `-last_seen`, `-requests_1h`, `-p95_1h`), `limit`, `cursor`.
Response: list of `Endpoint` with `meta`.

### 8.2 `GET {PRJ}/endpoints/{endpointID}` (viewer+)
`Endpoint` plus `sources_detail` (per source: first/last seen, metadata) and `stats_24h`.

### 8.3 `PATCH {PRJ}/endpoints/{endpointID}` (member+)
Request (any): `{ "tags": ["checkout"], "status": "ignored", "note": "internal only" }`. Only `active ↔ ignored` can be set by users.

### 8.4 `POST {PRJ}/discovery/openapi` (admin+)
`multipart/form-data` with `file` (≤ 5 MB) **or** JSON `{ "url": "https://api.acme.com/openapi.json" }` (SSRF-guarded fetch).
Response `202`:
```json
{ "data": { "run_id": "uuid", "status": "running" } }
```
For small specs it may finish inline and return `200` with counts.

### 8.5 `POST {PRJ}/discovery/manifest` (admin+)
Request (manifest v1):
```json
{
  "version": 1, "source": "manual", "service": "orders",
  "routes": [
    { "method": "GET", "path": "/orders/{id}", "tags": ["orders"] },
    { "method": "POST", "path": "/orders" }
  ]
}
```
Response `200 data: { "run_id": "uuid", "found": 2, "created": 2, "updated": 0 }`.

### 8.6 `GET {PRJ}/discovery/runs` (viewer+)
Items: `{ id, source, status, found, created, updated, error, started_at, finished_at }`.

### 8.7 `POST /v1/ingest/discovery` (API key, scope `discovery`)
Same body as manifest plus CI context:
```json
{
  "version": 1, "source": "ci", "service": "orders",
  "commit": "a1b2c3d", "branch": "main", "repo": "acme/orders",
  "routes": [ { "method": "GET", "path": "/orders/{id}" } ]
}
```
Project is inferred from the key. Response `200` with counts.

---

## 9. Ingestion APIs

Tag: **Ingestion**. Auth: `X-API-Key` with scope `ingest`. These are the **hot path**: keep them tiny and fast.

### 9.1 `POST /v1/ingest/events`
Headers: `X-API-Key`, `Content-Type: application/json`, optional `Content-Encoding: gzip`.
Limits: ≤ 1,000 events, ≤ 1 MB (after decompression ≤ 5 MB).

Request
```json
{
  "service": "orders",
  "events": [
    {
      "ts": "2026-11-01T10:00:00.123Z",
      "method": "GET",
      "path": "/orders/123",
      "route": "/orders/{id}",
      "status": 200,
      "duration_ms": 41.7,
      "bytes": 1820,
      "error": false
    }
  ]
}
```
Field rules: `ts` optional (defaults to server time; rejected if > 5 min in the future or > 24 h in the past); `route` optional (server normalizes `path` if absent); `status` 100 to 599 (`0` = connection failed or timeout); `duration_ms` ≥ 0.

Response `202`:
```json
{ "success": true, "data": { "accepted": 998, "rejected": 2, "errors": [ { "index": 4, "reason": "invalid status" } ] } }
```
Backpressure: `429` or `503` with `Retry-After: 2`, error code `INGEST_BACKPRESSURE`. Clients must retry with backoff and cap their own buffers.

### 9.2 `POST /v1/ingest/host-metrics` (P1)
```json
{
  "host": "web-1",
  "samples": [
    { "ts": "…", "cpu_percent": 61.2, "mem_used_bytes": 1234567890, "mem_total_bytes": 4000000000,
      "net_rx_bytes": 123456, "net_tx_bytes": 654321, "disk_used_percent": 42.5 }
  ]
}
```
Response `202` with accepted count. Limit 600 samples per call.

---

## 10. Metrics APIs

Prefix `{PRJ}/metrics`. Tag: **Metrics**. Role viewer+. All accept the time params from 1.6.

### 10.1 `GET {PRJ}/metrics/overview`
Query: `range`, optional `endpoint_id`. Returns `MetricSummary` plus `previous` (same length period before) for trend arrows.

### 10.2 `GET {PRJ}/metrics/timeseries`
Query: `metric` (`rps | requests | p50 | p95 | p99 | avg | error_rate | success_rate | timeouts`), `range`, `step`, `endpoint_id` (optional), `group_by` (optional: `endpoint | status_class`).
```json
{
  "data": {
    "metric": "p95", "unit": "ms", "step": "1m",
    "series": [
      { "key": "all", "points": [ ["2026-11-01T10:00:00Z", 182.0], ["2026-11-01T10:01:00Z", 190.5] ] }
    ]
  }
}
```
Points are `[timestamp, value]`; missing buckets are `null`, never fabricated as zero.

### 10.3 `GET {PRJ}/metrics/endpoints`
Query: `range`, `sort` (`-requests`, `-p95`, `-error_rate`), `limit`, `cursor`, `q`.
Each item: `endpoint_id`, `method`, `path_template`, `MetricSummary` subset, `health`.

### 10.4 `GET {PRJ}/metrics/status-codes`
`{ "classes": {"2xx": n, …}, "codes": [ { "status": 404, "count": 12 } ] }`

### 10.5 `GET {PRJ}/metrics/hosts`
Query: `range`, `host`, `metric` (`cpu | memory | network | disk`). Empty `series` with `connected: false` when no agent has reported.

### 10.6 `GET {PRJ}/metrics/stream`: SSE, see section 19.

---

## 11. Load Test APIs

Prefix `{PRJ}/load-tests`. Tag: **LoadTests**.

### 11.1 `POST {PRJ}/load-tests` (member+)
Headers: `Idempotency-Key` (recommended).

Request
```json
{
  "name": "Checkout ramp",
  "model": "open",
  "profile": "ramp",
  "targets": [
    {
      "endpoint_id": "uuid",
      "method": "POST",
      "path": "/orders",
      "headers": { "Authorization": "Bearer test-token", "Content-Type": "application/json" },
      "body": "{\"item\":\"abc\",\"qty\":1}",
      "weight": 1
    }
  ],
  "start_rate": 10,
  "peak_rate": 500,
  "ramp_up_seconds": 120,
  "duration_seconds": 300,
  "max_virtual_users": 200,
  "total_requests": null,
  "timeout_ms": 5000,
  "think_time_ms": 0,
  "capacity_thresholds": { "p95_multiplier": 2.0, "max_error_rate": 0.01 },
  "start_now": true
}
```

Field reference

| Field | Type | Rules |
|---|---|---|
| `name` | string | 2 to 100 |
| `model` | enum | `open` (arrival rate, default) or `closed` (virtual users) |
| `profile` | enum | `sustained`, `ramp`, `spike`, `step` |
| `targets[]` | array | 1 to 20; `endpoint_id` or (`method` + `path`); `path` must be on the project's `base_url` host |
| `targets[].weight` | int | ≥ 1; share of traffic |
| `targets[].headers` | map | Values stored encrypted; redacted in responses (`"***"`) |
| `start_rate` | number | Requests per second (open model) |
| `peak_rate` | number | ≤ plan cap |
| `ramp_up_seconds` | int | For `ramp` |
| `duration_seconds` | int | ≤ plan cap (default cap 1,800) |
| `max_virtual_users` | int | Max in-flight (open) or VU count (closed) |
| `total_requests` | int or null | Optional stop condition |
| `timeout_ms` | int | 100 to 60,000 |
| `spike` | object | For `spike`: `{ "base_rate": 50, "spike_rate": 800, "spike_at_seconds": 60, "spike_duration_seconds": 20 }` |
| `step` | object | For `step`: `{ "start_rate": 50, "step_rate": 50, "step_seconds": 30, "max_rate": 1000 }` |
| `start_now` | bool | `false` saves as draft |

Response `201` (queued) or `202`:
```json
{ "success": true, "message": "Load test queued", "data": { "…LoadTest…": "", "status": "queued" } }
```
Errors: `422 TARGET_NOT_VERIFIED` (with `details.verify_url`), `422 TARGET_BLOCKED`, `422 PLAN_LIMIT_EXCEEDED` (details name the exceeded cap), `409 TEST_ALREADY_RUNNING` (concurrent cap per org/project), `400 VALIDATION_FAILED`.

### 11.2 `GET {PRJ}/load-tests`
Query: `status`, `profile`, `sort` (`-created_at`), `limit`, `cursor`. Items are `LoadTest` without heavy results.

### 11.3 `GET {PRJ}/load-tests/{testID}`
Full `LoadTest` including `config` (secrets redacted) and `summary` when finished:
```json
{
  "summary": {
    "total_requests": 84210, "successful": 83100, "failed": 1110,
    "avg_rps": 280.7, "peak_rps": 498.2,
    "latency_ms": { "p50": 60, "p90": 160, "p95": 220, "p99": 610, "max": 4800, "avg": 88 },
    "error_rate": 0.0132, "timeouts": 40,
    "status_codes": { "200": 83100, "500": 1000, "0": 110 },
    "bytes_received": 91823412,
    "duration_seconds": 300
  }
}
```

### 11.4 `POST {PRJ}/load-tests/{testID}/stop` (member+)
Graceful stop; returns `202` and status becomes `stopped` within about 2 s. `422 NOT_RUNNING` if not running or queued.

### 11.5 `POST {PRJ}/load-tests/{testID}/rerun` (member+)
Clones config into a new test and queues it. Response `201 LoadTest`. Re-checks verification and caps.

### 11.6 `DELETE {PRJ}/load-tests/{testID}` (admin+)
Deletes test and results. `409 TEST_RUNNING` if running.

### 11.7 `GET {PRJ}/load-tests/{testID}/results`
Final breakdown:
```json
{
  "data": {
    "summary": { "…": "" },
    "per_endpoint": [
      { "method": "POST", "path": "/orders", "requests": 84210, "error_rate": 0.0132,
        "latency_ms": { "p50": 60, "p95": 220, "p99": 610 } }
    ],
    "latency_distribution": [ { "le_ms": 10, "count": 900 }, { "le_ms": 50, "count": 40000 } ],
    "flags": { "generator_saturated": false, "max_schedule_lag_ms": 3 }
  }
}
```

### 11.8 `GET {PRJ}/load-tests/{testID}/timeseries`
Query: `step` (`1s` default, `5s`, `10s`). Points:
```json
{
  "data": {
    "step": "1s",
    "points": [
      { "t": 0, "offered_rps": 10, "achieved_rps": 10, "p50": 41, "p95": 80, "p99": 120, "errors": 0, "active": 3 }
    ]
  }
}
```

### 11.9 `GET {PRJ}/load-tests/{testID}/progress`: SSE, see section 19.

### State machine
```
draft ──start──► queued ──claimed──► running ──► completed
                    │                    ├──stop──► stopped
                    └─cancel─► stopped   └──error─► failed
```

---

## 12. Capacity and Compare APIs

### 12.1 `GET {PRJ}/load-tests/{testID}/capacity` (viewer+)
Returns `CapacityReport`. If the test is not finished: `409 TEST_NOT_FINISHED`. If the profile cannot support analysis (e.g. sustained at a single rate): `200` with `confidence: "low"` and a `note` explaining that a ramp or step test is recommended.

### 12.2 `POST {PRJ}/load-tests/{testID}/capacity/recompute` (member+)
Request `{ "thresholds": { "p95_multiplier": 3.0, "max_error_rate": 0.02 } }`. Recomputes without re-running the test; response is the new report (not stored unless `save: true`).

### 12.3 `POST {PRJ}/load-tests/compare` (viewer+)
Request `{ "test_ids": ["uuid1", "uuid2", "uuid3"] }` (2 to 5, same project).
```json
{
  "data": {
    "baseline_id": "uuid1",
    "tests": [
      { "id": "uuid1", "name": "v1.0", "avg_rps": 280, "peak_rps": 498, "p95_ms": 220, "error_rate": 0.013, "sustainable_rps": 420 },
      { "id": "uuid2", "name": "v1.1", "avg_rps": 300, "peak_rps": 540, "p95_ms": 190, "error_rate": 0.008, "sustainable_rps": 470 }
    ],
    "deltas": [
      { "test_id": "uuid2", "avg_rps_pct": 7.1, "peak_rps_pct": 8.4, "p95_pct": -13.6, "error_rate_pct": -38.5, "verdict": "improved" }
    ],
    "overlay": { "step": "5s", "series": [ { "test_id": "uuid1", "points": [] } ] }
  }
}
```
`verdict`: `improved | regressed | unchanged` (±5% tolerance, error rate compared in absolute points).

---

## 13. Diagnostics APIs

Prefix `{PRJ}/diagnostics`. Tag: **Diagnostics**. viewer+.

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/slow-endpoints` | `range`, `limit` (≤ 50), `min_requests` | Ranked list: endpoint, p95, p99, requests, impact score |
| GET | `/regressions` | `range`, `baseline` (`previous` or `test:{id}`), `threshold_pct` | List: endpoint, metric, baseline value, current value, change %, severity |
| GET | `/bottlenecks` | `range` | Hints: `{ "type": "cpu_correlated_latency", "evidence": {…}, "confidence": "medium", "message": "…" }` |

Bottleneck responses are always labeled `"kind": "hint"`: they are correlations, not proof.

---

## 14. Dashboard APIs

Prefix `{PRJ}/dashboards`. Tag: **Dashboards**.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/dashboards` | member+ | Create |
| GET | `/dashboards` | viewer+ | List (id, name, is_default, updated_at) |
| GET | `/dashboards/{dashboardID}` | viewer+ | Full object |
| PUT | `/dashboards/{dashboardID}` | member+ | Update (send `version`) |
| DELETE | `/dashboards/{dashboardID}` | member+ | Delete (default one cannot be deleted) |
| POST | `/dashboards/{dashboardID}/clone` | member+ | Clone |

Dashboard object
```json
{
  "id": "uuid", "name": "API Overview", "is_default": true, "version": 4,
  "time_range": "1h", "refresh_seconds": 15,
  "widgets": [
    {
      "id": "w1", "type": "timeseries", "title": "p95 latency",
      "layout": { "x": 0, "y": 0, "w": 6, "h": 4 },
      "query": { "metric": "p95", "group_by": "endpoint", "endpoint_ids": [] },
      "options": { "unit": "ms", "stacked": false }
    }
  ]
}
```
Widget `type`: `timeseries | stat | table | status_pie | heatmap`. Queries are **templates** (metric + filters), never raw SQL. Max 30 widgets per dashboard. Version mismatch: `409 VERSION_CONFLICT`.

---

## 15. Alert, Incident and Channel APIs

### 15.1 Alert Rules: `{PRJ}/alert-rules` (Tag: **Alerts**)

| Method | Path | Role |
|---|---|---|
| POST | `/alert-rules` | member+ |
| GET | `/alert-rules` | viewer+ |
| GET | `/alert-rules/{ruleID}` | viewer+ |
| PUT | `/alert-rules/{ruleID}` | member+ (send `version`) |
| DELETE | `/alert-rules/{ruleID}` | member+ |
| POST | `/alert-rules/{ruleID}/mute` | member+ (`{ "minutes": 60 }`) |

Rule object
```json
{
  "id": "uuid", "name": "High error rate", "enabled": true, "version": 1,
  "scope": { "type": "project" },
  "condition": { "metric": "error_rate", "operator": ">", "threshold": 0.05, "window": "5m", "for": "2m" },
  "severity": "critical",
  "channel_ids": ["uuid"],
  "state": "ok", "last_evaluated_at": "…"
}
```
`scope.type`: `project | endpoint` (with `endpoint_id`). `operator`: `> | >= | < | <=`. `severity`: `info | warning | critical`. `state`: `ok | pending | firing | muted`.

### 15.2 Incidents: `{PRJ}/incidents` (Tag: **Incidents**)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/incidents` | viewer+ | Filter `status`, `severity`, `range` |
| GET | `/incidents/{incidentID}` | viewer+ | Includes `timeline[]` |
| POST | `/incidents/{incidentID}/acknowledge` | member+ | |
| POST | `/incidents/{incidentID}/resolve` | member+ | Manual resolve |
| POST | `/incidents/{incidentID}/comments` | member+ | `{ "body": "Rolling back" }` |

`status`: `open | acknowledged | resolved`. Timeline entry: `{ type: opened|notified|acknowledged|comment|resolved, at, actor, detail }`.

### 15.3 Notification Channels: `{PRJ}/notification-channels`

| Method | Path | Role |
|---|---|---|
| POST | `/notification-channels` | admin+ |
| GET | `/notification-channels` | viewer+ |
| PUT | `/notification-channels/{channelID}` | admin+ |
| DELETE | `/notification-channels/{channelID}` | admin+ |
| POST | `/notification-channels/{channelID}/test` | admin+ |

Request
```json
{ "type": "slack", "name": "#alerts", "config": { "webhook_url": "https://hooks.slack.com/services/…" } }
```
`type`: `email` (`config.addresses[]`), `slack`, `webhook` (`config.url`, optional `config.secret`). Secrets are write-only: responses show `"***"`.

---

## 16. API Key and Webhook APIs

### 16.1 API Keys: `{PRJ}/api-keys` (Tag: **APIKeys**, admin+)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api-keys` | Create; **secret shown once** |
| GET | `/api-keys` | List (prefix only) |
| POST | `/api-keys/{keyID}/rotate` | New secret; old valid for grace period (default 24 h, `grace_hours` optional) |
| DELETE | `/api-keys/{keyID}` | Revoke immediately |

Create request `{ "name": "prod-ingest", "scopes": ["ingest", "discovery"], "expires_at": null }`
Create response `201`:
```json
{
  "data": {
    "id": "uuid", "name": "prod-ingest", "prefix": "strim_live_a1b2",
    "secret": "strim_live_a1b2c3d4e5f6g7h8i9j0…",
    "scopes": ["ingest", "discovery"], "created_at": "…", "last_used_at": null
  },
  "message": "Copy this key now. It will not be shown again."
}
```
Scopes: `ingest`, `discovery`, `read`. Stored as SHA-256 hash only.

### 16.2 Webhooks: `{PRJ}/webhooks` (Tag: **Webhooks**, admin+)

| Method | Path | Purpose |
|---|---|---|
| POST | `/webhooks` | Create |
| GET | `/webhooks` | List |
| PUT | `/webhooks/{webhookID}` | Update |
| DELETE | `/webhooks/{webhookID}` | Delete |
| GET | `/webhooks/{webhookID}/deliveries` | Delivery log (`status`, `limit`, `cursor`) |
| POST | `/webhooks/{webhookID}/deliveries/{deliveryID}/redeliver` | Redeliver (supports `Idempotency-Key`) |

Create request `{ "url": "https://example.com/hook", "events": ["test.completed", "incident.opened"], "secret": "optional-or-generated" }`. URL must be `https` and pass the SSRF guard.

**Events:** `test.started`, `test.completed`, `test.failed`, `test.stopped`, `incident.opened`, `incident.acknowledged`, `incident.resolved`, `endpoint.discovered`, `verification.verified`.

**Outbound delivery**
```
POST https://example.com/hook
Content-Type: application/json
X-Strim-Event: test.completed
X-Strim-Delivery: uuid
X-Strim-Timestamp: 1730455200
X-Strim-Signature: sha256=<hex hmac of "{timestamp}.{body}" with secret>
```
```json
{ "id": "uuid", "event": "test.completed", "created_at": "…", "project_id": "uuid", "data": { "test_id": "uuid", "status": "completed", "sustainable_rps": 420 } }
```
Success = any `2xx` within 10 s. Retries: 1 m, 5 m, 30 m, 2 h, 6 h (5 retries), then marked `failed`. Receivers should reject timestamps older than 5 minutes and verify the signature in constant time.

---

## 17. Audit and Usage APIs

### 17.1 `GET {ORG}/audit-logs` (admin+)
Query: `actor_id`, `action`, `resource_type`, `from`, `to`, `limit`, `cursor`. Sort fixed: newest first.
```json
{
  "id": "uuid", "at": "…", "actor": { "id": "uuid", "email": "asha@acme.com" },
  "action": "member.role_changed", "resource_type": "member", "resource_id": "uuid",
  "ip": "203.0.113.7", "user_agent": "Mozilla/5.0…",
  "changes": { "before": { "role": "member" }, "after": { "role": "admin" } }
}
```
**Audited actions (minimum):** `auth.login`, `auth.password_changed`, `org.created|updated|deleted`, `member.added|role_changed|removed`, `project.created|updated|deleted`, `project.verified`, `api_key.created|rotated|revoked`, `webhook.created|updated|deleted`, `load_test.started|stopped|deleted`, `channel.created|deleted`, `alert_rule.created|updated|deleted`.
Audit rows are append-only; no update or delete endpoint exists.

### 17.2 `GET {ORG}/usage` (admin+)
Query: `period` (`current_month` default, `last_month`, or `from`/`to`).
```json
{
  "data": {
    "period": { "from": "2026-11-01", "to": "2026-11-30" },
    "metrics": {
      "events_ingested": { "used": 1250000, "limit": 5000000 },
      "load_test_minutes": { "used": 42, "limit": 300 },
      "requests_generated": { "used": 2300000, "limit": 10000000 },
      "projects": { "used": 2, "limit": 5 }
    },
    "daily": [ { "date": "2026-11-01", "events_ingested": 40000, "load_test_minutes": 3 } ]
  }
}
```

---

## 18. System APIs

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/healthz` | none | Liveness: process is up |
| GET | `/readyz` | none | Readiness: DB reachable, migrations current |
| GET | `/metrics` | Basic Auth or internal network | Prometheus metrics |
| GET | `/swagger/*` | Basic Auth | Swagger UI |
| GET | `/v1/version` | none | `{ "version": "1.0.0", "commit": "abc123", "built_at": "…" }` |

---

## 19. SSE Contracts

**Common rules**
- `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
- Authentication: Bearer or cookie. Frontend uses `fetch` streaming because `EventSource` cannot set headers.
- Heartbeat comment `: ping` every 15 s.
- Every event has `id` (monotonic per stream) so clients can send `Last-Event-ID`. Resume is best effort; on gap the server sends a fresh `snapshot`.
- Server closes with an `end` event when the stream is naturally complete.
- Slow clients are disconnected, not buffered without limit.
- Max 5 concurrent streams per user per project.

### 19.1 `GET {PRJ}/load-tests/{testID}/progress`

```
event: snapshot
id: 1
data: {"status":"running","elapsed_seconds":0,"config_summary":{"profile":"ramp","peak_rate":500}}

event: tick
id: 2
data: {"t":1,"offered_rps":10,"achieved_rps":10,"p50":40,"p95":82,"p99":120,"errors":0,"active":3,"total_requests":10,"status_codes":{"200":10}}

event: status
id: 120
data: {"status":"completed"}

event: end
id: 121
data: {"reason":"completed"}
```
`tick` is sent once per second. If the test is already finished, the server sends `snapshot` (with summary) then `end`.

### 19.2 `GET {PRJ}/metrics/stream`
Query: `endpoint_id` (optional), `interval` (`2s | 5s | 10s`, default 5s).
```
event: overview
id: 41
data: {"ts":"…","rps":33.4,"p95":182,"p99":410,"error_rate":0.004,"requests_last_interval":167}

event: endpoint_health
id: 42
data: {"endpoint_id":"uuid","health":"degraded"}

event: incident
id: 43
data: {"incident_id":"uuid","status":"open","severity":"critical"}
```

---

## 20. Rate Limits

In-memory limiter (per instance). Real limit = configured value × instances, so tune with deployment size in mind. Key = user ID where authenticated, otherwise IP; API-key routes use key ID.

| Route group | Limit | Key |
|---|---|---|
| `signup`, `login`, `forgot-password`, `reset-password` | 5/min | IP (+ email for login) |
| `change-password`, `otp/send`, `otp/verify` | 5/min | User |
| `refresh` | 30/min | IP |
| `GET /users/username` | 30/min | IP |
| General authenticated reads | 300/min | User |
| General authenticated writes | 60/min | User |
| `POST /load-tests` | 10/min | User |
| `POST /v1/ingest/events` | 600/min (burst 100) | API key |
| `POST /v1/ingest/host-metrics` | 120/min | API key |
| SSE connections | 5 concurrent per user per project | User |
| Swagger UI | Basic Auth, 60/min | IP |

Response on limit: `429` with `error_code: RATE_LIMITED`, `Retry-After`, and `X-RateLimit-*` headers.

---

## 21. Permissions Matrix

`V` viewer · `M` member · `A` admin · `O` owner · `U` any verified user · `P` public · `K` API key

| Endpoint group | Min role |
|---|---|
| Auth signup, login, refresh, forgot/reset, OAuth | P |
| Auth logout, me, change-password, otp, sessions | U (not verified required) |
| Users username check | P |
| Users me, set username, update | U / verified |
| Org create, list | U (verified) |
| Org get | V |
| Org update | A |
| Org delete | O |
| Members list | V |
| Members add, change role, remove, invite | A |
| Members leave | M |
| Projects list, get | V |
| Projects create, update, delete | A |
| Verification start, check | A |
| Verification status | V |
| Registry list, get | V |
| Registry patch (tags, ignore) | M |
| Discovery import (openapi, manifest) | A |
| Discovery runs | V |
| Ingest events, host-metrics, discovery | K |
| Metrics (all GET, including SSE) | V |
| Load tests list, get, results, timeseries, progress | V |
| Load tests create, stop, rerun | M |
| Load tests delete | A |
| Capacity get / recompute / compare | V / M / V |
| Diagnostics | V |
| Dashboards read | V |
| Dashboards write | M |
| Alert rules read / write | V / M |
| Incidents read / act | V / M |
| Channels read / write | V / A |
| API keys, webhooks (all) | A |
| Audit logs, usage | A |

Order of roles: `viewer < member < admin < owner`. Check order in middleware: **authenticated → verified (if required) → tenant membership (404 if none) → role (403 if too low)**.

---

## 22. Error Catalog

| `error_code` | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Body or query invalid (`details[]` lists fields) |
| `BAD_REQUEST` | 400 | Malformed JSON, wrong content type |
| `UNAUTHORIZED` | 401 | No credentials |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_EXPIRED` | 401 | Access or refresh token expired |
| `TOKEN_INVALID` | 401 | Bad signature, revoked, denylisted |
| `TOKEN_REUSED` | 401 | Refresh token reuse detected |
| `INVALID_API_KEY` | 401 | Unknown, revoked or expired key |
| `EMAIL_NOT_VERIFIED` | 403 | Route needs verified email |
| `FORBIDDEN_ROLE` | 403 | Role too low in a tenant you belong to |
| `KEY_SCOPE_MISSING` | 403 | API key lacks required scope |
| `NOT_FOUND` | 404 | Missing or not in your tenant |
| `USER_NOT_FOUND` | 404 | Member add by unknown email |
| `EMAIL_TAKEN` | 409 | Duplicate email |
| `USERNAME_TAKEN` | 409 | Duplicate username |
| `USERNAME_ALREADY_SET` | 409 | One-time rule |
| `SLUG_TAKEN` | 409 | Org or project slug in use |
| `ALREADY_MEMBER` | 409 | Member exists |
| `ALREADY_VERIFIED` | 409 | OTP send when verified |
| `ORG_LIMIT_REACHED` | 409 | User already in 3 orgs |
| `TARGET_ORG_LIMIT_REACHED` | 409 | Added user already in 3 orgs |
| `PROJECT_LIMIT_REACHED` | 409 | Org already has 5 projects |
| `TEST_ALREADY_RUNNING` | 409 | Concurrent test cap |
| `TEST_RUNNING` | 409 | Cannot delete a running test |
| `TEST_NOT_FINISHED` | 409 | Capacity requested too early |
| `VERSION_CONFLICT` | 409 | Optimistic concurrency mismatch |
| `OTP_INVALID` / `OTP_EXPIRED` | 400 | Bad or old OTP |
| `OTP_ATTEMPTS_EXCEEDED` | 429 | Too many OTP tries |
| `INVALID_PASSWORD` | 400 | Old password wrong |
| `LAST_OWNER` | 422 | Would leave org without owner |
| `CONFIRMATION_MISMATCH` | 422 | Delete confirmation wrong |
| `NOT_RUNNING` | 422 | Stop on non-running test |
| `TARGET_NOT_VERIFIED` | 422 | Load test on unverified project |
| `TARGET_BLOCKED` | 422 | Private, internal or disallowed target |
| `PLAN_LIMIT_EXCEEDED` | 422 | RPS, VU, duration or usage cap |
| `ACCOUNT_LOCKED` | 429 | Too many failed logins |
| `RATE_LIMITED` | 429 | Rate limit |
| `INGEST_BACKPRESSURE` | 429/503 | Ingest buffers full |
| `INTERNAL_ERROR` | 500 | Unexpected (message generic, details only in logs) |
| `SERVICE_UNAVAILABLE` | 503 | DB down, shutting down |

Rules: `error` is human readable and safe to show; `error_code` is stable and what the frontend switches on; never include stack traces, SQL or internal hostnames.

---

## 23. Swagger Rules and Templates

### 23.1 Global meta (in `cmd/server/main.go`)

```go
// @title STRIM Labs API
// @version 1.0
// @description STRIM Labs backend: API observability, load testing and capacity analysis.
// @termsOfService http://swagger.io/terms/
// @contact.name API Support
// @contact.email support@strimlabs.dev
// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html
// @BasePath /
// @schemes https http
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and then your token.
// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name X-API-Key
// @description Project API key (ingestion and CI discovery).
```

### 23.2 Standard JSON handler

```go
// CreateProject godoc
// @Summary Create a project
// @Description Creates a project inside the organization. An organization can have at most 5 projects.
// @Tags Projects
// @Accept json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param body body domain.CreateProjectRequest true "Project details"
// @Success 201 {object} domain.Response{data=domain.Project}
// @Failure 400 {object} domain.Response
// @Failure 401 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 409 {object} domain.Response "PROJECT_LIMIT_REACHED or SLUG_TAKEN"
// @Security BearerAuth
// @Router /v1/organizations/{orgID}/projects [post]
func (h *ProjectHandler) Create(c *fiber.Ctx) error { ... }
```

### 23.3 List handler with pagination

```go
// ListEndpoints godoc
// @Summary List discovered endpoints
// @Tags Registry
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param q query string false "Search text"
// @Param method query string false "HTTP method" Enums(GET,POST,PUT,PATCH,DELETE)
// @Param status query string false "Status" Enums(active,stale,ignored)
// @Param sort query string false "Sort field" default(-last_seen)
// @Param limit query int false "Page size" default(50) minimum(1) maximum(200)
// @Param cursor query string false "Pagination cursor"
// @Success 200 {object} domain.Response{data=[]domain.Endpoint}
// @Security BearerAuth
// @Router /v1/organizations/{orgID}/projects/{projectID}/endpoints [get]
```

### 23.4 API-key handler

```go
// IngestEvents godoc
// @Summary Ingest request events
// @Description Accepts up to 1000 events per call. Returns 202 once buffered.
// @Tags Ingestion
// @Accept json
// @Produce json
// @Param Content-Encoding header string false "gzip is supported"
// @Param body body domain.IngestEventsRequest true "Events"
// @Success 202 {object} domain.Response{data=domain.IngestResult}
// @Failure 401 {object} domain.Response
// @Failure 429 {object} domain.Response
// @Security ApiKeyAuth
// @Router /v1/ingest/events [post]
```

### 23.5 SSE handler

```go
// StreamProgress godoc
// @Summary Stream live load test progress (SSE)
// @Description Emits snapshot, tick (1/s), status and end events. See API.md section 19.
// @Tags LoadTests
// @Produce text/event-stream
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param testID path string true "Load test ID"
// @Success 200 {string} string "SSE event stream"
// @Security BearerAuth
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID}/progress [get]
```

### 23.6 DTO tag style

```go
type CreateProjectRequest struct {
    Name        string `json:"name" validate:"required,min=2,max=100" minLength:"2" maxLength:"100" example:"Checkout API"`
    Slug        string `json:"slug" validate:"required,min=2,max=50,slug" minLength:"2" maxLength:"50" example:"checkout-api"`
    Description string `json:"description" validate:"max=500" maxLength:"500" example:"Orders and payments"`
    BaseURL     string `json:"base_url" validate:"required,url,max=300" example:"https://api.acme.com"`
    Environment string `json:"environment" validate:"required,oneof=development staging production" enums:"development,staging,production" example:"production"`
}
```

### 23.7 Rules

1. Every route has: `@Summary`, `@Description` (if behavior isn't obvious), `@Tags`, `@Accept`/`@Produce`, all `@Param`s, at least one `@Success`, all realistic `@Failure`s, `@Security`, `@Router`.
2. Tags match section names: Auth, Users, Organizations, Members, Projects, Registry, Discovery, Ingestion, Metrics, LoadTests, Capacity, Diagnostics, Dashboards, Alerts, Incidents, Channels, APIKeys, Webhooks, Audit, Usage, System.
3. Use `domain.Response{data=…}` generics. Never return raw structs without the envelope (except SSE and Prometheus).
4. Every DTO field has `example`. Constraints go in `minLength`, `maxLength`, `minimum`, `maximum`, `enums`.
5. Public routes omit `@Security`.
6. Regenerate with `swag init -g cmd/server/main.go -o docs`. CI fails if `docs/` has uncommitted changes.
7. The frontend client is generated from `docs/swagger.json`; breaking changes are visible as TypeScript errors.
8. Swagger UI: Basic Auth on `/swagger/*`, `PersistAuthorization: true`, and the cookie-isolation guard so "Try it out" requires the Authorize button.

---

## 24. Design Checklist for Every New Endpoint

- [ ] Path follows 1.2 and nests under the owning resource
- [ ] Minimum role chosen and added to the permissions matrix (section 21)
- [ ] Tenant check: resource looked up **with** `org_id` (and `project_id`); cross-tenant returns 404
- [ ] Request DTO has `validate` tags and `example`s; unknown fields rejected
- [ ] Response uses the envelope and shared objects
- [ ] List endpoints use cursor pagination and an allow-list of sort fields
- [ ] Mutations that must be safe to retry accept `Idempotency-Key`
- [ ] Mutable configs use `version` for optimistic concurrency
- [ ] Sensitive action writes an audit log entry
- [ ] Rate limit class assigned (section 20)
- [ ] Errors use catalog codes (add new ones to section 22)
- [ ] Swagger annotations complete; `swag init` committed
- [ ] Unit test, integration test, and cross-tenant test written
- [ ] Frontend: query key includes `orgId` and `projectId`; error code mapped to a friendly message

---

*Related docs: `PRD.md` (what and why), `Implementation_phases.md` (build order).*