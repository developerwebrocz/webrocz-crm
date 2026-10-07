// Finds a client in the live database and in the automatic backups next to it, and can put a
// client that is missing from live back — with its invoices, payments, services and SLAs —
// exactly as it was in the backup. It only ADDS the missing rows; nothing is changed or removed.
//
//   Look (changes nothing):   npx tsx prisma/restore-client-from-backup.ts "PEST"
//   Restore:                  npx tsx prisma/restore-client-from-backup.ts "PEST" --yes
//
// Uses the same Prisma + SQLite adapter as the app and the other scripts here.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
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
const inr = (v: number) => "Rs " + (Number(v) || 0).toLocaleString("en-IN");
const open = (file: string) => new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
const q = (s: string) => s.replace(/'/g, "''");

type ClientRow = { id: string; code: string; name: string };
type InvRow = { id: string; number: string; total: number; received: number; company: string; issueDate: string };
type Found = { client: ClientRow; invoices: InvRow[] };

async function find(file: string): Promise<Found[]> {
  const db = open(file);
  try {
    const clients = await db.$queryRawUnsafe<ClientRow[]>(`SELECT id, code, name FROM Client WHERE name LIKE '%${q(text)}%' ORDER BY name`);
    const out: Found[] = [];
    for (const client of clients) out.push({ client, invoices: await db.$queryRawUnsafe<InvRow[]>(`SELECT id, number, total, received, company, issueDate FROM SalesInvoice WHERE clientId = '${q(client.id)}' ORDER BY issueDate`) });
    return out;
  } finally { await db.$disconnect(); }
}
const show = (rows: Found[]) => {
  for (const r of rows) {
    console.log(`  ${r.client.code}  ${r.client.name}`);
    for (const i of r.invoices) console.log(`      ${i.number}  ${i.issueDate}  ${i.company}  total ${inr(i.total)}  received ${inr(i.received)}`);
    if (!r.invoices.length) console.log("      (no invoices)");
  }
};

async function main() {
  if (!text) { console.log('Give part of the client name, e.g.  npx tsx prisma/restore-client-from-backup.ts "PEST"'); return; }
  console.log(YES ? `=== RESTORING clients matching "${text}" ===` : `=== LOOKING for clients matching "${text}" — nothing is changed ===`);
  console.log(`Live database: ${LIVE}`);
  const liveRows = await find(LIVE);
  console.log(`\nIn the live database now: ${liveRows.length ? "" : "not found"}`);
  show(liveRows);

  const dir = dirname(LIVE);
  const backups = readdirSync(dir).filter((f) => f.startsWith(basename(LIVE) + ".backup-")).sort().reverse().map((f) => join(dir, f).replace(/\\/g, "/"));
  console.log(`\nBackups checked: ${backups.length}`);
  let source: { file: string; rows: Found[] } | null = null;
  for (const file of backups) {
    const rows = await find(file);
    console.log(`  ${basename(file)}: ${rows.length ? "FOUND" : "not found"}`);
    show(rows);
    // newest backup that still has a client which is missing from live
    const missing = rows.filter((r) => !liveRows.some((l) => l.client.id === r.client.id));
    if (!source && missing.length) source = { file, rows: missing };
  }
  if (!source) { console.log(liveRows.length ? "\nNothing to restore — it is already in the live database." : "\nNot in any backup, so it cannot be restored from here."); console.log(YES ? "\nRESTORE_NOTHING" : "\nLOOK_DONE"); return; }
  console.log(`\nCan be restored from ${basename(source.file)}: ${source.rows.map((r) => r.client.name).join(", ")}`);
  if (!YES) { console.log("\nLOOK_DONE — add --yes to restore."); return; }

  const db = open(LIVE);
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await db.$executeRawUnsafe(`VACUUM INTO '${q(`${LIVE}.backup-before-restore-${stamp}`)}'`);
    await db.$executeRawUnsafe(`ATTACH DATABASE '${q(source.file)}' AS bak`);
    const cols = async (schema: string, table: string) => (await db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA ${schema}.table_info("${table}")`)).map((c) => c.name);
    const tables = (await db.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM bak.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'")).map((t) => t.name);
    // copy rows of one table, using only the columns both databases have
    const copy = async (table: string, where: string) => {
      const live = await cols("main", table);
      const shared = (await cols("bak", table)).filter((c) => live.includes(c)).map((c) => `"${c}"`).join(", ");
      return db.$executeRawUnsafe(`INSERT OR IGNORE INTO main."${table}" (${shared}) SELECT ${shared} FROM bak."${table}" WHERE ${where}`);
    };
    for (const r of source.rows) {
      const id = q(r.client.id);
      // a client code that has since been reused gets the next free code
      const clash = await db.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM main.Client WHERE code = '${q(r.client.code)}' AND id <> '${id}'`);
      if (clash.length) {
        const codes = await db.$queryRawUnsafe<{ code: string }[]>("SELECT code FROM main.Client WHERE code LIKE 'CLI-%'");
        const max = codes.reduce((m, c) => Math.max(m, parseInt(c.code.slice(4), 10) || 0), 999);
        const live = await cols("main", "Client");
        const shared = (await cols("bak", "Client")).filter((c) => live.includes(c) && c !== "code").map((c) => `"${c}"`).join(", ");
        await db.$executeRawUnsafe(`INSERT OR IGNORE INTO main."Client" ("code", ${shared}) SELECT 'CLI-${max + 1}', ${shared} FROM bak."Client" WHERE id = '${id}'`);
      } else await copy("Client", `id = '${id}'`);
      if (!(await db.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM main.Client WHERE id = '${id}'`)).length) throw new Error(`Could not restore client ${r.client.name}`);
      let rows = 0;
      for (const t of tables) if (t !== "Client" && (await cols("bak", t)).includes("clientId")) rows += await copy(t, `clientId = '${id}'`);
      const pays = await copy("Payment", `invoiceId IN (SELECT id FROM bak.SalesInvoice WHERE clientId = '${id}')`);
      const back = await db.$queryRawUnsafe<{ number: string }[]>(`SELECT number FROM main.SalesInvoice WHERE clientId = '${id}'`);
      console.log(`  restored ${r.client.name}: ${back.length} invoice(s) [${back.map((i) => i.number).join(", ")}], ${pays} payment(s), ${rows} linked row(s)`);
      const lost = r.invoices.filter((i) => !back.some((b) => b.number === i.number));
      if (lost.length) console.log(`  NOT restored (invoice number now used by another invoice): ${lost.map((i) => i.number).join(", ")}`);
    }
    console.log("\nRESTORE_DONE");
  } finally { await db.$disconnect(); }
}

main().catch((e) => { console.error("SCRIPT_ERROR:", e); process.exitCode = 1; });
