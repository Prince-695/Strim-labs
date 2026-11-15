# STRIM Labs --- Frontend Design System & Implementation Specification

**Document:** `design.md`\
**Product:** STRIM Labs\
**Scope:** Frontend design, UX, application shell, page layouts,
component system, and frontend/backend integration\
**Status:** Implementation-ready design direction\
**Deployment:** Vercel\
**Primary product promise:** **Find your API's breaking point before
production does.**

------------------------------------------------------------------------

## 1. Purpose and scope

This document defines the visual language and frontend experience for
STRIM Labs. The backend and its business logic are already implemented.
The current objective is to build a polished, production-quality
frontend that integrates with the existing API.

This is a frontend specification, not a backend redesign.

### Product summary

STRIM Labs is a developer platform for API observability, load testing,
and capacity analysis. It helps developers and engineering teams:

1.  Register projects and authorized API targets.
2.  Discover and manage API endpoints.
3.  Observe request volume, latency, errors, and endpoint health.
4.  Run controlled load tests.
5.  Understand sustainable throughput and observed breaking points.
6.  Compare test runs to identify performance regressions.

### Core user journey

``` text
Create account
    ↓
Create workspace / organization
    ↓
Create project
    ↓
Add and verify an authorized target
    ↓
Discover endpoints / connect telemetry
    ↓
View metrics
    ↓
Configure and run a load test
    ↓
Inspect live execution
    ↓
Analyze capacity and compare runs
```

### Design principles

-   **Simple by default, powerful when needed.** Present sensible
    defaults and reveal advanced controls progressively.
-   **Evidence over theatre.** Never display fabricated metrics, fake
    activity, or illustrative data as real measurements.
-   **One clear next step.** Every screen, including empty and error
    states, should make the next action obvious.
-   **Operational honesty.** Distinguish measured facts from inferred
    explanations.
-   **Safe by design.** Make target authorization, test configuration,
    and potentially disruptive actions explicit.
-   **Fast and responsive.** Keep navigation immediate, charts
    efficient, and layouts stable.
-   **Consistent product language.** Marketing, authentication,
    onboarding, and the application should feel like one product.

------------------------------------------------------------------------

## 2. Visual direction and brand identity

### 2.1 Creative direction

The visual direction takes inspiration from the supplied reference
image: a restrained combination of charcoal, sand, and electric blue.

The result should feel:

-   Premium and minimal.
-   Calm, technical, and confident.
-   Distinctive without looking experimental or overly decorative.
-   Data-focused without becoming visually dense.
-   Suitable for developers and engineering teams.

Avoid:

-   Generic dashboard templates.
-   Excessive gradients and neon glows.
-   Glassmorphism on every surface.
-   Large decorative illustrations inside the application.
-   Unnecessary animations.
-   Too many cards nested inside other cards.
-   Using the brand accent for every chart or status.

### 2.2 Core palette

Use these exact reference colors as the foundation.

  -----------------------------------------------------------------------
  Token                   Hex                     Usage
  ----------------------- ----------------------- -----------------------
  Charcoal                `#1E1E1C`               Primary dark canvas

  Sand                    `#D8CBB3`               Warm secondary accent
                                                  and selected editorial
                                                  surfaces

  Electric Blue           `#2F6BFF`               Primary action and
                                                  interactive accent
  -----------------------------------------------------------------------

### 2.3 Extended semantic tokens

The following supporting values establish usable surface and text
hierarchy around the three reference colors.

  Token                   Suggested value   Usage
  ----------------------- ----------------- -----------------------------------
  `--background`          `#1E1E1C`         Main application background
  `--surface`             `#252522`         Cards and panels
  `--surface-raised`      `#2D2D29`         Menus, dialogs, elevated surfaces
  `--surface-hover`       `#353530`         Hovered controls
  `--foreground`          `#F4F1EA`         Primary text
  `--foreground-muted`    `#A6A49D`         Secondary text
  `--foreground-subtle`   `#77766F`         Tertiary text
  `--sand`                `#D8CBB3`         Warm accent
  `--sand-subtle`         `#39352E`         Sand-tinted subtle surface
  `--brand`               `#2F6BFF`         Primary buttons and active states
  `--brand-hover`         `#2458E5`         Hover state
  `--brand-subtle`        `#1E2D50`         Selected/active background
  `--border`              `#41413B`         Standard borders
  `--border-subtle`       `#34342F`         Subtle dividers
  `--success`             `#35B779`         Successful operations
  `--success-subtle`      `#18382B`         Success background
  `--warning`             `#E6AD55`         Warnings and degradation
  `--warning-subtle`      `#3C3020`         Warning background
  `--danger`              `#EF6464`         Errors and critical actions
  `--danger-subtle`       `#3D2525`         Error background
  `--info`                `#75A7FF`         Informational states

These are initial design tokens. Validate foreground/background
combinations for WCAG AA contrast before release. Do not use color as
the only status indicator; pair status colors with text and/or icons.

### 2.4 Color usage rules

-   Charcoal is the dominant application canvas.
-   Surface colors should create subtle separation, not a stack of
    visually heavy cards.
-   Electric Blue is reserved for primary actions, selected navigation,
    links, focus rings, and key chart emphasis.
-   Sand should be used sparingly for warmth: secondary emphasis,
    selected labels, small highlights, and occasional marketing
    sections.
-   Success, warning, danger, and informational colors remain semantic.
-   Do not make every chart blue. Use a consistent, accessible chart
    palette with clear legends and labels.
-   Avoid large blue glows. A subtle glow may be used for a genuinely
    active live-test indicator.

### 2.5 Typography

Use the project's existing typography setup if already configured.
Preferred direction:

-   **Primary:** Geist or Inter.
-   **Monospace:** Geist Mono.

Typography rules:

-   Page titles: 24--32px desktop, 22--26px mobile.
-   Section headings: 16--20px.
-   Body text: 14--16px with comfortable line height.
-   Supporting labels: 12--13px; do not use tiny text for important
    information.
-   Endpoint URLs, IDs, HTTP methods, headers, code, and raw metric
    values use monospace.
-   Numeric metrics use tabular numerals to prevent layout shifts.
-   Use sentence case for labels and headings.
-   Keep descriptions short and scannable.

### 2.6 Shape, borders, and elevation

-   Use a 4px spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
-   Standard card radius: 10--12px.
-   Inputs and buttons: 8--10px radius.
-   Pills and status badges: fully rounded only where appropriate.
-   Prefer thin borders over shadows.
-   Reserve stronger elevation for dialogs, command menus, and
    dropdowns.
-   Maintain consistent alignment and spacing across all screens.

### 2.7 Motion

-   Use motion to explain state changes, not decorate the interface.
-   Typical transitions: 120--220ms.
-   Animate menu/dialog entry, button feedback, chart updates, and
    progress changes.
-   Avoid parallax, scroll hijacking, and continuous ambient animations.
-   Respect `prefers-reduced-motion`.
-   Never rely on animation to communicate test status or a critical
    alert.

------------------------------------------------------------------------

## 3. Technology stack and implementation constraints

The project has already been initialized and the core UI stack is
installed. Do not recreate the project, reinstall the existing UI
system, or replace working configuration without a concrete reason.

### 3.1 Confirmed stack

  Technology        Responsibility
  ----------------- -------------------------------------------------------
  Next.js           App Router, routing, layouts, server/client rendering
  React             UI composition
  TypeScript        Strict type safety
  Tailwind CSS      Styling and responsive design
  shadcn/ui         Existing UI component foundation
  Zustand           Client-side UI state and selected workspace/project
  TanStack Query    API server state, caching, mutations, invalidation
  Zod               Runtime validation and schemas
  React Hook Form   Form state and validation integration
  Lucide            Consistent line iconography
  Vercel            Frontend deployment and hosting

### 3.2 Supporting libraries

Use these only if already installed or when the relevant feature is
implemented:

-   ECharts or uPlot for data-heavy charts.
-   `@microsoft/fetch-event-source` or the project's existing SSE client
    for authenticated streaming.
-   `next-themes` if theme switching is implemented.
-   `openapi-typescript` and `openapi-fetch` if generated API types are
    part of the current workflow.
-   Vitest and Testing Library for unit/component tests.
-   Playwright for critical end-to-end flows.

Do not add dependencies merely because they appear in this document.
Inspect the existing `package.json` first and reuse the current
equivalents.

### 3.3 Frontend/backend boundary

-   The existing backend is the source of truth for business rules,
    authorization, validation, and persisted data.
-   Frontend validation improves usability but never replaces backend
    validation.
-   Use the existing API contracts and response envelope.
-   Do not invent endpoints, request fields, response fields, or
    capabilities.
-   Inspect Swagger/OpenAPI and the existing backend routes before
    implementing each feature.
-   Keep API communication inside a shared typed API layer.
-   Keep server state in TanStack Query; use Zustand for client-side
    interface state.
-   Use the backend's real authentication/session mechanism.
-   Do not store secrets or long-lived credentials in local storage.
-   Do not expose server-only environment variables to browser code.
-   Use environment variables for API base URLs and deployment-specific
    configuration.

### 3.4 Vercel deployment

The frontend is deployed on Vercel.

-   Keep the project compatible with the existing Vercel build
    configuration.
-   Configure production and preview environment variables in Vercel.
-   Ensure the API base URL and allowed backend CORS origins match each
    environment.
-   Validate production builds and TypeScript checks before merging.
-   Use preview deployments for UI review.
-   Do not assume frontend deployment also deploys or changes the
    backend.
-   Do not put backend secrets in `NEXT_PUBLIC_*` variables.

------------------------------------------------------------------------

## 4. Information architecture

Build the authenticated application around the core product workflow.
Route names below are proposed organization; preserve existing working
routes if the repository already uses a different convention.

### 4.1 Public routes

  Route             Purpose
  ----------------- -----------------------------------
  `/`               Marketing homepage
  `/product`        Product overview
  `/how-it-works`   Product workflow and architecture
  `/docs`           Documentation entry
  `/integrations`   Supported integrations
  `/security`       Security overview
  `/about`          Product/company information
  `/contact`        Contact/support
  `/privacy`        Privacy policy
  `/terms`          Terms of service

Only publish pages with accurate content. Do not invent customer logos,
testimonials, certifications, uptime claims, or pricing.

### 4.2 Authentication routes

  Route                     Purpose
  ------------------------- -------------------------------------
  `/auth/sign-in`           Sign in
  `/auth/sign-up`           Create account
  `/auth/forgot-password`   Request password reset
  `/auth/reset-password`    Set a new password
  `/auth/verify-email`      Email verification
  `/auth/callback`          OAuth callback, if configured
  `/invite/[token]`         Invitation acceptance, if supported

Show only authentication providers that are configured and working.

### 4.3 Authenticated routes

  Route                          Purpose
  ------------------------------ ---------------------------------------
  `/app`                         Overview dashboard
  `/app/runner`                  Load test configuration and execution
  `/app/tests`                   Test history
  `/app/tests/[id]`              Test details and analysis
  `/app/compare`                 Compare runs
  `/app/capacity`                Capacity analysis
  `/app/projects`                Project management
  `/app/projects/[id]`           Project overview
  `/app/targets`                 Target management
  `/app/targets/[id]`            Target details and verification
  `/app/endpoints`               Endpoint registry
  `/app/discovery`               Endpoint discovery and imports
  `/app/metrics`                 Observability metrics
  `/app/integrations`            Integrations
  `/app/api-keys`                API key management, if implemented
  `/app/organization`            Organization overview
  `/app/organization/members`    Member management
  `/app/organization/settings`   Organization settings
  `/app/settings/profile`        Personal profile
  `/app/settings/security`       Account security
  `/app/settings/preferences`    User preferences

The route map must reflect actual backend capabilities. Hide or clearly
label planned modules rather than presenting nonfunctional pages as
complete.

------------------------------------------------------------------------

## 5. Application shell

The authenticated application shell is the most important shared layout.
Build it once and reuse it across all application routes.

### 5.1 Desktop layout

Use a fixed or sticky left sidebar and a flexible main content region.

**Sidebar width:** approximately 240--260px.\
**Topbar height:** approximately 64px.\
**Main content:** flexible width with 24--32px page padding.

#### Sidebar structure

**Brand area** - STRIM mark and wordmark. - Optional small Labs label. -
Workspace/organization switcher.

**Workspace** - Overview - Projects - Targets

**Testing** - Load Runner - Test History - Capacity Analysis - Compare

**Observability** - Metrics - Endpoints - Discovery

**Manage** - Integrations - API Keys (only if available) -
Organization - Settings

**Sidebar footer** - Documentation/help link. - User avatar and account
menu. - Collapse control if supported.

Use Lucide line icons with consistent sizing. The active route should
have a restrained blue-tinted background, blue icon, and clear text
contrast.

#### Topbar

The topbar should contain:

-   Breadcrumb or current page context.
-   Current project selector.
-   Current environment/target context where relevant.
-   Live execution indicator only when backed by real run state.
-   Notifications only if supported.
-   User profile menu.

Keep the topbar compact. Avoid duplicating the entire sidebar
navigation.

#### Main content

Every page should follow a consistent hierarchy:

1.  Breadcrumb (where useful).
2.  Page title.
3.  Short description, if needed.
4.  Primary action aligned to the title area.
5.  Filters or context selectors.
6.  Main content sections.

### 5.2 Mobile layout

-   Replace the desktop sidebar with an accessible navigation drawer.
-   Keep workspace/project context visible in the compact header.
-   Stack KPI cards and charts vertically.
-   Make tables horizontally scrollable with important identifiers kept
    visible where feasible.
-   Keep critical load-test controls, especially Abort/Stop, accessible.
-   Ensure dialogs and forms fit narrow screens.
-   Avoid hover-only functionality.

### 5.3 Global shell behavior

-   Preserve the selected workspace and project during navigation.
-   Display loading skeletons locally instead of blocking the entire
    application.
-   Show a clear live-stream connection state.
-   Preserve last-known data when a stream disconnects, but label it
    stale.
-   Warn before leaving an active runner if doing so could lose unsaved
    configuration or context.
-   Use toasts for transient success/failure feedback and inline
    messages for form errors.
-   Respect role-based permissions in the UI while relying on the
    backend for enforcement.

------------------------------------------------------------------------

## 6. Core application screens

### 6.1 Overview dashboard --- `/app`

**Goal:** Answer: "What is happening with my API performance?"

#### Header

-   Greeting or concise page title.
-   Current project and environment context.
-   Primary actions: `Run a test`, `Add target`, `Compare runs`.

#### KPI row

Display only metrics returned by the backend and only when meaningful
data exists.

Suggested metrics:

-   Requests per second.
-   Total requests.
-   P95 latency.
-   Error rate.
-   Active tests, if supported.

Each KPI should contain: - Metric label. - Prominent value. - Unit. -
Optional comparison/delta only when a valid comparison exists. - Small
trend visualization only when sufficient time-series data exists.

Do not display `0` as a measured capacity when no test has been run. Use
an explicit empty state or `—`.

#### Main dashboard sections

1.  Performance trend chart.
2.  Latest test summary.
3.  Recent test runs.
4.  Capacity summary from valid analysis.
5.  Recent errors or degraded endpoints.
6.  Getting-started checklist for new workspaces.

#### Empty state

When no project, target, telemetry, or test data exists: - Explain what
is missing. - Provide one clear next action. - Offer relevant setup
actions. - Do not render fake KPI values or fabricated charts.

### 6.2 Load Runner --- `/app/runner`

**Goal:** Make a safe, understandable load test easy to configure and
launch.

#### Configuration layout

Use a two-column desktop layout when space allows:

-   Main column: target, endpoint, request configuration, profile,
    advanced settings.
-   Side column: selected preset summary, safety information, and launch
    action.

#### Configuration sections

1.  **Target selection**

    -   Select an existing verified target.
    -   Show base URL and environment.
    -   Show verification status.
    -   Prevent test launch when target verification is required but
        missing.

2.  **Endpoint selection**

    -   Select one or multiple endpoints if supported.
    -   Show method and path.
    -   Provide a clear endpoint preview.

3.  **Execution preset**

    -   Smoke Probe.
    -   Capacity Ramp.
    -   Spike Surge.
    -   Breaking Point Hunt.

    Preset values are defaults, not guarantees of safety. Always display
    the actual selected configuration and enforce server-side limits.

4.  **Load configuration**

    -   Virtual users.
    -   Duration.
    -   Arrival rate, where supported.
    -   Ramp-up and step configuration, where supported.
    -   Load model: open or closed, if supported.
    -   Execution profile.

5.  **Advanced request configuration**

    -   Method, headers, body, timeout, pacing, and authentication only
        where supported by the backend.
    -   Clearly identify sensitive values.
    -   Never expose saved secrets after submission.

6.  **Authorization and safety**

    -   Explicit target authorization acknowledgement.
    -   Display applicable limits.
    -   Explain that the test sends real requests to the selected
        target.
    -   Require explicit user action to launch.

#### Launch area

-   Show a concise configuration summary.
-   Use Electric Blue for the primary `Start test` action.
-   Disable launch when required fields or permissions are missing.
-   Display backend validation errors in context.

### 6.3 Live Test Cockpit

The live cockpit may be a state within the runner or a dedicated test
detail route, depending on the existing route structure.

#### Header

-   Run name or ID.
-   Target and environment.
-   Profile.
-   Current status: Preparing, Queued, Running, Reconnecting,
    Cancelling, Completed, Failed, or Stopped --- only statuses
    supported by the backend.
-   Elapsed time and duration.

#### Live metrics

-   Active virtual users.
-   Current throughput.
-   Request count.
-   P50/P95/P99 latency where available.
-   Error rate.
-   Status-code groups.
-   Timeouts/network failures where available.

#### Charts

-   Throughput over time.
-   Latency percentiles over time.
-   Active VUs/profile progression.
-   Errors over time.

Charts must update from actual SSE events. Do not invent intermediate
points when updates are delayed or missing.

#### Stream state

Show: - Connected. - Reconnecting. - Disconnected/stale. - Last
successful update timestamp.

Reconnect safely and avoid duplicating events or resetting the chart
unnecessarily.

#### Stop/abort action

-   Keep the stop action visually prominent.
-   Require confirmation if appropriate to the operation.
-   Give immediate local feedback that cancellation was requested.
-   Confirm stopped state only after the backend reports it.

#### Completion

Show: - Summary metrics. - Link to detailed results. - Compare with
baseline. - Rerun with the same configuration, if supported.

### 6.4 Test History --- `/app/tests`

Use a clean, data-dense table.

Suggested columns:

-   Run name/ID.
-   Target.
-   Profile.
-   Started.
-   Duration.
-   Peak or measured throughput.
-   P95 latency.
-   Error rate.
-   Status.

Features: - Search by run ID or target. - Filters for project, target,
status, profile, and date where supported. - Sort by available fields. -
Pagination or cursor-based loading. - Clear status labels.

Missing measurements should display `—`, not `0`.

### 6.5 Test Detail and Results --- `/app/tests/[id]`

#### Header

-   Run ID/name.
-   Status.
-   Start time and duration.
-   Target, project, environment, and profile.
-   Actions: Compare, Rerun, Copy ID, and export only if supported.

#### Result sections

1.  Summary KPIs.
2.  Throughput chart.
3.  Latency percentiles.
4.  Status-code distribution.
5.  Error and timeout timeline.
6.  Active virtual users/profile chart.
7.  Per-endpoint breakdown, where available.
8.  Capacity analysis.
9.  Diagnosis and next steps.

#### Capacity analysis presentation

Distinguish: - Safe operating region. - Degradation/saturation knee. -
Critical failure point.

Show these only when the analysis supports them.

Always explain: - Sustainable RPS estimate. - Observed breaking-point
RPS, if found. - Triggering signal/reason. - Confidence or data-quality
indicator, if supplied. - Analysis method and configured thresholds, if
available.

If the run does not provide enough evidence, say so. Examples: -
"Insufficient evidence to determine a breaking point." - "No breaking
point observed within this test."

Do not imply that a clean test proves unlimited capacity.

#### Diagnosis card

Use three clearly separated areas:

-   **Observed:** measured facts.
-   **Likely explanation:** qualified hypothesis.
-   **Next checks:** practical troubleshooting steps.

Never present an inferred root cause as confirmed unless the backend
explicitly establishes it.

### 6.6 Capacity Analysis --- `/app/capacity`

Provide a focused view of capacity results.

-   Latest valid capacity analysis.
-   Sustainable throughput.
-   Observed breaking point, if identified.
-   Saturation chart.
-   Latency and error thresholds.
-   Methodology and data quality.
-   Historical capacity results, if available.
-   Link to the source test run.

The page should explain results in plain language rather than only
showing charts.

### 6.7 Comparison Studio --- `/app/compare`

#### Selection area

-   Select baseline run.
-   Select candidate run.
-   Support 2--5 runs only if the backend supports it.
-   Display compatibility checks.

#### Comparison metrics

-   Average and peak throughput.
-   P95/P99 latency.
-   Error rate.
-   Timeout rate.
-   Status-code distribution.

#### Result presentation

-   Absolute delta.
-   Relative percentage delta.
-   Directionality: explain whether an increase is good or bad for each
    metric.
-   PASS / FAIL / INCONCLUSIVE only according to actual backend verdicts
    or defined frontend logic that matches the backend contract.
-   Clearly explain which threshold caused a verdict.

Warn when target, profile, duration, environment, or other important
parameters make runs incomparable.

### 6.8 Targets --- `/app/targets`

#### List view

-   Target name.
-   Base URL.
-   Associated project.
-   Environment.
-   Verification status.
-   Last verification.
-   Most recent run.
-   Actions.

#### Add/edit target

-   Display name.
-   Base URL.
-   Environment.
-   Project association.
-   Optional settings only if supported.
-   Authorization acknowledgement.
-   Verify connectivity action.

Explain that connectivity verification does not prove capacity.

Never expose stored secrets after saving. The backend must enforce URL
and network safety rules.

### 6.9 Projects --- `/app/projects`

-   Project cards or table.
-   Name and description.
-   Environment.
-   Target count.
-   Latest test.
-   Created date.
-   Create project action.
-   Project detail with targets, recent runs, metrics, and shortcuts.
-   Project settings and destructive-action confirmation.

### 6.10 Endpoints and Discovery

**Endpoints page** - Search and filters. - Method badge. - Path
template. - Service/tags. - Discovery source. - Active/stale/ignored
state where supported. - Last seen. - Endpoint detail drawer or page.

**Discovery page** - Import OpenAPI file or URL if supported. - Connect
CI instructions if implemented. - Manifest upload if supported. -
Discovery run history. - Clear empty state explaining how to discover
endpoints.

### 6.11 Organization, account, and settings

Keep settings structured and permission-aware.

Potential sections: - Profile. - Account/security. - Organization
details. - Members and roles. - API keys. - Preferences and theme. -
Notifications only if supported. - Usage/audit information only if
implemented.

Do not expose controls for backend capabilities that do not exist.

------------------------------------------------------------------------

## 7. Marketing website

The public site should share the palette and typography but should not
look like a screenshot of the authenticated dashboard.

### Homepage structure

1.  Header: STRIM Labs, Product, Use cases, Docs, Integrations, Sign in,
    Get started.
2.  Hero:
    -   Eyebrow: "Real API load testing".
    -   Headline: "Find your API's breaking point before production
        does."
    -   Supporting copy: "Run real HTTP load tests, see where latency
        degrades, and compare performance between builds."
    -   Primary CTA: "Get started".
    -   Secondary CTA: "Explore the product".
3.  Product preview using actual UI or clearly labelled demo data.
4.  Three-step workflow: Add target → Run load test → Understand
    capacity.
5.  Product pillars: Load testing, Capacity analysis, Regression
    comparison.
6.  Responsible testing and security.
7.  Documentation and supported integrations.
8.  FAQ.
9.  Final CTA.
10. Footer.

### Marketing visual treatment

-   Charcoal hero sections with large typography.
-   Sand as a restrained secondary accent.
-   Electric Blue CTA.
-   Product screenshots framed cleanly.
-   Light/neutral sections may be used selectively, but the overall
    identity must remain consistent.
-   No fabricated customers, metrics, testimonials, or certifications.

------------------------------------------------------------------------

## 8. Design system and reusable components

Build reusable primitives before duplicating patterns across pages.

### 8.1 Foundations

-   Color tokens.
-   Typography scale.
-   Spacing scale.
-   Radius scale.
-   Border and elevation tokens.
-   Focus styles.
-   Responsive breakpoints.
-   Chart palette.

### 8.2 Core UI components

Use the existing shadcn/ui foundation and customize it to the STRIM
theme.

-   Button.
-   Input.
-   Textarea.
-   Select/combobox.
-   Checkbox.
-   Switch.
-   Tabs.
-   Tooltip.
-   Dropdown menu.
-   Popover.
-   Dialog.
-   Alert dialog.
-   Sheet/drawer.
-   Command menu, if useful.
-   Form field and validation message.
-   Skeleton.
-   Toast/sonner, if already configured.

### 8.3 Product components

-   `AppSidebar`
-   `AppTopbar`
-   `PageHeader`
-   `Breadcrumbs`
-   `WorkspaceSwitcher`
-   `ProjectSwitcher`
-   `EnvironmentBadge`
-   `MetricCard`
-   `MetricDelta`
-   `StatusBadge`
-   `ConnectionIndicator`
-   `ChartContainer`
-   `ChartTooltip`
-   `DataTable`
-   `EmptyState`
-   `ErrorState`
-   `LoadingSkeleton`
-   `ConfirmActionDialog`
-   `RunStatusHeader`
-   `TargetSelector`
-   `EndpointSelector`
-   `TestPresetCard`
-   `TestConfigurationSummary`
-   `LiveMetricGrid`
-   `CapacitySummary`
-   `DiagnosisCard`

Prefer composition and small focused components over a single large
dashboard component.

### 8.4 Status badges

Use consistent status labels and semantic colors.

  State                 Treatment
  --------------------- --------------------------
  Healthy / completed   Green + label
  Running               Blue + label
  Degraded / warning    Amber + label
  Failed / critical     Red + label
  Pending / queued      Neutral + label
  Disconnected          Muted or warning + label

The exact status vocabulary must match backend states.

### 8.5 Charts

-   Use consistent chart margins, typography, gridlines, and tooltips.
-   Label units explicitly.
-   Use tabular numbers in tooltips.
-   Avoid unnecessary chart legends when only one series exists.
-   Keep chart colors consistent across the application.
-   Provide an accessible textual summary or data table for important
    charts.
-   Handle empty, partial, loading, and stale data.
-   Do not animate every incoming data point if it harms readability or
    performance.

------------------------------------------------------------------------

## 9. State management and API integration

### 9.1 TanStack Query

Use TanStack Query for: - User/profile queries. - Organizations and
memberships. - Projects and targets. - Endpoint registry. - Metrics
queries. - Test history and details. - Mutations such as
create/update/delete. - Cache invalidation after successful mutations.

Define stable query keys by resource and scope. Avoid duplicating server
data in Zustand.

### 9.2 Zustand

Use Zustand for client-side interface state such as: - Current
organization selection. - Current project selection. - Sidebar collapsed
state. - Theme preference, if not handled elsewhere. - Temporary UI
preferences and filters where persistence is appropriate.

Do not use Zustand as a replacement for TanStack Query.

### 9.3 Zod and forms

-   Define schemas for frontend form validation.
-   Reuse schemas where appropriate.
-   Map backend validation/error codes to understandable field-level
    messages.
-   Preserve user input after validation errors.
-   Keep frontend constraints aligned with actual backend DTOs.

### 9.4 API client

Create or retain one shared API client layer.

Responsibilities: - Base URL configuration. - Typed request/response
handling. - Authentication/session behavior consistent with the
backend. - Standard error parsing. - Request cancellation where
appropriate. - No direct scattered `fetch()` calls inside feature
components.

Inspect the actual Swagger/OpenAPI document before defining request
types.

### 9.5 SSE and live data

-   Use the existing backend event contract.
-   Authenticate the stream using the supported mechanism.
-   Handle reconnects, heartbeat, stale state, and event IDs if
    provided.
-   Avoid duplicate event processing.
-   Keep live updates isolated from unrelated page rendering.
-   Do not fabricate missing samples.
-   Stop subscriptions when the relevant view is unmounted or the run is
    no longer active.

------------------------------------------------------------------------

## 10. UX states and error handling

Every data-driven component should account for the relevant states.

  -----------------------------------------------------------------------
  State                               Expected behavior
  ----------------------------------- -----------------------------------
  Loading                             Stable skeleton with preserved
                                      layout

  Empty                               Explain what is missing and show
                                      next action

  Success                             Confirm action and show next useful
                                      step

  Validation error                    Field-level error and preserved
                                      input

  Permission denied                   Explain missing permission safely

  Not found                           Friendly message and safe
                                      navigation

  API/network error                   Actionable retry

  Rate limited                        Explain throttling and retry
                                      guidance if provided

  Stale/live disconnected             Preserve last-known data and label
                                      it stale

  Partial data                        Show available metrics and identify
                                      unavailable values

  Cancelled                           Confirm only after backend state
                                      confirms cancellation

  Inconclusive analysis               Explain insufficient evidence and
                                      what a better test needs

  Destructive action                  Explain exact impact and provide a
                                      cancel option
  -----------------------------------------------------------------------

Avoid generic "Something went wrong" messages when a useful backend
error code is available.

------------------------------------------------------------------------

## 11. Accessibility and responsive quality

-   Target WCAG 2.2 AA where practical.
-   Ensure readable text/background contrast.
-   All interactive controls must be keyboard accessible.
-   Provide visible focus states.
-   Use semantic headings and landmarks.
-   Associate labels and validation messages with form controls.
-   Do not rely on color alone for status.
-   Provide accessible names for icon-only buttons.
-   Respect reduced-motion preferences.
-   Ensure charts have accessible summaries.
-   Support mobile layouts without hiding critical actions.

------------------------------------------------------------------------

## 12. Performance requirements

-   Prefer server components for static/read-only page structure where
    appropriate.
-   Use client components only for interactivity, local state, charts,
    and live streams.
-   Avoid rerendering the whole page for every SSE update.
-   Lazy-load heavy chart modules when appropriate.
-   Keep skeleton dimensions stable to avoid layout shift.
-   Use route-level loading and error boundaries.
-   Avoid unnecessary dependencies and oversized client bundles.
-   Use pagination/cursor loading for large tables.
-   Cache server data intentionally and invalidate after mutations.
-   Validate real production performance before making performance
    claims.

------------------------------------------------------------------------

## 13. Implementation roadmap

Build in small, demonstrable increments. The backend is already
implemented, so the frontend roadmap focuses on integration and UI
delivery.

### Phase 0 --- Repository and API audit

-   Inspect current frontend routes and folder structure.
-   Inspect installed dependencies and existing shadcn/ui components.
-   Inspect Tailwind configuration and global styles.
-   Inspect authentication/session behavior.
-   Inspect Swagger/OpenAPI and backend response contracts.
-   Identify implemented endpoints and capabilities.
-   Create a route-to-API integration matrix.
-   Preserve existing working setup.

**Exit criteria:** the frontend structure, API contracts, and current
project conventions are understood.

### Phase 1 --- Design foundation and app shell

-   Add STRIM color and semantic tokens.
-   Define typography, spacing, radius, and focus styles.
-   Theme existing shadcn/ui components.
-   Build sidebar and topbar.
-   Add workspace/project context controls.
-   Add responsive shell and navigation.
-   Add page header, cards, badges, skeletons, and empty states.

**Exit criteria:** the authenticated shell is responsive and reusable.

### Phase 2 --- Overview dashboard

-   Connect real organization/project data.
-   Implement KPI cards using actual API responses.
-   Add recent tests and latest run summary.
-   Add performance charts where data exists.
-   Build first-time empty states.
-   Add primary navigation actions.

**Exit criteria:** overview works against the real backend without
fabricated data.

### Phase 3 --- Targets, projects, and onboarding

-   Project listing and creation.
-   Target listing and creation.
-   Target verification flow.
-   Project and target detail pages.
-   First-run setup guidance.
-   Permission-aware controls.

**Exit criteria:** a user can complete the supported setup journey in
the UI.

### Phase 4 --- Load Runner

-   Target and endpoint selection.
-   Preset cards.
-   Configuration forms.
-   Advanced settings where supported.
-   Authorization acknowledgement.
-   Backend validation.
-   Launch and cancellation flow.

**Exit criteria:** a user can configure and start a real test using the
backend.

### Phase 5 --- Live cockpit and test history

-   SSE connection and reconnect behavior.
-   Live metric cards and charts.
-   Status/connection indicators.
-   Abort/cancel behavior.
-   Test history filters and pagination.
-   Test detail and result pages.

**Exit criteria:** real runs can be observed and inspected without
refreshing the page.

### Phase 6 --- Capacity and comparison

-   Capacity result presentation.
-   Sustainable throughput and breaking-point visualization.
-   Analysis methodology and confidence.
-   Baseline/candidate selection.
-   Compatibility warnings.
-   Metric deltas and verdict explanation.

**Exit criteria:** users can understand a capacity result and compare
supported runs.

### Phase 7 --- Remaining product areas

Implement according to actual backend support: - Endpoint registry and
discovery. - Metrics and observability. - Integrations. - API keys. -
Organization and member management. - Account settings.

**Exit criteria:** every exposed route has a working, tested capability
or is clearly marked as planned.

### Phase 8 --- Marketing, polish, and release QA

-   Public homepage and product pages.
-   Documentation entry points.
-   Responsive review.
-   Accessibility review.
-   Error and empty-state review.
-   Production build and TypeScript checks.
-   Vercel preview validation.
-   Production environment validation.

**Exit criteria:** the frontend is consistent, responsive, integrated,
and ready for production release.

------------------------------------------------------------------------

## 14. Quality gates

Before considering a screen complete:

-   [ ] Uses shared design tokens and components.
-   [ ] Matches the charcoal / sand / electric-blue identity.
-   [ ] Works at desktop, tablet, and mobile widths.
-   [ ] Uses real backend data.
-   [ ] Does not fabricate metrics or status.
-   [ ] Has loading, empty, error, and permission states where relevant.
-   [ ] Handles backend validation errors.
-   [ ] Uses TanStack Query for server state.
-   [ ] Uses Zustand only for appropriate client UI state.
-   [ ] Uses Zod/form validation where appropriate.
-   [ ] Has accessible labels, focus states, and keyboard interactions.
-   [ ] Does not leak secrets or sensitive values.
-   [ ] Passes TypeScript and lint checks.
-   [ ] Has component/integration/E2E coverage appropriate to the
    feature.
-   [ ] Works in a Vercel preview deployment.

### Critical end-to-end flows

1.  Sign up/sign in and load the authenticated application.
2.  Create or select an organization and project.
3.  Add and verify a target.
4.  Configure and start a load test.
5.  Observe live updates.
6.  Stop or complete a test.
7.  Open test results.
8.  View capacity analysis where available.
9.  Compare supported test runs.

------------------------------------------------------------------------

## 15. Final design decisions

  -----------------------------------------------------------------------
  Area                                Decision
  ----------------------------------- -----------------------------------
  Brand direction                     Premium, minimal, developer-first

  Core palette                        Charcoal `#1E1E1C`, Sand `#D8CBB3`,
                                      Electric Blue `#2F6BFF`

  Application theme                   Dark-first

  Marketing theme                     Dark-led, with restrained
                                      neutral/sand sections

  Typography                          Geist/Inter + Geist Mono

  UI foundation                       Existing shadcn/ui installation

  Styling                             Existing Tailwind CSS setup

  Framework                           Existing Next.js App Router project

  Language                            TypeScript

  Server state                        TanStack Query

  Client UI state                     Zustand

  Validation                          Zod + existing form setup

  Charts                              ECharts or uPlot, subject to
                                      existing dependencies

  Live updates                        Existing backend SSE contract

  Deployment                          Vercel
  -----------------------------------------------------------------------

## 16. The first implementation target

The first deliverable should be the **STRIM authenticated application
shell and Overview dashboard**.

Complete these before moving to the runner:

1.  Color tokens and global theme.
2.  Sidebar and topbar.
3.  Workspace and project selectors.
4.  Reusable page header and metric card.
5.  Chart container and data table.
6.  Loading, empty, and error states.
7.  Responsive behavior.
8.  Real overview API integration.

Once this foundation is approved, the Load Runner and Live Test Cockpit
can be built using the same design system.

------------------------------------------------------------------------

**Guiding rule:** STRIM should look as precise as the engineering
decisions it helps people make. Every visual element must improve
clarity, trust, or usability.
