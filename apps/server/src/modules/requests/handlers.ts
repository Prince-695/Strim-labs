import type { Context } from "hono";
import type { AppEnv } from "../../types";
import { RequestService } from "./service";

export async function listRequestsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const service = c.req.query("service");
  const method = c.req.query("method");
  const statusStr = c.req.query("status");
  const limitStr = c.req.query("limit");
  const offsetStr = c.req.query("offset");

  const result = await RequestService.searchRequests(c.get("db"), organizationId, {
    environmentId,
    service,
    method,
    status: statusStr ? Number(statusStr) : undefined,
    limit: limitStr ? Number(limitStr) : 50,
    offset: offsetStr ? Number(offsetStr) : 0,
  });

  return c.json(result, 200);
}

export async function getRequestHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const rec = await RequestService.getRequestById(c.get("db"), organizationId, id);
  if (!rec) {
    return c.json({ error: "NOT_FOUND", message: "Request record not found" }, 404);
  }

  return c.json(rec, 200);
}

export async function getTraceWaterfallHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const waterfall = await RequestService.getTraceWaterfall(c.get("db"), organizationId, id);
  if (!waterfall) {
    return c.json({ error: "NOT_FOUND", message: "Trace or root request not found" }, 404);
  }

  return c.json(waterfall, 200);
}
