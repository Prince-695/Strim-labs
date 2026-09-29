import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { executeQueryRoute, listQueryLogsRoute } from "./routes";
import { executeQueryHandler, listQueryLogsHandler } from "./handlers";

export const aiRoutes = new OpenAPIHono<AppEnv>();

aiRoutes.use("*", requireAuth, requireOrg);

aiRoutes.openapi(executeQueryRoute, executeQueryHandler);
aiRoutes.openapi(listQueryLogsRoute, listQueryLogsHandler);

export * from "./schemas";
export * from "./types";
export * as AiService from "./service";
