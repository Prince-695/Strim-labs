import type { ApiKeyScope } from "@strim/shared";

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type CreatedApiKey = ApiKeyRecord & {
  secret: string;
};

export type CreateApiKeyInput = {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
  environmentId?: string;
};
