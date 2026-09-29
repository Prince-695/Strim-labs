import type { Context } from "hono";
import type { AppEnv } from "../../types";
import { RuntimeService } from "./service";

export async function getOverviewHandler(c: Context<AppEnv>) {
  const environmentId = c.req.query("environmentId");
  if (!environmentId) {
    return c.json({ error: "VALIDATION", message: "environmentId query parameter required" }, 400);
  }

  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const overview = await RuntimeService.getOverview(c.get("db"), organizationId, environmentId);
  if (!overview) {
    return c.json({ error: "NOT_FOUND", message: "Environment not found" }, 404);
  }

  return c.json(overview, 200);
}

export async function getTimeseriesHandler(c: Context<AppEnv>) {
  const environmentId = c.req.query("environmentId");
  if (!environmentId) {
    return c.json({ error: "VALIDATION", message: "environmentId query parameter required" }, 400);
  }

  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const minutes = Number(c.req.query("minutes") ?? 60);
  const points = await RuntimeService.getTimeseries(c.get("db"), organizationId, environmentId, minutes);

  return c.json({ points }, 200);
}

export async function getEventsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const events = RuntimeService.getRecentEvents(organizationId);
  return c.json({ events }, 200);
}
