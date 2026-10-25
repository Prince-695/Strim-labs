import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { discoverEndpoints, type DiscoveredEndpoint } from "../../engine/discovery";

const scanSchema = z.object({
  baseUrl: z.string().min(1, "Base URL is required"),
  headers: z.record(z.string()).optional(),
});

const importSchema = z.object({
  baseUrl: z.string().min(1, "Base URL is required"),
  endpoints: z.array(
    z.object({
      path: z.string(),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
      summary: z.string().optional(),
      description: z.string().optional(),
      parameters: z.array(z.any()).optional(),
      isSafe: z.boolean().default(true),
      source: z.string().default("openapi"),
    })
  ).min(1, "At least one endpoint must be selected"),
});

export const discoveryRoutes = new Hono<AppEnv>();

discoveryRoutes.use("/import", requireAuth);

/**
 * Scan a base URL to discover all API endpoints
 */
discoveryRoutes.post("/scan", zValidator("json", scanSchema), async (c) => {
  const { baseUrl, headers } = c.req.valid("json");
  try {
    const result = await discoverEndpoints(baseUrl, headers ?? {});
    return c.json({ ok: true, result });
  } catch (err: any) {
    return c.json({ ok: false, error: "DISCOVERY_FAILED", message: err.message ?? "Failed to scan endpoints" }, 500);
  }
});

/**
 * Batch import discovered endpoints into workspace targets (projects)
 */
discoveryRoutes.post("/import", zValidator("json", importSchema), async (c) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "UNAUTHORIZED", message: "Workspace required" }, 401);

  const { baseUrl, endpoints } = c.req.valid("json");
  const cleanBase = baseUrl.trim().replace(/\/+$/, "");

  const createdProjects = [];

  for (const ep of endpoints) {
    const cleanPath = ep.path.startsWith("/") ? ep.path : `/${ep.path}`;
    const fullUrl = `${cleanBase}${cleanPath}`;
    const name = ep.summary?.trim() || `${ep.method} ${cleanPath}`;

    // Upsert or create project
    const project = await db.project.create({
      data: {
        organizationId,
        name: name.slice(0, 80),
        targetUrl: fullUrl,
        defaultMethod: ep.method,
      },
    });
    createdProjects.push(project);
  }

  return c.json({
    ok: true,
    count: createdProjects.length,
    projects: createdProjects,
  });
});
