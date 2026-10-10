"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canOpenDesignPostings, isDesignLead, weekStartOf, weekLabel } from "@/lib/design-posting-queries";
import { todayIST } from "@/lib/india-date";
import { planDesignPostings } from "@/lib/video-import-core";

// Design team "Assigned Postings" — assign a client to a designer for a week, update how many
// posts are done, copy last week's clients into a new week, and load the old Google Sheet.

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string) => { const n = Math.round(Number(str(fd, k))); return Number.isFinite(n) && n > 0 ? Math.min(n, 9999) : 0; };
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const weekOf = (fd: FormData) => { const w = str(fd, "week"); return /^\d{4}-\d{2}-\d{2}$/.test(w) ? weekStartOf(w) : weekStartOf(todayIST()); };

async function clientIdByName(name: string) {
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  const hit = clients.filter((c) => norm(c.name) === norm(name));
  return hit.length === 1 ? hit[0].id : null;
}

export async function saveDesignPosting(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !canOpenDesignPostings(me)) redirect("/");
  const id = str(fd, "id");
  const existing = id ? await prisma.designPosting.findUnique({ where: { id } }) : null;
  const week = existing?.weekStart ?? weekOf(fd);
  const ret = str(fd, "return");
  const back: (flag: string) => never = (flag) => redirect(ret.startsWith("/") && !ret.startsWith("//") ? ret : `/design-postings?week=${week}&saved=${flag}`);
  if (id && !existing) back("gone");
  const lead = isDesignLead(me);
  const allDone = str(fd, "complete") === "1";

  // A designer updates the progress of their own client only (also the quick "All done" tick).
  if (!lead || (existing && !fd.has("clientName"))) {
    if (!existing || (!lead && existing.userId !== me.id)) back("denied");
    const row = existing!;
    const done = allDone ? Math.max(row.target, row.done) : int(fd, "done");
    await prisma.designPosting.update({ where: { id: row.id }, data: { done, ...(fd.has("note") ? { note: str(fd, "note").slice(0, 300) } : allDone && !row.note ? { note: "All done" } : {}), updatedBy: me.name } });
    revalidatePath("/design-postings"); revalidatePath("/");
    back("1");
  }

  const clientName = str(fd, "clientName").replace(/\s+/g, " ").slice(0, 160);
  const userId = str(fd, "userId");
  const designer = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }) : null;
  if (!clientName || !designer || designer.role !== "DESIGNER") back("bad");
  const monthlyPosts = int(fd, "monthlyPosts");
  // "Total post" for the week: what was typed, else a quarter of the month's posts
  const target = str(fd, "target") === "" ? Math.ceil(monthlyPosts / 4) : int(fd, "target");
  const done = allDone ? Math.max(target, int(fd, "done")) : int(fd, "done");
  const data = { weekStart: week, userId: designer!.id, clientName, clientId: await clientIdByName(clientName), monthlyPosts, target, done, note: str(fd, "note").slice(0, 300), updatedBy: me.name };
  if (existing) await prisma.designPosting.update({ where: { id: existing.id }, data });
  else await prisma.designPosting.create({ data });

  // tell the designer who just got the client
  if ((!existing || existing.userId !== designer!.id) && designer!.id !== me.id) {
    try {
      await prisma.notification.create({ data: { userId: designer!.id, title: `Posts assigned: ${clientName}`, body: `${target} post${target === 1 ? "" : "s"} for the week ${weekLabel(week)} · assigned by ${me.name}`, link: "/design-postings", tone: "violet" } });
    } catch { /* notifications are best-effort */ }
  }
  revalidatePath("/design-postings"); revalidatePath("/");
  back("1");
}

export async function deleteDesignPosting(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !isDesignLead(me)) redirect("/");
  const row = await prisma.designPosting.findUnique({ where: { id: str(fd, "id") }, select: { id: true, weekStart: true } });
  if (row) await prisma.designPosting.delete({ where: { id: row.id } });
  revalidatePath("/design-postings"); revalidatePath("/");
  redirect(`/design-postings?week=${row?.weekStart ?? weekOf(fd)}&saved=deleted`);
}

// Start a new week from last week's list: the same designers and clients with the same weekly
// number of posts, "done" back to 0. Only when the week has nothing in it yet.
export async function copyDesignWeek(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !isDesignLead(me)) redirect("/");
  const week = weekOf(fd);
  const prev = new Date(new Date(`${week}T00:00:00Z`).getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const [has, rows] = await Promise.all([
    prisma.designPosting.count({ where: { weekStart: week } }),
    prisma.designPosting.findMany({ where: { weekStart: prev, user: { role: "DESIGNER", active: true } }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!has && rows.length) {
    await prisma.designPosting.createMany({ data: rows.map((r) => ({ weekStart: week, userId: r.userId, clientId: r.clientId, clientName: r.clientName, monthlyPosts: r.monthlyPosts, target: r.target, done: 0, note: "", updatedBy: me.name })) });
  }
  revalidatePath("/design-postings"); revalidatePath("/");
  redirect(`/design-postings?week=${week}&saved=${!has && rows.length ? "copied" : "nocopy"}`);
}

// ---- load the old sheet (CSV): Designer, Client, Monthly posts, Total post, Done, Note ----
export type DesignPostingImportResult = { ok: boolean; message: string; details?: string[] } | null;

export async function importDesignPostings(_prev: DesignPostingImportResult, fd: FormData): Promise<DesignPostingImportResult> {
  const me = await getCurrentUser();
  if (!me || !isDesignLead(me)) return { ok: false, message: "Only the design team lead or an admin can import the sheet." };
  const file = fd.get("file");
  if (!file || typeof file === "string" || !(file as File).size) return { ok: false, message: "Choose the postings CSV file first." };
  const week = weekOf(fd);
  const [designers, clients, existing] = await Promise.all([
    prisma.user.findMany({ where: { role: "DESIGNER" }, select: { id: true, name: true } }),
    prisma.client.findMany({ select: { id: true, name: true } }),
    prisma.designPosting.findMany({ where: { weekStart: week }, select: { id: true, userId: true, clientName: true } }),
  ]);
  const plan = planDesignPostings(await (file as File).text(), designers, clients, existing);
  if ("error" in plan) return { ok: false, message: plan.error ?? "That file could not be read." };
  const by = `${me.name} (sheet import)`;
  await prisma.$transaction(plan.ops.map((o) => (o.id
    ? prisma.designPosting.update({ where: { id: o.id }, data: { ...o.data, updatedBy: by } })
    : prisma.designPosting.create({ data: { ...o.data, weekStart: week, updatedBy: by } }))));
  revalidatePath("/design-postings"); revalidatePath("/");
  const details = [...plan.perDesigner];
  if (plan.missing.length) details.push(`NOT imported — no Designer with this name in Team: ${plan.missing.join(", ")}. Add them in Team (role Designer) and import the same file again.`);
  return { ok: true, message: `Imported ${plan.ops.length} client postings into the week ${weekLabel(week)} (${plan.added} new, ${plan.replaced} replaced).`, details };
}
