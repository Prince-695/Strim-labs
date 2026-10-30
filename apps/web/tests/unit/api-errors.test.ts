import { describe, expect, it } from "bun:test";
import { ApiError, formatApiError } from "../../src/lib/api/errors";

describe("ApiError class and parsing", () => {
  it("initializes with status, message, code, and details", () => {
    const error = new ApiError(403, "Organization quota exceeded", "TENANT_QUOTA_EXCEEDED", {
      maxOrganizations: 3,
      currentOrganizations: 3,
    });

    expect(error.message).toBe("Organization quota exceeded");
    expect(error.status).toBe(403);
    expect(error.code).toBe("TENANT_QUOTA_EXCEEDED");
    expect(error.details).toEqual({
      maxOrganizations: 3,
      currentOrganizations: 3,
    });
    expect(error.name).toBe("ApiError");
    expect(error instanceof Error).toBe(true);
  });

  it("handles formatting helper correctly", () => {
    const apiError = new ApiError(500, "Internal server error");
    expect(formatApiError(apiError)).toBe("Internal server error");

    const standardError = new Error("Network timeout");
    expect(formatApiError(standardError)).toBe("Network timeout");

    expect(formatApiError("something strange")).toBe("An unexpected error occurred. Please try again.");
  });
});
