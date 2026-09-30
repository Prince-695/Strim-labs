# Strim — Master Task Tracker

Status: 🚀 In Planning / Ready to Execute  
Last Updated: 2026-09-29  

---

## 📌 Roadmap Overview
- [x] **Phase 1**: Foundations, Single `.env`, Auth (Google OAuth + Password) & Multi-Tenancy Core
- [x] **Phase 2**: Runtime Observability & Ingestion Hardening (Anti-DDoS, Health 0-100, Topology)
- [x] **Phase 3**: Configuration, Cache & Safe Replay (SSRF Protection, Sanitization)
- [ ] **Phase 4**: Simulations, Load Testing & What-If Engine (Breaking Point Analysis)
- [ ] **Phase 5**: Change Plans, Guardrails, Incidents & 1-Click Rollback
- [ ] **Phase 6**: AI Intelligence, Integrations & Billing
- [ ] **Phase 7**: Production-Grade SDK Hardening (Fail-open, Bounded Buffer, Rollout Evaluation)
- [ ] **Phase 8**: Frontend Dribbble Modern UI Transformation (`apps/web`)

---

## 📂 Phase 1: Foundations, Single `.env`, Auth & Multi-Tenancy Core
*Test Guide: `test-phase-1.md`*

- [x] **Environment & Cleanup**
  - [x] Consolidate all configuration to a single root `.env` / `.env.example`
  - [x] Add Google OAuth configuration (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`)
  - [x] Decommission and remove `apps/demo-checkout` from monorepo workspaces
- [x] **Module: `auth`**
  - [x] `apps/server/src/modules/auth/schemas.ts`: Zod schemas for login, register, Google OAuth, session refresh, invite accept
  - [x] `apps/server/src/modules/auth/routes.ts`: Contract-first routes using `@hono/zod-openapi`
  - [x] `apps/server/src/modules/auth/handlers.ts`: Controllers with secure HTTP-only cookies and Bearer tokens
  - [x] `apps/server/src/modules/auth/service.ts`: Business logic (Argon2id hashing, Google OAuth profile fetch, session token generation)
  - [x] `apps/server/src/modules/auth/types.ts`: Auth interfaces
  - [x] `apps/server/src/modules/auth/index.ts`: Module export
- [x] **Module: `directory`**
  - [x] `apps/server/src/modules/directory/schemas.ts`: Zod schemas for Orgs, Workspaces, Projects, Applications, Environments, Teams, Memberships
  - [x] `apps/server/src/modules/directory/routes.ts`: OpenAPI route definitions
  - [x] `apps/server/src/modules/directory/handlers.ts`: Handlers with tenant context extraction
  - [x] `apps/server/src/modules/directory/service.ts`: Prisma queries with strict `organizationId` scoping
  - [x] `apps/server/src/modules/directory/types.ts`: Domain models
  - [x] `apps/server/src/modules/directory/index.ts`: Module export
- [x] **Module: `keys`**
  - [x] `apps/server/src/modules/keys/schemas.ts`: Scoped API key creation & revocation schemas
  - [x] `apps/server/src/modules/keys/routes.ts`: OpenAPI contracts
  - [x] `apps/server/src/modules/keys/handlers.ts`: Handlers
  - [x] `apps/server/src/modules/keys/service.ts`: Hashed API key generation & scope validation
  - [x] `apps/server/src/modules/keys/types.ts`: Types
  - [x] `apps/server/src/modules/keys/index.ts`: Module export
- [x] **Module: `audit`**
  - [x] `apps/server/src/modules/audit/schemas.ts`: Audit querying and filter schemas
  - [x] `apps/server/src/modules/audit/routes.ts`: OpenAPI contracts
  - [x] `apps/server/src/modules/audit/handlers.ts`: Handlers (read-only; writes are internal/middleware)
  - [x] `apps/server/src/modules/audit/service.ts`: Append-only audit logger and query engine
  - [x] `apps/server/src/modules/audit/types.ts`: Audit event types
  - [x] `apps/server/src/modules/audit/index.ts`: Module export
- [x] **OpenAPI & Swagger UI Verification**
  - [x] Mount `/openapi.json`, `/docs` (Swagger UI), and `/reference` (Scalar)
  - [x] Verify Phase 1 endpoints in Swagger docs
- [x] **Phase 1 Testing & Commit**
  - [x] Create `test-phase-1.md` with curl steps and test scripts
  - [x] Execute manual verification and tick tasks
  - [x] Git commit: split feature commits for Phase 1 modular services

---

## 📂 Phase 2: Runtime Observability & Ingestion Hardening
*Test Guide: `test-phase-2.md`*

- [x] **Module: `ingest` (Anti-DDoS & Bombardment Defense)**
  - [x] `schemas.ts`: Telemetry batch envelope schemas
  - [x] `routes.ts`: Ingestion route contracts
  - [x] `handlers.ts`: 500KB payload limit, fail-open `429 Too Many Requests` shedding
  - [x] `service.ts`: Ingest buffer, Redis sliding-window rate limiter, async queuing
  - [x] `types.ts`, `index.ts`
- [x] **Module: `runtime`**
  - [x] `schemas.ts`: Health query, metrics query, snapshot schemas
  - [x] `routes.ts`: OpenAPI route definitions
  - [x] `handlers.ts`: Health & overview controller
  - [x] `service.ts`: 0–100 health score calculation with full breakdown (P95, P99, error rate, anomaly delta)
  - [x] `types.ts`, `index.ts`
- [x] **Module: `requests`**
  - [x] `schemas.ts`: Request search, trace lookup, session group schemas
  - [x] `routes.ts`: OpenAPI contracts
  - [x] `handlers.ts`: Controllers
  - [x] `service.ts`: Trace waterfall generator, span linker, session aggregator
  - [x] `types.ts`, `index.ts`
- [x] **Module: `topology`**
  - [x] `schemas.ts`: Topology nodes/edges and blast radius schemas
  - [x] `routes.ts`: OpenAPI contracts
  - [x] `handlers.ts`: Graph handlers
  - [x] `service.ts`: Dependency graph builder, manual annotation manager, blast radius engine
  - [x] `types.ts`, `index.ts`
- [x] **Phase 2 Testing & Commit**
  - [x] Create `test-phase-2.md`
  - [x] Verify in Swagger docs
  - [x] Git commit: `feat(runtime): phase 2 modular ingestion, health scoring, and topology`

---

## 📂 Phase 3: Configuration, Cache & Safe Replay
*Test Guide: `test-phase-3.md`*

- [x] **Module: `config`**
  - [x] `schemas.ts`: Configuration key-value & runtime version schemas
  - [x] `routes.ts`: OpenAPI contracts
  - [x] `handlers.ts`: Versioning controllers
  - [x] `service.ts`: Immutable runtime version builder and configuration diff engine
  - [x] `types.ts`, `index.ts`
- [x] **Module: `cache`**
  - [x] `schemas.ts`: Cache rule, tag purge, and recommendation schemas
  - [x] `routes.ts`: OpenAPI contracts
  - [x] `handlers.ts`: Cache controllers
  - [x] `service.ts`: Cache analytics, hit/miss tracking, origin RPS reduction projection
  - [x] `types.ts`, `index.ts`
- [x] **Module: `replay` (SSRF & Replay Bomb Protection)**
  - [x] `schemas.ts`: Replay trigger & comparison schemas
  - [x] `routes.ts`: OpenAPI contracts with strict `replay:staging` vs `replay:production` scopes
  - [x] `handlers.ts`: Replay controller
  - [x] `service.ts`: SSRF blocker (RFC1918 & metadata blacklists), credential scrubber, request re-dispatcher
  - [x] `types.ts`, `index.ts`
- [x] **Phase 3 Testing & Commit**
  - [x] Create `test-phase-3.md`
  - [x] Verify in Swagger docs
  - [x] Git commit: `feat(config): phase 3 modular config, cache policies, and secure replay`

---

## 📂 Phase 4: Simulations, High-Throughput Load Testing & Resilience Auditing
*Test Guide: `test-phase-4.md`*

- [x] **Module: `load-testing` (Stress Engine & Capacity Breaking Point)**
  - [x] `schemas.ts`: Config schemas for sustained load, ramp-up concurrency, spike bursts, endurance/soak tests
  - [x] `routes.ts`: OpenAPI contracts for starting, stopping, and streaming test runs
  - [x] `handlers.ts`: Test lifecycle controllers
  - [x] `service.ts`:
    - [x] High-throughput load runner (configurable virtual users / target RPS)
    - [x] **Breaking Point Analyzer**: Detects sustainable capacity, degradation onset threshold, and critical failure point (latency cliff / error surge)
    - [x] **Defensive Posture & Resilience Probes**: Audits target endpoints for rate-limit enforcement (429 handling), slow connection exhaustion, timeout resilience, and unhandled edge errors
  - [x] `types.ts`, `index.ts`
- [x] **Module: `simulations` (What-If Engine)**
  - [x] `schemas.ts`: What-if scenario schemas (e.g. "What if traffic is 5x?", "What if cache drops to 0%?")
  - [x] `routes.ts`: OpenAPI contracts
  - [x] `handlers.ts`: Simulation runner handlers
  - [x] `service.ts`: Baseline vs. experiment comparator, traffic snapshot replay, tenant concurrency limits
  - [x] `types.ts`, `index.ts`
- [x] **Phase 4 Testing & Commit**
  - [x] Create `test-phase-4.md`
  - [x] Verify in Swagger docs
  - [x] Git commit: `feat(simulations): phase 4 what-if engine, load testing, and resilience auditor`

---

## 📂 Phase 5: Change Plans, Guardrails, Incidents & Rollback
*Test Guide: `test-phase-5.md`*

- [x] **Module: `change-plans`**
  - [x] `schemas.ts`: 12-state change plan schemas (draft, simulate, approve, rollout, rollback)
  - [x] `routes.ts`: OpenAPI contracts
  - [x] `handlers.ts`: State transition controllers
  - [x] `service.ts`: Risk score engine (Low/Med/High), blast radius evaluator, staged rollout stepper (10%->25%->50%->100%)
  - [x] `types.ts`, `index.ts`
- [x] **Module: `policies`**
  - [x] `schemas.ts`: Guardrails (error rate > 5%, latency > 2s) & rate limit rules
  - [x] `routes.ts`: OpenAPI contracts
  - [x] `handlers.ts`: Policy controllers
  - [x] `service.ts`: Automated circuit breakers & guardrail evaluator
  - [x] `types.ts`, `index.ts`
- [x] **Module: `incidents`**
  - [x] `schemas.ts`: Incident detection and factor ranking schemas
  - [x] `routes.ts`: OpenAPI contracts
  - [x] `handlers.ts`: Incident controllers
  - [x] `service.ts`: Anomaly baseline detection, causal factor correlation, 1-click instant rollback
  - [x] `types.ts`, `index.ts`
- [x] **Phase 5 Testing & Commit**
  - [x] Create `test-phase-5.md`
  - [x] Verify in Swagger docs
  - [x] Git commit: `feat(change-plans): phase 5 change plans, guardrails, and incident rollback`

---

## 📂 Phase 6: AI Intelligence, Integrations & Billing
*Test Guide: `test-phase-6.md`*

- [x] **Module: `ai`**
  - [x] `schemas.ts`: Natural language query and citation schemas
  - [x] `routes.ts`: OpenAPI contracts
  - [x] `handlers.ts`: AI query handlers
  - [x] `service.ts`: Runtime model context injection, grounded citation engine, change summarization
  - [x] `types.ts`, `index.ts`
- [x] **Module: `integrations`**
  - [x] `schemas.ts`: Git webhook and deployment event schemas
  - [x] `routes.ts`: OpenAPI contracts
  - [x] `handlers.ts`, `service.ts`, `types.ts`, `index.ts`
- [x] **Module: `billing`**
  - [x] `schemas.ts`: Usage events, plan tiers, invoices, retention, sso, chaos
  - [x] `routes.ts`, `handlers.ts`, `service.ts`, `types.ts`, `index.ts`
- [x] **Module: `docs`**
  - [x] Complete OpenAPI 3.1 specification generation and validation
- [x] **Phase 6 Testing & Commit**
  - [x] Create `test-phase-6.md`
  - [x] Verify all endpoints in Swagger UI & Scalar
  - [x] Git commit: `feat(intelligence): phase 6 ai assistant, integrations, and complete openapi docs`

---

## 📂 Phase 7: Production-Grade SDK Hardening
*Test Guide: `test-phase-7.md`*

- [x] **SDK Core Hardening (`packages/sdk`)**
  - [x] Implement fail-open guarantee (zero unhandled exceptions or latency overhead)
  - [x] Bounded in-memory ring buffer (max 500 items) with drop-oldest shedding
  - [x] Source-level PII, token, and auth header redaction
  - [x] Deterministic user rollout evaluation (`inRollout`)
  - [x] Runtime config streaming with disk/memory fallback cache
- [x] **Phase 7 Testing & Commit**
  - [x] Create `test-phase-7.md`
  - [x] Unit & integration tests for SDK under network failure
  - [x] Git commit: `feat(sdk): phase 7 hardened client sdk with fail-open and local rollout`

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
