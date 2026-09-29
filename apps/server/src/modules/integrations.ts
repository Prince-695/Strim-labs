import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { hmacSha256, safeCompare } from "../lib/crypto";

export const integrationRoutes = new Hono<AppEnv>();

// GitHub webhook receiver (public endpoint authenticated via X-Hub-Signature-256)
integrationRoutes.post("/github/webhook", async (c) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const signature = c.req.header("x-hub-signature-256");

  const rawBody = await c.req.text();
  if (secret && signature) {
    const expected = `sha256=${hmacSha256(rawBody, secret)}`;
    if (!safeCompare(signature, expected)) {
      return c.json({ error: "UNAUTHORIZED", message: "Invalid GitHub signature" }, 401);
    }
  }

  let body: {
    repository?: { full_name: string };
    pull_request?: { number: number; head?: { sha: string; ref: string } };
    after?: string;
    ref?: string;
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "BAD_REQUEST", message: "Invalid JSON" }, 400);
  }

  const sha = body.pull_request?.head?.sha ?? body.after;
  const db = c.get("db");
  const organizationId = c.req.header("x-organization-id") ?? c.get("organizationId");
  if (!sha) return c.json({ ignored: true, reason: "No commit sha found" });

  // Match change plan by pull request number or git branch
  const plan = await db.changePlan.findFirst({
    where: {
      organizationId: organizationId || undefined,
      OR: [
        ...(body.pull_request ? [{ gitPullRequest: String(body.pull_request.number) }] : []),
        ...(body.ref ? [{ gitBranch: body.ref.replace("refs/heads/", "") }] : []),
      ],
    },
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

// Authenticated routes (support either session auth or API key)
integrationRoutes.use("/deployments/*", requireOrg);
integrationRoutes.use("/deployments", requireOrg);
integrationRoutes.use("/paging/*", requireAuth, requireOrg);
integrationRoutes.use("/paging", requireAuth, requireOrg);
integrationRoutes.use("/lineage/*", requireOrg);
integrationRoutes.use("/ci/*", requireOrg);

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

integrationRoutes.get("/deployments", async (c) => {
  const environmentId = c.req.query("environmentId");
  const events = await c.get("db").deploymentEvent.findMany({
    where: {
      organizationId: c.get("organizationId")!,
      environmentId: environmentId || undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return c.json({ deployments: events });
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

integrationRoutes.get("/paging", async (c) => {
  const rows = await c.get("db").pagingIntegration.findMany({
    where: { organizationId: c.get("organizationId")! },
  });
  return c.json({ integrations: rows });
});

integrationRoutes.post("/paging", async (c) => {
  const body = z.object({ provider: z.string(), config: z.record(z.unknown()) }).parse(await c.req.json());
  const row = await c.get("db").pagingIntegration.create({
    data: { organizationId: c.get("organizationId")!, provider: body.provider, config: body.config as object },
  });
  return c.json(row, 201);
});

integrationRoutes.delete("/paging/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.get("db").pagingIntegration.findFirst({
    where: { id, organizationId: c.get("organizationId")! },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  await c.get("db").pagingIntegration.delete({ where: { id } });
  return c.json({ ok: true });
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

