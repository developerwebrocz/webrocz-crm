// Video team and design team: set the team lead / shoot team and load the old Google Sheets, straight in the
// database — the same things the buttons in the CRM do (Editing Count → Video team settings,
// "Import sheet" on Editing Count and Client Videos). Nothing is deleted; running it twice
// replaces, never doubles. Names and files are given on the command line (not stored here):
//
//   npx tsx prisma/video-team-setup.ts 'lead=Poorna' 'shoots=Poorna,Mallesh'
//   npx tsx prisma/video-team-setup.ts 'counts=/tmp/editing-count.csv' 'clients=/tmp/client-videos.csv'
//
// Design team — add 'team=design' (lead= and counts= then mean the designers); postings= loads
// the designers' "Assigned Postings" into the current week (or 'week=2026-10-05'):
//   npx tsx prisma/video-team-setup.ts 'team=design' 'lead=Venkat' 'counts=/tmp/design-count.csv' 'postings=/tmp/design-postings.csv'
//
// Any of the four can be left out. Uses the same Prisma + SQLite adapter as the app.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync } from "node:fs";
import { matchPerson, planEditCounts, planVideoJobs, planDesignPostings } from "../src/lib/video-import-core";

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

const args = new Map(process.argv.slice(2).map((a) => { const i = a.indexOf("="); return [a.slice(0, i).trim().toLowerCase(), a.slice(i + 1).trim()] as const; }));
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function main() {
  const design = (args.get("team") ?? "").toLowerCase().startsWith("design");
  const ROLE = design ? "DESIGNER" : "EDITOR";
  const LABEL = design ? "Designer" : "Video Editor";
  const editors = await prisma.user.findMany({ where: { role: ROLE }, select: { id: true, name: true, active: true } });
  const names = editors.map((e) => e.name).join(", ") || "(none)";
  console.log(`${LABEL}s in Team: ${names}`);
  const find = (name: string) => {
    const u = matchPerson(name, editors);
    if (!u) console.log(`  ! No ${LABEL} matches "${name}" — add them in Team (role ${LABEL}), then run this again.`);
    return u;
  };

  if (args.has("lead")) {
    const u = find(args.get("lead")!);
    if (u) {
      await prisma.user.updateMany({ where: { role: ROLE, teamLead: true, id: { not: u.id } }, data: { teamLead: false } });
      await prisma.user.update({ where: { id: u.id }, data: { teamLead: true } });
      console.log(`${design ? "Design" : "Video"} team lead: ${u.name}`);
    }
  }
  if (args.has("shoots") && !design) {
    const picked = args.get("shoots")!.split(",").map((x) => x.trim()).filter(Boolean).map(find).filter((u): u is NonNullable<typeof u> => !!u);
    if (picked.length) {
      const ids = picked.map((u) => u.id);
      await prisma.user.updateMany({ where: { role: "EDITOR", id: { notIn: ids } }, data: { shootTeam: false } });
      await prisma.user.updateMany({ where: { id: { in: ids } }, data: { shootTeam: true } });
      console.log(`Goes on shoots (My Shoots): ${picked.map((u) => u.name).join(", ")}`);
    }
  }

  if (args.has("counts")) {
    const plan = planEditCounts(readFileSync(args.get("counts")!, "utf8"), editors, today);
    if ("error" in plan) console.log(`Editing count NOT imported: ${plan.error}`);
    else {
      await prisma.$transaction(plan.data.map((d) => prisma.editCount.upsert({
        where: { userId_date: { userId: d.userId, date: d.date } },
        create: { ...d, updatedBy: "Sheet import" }, update: { count: d.count, updatedBy: "Sheet import" },
      })));
      console.log(`${design ? "Design" : "Editing"} count: ${plan.data.length} day counts imported.`);
      for (const l of plan.perEditor) console.log(`  ${l}`);
      if (plan.missing.length) console.log(`  ! NOT imported — no ${LABEL} with this name: ${plan.missing.join(", ")}`);
    }
  }
  if (args.has("clients")) {
    const [clients, existing] = await Promise.all([
      prisma.client.findMany({ select: { id: true, name: true } }),
      prisma.videoJob.findMany({ select: { id: true, date: true, clientName: true }, orderBy: { createdAt: "asc" } }),
    ]);
    const plan = planVideoJobs(readFileSync(args.get("clients")!, "utf8"), editors, clients, existing, today);
    if ("error" in plan) console.log(`Client videos NOT imported: ${plan.error}`);
    else {
      await prisma.$transaction(plan.ops.map((o) => (o.id
        ? prisma.videoJob.update({ where: { id: o.id }, data: { ...o.data, updatedBy: "Sheet import" } })
        : prisma.videoJob.create({ data: { ...o.data, updatedBy: "Sheet import" } }))));
      console.log(`Client videos: ${plan.ops.length} client shoots imported (${plan.added} new, ${plan.replaced} replaced), ${plan.linked} linked to a CRM client.`);
      if (plan.noLogin.length) console.log(`  ! Editors without a login (kept as a name only): ${plan.noLogin.join(", ")}`);
      if (plan.badDates.length) console.log(`  ! Rows skipped (date): ${plan.badDates.slice(0, 5).join("; ")}`);
    }
  }
  if (args.has("postings")) {
    // Monday of the given week (or of today)
    const base = /^\d{4}-\d{2}-\d{2}$/.test(args.get("week") ?? "") ? args.get("week")! : today;
    const d0 = new Date(`${base}T00:00:00Z`);
    const week = new Date(d0.getTime() - ((d0.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
    const [designers, clients, existing] = await Promise.all([
      prisma.user.findMany({ where: { role: "DESIGNER" }, select: { id: true, name: true } }),
      prisma.client.findMany({ select: { id: true, name: true } }),
      prisma.designPosting.findMany({ where: { weekStart: week }, select: { id: true, userId: true, clientName: true } }),
    ]);
    const plan = planDesignPostings(readFileSync(args.get("postings")!, "utf8"), designers, clients, existing);
    if ("error" in plan) console.log(`Assigned postings NOT imported: ${plan.error}`);
    else {
      await prisma.$transaction(plan.ops.map((o) => (o.id
        ? prisma.designPosting.update({ where: { id: o.id }, data: { ...o.data, updatedBy: "Sheet import" } })
        : prisma.designPosting.create({ data: { ...o.data, weekStart: week, updatedBy: "Sheet import" } }))));
      console.log(`Assigned postings: ${plan.ops.length} client rows imported into the week starting ${week} (${plan.added} new, ${plan.replaced} replaced).`);
      for (const l of plan.perDesigner) console.log(`  ${l}`);
      if (plan.missing.length) console.log(`  ! NOT imported — no Designer with this name: ${plan.missing.join(", ")}`);
    }
  }
  console.log("VIDEO_SETUP_DONE");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
