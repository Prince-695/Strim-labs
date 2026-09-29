import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import {
  createCacheRuleRoute,
  createRuntimeSnapshotRoute,
  createTrafficSnapshotRoute,
  deleteCacheRuleRoute,
  getCacheAnalyticsRoute,
  getCacheRecommendationsRoute,
  invalidateCacheRoute,
  listCacheRulesRoute,
  updateCacheRuleRoute,
} from "./routes";
import {
  createRuleHandler,
  createRuntimeSnapshotHandler,
  createTrafficSnapshotHandler,
  deleteRuleHandler,
  getAnalyticsHandler,
  getRecommendationsHandler,
  invalidateHandler,
  listRulesHandler,
  updateRuleHandler,
} from "./handlers";

export const cacheRoutes = new OpenAPIHono<AppEnv>();

cacheRoutes.use("*", requireAuth, requireOrg);

cacheRoutes.openapi(listCacheRulesRoute, listRulesHandler);
cacheRoutes.openapi(createCacheRuleRoute, createRuleHandler);
cacheRoutes.openapi(updateCacheRuleRoute, updateRuleHandler);
cacheRoutes.openapi(deleteCacheRuleRoute, deleteRuleHandler);
cacheRoutes.openapi(invalidateCacheRoute, invalidateHandler);
cacheRoutes.openapi(getCacheAnalyticsRoute, getAnalyticsHandler);
cacheRoutes.openapi(getCacheRecommendationsRoute, getRecommendationsHandler);
cacheRoutes.openapi(createRuntimeSnapshotRoute, createRuntimeSnapshotHandler);
cacheRoutes.openapi(createTrafficSnapshotRoute, createTrafficSnapshotHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
