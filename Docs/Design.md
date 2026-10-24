# STRIM Labs --- Product Design & Frontend Architecture Specification

**Document:** `design.md`\
**Status:** Product/design specification for implementation planning\
**Product:** STRIM --- Real API Load & Breaking Point Engine\
**Brand:** STRIM Labs\
**Primary goal:** Define the complete public website, authenticated SaaS
console, onboarding, organization/workspace experience, account profile,
security, legal pages, and component architecture before implementation.

------------------------------------------------------------------------

## 1. Product vision

STRIM helps developers and engineering teams understand how an HTTP API
behaves under load: where latency begins to degrade, how throughput
changes, what failure symptoms appear, and whether a new build regresses
against a baseline.

The experience should make a technically serious task feel approachable
without hiding meaningful controls. The first-time user should be able
to understand the product, create a workspace, add an authorized API
target, run a safe initial test, interpret the result, and repeat or
compare a run without consulting a long manual.

### Product promise

> **Find your API's breaking point before production does.**

Supporting message: **Real requests. Measurable capacity. Clear
performance decisions.**

### Product principles

1.  **Simple by default, powerful when needed.** Offer sensible presets
    and reveal advanced controls progressively.
2.  **Evidence over theatre.** Never present simulated values,
    illustrative thresholds, or placeholder results as real
    measurements.
3.  **Show the next action.** Every empty, success, and failure state
    should explain what happened and what to do next.
4.  **Trust is a feature.** Be explicit about target authorization,
    traffic volume, data retention, secrets, and test limitations.
5.  **One connected experience.** Marketing, docs, onboarding, and the
    console share one design system.
6.  **Accessible and responsive.** Color is never the only signal;
    keyboard and reduced-motion support are required.
7.  **Operational honesty.** Distinguish an observed symptom from a
    confirmed root cause.
8.  **Safe testing.** Apply guardrails against accidental or
    unauthorized high-volume traffic.

### Intended audiences

-   **Individual developer:** wants to test an endpoint quickly with
    minimal setup.
-   **Backend/platform engineer:** needs repeatable capacity tests and
    actionable diagnostics.
-   **Engineering lead:** wants to understand performance risk and
    compare releases.
-   **CI/CD owner:** wants performance checks in pull requests and
    deployment pipelines.
-   **Organization administrator:** manages members, projects, access,
    usage, and billing if enabled.

------------------------------------------------------------------------

## 2. Brand and visual direction

### Direction

Minimal, polished, developer-first SaaS inspired by the clarity and
confidence of HackerRank and the restrained product presentation of
modern developer tools such as Wispr Flow. Inspiration is a reference
for visual discipline, not a template to copy.

**Desired feeling:** calm, precise, modern, trustworthy, fast, and
quietly distinctive.

Avoid an overproduced cyberpunk look, excessive gradients, glassmorphism
everywhere, constant animation, decorative dashboard noise, or green
text on every surface. The product is a serious engineering instrument;
its visual language should make complex data feel legible.

### Core color tokens

Use semantic CSS variables rather than hard-coded color values
throughout components. Final values should be validated for WCAG
contrast.

  -----------------------------------------------------------------------
  Token                   Suggested value         Use
  ----------------------- ----------------------- -----------------------
  `--background`          `#F7F9F8`               Main light
                                                  marketing/app canvas

  `--foreground`          `#101713`               Main text

  `--surface`             `#FFFFFF`               Cards, popovers,
                                                  dialogs

  `--surface-muted`       `#F0F4F1`               Quiet panels and table
                                                  headers

  `--border`              `#DDE5DF`               Dividers, inputs, card
                                                  outlines

  `--brand`               `#00C968`               Primary accent; tune to
                                                  contrast requirements

  `--brand-strong`        `#008F4A`               Accessible text/button
                                                  hover accent

  `--brand-subtle`        `#E3F8EC`               Selected states, subtle
                                                  highlights

  `--ink`                 `#0D141E`               Dark hero, footer, dark
                                                  product previews

  `--ink-raised`          `#151F2B`               Dark surfaces

  `--text-muted`          `#647169`               Secondary text

  `--success`             `#16834A`               Successful states

  `--warning`             `#A96500`               Warning/saturation
                                                  states

  `--danger`              `#C9363E`               Errors/critical failure

  `--info`                `#2563A6`               Informational states
  -----------------------------------------------------------------------

Green is the brand accent, not a universal success color. Status colors
are semantic and must also include text/icon labels. Offer a dark theme
for the authenticated console if feasible; light theme should be the
default marketing surface unless product testing suggests otherwise.

### Typography

-   Use a modern, highly legible sans-serif such as Geist, Inter, or the
    project's existing equivalent.
-   Use a monospace face for endpoint URLs, code, IDs, response headers,
    and raw metric values.
-   Headlines: concise, medium-to-bold weight, controlled line length.
-   Body: comfortable line height; avoid low-contrast tiny text.
-   Numeric metrics: tabular numerals to avoid shifting values in live
    dashboards.
-   Avoid ultra-condensed display fonts except as a limited marketing
    accent.

### Layout and spacing

-   Use a consistent 4px-based spacing scale: 4, 8, 12, 16, 20, 24, 32,
    40, 48, 64, 80, 96.
-   Marketing content max width: approximately 1160--1240px.
-   App content max width: flexible; dashboards can use wide layouts
    while forms and reading pages stay narrower.
-   Use a 12-column desktop grid and a 4-column mobile grid.
-   Cards should use subtle borders, modest radius, and restrained
    shadows. Prefer borders over floating layers.
-   Keep text and actions aligned to a consistent page grid.
-   Dense data tables may scroll horizontally on small screens, but core
    actions must remain accessible.

### Shape, iconography, and motion

-   Use one consistent icon set, preferably Lucide, with a standard
    16/18/20/24px size system.
-   Use line icons, not mixed emoji/icon styles, in the production UI.
-   Motion should explain state changes: chart transitions, progress,
    menu opening, and feedback.
-   Respect `prefers-reduced-motion`; never rely on animation to
    communicate meaning.
-   Keep transitions generally in the 120--220ms range. Avoid parallax
    or scroll hijacking.
-   Use green glow only as a rare accent in the marketing hero or active
    live-test state.

### Theme strategy

-   Marketing: predominantly light, with a dark hero/product-demo
    section and dark footer if it creates a coherent visual rhythm.
-   Authenticated console: light/dark theme support if implementation
    scope permits; remember the user's preference.
-   Docs and legal pages: high-readability surface, constrained line
    length, stable navigation.
-   Theme preference should persist in user settings and default to
    system preference on first visit.

------------------------------------------------------------------------

## 3. Global information architecture

### Public site routes

-   `/` --- Home
-   `/product` --- Product overview
-   `/product/load-testing` --- Load testing and execution profiles
-   `/product/capacity-analysis` --- Capacity, saturation knee, breaking
    point
-   `/product/regression-comparison` --- Baseline comparison and
    regression gates
-   `/how-it-works` --- End-to-end workflow and engine explanation
-   `/use-cases` --- Use-case index
-   `/use-cases/api-performance` --- API performance validation
-   `/use-cases/release-regression` --- Release and pull-request
    regression
-   `/use-cases/capacity-planning` --- Capacity planning
-   `/integrations` --- Integration index
-   `/integrations/github-actions` --- GitHub Actions setup
-   `/docs` --- Documentation home
-   `/docs/quickstart`
-   `/docs/targets-and-projects`
-   `/docs/load-profiles`
-   `/docs/metrics-and-percentiles`
-   `/docs/capacity-analysis`
-   `/docs/compare-runs`
-   `/docs/api-reference`
-   `/docs/ci-cd`
-   `/docs/security`
-   `/docs/faq`
-   `/pricing` --- Pricing only when commercial model is decided;
    otherwise use a transparent "Plans coming soon" or contact page
-   `/about` --- STRIM Labs and product mission
-   `/contact` --- Contact/support route
-   `/status` --- Service status page or external status provider
-   `/changelog` --- Release history
-   `/security` --- Security overview and responsible disclosure
-   `/privacy` --- Privacy policy
-   `/terms` --- Terms of service
-   `/acceptable-use` --- Acceptable use policy
-   `/cookies` --- Cookie policy, if applicable
-   `/subprocessors` --- Subprocessor disclosure, if applicable
-   `/dpa` --- Data processing agreement, if offered
-   `/licenses` --- Third-party notices and open-source licenses
-   `/auth/sign-in`
-   `/auth/sign-up`
-   `/auth/forgot-password`
-   `/auth/reset-password`
-   `/auth/verify-email`
-   `/auth/callback` --- OAuth callback handling
-   `/invite/[token]` --- Organization invitation acceptance
-   `/legal` --- Legal index if needed

### Authenticated application routes

Use an authenticated route group such as `/(app)` and a consistent app
shell.

-   `/app` --- Overview/dashboard
-   `/app/runner` --- Load runner cockpit
-   `/app/tests` --- Test history
-   `/app/tests/new` --- Test setup, if a dedicated route is useful
-   `/app/tests/[id]` --- Test detail and diagnosis
-   `/app/compare` --- Regression comparison studio
-   `/app/targets` --- Target API management
-   `/app/targets/[id]` --- Target details, verification, and settings
-   `/app/projects` --- Project list
-   `/app/projects/new` --- Create project
-   `/app/projects/[id]` --- Project overview
-   `/app/projects/[id]/settings` --- Project settings
-   `/app/integrations` --- Integrations index
-   `/app/integrations/github-actions` --- GitHub Actions setup
-   `/app/api-keys` --- Personal or project API keys, according to
    permission model
-   `/app/notifications` --- Notification preferences and relevant
    alerts, only if supported
-   `/app/organization` --- Organization overview
-   `/app/organization/members` --- Member management
-   `/app/organization/invitations` --- Pending invitations
-   `/app/organization/roles` --- Roles and permissions if role
    customization exists
-   `/app/organization/usage` --- Usage and limits
-   `/app/organization/billing` --- Billing, if billing is implemented
-   `/app/organization/settings` --- Organization name, slug, and
    defaults
-   `/app/organization/audit-log` --- Audit events, if implemented
-   `/app/settings/profile` --- Personal profile
-   `/app/settings/account` --- Account settings
-   `/app/settings/security` --- Password, OAuth connections, sessions,
    MFA if supported
-   `/app/settings/preferences` --- Theme, timezone, units, default
    project
-   `/app/settings/notifications` --- Email/product notification
    settings
-   `/app/settings/data-and-privacy` --- Export/delete account and
    privacy controls
-   `/app/help` --- In-product help and support links

Route availability must reflect actual capabilities. Hide or mark future
modules clearly; never route users to empty placeholder pages disguised
as complete features.

------------------------------------------------------------------------

## 4. Marketing website --- page-by-page specification

### 4.1 Home `/`

**Goal:** communicate the value in seconds and guide visitors to a first
test.

**Header** - STRIM Labs wordmark and compact icon. - Navigation:
Product, Use cases, Docs, Pricing (only if ready), Company. - Right-side
actions: Sign in and primary "Get started". - Sticky header on scroll
with a subtle border; no oversized mega-menu by default. - Mobile menu
with accessible focus handling.

**Hero** - Eyebrow: "Real API load testing". - Headline: "Find your
API's breaking point before production does." - Supporting copy: "Run
real HTTP load tests, see where latency degrades, and compare
performance between builds." - Primary CTA: "Run your first test" or
"Get started". - Secondary CTA: "Explore the engine" or "Watch the
walkthrough". - Product visual: realistic, clearly labelled
demonstration dashboard with throughput, P95 latency, active VUs, status
codes, and a visible saturation knee. - Any illustrative data must be
labelled "Example data" or "Demo run".

**Section order** 1. Hero + product preview. 2. Short trust/technology
strip; show only genuine customers, integrations, or technologies. Do
not imply endorsements or partnerships that do not exist. 3. Three-step
explanation: Add target → Run load test → Understand capacity. 4.
Interactive capacity curve: safe region, degradation knee, critical
failure. Use sample data clearly labelled as illustrative. 5. Core
product pillars: Load testing, capacity analysis, regression comparison.
6. Product cockpit preview with real interface components. 7. Workflow
integration: local development, CI/CD, historical comparison. 8.
Security and responsible testing section. 9. FAQ. 10. Final CTA. 11.
Footer with product, resources, company, and legal links.

**Home interactions** - Hero CTA routes to sign-up or authenticated app
depending on session. - Demo CTA opens a short product walkthrough or
controlled demo. - Interactive chart can reveal definitions and
explanatory labels. - No auto-started external load tests from a public
marketing page.

**Acceptance criteria** - A new visitor can explain what STRIM does
after reading the hero and first feature section. - No fabricated
customer logos, testimonials, metrics, or uptime claims. - Primary CTA
is visible without scrolling on common desktop and mobile sizes.

### 4.2 Product overview `/product`

Explain the complete workflow and how the three pillars work together.
Use a concise product diagram, real screenshots, and links to individual
product pages. Avoid repeating the homepage word-for-word.

### 4.3 Load testing `/product/load-testing`

Explain virtual users, test duration, execution profiles, request
configuration, target setup, cancellation, and result collection.
Include a comparison table of Smoke Probe, Capacity Ramp, Spike Surge,
and Breaking Point Hunt, with a note that presets are starting points,
not universal safety recommendations.

### 4.4 Capacity analysis `/product/capacity-analysis`

Explain throughput, latency percentiles, error rate, saturation knee,
and critical failure. Show how the engine identifies a degradation
region from observed samples. Explain that estimates depend on test
design, target conditions, and available samples.

### 4.5 Regression comparison `/product/regression-comparison`

Show baseline vs candidate, throughput delta, P95/P99 latency delta when
available, error-rate delta, test compatibility, and configurable
pass/fail thresholds. Explain that a gate verdict is only as reliable as
the comparability of the runs and the configured thresholds.

### 4.6 How it works `/how-it-works`

Present the execution flow: 1. User configures a target and profile. 2.
API validates permissions and safety limits. 3. Load engine sends
requests to the authorized target. 4. Engine aggregates
response/latency/status samples. 5. SSE streams live updates to the
console. 6. Run summary and samples are persisted. 7. Analysis derives
observed saturation/failure signals. 8. User compares the result with a
baseline.

Include an architecture diagram with the web console, API server, native
Bun engine, target API, SSE stream, and PostgreSQL/Prisma. Explain the
difference between observed metrics and inferred diagnoses.

### 4.7 Use-case pages

Each use-case page should have: user problem, workflow, relevant UI
preview, expected outputs, limitations, and CTA. - API performance
validation. - Release and pull-request regression. - Capacity planning.

Do not claim suitability for distributed load generation, browser
testing, full APM, or production monitoring unless those capabilities
are implemented.

### 4.8 Integrations `/integrations`

List only working integrations. Each integration card includes name,
status (Available/Beta/Planned), what it does, setup time if
substantiated, and documentation link. Planned integrations must be
clearly labelled.

### 4.9 GitHub Actions `/integrations/github-actions`

Provide a copyable workflow example, required secrets, how to select a
baseline, threshold configuration, expected check result, and
troubleshooting. Use a least-privilege token and never ask users to
commit credentials into a repository.

### 4.10 Docs `/docs` and documentation pages

Docs layout: - Left sidebar with grouped navigation. - Main article with
readable width and heading anchors. - Right-side table of contents on
wide screens. - Breadcrumbs, previous/next links, copy-code buttons, and
feedback affordance. - Search that supports keyboard navigation. -
Versioning only if multiple API/docs versions exist.

Quickstart should be the shortest path from sign-up to a first
successful test. Every code snippet must match the current API and be
tested in CI where possible.

### 4.11 Pricing `/pricing`

Do not invent pricing tiers or usage quotas. If the commercial model is
undecided, show a restrained "Pricing is being finalized" page and a
contact/waitlist CTA. When pricing is defined, each plan must disclose
run limits, concurrency limits, retention, team seats, support, and
overage behavior clearly.

### 4.12 About `/about`

Explain STRIM Labs' mission and the focused product philosophy. Keep it
factual and concise. Avoid invented founding stories, company size, or
customer claims.

### 4.13 Contact `/contact`

Offer a contact form with name, email, topic, and message; validate
input, show a clear submission state, and provide an alternate support
channel only if one exists. Add spam prevention that does not create
unnecessary friction.

### 4.14 Status `/status`, changelog `/changelog`, security `/security`

-   Status page: component health, incidents, maintenance, and
    historical uptime only if backed by real status data.
-   Changelog: dated releases with Added/Changed/Fixed/Security
    categories and links to documentation.
-   Security: data handling, encryption practices only when verified,
    responsible disclosure instructions, and security contact if
    configured.

### 4.15 Legal pages

Provide a consistent legal reading layout with effective date,
last-updated date, table of contents, and contact link: - Privacy
policy. - Terms of service. - Acceptable use policy. - Cookie policy
where relevant. - Subprocessors. - DPA if the service offers one. -
Third-party licenses.

Legal content must be reviewed by qualified counsel before launch. Do
not treat generated boilerplate as legal advice or claim certifications
the company does not hold.

------------------------------------------------------------------------

## 5. Authentication and onboarding

### 5.1 Sign-up `/auth/sign-up`

-   Minimal split layout: form on one side, concise product value and a
    small product preview on the other.
-   Fields: name, work email, password if password auth is enabled.
-   OAuth providers only when configured and tested.
-   Terms/privacy acknowledgement, error summary, field-level
    validation, password visibility toggle, and accessible labels.
-   Do not force a company name or phone number unless required.
-   Show loading, success, duplicate account, invalid input, and
    provider failure states.

### 5.2 Sign-in `/auth/sign-in`

-   Email + password or configured authentication methods.
-   OAuth buttons, "Forgot password?", "Create account".
-   Neutral error messages that do not disclose whether an email is
    registered.
-   Return users to their intended destination after successful
    authentication.

### 5.3 Password recovery and reset

-   `/auth/forgot-password`: request reset link with neutral
    confirmation.
-   `/auth/reset-password`: validate reset token, set and confirm new
    password, invalidate token after use.
-   Explain expired/invalid link recovery without exposing account
    information.

### 5.4 Email verification

-   `/auth/verify-email`: pending state, resend with cooldown, verified
    state, expired-link state.
-   Do not let unverified accounts perform high-impact operations unless
    policy explicitly permits it.

### 5.5 OAuth callback

-   `/auth/callback`: handle success, cancellation, invalid state,
    provider outage, and account-linking conflicts.
-   Validate state and redirect allowlists on the server; never trust
    arbitrary redirect URLs.

### 5.6 Invitation acceptance `/invite/[token]`

-   Show organization name and inviter only when safe to disclose.
-   Require sign-in/sign-up as appropriate.
-   Validate invitation expiry and email binding.
-   Display accepted, expired, revoked, and already-used states.
-   Do not reveal private organization details to unauthenticated users
    beyond what the invite intentionally discloses.

### 5.7 First-run onboarding

Use a short stepper with a visible skip option where possible: 1. Create
organization/workspace. 2. Create first project. 3. Add a target URL. 4.
Verify connectivity with a low-impact request. 5. Choose a preset. 6.
Review safety limits and launch the test. 7. View the results and learn
the key metrics.

Persist progress so users can resume. Do not run a high-volume test
automatically. Require an explicit launch action and target
authorization acknowledgement.

### 5.8 Session and account security

Support secure session expiry, sign-out, and server-side authorization.
Add MFA/session management only when the auth system supports it. Show
active sessions and revocation controls if the backend exposes that
data. Never imply security features are active when they are not
implemented.

------------------------------------------------------------------------

## 6. Authenticated app shell

### Desktop shell

-   Left sidebar with Overview, Load Runner, Test History, Compare,
    Targets, Integrations.
-   Workspace/organization switcher at the top of the sidebar.
-   Project selector and active target context in the top bar.
-   Quick "Add target" action available from relevant contexts.
-   Live-test status indicator only when backed by actual
    organization/project run state.
-   Help/docs link, notifications if supported, and profile avatar menu.
-   Main content with breadcrumb, page title, optional description, and
    one clear primary action.

### Mobile shell

-   Compact top bar with workspace/project context.
-   Drawer navigation with accessible focus management.
-   Critical test controls remain visible; do not bury abort/cancel
    actions.
-   Charts can stack vertically and provide accessible data summaries.
-   Tables may scroll horizontally with sticky identifiers.

### Global behavior

-   Preserve selected workspace/project across navigation.
-   Avoid destructive navigation while a test is active; warn when
    leaving a live runner if state may be lost.
-   Show a connection state for live streams.
-   Do not use a global spinner for independent page sections; use local
    skeletons.
-   Provide consistent toasts for transient actions and inline errors
    for form-specific issues.

------------------------------------------------------------------------

## 7. Authenticated pages --- detailed requirements

### 7.1 Overview `/app`

**Purpose:** answer "What is happening with my API performance?"

Sections: - Greeting and selected project/target. - Primary actions: Run
a test, Add target, Compare runs. - Latest run summary. - Recent run
history. - Capacity summary based on recent valid runs. - P95 latency
and throughput trends where sufficient samples exist. - Recent failures
and links to diagnoses. - Getting-started checklist for new workspaces.

Empty state: - Explain that no tests exist yet. - Offer "Add target" and
"Run first test". - Do not display zero as if it were a measured
capacity value.

Demo mode: - If a demo run is offered, label it clearly as demo data and
isolate it from production user data.

### 7.2 Load runner `/app/runner`

**Purpose:** configure and operate a load test with minimal friction.

Configuration area: - Target selector and endpoint preview. - Method and
request configuration only to the extent supported. - Preset cards: -
Smoke Probe: 10 VUs, 10 seconds, Sustained. - Capacity Ramp: 50 VUs, 30
seconds, Ramp-Up. - Spike Surge: 150 VUs, 15 seconds, Spike. - Breaking
Point Hunt: 300 VUs, 45 seconds, Ramp-Up. - Preset values are defaults,
not guarantees of safety; enforce server-side limits and let the user
review configuration. - Advanced settings disclosure: virtual users,
duration, profile, ramp behavior, timeout, pacing, headers, and request
body only if implemented. - Clear request-body/secret handling
warning. - Target authorization acknowledgement and rate/concurrency
warnings. - Estimated test impact only if it can be calculated reliably.

Running cockpit: - State badge: Preparing, Running, Reconnecting,
Cancelling, Completed, Failed, Cancelled. - Elapsed time and remaining
time. - Active VUs and current throughput. - Latency chart (P50/P95/P99
only where correctly calculated). - Status code groups: 2xx, 3xx, 4xx,
429, 5xx, timeouts/network failures. - Request count and error rate. -
Last update timestamp and stream health. - Prominent "Abort test" action
with immediate local feedback and confirmed server cancellation state. -
Handle SSE reconnects and gaps without fabricating intermediate samples.

Completion state: - Summary metrics and link to test detail. - Compare
with baseline. - Rerun with same settings. - Copy run link or export
only if supported.

### 7.3 Test history `/app/tests`

-   Filter by project, target, status, profile, date, and initiator if
    supported.
-   Search by test/run identifier or target.
-   Sort by start time, duration, throughput, P95, and error rate when
    data exists.
-   Table columns: run name/ID, target, profile, started, duration,
    peak/current measured throughput, P95 latency, error rate, status.
-   Show missing metrics as "---", not zero.
-   Pagination or cursor-based loading.
-   Bulk actions only if they are safe and implemented.

### 7.4 Test detail `/app/tests/[id]`

Header: - Run status, start time, duration, target, project, profile. -
Actions: Compare, Rerun, Copy run ID, export if available. -
Cancellation/failed state summary.

Metrics: - Throughput over time. - Latency percentiles over time. -
Response status distribution. - Error/timeout timeline. - Active VUs and
profile curve.

Capacity analysis: - Safe operating region, degradation knee, and
critical failure point only when evidence supports these
classifications. - Show confidence/quality indicator and explain how the
estimate was derived. - If the run is too short, has too few samples, or
does not reach degradation, say "Insufficient evidence to determine
breaking point" or "No breaking point observed within this test". - Do
not imply that a clean test proves unlimited capacity.

Diagnosis card: - **Observed:** exact status/latency/throughput facts. -
**Likely explanation:** qualified hypothesis based on signals. - **Next
checks:** practical troubleshooting steps. - **Confidence:**
High/Medium/Low only when there is a defined methodology. - Example:
"429 responses increased above the observed rate threshold. This is
consistent with rate limiting; inspect gateway and application limiter
configuration." - Do not declare database pool saturation from latency
alone without corresponding evidence.

CI/CD drawer: - Copyable GitHub Actions YAML and API/cURL example if
supported by the current API. - Explain required secrets, run creation,
polling/streaming behavior, thresholds, and exit code. - Warn users not
to commit tokens. - Snippets must be generated from current API
contracts, not hard-coded stale examples.

### 7.5 Comparison studio `/app/compare`

-   Select baseline and candidate runs.
-   Validate that target, request profile, duration, environment, and
    key parameters are comparable.
-   Display an incompatibility warning and explain differences when not
    comparable.
-   Compare throughput, P95/P99 latency, error rate, timeout rate, and
    status distributions where available.
-   Delta labels: absolute and relative change, with directionality
    explained.
-   Performance verdict: PASS, FAIL, or INCONCLUSIVE according to
    configurable thresholds and data quality.
-   Never show "PASS" merely because one metric improved if another
    critical metric breached a gate.
-   Provide an explanation of which threshold caused the verdict.
-   Allow copying a report link if permissions allow.

### 7.6 Target management `/app/targets`

List: - Target name, base URL, associated project, last verification,
most recent run, and status. - Add target button. - Search/filter and
pagination for large workspaces.

Add/edit target dialog: - Display name. - Base URL and endpoint. -
Optional method/default request settings only if supported. - Optional
authentication secret stored securely server-side; never reveal it after
saving. - Environment label such as development/staging/production. -
Allowed host/target validation and warnings. - Ownership/authorization
acknowledgement. - Verify connectivity with a low-impact request. -
Clear explanation that verification does not validate the target's
capacity.

Target detail: - Endpoint and environment. - Verification history. -
Associated runs. - Edit settings, rotate/update secrets, archive/delete
with confirmation. - Warn before deleting a target with historical
references; preserve run records where possible.

Security requirements: - Server-side URL validation and SSRF
protections. - Block loopback/private/link-local/metadata addresses
unless an explicit, tightly controlled self-hosted configuration permits
them. - Revalidate DNS/redirect destinations and enforce outbound
network policy. - Prevent secret leakage in logs, errors, URLs, client
state, and telemetry. - Apply per-organization rate and concurrency
limits.

### 7.7 Projects `/app/projects`

Project list: - Name, description, target count, latest test, created
date, and member access if supported. - Create project. - Search and
sort.

Create project: - Name and optional description. - Choose
organization. - Optional initial target. - Clear statement of what
project isolation means.

Project overview: - Latest run, targets, trend summary, recent activity,
shortcuts to runner and compare. - Do not show performance trends until
sufficient data exists.

Project settings: - Rename, description, archive/delete. - Default
target and test preferences if supported. - Access controls only if the
authorization model supports project-level permissions. - Confirm
destructive actions and explain historical-data implications.

### 7.8 Integrations `/app/integrations`

-   Integration cards with Available, Beta, or Planned status.
-   GitHub Actions as the first-class integration if implemented.
-   Setup state, docs, required permissions, and "Test connection" where
    supported.
-   No fake connected/disconnected states.
-   For unsupported integrations, link to documentation or mark Planned
    rather than exposing nonfunctional controls.

### 7.9 API keys `/app/api-keys`

-   List key name, scope, created date, last used, expiry if available,
    and creator.
-   Create key dialog: name, least-privilege scope, optional expiry.
-   Display secret only once immediately after creation.
-   Copy button and clear "store this securely" warning.
-   Revoke key with confirmation.
-   Never store raw secrets in browser storage or log them.
-   Separate personal and project/service keys if the model supports
    both.
-   Show last-used data only if recorded reliably.

### 7.10 Organization overview `/app/organization`

-   Organization name, slug, plan/usage summary if applicable, member
    count, project count.
-   Quick links to Members, Invitations, Usage, Settings, Billing, and
    Audit Log when implemented.
-   Clear indication of the user's role.
-   Actions restricted by server-side permission checks.

### 7.11 Organization members `/app/organization/members`

-   Member list: name/email, role, status, joined date.
-   Invite member action.
-   Search and filter.
-   Role changes with confirmation and clear explanation of permissions.
-   Remove member flow with impact summary.
-   Prevent removing/downgrading the last owner without transferring
    ownership.
-   Do not expose private member information beyond the workspace's
    authorized scope.

### 7.12 Invitations `/app/organization/invitations`

-   Pending invitations, invitee email, role, invited by, sent date,
    expiry.
-   Resend and revoke controls.
-   Expired/revoked/accepted states.
-   Duplicate invitation handling.
-   Invitation tokens must be random, expiring, single-use, and stored
    safely (prefer hashed token storage).

### 7.13 Organization roles `/app/organization/roles`

Only expose a role management page if custom roles exist. Otherwise
document fixed roles in Members/Settings and do not create a dead-end
page.

Suggested baseline roles: - **Owner:** full control, ownership transfer,
organization deletion, billing. - **Admin:** members, projects, targets,
settings, and usage management. - **Member:** create/run tests and
manage permitted projects. - **Viewer:** read results and comparisons.
The exact permissions must be implemented and enforced server-side
before being shown as guarantees.

### 7.14 Usage `/app/organization/usage`

-   Current usage period and measured consumption.
-   Test runs, request volume, max concurrency, retention, and other
    quota metrics only if the backend tracks them.
-   Explain quota calculations and reset dates.
-   Warn before limits are reached; show what happens at the limit.
-   Do not invent usage values.

### 7.15 Billing `/app/organization/billing`

Only enable when billing integration is implemented: - Current plan,
payment status, next invoice, payment method summary, invoices, plan
change, cancel flow. - Billing actions should link to the trusted
billing portal where applicable. - Explain proration and cancellation
effects before confirmation. - Never collect raw card details directly
unless a compliant payment provider's hosted flow is used. - If billing
is not implemented, omit the navigation item or clearly mark it
unavailable.

### 7.16 Organization settings `/app/organization/settings`

-   Organization display name and slug.
-   Default project or region only if supported.
-   Security defaults and retention only when configurable.
-   Ownership transfer.
-   Delete organization flow with reauthentication, explicit impact, and
    confirmation phrase.
-   Ensure the last-owner invariant and preserve required audit/legal
    records.

### 7.17 Audit log `/app/organization/audit-log`

If implemented, show actor, action, resource, timestamp, and outcome.
Filter by actor/action/date. Do not imply a complete audit trail unless
all relevant actions are recorded. Restrict access to authorized roles
and protect sensitive metadata.

### 7.18 Profile `/app/settings/profile`

A complete personal SaaS profile page: - Avatar or initials. - Display
name. - Email and verification state. - Optional job title only if
useful. - Organization memberships and current workspace. - Edit profile
form. - Email change flow requiring verification. - Save/cancel feedback
and unsaved-changes protection. - Account deletion entry point with
clear consequences. - Avoid asking for unnecessary demographic or
personal information.

### 7.19 Account `/app/settings/account`

-   Account creation date if available.
-   Connected authentication providers.
-   Password update if password auth is enabled.
-   Sign out of all sessions if supported.
-   Delete account.
-   Account recovery information.
-   Show safe confirmation steps for sensitive actions.

### 7.20 Security `/app/settings/security`

Only expose capabilities that exist: - Change password. - Connected
OAuth providers. - Active sessions/devices and revoke session if session
data is available. - MFA setup and recovery codes if supported. - Recent
security events if recorded. - Clear guidance for lost access. -
Sensitive changes require reauthentication where appropriate.

### 7.21 Preferences `/app/settings/preferences`

-   Theme: System, Light, Dark.
-   Timezone.
-   Default organization/project.
-   Metric display preferences and date format.
-   Reduced motion follows system preference, with an optional user
    override.
-   Save preferences and restore defaults.

### 7.22 Notifications `/app/settings/notifications`

-   Email/product notification categories only if those notifications
    exist.
-   Test completion, failures, invitations, quota warnings, and security
    notices as appropriate.
-   Essential security/account emails should not be silently disabled if
    policy requires them.
-   Show delivery state only when supported.

### 7.23 Data and privacy `/app/settings/data-and-privacy`

-   Data export request and status.
-   Account deletion request.
-   Organization ownership/dependency warning before deletion.
-   Privacy-policy link and contact route.
-   Explain retention/deletion timing truthfully.
-   Provide controls required by applicable law and the actual product
    data model.

### 7.24 Help `/app/help`

-   Search documentation.
-   Quick links to quickstart, troubleshooting, API reference, security,
    and status.
-   Contact support if configured.
-   Include run ID and safe diagnostic context in a support bundle only
    with user consent; redact credentials and sensitive payloads.

------------------------------------------------------------------------

## 8. Component-level frontend architecture

The codebase is expected to use a Next.js App Router frontend with
TypeScript and Tailwind CSS, potentially using shadcn/ui and Radix
primitives. Adapt names to the existing repository rather than creating
a parallel component system.

### Suggested structure

``` text
apps/web/src/
  app/
    (marketing)/
      page.tsx
      product/
      use-cases/
      integrations/
      docs/
      pricing/
      about/
      contact/
      status/
      changelog/
      security/
      privacy/
      terms/
      acceptable-use/
      cookies/
      dpa/
      sub processors/
    (auth)/
      auth/
        sign-in/
        sign-up/
        forgot-password/
        reset-password/
        verify-email/
        callback/
      invite/[token]/
    (app)/
      app/
        layout.tsx
        page.tsx
        runner/
        tests/
        compare/
        targets/
        projects/
        integrations/
        api-keys/
        organization/
        settings/
        help/
    api/                  # only if Next.js route handlers are actually needed
  components/
    ui/                   # primitive design-system components
    marketing/
    navigation/
    app-shell/
    dashboard/
    runner/
    charts/
    tests/
    compare/
    targets/
    projects/
    organization/
    profile/
    auth/
    legal/
    docs/
    feedback/
  features/
    auth/
    organizations/
    projects/
    targets/
    load-tests/
    analysis/
    comparisons/
    api-keys/
    integrations/
    profile/
  hooks/
  lib/
    api/
    auth/
    permissions/
    validation/
    formatting/
    metrics/
    sse/
    errors/
    security/
  config/
  styles/
  types/
```

Correct the directory naming and nesting to match the existing app
router conventions. This tree is a proposed architecture, not a claim
about current files.

### Component layers

**Layer 1 --- Primitives** - Button, IconButton, Input, Textarea,
Select, Checkbox, RadioGroup, Switch. - Dialog, Drawer, Popover,
DropdownMenu, Tooltip. - Tabs, Accordion, Separator, Badge, Avatar. -
Skeleton, Spinner, Progress, Toast, Alert, EmptyState. - Table,
Pagination, Breadcrumbs. - FormField, FormError, FormDescription. - All
primitives need focus states, keyboard behavior, disabled/loading
states, and accessible names.

**Layer 2 --- Shared product components** - `AppShell`,
`MarketingHeader`, `MarketingFooter`. - `SidebarNavigation`,
`MobileNavigation`, `WorkspaceSwitcher`, `ProjectSwitcher`. -
`PageHeader`, `SectionHeader`, `ContentContainer`. - `StatusBadge`,
`MetricCard`, `MetricDelta`, `TimeRangePicker`. - `DataTable`,
`FilterBar`, `SearchInput`. - `ConfirmDialog`, `CopyButton`,
`CodeSnippet`. - `ErrorState`, `EmptyState`, `LoadingSkeleton`. -
`PermissionGate` for presentation only; server authorization remains
authoritative.

**Layer 3 --- Domain components** - `TargetSelector`, `AddTargetDialog`,
`TargetForm`, `TargetVerificationStatus`. - `LoadPresetCard`,
`LoadProfileSelector`, `AdvancedTestSettings`. -
`TestConfigurationSummary`, `LiveTestHeader`, `LiveMetricGrid`. -
`ThroughputChart`, `LatencyPercentileChart`, `StatusCodeBreakdown`,
`VirtualUsersChart`. - `TestProgress`, `AbortTestButton`,
`TestResultSummary`. - `CapacityGauge`, `SaturationKneeMarker`,
`DiagnosisCard`, `EvidenceList`. - `RunSelector`,
`RunCompatibilityWarning`, `MetricDeltaRow`, `RegressionVerdict`. -
`OrganizationMemberTable`, `InviteMemberDialog`, `RoleSelector`. -
`ApiKeyTable`, `CreateApiKeyDialog`, `SecretRevealOnce`. -
`ProfileForm`, `SessionList`, `PrivacyRequestPanel`.

**Layer 4 --- Page composition** Pages should compose feature components
and remain relatively thin. Keep domain logic in feature modules/hooks
or server actions/API clients, not in giant page components.

### Component rules

-   Components should have explicit TypeScript prop types.
-   Avoid `any`; validate untrusted API responses at boundaries.
-   Avoid duplicated formatters and status mappings.
-   Keep API calls out of low-level visual primitives.
-   Keep chart data transformation in tested utility functions.
-   Use stable IDs and keys for lists.
-   Do not put secrets in client component props, query strings, or
    logs.
-   Use server components for static/data-driven content where
    appropriate; use client components for interactions, charts, SSE,
    and browser-only state.
-   Avoid global client state until cross-page state genuinely requires
    it. Use URL state for shareable filters and local state for local
    interactions.
-   Document the source of truth for current organization/project
    selection.

------------------------------------------------------------------------

## 9. Data and API integration contract

The UI must be built around real backend contracts. Before
implementation, inspect the current server routes, schemas, and shared
types. Do not invent endpoints based on component names.

### Core entities expected from the product concept

-   User
-   Organization
-   Membership
-   Project
-   ApiKey
-   TestRun
-   TestSample

Additional data may be needed for targets, invitations, auth sessions,
billing, or audit events. Reconcile this with the actual schema rather
than assuming all entities exist.

### Loading and mutation patterns

-   Every data screen needs loading, success, empty, error, and
    stale-data states.
-   Mutations should disable duplicate submission and show a clear
    pending state.
-   Use optimistic UI only where rollback is safe and the result is
    predictable.
-   Destructive operations should wait for server confirmation.
-   Normalize API errors into stable user-facing messages without
    leaking stack traces or secrets.
-   Handle `401`, `403`, `404`, `409`, `422`, `429`, and `5xx`
    explicitly.
-   Use request IDs/correlation IDs for support diagnostics if supplied
    by the server.

### SSE/live metrics

-   Use the server-provided stream contract and event schema.
-   Model connection state: Connecting, Live, Reconnecting,
    Disconnected, Completed.
-   Retry with bounded backoff and clean up subscriptions on unmount.
-   Avoid duplicate samples when reconnecting; use event IDs/sequence
    numbers if available.
-   Show "Last updated" and a stale-data warning if the stream is
    delayed.
-   Do not interpolate missing values as real observations.
-   Ensure cancellation invokes the actual server cancellation mechanism
    and reflects the authoritative status.
-   Keep a safe fallback if SSE is unavailable, such as a documented
    polling strategy only if supported.

### Metrics definitions

Define a single tested source for: - Requests per second (RPS). -
Latency percentiles and sample window. - Error rate denominator. -
Timeout and network-error treatment. - Throughput peak/average
semantics. - Saturation knee and breaking-point detection. - Comparison
delta calculation and directionality.

Do not mix average latency with percentiles or compare incompatible
sample windows. Explain metric definitions in tooltips/docs.

------------------------------------------------------------------------

## 10. Forms, validation, and safety

-   Use a consistent validation library already adopted by the project;
    Zod is a reasonable choice if not already standardized.
-   Validate on the server even when client validation exists.
-   Normalize URL inputs and reject invalid schemes.
-   Avoid destructive defaults; require explicit confirmation for
    deletion, key revocation, ownership transfer, and high-impact tests.
-   Never expose stored authentication headers or secrets after
    creation.
-   Redact credentials, authorization headers, cookies, and sensitive
    request bodies from logs and telemetry.
-   Use rate limits and abuse protection on auth and public forms.
-   Add clear warnings before load tests that may affect real systems.
-   Respect organization/project permissions on every read and write
    operation.
-   Protect against SSRF, redirect-based bypass, DNS rebinding, and
    access to cloud metadata endpoints in the load engine.
-   Apply limits to concurrent tests, request rates, duration, payload
    size, and outbound destinations.
-   Consider a test "safety summary" before launch: target, profile,
    VUs, duration, and configured maximums.

------------------------------------------------------------------------

## 11. Accessibility and responsive requirements

Target WCAG 2.2 AA where practical and validate with automated and
manual testing.

-   All controls work by keyboard.
-   Visible focus ring with sufficient contrast.
-   Correct headings and landmark structure.
-   Inputs have labels and useful error associations.
-   Dialogs trap focus appropriately and restore focus on close.
-   Live test updates are announced thoughtfully; do not flood screen
    readers every 500ms.
-   Charts have accessible titles, summaries, and a tabular/data
    alternative.
-   Status is represented with icon/text in addition to color.
-   Contrast checked for brand buttons, muted text, badges, chart
    labels, and dark mode.
-   Respect reduced motion.
-   Touch targets should be comfortable on mobile.
-   Test at narrow mobile widths, tablet, desktop, and wide desktop.
-   Do not rely on hover-only controls.

------------------------------------------------------------------------

## 12. SEO, performance, and implementation quality

### SEO

-   Unique title and description per public page.
-   Open Graph/Twitter metadata and favicon assets.
-   Canonical URLs where relevant.
-   Sitemap and robots policy.
-   Structured data only where accurate.
-   Authenticated routes and private user data must not be indexed.
-   Legal pages should have effective dates and version history.

### Performance

-   Optimize images and avoid shipping large animation libraries to all
    routes.
-   Lazy-load noncritical charts and below-the-fold demos.
-   Keep marketing pages mostly server-rendered/static where possible.
-   Avoid layout shift in hero and product preview.
-   Use code splitting by route and feature.
-   Keep live charts efficient; avoid rerendering the whole page for
    each metric tick.
-   Add loading skeletons with stable dimensions.
-   Measure Core Web Vitals in production before claiming performance.

### Quality gates

-   TypeScript strict checks.
-   Lint and formatting.
-   Unit tests for metric calculations, validators, permissions, and
    state transitions.
-   Component tests for critical form and dialog behavior.
-   Integration tests for sign-up, target creation, starting/cancelling
    a run, viewing results, and comparing runs.
-   E2E tests for core onboarding and organization membership.
-   Accessibility checks on key pages.
-   Production build and deployment smoke tests.
-   Do not remove existing packages or schema models until dependency
    references and migration impacts are audited.

------------------------------------------------------------------------

## 13. Product state matrix

Every feature should define these states where applicable:

  -----------------------------------------------------------------------
  State                               Expected behavior
  ----------------------------------- -----------------------------------
  Loading                             Skeleton or local progress
                                      indicator; preserve layout

  Empty                               Explain why there is no data and
                                      show a relevant next action

  Success                             Confirm outcome and provide the
                                      next useful action

  Validation error                    Field-level message and preserved
                                      user input

  Permission denied                   Explain missing permission without
                                      leaking private resources

  Not found                           Friendly not-found state with a
                                      safe navigation path

  Network/API error                   Actionable retry option and
                                      nontechnical explanation

  Rate limited                        Explain that the request was
                                      throttled and when retry may be
                                      possible

  Stale/live disconnected             Preserve last known data but label
                                      it stale

  Partial data                        Show available metrics and identify
                                      unavailable ones

  Cancelled                           Confirm cancellation only after
                                      authoritative state confirms it

  Inconclusive analysis               Explain insufficient evidence and
                                      how to run a more useful test

  Destructive confirmation            State exact impact and provide
                                      cancel/back action
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 14. Proposed implementation phases

### Phase 0 --- Repository and product audit

-   Inspect current routes, components, API contracts, auth
    implementation, schema, and deployment.
-   Identify implemented, partial, and missing capabilities.
-   Confirm route conventions and design-system dependencies.
-   Audit packages before removals or schema simplification.
-   Produce a route/feature matrix.

### Phase 1 --- Design foundation

-   Define tokens, typography, grid, primitives, buttons, forms, cards,
    tables, badges, dialogs, chart colors, and motion rules.
-   Build the marketing header/footer and authenticated shell.
-   Add responsive and accessibility foundations.

### Phase 2 --- Public website

-   Home, product pages, how it works, use cases, integrations, docs
    shell, security, legal pages, about/contact.
-   Use verified copy and labelled demo visuals.
-   Add SEO metadata and responsive behavior.

### Phase 3 --- Authentication and onboarding

-   Sign-up/sign-in/recovery/verification/OAuth/invitation flows based
    on actual auth capability.
-   Organization/project creation.
-   Target setup and first-test guidance.
-   Permission and error handling.

### Phase 4 --- Core application

-   Overview.
-   Target and project management.
-   Runner cockpit and live SSE metrics.
-   Test history and detailed analysis.
-   Comparison studio.

### Phase 5 --- Workspace and account

-   Members and invitations.
-   Profile and account settings.
-   Preferences and privacy controls.
-   API keys and integrations.
-   Usage/billing/audit pages only when supported by backend
    capabilities.

### Phase 6 --- Hardening

-   Accessibility, responsive QA, performance profiling, security
    review, error-state review.
-   E2E tests and production smoke tests.
-   Confirm telemetry and analytics do not collect secrets or sensitive
    payloads.
-   Validate actual production deployment configuration.

------------------------------------------------------------------------

## 15. Definition of done

The product is not done merely because the pages look finished.

-   Every visible navigation item leads to a working page or is
    explicitly labelled as planned/unavailable.
-   Public copy matches implemented product capabilities.
-   No fabricated metrics, customer logos, certifications, or root-cause
    claims.
-   Auth flows handle success, invalid inputs, expired tokens, provider
    errors, and recovery.
-   Organization data is isolated and every sensitive operation is
    server-authorized.
-   Users can create a project, register an authorized target, run a
    test, cancel it, inspect results, and compare two compatible runs.
-   Live metrics show stream health and never invent samples.
-   Inconclusive/insufficient-data cases are handled clearly.
-   Profile, privacy, organization membership, and account deletion
    workflows explain their effects.
-   All primary flows are keyboard-accessible and responsive.
-   Unit, integration, E2E, typecheck, lint, and production build checks
    pass.
-   Deployment secrets and user secrets are never exposed to the client
    or logs.
-   Legal pages are reviewed and approved before production launch.

------------------------------------------------------------------------

## 16. Decisions to resolve before implementation

1.  **Authentication provider:** which auth system is already
    integrated, and which methods are enabled?
2.  **Target model:** are targets a separate database entity or
    represented by project configuration?
3.  **Organization permissions:** fixed roles or custom roles?
4.  **Billing:** is billing in scope now, and which provider is actually
    integrated?
5.  **Usage limits:** what server-enforced concurrency, duration, and
    request-rate limits apply?
6.  **Data retention:** how long are run samples and results retained,
    and can users export/delete them?
7.  **Live stream contract:** what event schema, heartbeat, replay, and
    cancellation contract does the server support?
8.  **Analysis confidence:** what algorithm and evidence qualify a
    saturation knee or breaking point?
9.  **Public demo:** will there be a safe, isolated demo environment or
    only a walkthrough?
10. **Theme:** should the app ship light-only initially or light/dark
    from the first release?
11. **Docs system:** existing docs framework or a route-based docs
    experience?
12. **Legal ownership:** who will review and approve privacy, terms,
    acceptable use, and DPA language?

Until these are confirmed, implement the design in a way that keeps
unsupported features hidden and leaves room for later extension.

------------------------------------------------------------------------

## 17. Final design principle

**STRIM should feel effortless before a test, trustworthy during a test,
and unmistakably useful after a test.**

The marketing website earns attention through clarity. Onboarding
removes friction. The runner communicates what is happening. Analysis
explains what the evidence means. Comparison helps teams make release
decisions. Organization and account pages make the service manageable
and secure.

Every page, component, and interaction should serve that connected
journey.