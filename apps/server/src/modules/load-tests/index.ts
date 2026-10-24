import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../../types";
import { requireOrg } from "../../middleware/tenant";
import { loadEngine } from "../../engine/runner";

const startTestSchema = z.object({
  projectId: z.string(),
  name: z.string().min(2),
  targetUrl: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  concurrency: z.number().int().min(1).max(1000).default(50),
  durationSec: z.number().int().min(5).max(300).default(30),
  profile: z.enum(["SUSTAINED", "RAMP_UP", "SPIKE"]).default("RAMP_UP"),
});

export const loadTestRoutes = new Hono<AppEnv>();

loadTestRoutes.use("*", requireOrg);

loadTestRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const projectId = c.req.query("projectId");
  const db = c.get("db");

  const runs = await db.testRun.findMany({
    where: {
      organizationId,
      ...(projectId ? { projectId } : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return c.json({ runs });
});

loadTestRoutes.post("/", zValidator("json", startTestSchema), async (c) => {
  const organizationId = c.get("organizationId")!;
  const userId = c.get("userId");
  const body = c.req.valid("json");
  const db = c.get("db");

  // Verify project belongs to organization
  const project = await db.project.findFirst({
    where: { id: body.projectId, organizationId },
  });

  if (!project) {
    return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  }

  // Create test run record in DB
  const testRun = await db.testRun.create({
    data: {
      organizationId,
      projectId: project.id,
      userId,
      name: body.name,
      targetUrl: body.targetUrl,
      method: body.method,
      headers: (body.headers ?? project.defaultHeaders) as object,
      body: body.body as object,
      concurrency: body.concurrency,
      durationSec: body.durationSec,
      profile: body.profile,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  // Launch async load engine execution in background
  queueMicrotask(() => {
    void loadEngine.execute(db, {
      testRunId: testRun.id,
      organizationId,
      projectId: project.id,
      targetUrl: body.targetUrl,
      method: body.method,
      headers: (body.headers ?? project.defaultHeaders) as Record<string, string>,
      body: body.body,
      concurrency: body.concurrency,
      durationSec: body.durationSec,
      profile: body.profile,
    });
  });

  return c.json({ testRun }, 202);
});

loadTestRoutes.get("/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const run = await db.testRun.findFirst({
    where: { id, organizationId },
    include: {
      project: true,
      samples: {
        orderBy: { timestamp: "asc" },
      },
    },
  });

  if (!run) {
    return c.json({ error: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  return c.json({ run });
});

loadTestRoutes.post("/:id/stop", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const run = await db.testRun.findFirst({ where: { id, organizationId } });
  if (!run) {
    return c.json({ error: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  const aborted = loadEngine.abort(id);
  if (aborted) {
    await db.testRun.update({
      where: { id },
      data: { status: "ABORTED", completedAt: new Date() },
    });
  }

  return c.json({ success: true, aborted });
});

// Server-Sent Events (SSE) Live Metrics Stream
loadTestRoutes.get("/:id/stream", async (c) => {
  const id = c.req.param("id");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to live 500ms metrics ticks
      const unsubscribe = loadEngine.subscribe(id, (metric) => {
        try {
          const payload = `data: ${JSON.stringify(metric)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // ignore
        }
      });

      // Keepalive ping every 10 seconds
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // ignore
        }
      }, 10000);

      return () => {
        unsubscribe();
        clearInterval(ping);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
