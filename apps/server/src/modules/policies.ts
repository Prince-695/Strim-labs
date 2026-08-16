import { Hono } from "hono";
import { z } from "zod";
import { diffRuntimeState } from "@strim/shared";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { writeAudit } from "../lib/audit";

export const policyRoutes = new Hono<AppEnv>();
policyRoutes.use("*", requireAuth, requireOrg);

policyRoutes.post("/", async (c) => {
  const body = z
    .object({
      kind: z.string(),
      name: z.string(),
      body: z.record(z.unknown()),
      environmentId: z.string().optional(),
    })
    .parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const policy = await db.policy.create({
    data: { organizationId, ...body, body: body.body as object },
  });
  await db.policyVersion.create({
    data: { policyId: policy.id, body: body.body as object, actorId: c.get("userId") },
  });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "policy.create",
    resourceType: "policy",
    resourceId: policy.id,
    newValue: body,
  });
  return c.json(policy, 201);
});

policyRoutes.get("/", async (c) => {
  const policies = await c.get("db").policy.findMany({
    where: { organizationId: c.get("organizationId")! },
    include: { versions: true },
  });
  return c.json({ policies });
});

policyRoutes.post("/rate-limits", async (c) => {
  const body = z
    .object({
      scope: z.enum(["organization", "workspace", "application", "environment", "api_key", "user", "ip", "endpoint"]),
      scopeId: z.string().optional(),
      limit: z.number(),
      windowSeconds: z.number().default(60),
    })
    .parse(await c.req.json());
  const rl = await c.get("db").rateLimit.create({
    data: { organizationId: c.get("organizationId")!, ...body },
  });
  return c.json(rl, 201);
});

policyRoutes.get("/rate-limits/evaluate", async (c) => {
  const applicationId = c.req.query("applicationId");
  const limits = await c.get("db").rateLimit.findMany({
    where: { organizationId: c.get("organizationId")! },
  });
  const specificity = ["endpoint", "api_key", "user", "ip", "environment", "application", "workspace", "organization"];
  const sorted = [...limits].sort(
    (a, b) => specificity.indexOf(a.scope) - specificity.indexOf(b.scope),
  );
  const match =
    sorted.find((l) => l.scope === "application" && l.scopeId === applicationId) ??
    sorted.find((l) => l.scope === "organization");
  return c.json({ applied: match });
});

policyRoutes.post("/promotions", async (c) => {
  const body = z
    .object({
      fromEnvId: z.string(),
      toEnvId: z.string(),
      requireSimulation: z.boolean().default(false),
    })
    .parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  if (body.requireSimulation) {
    const sim = await db.simulation.findFirst({
      where: { environmentId: body.fromEnvId, organizationId, status: "completed" },
    });
    if (!sim) {
      return c.json({ error: "SIMULATION_REQUIRED", message: "Promotion requires a passing simulation" }, 409);
    }
  }
  const promo = await db.promotion.create({
    data: { organizationId, ...body, status: "completed" },
  });
  const fromVer = await db.runtimeVersion.findFirst({
    where: { environmentId: body.fromEnvId, approved: true },
    orderBy: { seq: "desc" },
  });
  if (fromVer) {
    const last = await db.runtimeVersion.findFirst({
      where: { environmentId: body.toEnvId },
      orderBy: { seq: "desc" },
    });
    await db.runtimeVersion.create({
      data: {
        organizationId,
        environmentId: body.toEnvId,
        seq: (last?.seq ?? 0) + 1,
        values: fromVer.values as object,
        approved: true,
      },
    });
  }
  return c.json(promo, 201);
});

policyRoutes.post("/drift/check", async (c) => {
  const body = z.object({ environmentId: z.string(), actual: z.record(z.unknown()) }).parse(await c.req.json());
  const db = c.get("db");
  const env = await db.environment.findFirst({
    where: { id: body.environmentId, organizationId: c.get("organizationId")! },
  });
  if (!env) return c.json({ error: "NOT_FOUND" }, 404);
  const expected = (env.declaredState as Record<string, unknown>) ?? {};
  const diffs = diffRuntimeState(expected, body.actual);
  const report = await db.driftReport.create({
    data: {
      organizationId: c.get("organizationId")!,
      environmentId: body.environmentId,
      expected: expected as object,
      actual: body.actual as object,
      status: diffs.length ? "open" : "clean",
    },
  });
  return c.json({ report, diffs, actions: ["inspect", "accept", "correct", "create_change_plan"] });
});

policyRoutes.post("/drift/:id/:action", async (c) => {
  const action = c.req.param("action");
  if (!["inspect", "accept", "correct", "create_change_plan"].includes(action)) {
    return c.json({ error: "VALIDATION" }, 400);
  }
  const report = await c.get("db").driftReport.update({
    where: { id: c.req.param("id") },
    data: { status: action === "accept" || action === "correct" ? "resolved" : "open" },
  });
  return c.json({ report, action });
});
