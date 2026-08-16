import { describe, expect, test } from "bun:test";
import { computeHealthScore } from "@strim/shared";

describe("NFR smoke", () => {
  test("health score computes in well under a second", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      computeHealthScore({ errorRate: 0.01, availability: 0.999, p95Ms: 80, rps: 40 });
    }
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
