# STRIM Labs web console (`apps/web`)

Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4.

## Run it

```bash
# from the monorepo root, with the API running on :8080
cd apps/web
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8080
bun install
bun run dev                    # http://localhost:3000
```

Other scripts: `bun run typecheck`, `bun run build`, `bun run start`.

> This package was generated without network access to a package registry, so it has **not** been installed, type-checked or built yet. Run `bun run typecheck && bun run build` first and fix anything that surfaces.

## Routes

| Route | What it is |
|---|---|
| `/` | Marketing page for guests, capacity dashboard when signed in |
| `/how-it-works`, `/docs` | Public architecture guide and documentation |
| `/login`, `/signup`, `/forgot-password` | Auth (two-column layout with the 3D surface) |
| `/runner` | Load runner cockpit: presets, live SSE telemetry, abort |
| `/tests`, `/tests/[id]` | Run history; run detail with capacity gauge and diagnosis |
| `/compare` | Regression studio with live gate sliders |
| `/settings` | Workspace, CI/CD API keys, members |

## Architecture

```
src/
  app/            routes (route groups: (auth), (app))
  components/
    ui/           primitives: button, dialog, tabs, slider, table…
    fx/           motion + 3D: terrain-canvas, tilt-card, animated-number, magnetic, reveal
    marketing/    header, footer, hero, simulator, sections, docs, diagram
    runner/       preset cards, live cockpit
  lib/
    api.ts        fetch client + ApiError (401/403/404/409/422/429/5xx normalised)
    session.tsx   localStorage session via useSyncExternalStore
    sse.ts        fetch-based SSE client with bounded backoff and de-duplication
    gate.ts       regression-gate logic and run compatibility checks
    analysis.ts   evidence diagnosis (observed / likely explanation / next checks)
    format.ts     the one place for number, unit and "—" formatting
```

Motion lives in `fx/` and is limited to: the hero latency surface, tilt on key cards, spring-tweened live numbers, and the verdict stamp. Everything respects `prefers-reduced-motion`.

## Assumptions about the backend (verify these)

- **Error rate** is a 0–1 fraction. If the API returns percent, flip `ERROR_RATE_IS_FRACTION` in `src/lib/format.ts`.
- **Aborted status**: the spec says `ABORTED`, the README says `CANCELLED`. Both are handled.
- **SSE** is read with `fetch` (not `EventSource`) so the `Authorization` header can be sent. Events: `sample`, `done`, `abort`.
- **Targets** are `projects` (1:1), per the spec.
- **Forgot password** has no endpoint in the contract, so that page only shows the neutral confirmation state. Wire it to a real endpoint when one exists.
- Member invites/removal and a `/targets` management page are not in the API contract and are intentionally absent.

## Not done yet

Unit tests for `gate.ts`, `analysis.ts` and `format.ts`, and E2E tests, are recommended before shipping.
