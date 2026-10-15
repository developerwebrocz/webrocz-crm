// Deletes ONE invoice by its number — e.g. a dummy / test invoice.
//
//   npx tsx prisma/delete-invoice.ts 'number=NG/2026-27/044'            (only shows it)
//   npx tsx prisma/delete-invoice.ts 'number=NG/2026-27/044' --delete   (deletes it)
//
// • Without --delete nothing is changed — it shows the invoice, its client and its payments.
// • --delete removes the invoice and its recorded payments (as the Delete button does); an SLA it
//   was made from goes back to "to invoice". Everything removed is first written to a file in
//   /tmp, so it can be put back.
// Same Prisma + SQLite adapter as the app.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

const args = new Map(process.argv.slice(2).filter((a) => a.includes("=")).map((a) => { const i = a.indexOf("="); return [a.slice(0, i).trim().toLowerCase(), a.slice(i + 1).trim()] as const; }));
const DELETE = process.argv.includes("--delete");

async function main() {
  const number = (args.get("number") ?? "").trim();
  if (!number) { console.log("Give the invoice number: 'number=NG/2026-27/044'"); return; }
  const inv = await prisma.salesInvoice.findUnique({ where: { number }, include: { payments: true } });
  if (!inv) { console.log(`No invoice numbered ${number}. Nothing was changed.\nINVOICE_DELETE_DONE`); return; }
  const client = inv.clientId ? await prisma.client.findUnique({ where: { id: inv.clientId }, select: { name: true } }) : null;

  console.log(`Invoice ${inv.number} — ${inv.company || "(no company)"}`);
  console.log(`  client: ${client?.name ?? inv.billTo}`);
  console.log(`  date: ${inv.issueDate} — total ₹${inv.total.toLocaleString("en-IN")} — received ₹${inv.received.toLocaleString("en-IN")} — ${inv.paymentStatus}`);
  console.log(`  payments recorded: ${inv.payments.length}${inv.payments.length ? " (" + inv.payments.map((p) => `₹${p.amount.toLocaleString("en-IN")} on ${p.date}${p.receiptNo ? `, receipt ${p.receiptNo}` : ""}`).join("; ") + ")" : ""}`);

  if (!DELETE) { console.log("\nNothing was changed. To delete it, run the same command with  --delete  at the end.\nINVOICE_DELETE_DONE"); return; }

  const backup = join(tmpdir(), `wr-invoice-deleted-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify(inv, null, 2));
  try { await prisma.sla.updateMany({ where: { invoiceId: inv.id }, data: { status: "UPLOADED", invoiceId: null } }); } catch { /* no SLA */ }
  await prisma.salesInvoice.delete({ where: { id: inv.id } }); // its payments go with it
  console.log(`\nDeleted invoice ${inv.number}${inv.payments.length ? ` and its ${inv.payments.length} payment${inv.payments.length === 1 ? "" : "s"}` : ""}.`);
  console.log(`What was deleted is kept in ${backup}`);
  console.log("INVOICE_DELETE_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
