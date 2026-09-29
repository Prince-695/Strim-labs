import type { Context } from "hono";
import type { AppEnv } from "../../types";
import * as PolicyService from "./service";
import type {
  CheckDriftInput,
  CreatePolicyInput,
  CreatePromotionInput,
  CreateRateLimitInput,
  DriftAction,
  UpdatePolicyInput,
  UpdateRateLimitInput,
} from "./types";

export async function createPolicyHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CreatePolicyInput;

  try {
    const policy = await PolicyService.createPolicy(
      c.get("db"),
      organizationId,
      c.get("userId"),
      body,
    );
    return c.json(policy, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function listPoliciesHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const policies = await PolicyService.listPolicies(c.get("db"), organizationId);
  return c.json({ policies }, 200);
}

export async function getPolicyHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const policy = await PolicyService.getPolicy(c.get("db"), organizationId, id);
    return c.json(policy, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "POLICY_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Policy not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function updatePolicyHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const body = (await c.req.json()) as UpdatePolicyInput;

  try {
    const updated = await PolicyService.updatePolicy(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
      body,
    );
    return c.json(updated, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "POLICY_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Policy not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function deletePolicyHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const result = await PolicyService.deletePolicy(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
    );
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "POLICY_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Policy not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function createRateLimitHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CreateRateLimitInput;
  const rl = await PolicyService.createRateLimit(c.get("db"), organizationId, body);
  return c.json(rl, 201);
}

export async function listRateLimitsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const limits = await PolicyService.listRateLimits(c.get("db"), organizationId);
  return c.json({ rateLimits: limits }, 200);
}

export async function updateRateLimitHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const body = (await c.req.json()) as UpdateRateLimitInput;

  try {
    const updated = await PolicyService.updateRateLimit(c.get("db"), organizationId, id, body);
    return c.json(updated, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "RATE_LIMIT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Rate limit not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function deleteRateLimitHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const result = await PolicyService.deleteRateLimit(c.get("db"), organizationId, id);
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "RATE_LIMIT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Rate limit not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function evaluateRateLimitHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const applicationId = c.req.query("applicationId");
  const result = await PolicyService.evaluateRateLimit(c.get("db"), organizationId, applicationId);
  return c.json(result, 200);
}

export async function createPromotionHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CreatePromotionInput;

  try {
    const promo = await PolicyService.createPromotion(c.get("db"), organizationId, body);
    return c.json(promo, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("SIMULATION_REQUIRED")) {
      return c.json({ error: "SIMULATION_REQUIRED", message: "Promotion requires a passing simulation" }, 409);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function checkDriftHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CheckDriftInput;

  try {
    const result = await PolicyService.checkDrift(c.get("db"), organizationId, body);
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "ENVIRONMENT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Target environment not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function listDriftReportsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const reports = await PolicyService.listDriftReports(c.get("db"), organizationId, environmentId);
  return c.json({ reports }, 200);
}

export async function remediateDriftHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const action = c.req.param("action") as DriftAction;

  try {
    const result = await PolicyService.remediateDrift(c.get("db"), organizationId, id, action);
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "INVALID_DRIFT_ACTION") {
      return c.json({ error: "VALIDATION", message: "Invalid drift action" }, 400);
    }
    if (msg === "DRIFT_REPORT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Drift report not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}
