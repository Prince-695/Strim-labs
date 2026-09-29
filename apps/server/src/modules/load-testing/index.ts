import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import {
  createLoadTestRoute,
  getLoadTestRoute,
  listLoadTestsRoute,
  stopLoadTestRoute,
} from "./routes";
import {
  executeLoadTestHandler,
  getLoadTestHandler,
  listLoadTestsHandler,
  stopLoadTestHandler,
  streamLoadTestHandler,
} from "./handlers";

export const loadTestRoutes = new OpenAPIHono<AppEnv>();

loadTestRoutes.use("*", requireAuth, requireOrg);

loadTestRoutes.openapi(createLoadTestRoute, executeLoadTestHandler);
loadTestRoutes.openapi(listLoadTestsRoute, listLoadTestsHandler);
loadTestRoutes.openapi(getLoadTestRoute, getLoadTestHandler);
loadTestRoutes.openapi(stopLoadTestRoute, stopLoadTestHandler);

// Live SSE Stream of load test execution
loadTestRoutes.get("/:id/stream", streamLoadTestHandler);

export * from "./schemas";
export * from "./types";
export * as LoadTestingService from "./service";
