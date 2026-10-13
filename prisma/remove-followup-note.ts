// Removes ONE follow-up note that was typed by mistake / as a test, found by its text.
// It looks in the follow-up notes of clients (Phone / WhatsApp follow-ups) and of invoices.
//
//   npx tsx prisma/remove-followup-note.ts 'text=part of the note'            (only shows what it finds)
//   npx tsx prisma/remove-followup-note.ts 'text=part of the note' --delete   (removes it)
//
// • Without --delete nothing is changed — it lists the notes that contain the text.
// • --delete removes the note only when exactly ONE note matches. With more than one, say which:
//   'pick=2' (the number shown in the list).
// • Before removing, the old follow-up notes of that client / invoice are written to a file in
//   /tmp, so it can be put back. If the removed note had set the reminder date ("follow up again
//   on") that is still on the client / invoice, that reminder is removed with it.
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
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();

type Note = { date?: string; time?: string; by?: string; note?: string; next?: string };
type Hit = { where: "client" | "invoice"; id: string; owner: string; index: number; note: Note; log: Note[]; raw: string; reminder: string };
const parse = (json: string | null): Note[] => { try { const a = JSON.parse(json || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };

async function main() {
  const text = norm(args.get("text") ?? "");
  if (text.length < 6) { console.log("Give the note's text (at least 6 letters): 'text=part of the note'"); return; }

  const [clients, invoices] = await Promise.all([
    prisma.client.findMany({ where: { followupLog: { not: "[]" } }, select: { id: true, name: true, followupLog: true, nextFollowup: true } }),
    prisma.salesInvoice.findMany({ where: { notesLog: { not: "[]" } }, select: { id: true, number: true, billTo: true, notesLog: true, nextFollowup: true } }),
  ]);
  const hits: Hit[] = [];
  for (const c of clients) { const log = parse(c.followupLog); log.forEach((n, index) => { if (norm(n.note ?? "").includes(text)) hits.push({ where: "client", id: c.id, owner: c.name, index, note: n, log, raw: c.followupLog, reminder: c.nextFollowup ?? "" }); }); }
  for (const i of invoices) { const log = parse(i.notesLog); log.forEach((n, index) => { if (norm(n.note ?? "").includes(text)) hits.push({ where: "invoice", id: i.id, owner: `${i.billTo} · invoice ${i.number}`, index, note: n, log, raw: i.notesLog, reminder: i.nextFollowup ?? "" }); }); }

  if (!hits.length) { console.log(`No follow-up note contains "${args.get("text")}". Nothing was changed.\nNOTE_REMOVE_DONE`); return; }
  console.log(`Found ${hits.length} follow-up note${hits.length === 1 ? "" : "s"}:`);
  hits.forEach((h, n) => console.log(`  ${n + 1}. ${h.owner} (${h.where} follow-up) — ${h.note.date ?? ""} ${h.note.time ?? ""} — by ${h.note.by || "—"}\n     "${h.note.note}"${h.note.next ? `\n     follow up again on ${h.note.next}` : ""}`));

  if (!DELETE) { console.log("\nNothing was changed. To remove it, run the same command with  --delete  at the end.\nNOTE_REMOVE_DONE"); return; }
  const pick = Number(args.get("pick") ?? 0);
  if (hits.length > 1 && !(pick >= 1 && pick <= hits.length)) { console.log(`\nMore than one note matches — nothing was removed. Say which one:  'pick=1' … 'pick=${hits.length}'\nNOTE_REMOVE_DONE`); return; }
  const h = hits.length === 1 ? hits[0] : hits[pick - 1];

  // keep the old notes of this client / invoice, so the note can be put back
  const backup = join(tmpdir(), `wr-followup-note-removed-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify({ where: h.where, id: h.id, owner: h.owner, followupNotesBefore: h.raw, reminderBefore: h.reminder }, null, 2));

  const left = h.log.filter((_, i) => i !== h.index);
  // the reminder goes too only when this very note set it
  const dropReminder = !!h.note.next && h.note.next === h.reminder;
  if (h.where === "client") await prisma.client.update({ where: { id: h.id }, data: { followupLog: JSON.stringify(left), ...(dropReminder ? { nextFollowup: "" } : {}) } });
  else await prisma.salesInvoice.update({ where: { id: h.id }, data: { notesLog: JSON.stringify(left) } });

  console.log(`\nRemoved: "${h.note.note}" from ${h.owner}. ${left.length} follow-up note${left.length === 1 ? "" : "s"} left there.`);
  if (dropReminder) console.log(`Its reminder (${h.reminder}) was removed too.`);
  else if (h.reminder) console.log(`A reminder (${h.reminder}) is still set there — use Done in Payment Reminders if it is not needed.`);
  console.log(`The notes as they were are kept in ${backup}`);
  console.log("NOTE_REMOVE_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
