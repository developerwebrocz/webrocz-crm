import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";
import { TEAMS, type TeamKind } from "./team-kinds";

// Video team "Editing Count": how many videos each editor finished per day (this replaced the
// team's Google Sheet). An editor sees and updates their own count; the video team lead and
// the admins see the whole team, update anyone's count and assign video work.

export type EditCountViewer = { id: string; role: string; teamLead?: boolean | null };

export const isVideoAdmin = (u: EditCountViewer) => u.role === "SUPER_ADMIN" || u.role === "SUB_ADMIN";
// sees the whole team (lead = a Video Editor marked as team lead)
// (`kind`: which team — the video editors by default, or the designers)
export const isVideoLead = (u: EditCountViewer, kind: TeamKind = "VIDEO") => isVideoAdmin(u) || (u.role === TEAMS[kind].role && !!u.teamLead);
export const canOpenEditCount = (u: EditCountViewer, kind: TeamKind = "VIDEO") => isVideoAdmin(u) || u.role === TEAMS[kind].role;

const pad = (n: number) => String(n).padStart(2, "0");
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

export async function getEditCountBoard(viewer: EditCountViewer, monthParam?: string, kind: TeamKind = "VIDEO") {
  const ROLE = TEAMS[kind].role;
  // the whole team's rows = the counts of people in this team's role (both teams share the table)
  const scope = (all: boolean) => (all ? { user: { role: ROLE } } : { userId: viewer.id });
  const today = todayIST();
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const seeAll = isVideoLead(viewer, kind);
  const [y, m] = month.split("-").map(Number);
  const dayCount = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const entries = await prisma.editCount.findMany({
    where: { date: { startsWith: month }, ...scope(seeAll) },
    select: { userId: true, date: true, count: true, note: true, updatedBy: true },
  });
  // Columns: the active video editors, plus anyone (since left or moved) who has a count this month.
  const withEntry = [...new Set(entries.map((e) => e.userId))];
  const people = await prisma.user.findMany({
    where: seeAll ? { OR: [{ role: ROLE, active: true }, { id: { in: withEntry } }] } : { id: viewer.id },
    select: { id: true, name: true, teamLead: true, shootTeam: true, role: true, active: true },
  });
  const editors = people
    .map((p) => ({ id: p.id, name: p.name, lead: p.role === ROLE && p.teamLead, shoots: p.role === "EDITOR" && p.shootTeam, active: p.active && p.role === ROLE }))
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
    return { ...ed, total, entries: mine.length, worked, best: mine.reduce((mx, e) => Math.max(mx, e.count), 0), avg: worked ? Math.round((total / worked) * 10) / 10 : 0, today: cells[`${ed.id}|${today}`]?.count ?? null };
  });
  const grand = perEditor.reduce((s, e) => s + e.total, 0);
  // the month before, for the same people — to compare against
  const prev = await prisma.editCount.aggregate({ _sum: { count: true }, where: { date: { startsWith: shiftMonth(month, -1) }, ...scope(seeAll) } });

  // Month by month (the last 6 months that have counts) for the same people.
  const histFrom = shiftMonth(today.slice(0, 7), -5);
  const hist = await prisma.editCount.findMany({
    where: { date: { gte: `${histFrom}-01` }, ...scope(seeAll) },
    select: { userId: true, date: true, count: true },
  });
  const byMonth = new Map<string, { total: number; byUser: Record<string, number>; dates: Set<string> }>();
  for (const h of hist) {
    const k = h.date.slice(0, 7);
    const b = byMonth.get(k) ?? { total: 0, byUser: {}, dates: new Set<string>() };
    b.total += h.count; b.byUser[h.userId] = (b.byUser[h.userId] ?? 0) + h.count;
    if (h.count > 0) b.dates.add(h.date);
    byMonth.set(k, b);
  }
  const history = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, b]) => ({
    month: k, total: b.total, byUser: b.byUser, workingDays: b.dates.size,
    label: new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }),
  }));

  // The team's video work (lead / admin only): everything still open, and what was finished lately.
  const tasks = seeAll
    ? (await prisma.creativeTask.findMany({
        where: { kind, OR: [{ status: { not: "COMPLETED" } }, { updatedAt: { gte: new Date(Date.now() - 14 * 86400000) } }] },
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
    prevTotal: prev._sum.count ?? 0,
    prevLabel: new Date(`${shiftMonth(month, -1)}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", timeZone: "UTC" }),
    isCurrentMonth: month === today.slice(0, 7),
    nextMonth: shiftMonth(month, 1) <= today.slice(0, 7) ? shiftMonth(month, 1) : "",
    seeAll, editors, days, cells, perEditor, grand, history,
    todayTotal: perEditor.reduce((s, e) => s + (e.today ?? 0), 0),
    tasks,
  };
}

export type EditCountBoardData = Awaited<ReturnType<typeof getEditCountBoard>>;
