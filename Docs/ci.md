# CI Checks Before a PR

Run these checks locally before opening a pull request.

## Backend

From the `backend/` directory:

- Format Go files:
  - `find . -name '*.go' -print0 | xargs -0 gofmt -w`
- Check formatting:
  - `if [ -n "$(find . -name '*.go' -print0 | xargs -0 gofmt -l)" ]; then echo 'Go files are not formatted'; exit 1; fi`
- Verify dependencies:
  - `go mod tidy`
- Run static analysis:
  - `go vet ./...`
  - `golangci-lint run ./...`
- Build the backend:
  - `go build ./...`

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