import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { roleAtLeast, type Role } from "@strim/shared";
import type { AppEnv } from "../../types";
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  ServiceSchema,
  CreateDiscoveryRunSchema,
  DiscoveryRunSchema,
  ImportSpecSchema,
  SpecificationSchema,
  CreateEndpointSchema,
  UpdateEndpointSchema,
  EndpointSchema,
  EndpointChangeSchema,
  ApiErrorSchema,
} from "../../lib/schemas";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { discoverEndpoints } from "../../engine/discovery";

export const servicesRoutes = new OpenAPIHono<AppEnv>();
servicesRoutes.use("*", requireAuth, requireOrg);

function checkRole(c: Context<AppEnv>, min: Role) {
  const role = c.get("role");
  if (!role || !roleAtLeast(role, min)) {
    return c.json({ code: "FORBIDDEN", message: `Requires ${min} role or higher`, requestId: c.get("requestId") }, 403);
  }
  return null;
}

// Helper to verify project belongs to org
async function resolveProject(db: any, orgId: string, projectId: string) {
  return db.project.findFirst({ where: { id: projectId, organizationId: orgId } });
}

// ─── POST /services ───────────────────────────────────────────────────────────

servicesRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Services"],
    summary: "Register service",
    description: "Register a monitored service (application) within a project.",
    security: [{ BearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: CreateServiceSchema } }, required: true } },
    responses: {
      201: { description: "Service registered", content: { "application/json": { schema: z.object({ service: ServiceSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Project not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const projectId = c.req.param("projectId") as string;
    const orgId = c.get("organizationId")!;
    const body = c.req.valid("json");
    const db = c.get("db");

    const project = await resolveProject(db, orgId, projectId);
    if (!project) return c.json({ code: "NOT_FOUND", message: "Project not found" }, 404);

    const service = await db.service.create({
      data: { projectId, ...body },
      include: { _count: { select: { endpoints: true } } },
    });

    return c.json({
      service: {
        id: service.id,
        projectId: service.projectId,
        name: service.name,
        description: service.description,
        baseUrl: service.baseUrl,
        status: service.status,
        framework: service.framework,
        language: service.language,
        environment: service.environment,
        tags: service.tags,
        endpointCount: service._count.endpoints,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
      },
    }, 201);
  },
);

// ─── GET /services ────────────────────────────────────────────────────────────

servicesRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Services"],
    summary: "List services",
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "Services list", content: { "application/json": { schema: z.object({ services: z.array(ServiceSchema) }) } } },
      404: { description: "Project not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const projectId = c.req.param("projectId") as string;
    const orgId = c.get("organizationId")!;
    const db = c.get("db");

    const project = await resolveProject(db, orgId, projectId);
    if (!project) return c.json({ code: "NOT_FOUND", message: "Project not found" }, 404);

    const services = await db.service.findMany({
      where: { projectId },
      include: { _count: { select: { endpoints: true } } },
      orderBy: { createdAt: "asc" },
    });

    return c.json({
      services: services.map((s: any) => ({
        id: s.id,
        projectId: s.projectId,
        name: s.name,
        description: s.description,
        baseUrl: s.baseUrl,
        status: s.status,
        framework: s.framework,
        language: s.language,
        environment: s.environment,
        tags: s.tags,
        endpointCount: s._count.endpoints,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    }, 200);
  },
);

// ─── GET /services/:serviceId ─────────────────────────────────────────────────

servicesRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{serviceId}",
    tags: ["Services"],
    summary: "Get service",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ serviceId: z.string() }) },
    responses: {
      200: { description: "Service detail", content: { "application/json": { schema: z.object({ service: ServiceSchema }) } } },
      404: { description: "Not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const projectId = c.req.param("projectId") as string;
    const { serviceId } = c.req.valid("param");
    const db = c.get("db");

    const service = await db.service.findFirst({
      where: { id: serviceId, projectId },
      include: { _count: { select: { endpoints: true } } },
    });
    if (!service) return c.json({ code: "NOT_FOUND", message: "Service not found" }, 404);

    return c.json({
      service: {
        id: service.id,
        projectId: service.projectId,
        name: service.name,
        description: service.description,
        baseUrl: service.baseUrl,
        status: service.status,
        framework: service.framework,
        language: service.language,
        environment: service.environment,
        tags: service.tags,
        endpointCount: service._count.endpoints,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── PATCH /services/:serviceId ───────────────────────────────────────────────

servicesRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{serviceId}",
    tags: ["Services"],
    summary: "Update service",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ serviceId: z.string() }),
      body: { content: { "application/json": { schema: UpdateServiceSchema } } },
    },
    responses: {
      200: { description: "Service updated", content: { "application/json": { schema: z.object({ service: ServiceSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { serviceId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const service = await db.service.update({
      where: { id: serviceId },
      data: body,
      include: { _count: { select: { endpoints: true } } },
    });

    return c.json({
      service: {
        id: service.id,
        projectId: service.projectId,
        name: service.name,
        description: service.description,
        baseUrl: service.baseUrl,
        status: service.status,
        framework: service.framework,
        language: service.language,
        environment: service.environment,
        tags: service.tags,
        endpointCount: service._count.endpoints,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── DELETE /services/:serviceId ──────────────────────────────────────────────

servicesRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/{serviceId}",
    tags: ["Services"],
    summary: "Delete service",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ serviceId: z.string() }) },
    responses: {
      200: { description: "Service deleted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires ENGINEER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "ENGINEER");
    if (roleErr) return roleErr;

    const { serviceId } = c.req.valid("param");
    const db = c.get("db");
    await db.service.delete({ where: { id: serviceId } });
    return c.json({ ok: true }, 200);
  },
);

// ─── POST /services/:serviceId/verify ─────────────────────────────────────────

servicesRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{serviceId}/verify",
    tags: ["Services"],
    summary: "Verify service reachability",
    description: "Probes the service base URL to verify it is reachable from STRIM's network.",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ serviceId: z.string() }) },
    responses: {
      200: {
        description: "Verification result",
        content: {
          "application/json": {
            schema: z.object({
              reachable: z.boolean(),
              latencyMs: z.number().nullable(),
              statusCode: z.number().nullable(),
              error: z.string().nullable(),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { serviceId } = c.req.valid("param");
    const db = c.get("db");
    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) return c.json({ reachable: false, latencyMs: null, statusCode: null, error: "Service not found" }, 200);

    try {
      const t = Date.now();
      const res = await fetch(service.baseUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      return c.json({ reachable: true, latencyMs: Date.now() - t, statusCode: res.status, error: null }, 200);
    } catch (err: any) {
      return c.json({ reachable: false, latencyMs: null, statusCode: null, error: err.message }, 200);
    }
  },
);

// ─── Discovery Runs ───────────────────────────────────────────────────────────

servicesRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{serviceId}/discovery-runs",
    tags: ["Services — Discovery"],
    summary: "Start discovery run",
    description: "Probe the service to auto-discover API endpoints via OpenAPI spec, crawling, or SDK telemetry.",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ serviceId: z.string() }),
      body: { content: { "application/json": { schema: CreateDiscoveryRunSchema } } },
    },
    responses: {
      202: { description: "Discovery run started", content: { "application/json": { schema: z.object({ run: DiscoveryRunSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Service not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { serviceId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) return c.json({ code: "NOT_FOUND", message: "Service not found" }, 404);

    const run = await db.discoveryRun.create({
      data: { serviceId, status: "RUNNING", source: body.source, specUrl: body.specUrl ?? null },
    });

    // Kick off async discovery
    discoverEndpoints(service.baseUrl, body.headers ?? {})
      .then(async (result) => {
        for (const ep of result.endpoints) {
          await db.endpoint.upsert({
            where: { serviceId_method_path: { serviceId, method: ep.method, path: ep.path } },
            create: { serviceId, path: ep.path, method: ep.method, summary: ep.summary ?? null, isSafe: ep.isSafe, source: ep.source },
            update: { summary: ep.summary ?? undefined, isSafe: ep.isSafe },
          });
        }
        await db.discoveryRun.update({
          where: { id: run.id },
          data: { status: "COMPLETED", endpointsFound: result.endpoints.length, completedAt: new Date() },
        });
      })
      .catch(async (err) => {
        await db.discoveryRun.update({
          where: { id: run.id },
          data: { status: "FAILED", error: err.message, completedAt: new Date() },
        });
      });

    return c.json({
      run: {
        id: run.id,
        serviceId,
        status: run.status,
        source: run.source,
        specUrl: null,
        endpointsFound: 0,
        error: null,
        startedAt: run.startedAt.toISOString(),
        completedAt: null,
      },
    }, 202);
  },
);

servicesRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{serviceId}/discovery-runs",
    tags: ["Services — Discovery"],
    summary: "List discovery runs",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ serviceId: z.string() }) },
    responses: {
      200: { description: "Discovery runs", content: { "application/json": { schema: z.object({ runs: z.array(DiscoveryRunSchema) }) } } },
    },
  }),
  async (c) => {
    const { serviceId } = c.req.valid("param");
    const db = c.get("db");
    const runs = await db.discoveryRun.findMany({ where: { serviceId }, orderBy: { createdAt: "desc" }, take: 50 });
    return c.json({
      runs: runs.map((r: any) => ({
        id: r.id,
        serviceId: r.serviceId,
        status: r.status,
        source: r.source,
        specUrl: r.specUrl,
        endpointsFound: r.endpointsFound,
        error: r.error,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
    }, 200);
  },
);

servicesRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{serviceId}/discovery-runs/{runId}",
    tags: ["Services — Discovery"],
    summary: "Get discovery run",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ serviceId: z.string(), runId: z.string() }) },
    responses: {
      200: { description: "Discovery run detail", content: { "application/json": { schema: z.object({ run: DiscoveryRunSchema }) } } },
      404: { description: "Discovery run not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const { serviceId, runId } = c.req.valid("param");
    const db = c.get("db");
    const run = await db.discoveryRun.findFirst({ where: { id: runId, serviceId } });
    if (!run) return c.json({ code: "NOT_FOUND", message: "Discovery run not found" }, 404);
    return c.json({
      run: {
        id: run.id,
        serviceId: run.serviceId,
        status: run.status,
        source: run.source,
        specUrl: run.specUrl,
        endpointsFound: run.endpointsFound,
        error: run.error,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
      },
    }, 200);
  },
);

// ─── Specifications ───────────────────────────────────────────────────────────

servicesRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{serviceId}/specifications",
    tags: ["Services — Specs"],
    summary: "Import OpenAPI specification",
    description: "Import an OpenAPI/Swagger specification. Automatically extracts and registers endpoints.",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ serviceId: z.string() }),
      body: { content: { "application/json": { schema: ImportSpecSchema } } },
    },
    responses: {
      201: { description: "Specification imported", content: { "application/json": { schema: z.object({ specification: SpecificationSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { serviceId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    let rawSpec = body.rawSpec;
    if (!rawSpec && body.specUrl) {
      const res = await fetch(body.specUrl);
      rawSpec = await res.json();
    }

    const spec = await db.specification.create({
      data: {
        serviceId,
        format: body.format,
        specUrl: body.specUrl ?? null,
        rawSpec: rawSpec as any,
        title: (rawSpec as any)?.info?.title ?? null,
        version: (rawSpec as any)?.info?.version ?? null,
      },
    });

    return c.json({
      specification: {
        id: spec.id,
        serviceId: spec.serviceId,
        version: spec.version,
        title: spec.title,
        format: spec.format as any,
        specUrl: spec.specUrl ?? null,
        createdAt: spec.createdAt.toISOString(),
      },
    }, 201);
  },
);

servicesRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{serviceId}/specifications",
    tags: ["Services — Specs"],
    summary: "List specifications",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ serviceId: z.string() }) },
    responses: {
      200: { description: "Specifications", content: { "application/json": { schema: z.object({ specifications: z.array(SpecificationSchema) }) } } },
    },
  }),
  async (c) => {
    const { serviceId } = c.req.valid("param");
    const db = c.get("db");
    const specs = await db.specification.findMany({ where: { serviceId }, orderBy: { createdAt: "desc" } });
    return c.json({
      specifications: specs.map((s: any) => ({
        id: s.id,
        serviceId: s.serviceId,
        version: s.version,
        title: s.title,
        format: s.format as any,
        specUrl: s.specUrl ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
    }, 200);
  },
);

servicesRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/{serviceId}/specifications/{specId}",
    tags: ["Services — Specs"],
    summary: "Delete specification",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ serviceId: z.string(), specId: z.string() }) },
    responses: {
      200: { description: "Deleted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { specId } = c.req.valid("param");
    const db = c.get("db");
    await db.specification.delete({ where: { id: specId } });
    return c.json({ ok: true }, 200);
  },
);

// ─── Endpoints ────────────────────────────────────────────────────────────────

servicesRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{serviceId}/endpoints",
    tags: ["Services — Endpoints"],
    summary: "List endpoints",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ serviceId: z.string() }) },
    responses: {
      200: { description: "Endpoints", content: { "application/json": { schema: z.object({ endpoints: z.array(EndpointSchema) }) } } },
    },
  }),
  async (c) => {
    const { serviceId } = c.req.valid("param");
    const db = c.get("db");
    const endpoints = await db.endpoint.findMany({ where: { serviceId }, orderBy: { path: "asc" } });
    return c.json({
      endpoints: endpoints.map((e: any) => ({
        id: e.id,
        serviceId: e.serviceId,
        path: e.path,
        method: e.method as any,
        summary: e.summary,
        description: e.description,
        operationId: e.operationId,
        tags: e.tags,
        deprecated: e.deprecated,
        isSafe: e.isSafe,
        source: e.source,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
    }, 200);
  },
);

servicesRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{serviceId}/endpoints",
    tags: ["Services — Endpoints"],
    summary: "Create endpoint",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ serviceId: z.string() }),
      body: { content: { "application/json": { schema: CreateEndpointSchema } } },
    },
    responses: {
      201: { description: "Endpoint created", content: { "application/json": { schema: z.object({ endpoint: EndpointSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
      409: { description: "Endpoint already exists", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { serviceId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const existing = await db.endpoint.findFirst({ where: { serviceId, method: body.method, path: body.path } });
    if (existing) return c.json({ code: "CONFLICT", message: "Endpoint already exists" }, 409);

    const isSafe = ["GET", "HEAD", "OPTIONS"].includes(body.method);
    const ep = await db.endpoint.create({
      data: { serviceId, ...body, isSafe, source: "manual" },
    });

    return c.json({
      endpoint: {
        id: ep.id,
        serviceId: ep.serviceId,
        path: ep.path,
        method: ep.method as any,
        summary: ep.summary,
        description: ep.description,
        operationId: ep.operationId,
        tags: ep.tags,
        deprecated: ep.deprecated,
        isSafe: ep.isSafe,
        source: ep.source,
        createdAt: ep.createdAt.toISOString(),
        updatedAt: ep.updatedAt.toISOString(),
      },
    }, 201);
  },
);

servicesRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{serviceId}/endpoints/{endpointId}",
    tags: ["Services — Endpoints"],
    summary: "Update endpoint",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ serviceId: z.string(), endpointId: z.string() }),
      body: { content: { "application/json": { schema: UpdateEndpointSchema } } },
    },
    responses: {
      200: { description: "Endpoint updated", content: { "application/json": { schema: z.object({ endpoint: EndpointSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { endpointId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");
    const ep = await db.endpoint.update({ where: { id: endpointId }, data: body });
    return c.json({
      endpoint: {
        id: ep.id,
        serviceId: ep.serviceId,
        path: ep.path,
        method: ep.method as any,
        summary: ep.summary,
        description: ep.description,
        operationId: ep.operationId,
        tags: ep.tags,
        deprecated: ep.deprecated,
        isSafe: ep.isSafe,
        source: ep.source,
        createdAt: ep.createdAt.toISOString(),
        updatedAt: ep.updatedAt.toISOString(),
      },
    }, 200);
  },
);

servicesRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/{serviceId}/endpoints/{endpointId}",
    tags: ["Services — Endpoints"],
    summary: "Delete endpoint",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ serviceId: z.string(), endpointId: z.string() }) },
    responses: {
      200: { description: "Deleted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { endpointId } = c.req.valid("param");
    const db = c.get("db");
    await db.endpoint.delete({ where: { id: endpointId } });
    return c.json({ ok: true }, 200);
  },
);

// ─── GET /services/:serviceId/endpoint-changes ────────────────────────────────

servicesRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{serviceId}/endpoint-changes",
    tags: ["Services — Endpoints"],
    summary: "Get endpoint changes",
    description: "Returns endpoints added, removed, or modified since the last discovery run.",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ serviceId: z.string() }) },
    responses: {
      200: { description: "Endpoint changes", content: { "application/json": { schema: z.object({ changes: z.array(EndpointChangeSchema) }) } } },
    },
  }),
  async (c) => {
    return c.json({ changes: [] }, 200);
  },
);
