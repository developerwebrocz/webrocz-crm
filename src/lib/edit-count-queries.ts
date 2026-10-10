import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";

// Video team "Editing Count": how many videos each editor finished per day (this replaced the
// team's Google Sheet). An editor sees and updates their own count; the video team lead and
// the admins see the whole team, update anyone's count and assign video work.

export type EditCountViewer = { id: string; role: string; teamLead?: boolean | null };

export const isVideoAdmin = (u: EditCountViewer) => u.role === "SUPER_ADMIN" || u.role === "SUB_ADMIN";
// sees the whole team (lead = a Video Editor marked as team lead)
export const isVideoLead = (u: EditCountViewer) => isVideoAdmin(u) || (u.role === "EDITOR" && !!u.teamLead);
export const canOpenEditCount = (u: EditCountViewer) => isVideoAdmin(u) || u.role === "EDITOR";

const pad = (n: number) => String(n).padStart(2, "0");
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

export async function getEditCountBoard(viewer: EditCountViewer, monthParam?: string) {
  const today = todayIST();
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const seeAll = isVideoLead(viewer);
  const [y, m] = month.split("-").map(Number);
  const dayCount = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const entries = await prisma.editCount.findMany({
    where: { date: { startsWith: month }, ...(seeAll ? {} : { userId: viewer.id }) },
    select: { userId: true, date: true, count: true, note: true, updatedBy: true },
  });
  // Columns: the active video editors, plus anyone (since left or moved) who has a count this month.
  const withEntry = [...new Set(entries.map((e) => e.userId))];
  const people = await prisma.user.findMany({
    where: seeAll ? { OR: [{ role: "EDITOR", active: true }, { id: { in: withEntry } }] } : { id: viewer.id },
    select: { id: true, name: true, teamLead: true, role: true, active: true },
  });
  const editors = people
    .map((p) => ({ id: p.id, name: p.name, lead: p.role === "EDITOR" && p.teamLead, active: p.active && p.role === "EDITOR" }))
    .sort((a, b) => Number(b.lead) - Number(a.lead) || a.name.localeCompare(b.name));

  const cells: Record<string, { count: number; note: string; by: string }> = {};
  for (const e of entries) cells[`${e.userId}|${e.date}`] = { count: e.count, note: e.note, by: e.updatedBy };

  const days = Array.from({ length: dayCount }, (_, i) => {
    const date = `${month}-${pad(i + 1)}`;
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    return {
      date, day: i + 1,
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow],
      sunday: dow === 0, future: date > today, isToday: date === today,
      total: editors.reduce((s, ed) => s + (cells[`${ed.id}|${date}`]?.count ?? 0), 0),
      any: editors.some((ed) => cells[`${ed.id}|${date}`] !== undefined),
    };
  });

  const perEditor = editors.map((ed) => {
    const mine = entries.filter((e) => e.userId === ed.id);
    const total = mine.reduce((s, e) => s + e.count, 0);
    const worked = mine.filter((e) => e.count > 0).length;
    return { ...ed, total, entries: mine.length, worked, avg: worked ? Math.round((total / worked) * 10) / 10 : 0, today: cells[`${ed.id}|${today}`]?.count ?? null };
  });
  const grand = perEditor.reduce((s, e) => s + e.total, 0);

  // The team's video work (lead / admin only): everything still open, and what was finished lately.
  const tasks = seeAll
    ? (await prisma.creativeTask.findMany({
        where: { kind: "VIDEO", OR: [{ status: { not: "COMPLETED" } }, { updatedAt: { gte: new Date(Date.now() - 14 * 86400000) } }] },
        include: { client: { select: { name: true } }, assignedTo: { select: { name: true } }, assignedByUser: { select: { name: true } } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 200,
      })).map((t) => ({
        id: t.id, code: t.code, title: t.title, client: t.client?.name ?? "", editor: t.assignedTo.name, by: t.assignedByUser?.name ?? "",
        type: t.type, priority: t.priority, status: t.status, dueDate: t.dueDate, assignedDate: t.assignedDate,
        overdue: !!t.dueDate && t.dueDate < today && t.status !== "COMPLETED",
        done: t.status === "COMPLETED", at: t.updatedAt.getTime(),
      }))
        // open work first (earliest due date on top, no due date last), then the finished ones, newest first
        .sort((a, b) => Number(a.done) - Number(b.done) || (a.done ? b.at - a.at : (a.dueDate || "9999").localeCompare(b.dueDate || "9999")))
    : [];

  return {
    month, today,
    monthLabel: new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }),
    prevMonth: shiftMonth(month, -1),
    nextMonth: shiftMonth(month, 1) <= today.slice(0, 7) ? shiftMonth(month, 1) : "",
    seeAll, editors, days, cells, perEditor, grand,
    todayTotal: perEditor.reduce((s, e) => s + (e.today ?? 0), 0),
    tasks,
  };
}

export type EditCountBoardData = Awaited<ReturnType<typeof getEditCountBoard>>;
