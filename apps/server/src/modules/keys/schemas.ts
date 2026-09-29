import { z } from "@hono/zod-openapi";
import { API_KEY_SCOPES } from "@strim/shared";

export const ApiKeyScopeSchema = z.enum(API_KEY_SCOPES).openapi("ApiKeyScope");

export const ApiKeyItemSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_key_123" }),
    name: z.string().openapi({ example: "Checkout Telemetry Collector" }),
    prefix: z.string().openapi({ example: "sk_abc1234" }),
    scopes: z.array(z.string()).openapi({ example: ["telemetry:write"] }),
    expiresAt: z.string().nullable().optional().openapi({ example: "2027-01-01T00:00:00.000Z" }),
    revokedAt: z.string().nullable().optional().openapi({ example: null }),
    createdAt: z.string().openapi({ example: "2026-09-29T10:00:00.000Z" }),
  })
  .openapi("ApiKeyItem");

export const ListApiKeysResponseSchema = z
  .object({
    keys: z.array(ApiKeyItemSchema),
  })
  .openapi("ListApiKeysResponse");

export const CreateApiKeySchema = z
  .object({
    name: z.string().min(1).openapi({ example: "Production Ingestion Key" }),
    scopes: z.array(ApiKeyScopeSchema).min(1).openapi({ example: ["telemetry:write"] }),
    expiresAt: z.string().datetime().optional().openapi({ example: "2027-01-01T00:00:00.000Z" }),
    environmentId: z.string().optional().openapi({ example: "cuid_env_prod" }),
  })
  .openapi("CreateApiKeyRequest");

export const CreatedApiKeyResponseSchema = ApiKeyItemSchema.extend({
  secret: z.string().openapi({ example: "sk_live_a1b2c3d4e5f6..." }),
}).openapi("CreatedApiKeyResponse");

export const KeyIdParamSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_key_123" }),
  })
  .openapi("KeyIdParam");

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "VALIDATION" }),
    message: z.string().optional().openapi({ example: "Invalid scope combination" }),
  })
  .openapi("KeyErrorResponse");
