// One-time demo-data cleanup — LOGIN-SAFE.
// Removes the seeded DEMO clients (code CLI-*) and everything attached to them, plus the
// all-seeded creative / dev / task boards. NEVER touches User rows (logins stay valid) and
// KEEPS the real SEO clients (code SEO-*) with all their SEO data (blogs, keywords, backlinks,
// analytics, GMB, reports). Idempotent — safe to run more than once.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });

async function main() {
  const before = {
    users: await prisma.user.count(),
    clients: await prisma.client.count(),
    demo: await prisma.client.count({ where: { code: { startsWith: "CLI-" } } }),
    seo: await prisma.client.count({ where: { code: { startsWith: "SEO-" } } }),
    creative: await prisma.creativeTask.count(),
    dev: await prisma.devProject.count(),
    tasks: await prisma.task.count(),
  };
  console.log("BEFORE:", before);

  const cli = await prisma.client.findMany({ where: { code: { startsWith: "CLI-" } }, select: { id: true } });
  const ids = cli.map((c) => c.id);

  // 1) Delete children of the demo clients explicitly (don't rely on DB cascade).
  const scoped = { clientId: { in: ids } };
  await prisma.clientContact.deleteMany({ where: scoped });
  await prisma.clientService.deleteMany({ where: scoped });
  await prisma.deliverable.deleteMany({ where: scoped });
  await prisma.assignment.deleteMany({ where: scoped });
  await prisma.workUpdate.deleteMany({ where: scoped });
  await prisma.invoice.deleteMany({ where: scoped });
  await prisma.campaignEntry.deleteMany({ where: scoped });
  await prisma.socialPost.deleteMany({ where: scoped });
  await prisma.googleAdsCampaign.deleteMany({ where: scoped });
  await prisma.adsPerformance.deleteMany({ where: scoped });
  await prisma.gmbClient.deleteMany({ where: scoped });

  // 2) The creative / dev / generic-task boards are entirely seeded demo — clear them.
  await prisma.devActivity.deleteMany({});
  await prisma.devTask.deleteMany({});
  const dDev = await prisma.devProject.deleteMany({});
  const dCre = await prisma.creativeTask.deleteMany({});
  const dTask = await prisma.task.deleteMany({});

  // 3) Finally the demo clients themselves.
  const dCli = await prisma.client.deleteMany({ where: { id: { in: ids } } });

  console.log(`Deleted: demoClients=${dCli.count} creativeTasks=${dCre.count} devProjects=${dDev.count} tasks=${dTask.count}`);

  const after = {
    users: await prisma.user.count(),
    clients: await prisma.client.count(),
    seoClientsKept: await prisma.client.count({ where: { code: { startsWith: "SEO-" } } }),
  };
  console.log("AFTER:", after, "(users untouched · SEO clients kept)");
}
main().finally(() => process.exit(0));
