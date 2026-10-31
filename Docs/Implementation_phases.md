# STRIM Labs: Implementation Phases

Companion to `PRD.md`. Build in this order. Each phase ends with something **working and demoable**, so you always have a usable project to show.

**Legend:** `[ ]` task · **Exit** = how you know the phase is done · **Demo** = what you can show.

---

## How to Read This Plan

```
Phase 0  Foundation            ┐
Phase 1  Auth                  │
Phase 2  Users, Orgs, RBAC     ├── "Platform"
Phase 3  Projects + Verify     ┘
Phase 4  API Registry          ┐
Phase 5  Ingestion + TS store  ├── "Observe"
Phase 6  Observability + SSE   ┘
Phase 7  Load Engine           ┐
Phase 8  Capacity + Compare    ├── "Test"   ← the flagship
Phase 9  Diagnostics           ┘
Phase 10 Alerts + Incidents    ┐
Phase 11 Keys, Webhooks,       ├── "Operate"
         Audit, Usage          │
Phase 12 Dashboards            ┘
Phase 13 Hardening + Deploy
```

**Frontend runs alongside every phase** (each phase lists its frontend slice). Never build all the backend first.

**MVP = Phases 0 to 8.** That alone is a complete, impressive project. Phases 9 to 13 are upgrades.

| Phase | Name | Rough time (1 dev) |
|---|---|---|
| 0 | Foundation | 3 to 4 days |
| 1 | Auth | 5 to 7 days |
| 2 | Users, Orgs, RBAC | 5 to 6 days |
| 3 | Projects and verification | 3 to 4 days |
| 4 | API registry and discovery | 5 to 6 days |
| 5 | Ingestion and time-series | 5 to 7 days |
| 6 | Observability and SSE | 5 to 6 days |
| 7 | Load engine | 8 to 10 days |
| 8 | Capacity and comparison | 5 to 6 days |
| 9 | Diagnostics | 3 to 4 days |
| 10 | Alerts and incidents | 6 to 7 days |
| 11 | Keys, webhooks, audit, usage | 5 to 6 days |
| 12 | Dashboards | 4 to 5 days |
| 13 | Hardening and deploy | 5 to 7 days |

Total about 10 to 13 weeks solo. MVP (0 to 8) is about 6 to 8 weeks.

---

## Definition of Done (applies to every phase)

- [ ] Code follows layers: handler → service → repository
- [ ] Every new endpoint has full Swagger annotations; `swag init` run and committed
- [ ] DTOs have `validate`, `example` tags
- [ ] Responses use the `domain.Response` envelope
- [ ] Unit tests for services; integration tests for repositories and routes
- [ ] Cross-tenant test for every new tenant-scoped route
- [ ] Migration up and down both work
- [ ] Audit log entries for sensitive actions (once Phase 11 exists, backfill)
- [ ] CI green (lint, vet, test, swagger drift check)
- [ ] Frontend slice works end to end against the real API

---

## Repository Layout

```
strim/
├── backend/
│   ├── cmd/
│   │   ├── server/main.go        # API process (+ swagger meta)
│   │   └── worker/main.go        # worker process
│   ├── internal/
│   │   ├── config/
│   │   ├── domain/               # structs, DTOs, errors, Response
│   │   ├── http/
│   │   │   ├── handlers/
│   │   │   ├── middleware/
│   │   │   └── router.go
│   │   ├── service/
│   │   ├── repository/
│   │   ├── cache/
│   │   ├── sse/
│   │   ├── ingest/
│   │   ├── discovery/
│   │   ├── loadengine/
│   │   ├── analysis/
│   │   ├── alerts/
│   │   ├── notify/
│   │   └── platform/             # db, logger, mailer, clock, ids
│   ├── db/migrations/
│   ├── docs/                     # generated swagger
│   ├── Dockerfile
│   ├── Makefile
│   └── .env.example
├── frontend/
│   ├── src/app/                  # routes
│   ├── src/components/ui/        # shadcn
│   ├── src/components/           # shared + feature components
│   ├── src/features/             # auth, orgs, projects, registry, metrics, loadtests...
│   ├── src/lib/api/              # generated client, fetch wrapper
│   ├── src/stores/               # zustand
│   ├── src/hooks/
│   └── e2e/                      # playwright
├── .github/workflows/
├── docker-compose.yml
├── PRD.md
└── Implementation_phases.md
```

**Suggested libraries (backend):** Fiber v2, `pgx/v5`, `goose` or `golang-migrate`, `sqlc` (or hand-written pgx), `golang-jwt/jwt/v5`, `alexedwards/argon2id`, `go-playground/validator/v10`, `swaggo/swag` + `gofiber/swagger`, `otter` or `ristretto`, `HdrHistogram/hdrhistogram-go`, `google/uuid` (v7), `log/slog`, `testcontainers-go`, `golang.org/x/oauth2`, `prometheus/client_golang`.

---

# PHASE 0: Foundation

**Goal:** A running skeleton that every later phase plugs into.

### Backend
- [ ] Init Go module, folder layout above, `Makefile` (`run`, `test`, `lint`, `swag`, `migrate-up`, `migrate-down`)
- [ ] Config loader (env → struct, validated on startup, fail fast)
- [ ] Structured logger (`slog` JSON) with request ID
- [ ] `domain.Response` envelope + `AppError` type with `error_code`, HTTP status mapping
- [ ] Central error handler (Fiber `ErrorHandler`): never leak internals
- [ ] Middleware: request ID, recover, logger, CORS allowlist, security headers, body-size limit, timeout
- [ ] Postgres connection pool (`pgx`), health checks `/healthz`, `/readyz`
- [ ] Migration tooling and first migration (`users` placeholder or extensions: `pgcrypto`)
- [ ] UUIDv7 helper, clock interface (for testable time)
- [ ] Swagger global meta, `/swagger/*` behind Basic Auth, `PersistAuthorization: true`
- [ ] `docker-compose.yml` (local Postgres), `.env.example`
- [ ] GitHub Actions: lint (`golangci-lint`), test, build, `swag init` drift check

### Frontend
- [ ] Next.js (App Router, strict TS), Tailwind, shadcn/ui init, `next-themes`
- [ ] TanStack Query provider, Zustand store skeleton, error boundary, toast system
- [ ] App shell: sidebar, top bar, org switcher placeholder, dark mode
- [ ] API client: `openapi-typescript` from `swagger.json`, fetch wrapper with refresh-once on 401
- [ ] ESLint, Prettier, Vitest, Playwright setup, CI job

**Exit:** `GET /healthz` works, Swagger UI loads (behind Basic Auth), CI is green, frontend shell renders.
**Demo:** Swagger page and the empty app shell.

---

# PHASE 1: Authentication and Sessions

**Goal:** Secure signup, login, sessions, OAuth. Mirrors `/v1/auth` from the PRD.

### Database
- [ ] `users` (id, email unique citext, password_hash, first_name, last_name, username unique nullable, is_verified, created_at...)
- [ ] `refresh_tokens` (id, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by, user_agent, ip)
- [ ] `otp_codes` (user_id/email, purpose, code_hash, expires_at, attempts, used_at)
- [ ] `oauth_accounts` (provider, provider_user_id, user_id)

### Backend
- [ ] Password hashing with argon2id; password policy (min 8, not common)
- [ ] JWT service: access (15 min), refresh (7 days), claims include `sub`, `jti`, `sid`
- [ ] Cookie helper: HttpOnly, Secure, SameSite=Lax, path and domain config
- [ ] `POST /signup`, `POST /login` (+ 5/min limiter, lockout after repeated failures)
- [ ] `POST /refresh` with **rotation** and **reuse detection** (reuse revokes family)
- [ ] `POST /logout`: revoke refresh token, add `jti` to in-memory denylist until expiry
- [ ] `GET /me`
- [ ] OTP service: 6 digits, hashed, 10 min expiry, max 5 attempts, resend cooldown
- [ ] `forgot-password`, `reset-password` (revokes all sessions), `change-password`
- [ ] `otp/send`, `otp/verify`
- [ ] Mailer interface + SMTP/Resend adapter + console adapter for dev
- [ ] OAuth Google (state stored in signed cookie, PKCE), callback sets cookies and redirects; account linking by verified email
- [ ] Auth middleware `extractToken`: Bearer → Swagger-referer guard → cookie
- [ ] Middleware variants: `RequireAuth`, `RequireVerified`
- [ ] CSRF protection for cookie-authenticated mutating requests (`Origin` check)
- [ ] Swagger annotations on all routes, including `BearerAuth` and examples
- [ ] Tests: expired token, tampered token, refresh reuse, OTP brute force, rate limit

### Frontend
- [ ] Pages: login, signup, forgot, reset, verify-email, OAuth callback
- [ ] Form validation (React Hook Form + Zod), inline errors from `error_code`
- [ ] Auth store (user, isAuthenticated); `useMe()` query; route guards (middleware.ts)
- [ ] "Continue with Google" button
- [ ] Account page: change password

**Exit:** a user can sign up, verify email, log in, refresh silently, log out, reset a password, and sign in with Google.
**Demo:** full auth flow in browser, and in Swagger with the Authorize button.

---

# PHASE 2: Users, Organizations, Members, RBAC

**Goal:** Multi-tenancy exactly as specified: orgs, roles, member management, limit of 3 orgs per user.

### Database
- [ ] `organizations` (id, name, slug unique, description, created_by, deleted_at)
- [ ] `org_members` (org_id, user_id, role enum, joined_at, PK(org_id, user_id), index on user_id)
- [ ] Enable **Row-Level Security** pattern on tenant tables (policy using `current_setting('app.current_org_id')`); helper to run a request in a tx with `SET LOCAL`

### Backend
- [ ] Users: `GET /users/username`, `GET /users/me`, `POST /users/username` (one-time), `PUT /users/update`
- [ ] Orgs: create (transaction: insert org + owner membership + **count check ≤ 3 orgs** using advisory lock on user id), list, get, update, delete (owner only)
- [ ] Members: add by email (check target's org count < 3), list, change role, remove
- [ ] Rules: last owner protected; admin cannot touch owner; cannot demote self below allowed level
- [ ] Tenant middleware: resolve `:orgID` → load membership + role (cached 60 s) → put in context
- [ ] `RequireRole(min)` middleware (viewer < member < admin < owner)
- [ ] Cache layer: membership cache with invalidation on role change/remove
- [ ] Return `404` for orgs the user doesn't belong to
- [ ] Reserved slug list; slug format validation
- [ ] Swagger for all routes
- [ ] Tests: role matrix table test (every route × every role), limit-of-3 race test, cross-tenant tests

### Frontend
- [ ] Org switcher (dropdown, create org dialog), Zustand `currentOrg`
- [ ] `/orgs` list, create form with live slug check
- [ ] Members page: table, add member dialog, role select, remove confirm
- [ ] Role-aware UI: hide or disable actions the role can't do (UI hint only; backend enforces)
- [ ] Username setup prompt; profile page
- [ ] Friendly message for `ORG_LIMIT_REACHED`

**Exit:** role matrix tests all pass; a user cannot join a 4th org; cross-tenant access returns 404.
**Demo:** two users in one org with different roles seeing different UI.

---

# PHASE 3: Projects and Target Verification

**Goal:** Projects (max 5 per org) and proof of domain ownership, which gates load testing later.

### Database
- [ ] `projects` (id, org_id, name, slug, description, base_url, environment, verified_at, deleted_at)
- [ ] `project_verifications` (project_id, method, token, status, checked_at, expires_at)

### Backend
- [ ] Project CRUD with **max 5 per org** (transaction + advisory lock on org id)
- [ ] URL validation and normalization; reject private and internal hosts at save time
- [ ] Verification: generate token; check DNS TXT and `/.well-known/strim-verify.txt`; status endpoint; re-verify schedule
- [ ] Soft delete + purge job (worker, 7-day grace)
- [ ] Project summary in `GET /projects/:id` (counts placeholder for now)
- [ ] Cache: project settings (60 s) with invalidation
- [ ] Swagger and tests (limit race, SSRF validation cases)

### Frontend
- [ ] Projects list (cards), create dialog, empty state
- [ ] Project settings: general, **verification wizard** (copy-to-clipboard DNS record, "Check now")
- [ ] Project switcher; breadcrumb: Org / Project
- [ ] Onboarding checklist component (steps tick off automatically as phases land)

**Exit:** can create 5 projects, 6th is rejected; verification flips to verified when the DNS or file check passes.
**Demo:** create project, verify a domain you own.

---

# PHASE 4: API Registry and Discovery

**Goal:** A central list of endpoints that fills itself.

### Database
- [ ] `api_endpoints` (project_id, method, path_template, service, tags[], status, first_seen, last_seen, unique(project_id, method, path_template))
- [ ] `endpoint_sources` (endpoint_id, source enum: openapi/ci/manifest/runtime, last_seen, metadata jsonb)
- [ ] `discovery_runs` (project_id, source, status, found, created, updated, error, started_at)

### Backend
- [ ] **Path normalizer** (`/users/123` → `/users/{id}`; UUIDs, numeric IDs, hashes); table-driven tests
- [ ] OpenAPI importer (`kin-openapi`): supports 2.0 and 3.x, file upload or URL (with SSRF guard)
- [ ] Manifest format (simple JSON) + parser
- [ ] Upsert logic: merge by (method, path_template), append sources, update `last_seen`
- [ ] `GET /endpoints` with filters, cursor pagination, search
- [ ] `GET /endpoints/:id`, `PATCH` (tags, ignore, note)
- [ ] `discovery/runs` listing
- [ ] Stale marker job (30 days not seen)
- [ ] Swagger and tests

### CI scanner (small separate deliverable)
- [ ] GitHub Action `strim-labs/scan` (or composite action + small Go CLI) that detects routes for **one framework first** (Go Fiber or Express), emits manifest JSON, posts to `/v1/ingest/discovery` using an API key (key system arrives in Phase 11, so use a temporary project token now, then migrate)
- [ ] Example workflow in README

### Frontend
- [ ] Endpoints page: table with method badges, search, filters, source chips
- [ ] Endpoint detail drawer
- [ ] Discovery page: "Import OpenAPI" (upload or URL), "Connect CI" instructions, run history
- [ ] Empty state: "No endpoints yet. Choose how to discover them."

**Exit:** import a real OpenAPI file and see endpoints; scanner action populates the registry from a sample repo.
**Demo:** push to a sample repo, watch endpoints appear.

---

# PHASE 5: Telemetry Ingestion and Time-Series Storage

**Goal:** Accept lots of request events quickly and store them in a query-friendly way.

### Database / storage
- [ ] Define `TimeSeriesStore` interface (`WriteEvents`, `QueryRange`, `QueryRollup`, `DropOlderThan`)
- [ ] **Adapter A (default): partitioned Postgres**
  - [ ] `request_events_raw` partitioned by day (project_id, ts, method, route, status, duration_ms, bytes, is_error)
  - [ ] `request_rollup_1m`, `request_rollup_1h` (project_id, endpoint_key, bucket, count, errors, sum_ms, min, max, histogram `int[]`/bytea, status_counts jsonb)
  - [ ] Partition manager job: create tomorrow's partition, drop expired (raw 7d, 1m 30d, 1h 13m)
- [ ] (Later, optional) adapters for Timescale / ClickHouse

### Backend
- [ ] API key verification middleware (temporary: project ingest token; full API keys in Phase 11) with cached lookup
- [ ] `POST /v1/ingest/events`: gzip support, ≤1,000 events, ≤1 MB, schema validation, clock-skew tolerance
- [ ] Path normalization using the registry (runtime discovery: new routes auto-added with source `runtime`)
- [ ] Bounded channel buffer → batcher (500 events or 1 s) → `COPY` into raw table
- [ ] Backpressure: full buffer → `429/503` + `Retry-After`; metrics for buffer depth, drops
- [ ] Roll-up worker (every minute: raw → 1m; every hour: 1m → 1h) using **merged histograms**
- [ ] Histogram package: fixed log buckets, `Add`, `Merge`, `Quantile`; thorough unit tests (accuracy vs exact percentile)
- [ ] Host metrics ingest endpoint + table (P1: can be postponed)
- [ ] Graceful shutdown: flush buffer before exit
- [ ] Load test the ingest endpoint itself (use `k6` or your own engine later) and record the numbers for your resume

### Tiny SDKs (to produce real data)
- [ ] Go Fiber middleware, Express middleware: batch and send events asynchronously
- [ ] A sample "demo app" that you deliberately make slow at a known RPS (used for validation in Phase 8)

### Frontend
- [ ] "Connect your app" page: pick language, copy snippet, shows "Waiting for first event..." then success state (polls or SSE)

**Exit:** demo app sends traffic; rows appear; roll-ups are correct; ingest sustains target events/s locally with no data loss under normal load.
**Demo:** curl or SDK sends events, and a quick SQL query shows percentiles.

---

# PHASE 6: Observability Dashboard and SSE

**Goal:** The Grafana-like view, live.

### Backend
- [ ] Query service picks the right table by range (raw for ≤15 min, 1m for ≤24 h, 1h beyond)
- [ ] `GET /metrics/overview`, `/timeseries`, `/endpoints`, `/status-codes`, `/hosts`
- [ ] Percentiles computed from merged histograms; RPS from counts; error rate; timeouts
- [ ] Endpoint health classifier (healthy / degraded / failing, configurable thresholds)
- [ ] Short result cache (5 to 15 s) keyed by (project, query hash)
- [ ] **SSE hub** (`internal/sse`): topics, bounded per-client channels, heartbeat, graceful close, `Last-Event-ID`
- [ ] `GET /metrics/stream`: pushes a fresh overview every 2 to 5 s
- [ ] Postgres `LISTEN/NOTIFY` bridge for multi-instance fan-out (direct connection)
- [ ] Swagger (including SSE docs), tests with synthetic data, SSE test with slow client

### Frontend
- [ ] Project overview: KPI cards (RPS, total, p95, error rate) + sparklines
- [ ] Metrics page: time-range picker, auto-refresh toggle, charts (RPS, latency percentiles, errors), status-code chart, per-endpoint table (sortable)
- [ ] Infrastructure page: CPU, memory, network charts + empty state "Install the agent"
- [ ] SSE hook (`useEventStream`) with reconnect and backoff; pauses when tab hidden
- [ ] Skeleton loaders, error states, "no data yet" states

**Exit:** charts match known synthetic data exactly; live mode updates without refresh; SSE survives reconnects.
**Demo:** run demo app traffic and watch the dashboard move live.

---

# PHASE 7: Load Testing Engine

**Goal:** The centerpiece. Create, run, watch and stop load tests safely.

### Database
- [ ] `jobs` (id, type, payload, status, run_at, locked_by, locked_at, attempts, last_error)
- [ ] `load_tests` (id, org_id, project_id, name, config jsonb, status, created_by, started_at, finished_at, error)
- [ ] `load_test_results` (test_id, summary jsonb, per_endpoint jsonb, histogram bytea)
- [ ] `load_test_timeseries` (test_id, second, offered, achieved, errors, p50, p95, p99, status_counts)

### Engine (`internal/loadengine`)
- [ ] Config model + validation (profile, model, rates, durations, caps by plan)
- [ ] **Scheduler**: generates send times for sustained, ramp, spike, step profiles (pure functions, heavily unit-tested)
- [ ] **Open-model runner**: dispatches by schedule, latency measured from *intended* send time (avoids coordinated omission)
- [ ] **Closed-model runner**: N virtual users with think time
- [ ] Tuned `http.Transport`; per-request timeout; body and header templating (simple)
- [ ] Per-second aggregator with HdrHistogram, merged across workers
- [ ] `generator_lag` detection and result flag "generator saturated"
- [ ] Cancellation (`context`), graceful drain on stop
- [ ] **Safety layer**: project must be verified, SSRF guard with IP pinning, redirect limits, caps (RPS, VUs, duration, concurrent tests per org), kill switch
- [ ] Encrypt stored auth headers (AES-GCM)

### Worker
- [ ] `strim-worker` claims jobs with `SELECT ... FOR UPDATE SKIP LOCKED`; heartbeats; reclaim stale jobs
- [ ] Publishes progress each second to the SSE bridge (`NOTIFY`) and writes timeseries rows in batches
- [ ] On finish: write results, trigger capacity analysis (Phase 8), emit event for webhooks (Phase 11)
- [ ] On worker crash: mark test `failed (interrupted)`

### API
- [ ] `POST /load-tests` (+ `Idempotency-Key`), `GET` list/detail, `POST /stop`, `POST /rerun`, `DELETE`
- [ ] `GET /progress` (SSE), `GET /results`, `GET /timeseries`
- [ ] Swagger and tests (use an in-process fake target server: known latency, errors, rate limits)

### Frontend
- [ ] Load tests list: status badges, filters
- [ ] **3-step wizard** (Choose endpoints → Choose goal → Review and run), advanced options folded
- [ ] Live test page: big numbers, live chart (offered vs achieved RPS, p95), status-code bar, Stop button
- [ ] Results page: summary, latency distribution, per-endpoint table
- [ ] Block start with a clear call to action if the project isn't verified

**Exit:** engine hits a local fake server at the configured rate with less than 1% schedule error; stop works within 2 s; unverified or private targets are refused; unit tests prove the scheduler shapes.
**Demo:** run a ramp test against the demo app and watch the live chart.

---

# PHASE 8: Capacity Analysis and Comparison

**Goal:** Answer "how much can my app handle?" and compare runs.

### Backend
- [ ] `internal/analysis`: windowing, health rules, sustainable RPS, breaking point, reason, confidence (see PRD 8.4)
- [ ] Configurable thresholds per project (defaults: p95 ≤ 2× baseline, errors ≤ 1%, achieved ≥ 95% of offered)
- [ ] Handle edge cases: breaking point never reached; noisy runs; generator lag flag lowers confidence
- [ ] `capacity_reports` table; computed automatically at test end
- [ ] `GET /load-tests/:id/capacity`
- [ ] `POST /load-tests/compare` (2 to 5 tests): avg throughput, peak throughput, p95, error rate, deltas
- [ ] **Validation harness:** demo app with a known bottleneck (e.g. fixed worker pool or DB sleep). Run step tests and assert the estimate is within ±15% of the known limit. Keep this as an automated test and put the numbers in the README
- [ ] Swagger and tests with synthetic curves (clean, noisy, never-breaks, breaks immediately)

### Frontend
- [ ] Capacity page: plain-language headline, chart with sustainable and breaking markers, "how we calculated" panel, confidence badge
- [ ] "Find my limit" shortcut in the wizard (uses step profile)
- [ ] Compare page: choose tests, side-by-side table with deltas, regression highlights, overlay chart

**Exit:** validation harness passes; compare shows correct deltas.
**Demo:** "My demo app handles ~X RPS; STRIM said Y." This is your resume headline.

> ✅ **MVP complete here.**

---

# PHASE 9: Diagnostics

### Backend
- [ ] `GET /diagnostics/slow-endpoints` (rank by p95, volume weighted)
- [ ] `GET /diagnostics/regressions` (window vs baseline; significance test on histograms or simple threshold)
- [ ] `GET /diagnostics/bottlenecks` (align latency spikes with CPU or memory and with load-test phases; produce hints, clearly labeled as hints)
- [ ] Swagger and tests

### Frontend
- [ ] Diagnostics page: slowest endpoints, regressions list with "compare" link, bottleneck timeline with annotations

**Exit:** injected slowdown in demo app is flagged as a regression.

---

# PHASE 10: Alerts, Incidents, Notification Channels

### Database
- [ ] `alert_rules`, `alert_states`, `incidents`, `incident_events`, `notification_channels`, `notifications_log`

### Backend
- [ ] Rule model: metric, scope, operator, threshold, window, `for` duration, severity
- [ ] Evaluator in worker (every 30 s; leader-safe using a DB advisory lock so only one instance evaluates a given project)
- [ ] State machine `ok → pending → firing → resolved`; hysteresis to avoid flapping
- [ ] Incident auto-open and auto-resolve; acknowledge, resolve, comment, timeline
- [ ] Channels: email, Slack webhook, generic webhook; test-send; retry with backoff
- [ ] Mute rules; optimistic `version` on updates
- [ ] Swagger and tests (fake clock for state machine)

### Frontend
- [ ] Alert rule builder (simple form with preview of current value)
- [ ] Incidents list and detail timeline; acknowledge/resolve buttons
- [ ] Channels settings with "Send test"

**Exit:** forcing high error rate opens an incident and sends a Slack message; recovery resolves it.

---

# PHASE 11: API Keys, Webhooks, Audit Logs, Usage

### Backend
- [ ] `api_keys`: prefix + SHA-256 hash, scopes, expiry, last_used; create (show once), list, rotate, revoke; replace the temporary tokens from Phases 4 and 5; cached lookup with invalidation
- [ ] `webhooks`, `webhook_deliveries`: HMAC-SHA256 signature + timestamp header, retries with exponential backoff, delivery log, redeliver
- [ ] Event bus (in-process) → webhook dispatcher: `test.completed`, `test.failed`, `incident.opened`, `incident.resolved`, `endpoint.discovered`
- [ ] `audit_logs` (append-only; actor, action, resource, ip, user_agent, before/after jsonb); write from services via an `Audit` helper; **backfill** earlier sensitive actions (login, role change, project delete, test start, key create)
- [ ] `GET /audit-logs` with filters and cursor pagination
- [ ] `usage_counters` (daily per org): events ingested, test minutes, requests generated; `GET /usage` with plan limits
- [ ] Enforce plan limits in ingest and load-test creation (`PLAN_LIMIT_EXCEEDED`)
- [ ] Swagger and tests

### Frontend
- [ ] Settings → API keys (copy-once modal), Webhooks (delivery log, redeliver), Audit logs (filters, export CSV), Usage (progress bars)

**Exit:** old temporary tokens removed; revoked key stops working within cache TTL; every sensitive action appears in the audit log.

---

# PHASE 12: Customizable Dashboards

### Backend
- [ ] `dashboards` (id, project_id, name, layout jsonb, version)
- [ ] Widget schema validation (type, query, options); allowed query templates only (no raw SQL from client)
- [ ] CRUD + clone + default dashboard seeded per project
- [ ] Swagger and tests

### Frontend
- [ ] Grid layout editor (drag and resize), widget picker (time series, stat, table, status pie), widget config panel, save with version conflict message
- [ ] Share link (view only for org members)

**Exit:** create, edit and clone a dashboard; conflict handling works.

---

# PHASE 13: Hardening, Performance, Deployment

### Security
- [ ] Review against OWASP ASVS L2 checklist; fix gaps
- [ ] Automated cross-tenant test sweep over **every** route (generated from router)
- [ ] `govulncheck`, `gosec`, Trivy container scan, `npm audit` in CI
- [ ] Secrets review, log redaction review, security headers verification
- [ ] Penetration-style tests: SSRF bypass attempts (DNS rebinding, redirects, IPv6), JWT tampering, CSRF

### Performance
- [ ] Benchmarks and pprof for ingest and engine; record numbers in README
- [ ] DB: `EXPLAIN` on hot queries, add indexes, tune pool sizes
- [ ] Cache hit-rate metrics; tune TTLs
- [ ] Load test STRIM with STRIM (dogfooding) and publish the capacity report

### Reliability and Ops
- [ ] Graceful shutdown everywhere; worker resume or fail-safe on restart
- [ ] Prometheus metrics, dashboards for STRIM's own health; alerts on STRIM itself
- [ ] Backup and restore drill; migration rollback drill
- [ ] Dockerfile (multi-stage, distroless, non-root), image size check
- [ ] Deploy: API (2 instances), worker (1+ instances), frontend (Vercel or similar), cloud Postgres; secrets in platform store
- [ ] Staging and production environments; CD on tag
- [ ] Runbook: common incidents and how to fix them

### Documentation
- [ ] README with architecture diagram, setup in 5 minutes, screenshots/GIFs
- [ ] Swagger examples complete; changelog
- [ ] 2-minute demo video

**Exit:** deployed, documented, benchmarked, secure; one-command local setup.

---

## Testing Strategy

| Level | What | Tools |
|---|---|---|
| Unit | Services, scheduler, histogram, normalizer, capacity algorithm, state machines | `testing`, `testify`, fake clock |
| Integration | Repositories and routes against real Postgres | `testcontainers-go` |
| Contract | Swagger matches reality; frontend client regenerates without diff | `swag` drift check, `openapi-typescript` |
| Security | Cross-tenant sweep, RBAC matrix, SSRF cases | table-driven tests |
| Load | Ingest and API under load | k6 now, STRIM later |
| E2E | Signup → org → project → discover → test → capacity | Playwright |

## Branching and Releases
- `main` always deployable; short-lived feature branches; PR per task group
- Conventional commits; tag per phase (`v0.1-auth`, `v0.2-orgs`, ...)
- Migrations are forward-only in production; each has a tested down for dev

## Environment Variables (starter list)

```
APP_ENV, PORT, FRONTEND_URL, ALLOWED_ORIGINS
DATABASE_URL, DATABASE_DIRECT_URL      # pooled for queries, direct for LISTEN/NOTIFY
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ACCESS_TTL, REFRESH_TTL
COOKIE_DOMAIN, COOKIE_SECURE
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL
SMTP_* or RESEND_API_KEY, MAIL_FROM
SWAGGER_USER, SWAGGER_PASS
ENCRYPTION_KEY                         # AES-GCM for stored headers
INGEST_BUFFER_SIZE, INGEST_BATCH_SIZE, INGEST_FLUSH_MS
LOADTEST_MAX_RPS, LOADTEST_MAX_VUS, LOADTEST_MAX_SECONDS
RETENTION_RAW_DAYS, RETENTION_1M_DAYS, RETENTION_1H_DAYS
```

## Suggested First Week (so you can start today)

| Day | Do |
|---|---|
| 1 | Repo, layout, config, logger, envelope, error handler, health, CI |
| 2 | Swagger meta + Basic Auth guard, DB pool, migrations, docker-compose |
| 3 | Frontend shell, API client generation, auth pages (UI only) |
| 4 | Users table, signup, login, JWT, cookies |
| 5 | Refresh rotation, logout, `/me`, auth middleware with Swagger guard |
| 6 | OTP + forgot/reset password, mail adapter |
| 7 | Wire frontend auth fully, tests, tag `v0.1-auth` |

## Resume Checkpoints

| After phase | You can claim |
|---|---|
| 2 | Multi-tenant RBAC with Postgres RLS and enforced tenant limits |
| 5 | Telemetry pipeline with batched ingestion, backpressure, and mergeable-histogram roll-ups (add measured events/s) |
| 7 | Concurrent load engine with open/closed models, coordinated-omission-safe latency (add measured RPS per node) |
| 8 | Capacity estimator validated against a known-limit app (add ±% accuracy) |
| 13 | Deployed, benchmarked, security-reviewed, fully documented API |

---

*Start with Phase 0. When you're ready, tell me and we'll write the code for it: project skeleton, config, envelope, error handler, Swagger setup and CI.*