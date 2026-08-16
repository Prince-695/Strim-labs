import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { requireAnyRole, requireRole } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";

export const billingRoutes = new Hono<AppEnv>();
billingRoutes.use("*", requireAuth, requireOrg);

billingRoutes.get("/", requireAnyRole(["BILLING"]), async (c) => {
  const organizationId = c.get("organizationId")!;
  const account = await c.get("db").billingAccount.findUnique({
    where: { organizationId },
    include: { invoices: true },
  });
  const usage = await c.get("db").usageEvent.groupBy({
    by: ["metric"],
    where: { organizationId },
    _sum: { quantity: true },
  });
  return c.json({ account, usage });
});

billingRoutes.post("/invoices/generate", requireAnyRole(["BILLING"]), async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = c.get("db");
  const account = await db.billingAccount.findUnique({ where: { organizationId } });
  if (!account) return c.json({ error: "NOT_FOUND" }, 404);
  const usage = await db.usageEvent.aggregate({
    where: { organizationId, metric: "telemetry_events" },
    _sum: { quantity: true },
  });
  const events = usage._sum.quantity ?? 0;
  const amountCents = Math.round(2900 + events * 0.01);
  const invoice = await db.invoice.create({
    data: {
      accountId: account.id,
      periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      periodEnd: new Date(),
      amountCents,
      status: "open",
    },
  });
  return c.json(invoice, 201);
});

export const retentionRoutes = new Hono<AppEnv>();
retentionRoutes.use("*", requireAuth, requireOrg, requireRole("ADMIN"));

retentionRoutes.post("/", async (c) => {
  const body = z.object({ dataClass: z.string(), days: z.number().min(30) }).parse(await c.req.json());
  if (body.dataClass === "audit" && body.days < 365) {
    return c.json({ error: "VALIDATION", message: "Audit retention floor is 365 days" }, 400);
  }
  const policy = await c.get("db").retentionPolicy.create({
    data: { organizationId: c.get("organizationId")!, ...body },
  });
  return c.json(policy, 201);
});

retentionRoutes.post("/purge", async (c) => {
  const organizationId = c.get("organizationId")!;
  const policies = await c.get("db").retentionPolicy.findMany({ where: { organizationId } });
  const purged: string[] = [];
  for (const p of policies) {
    if (p.dataClass === "audit") continue;
    if (p.dataClass === "request_payloads") {
      const cutoff = new Date(Date.now() - p.days * 86400000);
      await c.get("db").requestRecord.deleteMany({
        where: { organizationId, createdAt: { lt: cutoff } },
      });
      purged.push(p.dataClass);
    }
  }
  await writeAudit(c.get("db"), {
    organizationId,
    actorId: c.get("userId"),
    action: "retention.purge",
    resourceType: "retention",
    newValue: { purged },
  });
  return c.json({ purged });
});

export const ssoRoutes = new Hono<AppEnv>();
ssoRoutes.use("*", requireAuth, requireOrg, requireRole("OWNER"));

ssoRoutes.put("/", async (c) => {
  const body = z
    .object({
      provider: z.enum(["oidc", "saml", "scim"]),
      config: z.record(z.unknown()),
    })
    .parse(await c.req.json());
  const org = await c.get("db").organization.update({
    where: { id: c.get("organizationId")! },
    data: { ssoProvider: body.provider, ssoConfig: body.config as object },
  });
  return c.json({
    provider: org.ssoProvider,
    configured: true,
    note: "Auth port is SSO-ready; complete IdP handshake in production.",
  });
});

export const chaosRoutes = new Hono<AppEnv>();
chaosRoutes.use("*", requireAuth, requireOrg);

chaosRoutes.post("/", async (c) => {
  const body = z
    .object({
      environmentId: z.string(),
      kind: z.enum(["latency", "error", "timeout", "cache_unavailable", "partial_failure", "traffic_spike"]),
      target: z.string(),
    })
    .parse(await c.req.json());
  const db = c.get("db");
  const env = await db.environment.findFirst({
    where: { id: body.environmentId, organizationId: c.get("organizationId")! },
  });
  if (!env) return c.json({ error: "NOT_FOUND" }, 404);
  if (env.type === "PRODUCTION" && c.get("role") !== "OWNER" && c.get("role") !== "ADMIN") {
    return c.json({ error: "FORBIDDEN", message: "Production chaos requires production-tier permission" }, 403);
  }
  const exp = await db.chaosExperiment.create({
    data: {
      organizationId: c.get("organizationId")!,
      environmentId: body.environmentId,
      kind: body.kind,
      target: body.target,
      status: "running",
    },
  });
  await writeAudit(db, {
    organizationId: c.get("organizationId")!,
    actorId: c.get("userId"),
    action: "chaos.start",
    resourceType: "chaos",
    resourceId: exp.id,
    environmentId: body.environmentId,
    newValue: body,
  });
  return c.json(exp, 201);
});

chaosRoutes.post("/:id/revert", async (c) => {
  const exp = await c.get("db").chaosExperiment.update({
    where: { id: c.req.param("id") },
    data: { status: "reverted", revertedAt: new Date() },
  });
  await writeAudit(c.get("db"), {
    organizationId: c.get("organizationId")!,
    actorId: c.get("userId"),
    action: "chaos.revert",
    resourceType: "chaos",
    resourceId: exp.id,
  });
  return c.json(exp);
});
