import { Hono } from "hono";
import { cors } from "hono/cors";
import type { PrismaClient } from "@prisma/client";
import type { AppEnv } from "./types";
import { optionalAuth } from "./middleware/auth";
import { apiKeyAuth } from "./middleware/api-key";
import { authRoutes } from "./modules/auth";
import { directoryRoutes } from "./modules/directory";
import { keyRoutes } from "./modules/keys";
import { auditRoutes } from "./modules/audit";
import { ingestRoutes, registerTelemetryWorker } from "./modules/ingest";
import { runtimeRoutes } from "./modules/runtime";
import { requestRoutes } from "./modules/requests";
import { topologyRoutes } from "./modules/topology";
import { replayRoutes, registerReplayWorker } from "./modules/replay";
import { configRoutes, sdkConfigRoutes } from "./modules/config";
import { cacheRoutes } from "./modules/cache";
import { loadTestRoutes, simulationRoutes } from "./modules/simulations";
import { changePlanRoutes } from "./modules/change-plans";
import { incidentRoutes } from "./modules/incidents";
import { policyRoutes } from "./modules/policies";
import { aiRoutes } from "./modules/ai";
import { integrationRoutes } from "./modules/integrations";
import { billingRoutes, chaosRoutes, retentionRoutes, ssoRoutes } from "./modules/billing";
import { docsRoutes } from "./modules/docs";
import { queue } from "./lib/queue";

export function createApp(db: PrismaClient) {
  const app = new Hono<AppEnv>();

  app.use("*", cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true }));
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.use("*", optionalAuth);
  app.use("*", apiKeyAuth);

  app.get("/health", (c) => c.json({ ok: true, service: "strim-server" }));
  app.route("/v1", docsRoutes);
  app.get("/docs", (c) => c.redirect("/v1/docs"));
  app.get("/swagger", (c) => c.redirect("/v1/swagger"));

  app.route("/v1/auth", authRoutes);
  app.route("/v1/org", directoryRoutes);
  app.route("/v1/api-keys", keyRoutes);
  app.route("/v1/audit", auditRoutes);
  app.route("/", ingestRoutes);
  app.route("/", sdkConfigRoutes);
  app.route("/v1/runtime", runtimeRoutes);
  app.route("/v1/requests", requestRoutes);
  app.route("/v1/topology", topologyRoutes);
  app.route("/v1/replay", replayRoutes);
  app.route("/v1/config", configRoutes);
  app.route("/v1/cache", cacheRoutes);
  app.route("/v1/simulations", simulationRoutes);
  app.route("/v1/load-tests", loadTestRoutes);
  app.route("/v1/change-plans", changePlanRoutes);
  app.route("/v1/incidents", incidentRoutes);
  app.route("/v1/policies", policyRoutes);
  app.route("/v1/ai", aiRoutes);
  app.route("/v1/integrations", integrationRoutes);
  app.route("/v1/billing", billingRoutes);
  app.route("/v1/retention", retentionRoutes);
  app.route("/v1/sso", ssoRoutes);
  app.route("/v1/chaos", chaosRoutes);

  app.get("/v1/ws/info", (c) =>
    c.json({
      note: "Subscribe via GET /v1/events/stream (SSE)",
      recent: queue.recent(c.get("organizationId")).slice(-10),
    }),
  );

  app.get("/v1/events/stream", async (c) => {
    const organizationId = c.get("organizationId");
    return streamSse(c, organizationId);
  });

  app.onError((err, c) => {
    const status = (err as { status?: number }).status ?? 500;
    if (err.message === "TENANT_MISMATCH") {
      return c.json({ error: "TENANT_MISMATCH", message: "Cross-tenant access denied" }, 403);
    }
    return c.json({ error: "INTERNAL", message: err.message }, status as 500);
  });

  return app;
}

function streamSse(c: { header: (k: string, v: string) => void }, organizationId?: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        const parsed = JSON.parse(data) as { payload?: { organizationId?: string } };
        if (organizationId && parsed.payload?.organizationId && parsed.payload.organizationId !== organizationId) {
          return;
        }
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };
      const unsub = queue.subscribe(send);
      const ping = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 15000);
      return () => {
        unsub();
        clearInterval(ping);
      };
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

export async function startWorkers(db: PrismaClient): Promise<void> {
  await registerTelemetryWorker(db);
  await registerReplayWorker(db);
}
