import { z } from "@hono/zod-openapi";

export const AuditLogItemSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_audit_123" }),
    organizationId: z.string().openapi({ example: "cuid_org_123" }),
    actorId: z.string().nullable().openapi({ example: "cuid_user_123" }),
    actorType: z.string().openapi({ example: "user" }),
    action: z.string().openapi({ example: "change_plan.create" }),
    resourceType: z.string().openapi({ example: "change_plan" }),
    resourceId: z.string().nullable().openapi({ example: "cuid_plan_456" }),
    environmentId: z.string().nullable().openapi({ example: "cuid_env_prod" }),
    oldValue: z.unknown().optional(),
    newValue: z.unknown().optional(),
    createdAt: z.string().openapi({ example: "2026-09-29T10:00:00.000Z" }),
  })
  .openapi("AuditLogItem");

export const AuditQuerySchema = z
  .object({
    user: z.string().optional().openapi({ example: "cuid_user_123" }),
    action: z.string().optional().openapi({ example: "config.update" }),
    resource: z.string().optional().openapi({ example: "configuration" }),
    environmentId: z.string().optional().openapi({ example: "cuid_env_prod" }),
    from: z.string().datetime().optional().openapi({ example: "2026-09-01T00:00:00.000Z" }),
    to: z.string().datetime().optional().openapi({ example: "2026-09-29T23:59:59.000Z" }),
  })
  .openapi("AuditQuery");

export const ListAuditLogsResponseSchema = z
  .object({
    logs: z.array(AuditLogItemSchema),
  })
  .openapi("ListAuditLogsResponse");

export const ExportAuditLogsResponseSchema = z
  .object({
    logs: z.array(AuditLogItemSchema),
    exportedAt: z.string().openapi({ example: "2026-09-29T10:00:00.000Z" }),
  })
  .openapi("ExportAuditLogsResponse");

export const AuditIdParamSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_audit_123" }),
  })
  .openapi("AuditIdParam");

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "FORBIDDEN" }),
    message: z.string().openapi({ example: "Audit records are immutable" }),
  })
  .openapi("AuditErrorResponse");
