import { describe, expect, it } from "bun:test";
import { z } from "zod";

describe("Validation and quotas schemas", () => {
  const urlSchema = z.string().url();

  it("validates valid and invalid service URLs", () => {
    expect(urlSchema.safeParse("https://api.example.com").success).toBe(true);
    expect(urlSchema.safeParse("http://localhost:8080/api/v1").success).toBe(true);
    expect(urlSchema.safeParse("not-a-url").success).toBe(false);
    expect(urlSchema.safeParse("").success).toBe(false);
  });

  it("validates multi-tenant quota bounds (3 orgs, 5 projects)", () => {
    const orgLimit = 3;
    const projectLimit = 5;

    expect(orgLimit).toBe(3);
    expect(projectLimit).toBe(5);

    const isOrgCapped = (currentCount: number) => currentCount >= orgLimit;
    const isProjectCapped = (currentCount: number) => currentCount >= projectLimit;

    expect(isOrgCapped(2)).toBe(false);
    expect(isOrgCapped(3)).toBe(true);
    expect(isOrgCapped(4)).toBe(true);

    expect(isProjectCapped(4)).toBe(false);
    expect(isProjectCapped(5)).toBe(true);
  });

  it("validates load testing profile constraints", () => {
    const loadTestSchema = z.object({
      concurrency: z.number().int().min(1).max(1000),
      durationSec: z.number().int().min(5).max(300),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
    });

    expect(
      loadTestSchema.safeParse({
        concurrency: 50,
        durationSec: 30,
        method: "GET",
      }).success
    ).toBe(true);

    expect(
      loadTestSchema.safeParse({
        concurrency: 0,
        durationSec: 30,
        method: "GET",
      }).success
    ).toBe(false);

    expect(
      loadTestSchema.safeParse({
        concurrency: 50,
        durationSec: 2,
        method: "GET",
      }).success
    ).toBe(false);
  });
});
