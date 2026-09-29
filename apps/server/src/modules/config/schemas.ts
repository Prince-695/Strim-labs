import { z } from "@hono/zod-openapi";

export const ConfigurationVersionSchema = z
  .object({
    id: z.string().openapi({ example: "ver_123" }),
    actorId: z.string().nullable().optional(),
    reason: z.string().openapi({ example: "Enable payment caching" }),
    oldValue: z.unknown().nullable().optional(),
    newValue: z.unknown().nullable().optional(),
    createdAt: z.string().or(z.date()).openapi({ example: "2026-09-29T12:00:00.000Z" }),
  })
  .openapi("ConfigurationVersion");

export const ConfigurationItemSchema = z
  .object({
    id: z.string().openapi({ example: "cfg_01" }),
    organizationId: z.string().openapi({ example: "org_abc" }),
    environmentId: z.string().openapi({ example: "env_prod" }),
    key: z.string().openapi({ example: "cache.checkout.enabled" }),
    value: z.unknown().openapi({ example: true }),
    updatedAt: z.string().or(z.date()),
    versions: z.array(ConfigurationVersionSchema).optional(),
  })
  .openapi("ConfigurationItem");

export const ListConfigurationsResponseSchema = z
  .object({
    configurations: z.array(ConfigurationItemSchema),
  })
  .openapi("ListConfigurationsResponse");

export const ConfigurationKeyParamSchema = z.object({
  key: z.string().openapi({
    param: { name: "key", in: "path" },
    description: "Configuration key name",
    example: "cache.checkout.enabled",
  }),
});

export const EnvironmentQuerySchema = z.object({
  environmentId: z.string().openapi({
    description: "Target environment ID",
    example: "env_prod_123",
  }),
});

export const OptionalEnvironmentQuerySchema = z.object({
  environmentId: z.string().optional().openapi({
    description: "Target environment ID",
    example: "env_prod_123",
  }),
});

export const UpsertConfigurationSchema = z
  .object({
    environmentId: z.string().openapi({ example: "env_prod_123" }),
    key: z.string().min(1).openapi({ example: "cache.checkout.enabled" }),
    value: z.unknown().openapi({ example: true }),
    reason: z.string().min(1).openapi({ example: "Scale down checkout latency" }),
  })
  .openapi("UpsertConfigurationInput");

export const DeleteConfigurationQuerySchema = z.object({
  environmentId: z.string().openapi({ example: "env_prod_123" }),
  reason: z.string().optional().openapi({ example: "Decommissioning legacy feature" }),
});

export const RuntimeVersionSchema = z
  .object({
    id: z.string().openapi({ example: "rt_ver_01" }),
    organizationId: z.string().openapi({ example: "org_abc" }),
    environmentId: z.string().openapi({ example: "env_prod_123" }),
    seq: z.number().int().openapi({ example: 4 }),
    values: z.record(z.unknown()).openapi({ example: { "cache.enabled": true } }),
    approved: z.boolean().openapi({ example: true }),
    createdAt: z.string().or(z.date()),
  })
  .openapi("RuntimeVersion");

export const ListRuntimeVersionsResponseSchema = z
  .object({
    versions: z.array(RuntimeVersionSchema),
  })
  .openapi("ListRuntimeVersionsResponse");

export const RuntimeDiffQuerySchema = z.object({
  from: z.string().openapi({ description: "Source runtime version ID", example: "rt_ver_01" }),
  to: z.string().openapi({ description: "Target runtime version ID", example: "rt_ver_02" }),
});

export const RuntimeDiffEntrySchema = z
  .object({
    key: z.string().openapi({ example: "cache.checkout.enabled" }),
    from: z.unknown().nullable().optional(),
    to: z.unknown().nullable().optional(),
  })
  .openapi("RuntimeDiffEntry");

export const RuntimeDiffResponseSchema = z
  .object({
    diffs: z.array(RuntimeDiffEntrySchema),
    lines: z.array(z.string()).openapi({ example: ["cache.checkout.enabled: false → true"] }),
  })
  .openapi("RuntimeDiffResponse");

export const SdkConfigResponseSchema = z
  .object({
    values: z.record(z.unknown()).openapi({ example: { "feature.beta": true } }),
    proposed: z.record(z.unknown()).optional(),
    rolloutPercent: z.number().min(0).max(100).optional().openapi({ example: 25 }),
  })
  .openapi("SdkConfigResponse");

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "NOT_FOUND" }),
    message: z.string().optional().openapi({ example: "Configuration or version not found" }),
  })
  .openapi("ErrorResponse");
