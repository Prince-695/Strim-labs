import type { AppDb } from "../../lib/prisma";
import { randomToken, sha256 } from "../../lib/crypto";
import { writeAudit } from "../../lib/audit";
import type { CreateApiKeyInput, CreatedApiKey, ApiKeyRecord } from "./types";

export class KeyService {
  static async listKeys(db: AppDb, organizationId: string): Promise<ApiKeyRecord[]> {
    return db.apiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createKey(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    input: CreateApiKeyInput,
  ): Promise<{ status: number; data: CreatedApiKey | { error: string; message: string } }> {
    if (input.scopes.includes("telemetry:write") && input.scopes.includes("config:write")) {
      return {
        status: 400,
        data: {
          error: "VALIDATION",
          message: "Do not combine telemetry:write with administrative write scopes on one key",
        },
      };
    }

    const raw = `sk_${randomToken()}`;
    const key = await db.apiKey.create({
      data: {
        organizationId,
        name: input.name,
        prefix: raw.slice(0, 10),
        keyHash: sha256(raw),
        scopes: input.scopes,
        environmentId: input.environmentId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        createdById: userId,
      },
    });

    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "api_key.create",
      resourceType: "api_key",
      resourceId: key.id,
      newValue: { name: key.name, scopes: key.scopes },
    });

    return {
      status: 201,
      data: {
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        expiresAt: key.expiresAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
        secret: raw,
      },
    };
  }

  static async revokeKey(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    keyId: string,
  ): Promise<{ status: number; data: ApiKeyRecord | { error: string; message: string } }> {
    const existing = await db.apiKey.findFirst({ where: { id: keyId, organizationId } });
    if (!existing) {
      return { status: 404, data: { error: "NOT_FOUND", message: "API key not found" } };
    }

    const key = await db.apiKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "api_key.revoke",
      resourceType: "api_key",
      resourceId: key.id,
    });

    return {
      status: 200,
      data: {
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        expiresAt: key.expiresAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
      },
    };
  }

  static async rotateKey(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    keyId: string,
  ): Promise<{ status: number; data: CreatedApiKey | { error: string; message: string } }> {
    const existing = await db.apiKey.findFirst({ where: { id: keyId, organizationId } });
    if (!existing) {
      return { status: 404, data: { error: "NOT_FOUND", message: "API key not found" } };
    }

    const raw = `sk_${randomToken()}`;
    const key = await db.apiKey.update({
      where: { id: existing.id },
      data: { prefix: raw.slice(0, 10), keyHash: sha256(raw), revokedAt: null },
    });

    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "api_key.rotate",
      resourceType: "api_key",
      resourceId: key.id,
    });

    return {
      status: 200,
      data: {
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        expiresAt: key.expiresAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
        secret: raw,
      },
    };
  }
}
