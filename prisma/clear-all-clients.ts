// FULL client-data wipe — LOGIN-SAFE.
// Deletes EVERY client and all data attached to any client (SEO, ads, social, creative,
// dev, work, invoices, reports, analytics, notifications) so you can enter real data
// manually from scratch. NEVER touches User rows — all logins stay valid.
// Idempotent — safe to run more than once.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });

async function main() {
  const before = { users: await prisma.user.count(), clients: await prisma.client.count() };
  console.log("BEFORE:", before);

  // Delete children first (explicit — do not rely on DB cascade), then the clients.
  await prisma.clientContact.deleteMany({});
  await prisma.clientService.deleteMany({});
  await prisma.deliverable.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.workUpdate.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.campaignEntry.deleteMany({});
  await prisma.socialPost.deleteMany({});
  await prisma.googleAdsCampaign.deleteMany({});
  await prisma.adsPerformance.deleteMany({});
  await prisma.seoAnalytics.deleteMany({});
  await prisma.seoBlogSlot.deleteMany({});
  await prisma.seoKeyword.deleteMany({});
  await prisma.seoBacklink.deleteMany({});
  await prisma.gmbClient.deleteMany({});
  await prisma.seoReport.deleteMany({});
  await prisma.devActivity.deleteMany({});
  await prisma.devTask.deleteMany({});
  await prisma.devProject.deleteMany({});
  await prisma.creativeTask.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.notification.deleteMany({});
  const dCli = await prisma.client.deleteMany({});

  console.log(`Deleted ALL client data · clients removed = ${dCli.count}`);
  const after = { users: await prisma.user.count(), clients: await prisma.client.count() };
  console.log("AFTER:", after, "(users / logins untouched)");
}
main().finally(() => process.exit(0));
