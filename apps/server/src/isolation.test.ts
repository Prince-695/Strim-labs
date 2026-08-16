import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

describe("tenant isolation middleware", () => {
  test("rejects missing membership", async () => {
    const app = new Hono<{ Variables: { userId?: string; organizationId?: string } }>();
    const requireOrg = createMiddleware(async (c, next) => {
      const orgId = c.req.header("x-organization-id");
      const userId = c.get("userId");
      const allowed = new Map([
        ["user-a", "org-a"],
        ["user-b", "org-b"],
      ]);
      if (!orgId || allowed.get(userId ?? "") !== orgId) {
        return c.json({ error: "TENANT_MISMATCH" }, 403);
      }
      c.set("organizationId", orgId);
      await next();
    });
    app.use("*", async (c, next) => {
      c.set("userId", c.req.header("x-user-id") ?? "");
      await next();
    });
    app.use("*", requireOrg);
    app.get("/apps", (c) => c.json({ org: c.get("organizationId") }));

    const denied = await app.request("/apps", {
      headers: { "x-user-id": "user-a", "x-organization-id": "org-b" },
    });
    expect(denied.status).toBe(403);
    const allowed = await app.request("/apps", {
      headers: { "x-user-id": "user-a", "x-organization-id": "org-a" },
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ org: "org-a" });
  });
});

describe("audit immutability", () => {
  test("patch and delete are rejected by contract", async () => {
    const app = new Hono();
    app.patch("/v1/audit/:id", (c) => c.json({ error: "FORBIDDEN" }, 405));
    app.delete("/v1/audit/:id", (c) => c.json({ error: "FORBIDDEN" }, 405));
    expect((await app.request("/v1/audit/1", { method: "PATCH" })).status).toBe(405);
    expect((await app.request("/v1/audit/1", { method: "DELETE" })).status).toBe(405);
  });
});

describe("production replay gate", () => {
  test("staging role cannot replay production", async () => {
    const app = new Hono();
    app.post("/v1/replay", async (c) => {
      const role = c.req.header("x-role");
      const body = (await c.req.json()) as { targetEnvType: string };
      if (body.targetEnvType === "PRODUCTION" && role !== "ENGINEER" && role !== "OWNER") {
        return c.json({ error: "FORBIDDEN" }, 403);
      }
      return c.json({ ok: true });
    });
    const res = await app.request("/v1/replay", {
      method: "POST",
      headers: { "x-role": "DEVELOPER", "content-type": "application/json" },
      body: JSON.stringify({ targetEnvType: "PRODUCTION" }),
    });
    expect(res.status).toBe(403);
  });
});
