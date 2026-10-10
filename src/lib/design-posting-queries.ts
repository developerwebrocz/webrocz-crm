import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";

// Design team "Assigned Postings": for each week, which designer does which client's posts —
// planned for the week, done, pending. A designer sees and updates their own clients; the
// design team lead and the admins see every designer and assign clients.

export type DesignViewer = { id: string; role: string; teamLead?: boolean | null };
const isAdmin = (u: DesignViewer) => u.role === "SUPER_ADMIN" || u.role === "SUB_ADMIN";
export const canOpenDesignPostings = (u: DesignViewer) => isAdmin(u) || u.role === "DESIGNER";
export const isDesignLead = (u: DesignViewer) => isAdmin(u) || (u.role === "DESIGNER" && !!u.teamLead);

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
// Monday of the week a date falls in
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  return iso(new Date(d.getTime() - dow * DAY));
}
const shiftWeek = (week: string, by: number) => iso(new Date(new Date(`${week}T00:00:00Z`).getTime() + by * 7 * DAY));
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
export const weekLabel = (week: string) => `${fmt(week)} – ${fmt(iso(new Date(new Date(`${week}T00:00:00Z`).getTime() + 5 * DAY)))}`; // Mon – Sat

export async function getDesignPostingBoard(viewer: DesignViewer, weekParam?: string) {
  const today = todayIST();
  const thisWeek = weekStartOf(today);
  const week = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekStartOf(weekParam) : thisWeek;
  const lead = isDesignLead(viewer);
  const [rows, designers, clients, prevCount] = await Promise.all([
    prisma.designPosting.findMany({ where: { weekStart: week, ...(lead ? {} : { userId: viewer.id }) }, orderBy: [{ createdAt: "asc" }] }),
    prisma.user.findMany({ where: { role: "DESIGNER" }, select: { id: true, name: true, active: true, teamLead: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { status: { not: "UPCOMING" } }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.designPosting.count({ where: { weekStart: shiftWeek(week, -1) } }),
  ]);
  const list = rows.map((r) => ({
    id: r.id, userId: r.userId, clientName: r.clientName, linked: !!r.clientId, monthlyPosts: r.monthlyPosts,
    target: r.target, done: r.done, pending: Math.max(0, r.target - r.done), note: r.note, updatedBy: r.updatedBy,
  }));
  const shown = lead ? designers.filter((d) => d.active || list.some((r) => r.userId === d.id)) : designers.filter((d) => d.id === viewer.id);
  const groups = shown
    .map((d) => {
      const mine = list.filter((r) => r.userId === d.id);
      return { id: d.id, name: d.name, lead: d.teamLead, active: d.active, rows: mine, target: mine.reduce((s, r) => s + r.target, 0), done: mine.reduce((s, r) => s + r.done, 0) };
    })
    .sort((a, b) => Number(b.lead) - Number(a.lead) || a.name.localeCompare(b.name));
  const target = list.reduce((s, r) => s + r.target, 0);
  const done = list.reduce((s, r) => s + r.done, 0);
  return {
    week, weekLabel: weekLabel(week), isThisWeek: week === thisWeek, today,
    prevWeek: shiftWeek(week, -1), nextWeek: week <= thisWeek ? shiftWeek(week, 1) : "", // planning one week ahead is allowed
    lead, groups, kpis: { clients: list.length, target, done, pending: list.reduce((s, r) => s + r.pending, 0), allDone: list.filter((r) => r.target > 0 && r.done >= r.target).length },
    designers: designers.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name })),
    clientNames: clients.map((c) => c.name),
    canCopy: lead && list.length === 0 && prevCount > 0, prevLabel: weekLabel(shiftWeek(week, -1)),
  };
}
export type DesignPostingBoardData = Awaited<ReturnType<typeof getDesignPostingBoard>>;
export type DesignPostingRow = DesignPostingBoardData["groups"][number]["rows"][number];

// A designer's own week, for the card on their dashboard.
export async function getMyDesignWeek(userId: string) {
  const week = weekStartOf(todayIST());
  const rows = await prisma.designPosting.findMany({ where: { weekStart: week, userId }, select: { target: true, done: true } });
  return { week, label: weekLabel(week), clients: rows.length, target: rows.reduce((s, r) => s + r.target, 0), done: rows.reduce((s, r) => s + r.done, 0), pendingClients: rows.filter((r) => r.done < r.target).length };
}
