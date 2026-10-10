"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIST } from "@/lib/india-date";
import { planEditCounts } from "@/lib/video-import-core";
import { teamOf } from "@/lib/team-kinds";
import { canOpenEditCount, isVideoAdmin, isVideoLead } from "@/lib/edit-count-queries";

// Video team "Editing Count" — saving a day's count, loading the old Google Sheet, and
// choosing the team lead. Kept in its own file so nothing else in the CRM is touched.

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime());

// An editor saves their own count for a day; the team lead / an admin can save anyone's.
// An empty count removes that day's entry (it was entered by mistake).
export async function saveEditCount(fd: FormData) {
  const me = await getCurrentUser();
  const team = teamOf(str(fd, "team")); // video editors by default; "DESIGN" for the designers
  if (!me || !canOpenEditCount(me, team.kind)) redirect("/");
  const date = str(fd, "date");
  const today = todayIST();
  // `return=home`: saved from the card on the editor's own dashboard → stay there
  const home = str(fd, "return") === "home";
  const back: (flag: string) => never = (flag) => redirect(home ? "/" : `${team.path}?month=${(validDate(date) ? date : today).slice(0, 7)}&saved=${flag}`);
  if (!validDate(date) || date > today) back("baddate");

  const userId = isVideoLead(me, team.kind) ? str(fd, "userId") || me.id : me.id;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target || target.role !== team.role) back("noeditor");

  const raw = str(fd, "count");
  if (raw === "") {
    await prisma.editCount.deleteMany({ where: { userId, date } });
  } else {
    const count = Math.round(Number(raw));
    if (!Number.isFinite(count) || count < 0 || count > 500) back("badcount");
    const note = str(fd, "note").slice(0, 300);
    await prisma.editCount.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, count, note, updatedBy: me.name },
      update: { count, note, updatedBy: me.name },
    });
  }
  revalidatePath(team.path);
  revalidatePath("/");
  back("1");
}

// Team lead / admin: ping the editors who have not entered today's count yet.
export async function remindEditCount(fd: FormData) {
  const me = await getCurrentUser();
  const team = teamOf(str(fd, "team"));
  if (!me || !isVideoLead(me, team.kind)) redirect("/");
  const today = todayIST();
  const [editors, done] = await Promise.all([
    prisma.user.findMany({ where: { role: team.role, active: true, id: { not: me.id } }, select: { id: true } }),
    prisma.editCount.findMany({ where: { date: today }, select: { userId: true } }),
  ]);
  const have = new Set(done.map((x) => x.userId));
  const title = `Update today's ${team.title.toLowerCase()}`;
  // no second ping while the first one is still unread
  const pending = await prisma.notification.findMany({ where: { title, read: false, userId: { in: editors.map((e) => e.id) } }, select: { userId: true } });
  const pinged = new Set(pending.map((p) => p.userId));
  const to = editors.filter((e) => !have.has(e.id) && !pinged.has(e.id));
  if (to.length) await prisma.notification.createMany({ data: to.map((e) => ({ userId: e.id, title, body: `${me.name} is waiting for your count — it takes 10 seconds.`, link: team.path, tone: "amber" })) });
  redirect(`${team.path}?saved=${to.length ? "reminded" : "noremind"}`);
}

// Super Admin / Sub Admin: who leads the video team (one editor, or nobody) and which editors
// also go on shoots (only they can be picked as the shooter and get "My Shoots").
export async function saveVideoTeamSettings(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !isVideoAdmin(me)) redirect("/");
  const team = teamOf(str(fd, "team"));
  const editors = await prisma.user.findMany({ where: { role: team.role }, select: { id: true } });
  const ids = new Set(editors.map((e) => e.id));
  const leadId = ids.has(str(fd, "leadId")) ? str(fd, "leadId") : "";
  const shoot = new Set(fd.getAll("shootTeam").map(String).filter((id) => ids.has(id)));
  await prisma.$transaction(editors.map((e) => prisma.user.update({ where: { id: e.id }, data: { teamLead: e.id === leadId, ...(team.kind === "VIDEO" ? { shootTeam: shoot.has(e.id) } : {}) } })));
  revalidatePath(team.path);
  revalidatePath("/", "layout");
  redirect(`${team.path}?${str(fd, "month") ? `month=${str(fd, "month")}&` : ""}saved=team`);
}

// ---- load the old sheet (CSV): first column the date, then one column per editor ----

export type EditCountImportResult = { ok: boolean; message: string; details?: string[] } | null;

export async function importEditCounts(_prev: EditCountImportResult, fd: FormData): Promise<EditCountImportResult> {
  const me = await getCurrentUser();
  const team = teamOf(str(fd, "team"));
  if (!me || !isVideoLead(me, team.kind)) return { ok: false, message: "Only the team lead or an admin can import the sheet." };
  const file = fd.get("file");
  if (!file || typeof file === "string" || !(file as File).size) return { ok: false, message: "Choose the count CSV file first." };
  const editors = await prisma.user.findMany({ where: { role: team.role }, select: { id: true, name: true } });
  const plan = planEditCounts(await (file as File).text(), editors, todayIST());
  if ("error" in plan) return { ok: false, message: plan.error ?? "That file could not be read." };

  // A day that is already in the CRM is replaced with the sheet's number, so importing the
  // same file twice never doubles anything.
  const existing = await prisma.editCount.findMany({ where: { userId: { in: [...new Set(plan.data.map((d) => d.userId))] } }, select: { userId: true, date: true } });
  const have = new Set(existing.map((e) => `${e.userId}|${e.date}`));
  const replaced = plan.data.filter((d) => have.has(`${d.userId}|${d.date}`)).length;
  const by = `${me.name} (sheet import)`;
  await prisma.$transaction(plan.data.map((d) => prisma.editCount.upsert({
    where: { userId_date: { userId: d.userId, date: d.date } },
    create: { ...d, updatedBy: by },
    update: { count: d.count, updatedBy: by },
  })));
  revalidatePath(team.path); revalidatePath("/");

  const details = [...plan.perEditor];
  if (plan.missing.length) details.push(`NOT imported — no ${team.member} with this name in Team: ${plan.missing.join(", ")}. Add them in Team (role ${team.member}) and import the same file again.`);
  if (plan.badDates.length) details.push(`Rows skipped, date not understood: ${plan.badDates.slice(0, 5).join(", ")}${plan.badDates.length > 5 ? "…" : ""}`);
  if (plan.badCells) details.push(`${plan.badCells} cell(s) skipped — not a number.`);
  if (plan.future) details.push(`${plan.future} row(s) skipped — date is in the future.`);
  const dates = plan.data.map((d) => d.date).sort();
  return { ok: true, message: `Imported ${plan.data.length} day counts (${plan.data.length - replaced} new, ${replaced} replaced) · ${dates[0]} to ${dates[dates.length - 1]}.`, details };
}
