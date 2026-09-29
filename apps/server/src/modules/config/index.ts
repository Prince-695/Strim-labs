import { OpenAPIHono } from "@hono/zod-openapi";
import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { requireProductionTier } from "../../middleware/rbac";
import {
  deleteConfigurationRoute,
  diffRuntimeVersionsRoute,
  getConfigurationRoute,
  getSdkConfigRoute,
  listConfigurationsRoute,
  listRuntimeVersionsRoute,
  upsertConfigurationRoute,
} from "./routes";
import {
  deleteConfigurationHandler,
  diffVersionsHandler,
  getConfigurationHandler,
  listConfigurationsHandler,
  listVersionsHandler,
  sdkConfigHandler,
  sdkConfigStreamHandler,
  upsertConfigurationHandler,
} from "./handlers";
import { ConfigService } from "./service";

export const configRoutes = new OpenAPIHono<AppEnv>();

configRoutes.use("*", requireAuth, requireOrg);

configRoutes.openapi(listConfigurationsRoute, listConfigurationsHandler);
configRoutes.openapi(getConfigurationRoute, getConfigurationHandler);
configRoutes.openapi(upsertConfigurationRoute, upsertConfigurationHandler);
configRoutes.openapi(deleteConfigurationRoute, deleteConfigurationHandler);
configRoutes.openapi(listRuntimeVersionsRoute, listVersionsHandler);
configRoutes.openapi(diffRuntimeVersionsRoute, diffVersionsHandler);
configRoutes.openapi(getSdkConfigRoute, sdkConfigHandler);

// Public / SDK config delivery endpoints
export const sdkConfigRoutes = new Hono<AppEnv>();

sdkConfigRoutes.get("/v1/sdk/config", async (c) => {
  const organizationId = c.get("organizationId");
  const project = c.req.header("x-strim-project");
  const envName = c.req.header("x-strim-environment");
  if (!organizationId || !envName) return c.json({ values: {} });

  const env = await c.get("db").environment.findFirst({
    where: { organizationId, name: { equals: envName, mode: "insensitive" } },
  });
  if (!env) return c.json({ values: {}, project });

  const result = await ConfigService.getSdkConfig(c.get("db"), organizationId, env.id);
  return c.json(result, 200);
});

sdkConfigRoutes.get("/v1/sdk/config/stream", sdkConfigStreamHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
