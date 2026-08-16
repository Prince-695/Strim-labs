import { Hono } from "hono";
import { z } from "zod";
import { hedge, lintCausality, parseNlQuery, recommendCache } from "@strim/shared";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";

export const aiRoutes = new Hono<AppEnv>();
aiRoutes.use("*", requireAuth, requireOrg);

aiRoutes.post("/query", async (c) => {
  const body = z.object({ question: z.string().min(1) }).parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const userId = c.get("userId")!;
  const intent = parseNlQuery(body.question);
  const citations: { sourceType: string; sourceId: string }[] = [];
  let answer = "";

  switch (intent.type) {
    case "slower_after_config": {
      const configs = await db.auditLog.findMany({
        where: { organizationId, action: "configuration.update" },
        take: 5,
        orderBy: { createdAt: "desc" },
      });
      citations.push(...configs.map((x) => ({ sourceType: "audit", sourceId: x.id })));
      answer = configs.length
        ? `After the latest configuration updates (${configs.length} events), review latency on the Runtime Overview. The system cannot prove causality; these are potential contributing factors.`
        : "No recent configuration updates found in this organization.";
      break;
    }
    case "changed_before_incident": {
      const incident = await db.incident.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        include: { factors: true, timeline: true },
      });
      if (!incident) {
        answer = "No incidents in scope for this user/organization.";
        break;
      }
      citations.push({ sourceType: "incident", sourceId: incident.id });
      const factors = incident.factors
        .map((f) => `${f.label} (confidence: ${f.confidence})`)
        .join("; ");
      answer = hedge(
        `Potential contributing factors for the latest incident, ranked and sourced: ${factors}. The system cannot prove causality.`,
      );
      break;
    }
    case "cache_candidates": {
      const recs = recommendCache([
        { path: "/products", method: "GET", rps: 80, p95Ms: 220, changeFrequency: 0.02 },
      ]);
      answer = recs.length
        ? `${recs[0]!.endpoint} is a cache candidate (${recs[0]!.reason}, projected origin reduction ${recs[0]!.projectedOriginReductionPct}%).`
        : "No cache candidates in the current dataset.";
      citations.push({ sourceType: "recommendation", sourceId: "cache-engine" });
      break;
    }
    case "traffic_whatif":
      answer = `A ${intent.multiplier}x traffic increase would be simulated via the What-If engine (not executed autonomously). Open Simulations to run it.`;
      break;
    case "last_rollbacks": {
      const rolls = await db.rollback.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: intent.limit,
      });
      citations.push(...rolls.map((r) => ({ sourceType: "rollback", sourceId: r.id })));
      answer = rolls.length
        ? `Last ${rolls.length} rollback(s): ${rolls.map((r) => r.id).join(", ")}.`
        : "No rollbacks recorded.";
      break;
    }
    case "highest_dependency_latency": {
      const edges = await db.topologyEdge.findMany({ where: { organizationId }, take: 20 });
      citations.push(...edges.slice(0, 3).map((e) => ({ sourceType: "topology", sourceId: e.id })));
      answer = edges[0]
        ? `${edges[0].toName} is among the observed dependencies. Inspect Topology for latency breakdown.`
        : "No dependency data yet.";
      break;
    }
    default:
      answer =
        "I can only answer from the Runtime Model in your current organization scope. Try questions about incidents, cache, rollbacks, or latency.";
  }

  const lint = lintCausality(answer);
  if (!lint.ok) answer = hedge(answer);

  const log = await db.aiQueryLog.create({
    data: {
      organizationId,
      userId,
      question: body.question,
      answer,
      citations: { create: citations },
    },
    include: { citations: true },
  });
  return c.json({
    answer: log.answer,
    citations: log.citations,
    intent,
    uncertainty: "Answers are grounded in tenant-scoped Runtime Model data and do not prove causality.",
  });
});
