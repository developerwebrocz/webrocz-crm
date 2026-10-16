import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";
import { parseDesignItems } from "./design-work";
import { WORK_TYPES, WORK_STATUS } from "./domain";

// The design team's work as one simple sheet (Design Count, for the Super Admin / design lead):
// for a day / week / month — each designer's total, and one line per piece of work:
// designer · client · work (logo, banner, post …) · how many · who assigned it · status.
// "Assigned by" comes from the design task given for that client (or the weekly postings);
// work given but not done yet shows with its status.

export const SHEET_PERIODS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
] as const;

const shift = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();
const STATUS: Record<string, string> = { PENDING: "Pending", IN_PROGRESS: "In progress", REVIEW: "In review", COMPLETED: "Done", APPROVED: "Done", PLANNED: "Planned", PENDING_APPROVAL: "Sent for approval" };

export type SheetRow = { key: string; date: string; designerId: string; designer: string; client: string; work: string; count: number | null; by: string; status: string; planned?: number; done?: number; detail?: string; link?: string };

// `kind`: the designers (default) or the video editors — the same sheet for both teams.
// Video: "assigned by" comes from the video task, else the client videos (shoots) the lead gave.
export async function getDesignSheet(f: { period?: string; client?: string; designer?: string }, kind: "DESIGN" | "VIDEO" = "DESIGN") {
  const today = todayIST();
  const period = SHEET_PERIODS.some((p) => p.key === f.period) ? f.period! : "today";
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const range = period === "yesterday" ? { from: shift(today, -1), to: shift(today, -1) }
    : period === "week" ? { from: shift(today, -dow), to: today }
    : period === "month" ? { from: `${today.slice(0, 7)}-01`, to: today }
    : { from: today, to: today };

  const designers = await prisma.user.findMany({ where: { role: kind === "VIDEO" ? "EDITOR" : "DESIGNER", active: true }, select: { id: true, name: true, teamLead: true }, orderBy: { name: "asc" } });
  const ids = designers.map((d) => d.id);
  const nameOf = new Map(designers.map((d) => [d.id, d.name]));

  const [counts, tasks, postings] = await Promise.all([
    prisma.editCount.findMany({ where: { userId: { in: ids }, date: { gte: range.from, lte: range.to } }, select: { userId: true, date: true, count: true, items: true, note: true } }),
    prisma.creativeTask.findMany({
      where: { kind, assignedToId: { in: ids }, assignedDate: { lte: range.to }, OR: [{ status: { not: "COMPLETED" } }, { updatedAt: { gte: new Date(`${shift(range.from, -45)}T00:00:00Z`) } }] },
      include: { client: { select: { name: true } }, assignedByUser: { select: { name: true } } },
      orderBy: { assignedDate: "desc" },
    }),
    kind === "DESIGN"
      ? prisma.designPosting.findMany({ where: { userId: { in: ids }, weekStart: { gte: shift(range.from, -6), lte: range.to } }, select: { id: true, weekStart: true, userId: true, clientName: true, updatedBy: true, target: true, done: true } })
      : Promise.resolve([] as { id: string; weekStart: string; userId: string; clientName: string; updatedBy: string; target: number; done: number }[]),
  ]);
  // video team: the client videos (shoots) given to the editors, the last 45 days and still open
  const jobs = kind === "VIDEO"
    ? await prisma.videoJob.findMany({ where: { date: { lte: range.to }, OR: [{ date: { gte: shift(range.from, -45) } }, { editStatus: { in: ["PENDING", "IN_PROGRESS"] } }] }, select: { id: true, date: true, clientName: true, editorIds: true, editStatus: true, videosShot: true, edited: true, updatedBy: true }, orderBy: { date: "desc" } })
    : [];
  const jobEditors = (j: { editorIds: string }) => { try { const a = JSON.parse(j.editorIds || "[]"); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };
  const jobFor = (uid: string, client: string) => jobs.find((j) => jobEditors(j).includes(uid) && norm(j.clientName) === norm(client));
  const usedJobs = new Set<string>();

  // who gave this designer work for this client: the design task, else the weekly postings
  const taskFor = (uid: string, client: string) => tasks.find((t) => t.assignedToId === uid && norm(t.client?.name ?? t.clientLabel) === norm(client));
  const postingFor = (uid: string, client: string) => postings.find((p) => p.userId === uid && norm(p.clientName) === norm(client));

  const rows: SheetRow[] = [];
  const usedTasks = new Set<string>();
  for (const c of counts) {
    const items = parseDesignItems(c.items);
    if (!items.length) {
      if (c.count > 0) rows.push({ key: `${c.userId}|${c.date}|n`, date: c.date, designerId: c.userId, designer: nameOf.get(c.userId) ?? "", client: "", work: c.note ? `Designs (no client details) — ${c.note}` : "Designs (no client details)", count: c.count, by: "", status: "Done" });
      continue;
    }
    items.forEach((it, i) => {
      const t = taskFor(c.userId, it.client);
      if (t) usedTasks.add(t.id);
      const p = t ? null : postingFor(c.userId, it.client);
      const j = t || p ? null : jobFor(c.userId, it.client);
      if (j) usedJobs.add(j.id);
      rows.push({
        key: `${c.userId}|${c.date}|${i}`, date: c.date, designerId: c.userId, designer: nameOf.get(c.userId) ?? "",
        client: it.client, work: it.type || (kind === "VIDEO" ? "Video" : "Design"), count: it.count,
        by: t ? (t.assignedByUser?.name ?? "") : p ? (p.updatedBy ? `${p.updatedBy} (weekly posts)` : "Weekly posts") : j ? (j.updatedBy ? `${j.updatedBy} (client videos)` : "Client videos") : "Own work",
        status: "Done",
      });
    });
  }
  // the work they reported in Update Work (client, kind of work, how many) — real entries
  const reported = await prisma.workUpdate.findMany({
    where: { userId: { in: ids }, date: { gte: new Date(`${range.from}T00:00:00+05:30`), lte: new Date(`${range.to}T23:59:59.999+05:30`) } },
    include: { client: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  for (const u of reported) {
    const kindLabel = WORK_TYPES.find((w) => w.v === u.workType)?.l.replace(/ \((SMO|Video)\)$/, "") ?? u.workType;
    const client = u.client?.name ?? u.clientLabel ?? "";
    const t = taskFor(u.userId, client);
    if (t) usedTasks.add(t.id);
    const p = t ? null : postingFor(u.userId, client);
    rows.push({
      key: `upd|${u.id}`, date: todayIST(u.date), designerId: u.userId, designer: nameOf.get(u.userId) ?? "",
      client, work: u.workType === "task" ? "Other" : kindLabel, detail: u.title || u.detail || "", link: /^https?:\/\//i.test(u.proofLink ?? "") ? u.proofLink! : "", count: u.quantity,
      by: t ? (t.assignedByUser?.name ?? "") : p ? (p.updatedBy ? `${p.updatedBy} (weekly posts)` : "Weekly posts") : "Own work",
      status: STATUS[u.status] ?? (WORK_STATUS as Record<string, string>)[u.status] ?? u.status,
    });
  }

  // the weekly posting plan of each designer: for every client, posts done of the posts planned
  // (shown for the week(s) of the period; not added to the total — the daily lines count the work)
  for (const p of postings) {
    if (p.target <= 0 && p.done <= 0) continue;
    const left = Math.max(0, p.target - p.done);
    rows.push({
      key: `post|${p.id}`, date: p.weekStart, designerId: p.userId, designer: nameOf.get(p.userId) ?? "", client: p.clientName,
      work: `Weekly posts: ${p.done} of ${p.target} done`, count: null, by: p.updatedBy || "Weekly plan",
      status: p.target > 0 && left === 0 ? "Done" : p.done > 0 ? `${left} left` : "Pending",
      planned: p.target, done: p.done,
    });
  }
  // work given in this period that has no line yet — with its status
  for (const t of tasks) {
    if (usedTasks.has(t.id) || !t.assignedDate || t.assignedDate < range.from) continue;
    rows.push({ key: `task|${t.id}`, date: t.assignedDate, designerId: t.assignedToId, designer: nameOf.get(t.assignedToId) ?? "", client: t.client?.name ?? t.clientLabel, work: `${t.type}: ${t.title}`, count: null, by: t.assignedByUser?.name ?? "", status: STATUS[t.status] ?? t.status });
  }

  const JOB_STATUS: Record<string, string> = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Done", NO_EDIT: "No edit needed" };
  for (const j of jobs) {
    if (usedJobs.has(j.id) || j.date < range.from || !["PENDING", "IN_PROGRESS"].includes(j.editStatus)) continue;
    for (const uid of jobEditors(j).filter((u) => nameOf.has(u))) {
      rows.push({ key: `job|${j.id}|${uid}`, date: j.date, designerId: uid, designer: nameOf.get(uid) ?? "", client: j.clientName, work: `Client videos: ${j.videosShot} shot, ${j.edited} edited`, count: null, by: j.updatedBy || "", status: JOB_STATUS[j.editStatus] ?? j.editStatus });
    }
  }
  const clients = [...new Set(rows.map((r) => r.client).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const clientQ = f.client && clients.some((c) => c === f.client) ? f.client : "";
  const designerQ = designers.some((d) => d.id === f.designer) ? f.designer! : "";
  const inClient = rows.filter((r) => !clientQ || r.client === clientQ);
  const shown = inClient.filter((r) => !designerQ || r.designerId === designerQ)
    .sort((a, b) => b.date.localeCompare(a.date) || a.designer.localeCompare(b.designer) || a.client.localeCompare(b.client));

  const entered = new Set(counts.filter((c) => c.date === today).map((c) => c.userId));
  const people = designers.map((d) => ({
    id: d.id, name: d.name, lead: !!d.teamLead,
    total: inClient.filter((r) => r.designerId === d.id).reduce((s, r) => s + (r.count ?? 0), 0),
    notUpdated: period === "today" && !entered.has(d.id),
  }));

  return {
    period, range, today, clients, clientQ, designerQ, people,
    total: shown.reduce((s, r) => s + (r.count ?? 0), 0),
    allTotal: inClient.reduce((s, r) => s + (r.count ?? 0), 0),
    rows: shown, showDate: range.from !== range.to,
  };
}
export type DesignSheetData = Awaited<ReturnType<typeof getDesignSheet>>;
