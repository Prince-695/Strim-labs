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
    data: { email: "priya@acme.test", name: "Priya Sharma", passwordHash },
  });

  const acme = await prisma.organization.create({
    data: { name: "Acme Corp", slug: "acme" },
  });

  await prisma.membership.create({
    data: {
      organizationId: acme.id,
      userId: priya.id,
      role: "OWNER",
    },
  });

  const checkoutApi = await prisma.project.create({
    data: {
      organizationId: acme.id,
      name: "Checkout API Gateway",
      targetUrl: "https://httpbin.org/get",
      defaultMethod: "GET",
      defaultHeaders: {
        "User-Agent": "Strim-LoadEngine/1.0",
        Accept: "application/json",
      },
    },
  });

  // Seed baseline completed test run
  const baselineRun = await prisma.testRun.create({
    data: {
      organizationId: acme.id,
      projectId: checkoutApi.id,
      userId: priya.id,
      name: "Baseline v1.0.0 Ramp-Up",
      profile: "RAMP_UP",
      status: "COMPLETED",
      targetUrl: "https://httpbin.org/get",
      method: "GET",
      concurrency: 100,
      durationSec: 30,
      totalRequests: 24500,
      avgRps: 816.6,
      peakRps: 1120.0,
      p50Ms: 42.5,
      p95Ms: 145.0,
      p99Ms: 290.0,
      errorRate: 0.012,
      statusCodes: {
        "200": 24206,
        "429": 250,
        "500": 44,
      },
      breakingPoint: {
        kneeRps: 850,
        failureRps: 1080,
        bottleneck: "RATE_LIMIT_429",
        verdict: "Safe up to 850 RPS. Degradation onset at 920 RPS. System bottleneck reached at 1,080 RPS with 429 Rate Limiting backpressure.",
      },
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(Date.now() - 3600000 + 30000),
    },
  });

  // Seed samples for baseline run
  const samplesData = [];
  for (let i = 0; i < 20; i++) {
    const vus = Math.round(5 + i * 5);
    const rps = Math.round(50 + i * 55);
    const p95 = Math.round(35 + (i > 12 ? Math.pow(i - 12, 1.8) * 20 : i * 3));
    samplesData.push({
      testRunId: baselineRun.id,
      timestamp: new Date(Date.now() - 3600000 + i * 1500),
      rps,
      activeVUs: vus,
      p50Ms: Math.round(p95 * 0.4),
      p95Ms: p95,
      p99Ms: Math.round(p95 * 1.6),
      errorCount: i > 15 ? (i - 15) * 8 : 0,
      statusCodes: {
        "200": rps - (i > 15 ? (i - 15) * 8 : 0),
        ...(i > 15 ? { "429": (i - 15) * 6, "500": (i - 15) * 2 } : {}),
      },
    });
  }

  await prisma.testSample.createMany({ data: samplesData });

  console.log("Seeded Strim Load Engine with user priya@acme.test (password: password123)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
