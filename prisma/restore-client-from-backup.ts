// Finds a client in the live database and in the automatic backups next to it, and can put a
// client that is missing from live back — with its invoices, payments, services and SLAs —
// exactly as it was in the backup. It only ADDS the missing rows; nothing is changed or removed.
//
//   Look (changes nothing):   npx tsx prisma/restore-client-from-backup.ts "PEST"
//   Restore:                  npx tsx prisma/restore-client-from-backup.ts "PEST" --yes
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

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
const LIVE = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const YES = process.argv.includes("--yes");
const text = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "";
const inr = (v: number) => "Rs " + (v || 0).toLocaleString("en-IN");

type ClientRow = { id: string; code: string; name: string };
type InvRow = { id: string; number: string; total: number; received: number; company: string; issueDate: string };

function find(file: string): { client: ClientRow; invoices: InvRow[] }[] {
  const db = new Database(file, { readonly: true });
  try {
    const clients = db.prepare("SELECT id, code, name FROM Client WHERE name LIKE ? ORDER BY name").all(`%${text}%`) as ClientRow[];
    return clients.map((client) => ({ client, invoices: db.prepare("SELECT id, number, total, received, company, issueDate FROM SalesInvoice WHERE clientId = ? ORDER BY issueDate").all(client.id) as InvRow[] }));
  } finally { db.close(); }
}
const show = (rows: { client: ClientRow; invoices: InvRow[] }[]) => {
  for (const r of rows) {
    console.log(`  ${r.client.code}  ${r.client.name}`);
    for (const i of r.invoices) console.log(`      ${i.number}  ${i.issueDate}  ${i.company}  total ${inr(i.total)}  received ${inr(i.received)}`);
    if (!r.invoices.length) console.log("      (no invoices)");
  }
};

function main() {
  if (!text) { console.log('Give part of the client name, e.g.  npx tsx prisma/restore-client-from-backup.ts "PEST"'); return; }
  console.log(YES ? `=== RESTORING clients matching "${text}" ===` : `=== LOOKING for clients matching "${text}" — nothing is changed ===`);
  const liveRows = find(LIVE);
  console.log(`\nIn the live database now: ${liveRows.length ? "" : "not found"}`);
  show(liveRows);

  const dir = dirname(LIVE);
  const backups = readdirSync(dir).filter((f) => f.startsWith(basename(LIVE) + ".backup-")).sort().reverse().map((f) => join(dir, f));
  console.log(`\nBackups checked: ${backups.length}`);
  let source: { file: string; rows: { client: ClientRow; invoices: InvRow[] }[] } | null = null;
  for (const file of backups) {
    const rows = find(file);
    console.log(`  ${basename(file)}: ${rows.length ? "FOUND" : "not found"}`);
    show(rows);
    // newest backup that still has a client which is missing from live
    const missing = rows.filter((r) => !liveRows.some((l) => l.client.id === r.client.id));
    if (!source && missing.length) source = { file, rows: missing };
  }
  if (!source) { console.log(liveRows.length ? "\nNothing to restore — it is already in the live database." : "\nNot in any backup, so it cannot be restored from here."); console.log(YES ? "\nRESTORE_NOTHING" : "\nLOOK_DONE"); return; }
  console.log(`\nCan be restored from ${basename(source.file)}: ${source.rows.map((r) => r.client.name).join(", ")}`);
  if (!YES) { console.log("\nLOOK_DONE — add --yes to restore."); return; }

  const db = new Database(LIVE);
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    db.exec(`VACUUM INTO '${`${LIVE}.backup-before-restore-${stamp}`.replace(/'/g, "''")}'`);
    db.prepare("ATTACH DATABASE ? AS bak").run(source.file);
    const cols = (schema: string, table: string) => (db.prepare(`PRAGMA ${schema}.table_info("${table}")`).all() as { name: string }[]).map((c) => c.name);
    const tables = (db.prepare("SELECT name FROM bak.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").all() as { name: string }[]).map((t) => t.name);
    // copy rows of one table, using only the columns both databases have
    const copy = (table: string, where: string, arg: string) => {
      const shared = cols("bak", table).filter((c) => cols("main", table).includes(c)).map((c) => `"${c}"`).join(", ");
      return db.prepare(`INSERT OR IGNORE INTO main."${table}" (${shared}) SELECT ${shared} FROM bak."${table}" WHERE ${where}`).run(arg).changes;
    };
    const restore = db.transaction(() => {
      for (const r of source!.rows) {
        // a client code that has since been reused gets the next free code
        const clash = db.prepare("SELECT id FROM main.Client WHERE code = ? AND id <> ?").get(r.client.code, r.client.id);
        copy("Client", "id = ?", r.client.id);
        if (clash) {
          const max = (db.prepare("SELECT code FROM main.Client WHERE code LIKE 'CLI-%'").all() as { code: string }[]).reduce((m, c) => Math.max(m, parseInt(c.code.slice(4), 10) || 0), 999);
          const shared = cols("bak", "Client").filter((c) => cols("main", "Client").includes(c) && c !== "code").map((c) => `"${c}"`).join(", ");
          db.prepare(`INSERT OR IGNORE INTO main.Client ("code", ${shared}) SELECT ?, ${shared} FROM bak.Client WHERE id = ?`).run(`CLI-${max + 1}`, r.client.id);
        }
        if (!db.prepare("SELECT id FROM main.Client WHERE id = ?").get(r.client.id)) throw new Error(`Could not restore client ${r.client.name}`);
        let rows = 0;
        for (const t of tables) if (t !== "Client" && cols("bak", t).includes("clientId")) rows += copy(t, "clientId = ?", r.client.id);
        const pays = copy("Payment", "invoiceId IN (SELECT id FROM bak.SalesInvoice WHERE clientId = ?)", r.client.id);
        const back = db.prepare("SELECT number FROM main.SalesInvoice WHERE clientId = ?").all(r.client.id) as { number: string }[];
        console.log(`  restored ${r.client.name}: ${back.length} invoice(s) [${back.map((i) => i.number).join(", ")}], ${pays} payment(s), ${rows} linked row(s)`);
        const lost = r.invoices.filter((i) => !back.some((b) => b.number === i.number));
        if (lost.length) console.log(`  NOT restored (invoice number now used by another invoice): ${lost.map((i) => i.number).join(", ")}`);
      }
    });
    restore();
    console.log("\nRESTORE_DONE");
  } finally { db.close(); }
}

main();
