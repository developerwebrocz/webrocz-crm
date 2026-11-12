// How many invoices a month has — read only, nothing is changed. Per company: the invoices whose
// INVOICE DATE is in that month (each with number, client, date, amount), and how many were MADE in
// the CRM during that month.
//
//   npx tsx prisma/invoice-month-count.ts 'month=2026-11'
//
// Same Prisma + SQLite adapter as the app.
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
const DB = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${DB}` }) });

const args = new Map(process.argv.slice(2).filter((a) => a.includes("=")).map((a) => { const i = a.indexOf("="); return [a.slice(0, i).trim().toLowerCase(), a.slice(i + 1).trim()] as const; }));
const fmt = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return d ? `${d}-${m}-${y}` : iso || "—"; };
const ist = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
const NAMES: Record<string, string> = { WEB_ROCZ_PVT: "Web Rocz Pvt Ltd (GST)", WEB_SOLUTIONS: "Web Solutions", WEB_ROCZ: "Web Rocz", "": "No company saved" };

async function main() {
  const month = args.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) { console.log("Give the month: 'month=2026-11'"); return; }
  const rows = await prisma.salesInvoice.findMany({ select: { number: true, billTo: true, company: true, issueDate: true, total: true, createdAt: true } });
  const dated = rows.filter((r) => r.issueDate.startsWith(month));
  const made = rows.filter((r) => ist(r.createdAt).startsWith(month));

  console.log(`Invoices with INVOICE DATE in ${month}: ${dated.length}`);
  console.log(`Invoices MADE in the CRM during ${month}: ${made.length}\n`);
  for (const co of ["WEB_ROCZ_PVT", "WEB_SOLUTIONS", "WEB_ROCZ", ""]) {
    const list = dated.filter((r) => (r.company || "") === co).sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number));
    const madeHere = made.filter((r) => (r.company || "") === co).length;
    if (!list.length && !madeHere) continue;
    console.log(`${NAMES[co]} — invoice date in ${month}: ${list.length} · made in CRM this month: ${madeHere}`);
    for (const r of list) console.log(`  ${r.number.padEnd(16)} ${fmt(r.issueDate)} · ${r.billTo} · ₹${r.total.toLocaleString("en-IN")}`);
    const madeOther = made.filter((r) => (r.company || "") === co && !r.issueDate.startsWith(month));
    if (madeOther.length) {
      console.log(`  made this month but with another month's date: ${madeOther.length}`);
      for (const r of madeOther) console.log(`    ${r.number.padEnd(16)} ${fmt(r.issueDate)} · ${r.billTo} · ₹${r.total.toLocaleString("en-IN")}`);
    }
    console.log("");
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
