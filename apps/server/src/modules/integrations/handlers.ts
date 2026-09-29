import type { Context } from "hono";
import type { AppEnv } from "../../types";
import * as IntegrationService from "./service";
import type {
  CiGateInput,
  CreateDeploymentInput,
  CreatePagingIntegrationInput,
} from "./types";

export async function ciGateHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CiGateInput;

  try {
    const result = await IntegrationService.evaluateCiGate(c.get("db"), organizationId, body);
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function createDeploymentHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CreateDeploymentInput;
  const result = await IntegrationService.createDeployment(c.get("db"), organizationId, body);
  return c.json(result, 201);
}

export async function listDeploymentsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const deployments = await IntegrationService.listDeployments(c.get("db"), organizationId, environmentId);
  return c.json({ deployments }, 200);
}

export async function createPagingHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CreatePagingIntegrationInput;
  const row = await IntegrationService.createPagingIntegration(c.get("db"), organizationId, body);
  return c.json(row, 201);
}

export async function listPagingHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const integrations = await IntegrationService.listPagingIntegrations(c.get("db"), organizationId);
  return c.json({ integrations }, 200);
}

export async function deletePagingHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const result = await IntegrationService.deletePagingIntegration(c.get("db"), organizationId, id);
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "INTEGRATION_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Integration not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function getLineageHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const changePlanId = c.req.param("changePlanId");

  try {
    const lineage = await IntegrationService.getLineage(c.get("db"), organizationId, changePlanId);
    return c.json(lineage, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CHANGE_PLAN_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Change plan not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function githubWebhookHandler(c: Context<AppEnv>) {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-hub-signature-256");
  const organizationId = c.req.header("x-organization-id") ?? c.get("organizationId");

  try {
    const result = await IntegrationService.handleGithubWebhook(
      c.get("db"),
      organizationId,
      rawBody,
      signature,
    );
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "INVALID_GITHUB_SIGNATURE") {
      return c.json({ error: "UNAUTHORIZED", message: "Invalid GitHub signature" }, 401);
    }
    if (msg === "INVALID_JSON") {
      return c.json({ error: "BAD_REQUEST", message: "Invalid JSON" }, 400);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}
