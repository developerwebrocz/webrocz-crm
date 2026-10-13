// Shows what is saved as the "next follow-up" of a client and its invoices, and whether the
// invoices list shows it — read only, nothing is changed.
//
//   npx tsx prisma/followup-check.ts 'name=part of the client name'
//
// Same Prisma + SQLite adapter as the app.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync } from "node:fs";
import { chosenClientFollowup, chosenInvoiceFollowup, parseNotes } from "../src/lib/followup-shown";

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
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();

async function main() {
  const name = norm(args.get("name") ?? "");
  if (name.length < 3) { console.log("Give part of the client name: 'name=abc'"); return; }
  const [clients, invoices] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true, nextFollowup: true, followupLog: true } }),
    prisma.salesInvoice.findMany({ select: { id: true, number: true, clientId: true, billTo: true, total: true, received: true, nextFollowup: true, notesLog: true, company: true } }),
  ]);
  const hitClients = clients.filter((c) => norm(c.name).includes(name));
  const looseInvoices = invoices.filter((i) => !i.clientId && norm(i.billTo).includes(name) && !hitClients.some((c) => norm(c.name) === norm(i.billTo)));
  if (!hitClients.length && !looseInvoices.length) { console.log(`No client or invoice name contains "${args.get("name")}".\nFOLLOWUP_CHECK_DONE`); return; }

  for (const c of hitClients) {
    const notes = parseNotes(c.followupLog) as { date?: string; time?: string; by?: string; note?: string; next?: string }[];
    const shownClient = chosenClientFollowup(c.nextFollowup, notes);
    console.log(`\nCLIENT: ${c.name}`);
    console.log(`  next follow-up saved on the client: ${c.nextFollowup || "(none)"}${c.nextFollowup && !shownClient ? "   ← NOT shown: it is the same day as the follow-up it was saved with" : ""}`);
    console.log(`  client follow-ups: ${notes.length}`);
    for (const n of notes.slice(-4)) console.log(`    ${n.date ?? ""} ${n.time ?? ""} — ${n.by ?? ""}${n.next ? ` — follow up again on ${n.next}` : ""}`);
    const mine = invoices.filter((i) => i.clientId === c.id || (!i.clientId && norm(i.billTo) === norm(c.name)));
    console.log(`  invoices: ${mine.length}`);
    let fromInvoice = "";
    for (const i of mine) {
      const inotes = parseNotes(i.notesLog);
      const own = chosenInvoiceFollowup(i.nextFollowup, inotes);
      if (own && (!fromInvoice || own < fromInvoice)) fromInvoice = own;
      console.log(`    ${i.number} — ${i.company} — pending ${i.total - i.received} — own date: ${i.nextFollowup || "(none)"}${i.nextFollowup && !own ? " ← NOT shown (same day as one of its notes)" : ""} — notes on: ${inotes.map((n) => (n.date ?? "").slice(0, 10)).join(", ") || "(none)"}${i.clientId ? "" : " — not linked, matched by name"}`);
    }
    console.log(`  → the invoices list shows: ${shownClient || fromInvoice ? `next follow-up ${shownClient || fromInvoice}` : "no next follow-up"}`);
  }
  for (const i of looseInvoices) {
    const inotes = parseNotes(i.notesLog);
    const own = chosenInvoiceFollowup(i.nextFollowup, inotes);
    console.log(`\nINVOICE WITH NO CLIENT RECORD: ${i.billTo} — ${i.number} — own date: ${i.nextFollowup || "(none)"} — notes on: ${inotes.map((n) => (n.date ?? "").slice(0, 10)).join(", ") || "(none)"}`);
    console.log(`  → the invoices list shows: ${own ? `next follow-up ${own}` : "no next follow-up"}`);
  }
  console.log("\nFOLLOWUP_CHECK_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
