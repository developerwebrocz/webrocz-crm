// Shows what an account manager's dashboard is built from — read only, nothing is changed:
// the person's role, and the clients they see (as account manager, and shared with them).
// Without a name it lists every account manager with their client counts.
//
//   npx tsx prisma/am-check.ts 'name=Team member name'
//   npx tsx prisma/am-check.ts
//
// Same Prisma + SQLite adapter as the app.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync } from "node:fs";
import { SHARED_AM } from "../src/lib/am-scope";
import { ROLES } from "../src/lib/domain";

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
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const roleName = (r: string) => (ROLES as Record<string, string>)[r] ?? r;

async function main() {
  const [users, clients] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, role: true, active: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ select: { name: true, status: true, accountManagerId: true, assignments: { where: { department: SHARED_AM }, select: { userId: true } } }, orderBy: { name: "asc" } }),
  ]);
  const own = (id: string) => clients.filter((c) => c.accountManagerId === id);
  const shared = (id: string) => clients.filter((c) => c.accountManagerId !== id && c.assignments.some((a) => a.userId === id));

  const name = args.get("name");
  if (name) {
    const words = norm(name).split(" ");
    const hit = users.filter((u) => norm(u.name) === norm(name));
    const people = hit.length ? hit : users.filter((u) => words.every((w) => norm(u.name).includes(w)) || norm(u.name).split(" ").every((w) => norm(name).includes(w)));
    if (!people.length) console.log(`No team member called "${name}".`);
    if (people.length > 1) console.log(`! ${people.length} team members match "${name}" — the same person may have been added twice:`);
    for (const p of people) {
      const o = own(p.id), s = shared(p.id);
      console.log(`\n${p.name} — role: ${roleName(p.role)}${p.active ? "" : " (NOT active)"}`);
      console.log(`  sees only own clients: ${p.role === "ACCOUNT_MANAGER" || p.role === "DM_EXEC" ? "yes" : "NO — this role sees every client"}`);
      console.log(`  account manager of ${o.length} client${o.length === 1 ? "" : "s"}${o.length ? ": " + o.map((c) => c.name).join(", ") : ""}`);
      console.log(`  shared with them: ${s.length}${s.length ? ": " + s.map((c) => c.name).join(", ") : ""}`);
      console.log(`  on the dashboard (active clients): ${[...o, ...s].filter((c) => c.status === "ACTIVE").length}`);
    }
    console.log("");
  }

  console.log("Account management team:");
  for (const u of users.filter((x) => ["ACCOUNT_MANAGER", "DM_EXEC", "AM_HEAD", "DM_HEAD"].includes(x.role))) {
    console.log(`  ${u.name} — ${roleName(u.role)}${u.active ? "" : " (not active)"} — ${own(u.id).length} clients, ${shared(u.id).length} shared`);
  }
  console.log(`Clients with no account manager: ${clients.filter((c) => !c.accountManagerId).length} of ${clients.length}`);
  console.log("AM_CHECK_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
