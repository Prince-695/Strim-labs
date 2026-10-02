# Strim — Phase 8 Manual Testing Guide
### Production-Grade UI & Design System (`apps/web`)

This guide provides step-by-step instructions to verify all deliverables of **Phase 8: Production-Grade UI & Design System**.

---

## 🚀 Pre-requisites & Verification Setup

1. Start infrastructure and Strim server:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   bun run --filter @strim/server dev
   ```
   *The API server runs on `http://localhost:8080` (OpenAPI Swagger available at `/docs`).*

2. Start the web application:
   ```bash
   bun run --filter @strim/web dev
   ```
   *The web application runs on `http://localhost:3000`.*

3. Validate TypeScript type safety across the web application:
   ```bash
   bun run --filter @strim/web typecheck
   ```
   *Expected: `tsc --noEmit` exits with 0 errors.*

---

## 🎨 Test Suite 1: Marketing Landing Page & Design Tokens (`/`)

Open `http://localhost:3000` in your browser.

### 1.1 Visual Aesthetic & Typography
- Verify font loads **Mona Sans** from `@fontsource/mona-sans`.
- Verify the headline uses `text-headline-display` with Dribbble Modern accents (`--brand-pink: #EA4C89`, `--brand-lime: #CDE36B`, `--brand-ink: #0D0C22`).
- Verify the live status pill reads `v1.2 Live on Production Fleets`.

### 1.2 Interactive Simulation Cockpit Demo
- Adjust the **Simulated Traffic Ingress Multiplier** slider (from `1x` to `10x`).
  - Observe real-time calculated RPS updating live.
  - Observe the simulated P95 latency envelope adapting dynamically.
- Toggle **Edge L2 Memory Cache Tier**:
  - Notice origin database load drops from ~450 RPS to ~42 RPS (-85% relief).
  - Notice simulated P95 latency drops from ~180ms to ~18ms.
- Click the **Quickstart SDK Code** copy button to verify clipboard copy works.

---

## 🔐 Test Suite 2: Dedicated Authentication Suite

### 2.1 Editorial Split-Screen Login (`/login`)
- Navigate to `http://localhost:3000/login`.
- Verify editorial split screen with testimonial quote on the left and form on the right.
- Click the quick-fill persona pill **`priya@acme.test`**:
  - Email field auto-populates with `priya@acme.test` and password with `password123`.
- Click **Sign In to Strim**:
  - Session establishes and redirects to `/runtime`.

### 2.2 Organization Onboarding Wizard (`/signup`)
- Navigate to `http://localhost:3000/signup`.
- Fill in Full Name, Work Email, Company / Organization Name, and Password.
- Observe real-time password strength indicators.
- Submit to verify new organization creation and auto-redirect.

### 2.3 Password Recovery (`/forgot-password`)
- Navigate to `http://localhost:3000/forgot-password`.
- Enter email address and submit to verify confirmation message.

---

## 🧭 Test Suite 3: App Shell, Hierarchical Switcher & Command Palette

Log in and navigate to any dashboard page (e.g. `/runtime`).

### 3.1 Hierarchical Context Switcher
- In the top header bar, observe the 5-tier breadcrumb selector:
  `Organization > Workspace > Project > Application > Environment`.
- Changing an organization updates available workspaces and projects via `useSession()`.
- Notice the environment type badge (`PRODUCTION` in emerald or `STAGING` in amber).

### 3.2 Global Command Palette (`⌘K`)
- Press `⌘K` or click the search input in the top bar.
- The Command Palette modal opens with keyboard focus on the search input.
- Type `cache` or `canary` to filter features and press `Enter` to jump directly to `/cache` or `/change-plans`.
- Press `ESC` to dismiss.

---

## 📊 Test Suite 4: Runtime Fleet Intelligence (`/runtime`)

Navigate to `http://localhost:3000/runtime`.

### 4.1 Real-Time Gauges & KPIs
- Verify the **Composite Health Score** card (Score / 100 with dynamic color progress bar).
- Verify real-time Throughput (RPS), Latency (P95/P99), and Error Ratio cards.
- Change the time range filter pills (`15m`, `1h`, `6h`, `24h`) to observe smooth Recharts area and line graphs updating.

### 4.2 Constituent SLA Dimensions & Mitigation
- Inspect the 4 constituent dimensions (Availability, Latency Compliance, Error Budget, Dependency Health).
- Verify the active incidents status card with direct links to Traces and Topology.

---

## 🗺️ Test Suite 5: Service Topology Graph (`/topology`)

Navigate to `http://localhost:3000/topology`.

### 5.1 Interactive XYFlow Dependency Canvas
- Inspect the microservice caller-callee mesh nodes (`api-gateway`, `checkout-service`, `inventory-service`, `postgres-main`, `redis-l2`).
- Notice animated glowing edges indicating active RPC transactions.
- Filter nodes using the category pills (`All Nodes`, `Microservices`, `Gateways`, `Storage & Caches`).

### 5.2 Blast Radius Inspector
- Click on `checkout-service` node in the canvas.
- The **Blast Radius Inspector** side card displays:
  - Inbound RPS and P95 latency.
  - Calculated Blast Radius score (e.g. `78/100`).
  - Downstream dependency list (`inventory-service`, `payment-service`, `redis-l2`).
  - Quick action buttons ("Simulate Latency Spike", "Filter Traces in Explorer").

---

## 🔬 Test Suite 6: Request Explorer & Safe Replay Studio (`/requests`)

Navigate to `http://localhost:3000/requests`.

### 6.1 Telemetry Records Table
- Verify HTTP method pills (`GET` in sky, `POST` in emerald, `PUT` in amber, `DELETE` in rose).
- Test search filtering by path or trace ID.
- Test method filter pills (`GET`, `POST`, `ALL`).
- Test status filter pills (`Errors Only`, `> 300ms Slow`).

### 6.2 Distributed Trace Waterfall
- Click on any row or click **Spans**:
  - The modal opens displaying the distributed span waterfall.
  - Inspect microsecond offset timing bars for child database and cache calls.
  - Verify the scrubbed PII headers section.

### 6.3 Safe Replay Execution
- Click **Replay** on any transaction:
  - Select Replay Mode (`Shadow Safe Read-Only`, `Exact`, `Synthetic`).
  - Select Target Environment (`Staging` or `Development`).
  - Click **Dispatch Replay** to execute the sandboxed HTTP transaction and verify success response.

---

## 🚦 Test Suite 7: Change Plans & Canary Rollout Control (`/change-plans`)

Navigate to `http://localhost:3000/change-plans`.

### 7.1 Progressive Delivery State Machine
- Click **Create Change Plan**:
  - Enter Title, Objective, and add configuration key-values (e.g. `cache.l2.enabled = true`).
  - Submit to initialize a `DRAFT` plan.
- Click **Simulate** to run automated pre-flight digital twin checks.
- Click **Approve** to satisfy the four-eyes governance rule.
- Click **Step Canary** to shift traffic progressively (10% → 25% → 50% → 100%).
- Click **Instant Rollback** to verify sub-200ms emergency rollback capability.

---

## 🧪 Test Suite 8: Simulations Studio & Breaking Point Analyzer

### 8.1 What-If Simulations (`/simulations`)
- Navigate to `http://localhost:3000/simulations`.
- Click **Run Simulation Scenario**:
  - Configure an Edge L2 Cache Tier Acceleration scenario.
  - Submit to evaluate projected metrics against baseline.
  - Review side-by-side comparative cards showing P95 latency delta (-38% faster) and origin load relief (-85%).
  - Click **Promote to Change Plan** to transition the simulation into active delivery.

### 8.2 Load Stress & Breaking Point Analyzer (`/load-tests`)
- Navigate to `http://localhost:3000/load-tests`.
- Review the Breaking Point capacity metrics:
  - Sustainable Capacity ceiling.
  - Degradation Onset Knee threshold.
  - Critical Failure Boundary.
- Click **Execute Load Test**:
  - Configure target RPS and duration to run synthetic load testing against sandbox environments.

---

## ⚡ Test Suite 9: Cache Intelligence (`/cache`)

Navigate to `http://localhost:3000/cache`.

### 9.1 Cache Analytics & AI Recommendations
- Review the Global Hit Ratio gauge (e.g. `78%`), Database Offload Relief (`-42.8%`), and Egress Bandwidth Saved (`4.82 GB`).
- Click **Apply Acceleration Rule** on the AI Cache Recommendation card.

### 9.2 Atomic Purge / Invalidation
- Click **Purge Cache**:
  - Select **Tag-Based Invalidation** with `#catalog`.
  - Click **Execute Purge** to verify instantaneous cluster-wide cache invalidation.

---

## 🛡️ Test Suite 10: Governance, Audit, Billing & Copilot

- Navigate to `/policies` to inspect the live SLA enforcement rules and zero-drift status.
- Navigate to `/audit` to verify the immutable SHA-256 HMAC sealed event stream.
- Navigate to `/billing` to inspect subscription quota consumption, invoice history, and SAML SSO enforcement.
- Navigate to `/ai` to ask natural language SRE questions and inspect grounded telemetry citations.

---

## ✅ Phase 8 Sign-Off Checklist

- [x] Standard shadcn UI components preserved untouched in `apps/web/src/components/ui/`.
- [x] All custom styling cleanly applied via `className` props and CSS tokens.
- [x] Production marketing landing page with interactive simulation cockpit.
- [x] Editorial split-screen auth suite (`/login`, `/signup`, `/forgot-password`).
- [x] Modern App Shell with 5-tier hierarchical context switcher and Command Palette (`⌘K`).
- [x] Runtime Overview with composite health score dial and Recharts curves.
- [x] Interactive service topology graph with blast radius inspector.
- [x] Request Explorer with distributed span waterfalls and safe replay studio.
- [x] Change plans control center with 6-step lifecycle stepper and instant rollback.
- [x] What-if simulations studio and load stress breaking point analyzer.
- [x] Edge cache intelligence with atomic tag invalidation and AI recommendations.
- [x] Incident command center, policies, audit trail, billing, and AI copilot.
