import { z } from "@hono/zod-openapi";

export const CreateReplaySchema = z
  .object({
    environmentId: z.string().openapi({ example: "env_staging_123" }),
    mode: z.enum(["exact", "session", "traffic", "scaled", "transformed"]).openapi({ example: "exact" }),
    requestIds: z.array(z.string()).min(1).openapi({ example: ["rec_12345"] }),
    targetEnvType: z.enum(["DEVELOPMENT", "STAGING", "PRODUCTION"]).default("STAGING").openapi({ example: "STAGING" }),
    scale: z.number().optional().openapi({ example: 1.5 }),
    transform: z.record(z.unknown()).optional(),
  })
  .openapi("CreateReplayInput");

export const ReplayRecordSchema = z
  .object({
    id: z.string().openapi({ example: "rep_9988" }),
    organizationId: z.string().openapi({ example: "org_abc" }),
    environmentId: z.string().openapi({ example: "env_staging_123" }),
    mode: z.string().openapi({ example: "exact" }),
    targetEnvType: z.string().openapi({ example: "STAGING" }),
    requestIds: z.array(z.string()),
    status: z.string().openapi({ example: "running" }),
    result: z.unknown().nullable().optional(),
    createdAt: z.string().or(z.date()),
  })
  .openapi("ReplayRecord");

export const ListReplaysResponseSchema = z
  .object({
    replays: z.array(ReplayRecordSchema),
  })
  .openapi("ListReplaysResponse");

export const ReplayIdParamSchema = z.object({
  id: z.string().openapi({
    param: { name: "id", in: "path" },
    description: "Replay execution identifier",
    example: "rep_9988",
  }),
});

export const OptionalEnvironmentQuerySchema = z.object({
  environmentId: z.string().optional().openapi({
    description: "Environment identifier",
    example: "env_staging_123",
  }),
});

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "FORBIDDEN" }),
    message: z.string().optional().openapi({ example: "Forbidden action" }),
  })
  .openapi("ErrorResponse");
