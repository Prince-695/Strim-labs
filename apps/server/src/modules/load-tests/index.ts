import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { roleAtLeast, type Role } from "@strim/shared";
import { loadEngine } from "../../engine/runner";
import {
  CuidSchema,
  CreateTestRunSchema,
  UpdateTestRunSchema,
  TestRunSchema,
  TestSampleSchema,
  TestResultsSchema,
  TestErrorsSchema,
  TestResourcesSchema,
  TestArtifactsSchema,
  BreakingPointSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  PaginationQuerySchema,
} from "../../lib/schemas";

function checkRole(c: any, minRole: Role) {
  const role = c.get("role") as Role | undefined;
  if (!role || !roleAtLeast(role, minRole)) {
    return c.json(
      {
        code: "FORBIDDEN",
        message: `Requires ${minRole} or higher role in this organization`,
      },
      403
    );
  }
  return null;
}

function toTestRunResponse(run: any) {
  return {
    id: run.id,
    projectId: run.projectId,
    userId: run.userId ?? null,
    name: run.name,
    description: run.description ?? null,
    profile: run.profile,
    status: run.status,
    targetUrl: run.targetUrl,
    method: run.method,
    concurrency: run.concurrency,
    durationSec: run.durationSec,
    totalRequests: run.totalRequests,
    avgRps: run.avgRps,
    peakRps: run.peakRps,
    p50Ms: run.p50Ms,
    p95Ms: run.p95Ms,
    p99Ms: run.p99Ms,
    errorRate: run.errorRate,
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

const ListTestRunsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "ABORTED"]).optional(),
});

// ─── Route Definitions ────────────────────────────────────────────────────────

const listRunsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Load Testing"],
  summary: "List load test runs",
  request: {
    query: ListTestRunsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            runs: z.array(TestRunSchema),
            total: z.number(),
          }),
        },
      },
      description: "List of test runs",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
  },
});

const createRunRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Load Testing"],
  summary: "Create load test configuration",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateTestRunSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: TestRunSchema,
        },
      },
      description: "Test run created",
    },
    400: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Bad request" },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Project not found" },
  },
});

const getRunRoute = createRoute({
  method: "get",
  path: "/:testId",
  tags: ["Load Testing"],
  summary: "Get load test run detail",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: TestRunSchema,
        },
      },
      description: "Test run detail",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const updateRunRoute = createRoute({
  method: "patch",
  path: "/:testId",
  tags: ["Load Testing"],
  summary: "Update load test configuration",
  request: {
    params: z.object({ testId: CuidSchema }),
    body: {
      content: {
        "application/json": {
          schema: UpdateTestRunSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: TestRunSchema,
        },
      },
      description: "Test run updated",
    },
    400: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Bad request" },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const deleteRunRoute = createRoute({
  method: "delete",
  path: "/:testId",
  tags: ["Load Testing"],
  summary: "Delete load test run",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessResponseSchema,
        },
      },
      description: "Test run deleted",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const startRunRoute = createRoute({
  method: "post",
  path: "/:testId/start",
  tags: ["Load Testing"],
  summary: "Start executing a load test",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    202: {
      content: {
        "application/json": {
          schema: TestRunSchema,
        },
      },
      description: "Load test execution started",
    },
    400: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Already running or completed" },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const cancelRunRoute = createRoute({
  method: "post",
  path: "/:testId/cancel",
  tags: ["Load Testing"],
  summary: "Cancel or abort active load test",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessResponseSchema,
        },
      },
      description: "Load test cancelled",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const cloneRunRoute = createRoute({
  method: "post",
  path: "/:testId/clone",
  tags: ["Load Testing"],
  summary: "Clone a load test configuration",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: TestRunSchema,
        },
      },
      description: "Test run cloned",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const getResultsRoute = createRoute({
  method: "get",
  path: "/:testId/results",
  tags: ["Load Testing"],
  summary: "Get load test execution results",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: TestResultsSchema,
        },
      },
      description: "Load test results",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const getTimelineRoute = createRoute({
  method: "get",
  path: "/:testId/timeline",
  tags: ["Load Testing"],
  summary: "Get time-series samples recorded during test",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(TestSampleSchema),
        },
      },
      description: "Time-series samples",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const getErrorsRoute = createRoute({
  method: "get",
  path: "/:testId/errors",
  tags: ["Load Testing"],
  summary: "Get error distribution and failure analysis",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: TestErrorsSchema,
        },
      },
      description: "Error analysis",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const getResourcesRoute = createRoute({
  method: "get",
  path: "/:testId/resources",
  tags: ["Load Testing"],
  summary: "Get VU concurrency and resource telemetry during test",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: TestResourcesSchema,
        },
      },
      description: "Test resources and VU concurrency",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const getDiagnosticsRoute = createRoute({
  method: "get",
  path: "/:testId/diagnostics",
  tags: ["Load Testing"],
  summary: "Get breaking point detection and bottleneck diagnosis",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: BreakingPointSchema,
        },
      },
      description: "Breaking point diagnosis",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found or no diagnosis available" },
  },
});

const getArtifactsRoute = createRoute({
  method: "get",
  path: "/:testId/artifacts",
  tags: ["Load Testing"],
  summary: "Get test execution artifacts and logs",
  request: {
    params: z.object({ testId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: TestArtifactsSchema,
        },
      },
      description: "Execution artifacts",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

// ─── Module Router ────────────────────────────────────────────────────────────

export const loadTestsRoutes = new OpenAPIHono<AppEnv>();

loadTestsRoutes.use("*", requireAuth, requireOrg);

// List test runs
loadTestsRoutes.openapi(listRunsRoute, async (c) => {
  const roleError = checkRole(c, "VIEWER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const db = c.get("db");
  const { page, limit, status } = c.req.valid("query");

  const where = {
    organizationId,
    projectId,
    ...(status ? { status } : {}),
  };

  const [runs, total] = await Promise.all([
    db.testRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.testRun.count({ where }),
  ]);

  return c.json(
    {
      runs: runs.map(toTestRunResponse),
      total,
    },
    200
  );
});

// Create test run config
loadTestsRoutes.openapi(createRunRoute, async (c) => {
  const roleError = checkRole(c, "ENGINEER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const userId = c.get("userId");
  const body = c.req.valid("json");
  const db = c.get("db");

  const project = await db.project.findFirst({
    where: { id: projectId, organizationId },
  });

  if (!project) {
    return c.json({ code: "NOT_FOUND", message: "Project not found" }, 404);
  }

  const run = await db.testRun.create({
    data: {
      organizationId,
      projectId,
      userId,
      name: body.name,
      description: body.description ?? null,
      targetUrl: body.targetUrl,
      method: body.method,
      headers: body.headers ? (body.headers as object) : undefined,
      body: body.body ? (body.body as object) : undefined,
      profile: body.profile,
      concurrency: body.concurrency,
      durationSec: body.durationSec,
      rampUpSec: body.rampUpSec,
      status: "QUEUED",
    },
  });

  return c.json(toTestRunResponse(run), 201);
});

// Get run detail
loadTestsRoutes.openapi(getRunRoute, async (c) => {
  const roleError = checkRole(c, "VIEWER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const run = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
  });

  if (!run) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  return c.json(toTestRunResponse(run), 200);
});

// Update test run
loadTestsRoutes.openapi(updateRunRoute, async (c) => {
  const roleError = checkRole(c, "ENGINEER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
  });

  if (!existing) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  if (existing.status === "RUNNING") {
    return c.json(
      { code: "BAD_REQUEST", message: "Cannot edit configuration of an actively running test" },
      400
    );
  }

  const updated = await db.testRun.update({
    where: { id: testId },
    data: {
      name: body.name ?? undefined,
      description: body.description ?? undefined,
      headers: body.headers ? (body.headers as object) : undefined,
      body: body.body ? (body.body as object) : undefined,
      profile: body.profile ?? undefined,
      concurrency: body.concurrency ?? undefined,
      durationSec: body.durationSec ?? undefined,
      rampUpSec: body.rampUpSec ?? undefined,
    },
  });

  return c.json(toTestRunResponse(updated), 200);
});

// Delete test run
loadTestsRoutes.openapi(deleteRunRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const existing = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
  });

  if (!existing) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  if (existing.status === "RUNNING") {
    loadEngine.abort(testId);
  }

  await db.testRun.delete({ where: { id: testId } });

  return c.json({ success: true, message: "Test run deleted" }, 200);
});

// Start test run
loadTestsRoutes.openapi(startRunRoute, async (c) => {
  const roleError = checkRole(c, "ENGINEER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const run = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
  });

  if (!run) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  if (run.status === "RUNNING") {
    return c.json({ code: "BAD_REQUEST", message: "Test is already running" }, 400);
  }

  const updatedRun = await db.testRun.update({
    where: { id: testId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      completedAt: null,
    },
  });

  // Launch async load engine execution
  setTimeout(() => {
    loadEngine
      .execute(db, {
        testRunId: run.id,
        organizationId,
        projectId,
        targetUrl: run.targetUrl,
        method: run.method,
        headers: (run.headers as Record<string, string>) ?? undefined,
        body: run.body ?? undefined,
        concurrency: run.concurrency,
        durationSec: run.durationSec,
        profile: run.profile as any,
      })
      .catch((err) => {
        console.error(`[LoadEngine] Test execution failed for ${run.id}:`, err);
      });
  }, 10);

  return c.json(toTestRunResponse(updatedRun), 202);
});

// Cancel test run
loadTestsRoutes.openapi(cancelRunRoute, async (c) => {
  const roleError = checkRole(c, "ENGINEER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const run = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
  });

  if (!run) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  const aborted = loadEngine.abort(testId);
  await db.testRun.update({
    where: { id: testId },
    data: {
      status: "ABORTED",
      completedAt: new Date(),
    },
  });

  return c.json(
    { success: true, message: aborted ? "Test aborted successfully" : "Test marked as aborted" },
    200
  );
});

// Clone test run
loadTestsRoutes.openapi(cloneRunRoute, async (c) => {
  const roleError = checkRole(c, "ENGINEER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const userId = c.get("userId");
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const original = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
  });

  if (!original) {
    return c.json({ code: "NOT_FOUND", message: "Original test run not found" }, 404);
  }

  const cloned = await db.testRun.create({
    data: {
      organizationId,
      projectId,
      userId,
      name: `${original.name} (Copy)`,
      description: original.description,
      targetUrl: original.targetUrl,
      method: original.method,
      headers: original.headers as object,
      body: original.body as object,
      profile: original.profile,
      concurrency: original.concurrency,
      durationSec: original.durationSec,
      rampUpSec: original.rampUpSec,
      status: "QUEUED",
    },
  });

  return c.json(toTestRunResponse(cloned), 201);
});

// Get test results
loadTestsRoutes.openapi(getResultsRoute, async (c) => {
  const roleError = checkRole(c, "VIEWER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const run = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
  });

  if (!run) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  const statusCodes = (run.statusCodes as Record<string, number>) ?? {};
  const breakingPoint = (run.breakingPoint as any) ?? null;
  const diagnostics = run.diagnostics ? JSON.stringify(run.diagnostics) : null;

  return c.json(
    {
      runId: run.id,
      status: run.status,
      summary: {
        totalRequests: run.totalRequests,
        avgRps: run.avgRps,
        peakRps: run.peakRps,
        avgLatencyMs: run.p50Ms,
        p50LatencyMs: run.p50Ms,
        p95LatencyMs: run.p95Ms,
        p99LatencyMs: run.p99Ms,
        errorRate: run.errorRate,
        errorCount: Math.round(run.totalRequests * run.errorRate),
      },
      statusCodes,
      breakingPoint,
      diagnostics,
    },
    200
  );
});

// Get timeline samples
loadTestsRoutes.openapi(getTimelineRoute, async (c) => {
  const roleError = checkRole(c, "VIEWER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const run = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
    select: { id: true },
  });

  if (!run) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  const samples = await db.testSample.findMany({
    where: { testRunId: testId },
    orderBy: { timestamp: "asc" },
  });

  return c.json(
    samples.map((s) => ({
      id: s.id,
      timestamp: s.timestamp.toISOString(),
      rps: s.rps,
      activeVUs: s.activeVUs,
      p50Ms: s.p50Ms,
      p95Ms: s.p95Ms,
      p99Ms: s.p99Ms,
      errorCount: s.errorCount,
      statusCodes: (s.statusCodes as Record<string, number>) ?? {},
    })),
    200
  );
});

// Get errors analysis
loadTestsRoutes.openapi(getErrorsRoute, async (c) => {
  const roleError = checkRole(c, "VIEWER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const run = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
    include: {
      samples: {
        where: { errorCount: { gt: 0 } },
        orderBy: { timestamp: "desc" },
        take: 50,
      },
    },
  });

  if (!run) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  const statusCodes = (run.statusCodes as Record<string, number>) ?? {};
  const totalErrors = Math.round(run.totalRequests * run.errorRate);

  const recentErrors = run.samples.map((s) => {
    const sc = (s.statusCodes as Record<string, number>) ?? {};
    const errorCodes = Object.entries(sc).filter(([code]) => code.startsWith("4") || code.startsWith("5"));
    const primaryCode = errorCodes[0] ? Number(errorCodes[0][0]) : 500;
    return {
      timestamp: s.timestamp.toISOString(),
      statusCode: primaryCode,
      count: s.errorCount,
    };
  });

  return c.json(
    {
      runId: run.id,
      totalErrors,
      errorRate: run.errorRate,
      statusCodes,
      recentErrors,
    },
    200
  );
});

// Get resources telemetry
loadTestsRoutes.openapi(getResourcesRoute, async (c) => {
  const roleError = checkRole(c, "VIEWER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const run = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
    select: { id: true },
  });

  if (!run) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  const samples = await db.testSample.findMany({
    where: { testRunId: testId },
    orderBy: { timestamp: "asc" },
  });

  return c.json(
    {
      runId: testId,
      samples: samples.map((s) => ({
        timestamp: s.timestamp.toISOString(),
        activeVUs: s.activeVUs,
        rps: s.rps,
      })),
    },
    200
  );
});

// Get diagnostics breaking point
loadTestsRoutes.openapi(getDiagnosticsRoute, async (c) => {
  const roleError = checkRole(c, "VIEWER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const run = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
  });

  if (!run) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  if (!run.breakingPoint) {
    return c.json(
      { code: "NOT_FOUND", message: "No breaking point analysis available for this run" },
      404
    );
  }

  const bp = run.breakingPoint as any;
  return c.json(
    {
      kneeRps: bp.kneeRps ?? 0,
      failureRps: bp.failureRps ?? 0,
      sustainableRps: bp.sustainableRps ?? 0,
      bottleneck: bp.bottleneck ?? "NONE",
      verdict: bp.verdict ?? "Analysis complete",
      zone: bp.zone ?? "SAFE",
    },
    200
  );
});

// Get artifacts
loadTestsRoutes.openapi(getArtifactsRoute, async (c) => {
  const roleError = checkRole(c, "VIEWER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId") as string;
  const { testId } = c.req.valid("param");
  const db = c.get("db");

  const run = await db.testRun.findFirst({
    where: { id: testId, projectId, organizationId },
  });

  if (!run) {
    return c.json({ code: "NOT_FOUND", message: "Test run not found" }, 404);
  }

  const logs = [
    `[${run.createdAt.toISOString()}] Test run '${run.name}' created with profile ${run.profile}`,
    ...(run.startedAt ? [`[${run.startedAt.toISOString()}] Execution started against ${run.targetUrl}`] : []),
    ...(run.completedAt ? [`[${run.completedAt.toISOString()}] Execution finished with status ${run.status}`] : []),
    `[Summary] Total requests: ${run.totalRequests}, Avg RPS: ${run.avgRps}, P95: ${run.p95Ms}ms, Error rate: ${(run.errorRate * 100).toFixed(2)}%`,
  ];

  return c.json(
    {
      runId: run.id,
      logs,
      config: {
        name: run.name,
        targetUrl: run.targetUrl,
        method: run.method,
        concurrency: run.concurrency,
        durationSec: run.durationSec,
        rampUpSec: run.rampUpSec,
        profile: run.profile,
        headers: run.headers,
      },
      exportedAt: new Date().toISOString(),
    },
    200
  );
});

// SSE Live Stream Endpoint
loadTestsRoutes.get("/:testId/stream", async (c) => {
  const testId = c.req.param("testId");
  const organizationId = c.get("organizationId")!;
  const db = c.get("db");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const run = await db.testRun.findFirst({ where: { id: testId, organizationId } });
      if (run && (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "ABORTED")) {
        const eventName = run.status === "ABORTED" ? "abort" : "done";
        controller.enqueue(
          encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify({ run: { id: testId, status: run.status } })}\n\n`)
        );
        try {
          controller.close();
        } catch {
          // ignore
        }
        return;
      }

      const unsubscribe = loadEngine.subscribe(testId, (event) => {
        try {
          if (event.type === "sample") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event.metric)}\n\n`));
          } else if (event.type === "done") {
            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ run: { id: testId } })}\n\n`));
            controller.close();
          } else if (event.type === "abort") {
            controller.enqueue(encoder.encode(`event: abort\ndata: ${JSON.stringify({ runId: testId })}\n\n`));
            controller.close();
          }
        } catch {
          // ignore
        }
      });

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

  return c.newResponse(stream, 200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
});
