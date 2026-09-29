import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { apiKeyAuth, requireScope } from "../../middleware/api-key";
import { ingestTelemetryRoute, otlpTracesRoute } from "./routes";
import { ingestHandler, otlpTracesHandler } from "./handlers";

export const ingestRoutes = new OpenAPIHono<AppEnv>();

ingestRoutes.use("*", apiKeyAuth);
ingestRoutes.use("/v1/ingest", requireScope("telemetry:write"));
ingestRoutes.use("/v1/otlp/*", requireScope("telemetry:write"));

ingestRoutes.openapi(ingestTelemetryRoute, ingestHandler);
ingestRoutes.openapi(otlpTracesRoute, otlpTracesHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
