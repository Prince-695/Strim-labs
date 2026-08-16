# Strim — Product Requirements Document (PRD)
### Runtime Intelligence & Change Platform

**Document Owner:** Product & Engineering Leadership
**Version:** 1.0
**Status:** Draft for Review
**Classification:** Multi-Tenant Developer Infrastructure SaaS

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Vision & Product Thesis](#3-vision--product-thesis)
4. [Product Definition](#4-product-definition)
5. [Target Users & Personas](#5-target-users--personas)
6. [Core Concepts & Domain Model](#6-core-concepts--domain-model)
7. [System Architecture Overview](#7-system-architecture-overview)
8. [Multi-Tenancy Model](#8-multi-tenancy-model)
9. [Functional Requirements — By Module](#9-functional-requirements--by-module)
10. [SDK & Ingestion Requirements](#10-sdk--ingestion-requirements)
11. [AI / Intelligence Layer Requirements](#11-ai--intelligence-layer-requirements)
12. [Security, Privacy & Compliance Requirements](#12-security-privacy--compliance-requirements)
13. [RBAC & Access Model](#13-rbac--access-model)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Data Storage Requirements](#15-data-storage-requirements)
16. [API Requirements](#16-api-requirements)
17. [UX / UI Requirements](#17-ux--ui-requirements)
18. [Integrations](#18-integrations)
19. [Success Metrics & KPIs](#19-success-metrics--kpis)
20. [Risks, Assumptions & Open Questions](#20-risks-assumptions--open-questions)
21. [Out of Scope](#21-out-of-scope)
22. [Glossary](#22-glossary)

---

## 1. Executive Summary

**Strim** is a multi-tenant SaaS platform that builds and maintains a **living Runtime Model** of an engineering organization's software systems, and uses that model to let engineers **safely observe, simulate, and change** production and non-production runtime behavior.

Strim is not an aggregation of existing DevOps tools into a single dashboard. It is a **Runtime State Machine**: a system that continuously tracks the *current* state of an application's runtime, allows engineers to define a *proposed* state, computes the *diff* between them, *simulates* the effect of that diff using representative traffic, and then *safely rolls out* the change under guardrails — with full audit history and rollback at every stage.

The product's single most important idea is captured in its tagline:

> **"Know what a change will do before production finds out."**

Strim occupies a distinct position relative to adjacent categories (observability, feature flags, load testing, incident management, CI/CD) by **integrating with** these systems rather than replacing them, and by unifying them around one shared object: **Runtime State**.

This PRD defines the full product scope, domain model, functional and non-functional requirements, security model, and success criteria required to build Strim as a production-grade, multi-tenant SaaS platform.

---

## 2. Problem Statement

### 2.1 The Core Problem

Modern software systems are distributed, deeply interdependent, and constantly changing. A single user-facing request may traverse many services, each with its own configuration, traffic profile, latency characteristics, error behavior, dependency graph, caching layer, and deployment history.

When something goes wrong — or before a risky change is made — engineers are forced to manually reconstruct a story by jumping between disconnected tools:

- Observability / APM dashboards
- Log aggregators
- Distributed tracing systems
- API testing / replay tools
- Load testing tools
- Configuration management systems
- Cache management consoles
- Deployment / CI-CD history
- Incident management systems

Each tool has a partial view. None of them share a common model of "what is the runtime, right now, and what would it look like if we changed X."

### 2.2 The Cost of the Problem

- **Slow incident response**: engineers spend the majority of an incident correlating data across tools rather than fixing the problem.
- **Fear-driven change management**: teams under-invest in performance and reliability improvements because the blast radius of a runtime change (e.g., changing a timeout, enabling a cache) is unknown until it's in production.
- **Repeated outages from configuration changes**: a large share of production incidents originate from configuration or runtime parameter changes rather than code bugs, yet configuration changes are the least tested and least simulated class of change.
- **No memory**: organizations rarely retain a queryable history of "what changed, what happened, and what we learned," so the same mistakes recur across teams and time.

### 2.3 The Underlying Gap

There is no single system whose job is to:

1. Maintain a continuously updated **model of runtime behavior**.
2. Let engineers express a **proposed change** to that runtime as a first-class, versioned object.
3. **Simulate** that change against representative production traffic before it is applied.
4. **Roll out** the change under **guardrails**, observing real impact incrementally.
5. **Roll back** automatically or manually if the change misbehaves.
6. **Remember** everything — turning every change into organizational knowledge.

Strim is built to close this gap.

---

## 3. Vision & Product Thesis

### 3.1 Vision Statement

To become the **runtime memory and control layer** for every engineering organization — the system where "what is running, why it behaves the way it does, and what happens if we change it" is always answerable with confidence.

### 3.2 Product Thesis

> **Maintain a living Runtime Model, and use it to safely change software.**

This is deliberately **not**: *"put many DevOps tools into one dashboard."* Dashboards are a surface; Strim's actual product is the underlying **Runtime State Machine** — a system that understands:

```
Current State → Proposed State → Difference → Simulation → Approval →
Rollout → Observed Result → New Runtime State
```

### 3.3 Guiding Analogy: "Git for Runtime"

| Git manages | Strim manages |
|---|---|
| Code | Runtime |
| "What changed?" | "What changed in production?" |
| Diff | Runtime Diff |
| Tests | Simulation |
| Commit | Change Plan |
| Revert | Rollback |
| History | Audit + Runtime History |

### 3.4 The Core Loop

```
OBSERVE → UNDERSTAND → PROPOSE → SIMULATE → COMPARE → APPROVE →
ROLLOUT → VERIFY → CONTINUE

  (on degradation)
VERIFY → DEGRADATION → INCIDENT → INVESTIGATE → ROLLBACK → VERIFY AGAIN
```

This closed loop **is** the product. Every feature in Strim exists to support one or more stages of this loop.

### 3.5 Architectural Principles

1. Runtime is the source of truth for **observed** behavior.
2. Desired runtime state is **versioned**, never mutated in place.
3. Changes are represented as **explicit, first-class objects** (Change Plans), never as implicit side effects.
4. Changes should be **testable/simulatable** before rollout whenever technically possible.
5. Production changes are **controlled** — staged rollout with guardrails, not all-or-nothing.
6. Every important action is **auditable** and the audit trail is **immutable**.
7. Strim must **never become a production single point of failure** — SDKs fail open, ingestion degrades gracefully.
8. Customer data is **strictly tenant-isolated** at every architectural layer.
9. Heavy workloads (simulation, replay, load testing, analytics) are **asynchronous**.
10. Strim **integrates with** existing infrastructure (CI/CD, deployment platforms, cloud providers) instead of replacing it.

---

## 4. Product Definition

### 4.1 What Strim Is

A multi-tenant SaaS platform that:

- Builds a living model of an application's runtime (the **Runtime Model**).
- Lets engineers understand what's running, how it behaves, and how it's connected (topology, dependencies, traffic).
- Captures and replays real production requests safely.
- Runs simulations, load tests, stress tests, and "what-if" scenarios against representative traffic.
- Manages runtime configuration and caching as versioned, auditable, environment-aware state.
- Packages a proposed runtime change into a **Change Plan** with simulated impact, blast radius, and risk score.
- Rolls changes out in controlled stages with automated guardrails.
- Detects incidents, correlates them with recent changes, and supports investigation, rollback, and resolution.
- Maintains an immutable audit trail of every meaningful action.
- Surfaces an AI-assisted intelligence layer for natural-language querying and explanation of runtime behavior.

### 4.2 What Strim Is Not

Strim explicitly does **not** attempt to replace:

| Category | Strim's relationship |
|---|---|
| Kubernetes / orchestration | Observes and reads state; does not orchestrate deploys |
| Deployment platforms (ArgoCD, Vercel, etc.) | Integrates via webhooks/APIs; does not deploy |
| Generic API gateway | May sit adjacent to traffic but is not a general-purpose gateway |
| CDN | Not a content delivery network |
| Generic cache product (e.g., standalone Redis product) | Manages cache *policy and visibility*, not a general caching engine |
| Generic feature flag platform | Change Plans are richer/more structured than simple flags, and are runtime-state-centric |
| Generic observability platform (Datadog, etc.) | Consumes/produces telemetry but is not a general-purpose APM |
| Generic load testing tool (k6, Gatling) | Provides load testing as one capability within the broader change-safety loop |
| Generic incident management (PagerDuty, Opsgenie) | Detects and correlates incidents; integrates with paging tools rather than replacing them |
| GitHub / source control | References commits/PRs; does not manage source code |
| CI/CD | Integrates as a gate/step; does not replace pipelines |

Strim's differentiation is **not** breadth of tooling — it is the **unification of these concerns around a single, versioned Runtime Model and Change Plan object.**

### 4.3 Core Objects (Canonical Definitions)

| Concept | Definition |
|---|---|
| **Core Product Object** | Change Plan |
| **Core Technical Object** | Runtime Model |
| **Core State Object** | Runtime State |
| **Core Experiment Object** | Simulation |
| **Core Safety Object** | Policy / Guardrail |
| **Core Operational Object** | Incident |
| **Core Historical Object** | Runtime Snapshot |

### 4.4 One-Line Pitch

> Strim is a multi-tenant runtime intelligence platform that builds a living model of your software system and lets engineering teams safely simulate, apply, monitor, and roll back runtime changes.

---

## 5. Target Users & Personas

### 5.1 Primary Customer Profile

Organizations running APIs, distributed systems, and production software at meaningful scale — typically Series A+ startups through large enterprises with multiple backend services and at least one dedicated platform/SRE function.

### 5.2 Personas

#### Persona A — Backend/Platform Engineer ("Priya")
- Owns one or more services; makes frequent configuration and performance changes.
- Primary jobs-to-be-done: understand current runtime behavior, propose and simulate a change, roll it out safely, verify improvement.
- Cares about: fast feedback loops, confidence before shipping, not breaking other teams' services.

#### Persona B — Site Reliability Engineer ("Marcus")
- Owns reliability posture across many services; on-call.
- Primary jobs-to-be-done: rapid incident diagnosis, correlate incidents with recent changes, enforce guardrails/policies org-wide, approve risky Change Plans.
- Cares about: blast radius visibility, rollback speed, org-wide audit trail.

#### Persona C — Engineering Manager ("Alicia")
- Owns a team responsible for several services.
- Primary jobs-to-be-done: understand what changed and why, review incident history, ensure team follows safe-change practices, report on reliability trends.
- Cares about: visibility without needing to operate the tools directly, risk reporting, team ownership clarity.

#### Persona D — DevOps / Infrastructure Engineer ("Tom")
- Manages platform-level configuration, rate limits, and integrations (CI/CD, cloud providers).
- Primary jobs-to-be-done: configure organization-wide policies, manage API keys and integrations, monitor multi-application health.
- Cares about: automation via CI/CD gates, org-wide guardrails, integration reliability.

#### Persona E — Developer (non-owner, contributing) ("Devon")
- Contributes code to a service they don't fully own.
- Primary jobs-to-be-done: inspect specific requests, replay a failing request in staging, understand dependency behavior before submitting a PR.
- Cares about: read access to requests/replay, low-friction investigation, doesn't need write access to production config.

### 5.3 Buyer vs. User

- **Economic buyer**: VP Engineering / Head of Platform / CTO.
- **Champion / primary daily user**: SRE and Platform Engineering leads.
- **Broad user base**: all backend engineers across teams, via read access and self-service Change Plans within their own service scope.

---

## 6. Core Concepts & Domain Model

### 6.1 Runtime State

The current, observed (and desired) configuration and behavioral state of an application in a given environment. Example:

```
cache.enabled = false
cache.ttl = 0
checkout.timeout = 5000ms
retry_count = 2
```

### 6.2 Runtime Model

Strim's internal representation of a software system, combining:

- Topology
- Traffic
- Requests
- Metrics
- Configuration
- Cache
- Dependencies
- Runtime versions
- Historical states
- Incidents
- Policies

The Runtime Model is the heart of Strim; every feature reads from or writes to it.

### 6.3 Current State vs. Proposed State → Runtime Diff

An engineer creates a **Proposed Runtime State**. Strim computes the diff against the **Current Runtime State**:

```
cache.enabled:     false → true
cache.ttl:         0 → 60
checkout.timeout:  5000 → 3000
```

This **Runtime Diff** is the basis of a Change Plan.

### 6.4 Full Domain Model (Entity Hierarchy)

```
Organization
 └─ Workspace
     └─ Project
         └─ Application
             └─ Environment
                 └─ Service
                     └─ Endpoint
                         └─ Dependency
                         └─ Runtime State
                         └─ Runtime Version
                         └─ Runtime Snapshot
                         └─ Configuration
                         └─ Cache Rules
                         └─ Requests
                         └─ Traffic Snapshots
                         └─ Scenarios
                         └─ Simulations
                         └─ Change Plans
                         └─ Rollouts
                         └─ Incidents
                         └─ Policies
                         └─ Audit
```

### 6.5 Three-Plane Architecture (Conceptual, Product-Level)

| Plane | Answers | Contains |
|---|---|---|
| **Data Plane** | "What is actually running?" | Applications, APIs, Services, Requests, Dependencies, Traffic, Cache |
| **Control Plane** | "What should the runtime become?" | Configuration, Cache Rules, Rate Limits, Policies, Change Plans, Rollouts, Rollbacks |
| **Intelligence Plane** | "What is happening / what changed / what might happen?" | Analytics, Anomaly Detection, Impact Analysis, Recommendations, Simulation Results, AI |

### 6.6 Change Lineage

A first-class traceability chain linking a code change all the way through to production outcome:

```
Git Commit → Deployment → Runtime Change → Simulation → Rollout →
Runtime Behavior → Incident (if any) → Rollback (if any)
```

This full lineage must be queryable end-to-end for any given Change Plan.

---

## 7. System Architecture Overview

> Full technical build sequencing lives in the companion **Implementation Phases** document. This section defines architecture as a *product requirement*, not an implementation plan.

### 7.1 High-Level Data Flow

```
Customer Applications
   → SDK / Agent / Proxy
   → Strim Ingestion API
   → Event Bus / Queue
   → Processors / Workers
   → PostgreSQL / Analytics DB (ClickHouse-class) / Object Storage / Redis
   → Strim API
   → Web App / Realtime (WebSocket)
```

### 7.2 Backend Composition Requirement

The backend **must** initially be built as a **modular monolith** (explicitly NOT 20 microservices from day one), organized into clearly bounded modules mapped 1:1 to product domains:

```
auth · organizations · workspaces · projects · applications · environments ·
runtime · telemetry · requests · topology · cache · configuration · replay ·
simulations · load-testing · change-plans · policies · incidents · audit ·
integrations · billing
```

High-scale workloads (telemetry ingestion, simulation execution, analytics) must be **splittable later** without a full rewrite — module boundaries must be respected as strict internal API boundaries from day one even while co-deployed.

### 7.3 Asynchronous Workload Requirement

The following operations are **required** to be asynchronous, backed by a job queue and worker pool, and must emit progress events consumable by the realtime layer:

- Replay (single, session, traffic, scaled, transformed)
- Simulation execution
- Load / stress / spike / endurance / capacity testing
- Telemetry processing / aggregation
- Snapshot generation
- Analytics rollups
- Anomaly detection

### 7.4 Event-Driven Backbone

Strim requires an internal event bus supporting at minimum the following event types (non-exhaustive — extensible):

```
REQUEST_STARTED · REQUEST_COMPLETED · ERROR_DETECTED · CONFIG_CHANGED ·
CACHE_UPDATED · CACHE_INVALIDATED · SIMULATION_STARTED ·
SIMULATION_PROGRESS · SIMULATION_COMPLETED · LOAD_TEST_STARTED ·
LOAD_TEST_PROGRESS · LOAD_TEST_COMPLETED · CHANGE_APPROVED ·
ROLLOUT_STARTED · ROLLOUT_PAUSED · ROLLBACK_STARTED ·
ROLLBACK_COMPLETED · INCIDENT_CREATED · INCIDENT_RESOLVED
```

These events must drive: metrics aggregation, incident detection, UI live-updates (WebSocket), and audit logging.

### 7.5 Resilience Requirement

Strim must be architected so that **temporary unavailability of Strim never degrades the customer's production application**. This drives specific SDK requirements (fail-open, local buffering, backpressure — see Section 10) and specific ingestion requirements (accept-and-defer processing, graceful shedding under load).

---

## 8. Multi-Tenancy Model

### 8.1 Tenancy Requirements

1. Every tenant-owned database record **must** include `organization_id`.
2. Many records must additionally scope to `workspace_id`, `project_id`, `application_id`, and `environment_id` as applicable.
3. Authorization **must** be enforced at multiple layers:
   - API layer (request-level scoping)
   - Service layer (business-logic-level scoping)
   - Database layer where appropriate (row-level security or equivalent for high-sensitivity tables)
4. **Frontend filtering is explicitly NOT an acceptable security boundary** under any circumstance.
5. Production and non-production environment data must be logically partitioned such that production data can **never** accidentally leak into development or staging contexts (e.g., during replay or simulation).

### 8.2 Organization Hierarchy

```
Organization
 → Users
 → Teams
 → Workspaces
 → Projects
 → Applications
 → Environments
 → Runtime
```

### 8.3 Tenant Isolation Testing Requirement

Before GA, the platform must pass a dedicated **cross-tenant isolation test suite** covering: API responses, WebSocket event streams, search/query endpoints, exported reports, audit logs, and AI/NL query responses — verifying that no tenant can observe another tenant's data under any code path, including error responses and timing side-channels where feasible.

---

## 9. Functional Requirements — By Module

Each module below defines: purpose, primary entities, key screens/actions, and functional requirements (FR-prefixed, testable).

### 9.1 Runtime

**Purpose:** Answer "what is happening right now?" for a given application/environment.

**Contains:** Overview, Health, Metrics, Latency, Errors, Throughput, Runtime State, Runtime Versions, Runtime Snapshots.

**Runtime Overview screen must show:**
- Application health score
- Traffic (RPS)
- Latency (P95/P99)
- Error rate
- Dependency health
- Cache health
- Recent runtime changes
- Active incidents
- Current runtime version

**Requirements:**
- FR-9.1.1: Strim must compute and display a Runtime Health Score (0–100) derived from error rate, latency, availability, traffic anomalies, dependency failures, cache behavior, and resource saturation.
- FR-9.1.2: The health score must always be accompanied by its underlying metric breakdown — it must never be shown without explainability.
- FR-9.1.3: Runtime State must be queryable as of any point in time (current or historical).
- FR-9.1.4: Runtime Versions must be immutable, sequentially numbered, and diffable against any other version.
- FR-9.1.5: A Runtime Snapshot must capture: configuration, topology, traffic distribution, endpoint behavior, cache state, dependency health, error profile, and latency profile at a point in time.

### 9.2 Applications

**Purpose:** Represent software systems connected to Strim.

**Entities:** Services, Environments, Versions, Endpoints, Dependencies, Runtime State, Ownership.

**Metadata fields required:** Name, Repository, Language, Framework, Owner, Team, Region, Version.

**Requirements:**
- FR-9.2.1: Every application must have an Owner Team, Technical Owner, and On-call Team.
- FR-9.2.2: Every application must support Development, Staging, and Production environments minimum, with the ability to define custom environments.
- FR-9.2.3: Each environment maintains fully independent Runtime State, Configuration, Traffic, Metrics, Policies, Cache rules, and Incidents.
- FR-9.2.4: The system must prevent any production data (requests, config values, secrets) from being visible or usable within a non-production environment context, except via explicit, permissioned, redacted replay.

### 9.3 Requests

**Purpose:** Inspect individual runtime events (the Request Explorer).

**Required request metadata:** Request ID, Trace ID, Timestamp, Method, Path, Status, Duration, Region, Environment, Service, Request size, Response size, Dependency information.

**Requirements:**
- FR-9.3.1: Every request record must support actions: View Trace, Replay, Compare, Create Simulation, Create Load Test.
- FR-9.3.2: Sensitive payload data must be stored/handled separately from request metadata and must be subject to the redaction rules in Section 12.
- FR-9.3.3: Requests must be groupable into **Sessions** (ordered sequences of related requests), which are themselves replayable as a unit.
- FR-9.3.4: Request Comparison must diff: JSON response body, headers, status, timing, dependency behavior, retries, and cache behavior between an original and a replayed/compared request.

### 9.4 Replay

**Purpose:** Reproduce runtime behavior safely, on demand.

**Required replay modes:**
| Mode | Description |
|---|---|
| Exact Replay | Replay one request |
| Session Replay | Replay a sequence of related requests |
| Traffic Replay | Replay a captured traffic snapshot |
| Scaled Replay | Replay at 2x / 5x / 10x volume |
| Transformed Replay | Replay with selected fields modified |

**Requirements:**
- FR-9.4.1: Before any replay executes, Strim must remove credentials, replace tokens, redact PII, and sanitize headers.
- FR-9.4.2: Strim must prevent replay of requests that would trigger irreversible/dangerous operations (e.g., payment capture) unless explicitly and separately authorized per-request.
- FR-9.4.3: Replay targeting a **production** environment requires an explicit, separately-scoped permission distinct from staging/dev replay permission.
- FR-9.4.4: Every replay execution must be recorded in the audit trail with actor, target, mode, and timestamp.

### 9.5 Topology

**Purpose:** Represent and visualize application architecture and dependencies.

**Requirements:**
- FR-9.5.1: The topology graph must be derived from both **observed runtime behavior** (automatic) and **explicit configuration** (manual override/annotation).
- FR-9.5.2: Every topology node must display: Name, Owner, Environment, Health, RPS, Latency, Errors, Dependencies.
- FR-9.5.3: Strim must answer dependency queries including: "What depends on X?", "What breaks if Y becomes unavailable?", "Which dependency contributes most to latency for path Z?", "Which endpoints depend on data store W?", "Which teams own affected services?"
- FR-9.5.4: **Blast Radius** must be computed for any proposed runtime change prior to approval, listing affected services, teams, and dependencies.

### 9.6 Cache

**Purpose:** First-class management of runtime caching as policy, not just infrastructure.

**Cache Rule fields:** Endpoint, HTTP Method, TTL, Cache Key, Query parameters, Headers, Tags, Authorization context.

**Requirements:**
- FR-9.6.1: Cache invalidation must support: manual purge, tag-based purge, endpoint-based purge, and automatic invalidation triggered by defined events.
- FR-9.6.2: Cache Analytics must report: total requests, hits, misses, hit rate, origin reduction %, and bandwidth saved.
- FR-9.6.3: Strim must generate **Cache Recommendations** by analyzing endpoint traffic volume, latency, and data change frequency, and must present a quantified projected impact (e.g., projected origin traffic reduction).

### 9.7 Runtime Configuration

**Requirements:**
- FR-9.7.1: All configuration must be versioned, environment-aware, permission-controlled, audited, and rollbackable.
- FR-9.7.2: Every configuration version must store: actor, timestamp, reason, old value, new value, and environment.
- FR-9.7.3: An entire runtime state must be representable and diffable as a **Runtime Version** (a coherent bundle of configuration values, not just a single key).

### 9.8 Simulations

**Purpose:** Answer "what would happen if the runtime were different?"

**A Simulation consists of:** Baseline Runtime State, Proposed Runtime State, Traffic Scenario, Environment, Metrics, Comparison Rules.

**What-If Engine — required supported question types (extensible):**
- What if traffic becomes Nx?
- What if cache is enabled/disabled?
- What if timeout/retry values change?
- What if a dependency becomes M% slower?
- What if cache hit rate drops?
- What if a dependency becomes unavailable?

**Requirements:**
- FR-9.8.1: Every simulation must first execute a **Baseline Run** against the current runtime state before executing the **Experiment Run** against the proposed state, using the same traffic model for both.
- FR-9.8.2: The Comparison Engine must compute and display percentage deltas for at minimum: P95, P99, error rate, origin RPS, and cache hit rate.
- FR-9.8.3: Simulations must be able to consume a **Traffic Snapshot** derived from real production traffic to ensure representativeness.
- FR-9.8.4: Simulation results must be persisted and linkable to any Change Plan created from them.

### 9.9 Load Testing

**Required test types:** Load Test, Stress Test, Spike Test, Endurance Test, Capacity Test.

**Requirements:**
- FR-9.9.1: Load test configuration must support: target endpoint(s), duration, target RPS, ramp-up period, maximum workers, and traffic scenario source.
- FR-9.9.2: Strim must support **production-derived load testing**: capture production traffic → create traffic snapshot → scale snapshot (e.g., 3x) → execute load test with representative distribution preserved.
- FR-9.9.3: Strim must compute **Breaking Point Analysis**: sustainable capacity, degradation onset point, and critical failure point, with a plain-language recommendation.

### 9.10 Change Plans

**Purpose:** The core product object — represents "I want to change the runtime from State A to State B."

**Required components of every Change Plan:** Title, Description, Objective, Application, Environment, Current Runtime Version, Proposed Runtime Version, Runtime Diff, Simulation, Risk Score, Blast Radius, Approval, Rollout Strategy, Guardrails, Result, Audit History.

**Required state machine:**

```
DRAFT → VALIDATING → SIMULATION_PENDING → SIMULATING → SIMULATION_PASSED →
APPROVAL_PENDING → APPROVED → ROLLING_OUT → MONITORING → COMPLETED
```

Alternative/exception states: `SIMULATION_FAILED`, `REJECTED`, `ROLLOUT_PAUSED`, `ROLLBACK_PENDING`, `ROLLED_BACK`.

**Requirements:**
- FR-9.10.1: A Change Plan must not be able to transition to `APPROVED` while in `SIMULATION_FAILED`, unless an explicit override is granted by a user with sufficient permission, which must itself be audited with a mandatory justification.
- FR-9.10.2: Strim must compute **Change Impact Analysis** prior to approval, describing affected services, endpoints, dependencies, teams, and any historically-correlated incident patterns for similar changes.
- FR-9.10.3: Strim must compute an explainable **Risk Score** (LOW / MEDIUM / HIGH) factoring blast radius, traffic volume, number of affected services, dependency sensitivity, historical failures, magnitude of configuration difference, and simulation result.
- FR-9.10.4: Approval requirements must be configurable per policy (see 9.11) based on environment, risk, service, and change type; multi-party approval (e.g., Engineering + SRE) must be supported.
- FR-9.10.5: Approved Change Plans must roll out in **staged percentages** (e.g., 0% → 10% → 25% → 50% → 100%), observing health after each stage before proceeding automatically or requiring manual advance, per policy configuration.
- FR-9.10.6: Every Change Plan must reference, where available, its associated Git commit, branch, and pull request (Change Lineage — Section 6.6).

### 9.11 Policies & Guardrails

**Policy types:** Runtime Policies, Guardrails, Rate Limits, Rollout Policies, Approval Policies, Security Policies, Data Retention Policies.

**Requirements:**
- FR-9.11.1: Rollout Guardrails must support threshold-based automatic actions, e.g.: `IF error_rate > 5% → STOP`, `IF P95 > 2s → PAUSE`, `IF availability < 99% → ROLLBACK`, `IF dependency errors exceed threshold → PAUSE`.
- FR-9.11.2: Rate limits must be configurable at Organization, Workspace, Application, Environment, API key, User, IP, and Endpoint scope, with the most specific applicable limit taking precedence.
- FR-9.11.3: Policy changes must themselves be versioned and audited identically to runtime configuration changes.

### 9.12 Incidents

**Requirements:**
- FR-9.12.1: Strim must continuously evaluate runtime behavior against expected baselines and automatically create an Incident when statistically significant anomalies are detected (e.g., error rate deviating substantially from historical baseline).
- FR-9.12.2: Incident Correlation must consider: traffic, latency, errors, configuration changes, cache changes, rollouts, dependencies, deployments, and recent simulations, and must produce a time-ordered timeline.
- FR-9.12.3: Strim must **never** assert unqualified causality (e.g., "Configuration X caused the incident"). All causal language must be presented as "potential contributing factors" with an associated confidence level (e.g., Low / Medium / High), and the system must explicitly state when causality cannot be proven.
- FR-9.12.4: From an Incident view, users must be able to: view affected services, view requests, view traces, replay requests, create a simulation, view recent changes, pause an active rollout, initiate rollback, and notify a team.
- FR-9.12.5: Rollback must be one action away from any active incident tied to a recent Change Plan, and rollback itself must be fully audited.

### 9.13 Audit

**Requirements:**
- FR-9.13.1: The following action classes must be recorded, at minimum: configuration changes, cache rule changes, simulation creation, request replay, load test execution, change approval/rejection, rollout start/pause, rollback execution, and policy changes.
- FR-9.13.2: Every audit record must capture: actor, action type, resource, old value, new value, environment, and timestamp.
- FR-9.13.3: Audit records must be **immutable** — no update or delete operation may be exposed via any API or admin interface, including to Organization Owners.
- FR-9.13.4: The Audit UI must support filtering by user, action, resource, environment, and time range, and must support export for compliance purposes.

### 9.14 Environment Promotion & Drift

**Requirements:**
- FR-9.14.1: Strim must support promoting runtime configuration between environments (e.g., Staging → Production) with optional required validation, simulation, and approval gates.
- FR-9.14.2: Strim must detect **Runtime Drift** — divergence between an expected/declared state and the actual observed runtime state — and surface it with options to Inspect, Accept, Correct, or Create a Change Plan to resolve it.

### 9.15 Chaos / Failure Simulation (Post-MVP Capability)

**Requirements:**
- FR-9.15.1 (future): Strim must support simulating dependency-level failures (added latency, error injection, timeout, slowdown, cache unavailability, partial service failure, traffic spike) against the Runtime Model to answer "what happens to the runtime if this dependency fails?" This is scoped as a post-MVP capability (see Implementation Phases doc).

---

## 10. SDK & Ingestion Requirements

### 10.1 Integration Model

```
Customer Application → Strim SDK → Strim Ingestion API
```

Example integration surface:

```bash
npm install @strim/sdk
```

```javascript
import { strim } from "@strim/sdk";

strim.init({
  projectId: "checkout",
  environment: "production",
  apiKey: process.env.STRIM_API_KEY
});
```

### 10.2 SDK Capture Requirements

The SDK must be able to capture: request metadata, response metadata, latency, errors, trace IDs, dependency information, runtime configuration reads, custom metrics, and custom events.

### 10.3 SDK Resilience Requirements (Mandatory)

- FR-10.3.1: **Fail-open behavior** — if Strim is unreachable or degraded, the host application must continue operating normally with zero functional impact.
- FR-10.3.2: **Sampling** — configurable at global, per-application, per-environment, per-endpoint granularity, including error-only and latency-based sampling (e.g., "capture 100% of 5xx, 10% of 2xx").
- FR-10.3.3: **Redaction** — automatic redaction of Authorization headers, cookies, passwords, API keys, JWTs, secrets, payment information, and PII before transmission, plus support for user-defined custom redaction rules.
- FR-10.3.4: **Async transmission** — telemetry sending must never block the request/response path of the host application.
- FR-10.3.5: **Local buffering & backpressure** — the SDK must buffer locally under transient Strim unavailability and must shed load gracefully (drop oldest or sample down) rather than consume unbounded memory.

### 10.4 SDK Runtime Configuration Access

```javascript
const timeout = strim.config("checkout.timeout");
```

- FR-10.4.1: Configuration reads via SDK must always return the current **approved** runtime configuration for the calling environment.
- FR-10.4.2: Configuration updates delivered to the SDK must be versioned, audited, authorized, and environment-specific — never a blind global broadcast.

### 10.5 API Key Requirements

- FR-10.5.1: API keys must be scoped (e.g., `telemetry:write`, `config:read`, `simulation:write`, `config:write`, `rollout:write`), rotatable, expirable, and revocable.
- FR-10.5.2: Strim must never allow — by design or by documentation example — a single universal key with unscoped access to be used for both SDK telemetry and administrative/automation actions.

---

## 11. AI / Intelligence Layer Requirements

### 11.1 Role of AI

AI in Strim is explicitly an **intelligence layer**, not an autonomous production controller. AI may **explain, summarize, recommend, and answer questions** — it must never be permitted to autonomously execute a production change, approval, or rollback without an explicit human-in-the-loop action, at least in the scope of this PRD.

### 11.2 Required AI Capabilities

- Incident summarization
- Change explanation ("why was this change made / what did it do")
- Runtime investigation assistance
- Cache recommendations
- Bottleneck analysis
- Simulation result interpretation (plain-language summary of comparison engine output)
- Natural-language runtime queries against the Runtime Model

### 11.3 Natural Language Query — Example Interaction Requirement

The AI layer must be able to answer questions such as:

- "Show me APIs that became slower after a config change."
- "What changed before today's incident?"
- "Which endpoints are good cache candidates?"
- "What happens if traffic increases 5x?"
- "Show me the last three rollbacks."
- "Which service has the highest dependency latency?"

### 11.4 Causality Discipline (Mandatory)

- FR-11.4.1: Any AI-generated explanation involving correlated factors must explicitly state the limits of certainty (e.g., "the system cannot prove causality") and must present contributing factors as a ranked, sourced list rather than a single asserted cause.
- FR-11.4.2: All AI answers must be **grounded in and traceable to** the underlying Runtime Model data (metrics, config history, audit log) — the AI must not answer from general knowledge when the question concerns the tenant's specific runtime.
- FR-11.4.3: AI query responses must respect the same tenant-isolation and RBAC scoping as any other API — an AI response must never surface data the requesting user could not otherwise access.

---

## 12. Security, Privacy & Compliance Requirements

### 12.1 Data Redaction (Mandatory, Non-Configurable Minimum)

Strim must automatically redact the following regardless of any configuration:

- Authorization headers
- Cookies
- Passwords
- API keys
- JWTs / bearer tokens
- Secrets
- Payment information
- PII (as defined by a maintained, extensible pattern/classification list)

Users must additionally be able to define **custom** redaction rules on top of this mandatory baseline.

### 12.2 Replay Safety (Mandatory)

- Credentials removed, tokens replaced, PII redacted, headers sanitized, dangerous operations prevented, and explicit authorization required before any replay executes (see FR-9.4.1–9.4.4).

### 12.3 Multi-Tenant Isolation (Mandatory)

- See Section 8 in full. This is treated as a release-blocking requirement category, not a best-effort one.

### 12.4 Environment Isolation (Mandatory)

- Production Runtime State, requests, and traffic must never be usable by, or leak into, development or staging contexts, except via explicit, permissioned, redacted replay or promotion workflows (FR-9.2.4, FR-9.14.1).

### 12.5 Data Retention

- FR-12.5.1: Data Retention Policies must be configurable per organization, per data class (request payloads, audit records, metrics, snapshots), subject to a documented minimum retention floor for audit records to satisfy typical compliance needs.
- FR-12.5.2: Audit records must be exempt from user-initiated deletion (immutability requirement, FR-9.13.3), and any retention-driven purge must itself be logged.

### 12.6 Compliance Posture (Target State)

While detailed compliance certification work (SOC 2, ISO 27001, etc.) is sequenced in the Implementation Phases document, this PRD requires that the architecture be **compliance-ready by design**: immutable audit logs, tenant isolation, encryption in transit and at rest, scoped API keys, and RBAC are treated as foundational, not retrofitted.

---

## 13. RBAC & Access Model

### 13.1 Roles (Minimum Required Set)

| Role | Scope |
|---|---|
| Owner | Full access to everything in the organization |
| Admin | Organization management (users, billing, integrations, org-wide policy) |
| Engineer | Runtime, Simulations, Change Plans (create/approve within permission) |
| Developer | Requests, Replay (non-production by default), read-only Configuration |
| Viewer | Read-only across all accessible resources |
| Billing | Billing and subscription management only |

### 13.2 Requirements

- FR-13.2.1: Roles must be assignable at Organization, Workspace, Project, and Application scope (a user may be an Engineer on one application and a Viewer on another).
- FR-13.2.2: Production-targeted actions (config write, replay-to-production, rollout approval, rollback) must be gate-able by a **separate, stricter permission tier** than the equivalent non-production action.
- FR-13.2.3: Approval policies (Section 9.11) must be able to require specific roles or specific named individuals/teams (e.g., "SRE team must approve any HIGH risk Change Plan").

---

## 14. Non-Functional Requirements

### 14.1 Availability & Resilience
- NFR-14.1.1: Strim's control plane (API, UI) target availability: 99.9%+.
- NFR-14.1.2: Ingestion path must degrade gracefully under load (shed/sample) rather than fail hard; customer application performance must never be impacted by Strim outages (ties to FR-10.3.1).

### 14.2 Performance
- NFR-14.2.1: Runtime Overview screen must load primary health metrics within a target of low single-digit seconds for the default (recent) time window under normal load.
- NFR-14.2.2: Realtime events (rollout stage transitions, incident creation) must propagate to connected UI clients within a low-second target via WebSocket.
- NFR-14.2.3: Simulation and load test execution are explicitly **not** required to be real-time; they must, however, report progress incrementally via events (SIMULATION_PROGRESS, LOAD_TEST_PROGRESS).

### 14.3 Scalability
- NFR-14.3.1: The analytics/telemetry storage layer must be architected to scale independently of the primary transactional (PostgreSQL) store from day one, even though initial deployment may co-locate infrastructure.
- NFR-14.3.2: The modular monolith must support extraction of any individual module into an independently deployable service without a data-model rewrite.

### 14.4 Auditability
- NFR-14.4.1: 100% of the mandatory audit action classes (Section 9.13) must be captured; audit coverage must be part of the release test suite for every module that performs a mutating action.

### 14.5 Observability of Strim Itself
- NFR-14.5.1: Strim must emit its own operational telemetry (its own "runtime") sufficient to diagnose its own incidents — dogfooding is a design requirement, not merely a nice-to-have.

---

## 15. Data Storage Requirements

| Store | Responsibility |
|---|---|
| **PostgreSQL** | Organizations, Users, Memberships, Teams, Workspaces, Projects, Applications, Environments, Configurations, Change Plans, Simulation metadata, Incidents, Policies, Audit, Billing |
| **Analytics / Time-Series DB** (ClickHouse-class or TimescaleDB-class) | Request aggregates, latency, RPS, errors, historical metrics, runtime analytics — explicitly must not live only in PostgreSQL |
| **Redis (or equivalent)** | Runtime cache, rate limit counters, distributed locks, short-lived state, realtime coordination, job state |
| **Object Storage** (S3 / R2 / MinIO-class) | Request/response payloads, traffic snapshots, replay datasets, simulation results, load-test reports, large logs |

**Requirement:** PostgreSQL remains the **authoritative** system of record for durable configuration and control-plane metadata; Redis and analytics stores are explicitly non-authoritative caches/derivatives.

---

## 16. API Requirements

- FR-16.1: Strim must expose a documented, versioned REST (or equivalent) API covering every module in Section 9, sufficient to build the entire web UI as a first-party API consumer (dogfooded API-first design).
- FR-16.2: All mutating API endpoints must enforce RBAC and tenant scoping identically to the UI (no "back door" via API).
- FR-16.3: A CI/CD-facing API surface must exist to support the gate pattern:
  ```
  GitHub Actions → Strim → Simulation → Result → PASS / FAIL
  ```
  e.g., `IF P95 regression > 20% THEN CI FAIL`.
- FR-16.4: A realtime (WebSocket or equivalent) API must expose the event types defined in Section 7.4 to authorized, tenant-scoped subscribers.

---

## 17. UX / UI Requirements

### 17.1 Recommended Frontend Stack
Next.js, TypeScript, Tailwind CSS, shadcn/ui, React Query, React Flow (topology graphs), Recharts (charts).

### 17.2 Primary Navigation (Top-Level IA)

```
Strim
├─ Runtime
├─ Applications
├─ Requests
├─ Topology
├─ Simulations
├─ Change Plans
├─ Cache
├─ Incidents
├─ Policies
└─ Audit
```

Global chrome: Search, Notifications, Organization switcher, Workspace switcher, Environment switcher, User menu.

### 17.3 Global Context Selector (Mandatory Pattern)

Every screen must display and respect the active context breadcrumb:

```
Organization / Workspace / Project / Application / Environment
```

Example: `Acme / Payments / Checkout / Checkout API / Production`

- FR-17.3.1: All data shown on any screen must be scoped to the currently selected context; switching Environment must never silently mix data from another environment.

### 17.4 Key Screen Requirements (Summary)

| Screen | Must show |
|---|---|
| Runtime Overview | Health, traffic, latency, errors, dependency/cache health, recent changes, active incidents, current version |
| Topology | Interactive graph; click-through to Runtime, Requests, Dependencies, Incidents, Create Simulation |
| Request Detail | Full metadata, timeline, dependencies, request/response data; actions: Replay, Compare, Create Scenario, Create Load Test |
| Simulation | Baseline vs. Experiment side-by-side; charts for latency, throughput, error rate, cache, dependencies, resource utilization |
| Change Plan | Objective, current vs. proposed state, simulation result, risk, blast radius, approvals, rollout stage progress, single primary action |
| Incident | Severity, affected services, recent changes, timeline, actions (Replay, Simulate, Pause Rollout, Rollback) |
| Audit | Filterable log with user, action, resource, environment, time |

---

## 18. Integrations

| Category | Examples | Nature of Integration |
|---|---|---|
| Source control | GitHub (commit, branch, PR reference) | Read/reference only |
| CI/CD | GitHub Actions, GitLab CI | Gate/step invocation via API |
| Deployment | ArgoCD, Kubernetes, Vercel | Observational webhooks/read APIs |
| Cloud providers | AWS, GCP, Azure | Observational integration for topology/metadata enrichment |
| Incident/paging | (future) PagerDuty, Opsgenie-class | Notification hand-off from Incident module |

**Requirement:** Strim must not require deploying the customer's application itself in order to function (Section 4.2).

---

## 19. Success Metrics & KPIs

### 19.1 Product-Level KPIs
- Time-to-diagnose: median time from incident detection to root-cause-candidate surfaced by Strim.
- % of production runtime changes that go through a simulated Change Plan (vs. out-of-band changes / drift).
- Mean time to rollback for a Change-Plan-correlated incident.
- Runtime Drift incidents detected and resolved per month.
- Cache recommendation adoption rate and measured origin-traffic reduction.

### 19.2 Business KPIs
- Number of connected applications per organization (flywheel indicator).
- Monthly active Change Plans per organization.
- Net Revenue Retention.
- Time-to-first-value (time from signup to first successful simulation).

### 19.3 The Strim Flywheel (as a growth metric model)

```
More applications → More runtime data → Better runtime model →
Better simulations → Better decisions → Safer changes → More trust →
More applications
```

---

## 20. Risks, Assumptions & Open Questions

### 20.1 Risks
- **R1 — Simulation fidelity:** simulated results may diverge from real production behavior if traffic models or dependency models are inaccurate; mitigation is production-derived traffic snapshots (FR-9.9.2) and continuous comparison of predicted vs. observed post-rollout metrics.
- **R2 — SDK overhead:** telemetry capture must not introduce measurable latency to customer requests; requires rigorous async/non-blocking SDK design and benchmarking (Section 10.3).
- **R3 — Data sensitivity:** request/response capture inherently touches potentially sensitive data; redaction must be extremely reliable (Section 12.1) — a redaction failure is a severe trust/compliance event.
- **R4 — Causality over-claiming:** an AI or correlation engine that overstates causal confidence could mislead incident response; mitigated by mandatory causality discipline (Section 11.4, FR-9.12.3).
- **R5 — Multi-tenant data leakage:** the single most severe risk category for the business; mitigated by the layered isolation requirements in Section 8 and a dedicated isolation test suite.

### 20.2 Assumptions
- Target customers already operate distributed/service-based architectures (this product is less valuable for a single monolith with no dependencies).
- Target customers have an existing CI/CD and source control workflow to integrate with.
- Initial GA scope assumes HTTP/REST-style request traffic as the primary supported protocol; other protocols (gRPC, message queues) are a later expansion (see Implementation Phases).

### 20.3 Open Questions (to be resolved during design review)
- Exact statistical method for anomaly/baseline detection (fixed threshold vs. adaptive/seasonal baselining) — recommend adaptive baselining as target state, fixed threshold as MVP fallback.
- Default data retention periods per plan tier.
- Whether chaos/failure simulation (Section 9.15) is pulled forward from post-MVP based on early customer demand signals.

---

## 21. Out of Scope

The following are explicitly excluded from this PRD's scope (may be revisited in future PRD revisions):

- Acting as a general-purpose APM/observability replacement for teams not adopting the Change Plan workflow.
- Deploying or orchestrating customer application code.
- Acting as a system of record for source code.
- Autonomous (non-human-approved) production changes by the AI layer.
- Non-HTTP protocol support at initial GA (gRPC, async messaging, GraphQL-specific tooling) — tracked as future expansion.
- Building a proprietary CDN or general-purpose edge network.

---

## 22. Glossary

| Term | Definition |
|---|---|
| Runtime State | The current configuration/behavioral state of an application in an environment |
| Runtime Model | Strim's composite internal representation combining topology, traffic, config, cache, dependencies, history, incidents, policies |
| Runtime Diff | The computed difference between Current and Proposed Runtime State |
| Change Plan | The versioned, auditable object representing an intended runtime change and its full lifecycle |
| Simulation | An experiment comparing Baseline vs. Proposed runtime state under a traffic scenario |
| Scenario | A defined combination of base/modified runtime state, traffic model, dependency model, scale, and duration |
| Traffic Snapshot | A captured, representative description of real traffic distribution and volume |
| Runtime Snapshot | A point-in-time capture of full runtime behavior and state |
| Blast Radius | The set of services, endpoints, dependencies, and teams potentially affected by a change |
| Risk Score | An explainable LOW/MEDIUM/HIGH rating of a Change Plan's risk |
| Guardrail | An automated threshold-based rule that pauses, stops, or rolls back a rollout |
| Drift | Divergence between expected/declared and actual observed runtime state |
| Runtime Memory | The long-term, queryable organizational history of runtime behavior, changes, and outcomes |

---

*End of Product Requirements Document.*