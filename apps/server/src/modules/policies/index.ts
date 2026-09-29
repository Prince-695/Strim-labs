import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import {
  checkDriftRoute,
  createPolicyRoute,
  createPromotionRoute,
  createRateLimitRoute,
  deletePolicyRoute,
  deleteRateLimitRoute,
  evaluateRateLimitRoute,
  getPolicyRoute,
  listDriftReportsRoute,
  listPoliciesRoute,
  listRateLimitsRoute,
  remediateDriftRoute,
  updatePolicyRoute,
  updateRateLimitRoute,
} from "./routes";
import {
  checkDriftHandler,
  createPolicyHandler,
  createPromotionHandler,
  createRateLimitHandler,
  deletePolicyHandler,
  deleteRateLimitHandler,
  evaluateRateLimitHandler,
  getPolicyHandler,
  listDriftReportsHandler,
  listPoliciesHandler,
  listRateLimitsHandler,
  remediateDriftHandler,
  updatePolicyHandler,
  updateRateLimitHandler,
} from "./handlers";

export const policyRoutes = new OpenAPIHono<AppEnv>();

policyRoutes.use("*", requireAuth, requireOrg);

// Rate limits & evaluate
policyRoutes.openapi(listRateLimitsRoute, listRateLimitsHandler);
policyRoutes.openapi(createRateLimitRoute, createRateLimitHandler);
policyRoutes.openapi(evaluateRateLimitRoute, evaluateRateLimitHandler);
policyRoutes.openapi(updateRateLimitRoute, updateRateLimitHandler);
policyRoutes.openapi(deleteRateLimitRoute, deleteRateLimitHandler);

// Promotions
policyRoutes.openapi(createPromotionRoute, createPromotionHandler);

// Drift
policyRoutes.openapi(checkDriftRoute, checkDriftHandler);
policyRoutes.openapi(listDriftReportsRoute, listDriftReportsHandler);
policyRoutes.openapi(remediateDriftRoute, remediateDriftHandler);

// Policy CRUD
policyRoutes.openapi(listPoliciesRoute, listPoliciesHandler);
policyRoutes.openapi(createPolicyRoute, createPolicyHandler);
policyRoutes.openapi(getPolicyRoute, getPolicyHandler);
policyRoutes.openapi(updatePolicyRoute, updatePolicyHandler);
policyRoutes.openapi(deletePolicyRoute, deletePolicyHandler);

export * from "./schemas";
export * from "./types";
export * as PolicyService from "./service";
