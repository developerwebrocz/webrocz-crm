import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";
import { parseDesignItems } from "./design-work";

// "Designer Work": everything a designer did and was given, in one place — the daily work they
// logged (client · design type · how many), the design tasks assigned to them (by whom, when,
// status) and their weekly postings. Filters: designer, period, client, design type.
// The Super / Sub Admin and the design team lead see every designer; a designer sees their own.

export type DesignerWorkViewer = { id: string; role: string; teamLead?: boolean | null };
export const canSeeAllDesigners = (u: DesignerWorkViewer) => u.role === "SUPER_ADMIN" || u.role === "SUB_ADMIN" || (u.role === "DESIGNER" && !!u.teamLead);
export const canOpenDesignerWork = (u: DesignerWorkViewer) => canSeeAllDesigners(u) || u.role === "DESIGNER";

export const PERIODS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "custom", label: "Pick dates" },
] as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const isDate = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function periodRange(period: string, from?: string, to?: string) {
  const today = todayIST();
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const month = today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  switch (period) {
    case "today": return { from: today, to: today };
    case "yesterday": return { from: shift(today, -1), to: shift(today, -1) };
    case "week": return { from: shift(today, -dow), to: today };
    case "lastmonth": { const s = iso(new Date(Date.UTC(y, m - 2, 1))); const e = iso(new Date(Date.UTC(y, m - 1, 0))); return { from: s, to: e }; }
    case "custom": if (isDate(from) && isDate(to) && from! <= to!) return { from: from!, to: to! }; return { from: `${month}-01`, to: today };
    default: return { from: `${month}-01`, to: today };
  }
}

type Filters = { designer?: string; period?: string; from?: string; to?: string; client?: string; type?: string };

export async function getDesignerWork(viewer: DesignerWorkViewer, f: Filters) {
  const all = canSeeAllDesigners(viewer);
  const period = PERIODS.some((p) => p.key === f.period) ? f.period! : "month";
  const range = periodRange(period, f.from, f.to);
  const clientQ = (f.client ?? "").trim().toLowerCase();
  const typeQ = (f.type ?? "").trim();

  const designers = (await prisma.user.findMany({ where: { role: "DESIGNER" }, select: { id: true, name: true, active: true, teamLead: true }, orderBy: { name: "asc" } }))
    .filter((d) => all || d.id === viewer.id);
  const designerId = all ? (designers.some((d) => d.id === f.designer) ? f.designer! : "") : viewer.id;
  const ids = designerId ? [designerId] : designers.map((d) => d.id);
  const nameOf = new Map(designers.map((d) => [d.id, d.name]));
  const matchClient = (c: string) => !clientQ || c.toLowerCase().includes(clientQ);
  const matchType = (t: string) => !typeQ || t.toLowerCase() === typeQ.toLowerCase();

  const [counts, tasks, postings] = await Promise.all([
    prisma.editCount.findMany({ where: { userId: { in: ids }, date: { gte: range.from, lte: range.to } }, select: { userId: true, date: true, count: true, note: true, items: true, updatedBy: true }, orderBy: { date: "desc" } }),
    prisma.creativeTask.findMany({
      where: { kind: "DESIGN", assignedToId: { in: ids }, OR: [{ assignedDate: { gte: range.from, lte: range.to } }, { dueDate: { gte: range.from, lte: range.to } }, { status: { not: "COMPLETED" } }] },
      include: { client: { select: { name: true } }, assignedByUser: { select: { name: true } } },
      orderBy: [{ assignedDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.designPosting.findMany({ where: { userId: { in: ids }, weekStart: { gte: shift(range.from, -6), lte: range.to } }, orderBy: [{ weekStart: "desc" }, { clientName: "asc" }] }),
  ]);

  // the daily work, line by line (a day saved before the client lines has only its number)
  type Line = { date: string; userId: string; designer: string; client: string; type: string; count: number };
  const lines: Line[] = [];
  const notes: { date: string; userId: string; note: string }[] = [];
  for (const c of counts) {
    const items = parseDesignItems(c.items);
    if (c.note) notes.push({ date: c.date, userId: c.userId, note: c.note });
    if (items.length) for (const it of items) lines.push({ date: c.date, userId: c.userId, designer: nameOf.get(c.userId) ?? "", client: it.client, type: it.type || "Design", count: it.count });
    else if (c.count > 0) lines.push({ date: c.date, userId: c.userId, designer: nameOf.get(c.userId) ?? "", client: "", type: "", count: c.count });
  }
  const shownLines = lines.filter((l) => (clientQ ? matchClient(l.client) : true) && (typeQ ? matchType(l.type) : true));

  // by day → designer → lines
  const days = [...new Set(shownLines.map((l) => l.date))].sort((a, b) => b.localeCompare(a)).map((date) => {
    const today = shownLines.filter((l) => l.date === date);
    const people = [...new Set(today.map((l) => l.userId))].map((uid) => ({
      userId: uid, designer: nameOf.get(uid) ?? "",
      total: today.filter((l) => l.userId === uid).reduce((s, l) => s + l.count, 0),
      lines: today.filter((l) => l.userId === uid),
      note: notes.find((n) => n.date === date && n.userId === uid)?.note ?? "",
    })).sort((a, b) => b.total - a.total);
    return { date, total: today.reduce((s, l) => s + l.count, 0), people };
  });

  const sumBy = (key: (l: Line) => string) => {
    const m = new Map<string, number>();
    for (const l of shownLines) { const k = key(l); if (k) m.set(k, (m.get(k) ?? 0) + l.count); }
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  };

  const taskRows = tasks.map((t) => ({
    id: t.id, code: t.code, title: t.title, designer: nameOf.get(t.assignedToId) ?? "", client: t.client?.name ?? t.clientLabel ?? "",
    type: t.type, by: t.assignedByUser?.name ?? "", assignedDate: t.assignedDate, dueDate: t.dueDate, status: t.status,
    doneOn: t.status === "COMPLETED" ? t.updatedAt.toISOString().slice(0, 10) : "", finalLink: t.finalLink,
    overdue: !!t.dueDate && t.dueDate < todayIST() && t.status !== "COMPLETED",
  })).filter((t) => matchClient(t.client) && matchType(t.type));

  const postingRows = postings.map((p) => ({
    id: p.id, weekStart: p.weekStart, designer: nameOf.get(p.userId) ?? "", client: p.clientName, target: p.target, done: p.done,
    monthlyPosts: p.monthlyPosts, by: p.updatedBy, note: p.note,
  })).filter((p) => matchClient(p.client));

  return {
    all, period, range, designerId, designers: designers.map((d) => ({ id: d.id, name: d.name, active: d.active, lead: !!d.teamLead })),
    filters: { client: f.client ?? "", type: typeQ },
    totals: {
      designs: shownLines.reduce((s, l) => s + l.count, 0),
      days: days.length,
      clients: new Set(shownLines.map((l) => l.client.toLowerCase()).filter(Boolean)).size,
      tasksOpen: taskRows.filter((t) => t.status !== "COMPLETED").length,
      tasksDone: taskRows.filter((t) => t.status === "COMPLETED").length,
      overdue: taskRows.filter((t) => t.overdue).length,
    },
    byType: sumBy((l) => l.type), byClient: sumBy((l) => l.client), byDesigner: sumBy((l) => l.designer),
    days, tasks: taskRows, postings: postingRows,
  };
}
export type DesignerWorkData = Awaited<ReturnType<typeof getDesignerWork>>;
