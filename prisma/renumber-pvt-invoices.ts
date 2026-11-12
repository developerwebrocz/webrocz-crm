// Web Rocz Pvt Ltd (GST) invoice numbers: moves the invoices numbered from 180 on (2026-27/180,
// 181 …) back to the free numbers just below 180, so new invoices start again at 2026-27/180.
//
//   npx tsx prisma/renumber-pvt-invoices.ts            (only shows old → new numbers; nothing changes)
//   npx tsx prisma/renumber-pvt-invoices.ts --apply    (changes the numbers)
//   optional: 'from=180'  'fy=2026-27'
//
// • The moved invoices get the numbers right after the highest number below 180, in their
//   current order (e.g. 173, 174 … 179). If there is not enough room below 180, nothing changes.
// • Only the invoice number changes — client, amounts, payments, receipts stay as they are.
// • Before changing, the old numbers are written to a file in /tmp, so they can be put back.
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
const APPLY = process.argv.includes("--apply");

// financial year (April–March) of today in India — as in src/lib/invoice-number.ts
function fyToday(): string {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const y = d.getUTCFullYear(), start = d.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

async function main() {
  const from = Math.max(2, parseInt(args.get("from") ?? "180", 10) || 180);
  const fy = /^\d{4}-\d{2}$/.test(args.get("fy") ?? "") ? args.get("fy")! : fyToday();
  const prefix = `${fy}/`;
  const rows = await prisma.salesInvoice.findMany({ where: { number: { startsWith: prefix } }, select: { id: true, number: true, billTo: true, issueDate: true, total: true } });
  const numbered = rows.map((r) => ({ ...r, n: /^\d+$/.test(r.number.slice(prefix.length)) ? parseInt(r.number.slice(prefix.length), 10) : 0 })).filter((r) => r.n > 0);
  const movers = numbered.filter((r) => r.n >= from).sort((a, b) => a.n - b.n);
  const below = numbered.filter((r) => r.n < from);
  const highestBelow = below.reduce((m, r) => Math.max(m, r.n), 0);

  console.log(`Web Rocz Pvt Ltd series ${fy}: ${numbered.length} invoices. Highest number below ${from}: ${highestBelow ? `${prefix}${highestBelow}` : "none"}.`);
  if (!movers.length) { console.log(`No invoice is numbered ${prefix}${from} or above — nothing to move. The next invoice gets ${prefix}${Math.max(from, highestBelow + 1)}.\nRENUMBER_DONE`); return; }
  if (highestBelow + movers.length >= from) {
    console.log(`\nNot enough free numbers below ${from}: ${movers.length} invoices to move, but only ${from - 1 - highestBelow} free after ${prefix}${highestBelow}. Nothing was changed.\nRENUMBER_DONE`);
    return;
  }
  const plan = movers.map((r, k) => ({ ...r, to: `${prefix}${highestBelow + 1 + k}` }));
  console.log(`\n${plan.length} invoice${plan.length === 1 ? "" : "s"} to move:`);
  for (const p of plan) console.log(`  ${p.number}  →  ${p.to}   · ${p.billTo} · invoice date ${p.issueDate || "—"} · ₹${p.total.toLocaleString("en-IN")}`);
  console.log(`\nAfter this, the next new invoice gets ${prefix}${from}.`);

  if (!APPLY) { console.log("\nNothing was changed. To change the numbers, run the same command with  --apply  at the end.\nRENUMBER_DONE"); return; }

  const backup = join(tmpdir(), `wr-pvt-renumber-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify(plan.map((p) => ({ id: p.id, oldNumber: p.number, newNumber: p.to, billTo: p.billTo })), null, 2));
  // two steps, so no number is ever used twice at the same moment
  await prisma.$transaction([
    ...plan.map((p) => prisma.salesInvoice.update({ where: { id: p.id }, data: { number: `RENUMBER-${p.id}` } })),
    ...plan.map((p) => prisma.salesInvoice.update({ where: { id: p.id }, data: { number: p.to } })),
  ]);
  console.log(`\nDone — ${plan.length} invoice number${plan.length === 1 ? "" : "s"} changed. The old numbers are kept in ${backup}`);
  console.log(`The next new invoice gets ${prefix}${from}.`);
  console.log("RENUMBER_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
