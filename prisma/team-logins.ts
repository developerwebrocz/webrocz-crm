// Shows the login details of team members — read only, nothing is changed:
// the login ID (email), whether a password is already set, and for a member without a
// password the link on which they set their own password.
//
//   npx tsx prisma/team-logins.ts 'team=design'          (all designers)
//   npx tsx prisma/team-logins.ts 'team=video'           (all video editors)
//   npx tsx prisma/team-logins.ts 'names=Venkat,Poorna'  (these people)
//   npx tsx prisma/team-logins.ts 'team=admin'           (Super Admin / Sub Admin — they log in on /login)
//
// Passwords are never shown (they are stored scrambled) and are never set from here: each
// person sets their own on the link. Uses the same Prisma + SQLite adapter as the app.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync } from "node:fs";
import { matchPerson } from "../src/lib/video-import-core";

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
const SITE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://admin.webrocz.com").replace(/\/+$/, "");

const args = new Map(process.argv.slice(2).map((a) => { const i = a.indexOf("="); return [a.slice(0, i).trim().toLowerCase(), a.slice(i + 1).trim()] as const; }));

async function main() {
  const team = (args.get("team") ?? "").toLowerCase();
  const role = team.startsWith("design") ? "DESIGNER" : team.startsWith("video") ? "EDITOR" : "";
  const admins = team.startsWith("admin");
  const all = await prisma.user.findMany({ where: admins ? { role: { in: ["SUPER_ADMIN", "SUB_ADMIN"] } } : role ? { role } : {}, select: { id: true, name: true, role: true, email: true, active: true, teamLead: true, passwordHash: true }, orderBy: { name: "asc" } });
  let people = all;
  if (args.has("names")) {
    people = [];
    for (const n of args.get("names")!.split(",").map((x) => x.trim()).filter(Boolean)) {
      const u = matchPerson(n, all);
      if (u) people.push(u); else console.log(`! Nobody in Team matches "${n}"${role ? ` (role ${role})` : ""} — add them in Team first.`);
    }
  }
  if (!people.length) { console.log("No team members found."); return; }
  console.log(admins ? `Login page for Super Admin: ${SITE}/login\n` : `Login page for team members: ${SITE}/staff\n`);
  for (const u of people) {
    console.log(`${u.name}  (${u.role}${u.teamLead ? ", team lead" : ""}${u.active ? "" : ", DISABLED"})`);
    if (!u.email) { console.log("  Login ID : none — add an email for this person in Team (Edit), then run this again.\n"); continue; }
    console.log(`  Login ID : ${u.email}`);
    if (u.passwordHash) console.log("  Password : already set by them. Forgotten? In Team click Reset password, then run this again for a new link.\n");
    else console.log(`  Password : not set yet. They set their own on this link:\n             ${SITE}/staff?setpw=1&email=${encodeURIComponent(u.email)}\n`);
  }
  console.log("LOGINS_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
