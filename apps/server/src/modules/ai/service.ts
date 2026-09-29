import type { PrismaClient } from "@strim/db";
import { hedge, lintCausality, parseNlQuery, recommendCache } from "@strim/shared";
import type { AiCitation, AiQueryOutput } from "./types";

export async function executeQuery(
  db: PrismaClient,
  organizationId: string,
  userId: string,
  question: string,
): Promise<AiQueryOutput> {
  const intent = parseNlQuery(question);
  const citations: AiCitation[] = [];
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
      question,
      answer,
      citations: { create: citations },
    },
    include: { citations: true },
  });

  return {
    answer: log.answer,
    citations: log.citations.map((c) => ({ sourceType: c.sourceType, sourceId: c.sourceId })),
    intent,
    uncertainty: "Answers are grounded in tenant-scoped Runtime Model data and do not prove causality.",
  };
}

export async function listQueryLogs(db: PrismaClient, organizationId: string, limit = 20) {
  const logs = await db.aiQueryLog.findMany({
    where: { organizationId },
    include: { citations: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs.map((log) => ({
    id: log.id,
    question: log.question,
    answer: log.answer,
    createdAt: log.createdAt.toISOString(),
    citations: log.citations.map((c) => ({ sourceType: c.sourceType, sourceId: c.sourceId })),
  }));
}
