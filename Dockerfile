# Multi-stage production build for Strim Platform
FROM oven/bun:1.2.4-alpine AS base
WORKDIR /app

# Install OpenSSL & libc dependencies for Prisma engine
RUN apk add --no-cache openssl libc6-compat ca-certificates

# Copy package manifests and workspace configurations
COPY package.json bun.lock* bunfig.toml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/tsconfig/package.json ./packages/tsconfig/

# Install workspace dependencies
RUN bun install --frozen-lockfile

# Copy full source tree
COPY . .

# Generate Prisma Client
RUN bun run db:generate

# Build Web frontend assets (optional, can be deployed separately or served)
RUN cd apps/web && bun run build || echo "Web build optional for API server image"

# Set runtime environment
ENV NODE_ENV=production
ENV PORT=8080
ENV STORAGE_DRIVER=local
ENV STORAGE_LOCAL_DIR=/app/data/storage

# Create storage volume directory
RUN mkdir -p /app/data/storage

EXPOSE 8080

# Entrypoint auto-pushes DB migrations if DATABASE_URL is set, then launches server
CMD ["sh", "-c", "bun run db:push || true && cd apps/server && bun src/index.ts"]
