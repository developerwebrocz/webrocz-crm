// Invoice number series — read only, nothing is changed: for this financial year, the last
// numbers used and the number the next invoice will get, for both series:
//   Web Rocz Pvt Ltd (GST):            2026-27/164
//   Web Solutions + Web Rocz (no GST): NG/2026-27/055
//
//   npx tsx prisma/invoice-numbers.ts
//   npx tsx prisma/invoice-numbers.ts 'date=2027-04-01'   (the series of that date's financial year)
//
// Same rule as src/lib/invoice-number.ts. Same Prisma + SQLite adapter as the app.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync } from "node:fs";

// financial year (April–March) of a date, else of today in India — as in src/lib/invoice-number.ts
function fyOfDate(iso?: string): string {
  const ok = !!iso && /^\d{4}-\d{2}-\d{2}/.test(iso);
  const d = ok ? new Date(iso!.slice(0, 10) + "T00:00:00Z") : new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const y = d.getUTCFullYear(), start = d.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

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

async function main() {
  const fy = fyOfDate(args.get("date"));
  for (const [label, prefix, gst] of [["Web Rocz Pvt Ltd (GST)", `${fy}/`, true], ["Web Solutions + Web Rocz (no GST)", `NG/${fy}/`, false]] as const) {
    const used = await prisma.salesInvoice.findMany({ where: { number: { startsWith: prefix } }, select: { number: true, billTo: true, issueDate: true, createdAt: true } });
    const numbered = used.map((u) => ({ ...u, n: /^\d+$/.test(u.number.slice(prefix.length)) ? parseInt(u.number.slice(prefix.length), 10) : 0 })).filter((u) => u.n > 0).sort((a, b) => b.n - a.n);
    const max = numbered[0]?.n ?? 0;
    const next = gst ? `${prefix}${max + 1}` : `${prefix}${String(max + 1).padStart(3, "0")}`;
    console.log(`${label} — financial year ${fy}`);
    console.log(`  Invoices in this series: ${numbered.length}`);
    console.log("  Last numbers:");
    for (const u of numbered.slice(0, 5)) console.log(`    ${u.number} · ${u.billTo} · invoice date ${u.issueDate || "—"}`);
    if (!numbered.length) console.log("    none yet");
    console.log(`  NEXT invoice will get: ${next}\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
