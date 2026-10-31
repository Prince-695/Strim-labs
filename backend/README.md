# STRIM Labs - Backend API

Production-grade, high-performance Go backend for STRIM Labs: API Observability, Real Load Testing, and Breaking Point Engine.

---

## Architecture Highlights

- **Dependency Injection**: Constructor-based DI via interfaces across Handlers → Services → Repositories.
- **Database**: PostgreSQL with GORM connection pool tuning, structured `slog` logging adapter, and tenant isolation scopes.
- **HTTP Server**: Fiber v2 with custom error handling, request ID tracing (`X-Request-ID`), panic recovery, security headers, and context timeout.
- **Universal Response Envelope**: Consistent `domain.Response` format across all endpoints.
- **Interactive Documentation**: Swagger UI protected by HTTP Basic Auth.

---

## Quickstart

### 1. Configuration
Copy the example environment file and configure your credentials:
```bash
cp .env.example .env
```

### 2. Run the API Server
```bash
make run
# or: go run ./cmd/server/main.go
```
The server will start at `http://localhost:8080`.

### 3. Run the Background Worker
```bash
make worker
# or: go run ./cmd/worker/main.go
```

### 4. Interactive Swagger Documentation
Open in your browser:
- URL: `http://localhost:8080/swagger/index.html`
- Credentials: User `admin` / Password `admin` (configurable via `SWAGGER_USER` and `SWAGGER_PASSWORD`)

---

## Testing & Quality

```bash
make test    # Run unit and integration tests with race detector
make lint    # Run golangci-lint
make swag    # Regenerate Swagger OpenAPI documentation
make build   # Compile production binaries to bin/server and bin/worker
```