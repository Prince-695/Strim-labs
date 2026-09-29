import { createRoute } from "@hono/zod-openapi";
import {
  ConfigurationItemSchema,
  ConfigurationKeyParamSchema,
  DeleteConfigurationQuerySchema,
  EnvironmentQuerySchema,
  ErrorResponseSchema,
  ListConfigurationsResponseSchema,
  ListRuntimeVersionsResponseSchema,
  OptionalEnvironmentQuerySchema,
  RuntimeDiffQuerySchema,
  RuntimeDiffResponseSchema,
  SdkConfigResponseSchema,
  UpsertConfigurationSchema,
} from "./schemas";

const tags = ["Configuration & Runtime State"];

export const listConfigurationsRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List configurations",
  description: "Returns all configuration key-values in the environment with their version history.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: OptionalEnvironmentQuerySchema,
  },
  responses: {
    200: {
      description: "List of configurations",
      content: { "application/json": { schema: ListConfigurationsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getConfigurationRoute = createRoute({
  method: "get",
  path: "/:key",
  tags,
  summary: "Get configuration key details",
  description: "Returns configuration values and up to 20 immutable version snapshots.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: ConfigurationKeyParamSchema,
    query: EnvironmentQuerySchema,
  },
  responses: {
    200: {
      description: "Configuration details and history",
      content: { "application/json": { schema: ConfigurationItemSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Configuration key not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const upsertConfigurationRoute = createRoute({
  method: "put",
  path: "/",
  tags,
  summary: "Upsert configuration value",
  description:
    "Sets configuration value, logs immutable change version with mandatory reason, bumps runtime version, and emits real-time event.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: {
      content: { "application/json": { schema: UpsertConfigurationSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated configuration and newly minted runtime version",
      content: {
        "application/json": {
          schema: ConfigurationItemSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Production change tier requires appropriate permissions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Target environment not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const deleteConfigurationRoute = createRoute({
  method: "delete",
  path: "/:key",
  tags,
  summary: "Delete configuration key",
  description: "Removes configuration key, creates deletion version entry, and bumps runtime version.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: ConfigurationKeyParamSchema,
    query: DeleteConfigurationQuerySchema,
  },
  responses: {
    200: {
      description: "Key deleted",
      content: {
        "application/json": {
          schema: ConfigurationItemSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Configuration key not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const listRuntimeVersionsRoute = createRoute({
  method: "get",
  path: "/versions",
  tags,
  summary: "List runtime versions",
  description: "Returns sequential immutable runtime versions for an environment.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: OptionalEnvironmentQuerySchema,
  },
  responses: {
    200: {
      description: "Sequential list of runtime versions",
      content: { "application/json": { schema: ListRuntimeVersionsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const diffRuntimeVersionsRoute = createRoute({
  method: "get",
  path: "/diff",
  tags,
  summary: "Diff two runtime versions",
  description: "Computes human-readable key-by-key delta between two runtime versions.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: RuntimeDiffQuerySchema,
  },
  responses: {
    200: {
      description: "Runtime state differences",
      content: { "application/json": { schema: RuntimeDiffResponseSchema } },
    },
    400: {
      description: "Missing required parameters",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "One or both versions not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getSdkConfigRoute = createRoute({
  method: "get",
  path: "/sdk",
  tags,
  summary: "Get runtime config for SDK client",
  description: "Delivers active approved config values and canary rollout versions to SDK instances.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: EnvironmentQuerySchema,
  },
  responses: {
    200: {
      description: "Approved config payload and canary status",
      content: { "application/json": { schema: SdkConfigResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
