import type { Context } from "hono";
import type { AppEnv } from "../../types";
import { queue } from "../../lib/queue";
import * as LoadTestingService from "./service";
import type { LoadTestConfig } from "./types";

export async function executeLoadTestHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as LoadTestConfig;

  try {
    const test = await LoadTestingService.executeLoadTest(
      c.get("db"),
      organizationId,
      c.get("userId"),
      body,
    );
    return c.json(test, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "ENVIRONMENT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Target environment not found" }, 404);
    }
    if (msg === "PRODUCTION_MUTATION_FORBIDDEN") {
      return c.json(
        {
          error: "FORBIDDEN",
          message: "Load tests must not target live production environments directly. Use staging or an isolated sandboxed environment.",
        },
        403,
      );
    }
    if (msg.startsWith("SSRF_BLOCKED")) {
      return c.json({ error: "FORBIDDEN", message: msg }, 403);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function listLoadTestsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  const tests = await LoadTestingService.listLoadTests(
    c.get("db"),
    organizationId,
    environmentId,
    limit,
  );

  return c.json({ loadTests: tests }, 200);
}

export async function getLoadTestHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const test = await LoadTestingService.getLoadTest(c.get("db"), organizationId, id);
    return c.json(test, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "LOAD_TEST_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Load test not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function stopLoadTestHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const result = await LoadTestingService.stopLoadTest(c.get("db"), organizationId, id);
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "LOAD_TEST_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Load test not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function streamLoadTestHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  const testId = c.req.param("id");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          const parsed = JSON.parse(data) as {
            topic?: string;
            payload?: { organizationId?: string; loadTestId?: string };
          };

          if (organizationId && parsed.payload?.organizationId && parsed.payload.organizationId !== organizationId) {
            return;
          }

          if (parsed.payload?.loadTestId && parsed.payload.loadTestId !== testId) {
            return;
          }

          if (
            parsed.topic === "LOAD_TEST_STARTED" ||
            parsed.topic === "LOAD_TEST_PROGRESS" ||
            parsed.topic === "LOAD_TEST_COMPLETED" ||
            parsed.topic === "LOAD_TEST_STOPPED"
          ) {
            controller.enqueue(encoder.encode(`event: load_test\ndata: ${JSON.stringify(parsed)}\n\n`));
          }
        } catch {
          // ignore parsing error
        }
      };

      const unsub = queue.subscribe(send);
      const ping = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 10000);

      return () => {
        unsub();
        clearInterval(ping);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
