import { describe, expect, test } from "bun:test";
import { loadEngine } from "./engine/runner";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

describe("Native Bun Load Engine", () => {
  test("executes real HTTP requests against a target server and calculates metrics", async () => {
    // Spin up an ephemeral test target server
    const targetApp = new Hono();
    let hits = 0;
    targetApp.get("/test-endpoint", (c) => {
      hits++;
      return c.json({ ok: true, hit: hits });
    });

    const targetPort = 45678;
    const server = serve({ fetch: targetApp.fetch, port: targetPort });

    // Mock DB interface for test execution
    const recordedUpdates: unknown[] = [];
    const mockDb = {
      testRun: {
        update: async (args: unknown) => {
          recordedUpdates.push(args);
          return args;
        },
      },
      testSample: {
        createMany: async () => ({ count: 0 }),
      },
    } as unknown as Parameters<typeof loadEngine.execute>[0];

    const testRunId = "test-run-123";
    const streamedTicks: unknown[] = [];
    const unsubscribe = loadEngine.subscribe(testRunId, (tick) => {
      streamedTicks.push(tick);
    });

    try {
      await loadEngine.execute(mockDb, {
        testRunId,
        organizationId: "org-1",
        projectId: "proj-1",
        targetUrl: `http://localhost:${targetPort}/test-endpoint`,
        method: "GET",
        concurrency: 5,
        durationSec: 2,
        profile: "SUSTAINED",
      });

      expect(hits).toBeGreaterThan(10);
      expect(recordedUpdates.length).toBeGreaterThan(0);
      const finalUpdate = recordedUpdates[recordedUpdates.length - 1] as { data: { totalRequests: number; status: string; breakingPoint: unknown } };
      expect(finalUpdate.data.status).toBe("COMPLETED");
      expect(finalUpdate.data.totalRequests).toBeGreaterThan(10);
      expect(finalUpdate.data.breakingPoint).toBeDefined();
    } finally {
      unsubscribe();
      server.close();
    }
  });

  test("aborts an in-flight load run when abort is called", async () => {
    const targetApp = new Hono();
    targetApp.get("/slow", async (c) => {
      await Bun.sleep(50);
      return c.json({ ok: true });
    });

    const targetPort = 45679;
    const server = serve({ fetch: targetApp.fetch, port: targetPort });

    const recordedUpdates: unknown[] = [];
    const mockDb = {
      testRun: {
        update: async (args: unknown) => {
          recordedUpdates.push(args);
          return args;
        },
      },
      testSample: {
        createMany: async () => ({ count: 0 }),
      },
    } as unknown as Parameters<typeof loadEngine.execute>[0];

    const testRunId = "abort-run-456";

    try {
      const runPromise = loadEngine.execute(mockDb, {
        testRunId,
        organizationId: "org-1",
        projectId: "proj-1",
        targetUrl: `http://localhost:${targetPort}/slow`,
        method: "GET",
        concurrency: 2,
        durationSec: 10,
        profile: "SUSTAINED",
      });

      // Let it start, then abort after 300ms
      await Bun.sleep(300);
      const aborted = loadEngine.abort(testRunId);
      expect(aborted).toBe(true);

      await runPromise;

      const finalUpdate = recordedUpdates[recordedUpdates.length - 1] as { data: { status: string } };
      expect(finalUpdate.data.status).toBe("ABORTED");
    } finally {
      server.close();
    }
  });
});
