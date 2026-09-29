import type { AppDb } from "../../lib/prisma";
import type { AuditFilterInput, AuditLogRecord } from "./types";

export class AuditService {
  static async queryAuditLogs(
    db: AppDb,
    organizationId: string,
    filters: AuditFilterInput,
  ): Promise<AuditLogRecord[]> {
    return db.auditLog.findMany({
      where: {
        organizationId,
        actorId: filters.user || undefined,
        action: filters.action || undefined,
        resourceType: filters.resource || undefined,
        environmentId: filters.environmentId || undefined,
        createdAt: {
          gte: filters.from ? new Date(filters.from) : undefined,
          lte: filters.to ? new Date(filters.to) : undefined,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  static async exportAuditLogs(
    db: AppDb,
    organizationId: string,
  ): Promise<{ logs: AuditLogRecord[]; exportedAt: string }> {
    const logs = await db.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    return { logs, exportedAt: new Date().toISOString() };
  }
}
