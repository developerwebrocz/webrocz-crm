"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIST } from "@/lib/india-date";
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

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  const src = text.replace(/^﻿/, "").replace(/\r/g, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.map((r) => r.map((c) => c.replace(/\s+/g, " ").trim()));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// "01 / Aug / 26" · 01-08-2026 · 01/08/26 · 2026-08-01 → "2026-08-01"
function sheetDate(v: string): string {
  const p = v.replace(/\s+/g, "").split(/[-/.]/);
  if (p.length !== 3) return "";
  let y: number, m: number, d: number;
  if (/^\d{4}$/.test(p[0])) { y = +p[0]; m = +p[1]; d = +p[2]; }
  else { d = +p[0]; m = /^\d+$/.test(p[1]) ? +p[1] : MONTHS.indexOf(p[1].slice(0, 3).toLowerCase()) + 1; y = +p[2]; if (y < 100) y += 2000; }
  if (!y || !m || !d || m > 12 || d > 31) return "";
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return new Date(`${iso}T00:00:00Z`).getUTCDate() === d ? iso : "";
}

export async function importVideoJobs(_prev: VideoJobImportResult, fd: FormData): Promise<VideoJobImportResult> {
  const me = await getCurrentUser();
  if (!me || !canSeeAllVideoJobs(me)) return { ok: false, message: "Only the video team lead or an admin can import the sheet." };
  const file = fd.get("file");
  if (!file || typeof file === "string" || !(file as File).size) return { ok: false, message: "Choose the client videos CSV file first." };
  const rows = parseCsv(await (file as File).text()).filter((r) => r.some((c) => c));
  if (rows.length < 2) return { ok: false, message: "That file has no rows." };

  const head = rows[0].map((h) => h.toLowerCase());
  const col = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(k)));
  const C = {
    date: head.findIndex((h, i) => h.includes("date") || (i === 0 && h === "")),
    shotBy: col("employee", "shot by", "shooter"), client: col("client"), shot: col("shoot", "shot"),
    status: col("editing status", "edit status", "status"), editors: col("editor"), informed: col("informed"),
    posting: col("posting"), verified: col("verified"), storage: col("storage"),
  };
  if (C.client < 0 || C.date < 0) return { ok: false, message: "The file needs a Date column and a Client column." };

  const [editors, clients, existing] = await Promise.all([
    prisma.user.findMany({ where: { role: "EDITOR" }, select: { id: true, name: true } }),
    prisma.client.findMany({ select: { id: true, name: true } }),
    prisma.videoJob.findMany({ select: { id: true, date: true, clientName: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const editorByFirst = (name: string) => { const n = norm(name); const hit = editors.filter((e) => norm(e.name) === n || norm(e.name).split(" ")[0] === n); return hit.length === 1 ? hit[0] : null; };
  const clientByName = (name: string) => { const hit = clients.filter((c) => norm(c.name) === norm(name)); return hit.length === 1 ? hit[0].id : null; };
  // The same client can have two shoots on one day: the 1st row in the file replaces the 1st
  // saved one, the 2nd the 2nd … so importing the same file again never doubles anything.
  const have = new Map<string, string>(); const seenSaved = new Map<string, number>();
  for (const j of existing) { const k = `${j.date}|${norm(j.clientName)}`; const n = (seenSaved.get(k) ?? 0) + 1; seenSaved.set(k, n); have.set(`${k}#${n}`, j.id); }
  const seenFile = new Map<string, number>();
  const get = (r: string[], i: number) => (i >= 0 ? r[i] ?? "" : "");

  const today = todayIST();
  let added = 0, replaced = 0, linked = 0;
  const badDates: string[] = []; const noLogin = new Map<string, number>();
  const ops = [];
  for (const r of rows.slice(1)) {
    const clientName = get(r, C.client);
    if (!clientName || /^x+$/i.test(clientName)) continue; // the sheet's sample row
    const date = sheetDate(get(r, C.date));
    if (!date || date > today) { badDates.push(`${get(r, C.date) || "(no date)"} · ${clientName}`); continue; }
    const st = get(r, C.status);
    const noEdit = /no\s*need/i.test(st);
    const num = (st.match(/\d+/) || [])[0];
    const edited = noEdit ? 0 : num ? Number(num) : 0;
    const videosShot = Number((get(r, C.shot).match(/\d+/) || [])[0] ?? 0);
    const editStatus = noEdit ? "NO_EDIT" : /complet|done/i.test(st) ? "COMPLETED" : edited > 0 ? "IN_PROGRESS" : "PENDING";
    const ids: string[] = []; const others: string[] = [];
    for (const name of get(r, C.editors).split(/[,&/]|\band\b/i).map((x) => x.trim()).filter(Boolean)) {
      const u = editorByFirst(name);
      if (u) { if (!ids.includes(u.id)) ids.push(u.id); } else { others.push(name); noLogin.set(name, (noLogin.get(name) ?? 0) + 1); }
    }
    const posting = get(r, C.posting);
    // a drive size typed in the "Verified By" column ("8TB") is the storage, not a person
    const verified = get(r, C.verified);
    const driveInVerified = /^d+s*tb$/i.test(verified);
    const clientId = clientByName(clientName);
    if (clientId) linked++;
    const data = {
      date, clientName, clientId, shotBy: get(r, C.shotBy).split(",").map((x) => x.trim()).filter(Boolean).join(", "),
      videosShot, edited, editStatus, editorIds: JSON.stringify(ids), editorNames: others.join(", "),
      informedAM: /^y/i.test(get(r, C.informed)), posting: /posted/i.test(posting) ? "POSTED" : /pending/i.test(posting) ? "PENDING" : "",
      verifiedBy: driveInVerified ? "" : verified, storage: get(r, C.storage) || (driveInVerified ? verified : ""), updatedBy: `${me.name} (sheet import)`,
    };
    const key = `${date}|${norm(clientName)}`;
    const nth = (seenFile.get(key) ?? 0) + 1; seenFile.set(key, nth);
    const id = have.get(`${key}#${nth}`);
    if (id) { replaced++; ops.push(prisma.videoJob.update({ where: { id }, data })); }
    else { added++; ops.push(prisma.videoJob.create({ data })); }
  }
  if (!ops.length) return { ok: false, message: "No client rows found in that file." };
  await prisma.$transaction(ops);
  revalidatePath("/client-videos"); revalidatePath("/");

  const details = [`${linked} of ${added + replaced} rows matched a client in the CRM by name (the rest keep the name from the sheet).`];
  if (noLogin.size) details.push(`Editors without a Video Editor login (kept as a name only): ${[...noLogin].map(([n, c]) => `${n} (${c})`).join(", ")}. Add them in Team and import the same file again to link them.`);
  if (badDates.length) details.push(`Rows skipped, date not understood: ${badDates.slice(0, 5).join("; ")}${badDates.length > 5 ? "…" : ""}`);
  return { ok: true, message: `Imported ${added + replaced} client shoots (${added} new, ${replaced} replaced).`, details };
}
