import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";

// Video team "Client Videos" tracker: one row per client shoot — videos shot, who edits them,
// how many are edited, whether the account manager was told and whether they are posted.
// (This replaced the "Video Shoots Status" tabs of the team's Google Sheet.)

export type VideoJobViewer = { id: string; role: string; teamLead?: boolean | null; shootTeam?: boolean | null };

const isAdmin = (u: VideoJobViewer) => u.role === "SUPER_ADMIN" || u.role === "SUB_ADMIN";
export const canOpenVideoJobs = (u: VideoJobViewer) => isAdmin(u) || u.role === "EDITOR";
// sees every client and can delete / import: admins and the video team lead
export const canSeeAllVideoJobs = (u: VideoJobViewer) => isAdmin(u) || (u.role === "EDITOR" && !!u.teamLead);
// can add a client shoot and change every field: the above + the editors who go on shoots
export const canManageVideoJobs = (u: VideoJobViewer) => canSeeAllVideoJobs(u) || (u.role === "EDITOR" && !!u.shootTeam);

export const OPEN_STATUSES = ["PENDING", "IN_PROGRESS"];
export const parseIds = (json: string): string[] => { try { const a = JSON.parse(json || "[]"); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };

const pad = (n: number) => String(n).padStart(2, "0");
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

export async function getVideoJobBoard(viewer: VideoJobViewer, monthParam?: string) {
  const today = todayIST();
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const seeAll = canSeeAllVideoJobs(viewer) || canManageVideoJobs(viewer);
  const mine = { editorIds: { contains: `"${viewer.id}"` } };

  // the month on screen + anything from earlier months that is still not edited
  const jobs = await prisma.videoJob.findMany({
    where: {
      AND: [
        seeAll ? {} : mine,
        { OR: [{ date: { startsWith: month } }, { date: { lt: `${month}-01` }, editStatus: { in: OPEN_STATUSES } }] },
      ],
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const [people, clients] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["EDITOR", "VIDEOGRAPHER"] } }, select: { id: true, name: true, role: true, active: true, shootTeam: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { status: { not: "UPCOMING" } }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  const rows = jobs.map((j) => {
    const ids = parseIds(j.editorIds);
    const extra = j.editorNames.split(",").map((x) => x.trim()).filter(Boolean);
    return {
      id: j.id, date: j.date, clientName: j.clientName, linked: !!j.clientId, shotBy: j.shotBy,
      videosShot: j.videosShot, edited: j.edited, editStatus: j.editStatus,
      editorIds: ids, editors: [...ids.map((id) => nameOf.get(id) ?? "").filter(Boolean), ...extra], editorNames: j.editorNames,
      informedAM: j.informedAM, posting: j.posting, verifiedBy: j.verifiedBy, storage: j.storage, note: j.note, updatedBy: j.updatedBy,
      carried: !j.date.startsWith(month), // from an earlier month, still open
      mine: ids.includes(viewer.id),
    };
  });

  const inMonth = rows.filter((r) => !r.carried);
  const kpis = {
    jobs: inMonth.length,
    clients: new Set(inMonth.map((r) => r.clientName.trim().toLowerCase())).size,
    shot: inMonth.reduce((s, r) => s + r.videosShot, 0),
    edited: inMonth.reduce((s, r) => s + r.edited, 0),
    open: rows.filter((r) => OPEN_STATUSES.includes(r.editStatus)).length,
    notInformed: inMonth.filter((r) => r.editStatus === "COMPLETED" && !r.informedAM).length,
    notPosted: inMonth.filter((r) => r.editStatus === "COMPLETED" && r.posting !== "POSTED").length,
  };

  return {
    month, today,
    monthLabel: new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }),
    prevMonth: shiftMonth(month, -1),
    nextMonth: shiftMonth(month, 1) <= today.slice(0, 7) ? shiftMonth(month, 1) : "",
    seeAll, canManage: canManageVideoJobs(viewer), canDelete: canSeeAllVideoJobs(viewer),
    rows, kpis,
    editors: people.filter((p) => p.role === "EDITOR" && p.active).map((p) => ({ id: p.id, name: p.name })),
    shooters: people.filter((p) => p.active && (p.role === "VIDEOGRAPHER" || p.shootTeam)).map((p) => p.name),
    clientNames: clients.map((c) => c.name),
  };
}
export type VideoJobBoardData = Awaited<ReturnType<typeof getVideoJobBoard>>;
export type VideoJobRow = VideoJobBoardData["rows"][number];

// For the editor's dashboard: my client videos that still have to be edited (oldest first).
export async function getMyOpenVideoJobs(userId: string) {
  const jobs = await prisma.videoJob.findMany({
    where: { editorIds: { contains: `"${userId}"` }, editStatus: { in: OPEN_STATUSES } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  const ids = [...new Set(jobs.flatMap((j) => parseIds(j.editorIds)))];
  const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  return jobs.map((j) => ({
    id: j.id, date: j.date, clientName: j.clientName, shotBy: j.shotBy, videosShot: j.videosShot, edited: j.edited, editStatus: j.editStatus, note: j.note,
    with: parseIds(j.editorIds).filter((id) => id !== userId).map((id) => nameOf.get(id) ?? "").filter(Boolean),
  }));
}
