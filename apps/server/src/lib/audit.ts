import type { AppDb } from "./prisma";

export async function writeAudit(
  db: AppDb,
  input: {
    organizationId: string;
    actorId?: string | null;
    actorType?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    environmentId?: string;
    oldValue?: unknown;
    newValue?: unknown;
  },
): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId ?? undefined,
      actorType: input.actorType ?? "user",
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      environmentId: input.environmentId,
      oldValue: input.oldValue as object | undefined,
      newValue: input.newValue as object | undefined,
    },
  });
}
