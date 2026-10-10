"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIST } from "@/lib/india-date";
import { planVideoJobs } from "@/lib/video-import-core";
import { canOpenVideoJobs, canManageVideoJobs, canSeeAllVideoJobs, parseIds } from "@/lib/video-job-queries";

// Video team "Client Videos" tracker — add / update a client shoot, update the editing
// progress, delete, and load the old Google Sheet. Kept in its own file so nothing else in
// the CRM is touched.

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string) => { const n = Math.round(Number(str(fd, k))); return Number.isFinite(n) && n > 0 ? Math.min(n, 9999) : 0; };
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime());
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "NO_EDIT"];

// "edited 3 of 5" → in progress; all edited → completed. "No edit needed" is never changed.
function settle(status: string, edited: number, shot: number, complete: boolean) {
  if (complete) return "COMPLETED";
  if (status === "NO_EDIT") return status;
  if (shot > 0 && edited >= shot) return "COMPLETED";
  if (status === "PENDING" && edited > 0) return "IN_PROGRESS";
  return status;
}

async function findClientId(name: string) {
  const n = norm(name);
  if (!n) return null;
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  const exact = clients.filter((c) => norm(c.name) === n);
  return exact.length === 1 ? exact[0].id : null;
}

export async function saveVideoJob(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !canOpenVideoJobs(me)) redirect("/");
  const id = str(fd, "id");
  const ret = str(fd, "return");
  const existing = id ? await prisma.videoJob.findUnique({ where: { id } }) : null;
  const back: (flag: string) => never = (flag) => {
    const month = (existing?.date ?? (validDate(str(fd, "date")) ? str(fd, "date") : todayIST())).slice(0, 7);
    redirect(ret.startsWith("/") && !ret.startsWith("//") ? ret : `/client-videos?month=${month}&saved=${flag}`);
  };
  if (id && !existing) back("gone");
  const manage = canManageVideoJobs(me);
  const complete = str(fd, "complete") === "1";

  // An editor on the job updates the progress only.
  if (!manage) {
    if (!existing || !parseIds(existing.editorIds).includes(me.id)) back("denied");
    const job = existing!;
    const edited = complete ? Math.max(int(fd, "edited"), job.videosShot, job.edited) : int(fd, "edited");
    const wanted = STATUSES.includes(str(fd, "editStatus")) ? str(fd, "editStatus") : job.editStatus;
    await prisma.videoJob.update({
      where: { id: job.id },
      data: {
        edited, editStatus: settle(wanted, edited, job.videosShot, complete),
        ...(fd.has("informedAM_set") ? { informedAM: str(fd, "informedAM") === "on" } : {}),
        ...(fd.has("posting") ? { posting: ["PENDING", "POSTED"].includes(str(fd, "posting")) ? str(fd, "posting") : "" } : {}),
        ...(fd.has("note") ? { note: str(fd, "note").slice(0, 500) } : {}),
        updatedBy: me.name,
      },
    });
    revalidatePath("/client-videos"); revalidatePath("/");
    back("1");
  }

  // Quick progress update (dashboard / row buttons) by someone who manages: only the progress fields are sent.
  if (existing && !fd.has("clientName")) {
    const edited = complete ? Math.max(int(fd, "edited"), existing.videosShot, existing.edited) : int(fd, "edited");
    const wanted = STATUSES.includes(str(fd, "editStatus")) ? str(fd, "editStatus") : existing.editStatus;
    await prisma.videoJob.update({ where: { id: existing.id }, data: { edited, editStatus: settle(wanted, edited, existing.videosShot, complete), updatedBy: me.name } });
    revalidatePath("/client-videos"); revalidatePath("/");
    back("1");
  }

  const date = str(fd, "date");
  const clientName = str(fd, "clientName").replace(/\s+/g, " ").slice(0, 160);
  if (!validDate(date) || !clientName) back("bad");
  const editors = await prisma.user.findMany({ where: { role: "EDITOR" }, select: { id: true } });
  const allowed = new Set(editors.map((e) => e.id));
  const editorIds = [...new Set(fd.getAll("editorIds").map(String).filter((x) => allowed.has(x)))];
  const shotBy = [...fd.getAll("shotBy").map(String), ...str(fd, "shotByOther").split(",")].map((x) => x.trim()).filter(Boolean).join(", ").slice(0, 200);
  const videosShot = int(fd, "videosShot");
  const edited = complete ? Math.max(int(fd, "edited"), videosShot) : int(fd, "edited");
  const wanted = STATUSES.includes(str(fd, "editStatus")) ? str(fd, "editStatus") : "PENDING";
  const data = {
    date, clientName, clientId: await findClientId(clientName), shotBy, videosShot, edited,
    editStatus: settle(wanted, edited, videosShot, complete),
    editorIds: JSON.stringify(editorIds), editorNames: str(fd, "editorNames").slice(0, 200),
    informedAM: str(fd, "informedAM") === "on",
    posting: ["PENDING", "POSTED"].includes(str(fd, "posting")) ? str(fd, "posting") : "",
    verifiedBy: str(fd, "verifiedBy").slice(0, 80), storage: str(fd, "storage").slice(0, 40), note: str(fd, "note").slice(0, 500),
    updatedBy: me.name,
  };
  if (existing) await prisma.videoJob.update({ where: { id: existing.id }, data });
  else await prisma.videoJob.create({ data });

  // tell the editors who were just put on it
  const before = new Set(existing ? parseIds(existing.editorIds) : []);
  const fresh = editorIds.filter((x) => !before.has(x) && x !== me.id);
  if (fresh.length && data.editStatus !== "COMPLETED" && data.editStatus !== "NO_EDIT") {
    try {
      await prisma.notification.createMany({ data: fresh.map((userId) => ({
        userId, title: `Client videos to edit: ${clientName}`,
        body: `${videosShot ? `${videosShot} video${videosShot === 1 ? "" : "s"} shot` : "Videos shot"}${shotBy ? ` by ${shotBy}` : ""} · assigned by ${me.name}`,
        link: "/client-videos", tone: "violet",
      })) });
    } catch { /* notifications are best-effort */ }
  }
  revalidatePath("/client-videos"); revalidatePath("/");
  back("1");
}

// "Assign" on the team lead's dashboard: choose the editors for a client shoot.
export async function assignVideoJobEditors(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !canManageVideoJobs(me)) redirect("/");
  const ret = str(fd, "return");
  const job = await prisma.videoJob.findUnique({ where: { id: str(fd, "id") } });
  if (job) {
    const editors = await prisma.user.findMany({ where: { role: "EDITOR" }, select: { id: true } });
    const allowed = new Set(editors.map((e) => e.id));
    const editorIds = [...new Set(fd.getAll("editorIds").map(String).filter((x) => allowed.has(x)))];
    if (editorIds.length) {
      await prisma.videoJob.update({ where: { id: job.id }, data: { editorIds: JSON.stringify(editorIds), updatedBy: me.name } });
      const before = new Set(parseIds(job.editorIds));
      const fresh = editorIds.filter((x) => !before.has(x) && x !== me.id);
      if (fresh.length) {
        try {
          await prisma.notification.createMany({ data: fresh.map((userId) => ({
            userId, title: `Client videos to edit: ${job.clientName}`,
            body: `${job.videosShot ? `${job.videosShot} video${job.videosShot === 1 ? "" : "s"} shot` : "Videos shot"}${job.shotBy ? ` by ${job.shotBy}` : ""} · assigned by ${me.name}`,
            link: "/client-videos", tone: "violet",
          })) });
        } catch { /* notifications are best-effort */ }
      }
    }
  }
  revalidatePath("/client-videos"); revalidatePath("/");
  redirect(ret.startsWith("/") && !ret.startsWith("//") ? ret : "/client-videos");
}

export async function deleteVideoJob(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !canSeeAllVideoJobs(me)) redirect("/");
  const id = str(fd, "id");
  const job = id ? await prisma.videoJob.findUnique({ where: { id }, select: { date: true } }) : null;
  if (job) await prisma.videoJob.delete({ where: { id } });
  revalidatePath("/client-videos"); revalidatePath("/");
  redirect(`/client-videos?month=${(job?.date ?? todayIST()).slice(0, 7)}&saved=deleted`);
}

// ---- load the old sheet (CSV of the "Video Shoots Status" tabs) ----

export type VideoJobImportResult = { ok: boolean; message: string; details?: string[] } | null;

export async function importVideoJobs(_prev: VideoJobImportResult, fd: FormData): Promise<VideoJobImportResult> {
  const me = await getCurrentUser();
  if (!me || !canSeeAllVideoJobs(me)) return { ok: false, message: "Only the video team lead or an admin can import the sheet." };
  const file = fd.get("file");
  if (!file || typeof file === "string" || !(file as File).size) return { ok: false, message: "Choose the client videos CSV file first." };
  const [editors, clients, existing] = await Promise.all([
    prisma.user.findMany({ where: { role: "EDITOR" }, select: { id: true, name: true } }),
    prisma.client.findMany({ select: { id: true, name: true } }),
    prisma.videoJob.findMany({ select: { id: true, date: true, clientName: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const plan = planVideoJobs(await (file as File).text(), editors, clients, existing, todayIST());
  if ("error" in plan) return { ok: false, message: plan.error ?? "That file could not be read." };
  const by = `${me.name} (sheet import)`;
  await prisma.$transaction(plan.ops.map((o) => (o.id
    ? prisma.videoJob.update({ where: { id: o.id }, data: { ...o.data, updatedBy: by } })
    : prisma.videoJob.create({ data: { ...o.data, updatedBy: by } }))));
  revalidatePath("/client-videos"); revalidatePath("/");

  const details = [`${plan.linked} of ${plan.ops.length} rows matched a client in the CRM by name (the rest keep the name from the sheet).`];
  if (plan.noLogin.length) details.push(`Editors without a Video Editor login (kept as a name only): ${plan.noLogin.join(", ")}. Add them in Team and import the same file again to link them.`);
  if (plan.badDates.length) details.push(`Rows skipped, date not understood: ${plan.badDates.slice(0, 5).join("; ")}${plan.badDates.length > 5 ? "…" : ""}`);
  return { ok: true, message: `Imported ${plan.ops.length} client shoots (${plan.added} new, ${plan.replaced} replaced).`, details };
}
