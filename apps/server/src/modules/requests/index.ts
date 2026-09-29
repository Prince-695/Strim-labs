import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { getRequestRoute, getTraceWaterfallRoute, listRequestsRoute } from "./routes";
import { getRequestHandler, getTraceWaterfallHandler, listRequestsHandler } from "./handlers";

export const requestRoutes = new OpenAPIHono<AppEnv>();

requestRoutes.use("*", requireAuth, requireOrg);

requestRoutes.openapi(listRequestsRoute, listRequestsHandler);
requestRoutes.openapi(getRequestRoute, getRequestHandler);
requestRoutes.openapi(getTraceWaterfallRoute, getTraceWaterfallHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
