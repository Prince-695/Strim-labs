import type { Context } from "hono";
import type { AppEnv } from "../../types";
import { KeyService } from "./service";
import type { CreateApiKeyInput } from "./types";

export const listKeysHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const keys = await KeyService.listKeys(c.get("db"), organizationId);
  return c.json({ keys: keys as any }, 200);
};

export const createKeyHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const userId = c.get("userId");
  const body = (await c.req.json()) as CreateApiKeyInput;

  const result = await KeyService.createKey(c.get("db"), organizationId, userId, body);
  return c.json(result.data as any, result.status as any);
};

export const revokeKeyHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const userId = c.get("userId");
  const id = c.req.param("id");

  const result = await KeyService.revokeKey(c.get("db"), organizationId, userId, id);
  return c.json(result.data as any, result.status as any);
};

export const rotateKeyHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const userId = c.get("userId");
  const id = c.req.param("id");

  const result = await KeyService.rotateKey(c.get("db"), organizationId, userId, id);
  return c.json(result.data as any, result.status as any);
};
