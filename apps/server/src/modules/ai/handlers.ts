import type { Context } from "hono";
import type { AppEnv } from "../../types";
import * as AiService from "./service";
import type { AiQueryInput } from "./types";

export async function executeQueryHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const userId = c.get("userId") ?? "anonymous";
  const body = (await c.req.json()) as AiQueryInput;

  try {
    const result = await AiService.executeQuery(
      c.get("db"),
      organizationId,
      userId,
      body.question,
    );
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function listQueryLogsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  const queries = await AiService.listQueryLogs(c.get("db"), organizationId, limit);
  return c.json({ queries }, 200);
}
