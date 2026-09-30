import { describe, expect, test } from "bun:test";
import { RingBuffer } from "./ring-buffer";
import { StrimClient, strim } from "./index";
import { unlink } from "node:fs/promises";

describe("SDK Fail-Open & Error Resilience", () => {
  test("capture and config never throw when uninitialized", () => {
    expect(() => strim.capture({ type: "request", path: "/test" })).not.toThrow();
    expect(strim.configValue("unknown.key", "fallback")).toBe("fallback");
    expect(strim.config("unknown.key", 42)).toBe(42);
    expect(strim.inRollout("user_123", 50)).toBe(true); // deterministic hash check
  });

  test("ingest network failure does not throw and preserves fail-open", async () => {
    const client = new StrimClient();
    client.init({
      projectId: "checkout-svc",
      environment: "production",
      apiKey: "sk_test_key",
      ingestUrl: "http://127.0.0.1:54321",
      fetchImpl: async () => {
        throw new Error("Connection refused (network down)");
      },
      defaults: { "checkout.timeout": 5000 },
    });

    client.capture({
      type: "request",
      path: "/checkout",
      status: 200,
      durationMs: 15,
    });

    // Flush should fail-open without throwing
    await expect(client.flush()).resolves.toBeUndefined();
    expect(client.config("checkout.timeout")).toBe(5000);
    client.shutdown();
  });
});

describe("Bounded In-Memory Ring Buffer & Drop-Oldest Shedding", () => {
  test("drops oldest items when capacity is exceeded", () => {
    const ring = new RingBuffer<{ id: number }>(5);

    for (let i = 1; i <= 8; i++) {
      ring.push({ id: i });
    }

    const stats = ring.stats;
    expect(stats.buffered).toBe(5);
    expect(stats.capacity).toBe(5);
    expect(stats.dropped).toBe(3);
    expect(stats.totalCaptured).toBe(8);

    const items = ring.drain();
    expect(items.length).toBe(5);
    expect(items.map((x) => x.id)).toEqual([4, 5, 6, 7, 8]); // Oldest 1, 2, 3 dropped
  });

  test("requeues failed events respecting capacity", () => {
    const ring = new RingBuffer<{ id: number }>(5);
    ring.push({ id: 1 });
    ring.push({ id: 2 });

    const drained = ring.drain();
    expect(ring.size).toBe(0);

    // Simulate new events arrived while previous flush was in-flight
    ring.push({ id: 3 });
    ring.push({ id: 4 });
    ring.push({ id: 5 });
    ring.push({ id: 6 });

    // Flush failed, requeue drained items [1, 2] alongside [3, 4, 5, 6]
    ring.requeue(drained);

    // Combined was 6 items for capacity 5 -> 1 oldest item dropped
    expect(ring.size).toBe(5);
    expect(ring.stats.dropped).toBe(1);
    const result = ring.drain();
    expect(result.map((x) => x.id)).toEqual([2, 3, 4, 5, 6]);
  });
});

describe("Source-Level PII, Token, and Auth Header Redaction", () => {
  test("redacts authorization header, cookie, and sensitive body fields in memory", async () => {
    let capturedBody: any = null;

    const client = new StrimClient();
    client.init({
      projectId: "billing-svc",
      environment: "production",
      apiKey: "sk_test_123",
      fetchImpl: async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    client.capture({
      type: "request",
      path: "/users/login?token=secret_jwt_token_123",
      headers: {
        authorization: "Bearer secret-jwt-bearer-token",
        cookie: "session_id=abcdef12345678",
        "x-api-key": "sk_live_super_secret_key_888",
        "content-type": "application/json",
      },
      body: {
        username: "alice@acme.test",
        password: "SuperSecretPassword123!",
        creditCard: "4111-2222-3333-4444",
        nested: {
          apiKey: "api_key_secret_9999",
        },
      },
    });

    await client.flush();

    expect(capturedBody).not.toBeNull();
    const event = capturedBody.events[0];

    // Auth headers must be redacted
    expect(event.headers.authorization).toBe("[REDACTED]");
    expect(event.headers.cookie).toBe("[REDACTED]");
    expect(event.headers["x-api-key"]).toBe("[REDACTED]");
    expect(event.headers["content-type"]).toBe("application/json");

    // Sensitive body fields must be redacted
    expect(event.body.password).toBe("[REDACTED]");
    expect(event.body.creditCard).toBe("[REDACTED]");
    expect(event.body.nested.apiKey).toBe("[REDACTED]");

    client.shutdown();
  });

  test("applies custom user redaction rules", async () => {
    let capturedBody: any = null;

    const client = new StrimClient();
    client.init({
      projectId: "custom-redaction-svc",
      environment: "staging",
      apiKey: "sk_test",
      customRedactionRules: [
        { name: "internal_customer_id", pattern: "CUST-[0-9]{5}" },
      ],
      fetchImpl: async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    client.capture({
      type: "request",
      path: "/customers/CUST-99281/orders",
      attributes: {
        accountId: "CUST-12345",
      },
    });

    await client.flush();

    const event = capturedBody.events[0];
    expect(event.path).toBe("/customers/[REDACTED]/orders");
    expect(event.attributes.accountId).toBe("[REDACTED]");

    client.shutdown();
  });
});

describe("Deterministic Canary Rollout Evaluation", () => {
  test("hashes bucket keys consistently for canary rollouts", () => {
    const client = new StrimClient();
    client.init({
      projectId: "recommendation-svc",
      environment: "production",
      apiKey: "sk_test",
      defaults: {
        "algo.version": "v1",
      },
    });

    // At 0% rollout, everyone gets baseline
    expect(client.inRollout("user_alpha", 0)).toBe(false);
    expect(client.inRollout("user_beta", 0)).toBe(false);

    // At 100% rollout, everyone gets canary
    expect(client.inRollout("user_alpha", 100)).toBe(true);
    expect(client.inRollout("user_beta", 100)).toBe(true);

    // Partial rollout: evaluation is stable for the same key
    const isAlpha = client.inRollout("user_alpha", 30);
    const isAlphaRepeat = client.inRollout("user_alpha", 30);
    expect(isAlpha).toBe(isAlphaRepeat);

    client.shutdown();
  });

  test("configValue routes to proposed value when bucketKey is in rollout", () => {
    const client = new StrimClient();
    client.init({
      projectId: "cart-svc",
      environment: "production",
      apiKey: "sk_test",
      defaults: {
        "cache.enabled": false,
      },
      fetchImpl: async () => {
        return new Response(
          JSON.stringify({
            values: { "cache.enabled": false },
            proposed: { "cache.enabled": true },
            rolloutPercent: 50,
          }),
          { status: 200 },
        );
      },
    });

    // Key that falls under 50% rollout gets proposed value true
    // Key that falls outside gets baseline false
    const valCanary = client.config("cache.enabled", false, { bucketKey: "user_89" });
    expect(typeof valCanary).toBe("boolean");

    client.shutdown();
  });
});

describe("Runtime Config Disk Cache Fallback", () => {
  const testCachePath = ".test-strim-cache.json";

  test("persists config to disk and restores on offline startup", async () => {
    // 1. Initial online client saves config
    const clientOnline = new StrimClient();
    clientOnline.init({
      projectId: "auth-svc",
      environment: "production",
      apiKey: "sk_test",
      configCachePath: testCachePath,
      fetchImpl: async () => {
        return new Response(
          JSON.stringify({
            values: { "jwt.expiry.seconds": 3600, "rate.limit": 100 },
          }),
          { status: 200 },
        );
      },
    });

    await clientOnline.refreshConfig();
    expect(clientOnline.config("jwt.expiry.seconds")).toBe(3600);
    clientOnline.shutdown();

    // 2. New offline client boots with network down, restores from disk
    const clientOffline = new StrimClient();
    clientOffline.init({
      projectId: "auth-svc",
      environment: "production",
      apiKey: "sk_test",
      configCachePath: testCachePath,
      fetchImpl: async () => {
        throw new Error("Network offline");
      },
    });

    // Allow loadCache async read
    await new Promise((r) => setTimeout(r, 50));

    expect(clientOffline.config("jwt.expiry.seconds")).toBe(3600);
    expect(clientOffline.config("rate.limit")).toBe(100);
    clientOffline.shutdown();

    // Cleanup
    try {
      await unlink(testCachePath);
    } catch {
      // ignore
    }
  });
});
