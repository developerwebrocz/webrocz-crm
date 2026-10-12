// SLA documents uploaded by the sales team: shows what is in the SLA list and which uploaded
// files are NOT in the list any more (the record was removed but the file is still on the
// server) — and, with --restore, puts those files back in the list.
//
//   npx tsx prisma/sla-files.ts            (only shows — changes nothing)
//   npx tsx prisma/sla-files.ts --restore  (adds a "To invoice" SLA for each file not in the list)
//
// A restored SLA carries the document, the client name taken from the file name and amount 0
// (the amount is not in the file — the accountant / sales fills it). Nothing is deleted; running
// it twice adds nothing twice. Uses the same Prisma + SQLite adapter as the app.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

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
const RESTORE = process.argv.includes("--restore");
const DIR = path.join(process.cwd(), "public", "uploads", "slas");
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// "1791277468524-Web_Rocz_-_TG_PEST_MANAGEMENT_SOLUTIONS.pdf" → "TG PEST MANAGEMENT SOLUTIONS"
function nameFromFile(file: string): string {
  const base = file.replace(/^\d+-/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  return base.replace(/^web\s*rocz\s*-\s*/i, "").replace(/^-\s*/, "").trim() || base;
}

async function main() {
  const slas = await prisma.sla.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, clientName: true, status: true, amount: true, uploadedBy: true, fileUrl: true, createdAt: true } });
  console.log(`SLAs in the list: ${slas.length}  (to invoice: ${slas.filter((s) => s.status === "UPLOADED").length}, invoiced: ${slas.filter((s) => s.status === "INVOICED").length})`);
  for (const s of slas.slice(0, 12)) console.log(`  ${day(s.createdAt)} | ${s.clientName} | ${s.status} | Rs ${s.amount} | by ${s.uploadedBy || "-"} | ${s.fileUrl ? "file attached" : "no file"}`);

  if (!existsSync(DIR)) { console.log("\nNo SLA files folder on this server."); console.log("SLA_CHECK_DONE"); return; }
  const listed = new Set(slas.map((s) => path.basename(s.fileUrl || "")));
  // real documents only (not the sample text file), newest first
  const files = readdirSync(DIR).filter((f) => /\.(pdf|docx?|png|jpe?g)$/i.test(f)).map((f) => ({ f, st: statSync(path.join(DIR, f)) })).sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
  const orphans = files.filter((x) => !listed.has(x.f));
  // the same document uploaded several times (same name + size) is one SLA — the latest copy is kept
  const seen = new Set<string>();
  const todo = orphans.filter((x) => { const k = `${x.f.replace(/^\d+-/, "")}|${x.st.size}`; if (seen.has(k)) return false; seen.add(k); return true; });
  // … and a client that already has an SLA in the list is not added again
  const haveClient = new Set(slas.map((s) => norm(s.clientName)));

  console.log(`\nUploaded SLA files on the server: ${files.length} · not in the list: ${orphans.length} (${todo.length} different document${todo.length === 1 ? "" : "s"})`);
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  let added = 0;
  for (const x of todo) {
    const guess = nameFromFile(x.f);
    const exact = clients.filter((c) => norm(c.name) === norm(guess));
    const loose = exact.length ? exact : clients.filter((c) => norm(c.name).length >= 5 && (norm(guess).includes(norm(c.name)) || norm(c.name).includes(norm(guess))));
    const client = loose.length === 1 ? loose[0] : null;
    const clientName = client?.name ?? guess;
    const already = haveClient.has(norm(clientName));
    console.log(`  ${day(x.st.mtime)} | ${clientName}${client ? " (existing client)" : ""} | ${(x.st.size / 1024 / 1024).toFixed(1)} MB | ${x.f}${already ? "  → this client already has an SLA in the list, left alone" : RESTORE ? "  → ADDED to the list" : "  → NOT in the list"}`);
    if (!RESTORE || already) continue;
    await prisma.sla.create({ data: {
      clientName, clientId: client?.id ?? null, title: "Service agreement", service: "DM", amount: 0, gst: false,
      fileUrl: `/uploads/slas/${x.f}`, notes: "Put back in the list from the uploaded file. The amount is not in the file: after Move to…, set it with Edit on the invoice.", status: "UPLOADED",
      uploadedBy: "Sales (re-listed)", createdAt: x.st.mtime,
    } });
    haveClient.add(norm(clientName));
    added++;
  }
  if (RESTORE) console.log(`\n${added} SLA${added === 1 ? "" : "s"} put back in the list (status: To invoice).`);
  else if (todo.length) console.log("\nNothing was changed. To put these documents back in the SLA list, run the same command with --restore.");
  console.log("SLA_CHECK_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
