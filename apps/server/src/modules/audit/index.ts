import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import {
  deleteAuditLogRoute,
  exportAuditLogsRoute,
  listAuditLogsRoute,
  patchAuditLogRoute,
} from "./routes";
import {
  deleteAuditLogHandler,
  exportAuditLogsHandler,
  listAuditLogsHandler,
  patchAuditLogHandler,
} from "./handlers";

export const auditRoutes = new OpenAPIHono<AppEnv>();

auditRoutes.use("*", requireAuth, requireOrg);

auditRoutes.openapi(listAuditLogsRoute, listAuditLogsHandler);
auditRoutes.openapi(exportAuditLogsRoute, exportAuditLogsHandler);
auditRoutes.openapi(patchAuditLogRoute, patchAuditLogHandler);
auditRoutes.openapi(deleteAuditLogRoute, deleteAuditLogHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
