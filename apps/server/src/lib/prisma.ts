import { PrismaClient } from "@prisma/client";

export type AppDb = PrismaClient;

export function createPrisma(): PrismaClient {
  return new PrismaClient();
}
