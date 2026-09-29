import type { Context } from "hono";
import type { AppEnv } from "../../types";
import * as BillingService from "./service";
import type {
  BillingPlan,
  CreateRetentionPolicyInput,
  SsoConfigInput,
  StartChaosInput,
} from "./types";

export async function getBillingOverviewHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const result = await BillingService.getBillingOverview(c.get("db"), organizationId);
  return c.json(result, 200);
}

export async function generateInvoiceHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const invoice = await BillingService.generateInvoice(c.get("db"), organizationId);
  return c.json(invoice, 201);
}

export async function listInvoicesHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const invoices = await BillingService.listInvoices(c.get("db"), organizationId);
  return c.json({ invoices }, 200);
}

export async function updatePlanHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as { plan: BillingPlan };
  const result = await BillingService.updatePlan(c.get("db"), organizationId, body.plan);
  return c.json(result, 200);
}

export async function listRetentionPoliciesHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const policies = await BillingService.listRetentionPolicies(c.get("db"), organizationId);
  return c.json({ policies }, 200);
}

export async function createRetentionPolicyHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CreateRetentionPolicyInput;
  try {
    const policy = await BillingService.createRetentionPolicy(c.get("db"), organizationId, body);
    return c.json(policy, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "AUDIT_RETENTION_FLOOR_BREACH") {
      return c.json({ error: "VALIDATION", message: "Audit retention floor is 365 days" }, 400);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function purgeRetentionHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const result = await BillingService.purgeRetention(c.get("db"), organizationId, c.get("userId"));
  return c.json(result, 200);
}

export async function getSsoConfigHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const result = await BillingService.getSsoConfig(c.get("db"), organizationId);
  return c.json(result, 200);
}

export async function updateSsoConfigHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as SsoConfigInput;
  const result = await BillingService.updateSsoConfig(c.get("db"), organizationId, body, c.get("userId"));
  return c.json(result, 200);
}

export async function listChaosExperimentsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const experiments = await BillingService.listChaosExperiments(c.get("db"), organizationId, environmentId);
  return c.json({ experiments }, 200);
}

export async function startChaosExperimentHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as StartChaosInput;
  try {
    const exp = await BillingService.startChaosExperiment(
      c.get("db"),
      organizationId,
      body,
      c.get("role"),
      c.get("userId"),
    );
    return c.json(exp, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "ENVIRONMENT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Environment not found" }, 404);
    }
    if (msg === "FORBIDDEN_PRODUCTION_CHAOS") {
      return c.json({ error: "FORBIDDEN", message: "Production chaos requires production-tier permission" }, 403);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function revertChaosExperimentHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  try {
    const exp = await BillingService.revertChaosExperiment(c.get("db"), organizationId, id, c.get("userId"));
    return c.json(exp, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "EXPERIMENT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Chaos experiment not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}
