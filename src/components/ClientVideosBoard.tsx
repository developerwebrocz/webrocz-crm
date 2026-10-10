"use client";

import { useActionState, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, CalendarDays, Plus, Upload, X, Search, CheckCircle2, AlertTriangle, Film, Scissors,
  Clock3, Megaphone, Send, Check, Pencil, Trash2, Camera, Save, HardDrive, Users,
} from "lucide-react";
import type { VideoJobBoardData, VideoJobRow } from "@/lib/video-job-queries";
import { saveVideoJob, deleteVideoJob, importVideoJobs, type VideoJobImportResult } from "@/app/video-job-actions";
import CountStepper from "@/components/CountStepper";
import { initials } from "@/lib/domain";

// Video team "Client Videos" — every client shoot: videos shot, who edits, how many are edited,
// whether the account manager was told and whether they are posted.

const SAVED: Record<string, { text: string; ok: boolean }> = {
  "1": { text: "Saved.", ok: true },
  deleted: { text: "Deleted.", ok: true },
  bad: { text: "Not saved — a date and a client name are needed.", ok: false },
  denied: { text: "Not saved — this client is not assigned to you.", ok: false },
  gone: { text: "That row no longer exists.", ok: false },
};
const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "To edit", tone: "var(--amber)" },
  IN_PROGRESS: { label: "Editing", tone: "var(--sky)" },
  COMPLETED: { label: "Completed", tone: "var(--emerald)" },
  NO_EDIT: { label: "No edit needed", tone: "var(--muted)" },
};
const PALETTE = ["#6d28d9", "#0284c7", "#059669", "#d97706", "#e11d48", "#0d9488", "#840a92", "#4f46e5"];
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
const isOpen = (r: VideoJobRow) => r.editStatus === "PENDING" || r.editStatus === "IN_PROGRESS";

const TAB_KEYS = ["ALL", "OPEN", "PENDING", "IN_PROGRESS", "COMPLETED", "POST", "NO_EDIT"];

// `initialTab`: the pipeline step picked in the sidebar. `openAdd`: start on the "Add client shoot" form.
export default function ClientVideosBoard({ d, meId, saved, initialTab = "", openAdd = false }: { d: VideoJobBoardData; meId: string; saved: string; initialTab?: string; openAdd?: boolean }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(TAB_KEYS.includes(initialTab) ? initialTab : "ALL");
  const [editor, setEditor] = useState("");
  const [edit, setEdit] = useState<VideoJobRow | "new" | null>(openAdd && d.canManage ? "new" : null);
  const [importing, setImporting] = useState(false);
  const flash = SAVED[saved];
  const ret = `/client-videos?month=${d.month}&saved=1`;
  const colorOf = (name: string) => PALETTE[Math.max(0, d.editors.findIndex((e) => e.name === name)) % PALETTE.length];

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return d.rows.filter((r) =>
      (tab === "ALL" || (tab === "OPEN" ? isOpen(r) : tab === "POST" ? r.editStatus === "COMPLETED" && r.posting !== "POSTED" : r.editStatus === tab)) &&
      (!editor || r.editorIds.includes(editor)) &&
      (!n || r.clientName.toLowerCase().includes(n) || r.editors.join(" ").toLowerCase().includes(n) || r.shotBy.toLowerCase().includes(n)));
  }, [d.rows, q, tab, editor]);

  const pct = d.kpis.shot ? Math.min(100, Math.round((d.kpis.edited / d.kpis.shot) * 100)) : 0;
  const tiles = [
    { label: "Client shoots", value: d.kpis.jobs, sub: `${d.kpis.clients} client${d.kpis.clients === 1 ? "" : "s"}`, icon: Camera, tone: "var(--violet)" },
    { label: "Videos shot", value: d.kpis.shot, sub: d.monthLabel, icon: Film, tone: "var(--sky)" },
    { label: "Videos edited", value: d.kpis.edited, sub: d.kpis.shot && d.kpis.edited <= d.kpis.shot ? `${pct}% of shot` : "this month", icon: Scissors, tone: "var(--emerald)", bar: pct },
    { label: "Still to edit", value: d.kpis.open, sub: "client shoots, any month", icon: Clock3, tone: "var(--amber)", tab: "OPEN" },
    { label: "AM not informed", value: d.kpis.notInformed, sub: "edited, AM not told", icon: Megaphone, tone: "var(--rose)" },
    { label: "Not posted yet", value: d.kpis.notPosted, sub: "edited, not posted", icon: Send, tone: "var(--magenta)", tab: "POST" },
  ];
  const tabs = [
    { key: "ALL", label: "All", n: d.rows.length },
    { key: "PENDING", label: "To edit", n: d.rows.filter((r) => r.editStatus === "PENDING").length },
    { key: "IN_PROGRESS", label: "Editing", n: d.rows.filter((r) => r.editStatus === "IN_PROGRESS").length },
    { key: "COMPLETED", label: "Completed", n: d.rows.filter((r) => r.editStatus === "COMPLETED").length },
    { key: "POST", label: "Not posted", n: d.rows.filter((r) => r.editStatus === "COMPLETED" && r.posting !== "POSTED").length },
    { key: "NO_EDIT", label: "No edit", n: d.rows.filter((r) => r.editStatus === "NO_EDIT").length },
  ];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Video team</div>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Client Videos</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{d.seeAll ? "Every client shoot — videos shot, editor, editing and posting status" : "The client videos assigned to you"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
            <a href={`/client-videos?month=${d.prevMonth}`} className="grid h-9 w-9 place-items-center text-[var(--ink-2)] hover:bg-[var(--surface-2)]" title="Previous month"><ChevronLeft size={16} /></a>
            <span className="inline-flex min-w-[138px] items-center justify-center gap-1.5 px-2 text-[13px] font-bold"><CalendarDays size={14} className="text-[var(--violet)]" /> {d.monthLabel}</span>
            {d.nextMonth
              ? <a href={`/client-videos?month=${d.nextMonth}`} className="grid h-9 w-9 place-items-center text-[var(--ink-2)] hover:bg-[var(--surface-2)]" title="Next month"><ChevronRight size={16} /></a>
              : <span className="grid h-9 w-9 place-items-center text-[var(--line-2)]"><ChevronRight size={16} /></span>}
          </div>
          {d.canDelete && <button type="button" onClick={() => setImporting(true)} className="btn btn-ghost"><Upload size={15} /> Import sheet</button>}
          {d.canManage && <button type="button" onClick={() => setEdit("new")} className="btn btn-violet"><Plus size={15} /> Add client shoot</button>}
        </div>
      </div>

      {flash && (
        <p className="flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold" style={{ background: tint(flash.ok ? "var(--emerald)" : "var(--rose)", 9), color: flash.ok ? "var(--emerald)" : "var(--rose)" }}>
          {flash.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {flash.text}
        </p>
      )}

      {/* figures */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {tiles.map((k) => (
          <button key={k.label} type="button" disabled={!k.tab} onClick={() => k.tab && setTab(k.tab)} className={`card card-pad text-left ${k.tab ? "transition hover:shadow-[var(--shadow-md)]" : "cursor-default"}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{k.label}</span>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px]" style={{ background: tint(k.tone, 12), color: k.tone }}><k.icon size={15} /></span>
            </div>
            <div className="mt-1.5 text-[28px] font-extrabold leading-none tracking-tight tnum">{k.value}</div>
            {k.bar !== undefined
              ? <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${k.bar}%`, background: k.tone }} /></div>
              : null}
            <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">{k.sub}</div>
          </button>
        ))}
      </div>

      {/* list */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {tab === "OPEN" && <button type="button" className="pill pill-dark">To edit + Editing <span className="ml-1 opacity-70 tnum">{d.rows.filter(isOpen).length}</span></button>}
            {tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`pill ${tab === t.key ? "pill-dark" : ""}`}>{t.label} <span className={`ml-1 tnum ${tab === t.key ? "opacity-70" : "text-[var(--muted)]"}`}>{t.n}</span></button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {d.seeAll && (
              <select value={editor} onChange={(e) => setEditor(e.target.value)} className="select !h-9 !w-auto !py-0 text-[13px]">
                <option value="">All editors</option>
                {d.editors.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            )}
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, editor…" className="input !h-9 !w-[210px] !py-0 !pl-8 text-[13px]" />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                <th className="px-5 py-2.5 text-left">Date</th>
                <th className="px-3 py-2.5 text-left">Client</th>
                <th className="px-3 py-2.5 text-left">Shot by</th>
                <th className="px-3 py-2.5 text-center">Shot</th>
                <th className="w-[190px] px-3 py-2.5 text-left">Editing</th>
                <th className="px-3 py-2.5 text-left">Editors</th>
                <th className="px-3 py-2.5 text-center">AM informed</th>
                <th className="px-3 py-2.5 text-left">Posting</th>
                <th className="px-5 py-2.5 text-right">Update</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = STATUS[r.editStatus] ?? STATUS.PENDING;
                const mayUpdate = d.canManage || r.mine;
                const part = r.videosShot > 0 ? Math.min(100, Math.round((r.edited / r.videosShot) * 100)) : r.editStatus === "COMPLETED" ? 100 : 0;
                return (
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]" style={{ boxShadow: isOpen(r) ? `inset 3px 0 0 ${st.tone}` : undefined }}>
                    <td className="whitespace-nowrap px-5 py-2.5">
                      <div className="font-semibold tnum">{fmtDay(r.date)}</div>
                      <div className="text-[11px] text-[var(--muted)]">{r.carried ? <span className="font-bold text-[var(--amber)]">carried over</span> : weekday(r.date)}</div>
                    </td>
                    <td className="max-w-[260px] px-3 py-2.5">
                      <div className="truncate font-bold" title={r.clientName}>{r.clientName}</div>
                      {r.note ? <div className="truncate text-[11.5px] text-[var(--muted)]" title={r.note}>{r.note}</div> : r.storage ? <div className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]"><HardDrive size={11} /> {r.storage}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] text-[var(--ink-2)]">{r.shotBy || <span className="text-[var(--line-2)]">—</span>}</td>
                    <td className="px-3 py-2.5 text-center text-[14px] font-extrabold tnum">{r.videosShot || <span className="font-normal text-[var(--line-2)]">—</span>}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: tint(st.tone, 12), color: r.editStatus === "PENDING" ? "#92600a" : st.tone }}>{st.label}</span>
                        {r.editStatus !== "NO_EDIT" && <span className="text-[12px] font-bold tnum">{r.edited}{r.videosShot ? <span className="font-normal text-[var(--muted)]"> / {r.videosShot}</span> : null}</span>}
                      </div>
                      {r.editStatus !== "NO_EDIT" && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${part}%`, background: st.tone }} /></div>}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.editors.length ? (
                        <div className="flex flex-wrap gap-1">
                          {r.editors.map((n) => <span key={n} className="inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[11.5px] font-semibold" style={{ background: tint(colorOf(n), 10), color: colorOf(n) }}><span className="grid h-[18px] w-[18px] place-items-center rounded-full text-[8.5px] font-extrabold text-white" style={{ background: colorOf(n) }}>{initials(n)}</span>{n}</span>)}
                        </div>
                      ) : <span className="text-[11.5px] font-semibold text-[var(--amber)]">{isOpen(r) ? "Not assigned" : "—"}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">{r.informedAM ? <CheckCircle2 size={17} className="mx-auto text-[var(--emerald)]" /> : <span className="text-[var(--line-2)]">—</span>}</td>
                    <td className="px-3 py-2.5">{r.posting === "POSTED" ? <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-[var(--emerald)]" style={{ background: tint("var(--emerald)", 11) }}>Posted</span> : r.posting === "PENDING" ? <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: tint("var(--amber)", 13), color: "#92600a" }}>Pending</span> : <span className="text-[var(--line-2)]">—</span>}</td>
                    <td className="px-5 py-2.5">
                      {mayUpdate ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {isOpen(r) && (
                            <form action={saveVideoJob}>
                              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="complete" value="1" /><input type="hidden" name="edited" value={r.edited} /><input type="hidden" name="return" value={ret} />
                              <button type="submit" title="All edited — mark completed" className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] text-[var(--emerald)] hover:bg-[color-mix(in_srgb,var(--emerald)_10%,white)]"><Check size={15} /></button>
                            </form>
                          )}
                          <button type="button" onClick={() => setEdit(r)} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 text-[12px] font-bold hover:bg-[var(--surface-3)]"><Pencil size={13} /> Update</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-14 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]"><Film size={20} /></div>
                  <div className="mt-2 text-[14px] font-bold">{d.rows.length ? "Nothing matches these filters" : `No client videos for ${d.monthLabel}`}</div>
                  <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">{d.rows.length ? "Clear the search or pick another tab." : d.canManage ? "Use “Add client shoot” after a shoot, or import the old sheet." : "Client videos assigned to you will show here."}</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {edit && <JobModal d={d} row={edit === "new" ? null : edit} meId={meId} ret={ret} close={() => setEdit(null)} />}
      {importing && <ImportModal close={() => setImporting(false)} />}
    </div>
  );
}

// What the form needs to know (also used by the team lead's dashboard to assign client videos).
export type VideoJobFormOpts = Pick<VideoJobBoardData, "canManage" | "canDelete" | "shooters" | "editors" | "clientNames" | "today">;

// `presetEditorId`: tick this editor on a new row ("assign to Madhu").
export function JobModal({ d, row, meId, ret, close, presetEditorId = "", title = "Add client shoot" }: { d: VideoJobFormOpts; row: VideoJobRow | null; meId: string; ret: string; close: () => void; presetEditorId?: string; title?: string }) {
  const full = d.canManage; // every field; otherwise the editor updates the progress only
  const shotNames = (row?.shotBy ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const otherShooters = shotNames.filter((n) => !d.shooters.includes(n)).join(", ");
  const chip = "inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] font-semibold has-[:checked]:border-[var(--violet)] has-[:checked]:bg-[color-mix(in_srgb,var(--violet)_7%,white)]";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-bold">{row ? row.clientName : title}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{row ? `${fmtDay(row.date)}${row.shotBy ? ` · shot by ${row.shotBy}` : ""}${row.videosShot ? ` · ${row.videosShot} videos shot` : ""}` : "After a shoot: the client, how many videos were shot and who edits them."}</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={saveVideoJob} className="flex flex-col gap-4 overflow-y-auto p-6">
          {row && <input type="hidden" name="id" value={row.id} />}
          <input type="hidden" name="return" value={ret} />
          {full && (
            <>
              <div className="grid gap-3 sm:grid-cols-[160px_1fr_130px]">
                <label className="block"><span className="eyebrow">Shoot date</span><input type="date" name="date" required defaultValue={row?.date ?? d.today} max={d.today} className="input mt-1.5" /></label>
                <label className="block"><span className="eyebrow">Client</span>
                  <input name="clientName" required list="cv-clients" defaultValue={row?.clientName ?? ""} placeholder="Type or pick the client" autoComplete="off" className="input mt-1.5" />
                  <datalist id="cv-clients">{d.clientNames.map((n) => <option key={n} value={n} />)}</datalist>
                </label>
                <label className="block"><span className="eyebrow">Videos shot</span><input type="number" name="videosShot" min={0} max={999} defaultValue={row?.videosShot || ""} placeholder="0" className="input mt-1.5 text-center font-bold tnum" /></label>
              </div>
              <div>
                <span className="eyebrow flex items-center gap-1.5"><Camera size={12} /> Shot by</span>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {d.shooters.map((n) => <label key={n} className={chip}><input type="checkbox" name="shotBy" value={n} defaultChecked={shotNames.includes(n)} className="h-4 w-4 accent-[var(--violet)]" /> {n}</label>)}
                  <input name="shotByOther" defaultValue={otherShooters} placeholder="Someone else (name)" className="input !w-[190px]" />
                </div>
              </div>
              <div>
                <span className="eyebrow flex items-center gap-1.5"><Users size={12} /> Assigned to editor</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {d.editors.map((e) => <label key={e.id} className={chip}><input type="checkbox" name="editorIds" value={e.id} defaultChecked={row ? row.editorIds.includes(e.id) : e.id === presetEditorId} className="h-4 w-4 accent-[var(--violet)]" /> {e.name}{e.id === meId ? " (me)" : ""}</label>)}
                </div>
                {row?.editorNames ? <label className="mt-2 block"><span className="text-[11.5px] text-[var(--muted)]">Other editors from the sheet (no login)</span><input name="editorNames" defaultValue={row.editorNames} className="input mt-1" /></label> : null}
              </div>
            </>
          )}

          <div className="rounded-[12px] border border-[var(--line-2)] bg-[var(--surface-2)] p-4">
            <div className="text-[12.5px] font-bold">Editing progress</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[190px_1fr]">
              <label className="block"><span className="eyebrow">Videos edited{row?.videosShot ? ` (of ${row.videosShot})` : ""}</span><div className="mt-1.5"><CountStepper name="edited" defaultValue={row?.edited ?? ""} /></div></label>
              <label className="block"><span className="eyebrow">Status</span>
                <select name="editStatus" defaultValue={row?.editStatus ?? "PENDING"} className="select mt-1.5">
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={`${chip} justify-between`}><span>Informed to account manager</span><input type="hidden" name="informedAM_set" value="1" /><input type="checkbox" name="informedAM" defaultChecked={row?.informedAM ?? false} className="h-4 w-4 accent-[var(--violet)]" /></label>
              <label className="block"><select name="posting" defaultValue={row?.posting ?? ""} className="select" aria-label="Posting status"><option value="">Posting — not set</option><option value="PENDING">Posting pending</option><option value="POSTED">Posted</option></select></label>
            </div>
          </div>

          {full && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="eyebrow">Verified by</span><input name="verifiedBy" defaultValue={row?.verifiedBy ?? ""} className="input mt-1.5" /></label>
              <label className="block"><span className="eyebrow">Storage</span><input name="storage" defaultValue={row?.storage ?? ""} placeholder="e.g. 8TB" className="input mt-1.5" /></label>
            </div>
          )}
          <label className="block"><span className="eyebrow">Note (optional)</span><input name="note" maxLength={500} defaultValue={row?.note ?? ""} placeholder="Anything the team should know" className="input mt-1.5" /></label>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div>
              {row && d.canDelete && (
                <button type="submit" formAction={deleteVideoJob} formNoValidate onClick={(e) => { if (!window.confirm(`Delete ${row.clientName} (${fmtDay(row.date)})?`)) e.preventDefault(); }} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] font-bold text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_9%,white)]"><Trash2 size={14} /> Delete</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
              {row && isOpen(row) && <button type="submit" name="complete" value="1" className="btn" style={{ background: "var(--emerald)", color: "white" }}><Check size={15} /> All edited</button>}
              <button type="submit" className="btn btn-violet"><Save size={15} /> Save</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({ close }: { close: () => void }) {
  const [result, action, pending] = useActionState<VideoJobImportResult, FormData>(importVideoJobs, null);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Import client videos sheet</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Loads the “Video Shoots Status” sheet — one row per client shoot.</p>
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
            <label className="block">
              <span className="eyebrow">Client videos file (CSV)</span>
              <input name="file" type="file" accept=".csv,text/csv" required className="input mt-1 !py-1.5 text-[12px]" />
            </label>
            <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
              Columns: <b>Date, Employee Name, Client, Videos Shooted, Video Editing Status, Assigned to Editor, Informed to Account Manager, Posting Done Status, Verified By, Storage</b>.<br />
              A row already in the CRM (same date and client) is replaced, so the same file can be imported again safely.
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
