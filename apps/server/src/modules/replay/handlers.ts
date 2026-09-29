import type { Context } from "hono";
import type { AppEnv } from "../../types";
import { ReplayService } from "./service";
import type { CreateReplayInput } from "./types";

export async function listReplaysHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const replays = await ReplayService.listReplays(c.get("db"), organizationId, environmentId);

  return c.json({ replays }, 200);
}

export async function getReplayHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const replay = await ReplayService.getReplayById(c.get("db"), organizationId, id);
  if (!replay) {
    return c.json({ error: "NOT_FOUND", message: "Replay execution not found" }, 404);
  }

  return c.json(replay, 200);
}

export async function createReplayHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CreateReplayInput;
  const result = await ReplayService.createReplay(
    c.get("db"),
    organizationId,
    c.get("userId"),
    c.get("role"),
    body,
  );

  return c.json(result.data as never, result.status as 200);
}
