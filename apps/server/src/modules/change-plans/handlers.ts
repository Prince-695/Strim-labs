import type { Context } from "hono";
import type { AppEnv } from "../../types";
import * as ChangePlanService from "./service";
import type {
  ApproveChangePlanInput,
  CreateChangePlanInput,
  GuardrailCheckInput,
  UpdateChangePlanInput,
} from "./types";

export async function createChangePlanHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CreateChangePlanInput;

  try {
    const plan = await ChangePlanService.createChangePlan(
      c.get("db"),
      organizationId,
      c.get("userId"),
      body,
    );
    return c.json(plan, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function listChangePlansHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  const plans = await ChangePlanService.listChangePlans(
    c.get("db"),
    organizationId,
    environmentId,
    limit,
  );

  return c.json({ changePlans: plans }, 200);
}

export async function getChangePlanHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const plan = await ChangePlanService.getChangePlan(c.get("db"), organizationId, id);
    return c.json(plan, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function updateChangePlanHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const body = (await c.req.json()) as UpdateChangePlanInput;

  try {
    const updated = await ChangePlanService.updateChangePlan(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
      body,
    );
    return c.json(updated, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    if (msg === "CANNOT_EDIT_IN_FLIGHT_PLAN") {
      return c.json({ error: "CONFLICT", message: "Cannot edit change plan once approved or in rollout" }, 409);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function deleteChangePlanHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const result = await ChangePlanService.deleteChangePlan(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
    );
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    if (msg === "CANNOT_DELETE_ACTIVE_ROLLOUT") {
      return c.json({ error: "CONFLICT", message: "Cannot delete change plan during active rollout" }, 409);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function simulateChangePlanHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const plan = await ChangePlanService.simulateChangePlan(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
    );
    return c.json(plan, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function approveChangePlanHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const body = ((await c.req.json().catch(() => ({}))) ?? {}) as ApproveChangePlanInput;

  try {
    const plan = await ChangePlanService.approveChangePlan(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
      body,
    );
    return c.json(plan, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    if (msg.startsWith("APPROVAL_CONFLICT")) {
      return c.json({ error: "CONFLICT", message: msg.replace("APPROVAL_CONFLICT: ", "") }, 409);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function rejectChangePlanHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const plan = await ChangePlanService.rejectChangePlan(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
    );
    return c.json(plan, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function rolloutChangePlanHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const result = await ChangePlanService.advanceRollout(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
    );
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function guardrailCheckHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const body = ((await c.req.json().catch(() => ({}))) ?? {}) as GuardrailCheckInput;

  try {
    const result = await ChangePlanService.checkGuardrails(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
      body,
    );
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function rollbackChangePlanHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const updated = await ChangePlanService.rollbackChangePlan(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
    );
    return c.json(updated, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}
