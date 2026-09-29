import type { Context } from "hono";
import type { AppEnv } from "../../types";
import { AuditService } from "./service";
import type { AuditFilterInput } from "./types";

export const listAuditLogsHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const filters: AuditFilterInput = {
    user: c.req.query("user"),
    action: c.req.query("action"),
    resource: c.req.query("resource"),
    environmentId: c.req.query("environmentId"),
    from: c.req.query("from"),
    to: c.req.query("to"),
  };

  const logs = await AuditService.queryAuditLogs(c.get("db"), organizationId, filters);
  return c.json({ logs: logs as any }, 200);
};

export const exportAuditLogsHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const result = await AuditService.exportAuditLogs(c.get("db"), organizationId);
  return c.json({ logs: result.logs as any, exportedAt: result.exportedAt }, 200);
};

export const patchAuditLogHandler = async (c: Context<AppEnv>) => {
  return c.json({ error: "FORBIDDEN", message: "Audit records are immutable" }, 405);
};

export const deleteAuditLogHandler = async (c: Context<AppEnv>) => {
  return c.json({ error: "FORBIDDEN", message: "Audit records are immutable" }, 405);
};
