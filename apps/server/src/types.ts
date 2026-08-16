import type { Role } from "@strim/shared";
import type { AppDb } from "../lib/prisma";

export type AppEnv = {
  Variables: {
    db: AppDb;
    userId?: string;
    email?: string;
    organizationId?: string;
    role?: Role;
    apiKeyId?: string;
    apiKeyScopes?: string[];
  };
};
