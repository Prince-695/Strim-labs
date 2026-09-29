import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { requireRole } from "../../middleware/rbac";
import { createKeyRoute, listKeysRoute, revokeKeyRoute, rotateKeyRoute } from "./routes";
import { createKeyHandler, listKeysHandler, revokeKeyHandler, rotateKeyHandler } from "./handlers";

export const keyRoutes = new OpenAPIHono<AppEnv>();

keyRoutes.use("*", requireAuth, requireOrg, requireRole("ADMIN"));

keyRoutes.openapi(listKeysRoute, listKeysHandler);
keyRoutes.openapi(createKeyRoute, createKeyHandler);
keyRoutes.openapi(revokeKeyRoute, revokeKeyHandler);
keyRoutes.openapi(rotateKeyRoute, rotateKeyHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
