import { Hono } from "hono";
import { strim } from "@strim/sdk";

strim.init({
  projectId: "checkout",
  environment: process.env.STRIM_ENV ?? "production",
  apiKey: process.env.STRIM_API_KEY ?? "sk_demo",
  ingestUrl: process.env.STRIM_INGEST_URL ?? "http://localhost:3001",
  defaults: {
    "cache.enabled": false,
    "cache.ttl": 0,
    "checkout.timeout": 5000,
    retry_count: 2,
  },
});

const app = new Hono();
const cache = new Map<string, { exp: number; body: Record<string, unknown> }>();

app.use("*", async (c, next) => {
  const started = Date.now();
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
  const traceId = c.req.header("x-trace-id") ?? crypto.randomUUID();
  try {
    await next();
  } finally {
    strim.capture({
      type: "request",
      requestId,
      traceId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - started,
      service: "checkout",
      headers: {
        authorization: c.req.header("authorization") ?? "",
        cookie: c.req.header("cookie") ?? "",
      },
    });
  }
});

app.get("/health", (c) => c.json({ ok: true, app: "demo-checkout" }));

app.get("/products", (c) => {
  const enabled = Boolean(strim.configValue("cache.enabled", false));
  const ttl = Number(strim.configValue("cache.ttl", 0));
  const key = "GET:/products";
  if (enabled && ttl > 0) {
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) return c.json(hit.body as Record<string, unknown>);
  }
  const body = {
    products: [
      { id: "sku_1", name: "Widget box", price: 42 },
      { id: "sku_2", name: "Cable", price: 12 },
    ],
  };
  if (enabled && ttl > 0) cache.set(key, { exp: Date.now() + ttl * 1000, body });
  strim.capture({ type: "span", path: "catalog", service: "catalog", durationMs: 80, traceId: crypto.randomUUID() });
  return c.json(body);
});

app.post("/checkout", async (c) => {
  const timeout = Number(strim.configValue("checkout.timeout", 5000));
  await Bun.sleep(Math.min(timeout / 50, 40));
  strim.capture({ type: "span", path: "payments", service: "payments", durationMs: 120, traceId: crypto.randomUUID() });
  return c.json({ ok: true, timeout });
});

app.post("/pay", async (c) => {
  return c.json({ ok: true, captured: true }, 201);
});

const port = Number(process.env.PORT ?? 3002);
export default {
  port,
  fetch: app.fetch,
};

console.log(`Demo checkout on http://localhost:${port}`);
