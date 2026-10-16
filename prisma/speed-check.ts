// Why do the dashboards open slowly? — read only, nothing is changed.
// Prints how big the database and each table are, and how long the database work behind the
// dashboards takes (the same reads the pages do), so a slow table or query stands out.
//
//   npx tsx prisma/speed-check.ts
//
// Same Prisma + SQLite adapter as the app.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync, statSync } from "node:fs";

(function loadEnv() {
  for (const p of [".env", "prisma/../.env"]) {
    try {
      for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        if (process.env[m[1]] === undefined) process.env[m[1]] = val;
      }
      break;
    } catch { /* try next path */ }
  }
})();
const DB = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${DB}` }) });

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const size = (p: string) => { try { return statSync(p).size; } catch { return -1; } };

async function timed<T>(label: string, run: () => Promise<T>, describe: (r: T) => string) {
  const t = performance.now();
  const r = await run();
  const ms = Math.round(performance.now() - t);
  console.log(`  ${String(ms).padStart(5)} ms  ${label} — ${describe(r)}${ms > 300 ? "   ← SLOW" : ""}`);
}

async function main() {
  console.log(`Database file: ${DB}  ${mb(size(DB))}   (journal: ${size(DB + "-wal") >= 0 ? "wal " + mb(size(DB + "-wal")) : size(DB + "-journal") >= 0 ? "journal " + mb(size(DB + "-journal")) : "none"})`);
  const mode = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>("PRAGMA journal_mode");
  console.log(`Journal mode: ${mode[0]?.journal_mode}`);

  // rows per table, biggest first
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'");
  const counts: [string, number][] = [];
  for (const { name } of tables) {
    const r = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(`SELECT COUNT(*) AS n FROM "${name}"`);
    counts.push([name, Number(r[0]?.n ?? 0)]);
  }
  counts.sort((a, b) => b[1] - a[1]);
  console.log("\nRows per table (biggest first):");
  for (const [name, n] of counts.slice(0, 15)) console.log(`  ${String(n).padStart(7)}  ${name}`);

  // the biggest text columns that every page reads (follow-up / notes logs)
  const big = await prisma.$queryRawUnsafe<{ t: string; kb: number }[]>(
    "SELECT 'Client.followupLog' AS t, ROUND(SUM(LENGTH(followupLog))/1024.0, 1) AS kb FROM Client UNION ALL SELECT 'SalesInvoice.notesLog', ROUND(SUM(LENGTH(notesLog))/1024.0, 1) FROM SalesInvoice UNION ALL SELECT 'SalesInvoice.items', ROUND(SUM(LENGTH(items))/1024.0, 1) FROM SalesInvoice UNION ALL SELECT 'Notification (all)', ROUND(SUM(LENGTH(title) + LENGTH(body))/1024.0, 1) FROM Notification",
  );
  console.log("\nText kept in these columns:");
  for (const b of big) console.log(`  ${String(b.kb ?? 0).padStart(8)} KB  ${b.t}`);

  console.log("\nDatabase work behind the pages (each run twice, second run shown):");
  const runs: [string, () => Promise<unknown>, (r: unknown) => string][] = [
    ["all invoices (Invoices, Accountant dashboard)", () => prisma.salesInvoice.findMany(), (r) => `${(r as unknown[]).length} rows`],
    ["all clients with services (Clients lists)", () => prisma.client.findMany({ include: { services: true, accountManager: true } }), (r) => `${(r as unknown[]).length} rows`],
    ["all payments", () => prisma.payment.findMany(), (r) => `${(r as unknown[]).length} rows`],
    ["unread notifications (bell, every page)", () => prisma.notification.findMany({ where: { read: false }, orderBy: { createdAt: "desc" }, take: 12 }), (r) => `${(r as unknown[]).length} rows`],
    ["all notifications count", () => prisma.notification.count(), (r) => `${r} rows`],
    ["work updates this month (reports, dashboards)", () => prisma.workUpdate.findMany({ where: { date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }), (r) => `${(r as unknown[]).length} rows`],
    ["creative tasks (design / video boards)", () => prisma.creativeTask.findMany({ include: { client: true, assignedTo: true } }), (r) => `${(r as unknown[]).length} rows`],
    ["leads with activity (sales)", () => prisma.lead.findMany({ include: { activities: true } }), (r) => `${(r as unknown[]).length} rows`],
  ];
  for (const [label, run, describe] of runs) { await run(); await timed(label, run as () => Promise<unknown>, describe); }
  console.log("\nSPEED_CHECK_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
