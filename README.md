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
| `packages/eslint-config` | `@strim/eslint-config` | Shared ESLint config
