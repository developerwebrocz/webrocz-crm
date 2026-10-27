// Removes follow-up notes that were typed by mistake / as a test, found by their text.
// It looks in the follow-up notes of clients (Phone / WhatsApp follow-ups), of invoices and of
// Studio X shoots.
//
//   npx tsx prisma/remove-followup-note.ts 'text=part of the note'            (only shows what it finds)
//   npx tsx prisma/remove-followup-note.ts 'text=part of the note' --delete   (removes it)
//   npx tsx prisma/remove-followup-note.ts 'exact=N/A' 'date=2026-10-26' 'by=Prashanth'
//
// • text= finds notes that contain the text (at least 6 letters); exact= finds notes that are
//   exactly that text (any length, e.g. "N/A"). date= (YYYY-MM-DD) and by= narrow it down.
// • Without --delete nothing is changed — it lists the notes it finds.
// • --delete removes the note only when exactly ONE note matches. With more than one, say which:
//   'pick=2' (the number shown in the list), or 'pick=all' for every note in the list.
// • Before removing, the old follow-up notes of each client / invoice / shoot are written to a
//   file in /tmp, so they can be put back. If a removed note had set the reminder date ("follow
//   up again on") that is still on the client / invoice, that reminder is removed with it.
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
type Where = "client" | "invoice" | "shoot";
type Hit = { where: Where; id: string; owner: string; index: number; note: Note; log: Note[]; raw: string; reminder: string };
const parse = (json: string | null): Note[] => { try { const a = JSON.parse(json || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };

async function main() {
  const text = norm(args.get("text") ?? "");
  const exact = args.has("exact") ? norm(args.get("exact")!) : null;
  const date = (args.get("date") ?? "").trim();
  const by = norm(args.get("by") ?? "");
  if (exact === null && text.length < 6) { console.log("Give the note's text (at least 6 letters): 'text=part of the note' — or the whole note: 'exact=N/A'"); return; }
  const matches = (n: Note) =>
    (exact !== null ? norm(n.note ?? "") === exact : norm(n.note ?? "").includes(text))
    && (!date || (n.date ?? "") === date)
    && (!by || norm(n.by ?? "").includes(by));

  const [clients, invoices, shoots] = await Promise.all([
    prisma.client.findMany({ where: { followupLog: { not: "[]" } }, select: { id: true, name: true, followupLog: true, nextFollowup: true } }),
    prisma.salesInvoice.findMany({ where: { notesLog: { not: "[]" } }, select: { id: true, number: true, billTo: true, notesLog: true, nextFollowup: true } }),
    prisma.shoot.findMany({ where: { followupLog: { not: "[]" } }, select: { id: true, code: true, title: true, followupLog: true } }),
  ]);
  const hits: Hit[] = [];
  for (const c of clients) { const log = parse(c.followupLog); log.forEach((n, index) => { if (matches(n)) hits.push({ where: "client", id: c.id, owner: c.name, index, note: n, log, raw: c.followupLog, reminder: c.nextFollowup ?? "" }); }); }
  for (const i of invoices) { const log = parse(i.notesLog); log.forEach((n, index) => { if (matches(n)) hits.push({ where: "invoice", id: i.id, owner: `${i.billTo} · invoice ${i.number}`, index, note: n, log, raw: i.notesLog, reminder: i.nextFollowup ?? "" }); }); }
  for (const s of shoots) { const log = parse(s.followupLog); log.forEach((n, index) => { if (matches(n)) hits.push({ where: "shoot", id: s.id, owner: `shoot ${s.code} · ${s.title}`, index, note: n, log, raw: s.followupLog, reminder: "" }); }); }

  const asked = exact !== null ? `"${args.get("exact")}"` : `"${args.get("text")}"`;
  if (!hits.length) { console.log(`No follow-up note matches ${asked}${date ? ` on ${date}` : ""}${by ? ` by ${args.get("by")}` : ""}. Nothing was changed.\nNOTE_REMOVE_DONE`); return; }
  console.log(`Found ${hits.length} follow-up note${hits.length === 1 ? "" : "s"}:`);
  hits.forEach((h, n) => console.log(`  ${n + 1}. ${h.owner} (${h.where} follow-up) — ${h.note.date ?? ""} ${h.note.time ?? ""} — by ${h.note.by || "—"}\n     "${h.note.note}"${h.note.next ? `\n     follow up again on ${h.note.next}` : ""}`));

  if (!DELETE) { console.log("\nNothing was changed. To remove it, run the same command with  --delete  at the end.\nNOTE_REMOVE_DONE"); return; }
  const pickArg = (args.get("pick") ?? "").toLowerCase();
  const pick = Number(pickArg || 0);
  if (hits.length > 1 && pickArg !== "all" && !(pick >= 1 && pick <= hits.length)) { console.log(`\nMore than one note matches — nothing was removed. Say which one:  'pick=1' … 'pick=${hits.length}'  or every one:  'pick=all'\nNOTE_REMOVE_DONE`); return; }
  const chosen = hits.length === 1 || pickArg !== "all" ? [hits.length === 1 ? hits[0] : hits[pick - 1]] : hits;

  // keep the old notes of every client / invoice / shoot touched, so they can be put back
  const groups = new Map<string, Hit[]>();
  for (const h of chosen) groups.set(`${h.where}|${h.id}`, [...(groups.get(`${h.where}|${h.id}`) ?? []), h]);
  const backup = join(tmpdir(), `wr-followup-note-removed-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify([...groups.values()].map((g) => ({ where: g[0].where, id: g[0].id, owner: g[0].owner, followupNotesBefore: g[0].raw, reminderBefore: g[0].reminder })), null, 2));

  for (const g of groups.values()) {
    const h = g[0];
    const drop = new Set(g.map((x) => x.index));
    const left = h.log.filter((_, i) => !drop.has(i));
    // the reminder goes too only when one of these very notes set it
    const dropReminder = g.some((x) => !!x.note.next && x.note.next === h.reminder);
    if (h.where === "client") await prisma.client.update({ where: { id: h.id }, data: { followupLog: JSON.stringify(left), ...(dropReminder ? { nextFollowup: "" } : {}) } });
    else if (h.where === "invoice") await prisma.salesInvoice.update({ where: { id: h.id }, data: { notesLog: JSON.stringify(left) } });
    else await prisma.shoot.update({ where: { id: h.id }, data: { followupLog: JSON.stringify(left) } });
    console.log(`\nRemoved ${g.length} note${g.length === 1 ? "" : "s"} from ${h.owner}. ${left.length} follow-up note${left.length === 1 ? "" : "s"} left there.`);
    if (dropReminder) console.log(`Its reminder (${h.reminder}) was removed too.`);
    else if (h.reminder) console.log(`A reminder (${h.reminder}) is still set there — use Done in Payment Reminders if it is not needed.`);
  }
  console.log(`\nThe notes as they were are kept in ${backup}`);
  console.log("NOTE_REMOVE_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
