.PHONY: run worker build test lint swag clean fmt fmt-check vet ci help

VERSION ?= 1.0.0
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "dev")
BUILT_AT ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

LDFLAGS = -X 'main.Version=$(VERSION)' -X 'main.Commit=$(COMMIT)' -X 'main.BuiltAt=$(BUILT_AT)'

help: ## Show available make targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

run: ## Run the STRIM API server locally
	go run -ldflags="$(LDFLAGS)" ./cmd/server/main.go

worker: ## Run the STRIM background worker locally
	go run -ldflags="$(LDFLAGS)" ./cmd/worker/main.go

build: ## Build server and worker binaries
	@mkdir -p bin
	go build -ldflags="$(LDFLAGS)" -o bin/server ./cmd/server
	go build -ldflags="$(LDFLAGS)" -o bin/worker ./cmd/worker
	@echo "Build complete: bin/server, bin/worker"

swag: ## Generate Swagger API documentation
	swag init -g cmd/server/main.go -o docs
	@echo "Swagger documentation generated in docs/"

fmt: ## Format all Go source files
	@echo "Formatting Go files..."
	@gofmt -w .
	@echo "Formatting complete."

fmt-check: ## Check Go source files formatting
	@echo "Checking Go file formatting..."
	@UNFORMATTED=$$(gofmt -l .); \
	if [ -n "$$UNFORMATTED" ]; then \
		echo "Go files are not formatted:"; \
		echo "$$UNFORMATTED"; \
		exit 1; \
	fi
	@echo "All Go files are properly formatted."

vet: ## Run go vet static analysis
	go vet ./...

test: ## Run unit tests with race detection
	go test -v -race -cover ./...

lint: ## Run golangci-lint
	golangci-lint run ./...

ci: fmt-check vet lint test build ## Run full CI pipeline checks locally

clean: ## Clean build artifacts
	rm -rf bin/ docs/
