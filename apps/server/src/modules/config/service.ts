import { diffRuntimeState, formatDiffLine } from "@strim/shared";
import type { PrismaClient } from "@prisma/client";
import { writeAudit } from "../../lib/audit";
import { queue } from "../../lib/queue";
import type { RuntimeDiffResult, SdkConfigResult, UpsertConfigurationInput } from "./types";

export class ConfigService {
  /**
   * Lists configurations with their latest 5 versions.
   */
  static async listConfigurations(
    db: PrismaClient,
    organizationId: string,
    environmentId?: string,
  ) {
    return db.configuration.findMany({
      where: {
        organizationId,
        environmentId: environmentId || undefined,
      },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { key: "asc" },
    });
  }

  /**
   * Retrieves a specific configuration key and up to 20 historical versions.
   */
  static async getConfigurationByKey(
    db: PrismaClient,
    organizationId: string,
    environmentId: string,
    key: string,
  ) {
    const config = await db.configuration.findUnique({
      where: { environmentId_key: { environmentId, key } },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 20 } },
    });

    if (!config || config.organizationId !== organizationId) {
      return null;
    }
    return config;
  }

  /**
   * Upserts configuration value, creates immutable version, bumps sequential runtimeVersion,
   * logs audit, and broadcasts CONFIG_CHANGED.
   */
  static async upsertConfiguration(
    db: PrismaClient,
    organizationId: string,
    actorId: string | undefined,
    input: UpsertConfigurationInput,
  ) {
    const { environmentId, key, value, reason } = input;

    const env = await db.environment.findFirst({
      where: { id: environmentId, organizationId },
    });
    if (!env) return null;

    const existing = await db.configuration.findUnique({
      where: { environmentId_key: { environmentId, key } },
    });

    const config = await db.configuration.upsert({
      where: { environmentId_key: { environmentId, key } },
      create: {
        organizationId,
        environmentId,
        key,
        value: value as object,
      },
      update: {
        value: value as object,
      },
    });

    await db.configurationVersion.create({
      data: {
        configurationId: config.id,
        actorId,
        reason,
        oldValue: existing?.value as object | undefined,
        newValue: value as object,
      },
    });

    const all = await db.configuration.findMany({ where: { environmentId } });
    const values = Object.fromEntries(all.map((x) => [x.key, x.value]));

    const lastVersion = await db.runtimeVersion.findFirst({
      where: { environmentId },
      orderBy: { seq: "desc" },
    });

    const version = await db.runtimeVersion.create({
      data: {
        organizationId,
        environmentId,
        seq: (lastVersion?.seq ?? 0) + 1,
        values: values as object,
        approved: true,
      },
    });

    await writeAudit(db, {
      organizationId,
      actorId,
      action: "configuration.update",
      resourceType: "configuration",
      resourceId: config.id,
      environmentId,
      oldValue: existing?.value,
      newValue: value,
    });

    queue.publish("CONFIG_CHANGED", {
      organizationId,
      environmentId,
      key,
      values,
    });

    return { configuration: config, runtimeVersion: version };
  }

  /**
   * Deletes a configuration key, records deletion version with null,
   * increments runtime version, audits, and publishes event.
   */
  static async deleteConfiguration(
    db: PrismaClient,
    organizationId: string,
    actorId: string | undefined,
    environmentId: string,
    key: string,
    reason = "Deleted via API",
  ) {
    const existing = await db.configuration.findUnique({
      where: { environmentId_key: { environmentId, key } },
    });
    if (!existing || existing.organizationId !== organizationId) {
      return null;
    }

    await db.configurationVersion.create({
      data: {
        configurationId: existing.id,
        actorId,
        reason,
        oldValue: existing.value as object,
        newValue: null as unknown as object,
      },
    });

    await db.configuration.delete({
      where: { id: existing.id },
    });

    const all = await db.configuration.findMany({ where: { environmentId } });
    const values = Object.fromEntries(all.map((x) => [x.key, x.value]));

    const lastVersion = await db.runtimeVersion.findFirst({
      where: { environmentId },
      orderBy: { seq: "desc" },
    });

    const version = await db.runtimeVersion.create({
      data: {
        organizationId,
        environmentId,
        seq: (lastVersion?.seq ?? 0) + 1,
        values: values as object,
        approved: true,
      },
    });

    await writeAudit(db, {
      organizationId,
      actorId,
      action: "configuration.delete",
      resourceType: "configuration",
      resourceId: existing.id,
      environmentId,
      oldValue: existing.value,
      newValue: null,
    });

    queue.publish("CONFIG_CHANGED", {
      organizationId,
      environmentId,
      key,
      values,
    });

    return { ok: true, deletedKey: key, runtimeVersion: version };
  }

  /**
   * Lists runtime versions ordered sequentially by seq desc.
   */
  static async listRuntimeVersions(
    db: PrismaClient,
    organizationId: string,
    environmentId?: string,
  ) {
    return db.runtimeVersion.findMany({
      where: {
        organizationId,
        environmentId: environmentId || undefined,
      },
      orderBy: { seq: "desc" },
    });
  }

  /**
   * Calculates diff between two runtime versions.
   */
  static async diffVersions(
    db: PrismaClient,
    organizationId: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<RuntimeDiffResult | null> {
    const [left, right] = await Promise.all([
      db.runtimeVersion.findFirst({ where: { id: fromVersionId, organizationId } }),
      db.runtimeVersion.findFirst({ where: { id: toVersionId, organizationId } }),
    ]);

    if (!left || !right) return null;

    const diffs = diffRuntimeState(
      (left.values ?? {}) as Record<string, unknown>,
      (right.values ?? {}) as Record<string, unknown>,
    );

    return {
      diffs,
      lines: diffs.map(formatDiffLine),
    };
  }

  /**
   * Returns active approved configuration for SDK consumers, including proposed canary rollouts.
   */
  static async getSdkConfig(
    db: PrismaClient,
    organizationId: string,
    environmentId: string,
  ): Promise<SdkConfigResult> {
    const version = await db.runtimeVersion.findFirst({
      where: { environmentId, organizationId, approved: true },
      orderBy: { seq: "desc" },
    });

    const activePlan = await db.changePlan.findFirst({
      where: {
        environmentId,
        organizationId,
        state: { in: ["ROLLING_OUT", "MONITORING"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    let proposed: Record<string, unknown> = {};
    if (activePlan?.proposedVersionId) {
      const pv = await db.runtimeVersion.findFirst({ where: { id: activePlan.proposedVersionId } });
      proposed = (pv?.values as Record<string, unknown>) ?? {};
    }

    return {
      values: (version?.values as Record<string, unknown>) ?? {},
      proposed,
      rolloutPercent: activePlan?.rolloutPercent ?? 0,
    };
  }
}
