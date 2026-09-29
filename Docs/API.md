# Strim API (dogfooded)

Base URL: `http://localhost:8080`

Auth: `Authorization: Bearer <session-or-sk_key>` plus `x-organization-id` for tenant-scoped routes.

## Auth
- `POST /v1/auth/signup`
- `POST /v1/auth/login`
- `GET /v1/auth/me`

## Directory
- `GET /v1/org/context`
- `POST /v1/org/workspaces|projects|applications|teams`
- `GET /v1/org/applications`

## Keys, audit
- `GET|POST /v1/api-keys` · `POST /v1/api-keys/:id/revoke|rotate`
- `GET /v1/audit` · `GET /v1/audit/export` (immutable)

## Ingest
- `POST /v1/ingest` (`telemetry:write`)
- `POST /v1/otlp/v1/traces`
- `GET /v1/sdk/config`

## Runtime loop
- Runtime, requests, topology, replay, config, cache, simulations, load tests, change plans, incidents, policies, AI, integrations, billing, retention, SSO, chaos — all under `/v1/*`.

CI gate: `POST /v1/integrations/ci/gate`
