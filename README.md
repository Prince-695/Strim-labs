# Strim

Runtime intelligence and change platform. Know what a change will do before production finds out.

## Monorepo

Bun workspaces (`apps/*`, `packages/*`).

| Path | Package | Role |
|------|---------|------|
| `apps/server` | `@strim/server` | Hono modular monolith |
| `apps/web` | `@strim/web` | Next.js dashboard |
| `apps/demo-checkout` | `@strim/demo-checkout` | Sample customer app |
| `packages/shared` | `@strim/shared` | Types, events, RBAC, DTOs |
| `packages/sdk` | `@strim/sdk` | Customer runtime SDK |
| `packages/db` | `@strim/db` | Prisma schema and client |
| `packages/tsconfig` | `@strim/tsconfig` | Shared TypeScript config |
| `packages/eslint-config` | `@strim/eslint-config` | Shared ESLint config |

## Quick start

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
bun install
bun run db:generate
bun run db:migrate
bun run db:seed
bun run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Demo checkout: http://localhost:3002

Seeded login: `priya@acme.test` / `password123` (Org A) and `marcus@globex.test` / `password123` (Org B).

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
# Strim
