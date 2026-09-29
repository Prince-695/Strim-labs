import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import {
  approveChangePlanRoute,
  createChangePlanRoute,
  deleteChangePlanRoute,
  getChangePlanRoute,
  guardrailCheckRoute,
  listChangePlansRoute,
  rejectChangePlanRoute,
  rollbackChangePlanRoute,
  rolloutChangePlanRoute,
  simulateChangePlanRoute,
  updateChangePlanRoute,
} from "./routes";
import {
  approveChangePlanHandler,
  createChangePlanHandler,
  deleteChangePlanHandler,
  getChangePlanHandler,
  guardrailCheckHandler,
  listChangePlansHandler,
  rejectChangePlanHandler,
  rollbackChangePlanHandler,
  rolloutChangePlanHandler,
  simulateChangePlanHandler,
  updateChangePlanHandler,
} from "./handlers";

export const changePlanRoutes = new OpenAPIHono<AppEnv>();

changePlanRoutes.use("*", requireAuth, requireOrg);

changePlanRoutes.openapi(createChangePlanRoute, createChangePlanHandler);
changePlanRoutes.openapi(listChangePlansRoute, listChangePlansHandler);
changePlanRoutes.openapi(getChangePlanRoute, getChangePlanHandler);
changePlanRoutes.openapi(updateChangePlanRoute, updateChangePlanHandler);
changePlanRoutes.openapi(deleteChangePlanRoute, deleteChangePlanHandler);
changePlanRoutes.openapi(simulateChangePlanRoute, simulateChangePlanHandler);
changePlanRoutes.openapi(approveChangePlanRoute, approveChangePlanHandler);
changePlanRoutes.openapi(rejectChangePlanRoute, rejectChangePlanHandler);
changePlanRoutes.openapi(rolloutChangePlanRoute, rolloutChangePlanHandler);
changePlanRoutes.openapi(guardrailCheckRoute, guardrailCheckHandler);
changePlanRoutes.openapi(rollbackChangePlanRoute, rollbackChangePlanHandler);

export * from "./schemas";
export * from "./types";
export * as ChangePlanService from "./service";
