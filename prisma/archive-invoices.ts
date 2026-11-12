// Archive invoices: takes chosen invoices (with their payments) out of the CRM and keeps them in a
// file on the server, so they show nowhere (lists, client pages, totals, reports, reminders) but
// can be brought back any time with one command. Nothing else changes.
//
//   npx tsx prisma/archive-invoices.ts 'numbers=2026-27/183,2026-27/184'            (preview only)
//   npx tsx prisma/archive-invoices.ts 'numbers=2026-27/183,2026-27/184' --apply    (archive them)
//   npx tsx prisma/archive-invoices.ts 'restore=/root/wr-invoice-archive/FILE.json'  (bring them back)
//
// • The archive file (every field of each invoice and of its payments) is written to
//   ~/wr-invoice-archive/ on the server — outside the app folder, so deploys never touch it.
// • An SLA that made one of these invoices keeps its link; restoring brings the invoice back with
//   the same id, so the link works again.
// Same Prisma + SQLite adapter as the app.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
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
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmt = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return d ? `${d}-${m}-${y}` : iso || "—"; };
// dates come back from the file as text: turn the "…At" fields into dates again
const revive = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k.endsWith("At") && typeof v === "string" ? new Date(v) : v]));

async function restore(file: string) {
  const data = JSON.parse(readFileSync(file, "utf8")) as { invoices: (Record<string, unknown> & { payments: Record<string, unknown>[] })[] };
  const numbers = data.invoices.map((i) => String(i.number));
  const taken = await prisma.salesInvoice.findMany({ where: { OR: [{ number: { in: numbers } }, { id: { in: data.invoices.map((i) => String(i.id)) } }] }, select: { number: true } });
  if (taken.length) { console.log(`Cannot restore — these numbers are in use now: ${taken.map((t) => t.number).join(", ")}. Nothing was changed.\nARCHIVE_DONE`); return; }
  await prisma.$transaction(data.invoices.flatMap(({ payments, ...inv }) => [
    prisma.salesInvoice.create({ data: revive(inv) as never }),
    ...payments.map((p) => prisma.payment.create({ data: revive(p) as never })),
  ]));
  console.log(`Restored ${data.invoices.length} invoice${data.invoices.length === 1 ? "" : "s"}: ${numbers.join(", ")}\nARCHIVE_DONE`);
}

async function main() {
  if (args.has("restore")) return restore(args.get("restore")!);
  const numbers = (args.get("numbers") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!numbers.length) { console.log("Give the invoice numbers: 'numbers=2026-27/183,2026-27/184'"); return; }
  const invoices = await prisma.salesInvoice.findMany({ where: { number: { in: numbers } }, include: { payments: true } });
  const missing = numbers.filter((n) => !invoices.some((i) => i.number === n));
  if (missing.length) { console.log(`Not found: ${missing.join(", ")}. Nothing was changed.\nARCHIVE_DONE`); return; }
  const slas = await prisma.sla.findMany({ where: { invoiceId: { in: invoices.map((i) => i.id) } }, select: { invoiceId: true, title: true } });

  console.log(`${invoices.length} invoice${invoices.length === 1 ? "" : "s"} to archive:`);
  for (const i of invoices) {
    console.log(`  ${i.number} · ${i.billTo} · invoice date ${fmt(i.issueDate)} · total ${inr(i.total)} · received ${inr(i.received)} · pending ${inr(i.total - i.received)}`);
    for (const p of i.payments) console.log(`      payment ${inr(p.amount)} on ${fmt(p.date)} · ${p.mode}${p.receiptNo ? ` · receipt ${p.receiptNo}` : ""} · recorded by ${p.by || "—"}`);
    const s = slas.find((x) => x.invoiceId === i.id);
    if (s) console.log(`      made from the SLA "${s.title}" (the SLA stays; it shows no invoice until this one is restored)`);
  }
  const t = invoices.reduce((a, i) => ({ total: a.total + i.total, received: a.received + i.received }), { total: 0, received: 0 });
  console.log(`\nTotals that come off the CRM: billed ${inr(t.total)} · received ${inr(t.received)} · pending ${inr(t.total - t.received)}`);
  if (!APPLY) { console.log("\nNothing was changed. To archive them, run the same command with  --apply  at the end.\nARCHIVE_DONE"); return; }

  const dir = join(homedir(), "wr-invoice-archive");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `archived-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ archivedAt: new Date().toISOString(), invoices }, null, 2));
  // the file is written first; only then are the invoices taken out (their payments go with them)
  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { invoiceId: { in: invoices.map((i) => i.id) } } }),
    prisma.salesInvoice.deleteMany({ where: { id: { in: invoices.map((i) => i.id) } } }),
  ]);
  console.log(`\nArchived ${invoices.length} invoice${invoices.length === 1 ? "" : "s"} — they no longer show in the CRM.`);
  console.log(`Kept in: ${file}`);
  console.log(`To bring them back:  npx tsx prisma/archive-invoices.ts 'restore=${file}'`);
  console.log("ARCHIVE_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
