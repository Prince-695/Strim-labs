import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../../types";
import { requireOrg } from "../../middleware/tenant";

const createProjectSchema = z.object({
  name: z.string().min(2),
  targetUrl: z.string().url(),
  defaultMethod: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  defaultHeaders: z.record(z.string()).optional(),
});

export const projectRoutes = new Hono<AppEnv>();

projectRoutes.use("*", requireOrg);

projectRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = c.get("db");

  const projects = await db.project.findMany({
    where: { organizationId },
    include: {
      _count: {
        select: { testRuns: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ projects });
});

projectRoutes.post("/", zValidator("json", createProjectSchema), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = c.req.valid("json");
  const db = c.get("db");

  const project = await db.project.create({
    data: {
      organizationId,
      name: body.name,
      targetUrl: body.targetUrl,
      defaultMethod: body.defaultMethod,
      defaultHeaders: body.defaultHeaders as object,
    },
  });

  return c.json({ project }, 201);
});

projectRoutes.get("/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const project = await db.project.findFirst({
    where: { id, organizationId },
    include: {
      testRuns: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!project) {
    return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  }

  return c.json({ project });
});

projectRoutes.delete("/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const project = await db.project.findFirst({ where: { id, organizationId } });
  if (!project) {
    return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  }

  await db.project.delete({ where: { id } });
  return c.json({ success: true });
});
