# CI Checks Before a PR

Run these checks locally before opening a pull request.

## Backend

From the `backend/` directory, you can run individual checks or `make ci`:

- Format Go files:
  - `make fmt` (or `gofmt -w .`)
- Check formatting:
  - `make fmt-check` (or `if [ -n "$$(gofmt -l .)" ]; then exit 1; fi`)
- Verify dependencies:
  - `go mod tidy`
- Run static analysis:
  - `make vet` (or `go vet ./...`)
  - `make lint` (or `golangci-lint run ./...`)
- Run tests:
  - `make test` (or `go test -v -race -cover ./...`)
- Build the backend:
  - `make build` (or `go build ./...`)
- **Run all backend CI checks locally at once**:
  - `make ci`

## Frontend

From the `frontend/` directory:

- Install dependencies:
  - `pnpm install`
- Run linting:
  - `pnpm lint`
- Run TypeScript type checking:
  - `pnpm typecheck`
- Check formatting:
  - `pnpm format:check`
- Build the app:
  - `pnpm build`

## Recommended Pre-PR Sequence

1. Backend: format, tidy, vet, lint, build.
2. Frontend: lint, typecheck, format check, build.
3. Push only after all checks pass locally.

## Notes

- The backend GitHub workflow runs on changes under `backend/**`.
- The frontend GitHub workflow runs on changes under `frontend/**`.
- The full build workflow also expects both sides to pass before deploy-related steps run.