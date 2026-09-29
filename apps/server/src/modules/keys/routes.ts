import { createRoute } from "@hono/zod-openapi";
import {
  ApiKeyItemSchema,
  CreateApiKeySchema,
  CreatedApiKeyResponseSchema,
  ErrorResponseSchema,
  KeyIdParamSchema,
  ListApiKeysResponseSchema,
} from "./schemas";

const tags = ["API Keys"];

export const listKeysRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List organization API keys",
  description: "Returns all API keys issued for the active tenant organization.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: {
      description: "List of API keys",
      content: { "application/json": { schema: ListApiKeysResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Tenant mismatch or insufficient permissions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const createKeyRoute = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Create a scoped API key",
  description: "Generates a new prefixed API key (`sk_...`) with defined scopes and optional expiration.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateApiKeySchema } },
    },
  },
  responses: {
    201: {
      description: "API key created. The raw secret is returned only once upon creation.",
      content: { "application/json": { schema: CreatedApiKeyResponseSchema } },
    },
    400: {
      description: "Validation error (e.g. Incompatible scopes)",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Forbidden",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const revokeKeyRoute = createRoute({
  method: "post",
  path: "/:id/revoke",
  tags,
  summary: "Revoke an API key",
  description: "Immediately revokes an active API key, blocking future requests.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: KeyIdParamSchema,
  },
  responses: {
    200: {
      description: "API key revoked",
      content: { "application/json": { schema: ApiKeyItemSchema } },
    },
    404: {
      description: "API key not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const rotateKeyRoute = createRoute({
  method: "post",
  path: "/:id/rotate",
  tags,
  summary: "Rotate an API key",
  description: "Rotates the secret of an existing API key and returns the new secret.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: KeyIdParamSchema,
  },
  responses: {
    200: {
      description: "API key rotated with new secret",
      content: { "application/json": { schema: CreatedApiKeyResponseSchema } },
    },
    404: {
      description: "API key not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
