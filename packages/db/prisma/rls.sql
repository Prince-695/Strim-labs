-- RLS proof-of-concept for audit_logs (Phase 0).
-- Application still enforces tenant scope; this is defense in depth.

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_org_isolation ON "AuditLog";
CREATE POLICY audit_org_isolation ON "AuditLog"
  USING (
    current_setting('app.organization_id', true) IS NULL
    OR current_setting('app.organization_id', true) = ''
    OR "organizationId" = current_setting('app.organization_id', true)
  );
