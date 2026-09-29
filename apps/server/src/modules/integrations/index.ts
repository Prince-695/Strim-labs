import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import {
  ciGateRoute,
  createDeploymentRoute,
  createPagingRoute,
  deletePagingRoute,
  getLineageRoute,
  listDeploymentsRoute,
  listPagingRoute,
} from "./routes";
import {
  ciGateHandler,
  createDeploymentHandler,
  createPagingHandler,
  deletePagingHandler,
  getLineageHandler,
  githubWebhookHandler,
  listDeploymentsHandler,
  listPagingHandler,
} from "./handlers";

export const integrationRoutes = new OpenAPIHono<AppEnv>();

// Public webhook route (verified via x-hub-signature-256)
integrationRoutes.post("/github/webhook", githubWebhookHandler);

// Authenticated integration routes
integrationRoutes.use("/deployments/*", requireOrg);
integrationRoutes.use("/deployments", requireOrg);
integrationRoutes.use("/paging/*", requireAuth, requireOrg);
integrationRoutes.use("/paging", requireAuth, requireOrg);
integrationRoutes.use("/lineage/*", requireOrg);
integrationRoutes.use("/ci/*", requireOrg);

integrationRoutes.openapi(ciGateRoute, ciGateHandler);
integrationRoutes.openapi(createDeploymentRoute, createDeploymentHandler);
integrationRoutes.openapi(listDeploymentsRoute, listDeploymentsHandler);
integrationRoutes.openapi(createPagingRoute, createPagingHandler);
integrationRoutes.openapi(listPagingRoute, listPagingHandler);
integrationRoutes.openapi(deletePagingRoute, deletePagingHandler);
integrationRoutes.openapi(getLineageRoute, getLineageHandler);

export * from "./schemas";
export * from "./types";
export * as IntegrationService from "./service";
