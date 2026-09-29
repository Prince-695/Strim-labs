export type AuditFilterInput = {
  user?: string;
  action?: string;
  resource?: string;
  environmentId?: string;
  from?: string;
  to?: string;
};

export type AuditLogRecord = {
  id: string;
  organizationId: string;
  actorId: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  environmentId: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: Date;
};
