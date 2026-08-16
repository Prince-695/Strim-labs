import { describe, expect, test } from "bun:test";
import { strim } from "@strim/sdk";

describe("sdk fail-open", () => {
  test("capture and config never throw when uninitialized", () => {
    expect(() => strim.capture({ type: "request", path: "/x" })).not.toThrow();
    expect(strim.configValue("missing", 5)).toBe(5);
  });

  test("ingest failure does not throw", async () => {
    strim.init({
      projectId: "checkout",
      environment: "production",
      apiKey: "sk_test",
      ingestUrl: "http://127.0.0.1:1",
      fetchImpl: (async () => {
        throw new Error("down");
      }) as typeof fetch,
      defaults: { "checkout.timeout": 5000 },
    });
    strim.capture({ type: "request", path: "/checkout", status: 200, durationMs: 12 });
    await strim.flush();
    expect(strim.configValue("checkout.timeout")).toBe(5000);
    strim.shutdown();
  });
});
