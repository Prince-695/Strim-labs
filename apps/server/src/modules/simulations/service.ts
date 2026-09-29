import type { PrismaClient } from "@strim/db";
import { compareRuns, modelWhatIf } from "@strim/shared";
import { writeAudit } from "../../lib/audit";
import { queue } from "../../lib/queue";
import type {
  ComparisonDelta,
  ComparisonMetrics,
  CreateSimulationInput,
  PassFailEvaluation,
  SimulationRecord,
} from "./types";

const DEFAULT_BASELINE_METRICS: ComparisonMetrics = {
  p95Ms: 420,
  p99Ms: 800,
  errorRate: 0.02,
  originRps: 120,
  cacheHitRate: 0,
};

export async function executeSimulation(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  input: CreateSimulationInput,
) {
  // 1. Verify target environment exists and belongs to this organization
  const env = await db.environment.findFirst({
    where: { id: input.environmentId, organizationId },
  });

  if (!env) {
    throw new Error("ENVIRONMENT_NOT_FOUND");
  }

  // 2. Production isolation guard: simulations must never mutate production runtime state
  if (env.type === "PRODUCTION") {
    throw new Error("PRODUCTION_MUTATION_FORBIDDEN");
  }

  // 3. Resolve baseline metrics
  let baseline: ComparisonMetrics = input.customBaseline ?? { ...DEFAULT_BASELINE_METRICS };

  if (!input.customBaseline) {
    // Derive from recent traffic snapshot or telemetry aggregates if available
    const snapshot = await db.trafficSnapshot.findFirst({
      where: { environmentId: input.environmentId, organizationId },
      orderBy: { createdAt: "desc" },
    });

    const dist = snapshot?.distribution as Array<{ rps?: number }> | null;
    if (dist && Array.isArray(dist) && dist.length > 0) {
      const derivedRps = dist.reduce((acc: number, curr) => acc + (curr.rps ?? 40), 0);
      baseline = {
        ...baseline,
        originRps: Math.round(derivedRps),
      };
    }
  }

  // 4. Create simulation record in running status
  const sim = await db.simulation.create({
    data: {
      organizationId,
      environmentId: input.environmentId,
      scenarioId: input.scenarioId,
      status: "running",
      baseline: baseline as object,
    },
  });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "simulation.create",
    resourceType: "simulation",
    resourceId: sim.id,
    environmentId: input.environmentId,
  });

  queue.publish("SIMULATION_STARTED", {
    organizationId,
    simulationId: sim.id,
    environmentId: input.environmentId,
  });

  // 5. Compute experiment metrics using shared what-if modeling
  const experiment = modelWhatIf(baseline, input.change as Parameters<typeof modelWhatIf>[1]);

  // 6. Compute deltas using shared comparison engine
  const comparison = compareRuns(baseline, experiment);

  // 7. Evaluate pass/fail performance and error gating
  const maxErrorDelta = input.maxErrorRateDeltaPct ?? 20;
  const maxP95Delta = input.maxP95DeltaPct ?? 25;

  const evaluation = evaluateSimulationGate(comparison, maxErrorDelta, maxP95Delta);

  const finalStatus = evaluation.regressed ? "failed" : "completed";

  // 8. Update simulation record with completed results
  const updated = await db.simulation.update({
    where: { id: sim.id },
    data: {
      status: finalStatus,
      baseline: baseline as object,
      experiment: experiment as object,
      comparison: comparison as object,
    },
  });

  queue.publish("SIMULATION_COMPLETED", {
    organizationId,
    simulationId: sim.id,
    status: finalStatus,
    passed: evaluation.passed,
    regressed: evaluation.regressed,
  });

  return {
    ...updated,
    evaluation,
  };
}

export async function listSimulations(
  db: PrismaClient,
  organizationId: string,
  environmentId?: string,
  limit = 50,
) {
  const simulations = await db.simulation.findMany({
    where: {
      organizationId,
      ...(environmentId ? { environmentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return simulations.map((sim) => {
    const comp = sim.comparison as ComparisonDelta[] | null;
    const evaluation = comp ? evaluateSimulationGate(comp, 20, 25) : undefined;
    return {
      ...sim,
      evaluation,
    };
  });
}

export async function getSimulation(db: PrismaClient, organizationId: string, id: string) {
  const sim = await db.simulation.findFirst({
    where: { id, organizationId },
  });

  if (!sim) {
    throw new Error("SIMULATION_NOT_FOUND");
  }

  const comp = sim.comparison as ComparisonDelta[] | null;
  const evaluation = comp ? evaluateSimulationGate(comp, 20, 25) : undefined;

  return {
    ...sim,
    evaluation,
  };
}

export async function deleteSimulation(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
) {
  const sim = await db.simulation.findFirst({
    where: { id, organizationId },
  });

  if (!sim) {
    throw new Error("SIMULATION_NOT_FOUND");
  }

  await db.simulation.delete({
    where: { id },
  });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "simulation.delete",
    resourceType: "simulation",
    resourceId: id,
    environmentId: sim.environmentId,
  });

  return { success: true, message: "Simulation deleted successfully" };
}

/**
 * Evaluates whether experiment deltas breach stability or performance thresholds
 */
function evaluateSimulationGate(
  deltas: ComparisonDelta[],
  maxErrorDeltaPct: number,
  maxP95DeltaPct: number,
): PassFailEvaluation {
  const reasons: string[] = [];
  let regressed = false;

  for (const d of deltas) {
    if (d.metric === "errorRate") {
      if (d.deltaPct > maxErrorDeltaPct) {
        regressed = true;
        reasons.push(`Error rate surged by ${d.deltaPct.toFixed(1)}% (exceeds threshold of +${maxErrorDeltaPct}%)`);
      } else if (d.deltaPct < 0) {
        reasons.push(`Error rate improved by ${Math.abs(d.deltaPct).toFixed(1)}%`);
      }
    }

    if (d.metric === "p95Ms") {
      if (d.deltaPct > maxP95DeltaPct) {
        regressed = true;
        reasons.push(`P95 latency increased by ${d.deltaPct.toFixed(1)}% (exceeds threshold of +${maxP95DeltaPct}%)`);
      } else if (d.deltaPct < 0) {
        reasons.push(`P95 latency improved by ${Math.abs(d.deltaPct).toFixed(1)}%`);
      }
    }

    if (d.metric === "originRps") {
      if (d.deltaPct < 0) {
        reasons.push(`Origin load reduced by ${Math.abs(d.deltaPct).toFixed(1)}%`);
      }
    }

    if (d.metric === "cacheHitRate") {
      if (d.experiment > d.baseline) {
        reasons.push(`Cache hit rate increased to ${(d.experiment * 100).toFixed(0)}%`);
      }
    }
  }

  const passed = !regressed;
  const recommendation = passed
    ? "Simulation passed gate criteria: metrics within safe performance boundaries. Safe to approve for canary rollout."
    : "Simulation failed gate criteria: critical performance or error regression detected. Approval blocked.";

  return {
    passed,
    regressed,
    reasons,
    recommendation,
  };
}
