# Strim — Master Task Tracker

Status: 🚀 In Planning / Ready to Execute  
Last Updated: 2026-09-29  

---

## 📌 Roadmap Overview
- [ ] **Phase 1**: Foundations, Single `.env`, Auth (Google OAuth + Password) & Multi-Tenancy Core
- [ ] **Phase 2**: Runtime Observability & Ingestion Hardening (Anti-DDoS, Health 0-100, Topology)
- [ ] **Phase 3**: Configuration, Cache & Safe Replay (SSRF Protection, Sanitization)
- [ ] **Phase 4**: Simulations, Load Testing & What-If Engine (Breaking Point Analysis)
- [ ] **Phase 5**: Change Plans, Guardrails, Incidents & 1-Click Rollback
- [ ] **Phase 6**: AI Intelligence, Integrations & Billing
- [ ] **Phase 7**: Production-Grade SDK Hardening (Fail-open, Bounded Buffer, Rollout Evaluation)
- [ ] **Phase 8**: Frontend Dribbble Modern UI Transformation (`apps/web`)

---

## 📂 Phase 1: Foundations, Single `.env`, Auth & Multi-Tenancy Core
*Test Guide: `test-phase-1.md`*

- [ ] **Environment & Cleanup**
  - [ ] Consolidate all configuration to a single root `.env` / `.env.example`
  - [ ] Add Google OAuth configuration (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`)
  - [ ] Decommission and remove `apps/demo-checkout` from monorepo workspaces
- [ ] **Module: `auth`**
  - [ ] `apps/server/src/modules/auth/schemas.ts`: Zod schemas for login, register, Google OAuth, session refresh, invite accept
  - [ ] `apps/server/src/modules/auth/routes.ts`: Contract-first routes using `@hono/zod-openapi`
  - [ ] `apps/server/src/modules/auth/handlers.ts`: Controllers with secure HTTP-only cookies and Bearer tokens
  - [ ] `apps/server/src/modules/auth/service.ts`: Business logic (Argon2id hashing, Google OAuth profile fetch, session token generation)
  - [ ] `apps/server/src/modules/auth/types.ts`: Auth interfaces
  - [ ] `apps/server/src/modules/auth/index.ts`: Module export
- [ ] **Module: `directory`**
  - [ ] `apps/server/src/modules/directory/schemas.ts`: Zod schemas for Orgs, Workspaces, Projects, Applications, Environments, Teams, Memberships
  - [ ] `apps/server/src/modules/directory/routes.ts`: OpenAPI route definitions
  - [ ] `apps/server/src/modules/directory/handlers.ts`: Handlers with tenant context extraction
  - [ ] `apps/server/src/modules/directory/service.ts`: Prisma queries with strict `organizationId` scoping
  - [ ] `apps/server/src/modules/directory/types.ts`: Domain models
  - [ ] `apps/server/src/modules/directory/index.ts`: Module export
- [ ] **Module: `keys`**
  - [ ] `apps/server/src/modules/keys/schemas.ts`: Scoped API key creation & revocation schemas
  - [ ] `apps/server/src/modules/keys/routes.ts`: OpenAPI contracts
  - [ ] `apps/server/src/modules/keys/handlers.ts`: Handlers
  - [ ] `apps/server/src/modules/keys/service.ts`: Hashed API key generation & scope validation
  - [ ] `apps/server/src/modules/keys/types.ts`: Types
  - [ ] `apps/server/src/modules/keys/index.ts`: Module export
- [ ] **Module: `audit`**
  - [ ] `apps/server/src/modules/audit/schemas.ts`: Audit querying and filter schemas
  - [ ] `apps/server/src/modules/audit/routes.ts`: OpenAPI contracts
  - [ ] `apps/server/src/modules/audit/handlers.ts`: Handlers (read-only; writes are internal/middleware)
  - [ ] `apps/server/src/modules/audit/service.ts`: Append-only audit logger and query engine
  - [ ] `apps/server/src/modules/audit/types.ts`: Audit event types
  - [ ] `apps/server/src/modules/audit/index.ts`: Module export
- [ ] **OpenAPI & Swagger UI Verification**
  - [ ] Mount `/openapi.json`, `/docs` (Swagger UI), and `/reference` (Scalar)
  - [ ] Verify Phase 1 endpoints in Swagger docs
- [ ] **Phase 1 Testing & Commit**
  - [ ] Create `test-phase-1.md` with curl steps and test scripts
  - [ ] Execute manual verification and tick tasks
  - [ ] Git commit: `feat(core): phase 1 modular auth, tenancy, keys, and audit with openapi`

---

## 📂 Phase 2: Runtime Observability & Ingestion Hardening
*Test Guide: `test-phase-2.md`*

- [ ] **Module: `ingest` (Anti-DDoS & Bombardment Defense)**
  - [ ] `schemas.ts`: Telemetry batch envelope schemas
  - [ ] `routes.ts`: Ingestion route contracts
  - [ ] `handlers.ts`: 500KB payload limit, fail-open `429 Too Many Requests` shedding
  - [ ] `service.ts`: Ingest buffer, Redis sliding-window rate limiter, async queuing
  - [ ] `types.ts`, `index.ts`
- [ ] **Module: `runtime`**
  - [ ] `schemas.ts`: Health query, metrics query, snapshot schemas
  - [ ] `routes.ts`: OpenAPI route definitions
  - [ ] `handlers.ts`: Health & overview controller
  - [ ] `service.ts`: 0–100 health score calculation with full breakdown (P95, P99, error rate, anomaly delta)
  - [ ] `types.ts`, `index.ts`
- [ ] **Module: `requests`**
  - [ ] `schemas.ts`: Request search, trace lookup, session group schemas
  - [ ] `routes.ts`: OpenAPI contracts
  - [ ] `handlers.ts`: Controllers
  - [ ] `service.ts`: Trace waterfall generator, span linker, session aggregator
  - [ ] `types.ts`, `index.ts`
- [ ] **Module: `topology`**
  - [ ] `schemas.ts`: Topology nodes/edges and blast radius schemas
  - [ ] `routes.ts`: OpenAPI contracts
  - [ ] `handlers.ts`: Graph handlers
  - [ ] `service.ts`: Dependency graph builder, manual annotation manager, blast radius engine
  - [ ] `types.ts`, `index.ts`
- [ ] **Phase 2 Testing & Commit**
  - [ ] Create `test-phase-2.md`
  - [ ] Verify in Swagger docs
  - [ ] Git commit: `feat(runtime): phase 2 modular ingestion, health scoring, and topology`

---

## 📂 Phase 3: Configuration, Cache & Safe Replay
*Test Guide: `test-phase-3.md`*

- [ ] **Module: `config`**
  - [ ] `schemas.ts`: Configuration key-value & runtime version schemas
  - [ ] `routes.ts`: OpenAPI contracts
  - [ ] `handlers.ts`: Versioning controllers
  - [ ] `service.ts`: Immutable runtime version builder and configuration diff engine
  - [ ] `types.ts`, `index.ts`
- [ ] **Module: `cache`**
  - [ ] `schemas.ts`: Cache rule, tag purge, and recommendation schemas
  - [ ] `routes.ts`: OpenAPI contracts
  - [ ] `handlers.ts`: Cache controllers
  - [ ] `service.ts`: Cache analytics, hit/miss tracking, origin RPS reduction projection
  - [ ] `types.ts`, `index.ts`
- [ ] **Module: `replay` (SSRF & Replay Bomb Protection)**
  - [ ] `schemas.ts`: Replay trigger & comparison schemas
  - [ ] `routes.ts`: OpenAPI contracts with strict `replay:staging` vs `replay:production` scopes
  - [ ] `handlers.ts`: Replay controller
  - [ ] `service.ts`: SSRF blocker (RFC1918 & metadata blacklists), credential scrubber, request re-dispatcher
  - [ ] `types.ts`, `index.ts`
- [ ] **Phase 3 Testing & Commit**
  - [ ] Create `test-phase-3.md`
  - [ ] Verify in Swagger docs
  - [ ] Git commit: `feat(config): phase 3 modular config, cache policies, and secure replay`

---

## 📂 Phase 4: Simulations, High-Throughput Load Testing & Resilience Auditing
*Test Guide: `test-phase-4.md`*

- [ ] **Module: `load-testing` (Stress Engine & Capacity Breaking Point)**
  - [ ] `schemas.ts`: Config schemas for sustained load, ramp-up concurrency, spike bursts, endurance/soak tests
  - [ ] `routes.ts`: OpenAPI contracts for starting, stopping, and streaming test runs
  - [ ] `handlers.ts`: Test lifecycle controllers
  - [ ] `service.ts`:
    - [ ] High-throughput load runner (configurable virtual users / target RPS)
    - [ ] **Breaking Point Analyzer**: Detects sustainable capacity, degradation onset threshold, and critical failure point (latency cliff / error surge)
    - [ ] **Defensive Posture & Resilience Probes**: Audits target endpoints for rate-limit enforcement (429 handling), slow connection exhaustion, timeout resilience, and unhandled edge errors
  - [ ] `types.ts`, `index.ts`
- [ ] **Module: `simulations` (What-If Engine)**
  - [ ] `schemas.ts`: What-if scenario schemas (e.g. "What if traffic is 5x?", "What if cache drops to 0%?")
  - [ ] `routes.ts`: OpenAPI contracts
  - [ ] `handlers.ts`: Simulation runner handlers
  - [ ] `service.ts`: Baseline vs. experiment comparator, traffic snapshot replay, tenant concurrency limits
  - [ ] `types.ts`, `index.ts`
- [ ] **Phase 4 Testing & Commit**
  - [ ] Create `test-phase-4.md`
  - [ ] Verify in Swagger docs
  - [ ] Git commit: `feat(simulations): phase 4 what-if engine, load testing, and resilience auditor`

---

## 📂 Phase 5: Change Plans, Guardrails, Incidents & Rollback
*Test Guide: `test-phase-5.md`*

- [ ] **Module: `change-plans`**
  - [ ] `schemas.ts`: 12-state change plan schemas (draft, simulate, approve, rollout, rollback)
  - [ ] `routes.ts`: OpenAPI contracts
  - [ ] `handlers.ts`: State transition controllers
  - [ ] `service.ts`: Risk score engine (Low/Med/High), blast radius evaluator, staged rollout stepper (10%->25%->50%->100%)
  - [ ] `types.ts`, `index.ts`
- [ ] **Module: `policies`**
  - [ ] `schemas.ts`: Guardrails (error rate > 5%, latency > 2s) & rate limit rules
  - [ ] `routes.ts`: OpenAPI contracts
  - [ ] `handlers.ts`: Policy controllers
  - [ ] `service.ts`: Automated circuit breakers & guardrail evaluator
  - [ ] `types.ts`, `index.ts`
- [ ] **Module: `incidents`**
  - [ ] `schemas.ts`: Incident detection and factor ranking schemas
  - [ ] `routes.ts`: OpenAPI contracts
  - [ ] `handlers.ts`: Incident controllers
  - [ ] `service.ts`: Anomaly baseline detection, causal factor correlation, 1-click instant rollback
  - [ ] `types.ts`, `index.ts`
- [ ] **Phase 5 Testing & Commit**
  - [ ] Create `test-phase-5.md`
  - [ ] Verify in Swagger docs
  - [ ] Git commit: `feat(change-plans): phase 5 change plans, guardrails, and incident rollback`

---

## 📂 Phase 6: AI Intelligence, Integrations & Billing
*Test Guide: `test-phase-6.md`*

- [ ] **Module: `ai`**
  - [ ] `schemas.ts`: Natural language query and citation schemas
  - [ ] `routes.ts`: OpenAPI contracts
  - [ ] `handlers.ts`: AI query handlers
  - [ ] `service.ts`: Runtime model context injection, grounded citation engine, change summarization
  - [ ] `types.ts`, `index.ts`
- [ ] **Module: `integrations`**
  - [ ] `schemas.ts`: Git webhook and deployment event schemas
  - [ ] `routes.ts`: OpenAPI contracts
  - [ ] `handlers.ts`, `service.ts`, `types.ts`, `index.ts`
- [ ] **Module: `billing`**
  - [ ] `schemas.ts`: Usage events, plan tiers, invoices
  - [ ] `routes.ts`, `handlers.ts`, `service.ts`, `types.ts`, `index.ts`
- [ ] **Module: `docs`**
  - [ ] Complete OpenAPI 3.1 specification generation and validation
- [ ] **Phase 6 Testing & Commit**
  - [ ] Create `test-phase-6.md`
  - [ ] Verify all endpoints in Swagger UI & Scalar
  - [ ] Git commit: `feat(intelligence): phase 6 ai assistant, integrations, and complete openapi docs`

---

## 📂 Phase 7: Production-Grade SDK Hardening
*Test Guide: `test-phase-7.md`*

- [ ] **SDK Core Hardening (`packages/sdk`)**
  - [ ] Implement fail-open guarantee (zero unhandled exceptions or latency overhead)
  - [ ] Bounded in-memory ring buffer (max 500 items) with drop-oldest shedding
  - [ ] Source-level PII, token, and auth header redaction
  - [ ] Deterministic user rollout evaluation (`inRollout`)
  - [ ] Runtime config streaming with disk/memory fallback cache
- [ ] **Phase 7 Testing & Commit**
  - [ ] Create `test-phase-7.md`
  - [ ] Unit & integration tests for SDK under network failure
  - [ ] Git commit: `feat(sdk): phase 7 hardened client sdk with fail-open and local rollout`

---

## 📂 Phase 8: Frontend Dribbble Modern UI Transformation
*Test Guide: `test-phase-8.md`*

- [ ] **Design System (`Docs/Design.md`) Implementation**
  - [ ] Setup Mona Sans typography scale (52px, 40px, 24px, 20px, 18px, 16px, 14px, 12px, 11px)
  - [ ] Configure color tokens: `#0D0C22` (primary ink), `#6E6D7A` (secondary), `#FFFFFF` (surface), `#F4F4F6` (tertiary), `#E7E7E9` (neutral), `#EA4C89` (pink), `#CDE36B` (lime), `#FFF1F7` (blush), `#FFAD48` (accent), `#E5484D` (error)
  - [ ] Reusable UI components: Full-Pill Button (32px, 12px label), Full-Pill Input (56px), Clean Border Card (8px radius), Pill Tabs, Modals
  - [ ] Global Context Selector (Org > Workspace > Project > App > Env)
- [ ] **Feature Pages (`apps/web/src/features/*`)**
  - [ ] Auth & Login (Email/Password + Google OAuth button)
  - [ ] Runtime Overview (Health Score dial, RPS, latency, error graphs)
  - [ ] Change Plans (Creation wizard, diff viewer, simulation compare, staged rollout stepper)
  - [ ] Simulations & What-If Studio
  - [ ] Topology & Blast Radius Inspector
  - [ ] Request Explorer & Trace Waterfall
  - [ ] Incidents & 1-Click Rollback Dashboard
  - [ ] Policies & Guardrails Editor
  - [ ] Audit Log with filterable table and CSV export
  - [ ] AI Assistant Chat Panel
- [ ] **Phase 8 Testing & Commit**
  - [ ] Create `test-phase-8.md`
  - [ ] Browser testing across all screens and flows
  - [ ] Git commit: `feat(web): phase 8 complete dribbble modern frontend redesign`
