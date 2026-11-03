// Who worked on an invoice — read only, nothing is changed. An invoice does not save who made it,
// so this shows the clues it keeps: when it was made, the sales lead it came from (and the sales
// person on that lead), who approved it, who recorded each payment and who wrote each follow-up.
//
//   npx tsx prisma/invoice-who.ts 'number=NG/2026-27/055'
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
const ist = (d: Date | null | undefined) => (d ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—");

async function main() {
  const number = (args.get("number") ?? "").trim();
  if (!number) { console.log("Give the invoice number: 'number=NG/2026-27/055'"); return; }
  const inv = await prisma.salesInvoice.findFirst({ where: { number }, select: { id: true, number: true, billTo: true, company: true, total: true, received: true, issueDate: true, createdAt: true, approved: true, approvedBy: true, approvedAt: true, leadId: true, notesLog: true } });
  if (!inv) { console.log(`No invoice numbered ${number}.`); return; }
  console.log(`Invoice ${inv.number} · ${inv.billTo} · ${inv.company || "—"} · total ₹${inv.total.toLocaleString("en-IN")} · received ₹${inv.received.toLocaleString("en-IN")}`);
  console.log(`  Invoice date      : ${inv.issueDate || "—"}`);
  console.log(`  Made in the CRM on: ${ist(inv.createdAt)} (IST)`);
  console.log(`  Approved          : ${inv.approved ? `yes, by ${inv.approvedBy || "—"} on ${ist(inv.approvedAt)}` : "not yet"}`);

  if (inv.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: inv.leadId }, select: { assignedTo: { select: { name: true, role: true } } } });
    console.log(`  From a sales lead : yes — sales person on the lead: ${lead?.assignedTo ? `${lead.assignedTo.name} (${lead.assignedTo.role})` : "not set"}`);
  } else console.log("  From a sales lead : no — it was made directly in Accounts (Invoices / client page)");

  const pays = await prisma.payment.findMany({ where: { invoiceId: inv.id }, select: { amount: true, by: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  console.log(`  Payments recorded : ${pays.length ? "" : "none"}`);
  for (const p of pays) console.log(`    ₹${p.amount.toLocaleString("en-IN")} — recorded by ${p.by || "—"} on ${ist(p.createdAt)}`);

  let notes: { date?: string; time?: string; by?: string; note?: string }[] = [];
  try { const a = JSON.parse(inv.notesLog || "[]"); if (Array.isArray(a)) notes = a; } catch { /* ignore */ }
  console.log(`  Follow-up notes   : ${notes.length ? "" : "none"}`);
  for (const n of notes) console.log(`    ${n.date ?? ""} ${n.time ?? ""} — ${n.by || "—"}: "${n.note ?? ""}"`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
