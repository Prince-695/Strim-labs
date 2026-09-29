import type { Context } from "hono";
import type { AppEnv } from "../../types";
import { TopologyService } from "./service";
import type { TopologyQueryType } from "./types";

export async function getGraphHandler(c: Context<AppEnv>) {
  const environmentId = c.req.query("environmentId");
  if (!environmentId) {
    return c.json({ error: "VALIDATION", message: "environmentId required" }, 400);
  }

  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const graph = await TopologyService.getGraph(c.get("db"), organizationId, environmentId);
  return c.json(graph, 200);
}

export async function annotateHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as {
    environmentId: string;
    fromName: string;
    toName: string;
  };

  const edge = await TopologyService.annotateEdge(c.get("db"), organizationId, body);
  return c.json(edge, 200);
}

export async function queryGraphHandler(c: Context<AppEnv>) {
  const environmentId = c.req.query("environmentId");
  if (!environmentId) {
    return c.json({ error: "VALIDATION", message: "environmentId required" }, 400);
  }

  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const node = c.req.query("node") ?? "";
  const q = (c.req.query("q") ?? "depends") as TopologyQueryType;

  const result = await TopologyService.queryGraph(c.get("db"), organizationId, environmentId, node, q);
  return c.json({ result }, 200);
}
