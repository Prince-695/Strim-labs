import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createPrisma } from "@strim/server/prisma";
import { ingestRoutes, registerTelemetryWorker } from "@strim/server/ingest";

const db = createPrisma();
await registerTelemetryWorker(db);

const app = new Hono();
app.use("*", async (c, next) => {
  (c as unknown as { set: (k: string, v: unknown) => void }).set("db", db);
  await next();
});
app.get("/health", (c) => c.json({ ok: true, service: "strim-ingest" }));
app.route("/", ingestRoutes);

const port = Number(process.env.INGEST_PORT ?? 3003);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Strim ingest on http://localhost:${port}`);
});
