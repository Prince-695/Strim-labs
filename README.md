# Strim

Runtime intelligence and change platform. Know what a change will do before production finds out.

## Monorepo

Bun workspaces (`apps/*`, `packages/*`).

| Path | Package | Role |
|------|---------|------|
| `apps/server` | `@strim/server` | Hono modular monolith |
| `apps/web` | `@strim/web` | Next.js dashboard |
| `apps/ingest` | `@strim/ingest` | Extracted telemetry ingest (Phase 10) |
| `apps/worker` | `@strim/worker` | Extracted async workers (Phase 10) |
| `packages/shared` | `@strim/shared` | Types, events, RBAC, engines |
| `packages/sdk` | `@strim/sdk` | Customer runtime SDK |
| `packages/db` | `@strim/db` | Prisma schema and client |
| `packages/redaction` | `@strim/redaction` | Shared redaction extract |
| `packages/tsconfig` | `@strim/tsconfig` | Shared TypeScript config |
| `packages/eslint-config` | `@strim/eslint-config` | Shared ESLint config |

## Quick start

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
bun install
bun run db:generate
bun run db:push
bun run db:seed
bun run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

Seeded login: `priya@acme.test` / `password123` (Acme) and `marcus@globex.test` / `password123` (Globex).

## SDK

```ts
import { strim } from "@strim/sdk";

strim.init({
  projectId: "checkout",
  environment: "production",
  apiKey: process.env.STRIM_API_KEY,
});

const timeout = strim.config("checkout.timeout");
```
