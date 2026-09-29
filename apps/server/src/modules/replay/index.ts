import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { createReplayRoute, getReplayRoute, listReplaysRoute } from "./routes";
import { createReplayHandler, getReplayHandler, listReplaysHandler } from "./handlers";

export const replayRoutes = new OpenAPIHono<AppEnv>();

replayRoutes.use("*", requireAuth, requireOrg);

replayRoutes.openapi(listReplaysRoute, listReplaysHandler);
replayRoutes.openapi(getReplayRoute, getReplayHandler);
replayRoutes.openapi(createReplayRoute, createReplayHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
export * from "./ssrf";
