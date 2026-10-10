"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIST } from "@/lib/india-date";
import { canOpenEditCount, isVideoAdmin, isVideoLead } from "@/lib/edit-count-queries";

// Video team "Editing Count" — saving a day's count, loading the old Google Sheet, and
// choosing the team lead. Kept in its own file so nothing else in the CRM is touched.

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime());

// An editor saves their own count for a day; the team lead / an admin can save anyone's.
// An empty count removes that day's entry (it was entered by mistake).
export async function saveEditCount(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !canOpenEditCount(me)) redirect("/");
  const date = str(fd, "date");
  const today = todayIST();
  const back: (flag: string) => never = (flag) => redirect(`/video-team?month=${(validDate(date) ? date : today).slice(0, 7)}&saved=${flag}`);
  if (!validDate(date) || date > today) back("baddate");

  const userId = isVideoLead(me) ? str(fd, "userId") || me.id : me.id;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target || target.role !== "EDITOR") back("noeditor");

  const raw = str(fd, "count");
  if (raw === "") {
    await prisma.editCount.deleteMany({ where: { userId, date } });
  } else {
    const count = Math.round(Number(raw));
    if (!Number.isFinite(count) || count < 0 || count > 500) back("badcount");
    const note = str(fd, "note").slice(0, 300);
    await prisma.editCount.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, count, note, updatedBy: me.name },
      update: { count, note, updatedBy: me.name },
    });
  }
  revalidatePath("/video-team");
  back("1");
}

// Super Admin / Sub Admin: who leads the video team (one editor, or nobody) and which editors
// also go on shoots (only they can be picked as the shooter and get "My Shoots").
export async function saveVideoTeamSettings(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !isVideoAdmin(me)) redirect("/");
  const editors = await prisma.user.findMany({ where: { role: "EDITOR" }, select: { id: true } });
  const ids = new Set(editors.map((e) => e.id));
  const leadId = ids.has(str(fd, "leadId")) ? str(fd, "leadId") : "";
  const shoot = new Set(fd.getAll("shootTeam").map(String).filter((id) => ids.has(id)));
  await prisma.$transaction(editors.map((e) => prisma.user.update({ where: { id: e.id }, data: { teamLead: e.id === leadId, shootTeam: shoot.has(e.id) } })));
  revalidatePath("/video-team");
  revalidatePath("/", "layout");
  redirect(`/video-team?${str(fd, "month") ? `month=${str(fd, "month")}&` : ""}saved=team`);
}

// ---- load the old sheet (CSV): first column the date, then one column per editor ----

export type EditCountImportResult = { ok: boolean; message: string; details?: string[] } | null;

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
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

// 01-08-2026 · 01/08/2026 · 1.8.2026 (day first, as in India) or 2026-08-01 → "2026-08-01"
function sheetDate(v: string): string {
  const p = v.trim().split(/[-/.]/).map((x) => x.trim());
  if (p.length !== 3 || p.some((x) => !/^\d+$/.test(x))) return "";
  const [a, b, c] = p.map(Number);
  const [y, m, d] = p[0].length === 4 ? [a, b, c] : [c < 100 ? 2000 + c : c, b, a];
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return new Date(`${iso}T00:00:00Z`).getUTCDate() === d ? iso : "";
}

export async function importEditCounts(_prev: EditCountImportResult, fd: FormData): Promise<EditCountImportResult> {
  const me = await getCurrentUser();
  if (!me || !isVideoLead(me)) return { ok: false, message: "Only the video team lead or an admin can import the sheet." };
  const file = fd.get("file");
  if (!file || typeof file === "string" || !(file as File).size) return { ok: false, message: "Choose the editing count CSV file first." };
  const rows = parseCsv(await (file as File).text());
  if (rows.length < 2) return { ok: false, message: "That file has no rows." };

  const head = rows[0];
  if (!/date/i.test(head[0] ?? "")) return { ok: false, message: "The first column must be \"Date\", followed by one column per editor." };

  // Each editor column is matched to a Video Editor login by name: the same name, or the one
  // editor whose first name is the sheet's name. No guessing when it is unclear.
  const editors = await prisma.user.findMany({ where: { role: "EDITOR" }, select: { id: true, name: true, active: true } });
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();
  const find = (name: string) => {
    const n = norm(name);
    const exact = editors.filter((e) => norm(e.name) === n);
    if (exact.length === 1) return exact[0];
    const first = editors.filter((e) => norm(e.name).split(" ")[0] === n || n.split(" ")[0] === norm(e.name));
    if (first.length === 1) return first[0];
    const live = (exact.length ? exact : first).filter((e) => e.active);
    return live.length === 1 ? live[0] : null;
  };
  const cols: { i: number; name: string; user: { id: string; name: string } | null }[] = [];
  head.forEach((h, i) => { if (i > 0 && h && !/^total$/i.test(h)) cols.push({ i, name: h, user: find(h) }); });
  const matched = cols.filter((c) => c.user);
  const missing = cols.filter((c) => !c.user).map((c) => c.name);
  if (!matched.length) return { ok: false, message: `No column matches a Video Editor in Team. Columns found: ${cols.map((c) => c.name).join(", ") || "none"}.` };

  const today = todayIST();
  const data: { userId: string; date: string; count: number }[] = [];
  const badDates: string[] = [];
  let future = 0, badCells = 0;
  for (const r of rows.slice(1)) {
    if (/^total/i.test(r[0] ?? "")) continue;
    const date = sheetDate(r[0] ?? "");
    if (!date) { if (r[0]) badDates.push(r[0]); continue; }
    if (date > today) { future++; continue; }
    for (const c of matched) {
      const v = r[c.i] ?? "";
      if (v === "") continue; // blank = no entry that day (leave / holiday)
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 500) { badCells++; continue; }
      data.push({ userId: c.user!.id, date, count: Math.round(n) });
    }
  }
  if (!data.length) return { ok: false, message: "No counts found in that file." };

  // A day that is already in the CRM is replaced with the sheet's number, so importing the
  // same file twice never doubles anything.
  const existing = await prisma.editCount.findMany({ where: { userId: { in: matched.map((c) => c.user!.id) } }, select: { userId: true, date: true } });
  const have = new Set(existing.map((e) => `${e.userId}|${e.date}`));
  let added = 0, replaced = 0;
  await prisma.$transaction(data.map((d) => {
    if (have.has(`${d.userId}|${d.date}`)) replaced++; else added++;
    return prisma.editCount.upsert({
      where: { userId_date: { userId: d.userId, date: d.date } },
      create: { ...d, updatedBy: `${me.name} (sheet import)` },
      update: { count: d.count, updatedBy: `${me.name} (sheet import)` },
    });
  }));
  revalidatePath("/video-team");

  const details = matched.map((c) => {
    const mine = data.filter((d) => d.userId === c.user!.id);
    return `${c.user!.name}: ${mine.length} days · ${mine.reduce((s, d) => s + d.count, 0)} videos`;
  });
  if (missing.length) details.push(`NOT imported — no Video Editor with this name in Team: ${missing.join(", ")}. Add them in Team (role Video Editor) and import the same file again.`);
  if (badDates.length) details.push(`Rows skipped, date not understood: ${badDates.slice(0, 5).join(", ")}${badDates.length > 5 ? "…" : ""}`);
  if (badCells) details.push(`${badCells} cell(s) skipped — not a number.`);
  if (future) details.push(`${future} row(s) skipped — date is in the future.`);
  const dates = data.map((d) => d.date).sort();
  return { ok: true, message: `Imported ${added + replaced} day counts (${added} new, ${replaced} replaced) · ${dates[0]} to ${dates[dates.length - 1]}.`, details };
}
