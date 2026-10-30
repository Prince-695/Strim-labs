import type { Role } from "@strim/shared";
import type { PrismaClient } from "@prisma/client";

export type AppDb = PrismaClient;

export type AppEnv = {
  Variables: {
    db: AppDb;
    userId?: string;
    email?: string;
    sessionId?: string;
    organizationId?: string;
    role?: Role;
    projectId?: string;
    ingestKey?: string;
    apiKeyId?: string;
    apiKeyScopes?: string[];
    requestId?: string;
  };
};
