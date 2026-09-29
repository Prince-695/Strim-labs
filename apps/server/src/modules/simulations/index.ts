import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import {
  createSimulationRoute,
  deleteSimulationRoute,
  getSimulationRoute,
  listSimulationsRoute,
} from "./routes";
import {
  createSimulationHandler,
  deleteSimulationHandler,
  getSimulationHandler,
  listSimulationsHandler,
} from "./handlers";

export const simulationRoutes = new OpenAPIHono<AppEnv>();

simulationRoutes.use("*", requireAuth, requireOrg);

simulationRoutes.openapi(createSimulationRoute, createSimulationHandler);
simulationRoutes.openapi(listSimulationsRoute, listSimulationsHandler);
simulationRoutes.openapi(getSimulationRoute, getSimulationHandler);
simulationRoutes.openapi(deleteSimulationRoute, deleteSimulationHandler);

export * from "./schemas";
export * from "./types";
export * as SimulationService from "./service";
