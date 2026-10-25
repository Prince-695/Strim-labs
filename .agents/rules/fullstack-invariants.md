# STRIM Labs Full-Stack Engineering Invariants

## 1. Database Schema Synchronization
- Always ensure the Docker PostgreSQL container volume is synchronized with `packages/db/prisma/schema.prisma`.
- When models or relation table names are refactored (e.g., `LoadTest` -> `TestRun`, or adding columns like `Project.targetUrl`), execute:
  `bun --filter @strim/db push --accept-data-loss`
  followed by `bun --filter @strim/db seed`.
- Verify database state with `PrismaClientKnownRequestError` checks (codes `P2021` table missing, `P2022` column missing) before blaming client code.

## 2. Full-Duplex SSE Stream Protocol Invariant
- Every SSE stream endpoint (`GET /v1/load-tests/:id/stream`) MUST emit explicit terminal frames when execution completes:
  - On run finish: emit `event: done\ndata: {"runId": "..."}\n\n` and call `controller.close()`.
  - On run abort: emit `event: abort\ndata: {"runId": "..."}\n\n` and call `controller.close()`.
- Client stream readers (`openRunStream`) MUST listen for terminal events to cleanly unmount timers, invalidate TanStack queries, and navigate to results. Never rely solely on client-side timeouts.

## 3. API Contract & Schema Parity
- Backend Zod schemas for mutations (`startTestSchema`, `createApiKeySchema`) MUST allow optional fields when project/org defaults exist (e.g. `targetUrl` and `method` should default to `project.targetUrl` and `project.defaultMethod`).
- Backend handlers MUST return backward-compatible response property aliases (`{ testRun, run: testRun }`, `{ apiKey, key: apiKey }`) so frontend destructuring (`const { run } = ...`) never produces runtime `TypeError: undefined`.
- Always expose canonical route aliases for actions (e.g. both `POST /:id/stop` and `POST /:id/abort`).

## 4. Input Normalization Ergonomics
- Never assume users input fully qualified URLs with protocol schemes.
- All URL inputs MUST run through `normalizeUrl()` before validation and storage:
  - `localhost:8080/health` -> `http://localhost:8080/health`
  - `127.0.0.1:3000` -> `http://127.0.0.1:3000`
  - `api.example.com` -> `https://api.example.com`
- Default demo targets MUST always point to live, reachable endpoints (e.g. `http://localhost:8080/health`), never non-existent ports like `3001`.

## 5. 3D Canvas Visual Standards
- 3D visualizers MUST adapt to both Light and Dark themes dynamically.
- Use smooth antialiased rendering, depth buffering, and responsive DPR scaling.
- Support both desktop mouse orbit and mobile touch gestures with inertia.
- Ensure the animation communicates the product story: clear safe, saturation knee, and breaking cliff visual thresholds with real-time probe feedback.
