# STRIM Labs — Frontend Application (`apps/web`)

Production-grade, multi-tenant Next.js App Router frontend for **STRIM Labs**: the API discovery, continuous observability, distributed load testing, breaking point detection, and performance diagnostics platform.

---

## 1. Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript (strict mode, zero implicit any, zero ts-ignore)
- **Styling**: Tailwind CSS v4 + Design Tokens (dark-first developer tool aesthetic)
- **UI Components**: Radix UI primitives + custom shadcn/ui components
- **Motion & Animation**: Motion (Framer Motion v12) + GSAP v3 (respecting `prefers-reduced-motion`)
- **Server State**: TanStack Query v5 (automatic background refetch, cache invalidation, smart retries)
- **Forms & Validation**: React Hook Form + Zod schema resolvers
- **API Typing**: Generated from backend OpenAPI 3.1 specification via `openapi-typescript`
- **Charts & Telemetry**: Recharts v3 (responsive time-series, latency percentiles, breaking point knee curves)
- **Icons**: Lucide React
- **Package Manager**: `bun` (monorepo workspaces)

---

## 2. Prerequisites & Setup

- **Node.js**: >= 20.0.0
- **Bun**: >= 1.2.0
- **Backend Service**: Hono API running on `http://localhost:8080` with OpenAPI 3.1 contract exposed at `/api/v1/openapi.json`.

### Environment Configuration

Copy the example environment file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Configured variables:
```dotenv
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:8080"
NEXT_PUBLIC_API_BASE_URL="http://localhost:8080"
```

---

## 3. Development Workflow

```bash
# From workspace root:
bun dev:web               # Start Next.js dev server on http://localhost:3000
bun dev:server            # Start Hono backend on http://localhost:8080
bun dev                   # Start both concurrently

# Typecheck & Tests:
bun run --cwd apps/web typecheck   # Strict TypeScript verification
bun run --cwd apps/web test        # Execute unit test suites
bun run --cwd apps/web build       # Next.js production build
bun run --cwd apps/web start       # Run production server
```

### OpenAPI Type Synchronization

Whenever the backend OpenAPI 3.1 schemas change:

```bash
bun run --cwd apps/web codegen:api
```
This updates `apps/web/src/lib/api/generated/schema.d.ts` directly from `http://localhost:8080/api/v1/openapi.json`.

---

## 4. Production Repository Architecture

```
apps/web/src/
├── app/
│   ├── (marketing)/             # Public product pages (landing, features, docs, pricing, contact, legal)
│   ├── (auth)/                  # Authentication (sign-in, sign-up, forgot-pwd, reset-pwd, verify-email)
│   ├── (onboarding)/            # Progressive setup wizard (account -> org -> project -> service connection)
│   ├── (dashboard)/app/         # Authenticated multi-tenant workspace
│   │   ├── organizations/       # Org switcher, creation, settings, members, audit-logs, api-keys, usage
│   │   │   └── [orgId]/projects/
│   │   │       └── [projectId]/ # Telemetry overview, services, monitoring, load-tests, diagnostics, alerts
│   │   └── settings/            # User profile, security, sessions, preferences, notifications
│   ├── invite/[token]/          # Organization invitation onboarding
│   ├── auth/callback/           # OAuth exchange handler
│   ├── layout.tsx               # Root application shell + theme initialization
│   └── globals.css              # Design tokens and custom utilities
├── components/
│   ├── ui/                      # Radix UI primitives (Button, Dialog, Badge, Input, Table, etc.)
│   ├── layout/                  # PageHeader, AppHeader, AppSidebar, DashboardShell
│   ├── feedback/                # LoadingState, ErrorState, EmptyState
│   └── data-display/            # MetricCard, HttpMethodBadge, StatusBadge, CopyButton
├── lib/
│   ├── api/                     # Central API layer (fetchApi, openapi client, errors, queryKeys, schema.d.ts)
│   ├── auth/                    # SessionProvider, useAuth (hydration-safe, auto-401 sign-out)
│   ├── env.ts                   # Validated runtime environment
│   └── utils.ts                 # Styling utilities (cn, clsx, tailwind-merge)
└── tests/
    └── unit/                    # ApiError, queryKeys, and validation test suites
```

---

## 5. Multi-Tenant Tenancy & Backend Integration

1. **Zero Mock Data**: Every chart, table, metric card, and mutation connects directly to `/api/v1/...` on the live Hono backend.
2. **Tenancy Quotas**:
   - Enforced by backend: Maximum of 3 organization memberships per user.
   - Enforced by backend: Maximum of 5 projects per organization.
   - UI displays live quota progress indicators and disables creation actions when limits are reached.
3. **Session State**:
   - Stored in browser storage (`strim_token`, `strim_user`, `strim_org_id`, `strim_project_id`).
   - Read safely across SSR and hydration using `useSyncExternalStore`.
   - Automatic 401 interceptor purges credentials and redirects to `/sign-in`.
4. **Breaking Point & Diagnostics**:
   - Integrates with the distributed load testing engine to display confirmed saturation knee RPS, sustainable throughput, breaking cliff, bottleneck classifications, and actionable remediation findings.
