import { PrismaClient } from "@prisma/client";
import { loadWorkspaceEnv } from "@strim/db";

loadWorkspaceEnv();

export type AppDb = PrismaClient;

export function createPrisma(): PrismaClient {
  loadWorkspaceEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env in the repo root.");
  }
  return new PrismaClient({ datasourceUrl: url });
}
