"use client";

import { useActionState, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Upload, X, CheckCircle2, Clapperboard, Crown, Save } from "lucide-react";
import type { EditCountBoardData } from "@/lib/edit-count-queries";
import { saveEditCount, setVideoTeamLead, importEditCounts, type EditCountImportResult } from "@/app/edit-count-actions";
import AssignCreativeForm from "@/components/AssignCreativeForm";

// Video team "Editing Count" — the month's videos-per-day for each editor (the old Google
// Sheet), the form to update a day, and for the team lead / admins the team's assigned work.

type Me = { id: string; name: string; isEditor: boolean; isAdmin: boolean };
type ClientOpt = { id: string; name: string };

const SAVED: Record<string, { text: string; ok: boolean }> = {
  "1": { text: "Saved.", ok: true },
  baddate: { text: "Not saved — choose a date that is today or earlier.", ok: false },
  badcount: { text: "Not saved — the number of videos is not valid.", ok: false },
  noeditor: { text: "Not saved — choose a video editor.", ok: false },
};
const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Pending", tone: "var(--muted)" },
  IN_PROGRESS: { label: "In progress", tone: "var(--sky)" },
  REVIEW: { label: "Review", tone: "var(--violet)" },
  COMPLETED: { label: "Completed", tone: "var(--emerald)" },
};
const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—");

export default function EditCountBoard({ d, me, clients, saved }: { d: EditCountBoardData; me: Me; clients: ClientOpt[]; saved: string }) {
  const first = d.editors.find((e) => e.id === me.id) ?? d.editors.find((e) => e.active) ?? d.editors[0];
  const [userId, setUserId] = useState(first?.id ?? "");
  const [date, setDate] = useState(d.month === d.today.slice(0, 7) ? d.today : `${d.month}-01`);
  const cell = d.cells[`${userId}|${date}`];
  const [importing, setImporting] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const flash = SAVED[saved];
  const canUpdate = d.seeAll ? d.editors.some((e) => e.active) : me.isEditor;
  const leadId = d.editors.find((e) => e.lead)?.id ?? "";
  // the form works inside the month on screen (its saved values are what is loaded here)
  const lastDay = d.days[d.days.length - 1].date;
  const maxDate = lastDay < d.today ? lastDay : d.today;

  // click a day in the table → that day (and editor) is loaded in the update form
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
          <div className="eyebrow">Video team</div>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Editing Count</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{d.seeAll ? "Videos edited per day by every editor" : "Your videos edited per day"} · {d.monthLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)]">
            <a href={`/video-team?month=${d.prevMonth}`} className="grid h-9 w-9 place-items-center text-[var(--ink-2)] hover:bg-[var(--surface-2)]" title="Previous month"><ChevronLeft size={16} /></a>
            <span className="min-w-[124px] px-2 text-center text-[13px] font-bold">{d.monthLabel}</span>
            {d.nextMonth
              ? <a href={`/video-team?month=${d.nextMonth}`} className="grid h-9 w-9 place-items-center text-[var(--ink-2)] hover:bg-[var(--surface-2)]" title="Next month"><ChevronRight size={16} /></a>
              : <span className="grid h-9 w-9 place-items-center text-[var(--line-2)]"><ChevronRight size={16} /></span>}
          </div>
          {d.seeAll && <button type="button" onClick={() => setImporting(true)} className="btn btn-ghost"><Upload size={15} /> Import sheet</button>}
          {d.seeAll && <AssignCreativeForm members={d.editors.filter((e) => e.active).map((e) => ({ id: e.id, name: e.name, role: "EDITOR" }))} clients={clients} from={`/video-team?month=${d.month}`} label="Assign work" />}
        </div>
      </div>

      {flash && (
        <p className="rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold" style={{ background: `color-mix(in srgb, ${flash.ok ? "var(--emerald)" : "var(--rose)"} 9%, white)`, color: flash.ok ? "var(--emerald)" : "var(--rose)" }}>{flash.text}</p>
      )}

      {/* month totals */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {d.seeAll && (
          <div className="card card-pad" style={{ background: "var(--ink)", color: "white" }}>
            <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">Team · {d.monthLabel.split(" ")[0]}</div>
            <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight tnum">{d.grand}</div>
            <div className="mt-1.5 text-[11.5px] opacity-70">videos · today {d.todayTotal}</div>
          </div>
        )}
        {d.perEditor.map((e) => (
          <div key={e.id} className="card card-pad">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              <span className="truncate">{d.seeAll ? e.name : "This month"}</span>
              {e.lead && <span title="Team lead" className="flex-none text-[var(--amber)]"><Crown size={12} /></span>}
            </div>
            <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight tnum">{e.total}</div>
            <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">{e.worked} day{e.worked === 1 ? "" : "s"} · avg {e.avg}/day{e.today !== null ? ` · today ${e.today}` : ""}</div>
          </div>
        ))}
      </div>

      {/* update a day */}
      {canUpdate && (
        <div ref={formRef} className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[14px] font-bold"><Clapperboard size={16} className="text-[var(--rose)]" /> Update work</div>
            <span className="text-[11.5px] text-[var(--muted)]">{cell ? `Saved for this day: ${cell.count}${cell.by ? ` · by ${cell.by}` : ""}` : "No entry for this day yet"}</span>
          </div>
          <form key={`${userId}|${date}|${cell?.count ?? ""}`} action={saveEditCount} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_.8fr_2fr_auto] lg:items-end">
            {d.seeAll ? (
              <label className="block"><span className="eyebrow">Editor</span>
                <select name="userId" value={userId} onChange={(e) => setUserId(e.target.value)} className="select mt-1.5">
                  {d.editors.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}{e.id === me.id ? " (me)" : ""}</option>)}
                </select>
              </label>
            ) : (
              <label className="block"><span className="eyebrow">Editor</span><input value={me.name} readOnly className="input mt-1.5 bg-[var(--surface-2)]" /></label>
            )}
            <label className="block"><span className="eyebrow">Date</span><input type="date" name="date" required value={date} min={`${d.month}-01`} max={maxDate} onChange={(e) => setDate(e.target.value)} className="input mt-1.5" /></label>
            <label className="block"><span className="eyebrow">Videos edited</span><input type="number" name="count" min={0} max={500} step={1} defaultValue={cell?.count ?? ""} placeholder="0" className="input mt-1.5 tnum" /></label>
            <label className="block"><span className="eyebrow">Note (optional)</span><input name="note" maxLength={300} defaultValue={cell?.note ?? ""} placeholder="e.g. 2 reels for a client, half day…" className="input mt-1.5" /></label>
            <button type="submit" className="btn btn-violet"><Save size={15} /> Save</button>
          </form>
          <p className="mt-2 text-[11.5px] text-[var(--muted)]">Click any day in the table to load it here. Leave “Videos edited” empty and save to remove a wrong entry.</p>
        </div>
      )}

      {/* the month, day by day */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <div className="text-[14px] font-bold">{d.monthLabel} · day by day</div>
          <div className="text-[11.5px] text-[var(--muted)]">“—” = no entry (leave / holiday)</div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                <th className="px-5 py-2.5 text-left">Date</th>
                <th className="px-3 py-2.5 text-left">Day</th>
                {d.editors.map((e) => <th key={e.id} className="px-3 py-2.5 text-center">{e.name}</th>)}
                {d.seeAll && <th className="px-5 py-2.5 text-right">Total</th>}
              </tr>
            </thead>
            <tbody>
              {d.days.map((day) => (
                <tr key={day.date} className="border-b border-[var(--line)] last:border-0" style={day.isToday ? { background: "color-mix(in srgb, var(--violet) 6%, white)" } : day.sunday ? { background: "var(--surface-2)" } : undefined}>
                  <td className="whitespace-nowrap px-5 py-2 font-semibold tnum">{fmtDay(day.date)}{day.isToday && <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-[var(--violet)]" style={{ background: "color-mix(in srgb, var(--violet) 12%, white)" }}>Today</span>}</td>
                  <td className={`px-3 py-2 ${day.sunday ? "font-semibold text-[var(--rose)]" : "text-[var(--muted)]"}`}>{day.weekday}</td>
                  {d.editors.map((e) => {
                    const c = d.cells[`${e.id}|${day.date}`];
                    const clickable = canUpdate && !day.future && (d.seeAll ? e.active : e.id === me.id);
                    const on = userId === e.id && date === day.date;
                    return (
                      <td key={e.id} className="px-1.5 py-1 text-center">
                        <button type="button" disabled={!clickable} onClick={() => pick(e.id, day.date)} title={c?.note || (clickable ? "Click to update" : "")}
                          className={`mx-auto grid h-8 min-w-[44px] place-items-center rounded-[8px] px-2 tnum ${clickable ? "hover:bg-[var(--surface-3)]" : "cursor-default"} ${c ? (c.count > 0 ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]") : "text-[var(--line-2)]"}`}
                          style={on ? { outline: "2px solid var(--violet)", outlineOffset: -2 } : undefined}>
                          {c ? c.count : "—"}{c?.note ? <span className="ml-0.5 text-[9px] text-[var(--amber)]">●</span> : null}
                        </button>
                      </td>
                    );
                  })}
                  {d.seeAll && <td className="px-5 py-2 text-right font-bold tnum">{day.any ? day.total : <span className="font-normal text-[var(--line-2)]">—</span>}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--line-2)] bg-[var(--surface-2)] font-extrabold">
                <td className="px-5 py-3" colSpan={2}>Month total</td>
                {d.perEditor.map((e) => <td key={e.id} className="px-3 py-3 text-center tnum">{e.total}</td>)}
                {d.seeAll && <td className="px-5 py-3 text-right tnum">{d.grand}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* the team's assigned video work (lead / admin) */}
      {d.seeAll && (
        <div className="card !p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
            <div>
              <div className="text-[14px] font-bold">Team work · assigned videos</div>
              <div className="text-[11.5px] text-[var(--muted)]">Everything still open, and what was completed in the last 14 days.</div>
            </div>
            <span className="pill">{d.tasks.filter((t) => t.status !== "COMPLETED").length} open</span>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-5 py-2.5 text-left">Video</th>
                  <th className="px-3 py-2.5 text-left">Client</th>
                  <th className="px-3 py-2.5 text-left">Editor</th>
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
                      <td className="px-5 py-2.5"><span className="inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: `color-mix(in srgb, ${st.tone} 12%, white)`, color: st.tone }}>{st.label}</span></td>
                    </tr>
                  );
                })}
                {d.tasks.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No video work assigned yet. Use “Assign work” to give a video to an editor.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* admins choose the team lead */}
      {me.isAdmin && (
        <form action={setVideoTeamLead} className="card card-pad flex flex-wrap items-end gap-3">
          <input type="hidden" name="month" value={d.month} />
          <label className="block min-w-[220px]"><span className="eyebrow">Video team lead</span>
            <select name="userId" defaultValue={leadId} className="select mt-1.5">
              <option value="">— No team lead —</option>
              {d.editors.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <button type="submit" className="btn btn-ghost">Save team lead</button>
          <p className="basis-full text-[11.5px] text-[var(--muted)]">The team lead sees every editor’s count and work here, assigns videos to the team and can import the sheet. Other editors see only their own.</p>
        </form>
      )}

      {importing && <ImportModal close={() => setImporting(false)} />}
    </div>
  );
}

function ImportModal({ close }: { close: () => void }) {
  const [result, action, pending] = useActionState<EditCountImportResult, FormData>(importEditCounts, null);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Import editing count sheet</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Loads the old Google Sheet counts against each editor.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        {result?.ok ? (
          <div className="space-y-3 px-6 py-5">
            <p className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[var(--emerald)]" style={{ background: "color-mix(in srgb, var(--emerald) 8%, white)" }}><CheckCircle2 size={16} className="mt-0.5 flex-none" /> {result.message}</p>
            <ul className="space-y-1 text-[12.5px] text-[var(--ink-2)]">{(result.details ?? []).map((x) => <li key={x}>• {x}</li>)}</ul>
            <div className="flex justify-end"><button type="button" onClick={() => { close(); window.location.reload(); }} className="btn btn-violet">Done</button></div>
          </div>
        ) : (
          <form action={action} className="space-y-3 px-6 py-5">
            <label className="block">
              <span className="eyebrow">Editing count file (CSV)</span>
              <input name="file" type="file" accept=".csv,text/csv" required className="input mt-1 !py-1.5 text-[12px]" />
            </label>
            <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
              First column <b>Date</b> (01-08-2026), then one column per editor with the editor’s name as in Team (<b>Poorna, Madhu, …</b>).<br />
              An empty cell is skipped. A day already in the CRM is replaced, so the same file can be imported again safely.
            </div>
            {result && !result.ok && <p className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold text-[var(--rose)]" style={{ background: "color-mix(in srgb, var(--rose) 8%, white)" }}>{result.message}</p>}
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
