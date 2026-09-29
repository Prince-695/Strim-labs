import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import {
  evaluateIncidentRoute,
  getIncidentRoute,
  listIncidentsRoute,
  listNotificationsRoute,
  resolveIncidentRoute,
  rollbackIncidentRoute,
} from "./routes";
import {
  evaluateIncidentHandler,
  getIncidentHandler,
  listIncidentsHandler,
  listNotificationsHandler,
  resolveIncidentHandler,
  rollbackIncidentHandler,
} from "./handlers";

export const incidentRoutes = new OpenAPIHono<AppEnv>();

incidentRoutes.use("*", requireAuth, requireOrg);

// Specific paths before wildcard param
incidentRoutes.openapi(evaluateIncidentRoute, evaluateIncidentHandler);
incidentRoutes.openapi(listNotificationsRoute, listNotificationsHandler);

// Incident CRUD & actions
incidentRoutes.openapi(listIncidentsRoute, listIncidentsHandler);
incidentRoutes.openapi(getIncidentRoute, getIncidentHandler);
incidentRoutes.openapi(resolveIncidentRoute, resolveIncidentHandler);
incidentRoutes.openapi(rollbackIncidentRoute, rollbackIncidentHandler);

export * from "./schemas";
export * from "./types";
export * as IncidentService from "./service";
