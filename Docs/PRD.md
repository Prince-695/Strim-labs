# STRIM Labs: Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | STRIM Labs |
| **Type** | Multi-tenant API observability, load-testing and capacity-analysis platform |
| **Version** | 1.0 (draft) |
| **Backend** | Go (Fiber v2), PostgreSQL, in-memory cache, SSE |
| **Frontend** | Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Zustand, TanStack Query |
| **API docs** | Swagger (swaggo/swag) |

---

## 1. Summary

STRIM Labs lets a developer connect a backend, see how it behaves, load-test it, and find out how much traffic it can take before it breaks.

**The core loop (everything else supports this):**

```
Register service  →  Discover endpoints  →  Watch live metrics
                                                  ↓
                  Know your limit  ←  Run load test  ←  Pick endpoints
```

## 2. Problem

- Developers don't know their real capacity until production falls over.
- Monitoring tools (Grafana, Datadog) and load tools (k6, JMeter) are separate, so results are never connected.
- Discovering and listing every API route by hand is tedious and goes stale.

## 3. Goals and Non-Goals

### Goals
1. One place for API monitoring, load testing and capacity estimation.
2. Auto-discover endpoints (CI scan, OpenAPI, runtime traffic). No manual route entry.
3. Give a clear answer to: *"How many requests per second can my service handle?"*
4. Production-grade backend: secure, multi-tenant, horizontally scalable, fully documented.
5. A frontend that a new user can understand in five minutes.

### Non-Goals (v1)
- Not a full APM (no distributed tracing UI, no log search).
- No distributed load generation across many regions (single-region workers only).
- No billing or payments.
- No mobile app.

## 4. Users

| Persona | Wants | Role in STRIM |
|---|---|---|
| **Solo developer** | Quick answer on capacity, simple setup | Owner |
| **Backend team lead** | Compare tests, catch regressions, control access | Admin |
| **Engineer** | Run tests, view dashboards | Member |
| **Stakeholder / QA** | Read-only visibility | Viewer |

## 5. Hard Limits

| Limit | Value | Enforced where |
|---|---|---|
| Organizations per user (memberships) | **3** | Service layer + DB check inside a transaction |
| Projects per organization | **5** | Service layer + DB check inside a transaction |
| Roles | owner, admin, member, viewer | Middleware + service layer |

Exceeding a limit returns `409` with error code `ORG_LIMIT_REACHED` or `PROJECT_LIMIT_REACHED`.

---

## 6. Functional Requirements

Priority: **P0** = MVP, **P1** = after MVP, **P2** = later.

### 6.1 Authentication and Sessions (P0)
| ID | Requirement |
|---|---|
| AUTH-1 | Sign up with email, password, first and last name |
| AUTH-2 | Login with email and password |
| AUTH-3 | JWT access token (15 min) and rotating refresh token (7 days) in HttpOnly cookies; also returned in body for Swagger and API clients |
| AUTH-4 | Refresh-token reuse detection: reuse revokes the whole session family |
| AUTH-5 | Logout invalidates the refresh token in DB and adds the access token to a short-lived in-memory denylist |
| AUTH-6 | Forgot and reset password with 6-digit OTP (10 min expiry, max 5 attempts) |
| AUTH-7 | Change password (requires old password) and revoke other sessions |
| AUTH-8 | Email verification via OTP |
| AUTH-9 | Google OAuth (GitHub OAuth P1) with state and PKCE |
| AUTH-10 | Rate limits: 5/min on signup, login, forgot, reset, change, OTP routes |
| AUTH-11 | Passwords hashed with argon2id; never logged |

### 6.2 Users and Profile (P0)
| ID | Requirement |
|---|---|
| USER-1 | Get current user profile |
| USER-2 | Check username availability (public) |
| USER-3 | Set permanent username (one time, 3 to 20 chars) |
| USER-4 | Update first and last name |

### 6.3 Organizations and RBAC (P0)
| ID | Requirement |
|---|---|
| ORG-1 | Create org (creator becomes owner); unique slug |
| ORG-2 | List my orgs with my role |
| ORG-3 | Get, update (admin+) and delete (owner only) org |
| ORG-4 | Add an existing user by email with a role |
| ORG-5 | List members; change role (admin+); remove member (admin+) |
| ORG-6 | Rules: an org always keeps at least one owner; admins cannot change or remove owners; a user can leave an org unless they are the last owner |
| ORG-7 | Invite by email for users who have no account yet (P1) |

**Permission matrix**

| Action | Viewer | Member | Admin | Owner |
|---|:-:|:-:|:-:|:-:|
| View dashboards, metrics, registry, test results | ✅ | ✅ | ✅ | ✅ |
| Run and stop load tests | ❌ | ✅ | ✅ | ✅ |
| Create or edit dashboards, alert rules | ❌ | ✅ | ✅ | ✅ |
| Manage projects, API keys, webhooks, channels | ❌ | ❌ | ✅ | ✅ |
| Manage members and roles | ❌ | ❌ | ✅ | ✅ |
| View audit logs and usage | ❌ | ❌ | ✅ | ✅ |
| Delete organization | ❌ | ❌ | ❌ | ✅ |

### 6.4 Projects (P0)
| ID | Requirement |
|---|---|
| PRJ-1 | Create, list, get, update and delete projects inside an org (max 5) |
| PRJ-2 | A project has: name, slug, description, `base_url`, environment label (dev, staging, prod) |
| PRJ-3 | **Target verification** (see 9.3): required before any load test |
| PRJ-4 | Soft delete with 7-day grace period, then purge |

### 6.5 API Registry and Discovery (P0 / P1)
| ID | Requirement | Priority |
|---|---|---|
| REG-1 | Central registry of endpoints: method, path template, service, tags, discovery sources, first seen, last seen, status (active, stale, ignored) | P0 |
| REG-2 | Import OpenAPI 2.0 / 3.x (file upload or URL) | P0 |
| REG-3 | Runtime discovery from ingested traffic; path normalization (`/users/123` becomes `/users/{id}`) | P0 |
| REG-4 | CI scanner: a GitHub Action posts a route manifest (Go, Express, FastAPI, Spring starters) using a project API key | P1 |
| REG-5 | Route manifest upload (simple JSON format) | P1 |
| REG-6 | Merge duplicates across sources; keep a list of all sources per endpoint | P0 |
| REG-7 | Mark endpoints `stale` if not seen for 30 days | P1 |
| REG-8 | User can tag, ignore or annotate endpoints | P1 |

### 6.6 Telemetry Ingestion (P0)
| ID | Requirement |
|---|---|
| ING-1 | `POST /v1/ingest/events`: batched request events (up to 1,000 per call, gzip supported) using a project API key |
| ING-2 | Event fields: timestamp, method, path, route template (optional), status, duration_ms, bytes, error flag |
| ING-3 | Async pipeline: validate, buffer, batch write; returns `202 Accepted` |
| ING-4 | Backpressure: return `429` or `503` with `Retry-After` when buffers are full |
| ING-5 | Host metrics endpoint: CPU, memory, network, disk (agent or integration) (P1) |
| ING-6 | OTLP/HTTP metrics receiver (P2) |
| ING-7 | Lightweight SDK or middleware snippets for Go, Node and Python (P1) |
| ING-8 | Roll-ups at 1 minute and 1 hour; raw data kept 7 days, 1m kept 30 days, 1h kept 13 months (configurable) |

### 6.7 Observability (P0)
| ID | Requirement |
|---|---|
| OBS-1 | Overview: RPS, total requests, p50/p95/p99, success and error rate, timeouts |
| OBS-2 | Per-endpoint table with the same metrics, sortable |
| OBS-3 | Status-code distribution (2xx, 3xx, 4xx, 5xx and individual codes) |
| OBS-4 | Time-range selector (15m, 1h, 6h, 24h, 7d, custom) and auto-refresh |
| OBS-5 | Live updates over SSE |
| OBS-6 | Host metrics charts when an agent is connected; clear empty state when not |
| OBS-7 | Endpoint health status (healthy, degraded, failing) from thresholds |

### 6.8 Load Testing (P0)
| ID | Requirement |
|---|---|
| LT-1 | Configure: target endpoints (one or many), method, headers, body, auth header, total requests, virtual users, arrival rate, duration, ramp-up, profile |
| LT-2 | Profiles: **sustained**, **ramp** (gradual increase), **spike** (sudden burst), **step** (stairs, used for capacity) |
| LT-3 | Two load models: **open** (fixed arrival rate, default) and **closed** (fixed virtual users) |
| LT-4 | Collect: latency histogram, status codes, success and failure counts, timeouts, bytes, throughput |
| LT-5 | Live progress over SSE (1 update per second) |
| LT-6 | Stop a running test at any time; graceful drain |
| LT-7 | Safety: target must be verified; plan caps on VUs, RPS and duration; private and internal IPs blocked |
| LT-8 | Test states: `queued → running → completed / failed / stopped` |
| LT-9 | Re-run a previous test with the same config |
| LT-10 | Results kept per test: summary, time series (1 s buckets), per-endpoint breakdown |

### 6.9 Capacity Analysis (P0)
| ID | Requirement |
|---|---|
| CAP-1 | From a ramp or step test, estimate **sustainable RPS** and the **breaking point** |
| CAP-2 | Output: sustainable RPS, breaking-point RPS, reason (latency, errors or saturation), confidence, and the chart data used |
| CAP-3 | Algorithm described in section 8.3; thresholds configurable per project |
| CAP-4 | Always show the method and thresholds, so the result is explainable |

### 6.10 Comparison (P1)
| ID | Requirement |
|---|---|
| CMP-1 | Compare 2 to 5 tests across avg throughput, peak throughput, p95 latency, error rate |
| CMP-2 | Show deltas and highlight regressions |

### 6.11 Diagnostics (P1)
| ID | Requirement |
|---|---|
| DIA-1 | Slowest endpoints ranking for a time window |
| DIA-2 | Regression detection: compare a window against a baseline (previous period or a chosen test) |
| DIA-3 | Bottleneck hints: line up latency spikes with CPU or memory pressure and load-test phases |

### 6.12 Dashboards (P1)
| ID | Requirement |
|---|---|
| DSH-1 | Create, edit, clone and delete dashboards per project |
| DSH-2 | Widgets: time series, stat, table, status-code pie, heatmap (P2) |
| DSH-3 | Layout and widget config stored as versioned JSON |
| DSH-4 | A default dashboard is created for every project |

### 6.13 Alerts, Incidents, Notifications (P1)
| ID | Requirement |
|---|---|
| ALR-1 | Alert rules: metric, scope (project or endpoint), condition, window, severity |
| ALR-2 | Evaluator runs every 30 s; state machine `ok → pending → firing → resolved` |
| INC-1 | An incident opens when a rule fires; states `open → acknowledged → resolved`; timeline and comments |
| NTF-1 | Channels: email, Slack webhook, generic webhook |
| NTF-2 | Test-send button; delivery log |

### 6.14 API Keys and Webhooks (P1)
| ID | Requirement |
|---|---|
| KEY-1 | Project-scoped keys with scopes (`ingest`, `discovery`, `read`); shown once; stored as SHA-256 hash; prefix kept for display |
| KEY-2 | Revoke, rotate, set expiry; show last-used time |
| WH-1 | Outbound webhooks for events (`test.completed`, `incident.opened`, ...) signed with HMAC-SHA256 |
| WH-2 | Retries with exponential backoff; delivery log; manual redeliver |

### 6.15 Audit Logs and Usage (P1)
| ID | Requirement |
|---|---|
| AUD-1 | Append-only log of sensitive actions (who, what, when, IP, before and after) |
| AUD-2 | Filter by actor, action, date range |
| USG-1 | Org usage: ingested events, load-test minutes, requests generated, API calls |
| USG-2 | Plan limits shown as used / allowed |

---

## 7. Architecture

### 7.1 Overview

```
 Next.js app (React Query + Zustand)
        │  REST (JSON)           │  SSE
        ▼                        ▼
 ┌───────────────────────────────────────────┐
 │  strim-api  (Go, Fiber v2)                │   stateless, horizontally scalable
 │  middleware → handler → service → repo    │
 │  in-memory cache · SSE hub · ingest buffer│
 └──────────────┬────────────────────────────┘
                │ SQL (pgx pool)                    ▲ LISTEN/NOTIFY
                ▼                                   │
 ┌──────────────────────────┐          ┌────────────┴─────────────┐
 │ Cloud PostgreSQL         │◄─────────│ strim-worker (Go)        │
 │  relational + RLS        │  claims  │  load engine, alert eval,│
 │  jobs table (SKIP LOCKED)│  jobs    │  roll-ups, webhooks      │
 └──────────────────────────┘          └────────────┬─────────────┘
 ┌──────────────────────────┐                        │ HTTP load
 │ Time-series store        │◄── batched writes      ▼
 │ (see section 10)         │                  Target backend
 └──────────────────────────┘
```

### 7.2 Processes

| Process | Job | Scales by |
|---|---|---|
| `strim-api` | REST, auth, SSE, ingestion endpoint | More instances behind a load balancer |
| `strim-worker` | Load engine, alert evaluator, roll-up jobs, webhook delivery | More worker instances (each claims jobs with `FOR UPDATE SKIP LOCKED`) |

Same codebase and same Docker image; started with a different command (`strim-api`, `strim-worker`). This keeps one deployable unit while allowing separate scaling. No external queue is needed: **Postgres is the queue**.

### 7.3 Layering

```
cmd/server/main.go          wiring, swagger meta, routes
internal/http/handlers/     HTTP only: parse, validate, call service, respond
internal/http/middleware/   auth, rbac, tenant, rate limit, request id, logging, recover
internal/service/           business rules (limits, RBAC rules, orchestration)
internal/repository/        SQL only (pgx), one file per aggregate
internal/domain/            structs, DTOs, errors, Response envelope
internal/loadengine/        runner, scheduler, profiles, histogram
internal/analysis/          capacity, regression detection
internal/ingest/            buffer, batch writer, normalizer
internal/discovery/         openapi parser, manifest parser, path normalizer
internal/alerts/            evaluator, state machine
internal/notify/            email, slack, webhook senders
internal/cache/             in-memory cache wrapper
internal/sse/               hub, client, heartbeat
internal/config/            env config
db/migrations/              SQL migrations
docs/                       generated swagger
```

Rules: handlers never touch SQL. Repositories never contain business rules. Services never know about Fiber.

### 7.4 In-Memory Cache (Go)

Use a bounded, concurrent in-process cache (`otter` or `ristretto`) with TTL.

| Cached | TTL | Invalidated on |
|---|---|---|
| Org membership and role per (user, org) | 60 s | Member role change, remove, org delete |
| Project settings (base_url, verification) | 60 s | Project update |
| API key hash → project | 5 min | Revoke or rotate |
| Revoked access-token IDs (denylist) | until token expiry | n/a |
| Rate-limit counters | window length | n/a |
| Dashboard query results | 5 to 15 s | n/a |

> **Important scaling note:** an in-memory cache is per instance. With several API instances, a role change may be stale on other instances for up to the TTL. Mitigation: keep TTLs short, and broadcast invalidations with Postgres `LISTEN/NOTIFY` so every instance evicts the key at once. Rate-limit counters are per instance (acceptable; the real limit is `N × instances`, so set values with that in mind).

### 7.5 SSE

- Endpoints stream `text/event-stream` with `event:`, `id:` and `data:` fields; heartbeat comment every 15 s; `Last-Event-ID` supported for resume where possible.
- An in-process **hub** maps `(topic) → set of client channels`. Topics: `loadtest:{id}`, `project:{id}:metrics`.
- Slow clients: bounded channel per client; drop the oldest or disconnect if full (never block the producer).
- Cross-instance: the worker publishes through Postgres `NOTIFY`; every API instance listens and forwards to its local clients. (Needs a **direct** DB connection, not a transaction pooler, for `LISTEN`.)
- Auth for SSE: normal Bearer or cookie. Browsers' `EventSource` cannot set headers, so the frontend uses `fetch` streaming (e.g. `@microsoft/fetch-event-source`) or cookies.

---

## 8. Core Engines

### 8.1 Ingestion Pipeline

```
POST /v1/ingest/events ──► API key check (cached) ──► validate + size limit
        ──► normalize path ──► bounded channel ──► batcher (500 events or 1 s)
        ──► COPY into raw table ──► roll-up job (1m, 1h)
```

- Returns `202` after the event is in the buffer; never waits for the DB.
- Buffer full → `429/503` with `Retry-After`.
- Roll-ups store **mergeable histograms**, not raw averages (see 8.2).

### 8.2 Latency Percentiles

- Store a fixed log-scaled histogram per (project, endpoint, minute): count, error count, sum, min, max and bucket counts.
- p50/p95/p99 are read from merged buckets. Histograms add together, so 60 one-minute rows become one hour exactly.
- Never average percentiles. Always merge histograms.
- Load engine uses `HdrHistogram` per worker goroutine group; merged at the end.

### 8.3 Load Engine

**Open model (default):** a scheduler releases requests at a target rate regardless of response time. Latency is measured from the **intended send time**, which avoids *coordinated omission* (hiding slowness because the tester itself waited).
**Closed model:** N virtual users each loop: send, wait for response, think time, repeat.

| Profile | Shape |
|---|---|
| Sustained | Constant rate for the whole duration |
| Ramp | Rate rises linearly from start to end over ramp-up |
| Spike | Base rate, sudden jump to peak for a short window, back to base |
| Step | Rate rises in fixed steps (e.g. +50 RPS every 30 s); used for capacity |

Engine rules:
- Shared tuned `http.Transport` (connection reuse, per-host limits, timeouts).
- Worker pool sized by max in-flight; if the generator itself falls behind its schedule, it records `generator_lag` and flags the result as unreliable.
- Context-based cancellation for Stop.
- Aggregate each second: sent, completed, errors, status counts, histogram snapshot.
- Hard caps by plan: max RPS, max VUs, max duration, max body size.

### 8.4 Capacity Analysis

Input: per-second (or per-step) data: offered RPS, achieved RPS, p95, error rate.

1. Split the run into **windows** (a step, or 10 s slices for ramp).
2. For each window compute achieved RPS, p95, error rate.
3. A window is **healthy** if: `p95 ≤ baseline_p95 × 2` (configurable), `error_rate ≤ 1%`, and `achieved_RPS ≥ 95% of offered`.
4. **Sustainable RPS** = highest offered RPS where this and all earlier windows are healthy.
5. **Breaking point** = first offered RPS where 2 consecutive windows are unhealthy (consecutive rule avoids reacting to noise).
6. **Reason** = which rule failed first: `latency`, `errors` or `saturation` (achieved RPS stops rising while offered RPS rises).
7. **Confidence** = high / medium / low, based on number of windows, noise level and whether a breaking point was actually reached. If never reached: "capacity is at least X RPS; raise max rate".

All thresholds are shown with the result.

---

## 9. Security

### 9.1 Authentication
Access JWT 15 min; refresh token 7 days, hashed in DB, rotated on use; reuse detection; secure, HttpOnly, SameSite cookies; CSRF protection for cookie-based mutating requests (double-submit token or `Origin` check); OAuth `state` verified.

### 9.2 Tenant Isolation (defense in depth)
1. Every tenant table has `org_id`.
2. Every repository query filters by `org_id` (and `project_id` where relevant). Tenant middleware loads membership and role into the request context.
3. **PostgreSQL Row-Level Security** on tenant tables, using `SET LOCAL app.current_org_id = '<uuid>'` inside each request's transaction. A missed `WHERE` cannot leak data.
4. IDs are UUIDs (no guessable integers). Cross-tenant access returns `404`, not `403`.
5. Automated tests that try cross-tenant reads on every route.

### 9.3 Load-Test Safety (a load tester can be an attack tool)
1. **Ownership verification** before any test: DNS TXT record `strim-verify=<token>` on the domain, or file `/.well-known/strim-verify.txt`, or a response header. Re-verify every 30 days.
2. **SSRF protection**: resolve DNS, block private, loopback, link-local and cloud-metadata ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7), pin to the resolved IP, re-check after redirects, limit redirects.
3. **Caps** on RPS, VUs, duration, concurrent tests per org.
4. **Kill switch** per org and global.
5. All test starts written to the audit log.

### 9.4 Other
- Rate limits on every public route; stricter on auth.
- Strict input validation (`go-playground/validator`), body size limits, timeouts.
- Secrets in env only; no secrets in logs; header redaction in stored test configs (encrypt stored auth headers with AES-GCM).
- Webhook signatures (HMAC-SHA256 with timestamp).
- Security headers, CORS allowlist, Swagger behind Basic Auth.
- Dependency and container scanning in CI.

---

## 10. Data Storage

### 10.1 Relational (PostgreSQL, cloud)
Free-tier options: **Neon** (serverless Postgres), **Supabase**, **Aiven free plan**. Use pooled connections for the API (`pgx` pool) and a **direct** connection for `LISTEN/NOTIFY`.

Core tables:

| Table | Purpose |
|---|---|
| `users`, `auth_sessions`, `refresh_tokens`, `otp_codes`, `oauth_accounts` | Identity |
| `organizations`, `org_members` | Tenants and roles |
| `projects`, `project_verifications` | Services and target ownership |
| `api_endpoints`, `endpoint_sources`, `discovery_runs` | Registry |
| `api_keys`, `webhooks`, `webhook_deliveries` | Integrations |
| `load_tests`, `load_test_runs`, `load_test_results`, `capacity_reports`, `jobs` | Load testing and queue |
| `dashboards`, `alert_rules`, `incidents`, `incident_events`, `notification_channels` | Monitoring |
| `audit_logs`, `usage_counters` | Governance |

All IDs are UUIDv7. All tables have `created_at`, `updated_at`; tenant tables have `org_id`.

### 10.2 Time-Series Options (free or free-tier)

> Free tiers change often. Verify current limits before committing.

| Option | Cost | Good for | Notes |
|---|---|---|---|
| **A. Same Postgres, native partitioning (recommended for MVP)** | $0 on top of Neon/Supabase free | Simplest; one database, SQL, RLS works | Daily partitions + roll-up tables; `pg_cron` or the worker drops old partitions |
| **B. Timescale Cloud (Tiger Data)** | Free trial, then paid | Real hypertables, continuous aggregates, compression | Great upgrade path; check current free offering |
| **C. ClickHouse Cloud** | Trial credits | Very high ingest, fast analytics | Best for large scale; extra operational piece |
| **D. InfluxDB Cloud (free plan)** | Free with limits | Quick metrics store | Short retention and rate limits; Flux/SQL learning curve |

**Decision:** start with **A**. Hide storage behind a `TimeSeriesStore` Go interface (`WriteEvents`, `QueryRange`, `QueryRollup`, `DropOlderThan`), so switching to B or C needs only a new adapter, not a rewrite.

---

## 11. API Standards

### 11.1 Conventions
- Base path `/v1`. JSON in, JSON out. `snake_case` fields.
- Every response uses the **universal envelope**:

```go
type Response struct {
    Success      bool        `json:"success"`
    Message      string      `json:"message,omitempty"`
    AccessToken  string      `json:"access_token,omitempty"`
    Data         interface{} `json:"data,omitempty"`
    Error        string      `json:"error,omitempty"`
    ErrorCode    string      `json:"error_code,omitempty"`
    Details      interface{} `json:"details,omitempty"`   // validation errors
    Meta         *PageMeta   `json:"meta,omitempty"`      // pagination
    RequestID    string      `json:"request_id,omitempty"`
    ResponseTime string      `json:"response_time"`
}
```

- Pagination: cursor-based, `?limit=50&cursor=...` (default 50, max 200). `meta` returns `next_cursor` and `has_more`.
- Filtering and sorting: `?sort=-created_at&status=active`.
- Time ranges: RFC 3339 `from` and `to`, or `range=1h`.
- `X-Request-ID` accepted or generated, returned in header and body, included in every log line.
- **Idempotency:** `Idempotency-Key` header on `POST /load-tests` and webhook redeliver.
- Optimistic concurrency: `version` field on dashboards and alert rules (`409` on mismatch).
- Standard rate-limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.

### 11.2 Status Codes

| Code | Use |
|---|---|
| 200 / 201 / 202 / 204 | OK / Created / Accepted (async) / No content |
| 400 | Malformed request or validation error |
| 401 | Missing or invalid token |
| 403 | Authenticated but role too low |
| 404 | Not found (also used for cross-tenant access) |
| 409 | Conflict, limit reached, duplicate slug |
| 422 | Business rule violation |
| 429 | Rate limited |
| 5xx | Server error (never leak internals) |

### 11.3 Error Codes (machine readable)
`VALIDATION_FAILED`, `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `TOKEN_EXPIRED`, `TOKEN_REUSED`, `OTP_INVALID`, `OTP_EXPIRED`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `SLUG_TAKEN`, `ORG_LIMIT_REACHED`, `PROJECT_LIMIT_REACHED`, `LAST_OWNER`, `TARGET_NOT_VERIFIED`, `TARGET_BLOCKED`, `PLAN_LIMIT_EXCEEDED`, `TEST_ALREADY_RUNNING`, `RATE_LIMITED`, `INGEST_BACKPRESSURE`.

### 11.4 Health and Ops
`GET /healthz` (liveness), `GET /readyz` (DB reachable), `GET /metrics` (Prometheus, protected). Structured JSON logs (`slog`) with request ID, user ID, org ID.

---

## 12. API Catalog

Auth column: **Public**, **User** (Bearer or cookie), **Verified** (user with verified email), **Key** (project API key).
Everything under `/v1/organizations/:orgID/...` requires **Verified** plus the role shown.

### 12.1 Authentication: `/v1/auth`

| Method | Endpoint | Auth | Description | Request |
|---|---|---|---|---|
| POST | `/v1/auth/signup` | Public (5/min) | Register; issues cookies and tokens | email, password, first_name, last_name |
| POST | `/v1/auth/login` | Public (5/min) | Authenticate and start session | email, password |
| POST | `/v1/auth/refresh` | Public / Cookie | Rotate access token | refresh_token (cookie or body) |
| POST | `/v1/auth/logout` | User | Clear cookies; revoke refresh token; denylist access token | none |
| GET | `/v1/auth/me` | User | Session validity and verification status | none |
| POST | `/v1/auth/forgot-password` | Public (5/min) | Send 6-digit reset OTP | email |
| POST | `/v1/auth/reset-password` | Public (5/min) | Reset with OTP | email, otp, new_password |
| POST | `/v1/auth/change-password` | User (5/min) | Change password | old_password, new_password |
| POST | `/v1/auth/otp/send` | User (5/min) | Send email verification OTP | none |
| POST | `/v1/auth/otp/verify` | User (5/min) | Verify email | otp |
| GET | `/v1/auth/:provider/login` | Public | OAuth URL (google, github) | Query: origin |
| GET | `/v1/auth/:provider/callback` | Public | OAuth callback; sets cookies; redirects | Query: code, state |
| GET | `/v1/auth/sessions` | User | List active sessions (P1) | none |
| DELETE | `/v1/auth/sessions/:sessionID` | User | Revoke a session (P1) | none |

### 12.2 Users: `/v1/users`

| Method | Endpoint | Auth | Description | Request |
|---|---|---|---|---|
| GET | `/v1/users/username` | Public | Is username available | Query: u or username |
| GET | `/v1/users/me` | User | Current profile | none |
| POST | `/v1/users/username` | Verified | Set permanent username | username (3 to 20) |
| PUT | `/v1/users/update` | Verified | Update names | first_name, last_name |

### 12.3 Organizations: `/v1/organizations`

| Method | Endpoint | Role | Description | Request |
|---|---|---|---|---|
| POST | `/v1/organizations` | Verified | Create org (caller = owner; max 3 orgs per user) | name, slug, description |
| GET | `/v1/organizations` | Verified | List my orgs with role | none |
| GET | `/v1/organizations/:orgID` | viewer+ | Get org | none |
| PUT | `/v1/organizations/:orgID` | admin+ | Update name and description | name, description |
| DELETE | `/v1/organizations/:orgID` | owner | Delete org | none |

### 12.4 Members: `/v1/organizations/:orgID/members`

| Method | Endpoint | Role | Description | Request |
|---|---|---|---|---|
| POST | `/members` | admin+ | Add existing user (target must have < 3 orgs) | email, role |
| GET | `/members` | viewer+ | List members | none |
| PUT | `/members/:userID/role` | admin+ | Change role | role |
| DELETE | `/members/:userID` | admin+ | Remove member | none |
| POST | `/members/leave` | member+ | Leave org (not last owner) (P1) | none |
| POST | `/invitations` | admin+ | Invite by email (P1) | email, role |

### 12.5 Projects: `/v1/organizations/:orgID/projects`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/projects` | admin+ | Create project (max 5 per org) |
| GET | `/projects` | viewer+ | List projects |
| GET | `/projects/:projectID` | viewer+ | Get project with health summary |
| PUT | `/projects/:projectID` | admin+ | Update name, description, base_url, environment |
| DELETE | `/projects/:projectID` | admin+ | Soft delete |
| POST | `/projects/:projectID/verification` | admin+ | Start target verification; returns token and instructions |
| POST | `/projects/:projectID/verification/check` | admin+ | Check DNS or file now |
| GET | `/projects/:projectID/verification` | viewer+ | Verification status |

All routes below are prefixed `/v1/organizations/:orgID/projects/:projectID`.

### 12.6 API Registry and Discovery

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/endpoints` | viewer+ | List endpoints (filter by method, tag, source, status, search) |
| GET | `/endpoints/:endpointID` | viewer+ | Endpoint detail with sources and recent stats |
| PATCH | `/endpoints/:endpointID` | member+ | Tag, ignore, annotate |
| POST | `/discovery/openapi` | admin+ | Import OpenAPI by file or URL |
| POST | `/discovery/manifest` | admin+ | Upload route manifest JSON |
| GET | `/discovery/runs` | viewer+ | Discovery history |
| POST | `/v1/ingest/discovery` | Key (`discovery`) | CI scanner posts route manifest |

### 12.7 Ingestion (public host, API key auth)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/v1/ingest/events` | Key (`ingest`) | Batch of request events; returns 202 |
| POST | `/v1/ingest/host-metrics` | Key (`ingest`) | CPU, memory, network, disk samples (P1) |

### 12.8 Observability

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/metrics/overview` | viewer+ | RPS, total, p50/p95/p99, error rate for range |
| GET | `/metrics/timeseries` | viewer+ | Series for a metric (`rps`, `p95`, `error_rate`, ...), step, optional endpoint |
| GET | `/metrics/endpoints` | viewer+ | Per-endpoint metrics table |
| GET | `/metrics/status-codes` | viewer+ | Status distribution |
| GET | `/metrics/hosts` | viewer+ | Host metrics series |
| GET | `/metrics/stream` | viewer+ | **SSE** live metrics |

### 12.9 Load Testing

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/load-tests` | member+ | Create and queue a test (`Idempotency-Key` supported) |
| GET | `/load-tests` | viewer+ | List tests |
| GET | `/load-tests/:testID` | viewer+ | Config, status, summary |
| POST | `/load-tests/:testID/stop` | member+ | Stop a running test |
| POST | `/load-tests/:testID/rerun` | member+ | Run again with the same config |
| DELETE | `/load-tests/:testID` | admin+ | Delete test and results |
| GET | `/load-tests/:testID/progress` | viewer+ | **SSE** live progress |
| GET | `/load-tests/:testID/results` | viewer+ | Final results, per-endpoint breakdown |
| GET | `/load-tests/:testID/timeseries` | viewer+ | 1-second buckets |
| GET | `/load-tests/:testID/capacity` | viewer+ | Capacity report |
| POST | `/load-tests/compare` | viewer+ | Compare 2 to 5 tests (body: test_ids) |

**Create test body (example)**

```json
{
  "name": "Checkout ramp",
  "model": "open",
  "profile": "ramp",
  "targets": [{ "endpoint_id": "…", "method": "POST", "weight": 1, "headers": {}, "body": "{}" }],
  "start_rate": 10,
  "peak_rate": 500,
  "ramp_up_seconds": 120,
  "duration_seconds": 300,
  "max_virtual_users": 200,
  "timeout_ms": 5000
}
```

### 12.10 Diagnostics

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/diagnostics/slow-endpoints` | viewer+ | Slowest endpoints in range |
| GET | `/diagnostics/regressions` | viewer+ | Compare range vs baseline |
| GET | `/diagnostics/bottlenecks` | viewer+ | Latency vs resource correlation |

### 12.11 Dashboards

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/dashboards` | member+ | Create |
| GET | `/dashboards` | viewer+ | List |
| GET | `/dashboards/:dashboardID` | viewer+ | Get with widgets |
| PUT | `/dashboards/:dashboardID` | member+ | Update (with `version`) |
| DELETE | `/dashboards/:dashboardID` | member+ | Delete |
| POST | `/dashboards/:dashboardID/clone` | member+ | Clone |

### 12.12 Alerts, Incidents, Channels

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST / GET | `/alert-rules` | member+ / viewer+ | Create / list rules |
| GET / PUT / DELETE | `/alert-rules/:ruleID` | viewer+ / member+ / member+ | Rule detail, update, delete |
| POST | `/alert-rules/:ruleID/mute` | member+ | Mute for a period |
| GET | `/incidents` | viewer+ | List incidents |
| GET | `/incidents/:incidentID` | viewer+ | Detail with timeline |
| POST | `/incidents/:incidentID/acknowledge` | member+ | Acknowledge |
| POST | `/incidents/:incidentID/resolve` | member+ | Resolve |
| POST | `/incidents/:incidentID/comments` | member+ | Add comment |
| POST / GET | `/notification-channels` | admin+ / viewer+ | Create / list |
| PUT / DELETE | `/notification-channels/:channelID` | admin+ | Update / delete |
| POST | `/notification-channels/:channelID/test` | admin+ | Send test message |

### 12.13 API Keys and Webhooks

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api-keys` | admin+ | Create (secret shown once) |
| GET | `/api-keys` | admin+ | List (prefix, scopes, last used) |
| POST | `/api-keys/:keyID/rotate` | admin+ | Rotate |
| DELETE | `/api-keys/:keyID` | admin+ | Revoke |
| POST / GET | `/webhooks` | admin+ | Create / list |
| PUT / DELETE | `/webhooks/:webhookID` | admin+ | Update / delete |
| GET | `/webhooks/:webhookID/deliveries` | admin+ | Delivery log |
| POST | `/webhooks/:webhookID/deliveries/:deliveryID/redeliver` | admin+ | Redeliver |

### 12.14 Org-level Governance (prefix `/v1/organizations/:orgID`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/audit-logs` | admin+ | Filter by actor, action, date |
| GET | `/usage` | admin+ | Usage vs plan limits |

---

## 13. Swagger / OpenAPI

- **Tooling:** `swaggo/swag` annotations + `gofiber/swagger` handler. Generate with `swag init -g cmd/server/main.go -o docs`. Outputs `docs.go`, `swagger.json`, `swagger.yaml`.
- **Global meta in `cmd/server/main.go`:**

```go
// @title STRIM Labs API
// @version 1.0
// @description STRIM Labs backend: API observability, load testing and capacity analysis.
// @contact.name STRIM Support
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
// @description Project API key for ingestion and CI discovery.
```

- **Tier 1:** `/swagger/*` protected by Basic Auth (`SWAGGER_USER`, `SWAGGER_PASS`), `PersistAuthorization: true`.
- **Tier 2: Swagger isolation guard** in `extractToken`: Bearer header first; if `Referer` contains `/swagger/`, do **not** fall back to cookies; otherwise use the `access_token` cookie.
- **Every handler** carries `@Summary`, `@Description`, `@Tags`, `@Accept`, `@Produce`, `@Param`, `@Success`, `@Failure`, `@Security`, `@Router`. Use `{orgID}` syntax in `@Router`.
- **Response typing:** `{object} domain.Response{data=domain.Organization}`, `{data=[]domain.OrgMemberDetail}`, `{data=map[string]string}`.
- **SSE routes** use `@Produce text/event-stream` and `@Success 200 {string} string "SSE event stream"`.
- **DTO tags:** `json`, `validate`, `minLength`, `maxLength`, `enums`, `example`.

```go
type CreateOrgRequest struct {
    Name        string `json:"name" validate:"required,min=2,max=100" minLength:"2" maxLength:"100" example:"Acme Corp"`
    Slug        string `json:"slug" validate:"required,min=2,max=50" minLength:"2" maxLength:"50" example:"acme-corp"`
    Description string `json:"description" validate:"max=500" maxLength:"500" example:"Building the future"`
}
```

- **CI rule:** run `swag init` in CI and fail the build if `docs/` differs from what is committed.
- **Tags used in UI:** Auth, Users, Organizations, Members, Projects, Registry, Discovery, Ingestion, Metrics, LoadTests, Capacity, Diagnostics, Dashboards, Alerts, Incidents, Channels, APIKeys, Webhooks, Audit, Usage, System.

---

## 14. Frontend

### 14.1 Principles
1. **One clear next step** on every screen. Empty states say what to do.
2. **Progressive disclosure:** simple defaults, advanced options folded away.
3. **Live where it matters:** load tests and dashboards update via SSE without refresh.
4. **Explain results:** capacity page says why the limit is what it is, in plain language.
5. Fast, keyboard friendly, dark and light mode, mobile-readable.
6. Accessible: WCAG AA contrast, labels, focus states.

### 14.2 Stack
Next.js App Router · TypeScript (strict) · Tailwind · shadcn/ui · **TanStack Query** (server state) · **Zustand** (UI state: current org, project, filters, theme) · React Hook Form + Zod · **ECharts** or uPlot for charts · generated API client from `swagger.json` (`openapi-typescript` + `openapi-fetch`) · `@microsoft/fetch-event-source` for SSE · `next-themes` · Playwright (e2e) · Vitest + Testing Library.

### 14.3 Page Map

```
/login  /signup  /forgot-password  /reset-password  /verify-email  /oauth/callback
/onboarding                          → create org → create project → connect → first test
/orgs                                → org switcher / create
/[org]
   /overview                         → projects and health
   /projects/[project]
        /overview                    → live KPIs
        /endpoints                   → registry (+ /[endpoint])
        /discovery                   → sources: CI, OpenAPI, manifest
        /metrics                     → observability dashboard
        /infrastructure              → host metrics
        /load-tests                  → list, /new wizard, /[test] live + results
        /capacity                    → latest capacity report
        /compare                     → pick tests, see deltas
        /diagnostics
        /dashboards                  → custom dashboards (+ /[id])
        /alerts   /incidents
        /settings                    → general, verification, keys, webhooks, channels
   /members
   /audit-logs
   /usage
   /settings
/account                             → profile, password, sessions
```

### 14.4 Key Screens

- **Onboarding checklist:** ① Create org ② Add project ③ Verify domain ④ Connect (CI, OpenAPI or SDK) ⑤ Run first test.
- **Load-test wizard (3 steps):** *Choose endpoints* → *Choose goal* ("Find my limit" = step profile, "Test steady load", "Test a spike") → *Review and run*. Advanced fields hidden by default.
- **Live test page:** big RPS and p95 numbers, live chart, status-code bar, Stop button, state badge.
- **Capacity page:** one headline (**"Handles about 420 RPS. Starts failing at 560 RPS because p95 latency passes 2×."**), chart with the break marked, and a "how we calculated this" panel.

### 14.5 State and Data Rules
- Query keys always include `orgId` and `projectId`.
- Org and project come from the URL; Zustand only mirrors them for fast access.
- Mutations invalidate precise keys. Optimistic updates for tags, dashboards.
- Global error handler maps `error_code` to friendly messages; 401 triggers one refresh attempt then redirect to login.
- SSE hook reconnects with backoff and stops when the tab is hidden.

---

## 15. Non-Functional Requirements

| Area | Target |
|---|---|
| API latency (non-ingest reads) | p95 < 200 ms, p99 < 500 ms |
| Ingest endpoint | p95 < 50 ms; ≥ 5,000 events/s per instance (to be validated) |
| Load engine | ≥ 5,000 RPS per worker on a modest 2 vCPU instance (to be validated); lag detection when exceeded |
| Dashboard query | p95 < 800 ms for 24 h range using roll-ups |
| Availability | 99.9% API target |
| Scalability | Stateless API; workers scale horizontally; DB is the shared state |
| Data durability | Daily backups; point-in-time recovery if the cloud DB offers it |
| Security | OWASP ASVS L2 as the checklist |
| Observability of STRIM itself | Prometheus metrics, structured logs, request IDs; STRIM monitors its own API ("dogfooding") |
| Testing | ≥ 70% coverage on services; integration tests with real Postgres (testcontainers); cross-tenant tests |
| Graceful shutdown | Drain HTTP, finish batches, mark running tests as `interrupted` or resume |

## 16. Success Metrics

- Time from signup to first capacity report: **< 15 minutes**.
- Capacity estimate within **±15%** of the known limit on a reference app with a controlled bottleneck.
- Zero cross-tenant leaks in the test suite.
- Swagger covers **100%** of public routes.
- Load generator reports < 1% schedule lag at its rated RPS.

## 17. Risks

| Risk | Mitigation |
|---|---|
| Scope too large | Follow phases; ship the core loop first |
| Load tool misused against third parties | Verification, SSRF block, caps, audit, kill switch |
| In-memory cache stale across instances | Short TTL + `LISTEN/NOTIFY` invalidation |
| Free cloud DB limits (storage, connections, pausing) | Roll-ups, retention, pooled connections, adapter interface to move later |
| Load generator is the bottleneck | Lag detection, tuned transport, documented per-instance limits |
| Capacity estimate is wrong or noisy | Consecutive-window rule, confidence score, show thresholds, validate on a reference app |
| Ingest overload | Bounded buffers, backpressure, batch writes |

## 18. Open Questions

1. Hosting target for API and worker (Fly.io, Railway, AWS, GCP Cloud Run)? Cloud Run suits the API, but long load tests need a worker that is not scaled to zero.
2. Which email provider (Resend, SES, Postmark) for OTPs and alerts?
3. Which languages get an SDK or CI scanner first (Go and Node suggested)?
4. Will plans and limits (RPS caps, retention) be fixed for v1 or configurable per org?
5. Should members without an account be invitable in v1 (ORG-7), or is add-existing-user enough?

---

*Next: see `Implementation_phases.md` for the build order.*