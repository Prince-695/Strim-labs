import { Hono } from "hono";
import { cors } from "hono/cors";
import type { PrismaClient } from "@prisma/client";
import type { AppEnv } from "./types";
import { optionalAuth } from "./middleware/auth";
import { apiKeyAuth } from "./middleware/api-key";
import { authRoutes } from "./modules/auth";
import { projectRoutes } from "./modules/projects";
import { loadTestRoutes } from "./modules/load-tests";
import { compareRoutes } from "./modules/compare";
import { orgRoutes } from "./modules/org";
import { discoveryRoutes } from "./modules/discovery";
import { ingestRoutes } from "./modules/ingest";

export function createApp(db: PrismaClient) {
  const app = new Hono<AppEnv>();

  app.use("*", cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  }));

  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  app.use("*", optionalAuth);
  app.use("*", apiKeyAuth);

  app.get("/health", (c) => c.json({ ok: true, service: "strim-load-engine" }));

  // Mount Core API Routes
  app.route("/v1/auth", authRoutes);
  app.route("/v1/projects", projectRoutes);
  app.route("/v1/load-tests", loadTestRoutes);
  app.route("/v1/compare", compareRoutes);
  app.route("/v1/org", orgRoutes);
  app.route("/v1/discovery", discoveryRoutes);
  app.route("/v1/ingest", ingestRoutes);

  app.onError((err, c) => {
    const status = (err as { status?: number }).status ?? 500;
    if (err.message === "TENANT_MISMATCH") {
      return c.json({ error: "TENANT_MISMATCH", message: "Cross-tenant access denied" }, 403);
    }
    return c.json({ error: "INTERNAL", message: err.message }, status as 500);
  });

  return app;
}
