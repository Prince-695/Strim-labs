import { describe, expect, it } from "bun:test";
import { queryKeys } from "../../src/lib/api/query-keys";

describe("queryKeys factories", () => {
  it("generates correct organization query keys", () => {
    expect(queryKeys.organizations.all()).toEqual(["organizations"]);
    expect(queryKeys.organizations.detail("org-123")).toEqual(["organizations", "org-123"]);
    expect(queryKeys.organizations.members("org-123")).toEqual(["organizations", "org-123", "members"]);
    expect(queryKeys.organizations.apiKeys("org-123")).toEqual(["organizations", "org-123", "api-keys"]);
    expect(queryKeys.organizations.auditLogs("org-123")).toEqual(["organizations", "org-123", "audit-logs", undefined]);
  });

  it("generates correct project query keys", () => {
    expect(queryKeys.projects.all("org-123")).toEqual(["organizations", "org-123", "projects"]);
    expect(queryKeys.projects.detail("org-123", "proj-456")).toEqual(["organizations", "org-123", "projects", "proj-456"]);
  });

  it("generates correct services & discovery query keys", () => {
    expect(queryKeys.services.all("org-123", "proj-456")).toEqual([
      "organizations",
      "org-123",
      "projects",
      "proj-456",
      "services",
    ]);
    expect(queryKeys.services.endpoints("org-123", "proj-456", "srv-789")).toEqual([
      "organizations",
      "org-123",
      "projects",
      "proj-456",
      "services",
      "srv-789",
      "endpoints",
      undefined,
    ]);
  });

  it("generates correct monitoring & load testing query keys", () => {
    expect(queryKeys.monitoring.overview("org-123", "proj-456")).toEqual([
      "organizations",
      "org-123",
      "projects",
      "proj-456",
      "monitoring",
      "overview",
    ]);
    expect(queryKeys.loadTests.detail("org-123", "proj-456", "test-999")).toEqual([
      "organizations",
      "org-123",
      "projects",
      "proj-456",
      "load-tests",
      "test-999",
    ]);
    expect(queryKeys.loadTests.diagnostics("org-123", "proj-456", "test-999")).toEqual([
      "organizations",
      "org-123",
      "projects",
      "proj-456",
      "load-tests",
      "test-999",
      "diagnostics",
    ]);
  });
});
