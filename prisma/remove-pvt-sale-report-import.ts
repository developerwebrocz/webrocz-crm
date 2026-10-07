// Undoes the Web Rocz Pvt Ltd "sale report" import — and nothing else.
// Removes every invoice the importer added (they carry the note "Imported from the sale
// report.") together with its payments, and the clients that the import itself created
// (a client that only has imported invoices and whose start date is that first invoice).
// A client that existed before, or has any other invoice, is kept — only its imported
// invoices go. Team logins and all other companies' data are never touched.
//
//   Preview (changes nothing):   npx tsx prisma/remove-pvt-sale-report-import.ts
//   Delete (backs up first):     npx tsx prisma/remove-pvt-sale-report-import.ts --yes
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync } from "node:fs";

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
const DB_URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: DB_URL }) });
const YES = process.argv.includes("--yes");
const IMPORT_NOTE = "Imported from the sale report."; // set by importWebRoczPvtSaleReport
const inr = (v: number) => "Rs " + (v || 0).toLocaleString("en-IN");

async function main() {
  console.log(YES ? "=== REMOVING the Pvt Ltd sale-report import ===" : "=== PREVIEW — nothing is changed (add --yes to delete) ===");

  const imported = await prisma.salesInvoice.findMany({ where: { company: "WEB_ROCZ_PVT", notes: IMPORT_NOTE }, select: { id: true, number: true, total: true, issueDate: true, clientId: true } });
  console.log(`\nImported invoices to remove: ${imported.length} (${inr(imported.reduce((s, i) => s + i.total, 0))})`);
  if (!imported.length) { console.log("Nothing was imported from the sale report — nothing to remove."); console.log(YES ? "\nIMPORT_REMOVED" : "\nPREVIEW_DONE — nothing was changed."); return; }
  const dates = imported.map((i) => i.issueDate).sort();
  console.log(`  invoice dates ${dates[0]} to ${dates[dates.length - 1]}`);

  // Which of their clients were created by the import itself?
  const importedIds = new Set(imported.map((i) => i.id));
  const clientIds = [...new Set(imported.map((i) => i.clientId).filter((x): x is string => !!x))];
  const clients = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, code: true, name: true, onboardDate: true, accountManagerId: true, salesInvoices: { select: { id: true } }, slas: { select: { id: true } }, services: { select: { id: true } } } });
  const removeClients: typeof clients = [], keepClients: typeof clients = [];
  for (const c of clients) {
    const firstImported = imported.filter((i) => i.clientId === c.id).map((i) => i.issueDate).sort()[0];
    const onlyImported = c.salesInvoices.every((i) => importedIds.has(i.id));
    const startedByImport = c.onboardDate.toISOString() === `${firstImported}T00:00:00.000Z`;
    const untouched = !c.accountManagerId && c.slas.length === 0 && c.services.length === 0;
    (onlyImported && startedByImport && untouched ? removeClients : keepClients).push(c);
  }
  console.log(`\nClients created by the import, to remove: ${removeClients.length}`);
  console.log(`Clients kept (existed before, or were changed since — only their imported invoices go): ${keepClients.length}`);
  if (keepClients.length) console.log("  " + keepClients.map((c) => `${c.code} ${c.name}`).join(", "));

  if (YES) {
    // Full, consistent copy of the database before anything is deleted.
    const file = DB_URL.replace(/^file:/, "");
    const backup = `${file}.backup-before-import-removal-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await prisma.$executeRawUnsafe(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
    console.log(`\nBackup written: ${backup}`);
    const ids = [...importedIds];
    for (let i = 0; i < ids.length; i += 200) await prisma.salesInvoice.deleteMany({ where: { id: { in: ids.slice(i, i + 200) } } }); // payments go with the invoice
    await prisma.client.deleteMany({ where: { id: { in: removeClients.map((c) => c.id) } } });
    console.log("Sale-report import removed.");
  }

  const left = (await prisma.salesInvoice.findMany({ where: { company: "WEB_ROCZ_PVT" }, select: { id: true, total: true } })).filter((i) => YES || !importedIds.has(i.id));
  console.log(`\nWeb Rocz Pvt Ltd invoices ${YES ? "now" : "that will REMAIN"}: ${left.length} (${inr(left.reduce((s, i) => s + i.total, 0))})`);
  console.log(YES ? "\nIMPORT_REMOVED" : "\nPREVIEW_DONE — nothing was changed.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
