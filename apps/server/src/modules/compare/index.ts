import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requireOrg } from "../../middleware/tenant";
import { compareRuns } from "@strim/shared";

export const compareRoutes = new Hono<AppEnv>();

compareRoutes.use("*", requireOrg);

compareRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const runAId = c.req.query("runA");
  const runBId = c.req.query("runB");

  if (!runAId || !runBId) {
    return c.json({ error: "VALIDATION", message: "Both runA and runB query parameters are required" }, 400);
  }

  const db = c.get("db");

  const [runA, runB] = await Promise.all([
    db.testRun.findFirst({ where: { id: runAId, organizationId } }),
    db.testRun.findFirst({ where: { id: runBId, organizationId } }),
  ]);

  if (!runA || !runB) {
    return c.json({ error: "NOT_FOUND", message: "One or both test runs were not found" }, 404);
  }

  const comparison = compareRuns(
    {
      id: runA.id,
      name: runA.name,
      avgRps: runA.avgRps,
      p95Ms: runA.p95Ms,
      errorRate: runA.errorRate,
      peakRps: runA.peakRps,
    },
    {
      id: runB.id,
      name: runB.name,
      avgRps: runB.avgRps,
      p95Ms: runB.p95Ms,
      errorRate: runB.errorRate,
      peakRps: runB.peakRps,
    },
  );

  return c.json({ comparison });
});
