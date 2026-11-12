// Web Rocz Pvt Ltd (GST): gives one month's invoices the numbers from a starting number on, in
// invoice-date order — e.g. November's invoices 2026-27/180, 181, 182 … (October was filed up to 179).
// Other invoices can be given a number too ('set='), e.g. an October invoice back to the number
// it was filed with. No invoice is deleted; only invoice numbers change.
//
//   npx tsx prisma/renumber-pvt-month.ts 'month=2026-11' 'from=180'                    (preview only)
//   npx tsx prisma/renumber-pvt-month.ts 'month=2026-11' 'from=180' 'set=183:150,188:151'
//   … add  --apply  at the end to change the numbers.
//
// • month's invoices, and every invoice already numbered from 'from' on (whatever its date), are put in
//   order of invoice date (then when they were made in the CRM) and numbered from 'from' on. 'set=OLD:NEW,…' gives other invoices (by their current number) a new number.
// • If two invoices would end up with the same number, nothing changes and the clash is listed.
// • Invoices of other months numbered at or above 'from' are listed, so they can be given a number.
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
const fmt = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return d ? `${d}-${m}-${y}` : iso || "—"; };

async function main() {
  const month = args.get("month") ?? "";
  const from = parseInt(args.get("from") ?? "", 10);
  if (!/^\d{4}-\d{2}$/.test(month) || !(from > 0)) { console.log("Give the month and the first number: 'month=2026-11' 'from=180'"); return; }
  const [y, m] = month.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  const prefix = `${start}-${String((start + 1) % 100).padStart(2, "0")}/`; // that month's financial year

  const rows = await prisma.salesInvoice.findMany({ where: { number: { startsWith: prefix } }, select: { id: true, number: true, billTo: true, issueDate: true, createdAt: true, total: true } });
  const all = rows.map((r) => ({ ...r, n: /^\d+$/.test(r.number.slice(prefix.length)) ? parseInt(r.number.slice(prefix.length), 10) : 0 }));

  // new number per invoice id
  const plan = new Map<string, number>();
  // the month's invoices AND every invoice already numbered from 'from' on (not in the last filing)
  const ofMonth = all.filter((r) => r.issueDate.startsWith(month) || r.n >= from).sort((a, b) => a.issueDate.localeCompare(b.issueDate) || +a.createdAt - +b.createdAt || a.n - b.n);
  ofMonth.forEach((r, k) => plan.set(r.id, from + k));
  for (const pair of (args.get("set") ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const [o, nw] = pair.split(":").map((x) => parseInt(x, 10));
    const inv = all.find((r) => r.n === o);
    if (!inv || !(nw > 0)) { console.log(`! 'set=${pair}': no invoice ${prefix}${o} (or the new number is wrong). Nothing was changed.\nRENUMBER_DONE`); return; }
    plan.set(inv.id, nw);
  }

  // what every invoice's number would be afterwards — and any number used twice
  const after = all.map((r) => ({ ...r, to: plan.has(r.id) ? plan.get(r.id)! : r.n }));
  const seen = new Map<number, typeof after>();
  for (const r of after) if (r.to > 0) seen.set(r.to, [...(seen.get(r.to) ?? []), r]);
  const clashes = [...seen.entries()].filter(([, g]) => g.length > 1);

  console.log(`Web Rocz Pvt Ltd series ${prefix.slice(0, -1)} — ${all.length} invoices. ${month} invoices + those numbered from ${from} on: ${ofMonth.length}, numbered from ${prefix}${from} in invoice-date order.\n`);
  const changing = after.filter((r) => r.to !== r.n).sort((a, b) => a.to - b.to);
  console.log(changing.length ? "Numbers that change:" : "No number changes.");
  for (const r of changing) console.log(`  ${r.number.padEnd(13)} →  ${prefix}${r.to}   · ${r.billTo} · invoice date ${fmt(r.issueDate)}`);
  const unchangedMonth = ofMonth.filter((r) => plan.get(r.id) === r.n);
  if (unchangedMonth.length) console.log(`  (already right: ${unchangedMonth.map((r) => r.number).join(", ")})`);

  const picked = new Set(ofMonth.map((r) => r.id));
  const otherHigh = after.filter((r) => !picked.has(r.id) && r.to >= from);
  if (otherHigh.length) {
    console.log(`\nInvoices of other months that would still have a number from ${from} on — give each one its number with 'set=OLD:NEW':`);
    for (const r of otherHigh) console.log(`  ${prefix}${r.to} · ${r.billTo} · invoice date ${fmt(r.issueDate)}`);
  }
  if (clashes.length) {
    console.log(`\nThese numbers would be used twice — nothing was changed:`);
    for (const [num, g] of clashes) console.log(`  ${prefix}${num}: ${g.map((r) => `${r.billTo} (${fmt(r.issueDate)}, now ${r.number})`).join("  AND  ")}`);
    console.log("RENUMBER_DONE");
    return;
  }
  const next = Math.max(...after.map((r) => r.to), from - 1) + 1;
  console.log(`\nAfter this, the next new invoice gets ${prefix}${next}.`);
  if (!APPLY) { console.log("\nNothing was changed. To change the numbers, run the same command with  --apply  at the end.\nRENUMBER_DONE"); return; }

  const backup = join(tmpdir(), `wr-pvt-renumber-${month}-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify(changing.map((r) => ({ id: r.id, oldNumber: r.number, newNumber: `${prefix}${r.to}`, billTo: r.billTo, issueDate: r.issueDate })), null, 2));
  // two steps, so no number is ever used twice at the same moment
  await prisma.$transaction([
    ...changing.map((r) => prisma.salesInvoice.update({ where: { id: r.id }, data: { number: `RENUMBER-${r.id}` } })),
    ...changing.map((r) => prisma.salesInvoice.update({ where: { id: r.id }, data: { number: `${prefix}${r.to}` } })),
  ]);
  console.log(`\nDone — ${changing.length} invoice number${changing.length === 1 ? "" : "s"} changed. No invoice was deleted. The old numbers are kept in ${backup}`);
  console.log("RENUMBER_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
