// One-time repair for Web Solutions invoices created by "Add client" before the fix in
// addClientFromFinance: a service ticked without its own amount (e.g. a package price typed
// against Domain, with Hosting + SSL and Website Designing ticked beside it) was left off
// the invoice, so it listed "Domain" only.
//
// For each client it finds the single Web Solutions invoice created together with the client
// and appends the ticked services that are missing from it as zero-amount lines (printed as
// "Included"). Totals, received and balance are never changed.
// Idempotent: a second run finds nothing to add.
// Run:      npx tsx prisma/fix-websol-invoice-lines.ts
// Preview:  npx tsx prisma/fix-websol-invoice-lines.ts --dry
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
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });
const DRY = process.argv.includes("--dry");
const SAME_MOMENT_MS = 2 * 60 * 1000; // the add-client invoice is created seconds after the client

type Line = { name: string; qty: number; rate: number; amount: number };

async function main() {
  const clients = await prisma.client.findMany({
    where: { websiteServices: { not: "[]" } },
    select: { id: true, code: true, name: true, createdAt: true, websiteServices: true, domainAmount: true, hostingAmount: true, designAmount: true },
  });
  let fixed = 0;
  for (const c of clients) {
    let ticked: string[] = [];
    try { const a = JSON.parse(c.websiteServices || "[]"); if (Array.isArray(a)) ticked = a.map((x) => String(x).trim()).filter(Boolean); } catch { /* skip */ }
    if (ticked.length < 2) continue;
    const invoices = await prisma.salesInvoice.findMany({ where: { clientId: c.id, company: "WEB_SOLUTIONS" }, select: { id: true, number: true, items: true, createdAt: true } });
    const born = invoices.filter((i) => Math.abs(i.createdAt.getTime() - c.createdAt.getTime()) < SAME_MOMENT_MS);
    // Exactly one invoice was raised with the client → that is the combined add-client invoice.
    // (Older builds raised one invoice per service; those already list every service.)
    if (born.length !== 1) continue;
    const inv = born[0];
    let lines: Line[] = [];
    try { const a = JSON.parse(inv.items || "[]"); if (Array.isArray(a)) lines = a; } catch { continue; }
    const have = new Set(lines.map((l) => String(l.name).trim().toLowerCase()));
    // A service that has its own amount on the client was billed (or added later) — only the
    // ones ticked WITHOUT an amount were dropped, so only those are restored.
    const ownAmount: Record<string, number> = { "Domain": c.domainAmount, "Hosting + SSL": c.hostingAmount, "Website Designing": c.designAmount };
    const missing = ticked.filter((s) => !have.has(s.toLowerCase()) && !(ownAmount[s] > 0));
    if (!missing.length) continue;
    console.log(`${DRY ? "[dry] would fix" : "fixing"} ${inv.number} · ${c.code} ${c.name}: + ${missing.join(", ")}`);
    if (!DRY) {
      const next = [...lines, ...missing.map((name) => ({ name, qty: 1, rate: 0, amount: 0 }))];
      await prisma.salesInvoice.update({ where: { id: inv.id }, data: { items: JSON.stringify(next) } });
    }
    fixed++;
  }
  console.log(`${DRY ? "[dry] " : ""}Web Solutions invoice lines: ${fixed} invoice(s) ${DRY ? "would be " : ""}repaired, ${clients.length} client(s) checked.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
