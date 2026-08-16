import { serve } from "@hono/node-server";
import { createPrisma } from "./lib/prisma";
import { createApp, startWorkers } from "./app";

const db = createPrisma();
const app = createApp(db);
await startWorkers(db);

const port = Number(process.env.SERVER_PORT ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Strim server listening on http://localhost:${port}`);
});
