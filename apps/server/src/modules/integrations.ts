import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";

export const integrationRoutes = new Hono<AppEnv>();
integrationRoutes.use("/github/*", requireAuth, requireOrg);
integrationRoutes.use("/deployments/*", requireAuth, requireOrg);
integrationRoutes.use("/paging/*", requireAuth, requireOrg);
integrationRoutes.use("/lineage/*", requireAuth, requireOrg);
integrationRoutes.use("/ci/*", requireAuth, requireOrg);

integrationRoutes.post("/github/webhook", async (c) => {
  const body = (await c.req.json()) as {
    repository?: { full_name: string };
    pull_request?: { number: number; head?: { sha: string; ref: string } };
    after?: string;
    ref?: string;
  };
  const sha = body.pull_request?.head?.sha ?? body.after;
  const db = c.get("db");
  const organizationId = c.get("organizationId") ?? c.req.header("x-organization-id");
  if (!organizationId || !sha) return c.json({ ignored: true });
  const plan = await db.changePlan.findFirst({
    where: { organizationId, gitPullRequest: body.pull_request ? String(body.pull_request.number) : undefined },
  });
  if (plan) {
    await db.lineageLink.create({
      data: { changePlanId: plan.id, kind: "git_commit", ref: sha },
    });
    await db.changePlan.update({
      where: { id: plan.id },
      data: { gitCommit: sha, gitBranch: body.pull_request?.head?.ref ?? body.ref },
    });
  }
  return c.json({ ok: true, sha, linked: Boolean(plan) });
});

integrationRoutes.post("/ci/gate", async (c) => {
  const body = z
    .object({
      changePlanId: z.string(),
      p95RegressionPct: z.number(),
      thresholdPct: z.number().default(20),
    })
    .parse(await c.req.json());
  const plan = await c.get("db").changePlan.findFirst({
    where: { id: body.changePlanId, organizationId: c.get("organizationId")! },
    include: { simulation: true },
  });
  if (!plan) return c.json({ error: "NOT_FOUND" }, 404);
  const fail = body.p95RegressionPct > body.thresholdPct;
  return c.json({
    result: fail ? "FAIL" : "PASS",
    reason: fail
      ? `P95 regression ${body.p95RegressionPct}% exceeds ${body.thresholdPct}%`
      : "Within threshold",
    changePlanId: plan.id,
  });
});

integrationRoutes.post("/deployments", async (c) => {
  const body = z
    .object({
      environmentId: z.string(),
      source: z.string(),
      sha: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .parse(await c.req.json());
  const event = await c.get("db").deploymentEvent.create({
    data: {
      organizationId: c.get("organizationId")!,
      environmentId: body.environmentId,
      source: body.source,
      sha: body.sha,
      metadata: (body.metadata ?? {}) as object,
    },
  });
  const last = await c.get("db").runtimeVersion.findFirst({
    where: { environmentId: body.environmentId },
    orderBy: { seq: "desc" },
  });
  if (last && body.sha) {
    const plan = await c.get("db").changePlan.findFirst({
      where: { environmentId: body.environmentId, gitCommit: body.sha },
    });
    if (plan) {
      await c.get("db").lineageLink.create({
        data: { changePlanId: plan.id, kind: "deployment", ref: event.id },
      });
    }
  }
  return c.json({ event, attributedRuntimeVersion: last?.id ?? null });
});

integrationRoutes.post("/paging", async (c) => {
  const body = z.object({ provider: z.string(), config: z.record(z.unknown()) }).parse(await c.req.json());
  const row = await c.get("db").pagingIntegration.create({
    data: { organizationId: c.get("organizationId")!, provider: body.provider, config: body.config as object },
  });
  return c.json(row, 201);
});

integrationRoutes.get("/lineage/:changePlanId", async (c) => {
  const plan = await c.get("db").changePlan.findFirst({
    where: { id: c.req.param("changePlanId"), organizationId: c.get("organizationId")! },
    include: { lineageLinks: true, simulation: true, rollouts: true, incidents: true },
  });
  if (!plan) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({
    chain: [
      { step: "git_commit", ref: plan.gitCommit },
      { step: "deployment", refs: plan.lineageLinks.filter((l) => l.kind === "deployment") },
      { step: "runtime_change", id: plan.id },
      { step: "simulation", id: plan.simulationId },
      { step: "rollout", items: plan.rollouts },
      { step: "incidents", items: plan.incidents },
    ],
  });
});
