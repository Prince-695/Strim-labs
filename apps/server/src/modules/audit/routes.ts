import { createRoute } from "@hono/zod-openapi";
import {
  AuditIdParamSchema,
  AuditQuerySchema,
  ErrorResponseSchema,
  ExportAuditLogsResponseSchema,
  ListAuditLogsResponseSchema,
} from "./schemas";

const tags = ["Audit Logs"];

export const listAuditLogsRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "Query organization audit logs",
  description: "Returns paginated, filterable immutable audit records for the active tenant organization.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: AuditQuerySchema,
  },
  responses: {
    200: {
      description: "List of audit logs",
      content: { "application/json": { schema: ListAuditLogsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Forbidden / Tenant Mismatch",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const exportAuditLogsRoute = createRoute({
  method: "get",
  path: "/export",
  tags,
  summary: "Export organization audit logs for compliance",
  description: "Exports up to 5,000 immutable audit records in JSON format for external compliance auditors.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: {
      description: "Exported audit logs",
      content: { "application/json": { schema: ExportAuditLogsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const patchAuditLogRoute = createRoute({
  method: "patch",
  path: "/:id",
  tags,
  summary: "Reject audit mutation (Immutable Contract)",
  description: "Always returns 405 Method Not Allowed. Audit records are cryptographically verified and immutable.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: AuditIdParamSchema,
  },
  responses: {
    405: {
      description: "Audit records are immutable and cannot be updated",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const deleteAuditLogRoute = createRoute({
  method: "delete",
  path: "/:id",
  tags,
  summary: "Reject audit deletion (Immutable Contract)",
  description: "Always returns 405 Method Not Allowed. Audit records are exempt from deletion even by organization owners.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: AuditIdParamSchema,
  },
  responses: {
    405: {
      description: "Audit records are immutable and cannot be deleted",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
