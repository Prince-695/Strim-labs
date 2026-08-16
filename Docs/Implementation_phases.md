# Strim — Implementation Phase Plan
### Runtime Intelligence & Change Platform — End-to-End Build Roadmap

**Document Owner:** Engineering Leadership
**Version:** 1.0
**Companion Document:** `PRD.md`
**Approach:** Modular monolith → incremental extraction; asynchronous-by-default heavy workloads; multi-tenant from Phase 0.

---

## Table of Contents

1. [Sequencing Philosophy](#1-sequencing-philosophy)
2. [Phase 0 — Foundations & Multi-Tenant Core](#phase-0--foundations--multi-tenant-core)
3. [Phase 1 — Runtime Observability MVP (SDK + Ingestion + Runtime Overview)](#phase-1--runtime-observability-mvp)
4. [Phase 2 — Requests, Topology & Replay](#phase-2--requests-topology--replay)
5. [Phase 3 — Configuration & Cache Management](#phase-3--configuration--cache-management)
6. [Phase 4 — Simulations, What-If Engine & Load Testing](#phase-4--simulations-what-if-engine--load-testing)
7. [Phase 5 — Change Plans & Controlled Rollout](#phase-5--change-plans--controlled-rollout)
8. [Phase 6 — Incidents, Correlation & Rollback](#phase-6--incidents-correlation--rollback)
9. [Phase 7 — Policies, RBAC Hardening & Audit Completeness](#phase-7--policies-rbac-hardening--audit-completeness)
10. [Phase 8 — AI / Intelligence Layer](#phase-8--ai--intelligence-layer)
11. [Phase 9 — Integrations (CI/CD, Git, Deployment)](#phase-9--integrations-cicd-git-deployment)
12. [Phase 10 — Scale-Out, Chaos Simulation & Service Extraction](#phase-10--scale-out-chaos-simulation--service-extraction)
13. [Phase 11 — Compliance, Enterprise Readiness & GA Hardening](#phase-11--compliance-enterprise-readiness--ga-hardening)
14. [Cross-Cutting Workstreams](#14-cross-cutting-workstreams)
15. [Dependency Graph Summary](#15-dependency-graph-summary)
16. [Release Milestones](#16-release-milestones)

---

## 1. Sequencing Philosophy

Phases are sequenced to always deliver a **coherent slice of the core loop** (`OBSERVE → UNDERSTAND → PROPOSE → SIMULATE → COMPARE → APPROVE → ROLLOUT → VERIFY`), rather than building modules in isolation. Each phase should be independently demoable and, where possible, independently valuable to an early design-partner customer.

**Non-negotiable constraints carried through every phase (from PRD):**
- Multi-tenant isolation is enforced starting Phase 0 — never bolted on later.
- Modular monolith architecture; module boundaries treated as strict internal contracts from day one (Section 7.2 of PRD).
- Heavy operations (replay, simulation, load test, telemetry processing) are asynchronous starting the phase in which they're introduced.
- Every mutating action is audited starting the phase in which it's introduced — audit is not a Phase 11 retrofit.
- SDK fail-open / non-blocking behavior is a Phase 1 requirement, not deferred.

---

## PHASE 0 — Foundations & Multi-Tenant Core

**Goal:** Stand up the organizational skeleton, auth, tenancy, RBAC primitives, and base infrastructure that every subsequent module depends on.

### 0.1 Scope
- Organization / Workspace / Project / Application / Environment domain model (schema only — no runtime data yet).
- User authentication (email/password + SSO-ready abstraction) and session management.
- Organization membership, Teams, and baseline RBAC roles (Owner, Admin, Engineer, Developer, Viewer, Billing) per PRD §13.
- API key issuance framework (scoped, rotatable, expirable, revocable) per PRD §10.5 — even though nothing consumes keys yet.
- Base modular-monolith service skeleton with module boundary conventions (`auth`, `organizations`, `workspaces`, `projects`, `applications`, `environments` modules stubbed).
- PostgreSQL schema for all Phase 0 entities; migrations tooling.
- Global Context Selector UI pattern (Org → Workspace → Project → Application → Environment) scaffolded, even with placeholder data.
- Immutable Audit module foundation: audit event schema, write-only API, and the Audit UI shell (filters wired, no real events yet beyond org/user management actions).
- Base CI pipeline, environment provisioning (dev/staging/prod for Strim itself — "Strim running on Strim" mindset from day one).

### 0.2 Key Technical Deliverables
- `organizations`, `workspaces`, `projects`, `applications`, `environments`, `users`, `memberships`, `teams`, `api_keys`, `audit_log` tables — every tenant-scoped table carries `organization_id` (+ narrower scope IDs as applicable), per PRD §8.1.
- Tenant isolation middleware enforced at API layer (reject any request whose resolved resource `organization_id` doesn't match the authenticated principal's authorized org).
- RBAC authorization middleware: role resolution at Org/Workspace/Project/Application scope.
- Row-level security (or application-layer equivalent) proof-of-concept on at least one high-sensitivity table, establishing the pattern used later for requests/config tables.
- Application metadata CRUD (Name, Repository, Language, Framework, Owner, Team, Region, Version) per PRD §9.2.

### 0.3 Acceptance Criteria
- A newly created Organization cannot, through any API path, read or write another Organization's data (initial isolation test suite — expanded later, not finalized here).
- Every Org/App/Env-mutating action produces an audit record.
- Application creation enforces required ownership fields (Owner Team, Technical Owner, On-call Team) per PRD FR-9.2.1.
- Global Context Selector correctly scopes an empty-state UI to the selected Environment.

### 0.4 Explicitly Deferred
- No telemetry, no runtime data, no simulations — this phase is pure scaffolding + tenancy + identity.

---

## PHASE 1 — Runtime Observability MVP

**Goal:** First real runtime data flowing end-to-end: SDK → Ingestion → Storage → Runtime Overview screen. This is the first phase that produces genuine "OBSERVE" value.

### 1.1 Scope
- **SDK v1** (`@strim/sdk`, initial language: Node.js/TypeScript, since Strim's own product-strategy stack is Node-adjacent; additional language SDKs sequenced later per customer demand):
  - `strim.init()` with projectId/environment/apiKey.
  - Capture: request metadata, response metadata, latency, errors, trace IDs (generate if absent), custom metrics/events.
  - **Mandatory resilience behaviors from day one**: async transmission, local buffering with bounded memory, backpressure/shedding, fail-open (SDK failure must never throw into host app) — PRD §10.3.
  - Sampling support (global/app/env granularity to start; per-endpoint and error-only sampling in Phase 2).
- **Ingestion API**: accept-and-queue pattern; validates API key scope (`telemetry:write`); pushes to event bus/queue; must gracefully shed load (HTTP 429 + retry-after) rather than fail hard under overload.
- **Event bus** stood up (NATS or Redpanda per PRD §67 recommendation — avoid Kafka at this stage) with initial event types: `REQUEST_STARTED`, `REQUEST_COMPLETED`, `ERROR_DETECTED`.
- **Worker**: telemetry processor consuming the queue, writing raw request records to Object Storage (payloads) and aggregates to the Analytics DB (ClickHouse/Timescale-class), per PRD §15 storage split.
- **Redaction pipeline v1** (mandatory, non-configurable baseline): strip Authorization headers, cookies, passwords, API keys, JWTs, secrets, payment fields, common PII patterns — applied in the ingestion/worker path *before* persistence, per PRD §12.1.
- **Runtime module v1**: Runtime Overview screen showing health score, traffic (RPS), latency (P95/P99), error rate — computed from Analytics DB aggregates.
- **Runtime Health Score** calculation (availability, latency, errors, dependencies placeholder-weighted since topology doesn't exist yet, traffic anomaly baseline) with the explainability breakdown required by PRD FR-9.1.2.
- Realtime layer v1: WebSocket channel pushing live metric updates to the Runtime Overview screen.

### 1.2 Data Model Additions
- `requests` (metadata table, analytics-store-backed), `request_payloads` (object-storage references), `runtime_health_snapshots`, `api_key_scopes`.

### 1.3 Acceptance Criteria
- A sample customer app integrated with the SDK shows live traffic on the Runtime Overview screen within seconds of a request occurring.
- Killing the Strim ingestion endpoint does not raise any error or add measurable latency in the sample customer app (fail-open verified via load test).
- A request containing a fake `Authorization: Bearer ...` header, cookie, and a credit-card-shaped string is stored with all three fields redacted — verified by direct inspection of stored payload.
- Health score is always rendered with its underlying metric breakdown (never a bare number).

### 1.4 Explicitly Deferred
- Request Explorer UI/detail view, replay, topology, sessions — Phase 2.

---

## PHASE 2 — Requests, Topology & Replay

**Goal:** Turn raw telemetry into an investigable, navigable model — Request Explorer, dependency Topology graph, and safe Replay.

### 2.1 Scope
- **Request Explorer UI**: list + detail view per PRD §9.3 fields; actions wired: View Trace, Replay, Compare, Create Simulation (stub until Phase 4), Create Load Test (stub until Phase 4).
- **Distributed tracing linkage**: trace ID propagation through SDK (parent/child span capture for dependency calls), enabling per-request dependency breakdown.
- **Sessions**: grouping logic (heuristic: shared session/user identifier + time window, configurable) + Session Replay data model.
- **Topology module**:
  - Auto-derivation of the dependency graph from observed trace/dependency-call data.
  - Manual annotation/override support (explicit configuration layer per PRD FR-9.5.1).
  - Topology UI (React Flow-based interactive graph) with per-node health/RPS/latency/error/dependency display and click-through actions.
  - Dependency query engine: "what depends on X," "what breaks if Y fails" (static graph traversal at this phase; blast-radius *scoring* comes in Phase 5).
- **Replay module v1**:
  - Exact Replay and Session Replay modes.
  - Replay safety pipeline: credential stripping, token replacement, PII redaction, header sanitization (reuses Phase 1 redaction pipeline, extended for replay-specific fields).
  - Explicit, separately-scoped permission required for any production-targeted replay (`replay:production` distinct from `replay:staging`) per PRD FR-9.4.3.
  - Dangerous-operation guarding: configurable per-endpoint "replayable: false" flag to block irreversible actions (e.g., payment capture) by default, requiring explicit per-request override.
  - Replay execution as an **async worker job** (queue-backed), emitting progress; results stored, comparable.
- **Request Comparison engine v1**: diff JSON response, headers, status, timing between an original and a replayed request.
- **Sampling extension**: per-endpoint and error-only/latency-based sampling rules (PRD §21).

### 2.2 Data Model Additions
- `traces`, `spans`, `dependencies`, `topology_nodes`, `topology_edges`, `sessions`, `session_requests`, `replays`, `replay_results`, `sampling_rules`, `redaction_rules` (custom, user-defined layer on top of mandatory baseline).

### 2.3 Acceptance Criteria
- Given a checkout flow spanning 3 services, the Topology graph auto-renders the correct dependency chain without manual configuration.
- A production replay attempt by a user holding only `replay:staging` permission is rejected with a clear authorization error, and the attempt is audited regardless of outcome.
- Replaying a request against staging and comparing to the original correctly diffs status, timing, and body.
- Every replay execution (success or failure) appears in the Audit log with actor, target, mode, timestamp.

### 2.4 Explicitly Deferred
- Traffic Replay, Scaled Replay, Transformed Replay (bundled into Phase 4 alongside Simulations, since they share the traffic-scenario infrastructure).
- Blast Radius scoring (Phase 5, requires Change Plan context).

---

## PHASE 3 — Configuration & Cache Management

**Goal:** Make Runtime State itself a first-class, versioned, controllable object — the prerequisite for Change Plans.

### 3.1 Scope
- **Configuration module**: versioned key/value runtime configuration, environment-aware, with full history (actor, timestamp, reason, old/new value, environment) per PRD FR-9.7.2.
- **Runtime Version** object: bundles a coherent set of configuration values into a single, diffable, immutable, sequentially-numbered version (PRD FR-9.1.4, §38).
- **Runtime Diff engine**: computes and renders human-readable diffs between any two Runtime Versions (this is the engine reused by Change Plans in Phase 5).
- **SDK config-read integration**: `strim.config("key")` returns current approved config for the calling environment (extends SDK from Phase 1) per PRD §10.4; config delivery path is versioned/audited/authorized, never a blind broadcast.
- **Cache module**:
  - Cache Rule CRUD (endpoint, method, TTL, cache key, query params, headers, tags, auth context).
  - Cache invalidation: manual purge, tag purge, endpoint purge, automatic invalidation triggered by defined events (e.g., a `CACHE_INVALIDATED` event on a data-mutation signal from SDK).
  - Cache Analytics: hits/misses/hit-rate/origin-reduction/bandwidth-saved, computed from Analytics DB.
  - **Cache Recommendation engine v1**: heuristic-based (traffic volume × latency × observed data-change frequency) candidate identification with projected impact estimate, per PRD FR-9.6.3.
- **Runtime Snapshot** object: point-in-time capture bundling configuration + topology + traffic distribution + endpoint behavior + cache state + dependency health + error/latency profile (PRD §39) — this becomes the reusable "state capture" primitive used by Simulations (Phase 4) and Incidents (Phase 6).
- **Traffic Snapshot** capture: derive real traffic distribution (endpoint %, RPS avg/peak) from Analytics DB — prerequisite for production-derived load testing and simulation in Phase 4.

### 3.2 Data Model Additions
- `configurations`, `configuration_versions`, `runtime_versions`, `cache_rules`, `cache_invalidation_events`, `runtime_snapshots`, `traffic_snapshots`.

### 3.3 Acceptance Criteria
- Changing a config value creates a new Configuration Version with full actor/reason/old/new metadata; the SDK reflects the new value on next read without requiring a customer app redeploy.
- Diffing Runtime Version N vs. N+1 renders the same style of diff shown in the PRD example (`cache.enabled: false → true`, etc.).
- A cache rule enabling `/products` GET caching measurably reduces recorded origin RPS in Cache Analytics within one polling interval.
- Cache Recommendation engine flags at least the seeded high-traffic, high-latency, low-change-frequency endpoint in a test dataset.

### 3.4 Explicitly Deferred
- Environment promotion workflow and Runtime Drift detection — Phase 7 (bundled with policy/approval infrastructure, since promotion gates depend on it).

---

## PHASE 4 — Simulations, What-If Engine & Load Testing

**Goal:** Deliver the "SIMULATE" and "COMPARE" stages of the core loop — the product's primary differentiator.

### 4.1 Scope
- **Scenario module**: base runtime state, modified runtime state, traffic model, dependency model, scale, duration, target metrics (PRD §43).
- **What-If Engine v1**: supports the canonical question set — traffic multiplier, cache on/off, timeout/retry changes, dependency latency injection (simulated, not live chaos — see Phase 10 for live chaos), dependency unavailability (simulated).
- **Simulation execution engine** (async worker-based):
  - **Baseline Run**: replays/synthesizes traffic against the *current* Runtime Version.
  - **Experiment Run**: same traffic model against the *proposed* Runtime Version.
  - Both runs execute in an isolated, non-production-impacting execution context (sandboxed target — staging-equivalent or a dedicated simulation execution environment; must never mutate real production state).
- **Comparison Engine**: computes P95/P99/error-rate/origin-RPS/cache-hit deltas and percentage improvements (PRD §46).
- **Traffic Replay, Scaled Replay, Transformed Replay** modes added to the Replay module (deferred from Phase 2), since they now share infrastructure with Simulation's traffic modeling.
- **Load Testing module**:
  - Test type support: Load, Stress, Spike, Endurance, Capacity (PRD §48).
  - Config: target, duration, target RPS, ramp-up, max workers, traffic scenario source.
  - **Production-derived load testing**: capture → traffic snapshot (from Phase 3) → scale → execute, preserving real distribution (PRD §49).
  - **Breaking Point Analysis**: sustainable capacity / degradation onset / critical point computation with plain-language recommendation (PRD §50).
- **Simulation & Load Test UI**: baseline-vs-experiment side-by-side, charts for latency/throughput/error/cache/dependency/resource utilization (PRD §97).
- Event types added: `SIMULATION_STARTED/PROGRESS/COMPLETED`, `LOAD_TEST_STARTED/PROGRESS/COMPLETED`.

### 4.2 Data Model Additions
- `scenarios`, `simulations`, `simulation_runs` (baseline/experiment), `simulation_results`, `load_tests`, `load_test_results`, `breaking_point_analyses`.

### 4.3 Acceptance Criteria
- Running the canonical example scenario (enable cache, drop timeout 5000→3000ms) against a seeded baseline reproduces materially the PRD's example deltas directionally (latency down, error rate down, origin RPS down) — exact figures dataset-dependent, but the mechanism must be demonstrably correct.
- A production-derived load test at 3x scale preserves the original endpoint traffic distribution percentages within an acceptable tolerance.
- Breaking Point Analysis correctly identifies a synthetic, intentionally-inserted saturation point in a test harness.
- No simulation or load test run is capable of mutating live production Runtime State — verified by an explicit isolation test.

### 4.4 Explicitly Deferred
- Chaos/live-failure injection against real running dependencies — Phase 10 (this phase is simulated/modeled only, per PRD §9.15 being scoped post-MVP).

---

## PHASE 5 — Change Plans & Controlled Rollout

**Goal:** Assemble everything built so far (Runtime State, Diff, Simulation, Topology/Blast Radius) into the platform's core product object, and ship the full rollout/guardrail/rollback lifecycle.

### 5.1 Scope
- **Change Plan object & state machine**: `DRAFT → VALIDATING → SIMULATION_PENDING → SIMULATING → SIMULATION_PASSED → APPROVAL_PENDING → APPROVED → ROLLING_OUT → MONITORING → COMPLETED`, plus `SIMULATION_FAILED`, `REJECTED`, `ROLLOUT_PAUSED`, `ROLLBACK_PENDING`, `ROLLED_BACK` (PRD §53).
- **Change Impact Analysis**: affected services/endpoints/dependencies/teams computed from the Topology module (Phase 2), plus historical-incident correlation lookup (stubbed until Phase 6 Incidents exists; wired fully once Phase 6 lands).
- **Blast Radius computation**: full implementation now that Topology (Phase 2) and Change Plan context both exist (PRD §30, FR-9.5.4).
- **Risk Score engine**: explainable LOW/MEDIUM/HIGH scoring from blast radius, traffic volume, affected-service count, dependency sensitivity, historical failure rate (placeholder until Phase 6), config-diff magnitude, and simulation result (PRD §55, FR-9.10.3).
- **Approval workflow**: multi-party approval support, policy-driven requirement resolution (basic policy model introduced here; full Policy module hardening in Phase 7).
- **Guardrails v1**: threshold-based rules evaluated during rollout — `error_rate > X → STOP`, `P95 > Y → PAUSE`, `availability < Z → ROLLBACK`, dependency-error-threshold → PAUSE (PRD §58).
- **Controlled Rollout engine**: staged percentage rollout (0%→10%→25%→50%→100%) with per-stage automated health observation and guardrail evaluation; supports both auto-advance and manual-advance modes per policy.
- **Rollback engine**: one-action rollback to prior Runtime Version from an active Change Plan or Incident context; fully audited (PRD §65, FR-9.10 family).
- **Change Plan UI**: full screen per PRD §98 — objective, current/proposed state, simulation result, risk, blast radius, approvals, rollout progress, single primary action.
- **Change Lineage** wiring: Change Plan references Git commit/branch/PR fields (data model only in this phase; live Git integration in Phase 9).
- Event types added: `CHANGE_APPROVED`, `ROLLOUT_STARTED`, `ROLLOUT_PAUSED`, `ROLLBACK_STARTED`, `ROLLBACK_COMPLETED`.

### 5.2 Data Model Additions
- `change_plans`, `change_plan_approvals`, `change_plan_state_transitions`, `blast_radius_results`, `risk_scores`, `guardrails`, `rollouts`, `rollout_stages`, `rollbacks`.

### 5.3 Acceptance Criteria
- A Change Plan cannot reach `APPROVED` while `SIMULATION_FAILED` without an explicit, justified, audited override by a sufficiently-permissioned user (FR-9.10.1).
- A rollout that breaches a configured guardrail (e.g., synthetic error-rate spike injected mid-stage in a test environment) automatically pauses or rolls back per the guardrail's configured action, without manual intervention.
- Rollback restores the exact prior Runtime Version and is reflected immediately in the Runtime Overview.
- The full example flow from PRD §105 ("Checkout is slow" → simulate → apply → staged rollout → 100% complete → improvement reported) is demonstrable end-to-end in the UI.

### 5.4 Explicitly Deferred
- Full historical-incident-correlation input to Risk Score (depends on Phase 6).
- Org-wide, fully general Policy engine (Phase 7) — this phase ships only the policy hooks Change Plans need.

---

## PHASE 6 — Incidents, Correlation & Rollback Integration

**Goal:** Close the loop's exception path: `VERIFY → DEGRADATION → INCIDENT → INVESTIGATE → ROLLBACK → VERIFY AGAIN`.

### 6.1 Scope
- **Anomaly detection engine**: baseline modeling per metric (error rate, latency, availability) per application/environment; MVP uses a documented fixed/adaptive-threshold hybrid (open question flagged in PRD §20.3, resolved here with a concrete initial approach and a path to adaptive baselining as a fast-follow).
- **Incident creation**: automatic `INCIDENT_CREATED` on statistically significant anomaly (PRD FR-9.12.1).
- **Incident Correlation engine**: joins traffic, latency, errors, configuration changes, cache changes, rollouts, dependency events, deployments, and recent simulations into a single time-ordered timeline (PRD §62).
- **Causality discipline enforcement**: correlation output is surfaced strictly as "potential contributing factors" with a confidence level (Low/Medium/High); UI and any generated text must never assert unqualified causation (PRD FR-9.12.3) — this is a hard-coded product rule enforced in both the correlation engine's output schema and the UI rendering layer.
- **Incident UI**: severity, affected services, recent changes, timeline, and actions (Replay, Simulate, Pause Rollout, Rollback, Notify team) per PRD §99.
- **Incident-to-Rollback integration**: one-click rollback directly from an active incident tied to a recent Change Plan (completes the loop opened in Phase 5).
- **Risk Score enhancement**: historical-incident-correlation factor now live (closing the Phase 5 deferral).
- Event types added: `INCIDENT_CREATED`, `INCIDENT_RESOLVED`.

### 6.2 Data Model Additions
- `incidents`, `incident_timelines`, `incident_correlated_factors`, `anomaly_baselines`, `notifications`.

### 6.3 Acceptance Criteria
- A synthetic error-rate spike in a test environment triggers an Incident within the target detection window, with a timeline correctly ordering the preceding configuration change, traffic increase, and metric degradation (mirroring the PRD §62 example timeline).
- No Incident-related UI or API text asserts unqualified causality; every correlated factor carries a confidence label.
- Rolling back from the Incident screen restores the prior Runtime Version and is fully audited, matching Phase 5's rollback engine.
- Risk Score for a new Change Plan targeting a service with prior incident history is measurably higher than an equivalent change on a service with no incident history.

### 6.4 Explicitly Deferred
- Paging/notification integrations beyond in-app notification (PagerDuty/Opsgenie-class) — Phase 9.

---

## PHASE 7 — Policies, RBAC Hardening & Audit Completeness

**Goal:** Generalize the policy hooks introduced ad hoc in Phase 5 into a full Policy module; harden RBAC for production-grade multi-tenant use; close all remaining audit-coverage gaps; ship Environment Promotion and Runtime Drift detection (deferred from Phase 3).

### 7.1 Scope
- **Policy module (general)**: Runtime Policies, Guardrails (generalized beyond the Phase 5 hard-coded set — user-definable threshold rules), Rate Limits, Rollout Policies, Approval Policies, Security Policies, Data Retention Policies (PRD §59).
- **Rate limiting**: enforced at Organization/Workspace/Application/Environment/API-key/User/IP/Endpoint scope with most-specific-wins precedence (PRD FR-9.11.2).
- **RBAC hardening**: scope-level role assignment (Org/Workspace/Project/Application) fully generalized; production-tier permission separation enforced across every mutating action identified across Phases 1–6 (config write, replay-to-production, rollout approval, rollback) — this phase performs a full audit of every existing mutating endpoint to confirm the stricter production-tier gate is applied (PRD FR-13.2.2).
- **Environment Promotion workflow**: config/state promotion between environments with optional validation/simulation/approval gates (PRD §69, FR-9.14.1) — now buildable since Policy and Approval infrastructure exists.
- **Runtime Drift detection**: expected-vs-actual state comparison with Inspect/Accept/Correct/Create-Change-Plan actions (PRD §70, FR-9.14.2).
- **Audit completeness pass**: cross-reference every mutating action across all modules built so far against the mandatory audit action-class list (PRD §9.13) and close any gaps found; add Audit export for compliance.
- **Policy versioning**: policy changes audited identically to runtime configuration (PRD FR-9.11.3).

### 7.2 Data Model Additions
- `policies`, `policy_versions`, `rate_limits`, `promotions`, `drift_reports`.

### 7.3 Acceptance Criteria
- A rate limit configured at Application scope correctly overrides a looser Organization-scope limit for calls to that application's API key.
- Attempting a production config write with only staging-tier permission is rejected across 100% of tested mutating endpoints (full regression sweep from the Phase 7.1 audit pass).
- Promoting a Staging Runtime Version to Production with a configured "require simulation" gate blocks promotion until a passing simulation exists.
- A manually-altered production config value (bypassing Strim) is detected as Drift within the next drift-check cycle and surfaced with all four required actions.

---

## PHASE 8 — AI / Intelligence Layer

**Goal:** Deliver the natural-language and generative-explanation capabilities defined in PRD §11, strictly scoped as an explain/recommend layer — never an autonomous actor.

### 8.1 Scope
- **Grounding layer**: a query interface that translates natural-language questions into structured queries against the Runtime Model (metrics store, config history, topology, audit log) — this is the primary engineering investment, not the language model itself.
- **Incident summarization**: AI-generated plain-language incident summaries built strictly from the Incident Correlation engine's structured output (Phase 6) — never freeform speculation.
- **Change explanation**: plain-language description of what a Change Plan did, generated from its Runtime Diff + Simulation result.
- **Cache & bottleneck recommendations**: natural-language wrapper over the existing Cache Recommendation engine (Phase 3) and a new bottleneck-analysis query against Topology + latency data.
- **Simulation interpretation**: plain-language summary of Comparison Engine output (Phase 4).
- **Natural Language Runtime Query**: supports the canonical question set from PRD §76, plus general-purpose grounded Q&A.
- **Causality & tenant-isolation discipline enforcement in the AI layer specifically**: every AI response must (a) explicitly flag uncertainty per PRD FR-11.4.1, (b) be traceable to underlying Runtime Model data per FR-11.4.2, and (c) respect the requesting user's existing RBAC/tenant scope with no privilege escalation via the AI path per FR-11.4.3 — this requires the AI layer to execute all underlying data queries *as the requesting user*, not as a privileged service account.

### 8.2 Data Model Additions
- `ai_query_log` (for auditability of AI answers and their grounding sources), `ai_response_citations` (linking generated text back to source records).

### 8.3 Acceptance Criteria
- Every AI-generated answer that references specific metrics or events includes a traceable link/citation to the underlying Runtime Model record(s).
- A user without access to Application X cannot obtain data about Application X through the AI query interface, verified by an isolation-focused test suite dedicated to this module.
- AI incident summaries never contain unqualified causal claims — verified via automated linting of generated output against a banned-phrase/pattern check plus manual review sampling.
- The example interaction from PRD §105/§75 ("Checkout is slow" → explanation → simulate → apply → rollout narration) is reproducible end-to-end using the AI layer as the conversational front-end to the underlying modules.

---

## PHASE 9 — Integrations (CI/CD, Git, Deployment)

**Goal:** Connect Strim to the customer's existing software delivery toolchain, completing full Change Lineage and enabling CI-gate usage.

### 9.1 Scope
- **Git integration**: repository/branch/commit/PR linkage on Change Plans made live (data model existed since Phase 5); webhook ingestion from GitHub (and GitLab as fast-follow) to auto-populate lineage.
- **CI/CD gate API**: the `GitHub Actions → Strim → Simulation → Result → PASS/FAIL` pattern (PRD §71) as a documented, first-class API + reusable GitHub Action; supports rules like `IF P95 regression > 20% THEN CI FAIL`.
- **Deployment observation integrations**: ArgoCD, Kubernetes, AWS/GCP/Azure, Vercel — read-only observational hooks enriching Application/Environment metadata and Runtime Version correlation with actual deployments (PRD §73) — Strim remains observational only, never a deploy actor, per PRD §4.2/§7.5 principle 10.
- **Paging/notification integrations**: PagerDuty/Opsgenie-class hand-off from the Incident module (deferred from Phase 6).
- **Full Change Lineage UI**: end-to-end visualization `Git Commit → Deployment → Runtime Change → Simulation → Rollout → Runtime Behavior → Incident → Rollback` (PRD §101).

### 9.2 Data Model Additions
- `git_integrations`, `deployment_events`, `paging_integrations`, `lineage_links`.

### 9.3 Acceptance Criteria
- A pull request tagged with a Change Plan reference correctly fails CI when the linked simulation shows a P95 regression exceeding the configured threshold.
- The Change Lineage view for a completed Change Plan renders the full unbroken chain from commit to (if applicable) incident and rollback.
- Deployment observation correctly attributes a new Runtime Version to the deployment event that introduced it, without Strim having triggered the deployment itself.

---

## PHASE 10 — Scale-Out, Chaos Simulation & Service Extraction

**Goal:** Evolve from "modular monolith sufficient for early customers" to a platform architecture that scales with high-volume tenants, and add the deferred live chaos/failure-injection capability.

### 10.1 Scope
- **Module extraction**: split the highest-load modules (telemetry ingestion/processing, simulation execution, analytics rollups) into independently deployable services, per the extractability requirement established in PRD §7.2/NFR-14.3.2. Extraction targets, in priority order: (1) telemetry ingestion, (2) simulation/load-test workers, (3) analytics aggregation.
- **Event bus evaluation/migration**: reassess NATS/Redpanda choice from Phase 1 against now-real production load; migrate to Kafka-class only if concretely justified by throughput data (PRD §67 explicitly cautions against introducing Kafka too early).
- **Multi-region considerations**: data residency and latency requirements for geographically distributed customers; environment/region metadata (captured since Phase 0) now drives actual routing/storage decisions.
- **Chaos / Live Failure Simulation** (PRD §74, FR-9.15.1 — the explicitly-deferred post-MVP capability): controlled, opt-in, guardrail-wrapped live fault injection (added dependency latency, forced error responses, connection timeouts, forced cache unavailability, partial service failure, synthetic traffic spikes) against **non-production environments by default**, with production chaos requiring the same elevated permission tier as production replay/config-write.
- **Performance hardening pass**: revisit NFR targets from PRD §14 against real measured numbers; optimize hot paths (Runtime Overview load time, WebSocket propagation latency).

### 10.2 Acceptance Criteria
- Telemetry ingestion service can be deployed, scaled, and rolled back independently of the core API without a data-model migration.
- A live chaos experiment (e.g., inject 500ms latency into the Payments dependency in staging) is fully guardrail-wrapped and auto-reverts at experiment end or on guardrail breach, and is fully audited.
- Measured Runtime Overview load time and WebSocket propagation latency meet or exceed the NFR-14.2 targets under realistic multi-tenant load.

---

## PHASE 11 — Compliance, Enterprise Readiness & GA Hardening

**Goal:** Final hardening pass to support enterprise procurement and General Availability.

### 11.1 Scope
- **Compliance program execution**: SOC 2 Type I/II (and ISO 27001 if targeted) readiness work — building on the compliance-ready-by-design foundation established since Phase 0 (immutable audit, tenant isolation, encryption, scoped keys, RBAC per PRD §12.6).
- **Comprehensive cross-tenant isolation test suite**: the dedicated suite referenced in PRD §8.3 — covering API responses, WebSocket streams, search/query endpoints, exported reports, audit logs, and AI/NL query responses, including error-response and timing side-channel checks where feasible.
- **Data Retention policy enforcement**: per-org, per-data-class configurable retention (PRD FR-12.5.1) with documented audit-record retention floor, and audited purge jobs (FR-12.5.2).
- **Enterprise auth**: SSO/SAML/SCIM support built out from the Phase 0 auth abstraction.
- **Billing module completion**: plan tiers, usage metering (tied to telemetry volume/seats/applications), billing role enforcement (PRD §78 Billing role).
- **Documentation & SDK expansion**: additional language SDKs beyond the Phase 1 Node.js SDK, based on design-partner demand; public API reference; CI/CD gate action published to marketplaces (GitHub Marketplace, etc.).
- **Load/scale validation at target GA tenant volumes**: full-system load test simulating the target number of organizations, applications, and telemetry volume for GA launch.
- **Full NFR sign-off**: formal validation of every NFR in PRD §14 against production-representative measurements.

### 11.2 Acceptance Criteria
- Cross-tenant isolation suite passes with zero findings across all listed surfaces.
- SOC 2 Type I readiness assessment (or equivalent internal audit) completed with no unresolved critical findings.
- A full GA-scale load simulation completes without breaching any NFR target.
- Billing correctly meters and invoices a multi-application, multi-seat test organization across a full billing cycle in a staging billing environment.

---

## 14. Cross-Cutting Workstreams

These run continuously alongside the numbered phases rather than belonging to a single phase:

| Workstream | Notes |
|---|---|
| **Security review** | Threat-model review at the end of every phase, not just Phase 11; redaction and isolation are release-blocking checks per PRD, checked every phase. |
| **Audit coverage regression testing** | Every phase that introduces a new mutating action must add corresponding audit coverage tests to CI (per PRD §9.13). |
| **SDK resilience benchmarking** | Re-run fail-open/backpressure/latency-overhead benchmarks any time the SDK or ingestion path changes (from Phase 1 onward). |
| **Dogfooding** | Strim monitoring its own runtime (PRD NFR-14.5.1) should begin as soon as Phase 1's SDK exists — Strim's own backend should be Application #1 in its own system. |
| **Design partner feedback loop** | Early design-partner customers should be onboarded starting Phase 2 (once Requests/Topology/Replay exist) to validate real-world topology/traffic assumptions before Simulation (Phase 4) and Change Plans (Phase 5) are built on top of them. |
| **Documentation** | API reference and module-level docs updated in the same phase the capability ships, not retroactively. |

---

## 15. Dependency Graph Summary

```
Phase 0 (Foundations)
   │
   ▼
Phase 1 (Observability MVP) ── requires Phase 0 tenancy/auth/API keys
   │
   ▼
Phase 2 (Requests/Topology/Replay) ── requires Phase 1 telemetry + redaction pipeline
   │
   ▼
Phase 3 (Config/Cache/Runtime Version/Snapshot) ── requires Phase 1 (Analytics DB) + Phase 2 (topology, for cache dependency context)
   │
   ▼
Phase 4 (Simulations/Load Testing) ── requires Phase 3 (Runtime Version, Traffic Snapshot) + Phase 2 (Replay infra reused)
   │
   ▼
Phase 5 (Change Plans/Rollout) ── requires Phase 3 (Diff) + Phase 4 (Simulation) + Phase 2 (Topology/Blast Radius)
   │
   ▼
Phase 6 (Incidents/Correlation) ── requires Phase 5 (Change Plan/Rollout events to correlate against) + Phase 1 (anomaly baselines)
   │
   ▼
Phase 7 (Policies/RBAC/Audit/Drift) ── generalizes hooks from Phase 5 & 6
   │
   ▼
Phase 8 (AI Layer) ── requires Phase 6 (Correlation), Phase 4 (Simulation results), Phase 3 (Cache recs) as grounding sources
   │
   ▼
Phase 9 (Integrations) ── requires Phase 5 (Change Plan lineage fields) + Phase 6 (Incidents, for paging)
   │
   ▼
Phase 10 (Scale-Out/Chaos) ── requires stable module boundaries from Phases 0–9
   │
   ▼
Phase 11 (Compliance/GA) ── requires everything above to be feature-complete and audited
```

---

## 16. Release Milestones

| Milestone | Phases Included | Customer-Facing Value |
|---|---|---|
| **M1 — Internal Alpha** | 0, 1 | Live runtime observability for a single design-partner application |
| **M2 — Design Partner Beta** | 2, 3 | Full request investigation, topology, safe replay, versioned config & cache management |
| **M3 — Private Beta: "Simulate"** | 4 | Simulations and load testing operational — first delivery of the core differentiator |
| **M4 — Private Beta: "Change with Confidence"** | 5, 6 | Full Change Plan lifecycle with guardrailed rollout, incident correlation, and rollback — the complete core loop is now live |
| **M5 — Public Beta** | 7, 8 | Org-wide policy control, hardened RBAC, AI-assisted investigation and natural-language querying |
| **M6 — General Availability** | 9, 10, 11 | Full CI/CD & deployment integrations, chaos simulation, scale-out architecture, compliance readiness, enterprise auth & billing |

---

*End of Implementation Phase Plan.*