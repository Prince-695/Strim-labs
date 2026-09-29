import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { getRuntimeEventsRoute, getRuntimeOverviewRoute, getRuntimeTimeseriesRoute } from "./routes";
import { getEventsHandler, getOverviewHandler, getTimeseriesHandler } from "./handlers";

export const runtimeRoutes = new OpenAPIHono<AppEnv>();

runtimeRoutes.use("*", requireAuth, requireOrg);

runtimeRoutes.openapi(getRuntimeOverviewRoute, getOverviewHandler);
runtimeRoutes.openapi(getRuntimeTimeseriesRoute, getTimeseriesHandler);
runtimeRoutes.openapi(getRuntimeEventsRoute, getEventsHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
