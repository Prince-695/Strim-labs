import type { Context } from "hono";
import type { AppEnv } from "../../types";
import * as IncidentService from "./service";
import type { EvaluateIncidentInput } from "./types";

export async function evaluateIncidentHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as EvaluateIncidentInput;

  try {
    const result = await IncidentService.evaluateIncident(
      c.get("db"),
      organizationId,
      c.get("userId"),
      body,
    );
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function listIncidentsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const incidents = await IncidentService.listIncidents(c.get("db"), organizationId, environmentId);
  return c.json({ incidents }, 200);
}

export async function getIncidentHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const incident = await IncidentService.getIncident(c.get("db"), organizationId, id);
    return c.json(incident, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "INCIDENT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Incident not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function resolveIncidentHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const resolved = await IncidentService.resolveIncident(c.get("db"), organizationId, id);
    return c.json(resolved, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "INCIDENT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Incident not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function rollbackIncidentHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const result = await IncidentService.rollbackFromIncident(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
    );
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "INCIDENT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Incident not found" }, 404);
    }
    if (msg.startsWith("NO_CORRELATED_CHANGE_PLAN")) {
      return c.json({ error: "CONFLICT", message: msg }, 409);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function listNotificationsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const notifications = await IncidentService.listNotifications(c.get("db"), organizationId);
  return c.json({ notifications }, 200);
}
