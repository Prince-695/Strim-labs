import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";

export const auditRoutes = new Hono<AppEnv>();
auditRoutes.use("*", requireAuth, requireOrg);

auditRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const user = c.req.query("user");
  const action = c.req.query("action");
  const resource = c.req.query("resource");
  const environmentId = c.req.query("environmentId");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const logs = await c.get("db").auditLog.findMany({
    where: {
      organizationId,
      actorId: user || undefined,
      action: action || undefined,
      resourceType: resource || undefined,
      environmentId: environmentId || undefined,
      createdAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return c.json({ logs });
});

auditRoutes.get("/export", async (c) => {
  const logs = await c.get("db").auditLog.findMany({
    where: { organizationId: c.get("organizationId")! },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return c.json({ logs, exportedAt: new Date().toISOString() });
});

auditRoutes.patch("/:id", (c) => c.json({ error: "FORBIDDEN", message: "Audit records are immutable" }, 405));
auditRoutes.delete("/:id", (c) => c.json({ error: "FORBIDDEN", message: "Audit records are immutable" }, 405));
