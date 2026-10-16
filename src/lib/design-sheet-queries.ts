import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";
import { parseDesignItems } from "./design-work";

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
const STATUS: Record<string, string> = { PENDING: "Pending", IN_PROGRESS: "In progress", REVIEW: "In review", COMPLETED: "Done" };

export type SheetRow = { key: string; date: string; designerId: string; designer: string; client: string; work: string; count: number | null; by: string; status: string };

export async function getDesignSheet(f: { period?: string; client?: string; designer?: string }) {
  const today = todayIST();
  const period = SHEET_PERIODS.some((p) => p.key === f.period) ? f.period! : "today";
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const range = period === "yesterday" ? { from: shift(today, -1), to: shift(today, -1) }
    : period === "week" ? { from: shift(today, -dow), to: today }
    : period === "month" ? { from: `${today.slice(0, 7)}-01`, to: today }
    : { from: today, to: today };

  const designers = await prisma.user.findMany({ where: { role: "DESIGNER", active: true }, select: { id: true, name: true, teamLead: true }, orderBy: { name: "asc" } });
  const ids = designers.map((d) => d.id);
  const nameOf = new Map(designers.map((d) => [d.id, d.name]));

  const [counts, tasks, postings] = await Promise.all([
    prisma.editCount.findMany({ where: { userId: { in: ids }, date: { gte: range.from, lte: range.to } }, select: { userId: true, date: true, count: true, items: true, note: true } }),
    prisma.creativeTask.findMany({
      where: { kind: "DESIGN", assignedToId: { in: ids }, assignedDate: { lte: range.to }, OR: [{ status: { not: "COMPLETED" } }, { updatedAt: { gte: new Date(`${shift(range.from, -45)}T00:00:00Z`) } }] },
      include: { client: { select: { name: true } }, assignedByUser: { select: { name: true } } },
      orderBy: { assignedDate: "desc" },
    }),
    prisma.designPosting.findMany({ where: { userId: { in: ids }, weekStart: { gte: shift(range.from, -6), lte: range.to } }, select: { userId: true, clientName: true, updatedBy: true } }),
  ]);

  // who gave this designer work for this client: the design task, else the weekly postings
  const taskFor = (uid: string, client: string) => tasks.find((t) => t.assignedToId === uid && norm(t.client?.name ?? t.clientLabel) === norm(client));
  const postingFor = (uid: string, client: string) => postings.find((p) => p.userId === uid && norm(p.clientName) === norm(client));

  const rows: SheetRow[] = [];
  const usedTasks = new Set<string>();
  for (const c of counts) {
    const items = parseDesignItems(c.items);
    if (!items.length) {
      if (c.count > 0) rows.push({ key: `${c.userId}|${c.date}|n`, date: c.date, designerId: c.userId, designer: nameOf.get(c.userId) ?? "", client: "", work: c.note ? `Not given (${c.note})` : "Not given", count: c.count, by: "", status: "Done" });
      continue;
    }
    items.forEach((it, i) => {
      const t = taskFor(c.userId, it.client);
      if (t) usedTasks.add(t.id);
      const p = t ? null : postingFor(c.userId, it.client);
      rows.push({
        key: `${c.userId}|${c.date}|${i}`, date: c.date, designerId: c.userId, designer: nameOf.get(c.userId) ?? "",
        client: it.client, work: it.type || "Design", count: it.count,
        by: t ? (t.assignedByUser?.name ?? "") : p ? (p.updatedBy ? `${p.updatedBy} (weekly posts)` : "Weekly posts") : "Own work",
        status: "Done",
      });
    });
  }
  // work given in this period that has no line yet — with its status
  for (const t of tasks) {
    if (usedTasks.has(t.id) || !t.assignedDate || t.assignedDate < range.from) continue;
    rows.push({ key: `task|${t.id}`, date: t.assignedDate, designerId: t.assignedToId, designer: nameOf.get(t.assignedToId) ?? "", client: t.client?.name ?? t.clientLabel, work: `${t.type}: ${t.title}`, count: null, by: t.assignedByUser?.name ?? "", status: STATUS[t.status] ?? t.status });
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
