import { PrismaClient } from "@prisma/client";
import { loadWorkspaceEnv } from "./env";

loadWorkspaceEnv();

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function hash(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

async function main() {
  await resetDatabase();

  const passwordHash = await hash("password123");

  const priya = await prisma.user.create({
    data: { email: "priya@acme.test", name: "Priya", passwordHash },
  });
  const marcus = await prisma.user.create({
    data: { email: "marcus@globex.test", name: "Marcus", passwordHash },
  });

  const acme = await prisma.organization.create({
    data: { name: "Acme", slug: "acme" },
  });
  const globex = await prisma.organization.create({
    data: { name: "Globex", slug: "globex" },
  });

  const acmePlatform = await prisma.team.create({
    data: { organizationId: acme.id, name: "Platform" },
  });
  const acmeSre = await prisma.team.create({
    data: { organizationId: acme.id, name: "SRE" },
  });
  const globexPlatform = await prisma.team.create({
    data: { organizationId: globex.id, name: "Platform" },
  });

  await prisma.teamMember.createMany({
    data: [
      { teamId: acmePlatform.id, userId: priya.id },
      { teamId: acmeSre.id, userId: priya.id },
      { teamId: globexPlatform.id, userId: marcus.id },
    ],
  });

  await prisma.membership.createMany({
    data: [
      { organizationId: acme.id, userId: priya.id, role: "OWNER", scope: "ORGANIZATION" },
      { organizationId: globex.id, userId: marcus.id, role: "OWNER", scope: "ORGANIZATION" },
    ],
  });

  const acmeWs = await prisma.workspace.create({
    data: { organizationId: acme.id, name: "Payments", slug: "payments" },
  });
  const globexWs = await prisma.workspace.create({
    data: { organizationId: globex.id, name: "Core", slug: "core" },
  });

  const acmeProj = await prisma.project.create({
    data: {
      organizationId: acme.id,
      workspaceId: acmeWs.id,
      name: "Checkout",
      slug: "checkout",
    },
  });
  const globexProj = await prisma.project.create({
    data: {
      organizationId: globex.id,
      workspaceId: globexWs.id,
      name: "Billing",
      slug: "billing",
    },
  });

  const checkout = await prisma.application.create({
    data: {
      organizationId: acme.id,
      projectId: acmeProj.id,
      name: "Checkout API",
      repository: "github.com/acme/checkout",
      language: "TypeScript",
      framework: "Hono",
      region: "us-east-1",
      version: "1.0.0",
      ownerTeamId: acmePlatform.id,
      technicalOwnerId: priya.id,
      oncallTeamId: acmeSre.id,
    },
  });
  const billing = await prisma.application.create({
    data: {
      organizationId: globex.id,
      projectId: globexProj.id,
      name: "Billing API",
      repository: "github.com/globex/billing",
      language: "TypeScript",
      framework: "Hono",
      region: "us-west-2",
      version: "1.0.0",
      ownerTeamId: globexPlatform.id,
      technicalOwnerId: marcus.id,
      oncallTeamId: globexPlatform.id,
    },
  });

  for (const app of [checkout, billing]) {
    for (const [name, type] of [
      ["Development", "DEVELOPMENT"],
      ["Staging", "STAGING"],
      ["Production", "PRODUCTION"],
    ] as const) {
      await prisma.environment.create({
        data: {
          organizationId: app.organizationId,
          applicationId: app.id,
          name,
          type,
          region: app.region,
          declaredState: {
            "cache.enabled": false,
            "cache.ttl": 0,
            "checkout.timeout": 5000,
            retry_count: 2,
          },
        },
      });
    }
  }

  const acmeProd = await prisma.environment.findFirstOrThrow({
    where: { applicationId: checkout.id, type: "PRODUCTION" },
  });

  await prisma.runtimeVersion.create({
    data: {
      organizationId: acme.id,
      environmentId: acmeProd.id,
      seq: 1,
      approved: true,
      values: {
        "cache.enabled": false,
        "cache.ttl": 0,
        "checkout.timeout": 5000,
        retry_count: 2,
      },
    },
  });

  await prisma.billingAccount.create({
    data: { organizationId: acme.id, plan: "team" },
  });
  await prisma.billingAccount.create({
    data: { organizationId: globex.id, plan: "team" },
  });

  await prisma.retentionPolicy.createMany({
    data: [
      { organizationId: acme.id, dataClass: "request_payloads", days: 30 },
      { organizationId: acme.id, dataClass: "audit", days: 365 },
      { organizationId: acme.id, dataClass: "metrics", days: 90 },
    ],
  });

  console.log("Seeded Acme (priya@acme.test) and Globex (marcus@globex.test). Password: password123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
