// Studiox Shoot — read only, nothing is changed: which video editors are on the shoot team
// ("Goes on shoots" → can be picked as the shooter and get "My Shoots"), and every shoot from
// the last 30 days on, with who it is assigned to.
//
//   npx tsx prisma/shoot-check.ts
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

async function main() {
  // each person with a short id and whether they can log in — two records with the same name
  // (one with a login, one without) would mean a shoot can go to the wrong one
  const people = await prisma.user.findMany({ where: { role: { in: ["EDITOR", "VIDEOGRAPHER", "STUDIO_HEAD"] } }, select: { id: true, name: true, role: true, active: true, shootTeam: true, email: true, passwordHash: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  const tag = (id: string) => `#${id.slice(-5)}`;
  console.log("Video team / Studio X people:");
  for (const p of people) console.log(`  ${p.name} ${tag(p.id)} · ${p.role}${p.active ? "" : " (inactive)"} · login: ${p.email ? (p.passwordHash ? "yes" : "email set, no password yet") : "NO LOGIN"}${p.role === "EDITOR" ? (p.shootTeam ? " · goes on shoots: YES" : " · goes on shoots: no") : ""}`);

  const from = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const shoots = await prisma.shoot.findMany({ where: { date: { gte: from } }, select: { code: true, title: true, date: true, status: true, category: true, assignedToId: true, assignedTo: { select: { name: true, role: true } }, requestedBy: { select: { name: true } } }, orderBy: { date: "asc" } });
  console.log(`\nShoots from ${from} on: ${shoots.length}`);
  for (const s of shoots) console.log(`  ${s.date} · ${s.code} · ${s.title} · ${s.category} · ${s.status} · shooter: ${s.assignedTo ? `${s.assignedTo.name} ${tag(s.assignedToId!)} (${s.assignedTo.role})` : "NOT ASSIGNED"}${s.requestedBy ? ` · requested by ${s.requestedBy.name}` : ""}`);
  const all = await prisma.shoot.count();
  console.log(`\nAll shoots ever: ${all}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
