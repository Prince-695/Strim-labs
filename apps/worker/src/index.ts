import { createPrisma } from "@strim/server/prisma";
import { startWorkers } from "@strim/server/workers";

const db = createPrisma();
await startWorkers(db);
console.log("Strim worker running (telemetry + replay processors)");
setInterval(() => undefined, 60_000);
