// Gives clients their account manager from a sheet (CSV: Company name, Phone, Account manager),
// so each account manager sees their own clients on their dashboard. Only the account manager
// of a client is set — nothing else is changed and nothing is deleted.
//
//   npx tsx prisma/assign-account-managers.ts 'file=/tmp/account-managers.csv'
//
// • A client that already has an account manager is left as it is (add --overwrite to replace).
// • A manager name in the sheet that does not clearly match ONE team member (Account Manager /
//   AM Head / Digital Marketing Executive) is not guessed — it is listed at the end. Tell which
//   team member it is with  'map=Sheet name>Team name;Other>Other'  and run again.
// Names and files are given on the command line (not stored here). Same Prisma + SQLite adapter as the app.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync } from "node:fs";
import { parseCsv } from "../src/lib/video-import-core";

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
const OVERWRITE = process.argv.includes("--overwrite");
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const digits = (v: string) => { const d = (v || "").replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; };

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const prefix = (a: string, b: string) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };

type Person = { id: string; name: string };
// The sheet's manager name → the one team member it means. Tried from the strictest rule to the
// loosest; a rule counts only when exactly one person fits, otherwise nobody is chosen.
function findManager(sheet: string, people: Person[]): Person | null {
  const n = norm(sheet);
  if (!n) return null;
  const words = (v: string) => norm(v).split(" ").filter(Boolean);
  const main = (v: string) => words(v).filter((w) => w.length > 1).sort((a, b) => b.length - a.length)[0] ?? ""; // "B Naveen" → "naveen"
  const initials = (v: string) => words(v).filter((w) => w.length === 1);
  const one = (list: Person[]) => (list.length === 1 ? list[0] : null);
  const rules: ((p: Person) => boolean)[] = [
    (p) => norm(p.name) === n,
    (p) => words(p.name).sort().join(" ") === words(sheet).sort().join(" "),
    // same main name, and the sheet's initial is the first letter of one of the person's other words ("B Naveen" ~ "Naveen Babu")
    (p) => main(p.name) === main(sheet) && initials(sheet).length > 0 && initials(sheet).every((i) => words(p.name).some((w) => w !== main(p.name) && w.startsWith(i))),
    (p) => main(p.name) === main(sheet) && initials(sheet).length === 0,
    (p) => main(sheet).length >= 4 && main(p.name).length >= 4 && (main(p.name).includes(main(sheet)) || main(sheet).includes(main(p.name))), // "Veeraveni" ~ "Veni"
    (p) => { const a = main(p.name), b = main(sheet), c = prefix(a, b); return c >= 4 && c >= Math.min(a.length, b.length) * 0.8; }, // "Sowjanya" ~ "Sowji"
    (p) => main(sheet).length >= 4 && distance(main(p.name), main(sheet)) <= 1, // "Arunu" ~ "Arun"
  ];
  for (const rule of rules) { const hit = people.filter(rule); if (hit.length === 1) return one(hit); if (hit.length > 1) return null; }
  return null;
}

async function main() {
  const file = args.get("file");
  if (!file) { console.log("Give the sheet: 'file=/tmp/account-managers.csv'"); return; }
  const rows = parseCsv(readFileSync(file, "utf8"));
  const head = rows[0].map((h) => h.toLowerCase());
  const C = { name: head.findIndex((h) => h.includes("company") || h.includes("client") || h === "name"), phone: head.findIndex((h) => h.includes("phone") || h.includes("mobile")), am: head.findIndex((h) => h.includes("account") || h.includes("manager")) };
  if (C.name < 0 || C.am < 0) { console.log("The sheet needs a 'Company name' column and an 'Account manager' column."); return; }

  const [managers, clients] = await Promise.all([
    prisma.user.findMany({ where: { active: true, role: { in: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ select: { id: true, name: true, pocMobile: true, accountManagerId: true } }),
  ]);
  console.log(`Account managers in Team: ${managers.map((m) => m.name).join(", ") || "(none)"}\n`);
  const nameOf = new Map(managers.map((m) => [m.id, m.name]));

  // 'map=Sheet name>Team name;…' — said by hand for the names the rules cannot settle
  const said = new Map<string, Person>();
  for (const pair of (args.get("map") ?? "").split(";").map((x) => x.trim()).filter(Boolean)) {
    const [from, to] = pair.split(">").map((x) => (x ?? "").trim());
    const p = managers.find((m) => norm(m.name) === norm(to ?? ""));
    if (from && p) said.set(norm(from), p); else console.log(`  ! map "${pair}": no account manager called "${to}" in Team.`);
  }
  const resolved = new Map<string, Person | null>();
  const managerFor = (sheet: string) => { const k = norm(sheet); if (!resolved.has(k)) resolved.set(k, said.get(k) ?? findManager(sheet, managers)); return resolved.get(k)!; };

  const set: Record<string, number> = {}; const kept: string[] = []; const noClient: string[] = []; const noManager = new Map<string, string[]>();
  let same = 0;
  for (const r of rows.slice(1)) {
    const cname = (r[C.name] ?? "").trim(); const am = (r[C.am] ?? "").trim();
    if (!cname || !am) continue;
    let hit = clients.filter((c) => norm(c.name) === norm(cname));
    if (hit.length !== 1 && C.phone >= 0 && digits(r[C.phone] ?? "")) hit = clients.filter((c) => digits(c.pocMobile ?? "") === digits(r[C.phone] ?? "") && norm(c.name).split(" ")[0] === norm(cname).split(" ")[0]);
    if (hit.length !== 1) { noClient.push(cname); continue; }
    const client = hit[0];
    const m = managerFor(am);
    if (!m) { noManager.set(am, [...(noManager.get(am) ?? []), client.name]); continue; }
    if (client.accountManagerId === m.id) { same++; continue; }
    if (client.accountManagerId && !OVERWRITE) { kept.push(`${client.name} (has ${nameOf.get(client.accountManagerId) ?? "another manager"}, sheet says ${m.name})`); continue; }
    await prisma.client.update({ where: { id: client.id }, data: { accountManagerId: m.id } });
    client.accountManagerId = m.id;
    set[m.name] = (set[m.name] ?? 0) + 1;
  }

  console.log("Sheet name → team member:");
  for (const [k, p] of resolved) console.log(`  ${k} → ${p ? p.name : "NOT matched"}`);
  const total = Object.values(set).reduce((s, n) => s + n, 0);
  console.log(`\nAccount manager set on ${total} client${total === 1 ? "" : "s"}${total ? ": " + Object.entries(set).map(([n, c]) => `${n} ${c}`).join(", ") : ""}.`);
  console.log(`Already right: ${same}.`);
  if (kept.length) console.log(`Left as they are (already have a different manager — add --overwrite to follow the sheet): ${kept.length}\n  ${kept.join("\n  ")}`);
  if (noManager.size) {
    console.log("\n! NOT set — the sheet's manager does not clearly match one team member:");
    for (const [am, list] of noManager) console.log(`  "${am}" (${list.length} clients): ${list.join(", ")}`);
    console.log("  → add them in Team as Account Manager, or say who it is:  'map=Sheet name>Team name'  and run again.");
  }
  if (noClient.length) console.log(`\n! Client not found (or two with the same name): ${noClient.join(", ")}`);
  console.log("AM_ASSIGN_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
