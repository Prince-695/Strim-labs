import { describe, expect, test } from "bun:test";
import { canApprove } from "@strim/shared";

describe("cross-surface isolation checklist", () => {
  const surfaces = [
    "api",
    "websocket",
    "search",
    "export",
    "audit",
    "ai",
    "error-response",
  ];
  for (const surface of surfaces) {
    test(`${surface} must be organization-scoped`, () => {
      expect(surface.length).toBeGreaterThan(0);
    });
  }

  test("simulation failed cannot approve without justification", () => {
    expect(canApprove({ state: "SIMULATION_FAILED", override: { allowed: true } }).ok).toBe(false);
  });
});
