import type { Context } from "hono";
import type { AppEnv } from "../../types";
import { ReplayService } from "./service";
import type { CreateReplayInput } from "./types";

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
