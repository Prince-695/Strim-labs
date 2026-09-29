import type { Context } from "hono";
import { otlpToEnvelope, type TelemetryEnvelope } from "@strim/shared";
import type { AppEnv } from "../../types";
import { IngestService, MAX_PAYLOAD_BYTES } from "./service";

export async function ingestHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Missing valid API key or organization context" }, 401);
  }

  // 1. Anti-DDoS & Bombardment Defense: 500KB payload limit check
  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return c.json(
      {
        error: "PAYLOAD_TOO_LARGE",
        message: `Payload exceeds maximum allowed size of 500KB (received ${contentLength} bytes)`,
      },
      413,
    );
  }

  // 2. Redis sliding-window rate limit defense
  const rl = await IngestService.checkRateLimit(organizationId);
  if (!rl.allowed) {
    c.header("retry-after", "1");
    return c.json({ error: "RATE_LIMITED", message: "Telemetry ingestion rate limit exceeded" }, 429);
  }

  const raw = await c.req.json();
  const envelope = raw as TelemetryEnvelope;

  const result = await IngestService.enqueueBatch(c.get("db"), organizationId, envelope);
  return c.json(result, 202);
}

export async function otlpTracesHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Missing valid API key or organization context" }, 401);
  }

  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return c.json(
      {
        error: "PAYLOAD_TOO_LARGE",
        message: `Payload exceeds maximum allowed size of 500KB (received ${contentLength} bytes)`,
      },
      413,
    );
  }

  const rl = await IngestService.checkRateLimit(organizationId);
  if (!rl.allowed) {
    c.header("retry-after", "1");
    return c.json({ error: "RATE_LIMITED", message: "Telemetry ingestion rate limit exceeded" }, 429);
  }

  const body = (await c.req.json()) as {
    projectId?: string;
    environment?: string;
    resourceSpans: { scopeSpans: { spans: never[] }[] }[];
  };

  const envelope = otlpToEnvelope({
    projectId: body.projectId ?? "unknown",
    environment: body.environment ?? "production",
    resourceSpans: body.resourceSpans,
  });

  const result = await IngestService.enqueueBatch(c.get("db"), organizationId, envelope);
  return c.json(result, 202);
}
