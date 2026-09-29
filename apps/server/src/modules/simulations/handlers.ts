import type { Context } from "hono";
import type { AppEnv } from "../../types";
import * as SimulationService from "./service";
import type { CreateSimulationInput } from "./types";

export async function createSimulationHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CreateSimulationInput;

  try {
    const sim = await SimulationService.executeSimulation(
      c.get("db"),
      organizationId,
      c.get("userId"),
      body,
    );
    return c.json(sim, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "ENVIRONMENT_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Target environment not found" }, 404);
    }
    if (msg === "PRODUCTION_MUTATION_FORBIDDEN") {
      return c.json(
        {
          error: "FORBIDDEN",
          message: "Simulations must not mutate production runtime state directly. Run against staging or dedicated simulation environment.",
        },
        403,
      );
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function listSimulationsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  const simulations = await SimulationService.listSimulations(
    c.get("db"),
    organizationId,
    environmentId,
    limit,
  );

  return c.json({ simulations }, 200);
}

export async function getSimulationHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const sim = await SimulationService.getSimulation(c.get("db"), organizationId, id);
    return c.json(sim, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "SIMULATION_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Simulation not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}

export async function deleteSimulationHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");

  try {
    const result = await SimulationService.deleteSimulation(
      c.get("db"),
      organizationId,
      c.get("userId"),
      id,
    );
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "SIMULATION_NOT_FOUND") {
      return c.json({ error: "NOT_FOUND", message: "Simulation not found" }, 404);
    }
    return c.json({ error: "INTERNAL_ERROR", message: msg }, 500);
  }
}
