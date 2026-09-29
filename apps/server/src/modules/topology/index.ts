import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { annotateTopologyRoute, getTopologyGraphRoute, queryTopologyRoute } from "./routes";
import { annotateHandler, getGraphHandler, queryGraphHandler } from "./handlers";

export const topologyRoutes = new OpenAPIHono<AppEnv>();

topologyRoutes.use("*", requireAuth, requireOrg);

topologyRoutes.openapi(getTopologyGraphRoute, getGraphHandler);
topologyRoutes.openapi(annotateTopologyRoute, annotateHandler);
topologyRoutes.openapi(queryTopologyRoute, queryGraphHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
