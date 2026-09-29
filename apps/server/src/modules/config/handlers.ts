import type { Context } from "hono";
import { roleAtLeast } from "@strim/shared";
import type { AppEnv } from "../../types";
import { queue } from "../../lib/queue";
import { ConfigService } from "./service";
import type { UpsertConfigurationInput } from "./types";

export async function listConfigurationsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const configurations = await ConfigService.listConfigurations(c.get("db"), organizationId, environmentId);

  return c.json({ configurations }, 200);
}

export async function getConfigurationHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const key = c.req.param("key");
  const environmentId = c.req.query("environmentId");
  if (!environmentId) {
    return c.json({ error: "VALIDATION", message: "environmentId required" }, 400);
  }

  const config = await ConfigService.getConfigurationByKey(c.get("db"), organizationId, environmentId, key);
  if (!config) {
    return c.json({ error: "NOT_FOUND", message: "Configuration key not found" }, 404);
  }

  return c.json({ configuration: config }, 200);
}

export async function upsertConfigurationHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const role = c.get("role");
  const envType = c.req.header("x-environment-type") ?? c.req.query("environmentType");
  if (envType === "PRODUCTION" && role && !roleAtLeast(role, "ENGINEER")) {
    return c.json({ error: "FORBIDDEN", message: "Production-tier action requires Engineer or above" }, 403);
  }

  const body = (await c.req.json()) as UpsertConfigurationInput;
  const result = await ConfigService.upsertConfiguration(
    c.get("db"),
    organizationId,
    c.get("userId"),
    body,
  );

  if (!result) {
    return c.json({ error: "NOT_FOUND", message: "Target environment not found" }, 404);
  }

  return c.json(result, 200);
}

export async function deleteConfigurationHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const role = c.get("role");
  const envType = c.req.header("x-environment-type") ?? c.req.query("environmentType");
  if (envType === "PRODUCTION" && role && !roleAtLeast(role, "ENGINEER")) {
    return c.json({ error: "FORBIDDEN", message: "Production-tier action requires Engineer or above" }, 403);
  }

  const key = c.req.param("key");
  const environmentId = c.req.query("environmentId");
  const reason = c.req.query("reason") ?? "Deleted via API";

  if (!environmentId) {
    return c.json({ error: "VALIDATION", message: "environmentId required" }, 400);
  }

  const result = await ConfigService.deleteConfiguration(
    c.get("db"),
    organizationId,
    c.get("userId"),
    environmentId,
    key,
    reason,
  );

  if (!result) {
    return c.json({ error: "NOT_FOUND", message: "Configuration key not found" }, 404);
  }

  return c.json(result, 200);
}

export async function listVersionsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const versions = await ConfigService.listRuntimeVersions(c.get("db"), organizationId, environmentId);

  return c.json({ versions }, 200);
}

export async function diffVersionsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const from = c.req.query("from");
  const to = c.req.query("to");
  if (!from || !to) {
    return c.json({ error: "VALIDATION", message: "Both 'from' and 'to' version IDs are required" }, 400);
  }

  const diffResult = await ConfigService.diffVersions(c.get("db"), organizationId, from, to);
  if (!diffResult) {
    return c.json({ error: "NOT_FOUND", message: "One or both runtime versions not found" }, 404);
  }

  return c.json(diffResult, 200);
}

export async function sdkConfigHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  if (!environmentId) {
    return c.json({ error: "VALIDATION", message: "environmentId required" }, 400);
  }

  const config = await ConfigService.getSdkConfig(c.get("db"), organizationId, environmentId);
  return c.json(config, 200);
}

export async function sdkConfigStreamHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  const project = c.req.header("x-strim-project") || c.req.query("project");
  const envName = c.req.header("x-strim-environment") || c.req.query("environment");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          const parsed = JSON.parse(data) as {
            topic?: string;
            payload?: { organizationId?: string; environmentId?: string; values?: Record<string, unknown> };
          };
          if (organizationId && parsed.payload?.organizationId && parsed.payload.organizationId !== organizationId) {
            return;
          }
          if (parsed.topic === "CONFIG_CHANGED" || parsed.topic === "CHANGE_PLAN_ROLLOUT") {
            controller.enqueue(encoder.encode(`event: config\ndata: ${JSON.stringify(parsed.payload)}\n\n`));
          }
        } catch {
          // ignore parsing error
        }
      };
      const unsub = queue.subscribe(send);
      const ping = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 15000);
      return () => {
        unsub();
        clearInterval(ping);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
