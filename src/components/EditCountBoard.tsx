"use client";

import { useActionState, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Upload, X, CheckCircle2, Crown, Save, Camera, TrendingUp, TrendingDown, CalendarDays, Trophy, Clock3, Film, PencilLine, Settings2, AlertTriangle, Download, BellRing, BarChart3 } from "lucide-react";
import type { EditCountBoardData } from "@/lib/edit-count-queries";
import { saveEditCount, saveVideoTeamSettings, importEditCounts, remindEditCount, type EditCountImportResult } from "@/app/edit-count-actions";
import CountStepper from "@/components/CountStepper";
import AssignCreativeForm from "@/components/AssignCreativeForm";
import { initials } from "@/lib/domain";
import { TEAMS, cap, type TeamInfo } from "@/lib/team-kinds";

// A team's daily count — video editors ("Editing Count") or designers ("Design Count"): the
// month's count-per-day for each member (the old Google
// Sheet): summary, daily chart, each editor's card, the form to update a day, the day-by-day
// table and, for the team lead / admins, the team's assigned work.

type Me = { id: string; name: string; isEditor: boolean; isAdmin: boolean };
type ClientOpt = { id: string; name: string };

const SAVED: Record<string, { text: string; ok: boolean }> = {
  "1": { text: "Saved.", ok: true },
  team: { text: "Team settings saved.", ok: true },
  reminded: { text: "Reminder sent to those who have not updated today.", ok: true },
  noremind: { text: "No reminder needed — everyone has updated, or already has an unread reminder.", ok: true },
  baddate: { text: "Not saved — choose a date that is today or earlier.", ok: false },
  badcount: { text: "Not saved — the number is not valid.", ok: false },
  noeditor: { text: "Not saved — choose a team member.", ok: false },
};
const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Pending", tone: "var(--muted)" },
  IN_PROGRESS: { label: "In progress", tone: "var(--sky)" },
  REVIEW: { label: "Review", tone: "var(--violet)" },
  COMPLETED: { label: "Completed", tone: "var(--emerald)" },
};
// one colour per editor, the same in the cards, the chart and the table
const PALETTE = ["#6d28d9", "#0284c7", "#059669", "#d97706", "#e11d48", "#0d9488", "#840a92", "#4f46e5"];
const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—");
const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, white)`;

// `team`: which team this page is for (video editors by default, or the designers).
export default function EditCountBoard({ d, me, clients, saved, team = TEAMS.VIDEO }: { d: EditCountBoardData; me: Me; clients: ClientOpt[]; saved: string; team?: TeamInfo }) {
  const tm = team;
  const first = d.editors.find((e) => e.id === me.id) ?? d.editors.find((e) => e.active) ?? d.editors[0];
  const [userId, setUserId] = useState(first?.id ?? "");
  const [date, setDate] = useState(d.isCurrentMonth ? d.today : `${d.month}-01`);
  const cell = d.cells[`${userId}|${date}`];
  const [importing, setImporting] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const flash = SAVED[saved];
  const canUpdate = d.seeAll ? d.editors.some((e) => e.active) : me.isEditor;
  const leadId = d.editors.find((e) => e.lead)?.id ?? "";
  // the form works inside the month on screen (its saved values are what is loaded here)
  const lastDay = d.days[d.days.length - 1].date;
  const maxDate = lastDay < d.today ? lastDay : d.today;
  const color = (id: string) => PALETTE[Math.max(0, d.editors.findIndex((e) => e.id === id)) % PALETTE.length];

  // figures for the summary
  const worked = d.days.filter((x) => x.total > 0);
  const avgDay = worked.length ? Math.round((d.grand / worked.length) * 10) / 10 : 0;
  const bestDay = worked.reduce<(typeof worked)[number] | null>((b, x) => (!b || x.total > b.total ? x : b), null);
  const maxDayTotal = Math.max(1, ...d.days.map((x) => x.total));
  const maxCell = Math.max(1, ...Object.values(d.cells).map((c) => c.count));
  const topTotal = Math.max(1, ...d.perEditor.map((e) => e.total));
  const ranked = [...d.perEditor].sort((a, b) => b.total - a.total);
  const activeEditors = d.perEditor.filter((e) => e.active);
  const updatedToday = activeEditors.filter((e) => e.today !== null).length;
  const change = !d.isCurrentMonth && d.prevTotal > 0 ? Math.round(((d.grand - d.prevTotal) / d.prevTotal) * 100) : null;
  const shown = d.days.filter((x) => !x.future).reverse(); // newest day on top
  const hasData = Object.keys(d.cells).length > 0;
  const notUpdated = d.isCurrentMonth ? activeEditors.filter((e) => e.today === null && e.id !== me.id) : [];
  const histMax = Math.max(1, ...d.history.map((h) => h.total));

  // the month on screen as a sheet (opens in Excel / Google Sheets)
  const download = () => {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows: (string | number)[][] = [["Date", "Day", ...d.editors.map((e) => e.name), ...(d.seeAll ? ["Total"] : ["Note"])]];
    for (const day of d.days.filter((x) => !x.future)) {
      const [y, m, dd] = day.date.split("-");
      rows.push([`${dd}-${m}-${y}`, day.weekday, ...d.editors.map((e) => d.cells[`${e.id}|${day.date}`]?.count ?? ""), d.seeAll ? (day.any ? day.total : "") : (d.cells[`${me.id}|${day.date}`]?.note ?? "")]);
    }
    rows.push(["Month total", "", ...d.perEditor.map((e) => e.total), d.seeAll ? d.grand : ""]);
    const blob = new Blob(["\uFEFF" + rows.map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${tm.title} - ${d.monthLabel}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // click a day (table / chart / card) → that day and editor are loaded in the update form
  const pick = (uid: string, day: string) => {
    if (!canUpdate || day > d.today) return;
    if (d.seeAll) { if (!d.editors.find((e) => e.id === uid)?.active) return; setUserId(uid); } else if (uid !== me.id) return;
    setDate(day);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{tm.eyebrow}</div>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">{tm.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{d.seeAll ? `${cap(tm.many)} ${tm.did} per day by every ${tm.person}` : `Your ${tm.many} ${tm.did} per day`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
            <a href={`${tm.path}?month=${d.prevMonth}`} className="grid h-9 w-9 place-items-center text-[var(--ink-2)] hover:bg-[var(--surface-2)]" title="Previous month"><ChevronLeft size={16} /></a>
            <span className="inline-flex min-w-[138px] items-center justify-center gap-1.5 px-2 text-[13px] font-bold"><CalendarDays size={14} className="text-[var(--violet)]" /> {d.monthLabel}</span>
            {d.nextMonth
              ? <a href={`${tm.path}?month=${d.nextMonth}`} className="grid h-9 w-9 place-items-center text-[var(--ink-2)] hover:bg-[var(--surface-2)]" title="Next month"><ChevronRight size={16} /></a>
              : <span className="grid h-9 w-9 place-items-center text-[var(--line-2)]"><ChevronRight size={16} /></span>}
          </div>
          {hasData && <button type="button" onClick={download} className="btn btn-ghost" title="Download this month as a sheet (Excel)"><Download size={15} /> Download</button>}
          {d.seeAll && <button type="button" onClick={() => setImporting(true)} className="btn btn-ghost"><Upload size={15} /> Import sheet</button>}
          {d.seeAll && <AssignCreativeForm members={d.editors.filter((e) => e.active).map((e) => ({ id: e.id, name: e.name, role: tm.role }))} clients={clients} from={`${tm.path}?month=${d.month}`} label="Assign work" />}
        </div>
      </div>

      {me.isAdmin && !leadId && (
        <a href="#video-team-settings" className="flex flex-wrap items-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] font-semibold" style={{ background: tint("var(--amber)", 9), borderColor: tint("var(--amber)", 30), color: "#7a4f08" }}>
          <AlertTriangle size={15} /> No team lead is chosen yet — the lead cannot see the whole team or assign work until you pick one. <span className="underline">Choose the team lead ↓</span>
        </a>
      )}

      {flash && (
        <p className="flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold" style={{ background: tint(flash.ok ? "var(--emerald)" : "var(--rose)", 9), color: flash.ok ? "var(--emerald)" : "var(--rose)" }}>
          {flash.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {flash.text}
        </p>
      )}

      {/* summary + daily chart */}
      <div className="grid gap-4 xl:grid-cols-[minmax(300px,1fr)_2.2fr]">
        <div className="relative overflow-hidden rounded-[16px] p-6 text-white shadow-[var(--shadow-md)]" style={{ background: "var(--grad)" }}>
          <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-white/[.06]" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.08em] text-white/75"><Film size={14} /> {d.seeAll ? `Team ${tm.many}` : `My ${tm.many}`} · {d.monthLabel}</div>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-[52px] font-extrabold leading-none tracking-tight tnum">{d.grand}</span>
              <span className="pb-1.5 text-[13px] font-semibold text-white/75">{tm.many} {tm.did}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-white/85">
              {change !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-bold">{change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {change >= 0 ? "+" : ""}{change}%</span>
              )}
              <span>{d.prevLabel}: <b className="tnum">{d.prevTotal}</b> {tm.many}</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { icon: Clock3, label: d.isCurrentMonth ? "Today" : "Days worked", value: d.isCurrentMonth ? d.todayTotal : worked.length, sub: d.isCurrentMonth ? (d.seeAll ? `${updatedToday} of ${activeEditors.length} updated` : (d.perEditor[0]?.today === null ? "not updated yet" : "updated")) : `with ${tm.many}` },
                { icon: TrendingUp, label: "Avg / day", value: avgDay, sub: `${worked.length} working day${worked.length === 1 ? "" : "s"}` },
                { icon: Trophy, label: "Best day", value: bestDay ? bestDay.total : 0, sub: bestDay ? fmtDay(bestDay.date) : "—" },
              ].map((k) => (
                <div key={k.label} className="rounded-[12px] bg-white/[.12] px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-white/70"><k.icon size={12} /> {k.label}</div>
                  <div className="mt-1 text-[22px] font-extrabold leading-none tnum">{k.value}</div>
                  <div className="mt-1 truncate text-[10.5px] text-white/70">{k.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card card-pad flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[14px] font-bold">Daily output</div>
              <div className="text-[11.5px] text-[var(--muted)]">{cap(tm.many)} finished each day of {d.monthLabel}</div>
            </div>
            {d.seeAll && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {d.editors.map((e) => <span key={e.id} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color(e.id) }} /> {e.name}</span>)}
              </div>
            )}
          </div>
          {hasData ? (
            <div className="mt-4 flex-1">
              <div className="flex h-[168px] items-end gap-[3px] border-b border-[var(--line-2)]">
                {d.days.map((day) => (
                  <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${fmtDay(day.date)} (${day.weekday}) · ${day.any ? `${day.total} ${tm.many}` : "no entry"}`}>
                    {day.total > 0 && <div className="mb-0.5 text-center text-[9.5px] font-bold leading-none text-[var(--ink-2)] tnum">{day.total}</div>}
                    <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: day.total > 0 ? `${Math.max(4, (day.total / maxDayTotal) * 86)}%` : day.any ? 3 : 0, background: day.total > 0 ? undefined : "var(--line-2)", outline: day.isToday ? "2px solid color-mix(in srgb, var(--violet) 35%, white)" : undefined }}>
                      {d.editors.map((e) => { const c = d.cells[`${e.id}|${day.date}`]?.count ?? 0; return c > 0 ? <div key={e.id} style={{ flex: c, background: color(e.id) }} /> : null; })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-[3px]">
                {d.days.map((day) => <div key={day.date} className={`min-w-0 flex-1 text-center text-[9.5px] tnum ${day.isToday ? "font-extrabold text-[var(--violet)]" : day.sunday ? "font-semibold text-[var(--rose)]" : "text-[var(--faint)]"}`}>{day.day}</div>)}
              </div>
            </div>
          ) : (
            <div className="grid flex-1 place-items-center py-10 text-center text-[13px] text-[var(--muted)]">No counts for {d.monthLabel} yet.{canUpdate ? " Add today’s count below." : ""}</div>
          )}
        </div>
      </div>

      {/* who has not updated today → one click reminds them */}
      {d.seeAll && notUpdated.length > 0 && (
        <form action={remindEditCount} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-4 py-3" style={{ background: tint("var(--amber)", 8), borderColor: tint("var(--amber)", 28) }}>
          <div className="flex items-center gap-2.5 text-[13px]" style={{ color: "#7a4f08" }}>
            <Clock3 size={16} className="flex-none" />
            <span><b>{notUpdated.length} {tm.person}{notUpdated.length === 1 ? " has" : "s have"} not updated today:</b> {notUpdated.map((e) => e.name).join(", ")}</span>
          </div>
          <input type="hidden" name="team" value={tm.kind} />
          <button type="submit" className="btn btn-sm" style={{ background: "#b45309", color: "white" }}><BellRing size={14} /> Send reminder</button>
        </form>
      )}

      {/* each editor */}
      {d.seeAll && d.perEditor.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))" }}>
          {d.perEditor.map((e) => {
            const c = color(e.id);
            const rank = ranked.findIndex((r) => r.id === e.id) + 1;
            return (
              <button key={e.id} type="button" onClick={() => pick(e.id, maxDate)} className="card card-pad group text-left transition hover:shadow-[var(--shadow-md)]" style={{ borderTop: `3px solid ${c}` }} title={e.active ? "Click to update this count" : ""}>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-[12.5px] font-extrabold" style={{ background: tint(c, 14), color: c }}>{initials(e.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-[14px] font-bold">{e.name}{e.lead && <span title="Team lead" className="flex-none text-[var(--amber)]"><Crown size={13} /></span>}{e.shoots && <span title="Also goes on shoots" className="flex-none text-[var(--muted)]"><Camera size={13} /></span>}</div>
                    <div className="text-[11px] text-[var(--muted)]">{e.lead ? "Team lead" : e.active ? tm.member : "No longer in the team"}</div>
                  </div>
                  {e.total > 0 && <span className="flex-none rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={rank === 1 ? { background: tint("var(--amber)", 16), color: "#92600a" } : { background: "var(--surface-2)", color: "var(--muted)" }}>#{rank}</span>}
                </div>
                <div className="mt-3 flex items-end gap-1.5">
                  <span className="text-[30px] font-extrabold leading-none tracking-tight tnum">{e.total}</span>
                  <span className="pb-0.5 text-[11.5px] text-[var(--muted)]">{tm.many}</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${(e.total / topTotal) * 100}%`, background: c }} /></div>
                <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                  {[["Days", e.worked], ["Avg/day", e.avg], ["Best", e.best]].map(([l, v]) => (
                    <div key={l} className="rounded-[8px] bg-[var(--surface-2)] px-1 py-1.5"><div className="text-[13px] font-bold tnum">{v}</div><div className="text-[9.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">{l}</div></div>
                  ))}
                </div>
                {d.isCurrentMonth && e.active && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={e.today !== null ? { background: tint("var(--emerald)", 11), color: "var(--emerald)" } : { background: tint("var(--amber)", 13), color: "#92600a" }}>
                    {e.today !== null ? <><CheckCircle2 size={12} /> Today · {e.today} {e.today === 1 ? tm.one : tm.many}</> : <><Clock3 size={12} /> Not updated today</>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* update a day */}
      {canUpdate && (
        <div ref={formRef} className="card card-pad" style={{ borderLeft: "3px solid var(--violet)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: tint("var(--violet)", 12), color: "var(--violet)" }}><PencilLine size={17} /></span>
              <div>
                <div className="text-[14px] font-bold">Update work</div>
                <div className="text-[11.5px] text-[var(--muted)]">{d.seeAll ? `Add or correct the ${tm.many} ${tm.did} on a day` : `How many ${tm.many} did you finish?`}</div>
              </div>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={cell ? { background: tint("var(--emerald)", 10), color: "var(--emerald)" } : { background: "var(--surface-2)", color: "var(--muted)" }}>
              {cell ? `Saved for ${fmtDay(date)}: ${cell.count}${cell.by ? ` · by ${cell.by}` : ""}` : `No entry for ${fmtDay(date)} yet`}
            </span>
          </div>
          <form key={`${userId}|${date}|${cell?.count ?? ""}`} action={saveEditCount} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_150px_2fr_auto] lg:items-end">
            <input type="hidden" name="team" value={tm.kind} />
            {d.seeAll ? (
              <label className="block"><span className="eyebrow">{cap(tm.person)}</span>
                <select name="userId" value={userId} onChange={(e) => setUserId(e.target.value)} className="select mt-1.5">
                  {d.editors.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}{e.id === me.id ? " (me)" : ""}</option>)}
                </select>
              </label>
            ) : (
              <label className="block"><span className="eyebrow">{cap(tm.person)}</span><input value={me.name} readOnly className="input mt-1.5 bg-[var(--surface-2)]" /></label>
            )}
            <label className="block"><span className="eyebrow">Date</span><input type="date" name="date" required value={date} min={`${d.month}-01`} max={maxDate} onChange={(e) => setDate(e.target.value)} className="input mt-1.5" /></label>
            <label className="block"><span className="eyebrow">{cap(tm.many)} {tm.did}</span><div className="mt-1.5"><CountStepper defaultValue={cell?.count ?? ""} /></div></label>
            <label className="block"><span className="eyebrow">Note (optional)</span><input name="note" maxLength={300} defaultValue={cell?.note ?? ""} placeholder={tm.kind === "DESIGN" ? "e.g. 6 posts + 2 banners, half day…" : "e.g. 2 reels for a client, half day…"} className="input mt-1.5" /></label>
            <button type="submit" className="btn btn-violet"><Save size={15} /> Save</button>
          </form>
          <p className="mt-2.5 text-[11.5px] text-[var(--muted)]">Click a day in the table below to load it here. Leave the number empty and save to remove a wrong entry.</p>
        </div>
      )}

      {/* the month, day by day */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <div>
            <div className="text-[14px] font-bold">Day by day · {d.monthLabel}</div>
            <div className="text-[11.5px] text-[var(--muted)]">Latest day on top · darker = more {tm.many} · “—” = no entry (leave / holiday)</div>
          </div>
          <span className="pill">{worked.length} working day{worked.length === 1 ? "" : "s"}</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                <th className="w-[150px] px-5 py-2.5 text-left">Date</th>
                {d.editors.map((e) => <th key={e.id} className="px-2 py-2.5 text-center"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color(e.id) }} />{d.seeAll ? e.name : cap(tm.many)}</span></th>)}
                {d.seeAll ? <th className="w-[110px] px-5 py-2.5 text-right">Team total</th> : <th className="px-5 py-2.5 text-left">Note</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((day) => (
                <tr key={day.date} className="border-b border-[var(--line)] last:border-0" style={day.isToday ? { background: tint("var(--violet)", 5) } : day.sunday && !day.any ? { background: "var(--surface-2)" } : undefined}>
                  <td className="whitespace-nowrap px-5 py-1.5">
                    <span className="font-semibold tnum">{fmtDay(day.date)}</span>
                    <span className={`ml-2 text-[11.5px] ${day.sunday ? "font-semibold text-[var(--rose)]" : "text-[var(--muted)]"}`}>{day.weekday}</span>
                    {day.isToday && <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-[var(--violet)]" style={{ background: tint("var(--violet)", 13) }}>Today</span>}
                  </td>
                  {d.editors.map((e) => {
                    const c = d.cells[`${e.id}|${day.date}`];
                    const clickable = canUpdate && (d.seeAll ? e.active : e.id === me.id);
                    const on = userId === e.id && date === day.date;
                    const col = color(e.id);
                    return (
                      <td key={e.id} className="px-1.5 py-1 text-center">
                        <button type="button" disabled={!clickable} onClick={() => pick(e.id, day.date)} title={c?.note || (clickable ? "Click to update" : "")}
                          className={`relative mx-auto grid h-8 w-full max-w-[84px] min-w-[44px] place-items-center rounded-[8px] px-2 tnum transition ${clickable ? "hover:brightness-95" : "cursor-default"}`}
                          style={{
                            background: c && c.count > 0 ? tint(col, 9 + Math.round((c.count / maxCell) * 30)) : c ? "var(--surface-2)" : "transparent",
                            color: c && c.count > 0 ? "var(--ink)" : c ? "var(--muted)" : "var(--line-2)",
                            fontWeight: c && c.count > 0 ? 700 : 400,
                            outline: on ? "2px solid var(--violet)" : undefined, outlineOffset: on ? -2 : undefined,
                          }}>
                          {c ? c.count : "—"}
                          {c?.note && d.seeAll ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--amber)]" /> : null}
                        </button>
                      </td>
                    );
                  })}
                  {d.seeAll
                    ? <td className="px-5 py-1.5 text-right">{day.any ? <span className="text-[14px] font-extrabold tnum">{day.total}</span> : <span className="text-[11.5px] text-[var(--faint)]">{day.sunday ? "Sunday" : "No entry"}</span>}</td>
                    : <td className="px-5 py-1.5 text-[12.5px] text-[var(--ink-2)]">{d.cells[`${me.id}|${day.date}`]?.note || <span className="text-[var(--faint)]">{d.cells[`${me.id}|${day.date}`] ? "" : day.sunday ? "Sunday" : "No entry"}</span>}</td>}
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={d.editors.length + 2} className="px-5 py-10 text-center text-sm text-[var(--muted)]">This month has not started yet.</td></tr>}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--line-2)] bg-[var(--surface-2)]">
                <td className="px-5 py-3 text-[12px] font-extrabold uppercase tracking-wide">Month total</td>
                {d.perEditor.map((e) => <td key={e.id} className="px-2 py-3 text-center text-[15px] font-extrabold tnum" style={{ color: color(e.id) }}>{e.total}</td>)}
                {d.seeAll ? <td className="px-5 py-3 text-right text-[16px] font-extrabold tnum">{d.grand}</td> : <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* month by month */}
      {d.history.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-5 py-3.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: tint("var(--sky)", 12), color: "var(--sky)" }}><BarChart3 size={16} /></span>
            <div>
              <div className="text-[14px] font-bold">Month by month</div>
              <div className="text-[11.5px] text-[var(--muted)]">Last 6 months · click a month to open it</div>
            </div>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-5 py-2.5 text-left">Month</th>
                  {d.seeAll && d.editors.map((e) => <th key={e.id} className="px-2 py-2.5 text-center">{e.name}</th>)}
                  <th className="px-3 py-2.5 text-center">Days</th>
                  <th className="px-3 py-2.5 text-center">Avg / day</th>
                  <th className="w-[34%] px-5 py-2.5 text-left">{d.seeAll ? "Team total" : "Total"}</th>
                </tr>
              </thead>
              <tbody>
                {d.history.map((h) => (
                  <tr key={h.month} className="border-b border-[var(--line)] last:border-0" style={h.month === d.month ? { background: tint("var(--violet)", 5) } : undefined}>
                    <td className="whitespace-nowrap px-5 py-2.5"><a href={`${tm.path}?month=${h.month}`} className="font-bold hover:text-[var(--violet)] hover:underline">{h.label}</a></td>
                    {d.seeAll && d.editors.map((e) => <td key={e.id} className="px-2 py-2.5 text-center font-semibold tnum">{h.byUser[e.id] ?? <span className="font-normal text-[var(--line-2)]">—</span>}</td>)}
                    <td className="px-3 py-2.5 text-center text-[var(--ink-2)] tnum">{h.workingDays}</td>
                    <td className="px-3 py-2.5 text-center text-[var(--ink-2)] tnum">{h.workingDays ? Math.round((h.total / h.workingDays) * 10) / 10 : 0}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-10 flex-none text-[14px] font-extrabold tnum">{h.total}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${(h.total / histMax) * 100}%`, background: "var(--grad)" }} /></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* the team's assigned video work (lead / admin) */}
      {d.seeAll && (
        <div className="card !p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
            <div>
              <div className="text-[14px] font-bold">Team work · assigned {tm.many}</div>
              <div className="text-[11.5px] text-[var(--muted)]">Everything still open, and what was completed in the last 14 days.</div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="pill">{d.tasks.filter((t) => !t.done).length} open</span>
              {d.tasks.some((t) => t.overdue) && <span className="rounded-full px-2.5 py-1 text-[11.5px] font-bold text-[var(--rose)]" style={{ background: tint("var(--rose)", 10) }}>{d.tasks.filter((t) => t.overdue).length} overdue</span>}
            </div>
          </div>
          <div className="max-h-[520px] overflow-auto scroll-thin">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-5 py-2.5 text-left">{cap(tm.one)}</th>
                  <th className="px-3 py-2.5 text-left">Client</th>
                  <th className="px-3 py-2.5 text-left">{cap(tm.person)}</th>
                  <th className="px-3 py-2.5 text-left">Assigned by</th>
                  <th className="px-3 py-2.5 text-left">Due</th>
                  <th className="px-5 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.tasks.map((t) => {
                  const st = STATUS[t.status] ?? STATUS.PENDING;
                  return (
                    <tr key={t.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-5 py-2.5"><div className="font-semibold">{t.title}</div><div className="text-[11.5px] text-[var(--muted)]">{t.code} · {t.type}</div></td>
                      <td className="px-3 py-2.5 text-[var(--ink-2)]">{t.client || "—"}</td>
                      <td className="px-3 py-2.5 font-semibold">{t.editor}</td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{t.by || "—"}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 tnum ${t.overdue ? "font-bold text-[var(--rose)]" : ""}`}>{fmtDay(t.dueDate)}{t.overdue ? " · overdue" : ""}</td>
                      <td className="px-5 py-2.5"><span className="inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: tint(st.tone, 12), color: st.tone }}>{st.label}</span></td>
                    </tr>
                  );
                })}
                {d.tasks.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No work assigned yet. Use “Assign work” to give a {tm.one} to a {tm.person}.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* admins: team lead + who goes on shoots */}
      {me.isAdmin && (
        <form id="video-team-settings" action={saveVideoTeamSettings} className="card card-pad scroll-mt-24">
          <input type="hidden" name="month" value={d.month} />
          <input type="hidden" name="team" value={tm.kind} />
          <div className="flex items-center gap-2 text-[14px] font-bold"><Settings2 size={16} className="text-[var(--muted)]" /> {tm.eyebrow} settings</div>
          <div className="mt-3 grid gap-5 lg:grid-cols-[260px_1fr_auto] lg:items-end">
            <label className="block"><span className="eyebrow">Team lead</span>
              <select name="leadId" defaultValue={leadId} className="select mt-1.5">
                <option value="">— No team lead —</option>
                {d.editors.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            {tm.kind === "VIDEO" ? (
              <div>
                <span className="eyebrow">Goes on shoots (gets “My Shoots”)</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {d.editors.filter((e) => e.active).map((e) => (
                    <label key={e.id} className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] font-semibold has-[:checked]:border-[var(--violet)] has-[:checked]:bg-[color-mix(in_srgb,var(--violet)_7%,white)]">
                      <input type="checkbox" name="shootTeam" value={e.id} defaultChecked={e.shoots} className="h-4 w-4 accent-[var(--violet)]" /> {e.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : <div />}
            <button type="submit" className="btn btn-violet"><Save size={15} /> Save settings</button>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
            <b>Team lead</b> sees every {tm.person}’s count and work here, assigns {tm.many} to the team and can import the sheet — other {tm.person}s see only their own.
            {tm.kind === "VIDEO" && <><br /><b>Goes on shoots</b>: only the ticked editors can be chosen as the shooter in Studiox Shoot and have “My Shoots” in their menu.</>}
          </p>
        </form>
      )}

      {importing && <ImportModal tm={tm} close={() => setImporting(false)} />}
    </div>
  );
}

function ImportModal({ close, tm }: { close: () => void; tm: TeamInfo }) {
  const [result, action, pending] = useActionState<EditCountImportResult, FormData>(importEditCounts, null);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Import {tm.title.toLowerCase()} sheet</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Loads the old Google Sheet counts against each {tm.person}.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        {result?.ok ? (
          <div className="space-y-3 px-6 py-5">
            <p className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[var(--emerald)]" style={{ background: tint("var(--emerald)", 8) }}><CheckCircle2 size={16} className="mt-0.5 flex-none" /> {result.message}</p>
            <ul className="space-y-1 text-[12.5px] text-[var(--ink-2)]">{(result.details ?? []).map((x) => <li key={x}>• {x}</li>)}</ul>
            <div className="flex justify-end"><button type="button" onClick={() => { close(); window.location.reload(); }} className="btn btn-violet">Done</button></div>
          </div>
        ) : (
          <form action={action} className="space-y-3 px-6 py-5">
            <input type="hidden" name="team" value={tm.kind} />
            <label className="block">
              <span className="eyebrow">{tm.title} file (CSV)</span>
              <input name="file" type="file" accept=".csv,text/csv" required className="input mt-1 !py-1.5 text-[12px]" />
            </label>
            <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
              First column <b>Date</b> (01-08-2026), then one column per {tm.person} with the name as in Team.<br />
              An empty cell is skipped. A day already in the CRM is replaced, so the same file can be imported again safely.
            </div>
            {result && !result.ok && <p className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold text-[var(--rose)]" style={{ background: tint("var(--rose)", 8) }}>{result.message}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={pending} className="btn btn-violet disabled:opacity-60"><Upload size={15} /> {pending ? "Importing…" : "Import"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
