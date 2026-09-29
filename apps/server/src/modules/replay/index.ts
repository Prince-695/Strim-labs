import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { createReplayRoute } from "./routes";
import { createReplayHandler } from "./handlers";

export const replayRoutes = new OpenAPIHono<AppEnv>();

replayRoutes.use("*", requireAuth, requireOrg);

replayRoutes.openapi(createReplayRoute, createReplayHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
