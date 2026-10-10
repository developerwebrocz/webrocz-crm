"use client";

import { useActionState, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Upload, X, CheckCircle2, AlertTriangle, Check, Pencil, Trash2, Save, Copy, Crown, Users, ImageIcon, ListChecks, Clock3 } from "lucide-react";
import type { DesignPostingBoardData, DesignPostingRow } from "@/lib/design-posting-queries";
import { saveDesignPosting, deleteDesignPosting, copyDesignWeek, importDesignPostings, type DesignPostingImportResult } from "@/app/design-posting-actions";
import CountStepper from "@/components/CountStepper";
import { initials } from "@/lib/domain";

// Design team "Assigned Postings" — the week's clients for each designer: posts planned for the
// week, done and pending (the designers' Google Sheet). The team lead assigns clients; each
// designer updates how many posts are done.

const SAVED: Record<string, { text: string; ok: boolean }> = {
  "1": { text: "Saved.", ok: true },
  deleted: { text: "Removed.", ok: true },
  copied: { text: "Last week's clients are copied into this week — done starts at 0.", ok: true },
  nocopy: { text: "Nothing copied — this week already has clients, or last week had none.", ok: false },
  bad: { text: "Not saved — choose the designer and type the client.", ok: false },
  denied: { text: "Not saved — this client is not assigned to you.", ok: false },
  gone: { text: "That row no longer exists.", ok: false },
};
const PALETTE = ["#6d28d9", "#0284c7", "#059669", "#d97706", "#e11d48", "#0d9488", "#840a92", "#4f46e5"];
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;

type Editing = { row: DesignPostingRow | null; designerId: string };

export default function DesignPostingsBoard({ d, meId, saved, openAdd = "" }: { d: DesignPostingBoardData; meId: string; saved: string; openAdd?: string }) {
  const [edit, setEdit] = useState<Editing | null>(openAdd && d.lead ? { row: null, designerId: openAdd === "1" ? "" : openAdd } : null);
  const [importing, setImporting] = useState(false);
  const flash = SAVED[saved];
  const ret = `/design-postings?week=${d.week}&saved=1`;
  const pct = d.kpis.target ? Math.min(100, Math.round((d.kpis.done / d.kpis.target) * 100)) : 0;
  const tiles = [
    { label: "Clients this week", value: d.kpis.clients, sub: `${d.kpis.allDone} fully done`, icon: Users, tone: "var(--violet)" },
    { label: "Posts planned", value: d.kpis.target, sub: d.weekLabel, icon: ImageIcon, tone: "var(--sky)" },
    { label: "Posts done", value: d.kpis.done, sub: `${pct}% of planned`, icon: ListChecks, tone: "var(--emerald)", bar: pct },
    { label: "Posts pending", value: d.kpis.pending, sub: d.kpis.pending ? "still to design" : "nothing pending", icon: Clock3, tone: d.kpis.pending ? "var(--amber)" : "var(--emerald)" },
  ];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Design team</div>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Assigned Postings</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{d.lead ? "Every designer’s clients for the week — posts planned, done and pending" : "Your clients for the week — update how many posts are done"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
            <a href={`/design-postings?week=${d.prevWeek}`} className="grid h-9 w-9 place-items-center text-[var(--ink-2)] hover:bg-[var(--surface-2)]" title="Previous week"><ChevronLeft size={16} /></a>
            <span className="inline-flex min-w-[170px] items-center justify-center gap-1.5 px-2 text-[13px] font-bold"><CalendarDays size={14} className="text-[var(--violet)]" /> {d.weekLabel}{d.isThisWeek ? <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-[var(--violet)]" style={{ background: tint("var(--violet)", 12) }}>This week</span> : null}</span>
            {d.nextWeek
              ? <a href={`/design-postings?week=${d.nextWeek}`} className="grid h-9 w-9 place-items-center text-[var(--ink-2)] hover:bg-[var(--surface-2)]" title="Next week"><ChevronRight size={16} /></a>
              : <span className="grid h-9 w-9 place-items-center text-[var(--line-2)]"><ChevronRight size={16} /></span>}
          </div>
          {d.lead && <button type="button" onClick={() => setImporting(true)} className="btn btn-ghost"><Upload size={15} /> Import sheet</button>}
          {d.lead && <button type="button" onClick={() => setEdit({ row: null, designerId: "" })} className="btn btn-violet"><Plus size={15} /> Assign client</button>}
        </div>
      </div>

      {flash && (
        <p className="flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold" style={{ background: tint(flash.ok ? "var(--emerald)" : "var(--rose)", 9), color: flash.ok ? "var(--emerald)" : "var(--rose)" }}>
          {flash.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {flash.text}
        </p>
      )}

      {/* an empty week → start it from last week's list */}
      {d.canCopy && (
        <form action={copyDesignWeek} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-4 py-3" style={{ background: tint("var(--violet)", 5), borderColor: tint("var(--violet)", 25) }}>
          <input type="hidden" name="week" value={d.week} />
          <div className="text-[13px]"><b>This week has no clients yet.</b> Start it with the same designers and clients as last week ({d.prevLabel}) — done starts at 0.</div>
          <button type="submit" className="btn btn-violet btn-sm"><Copy size={14} /> Copy last week’s clients</button>
        </form>
      )}

      {/* figures */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((k) => (
          <div key={k.label} className="card card-pad">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{k.label}</span>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px]" style={{ background: tint(k.tone, 12), color: k.tone }}><k.icon size={15} /></span>
            </div>
            <div className="mt-1.5 text-[28px] font-extrabold leading-none tracking-tight tnum">{k.value}</div>
            {k.bar !== undefined ? <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${k.bar}%`, background: k.tone }} /></div> : null}
            <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* one block per designer, like the sheet */}
      <div className={`grid gap-4 ${d.groups.length > 1 ? "2xl:grid-cols-2" : ""}`}>
        {d.groups.map((g, gi) => {
          const c = PALETTE[gi % PALETTE.length];
          const gp = g.target ? Math.min(100, Math.round((g.done / g.target) * 100)) : 0;
          return (
            <div key={g.id} className="card !p-0 overflow-hidden" style={{ borderTop: `3px solid ${c}` }}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-[12.5px] font-extrabold" style={{ background: tint(c, 14), color: c }}>{initials(g.name)}</span>
                  <div>
                    <div className="flex items-center gap-1.5 text-[14.5px] font-bold">{g.name}{g.id === meId ? <span className="text-[11px] font-semibold text-[var(--muted)]">(me)</span> : null}{g.lead && <span title="Team lead" className="text-[var(--amber)]"><Crown size={13} /></span>}</div>
                    <div className="text-[11.5px] text-[var(--muted)]">{g.rows.length} client{g.rows.length === 1 ? "" : "s"} · {g.done} of {g.target} posts done</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden w-[130px] sm:block"><div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${gp}%`, background: c }} /></div><div className="mt-1 text-right text-[11px] font-bold tnum">{gp}%</div></div>
                  {d.lead && g.active && <button type="button" onClick={() => setEdit({ row: null, designerId: g.id })} className="inline-flex h-8 items-center gap-1 rounded-[9px] border border-dashed border-[var(--line-2)] px-2.5 text-[12px] font-bold text-[var(--violet)] hover:border-[var(--violet)]"><Plus size={13} /> Assign</button>}
                </div>
              </div>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[560px] text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                      <th className="w-10 px-4 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-left">Client</th>
                      <th className="px-2 py-2 text-center">Total post</th>
                      <th className="px-2 py-2 text-center">Done</th>
                      <th className="px-2 py-2 text-center">Pending</th>
                      <th className="px-2 py-2 text-left">Note</th>
                      <th className="px-4 py-2 text-right">Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => {
                      const full = r.target > 0 && r.done >= r.target;
                      return (
                        <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                          <td className="px-4 py-2 text-[var(--muted)] tnum">{i + 1}</td>
                          <td className="max-w-[220px] px-2 py-2"><div className="truncate font-semibold" title={r.clientName}>{r.clientName}</div>{r.monthlyPosts ? <div className="text-[11px] text-[var(--muted)]">{r.monthlyPosts} posts / month</div> : null}</td>
                          <td className="px-2 py-2 text-center font-bold tnum">{r.target || <span className="font-normal text-[var(--line-2)]">—</span>}</td>
                          <td className="px-2 py-2 text-center"><span className="inline-grid h-7 min-w-[34px] place-items-center rounded-[8px] px-2 font-extrabold tnum" style={{ background: full ? tint("var(--emerald)", 13) : r.done ? tint(c, 12) : "var(--surface-2)", color: full ? "var(--emerald)" : r.done ? "var(--ink)" : "var(--muted)" }}>{r.done}</span></td>
                          <td className="px-2 py-2 text-center font-bold tnum" style={{ color: r.pending ? "#b45309" : "var(--line-2)" }}>{r.pending || (r.target ? "0" : "—")}</td>
                          <td className="max-w-[160px] px-2 py-2 text-[12px] text-[var(--ink-2)]"><div className="truncate" title={r.note}>{r.note || <span className="text-[var(--line-2)]">—</span>}</div></td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-1.5">
                              {!full && r.target > 0 && (
                                <form action={saveDesignPosting}>
                                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="complete" value="1" /><input type="hidden" name="return" value={ret} />
                                  <button type="submit" title="All posts done" className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] text-[var(--emerald)] hover:bg-[color-mix(in_srgb,var(--emerald)_10%,white)]"><Check size={15} /></button>
                                </form>
                              )}
                              <button type="button" onClick={() => setEdit({ row: r, designerId: g.id })} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 text-[12px] font-bold hover:bg-[var(--surface-3)]"><Pencil size={13} /> Update</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {g.rows.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-[12.5px] text-[var(--muted)]">No clients assigned for this week{d.lead ? " — use Assign." : "."}</td></tr>}
                  </tbody>
                  {g.rows.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-[var(--line-2)] bg-[var(--surface-2)] text-[13px] font-extrabold">
                        <td className="px-4 py-2.5" colSpan={2}>Total</td>
                        <td className="px-2 py-2.5 text-center tnum">{g.target}</td>
                        <td className="px-2 py-2.5 text-center tnum" style={{ color: c }}>{g.done}</td>
                        <td className="px-2 py-2.5 text-center tnum">{Math.max(0, g.rows.reduce((s, r) => s + r.pending, 0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          );
        })}
        {d.groups.length === 0 && <div className="card card-pad text-center text-[13px] text-[var(--muted)]">No designers found. Add team members with the role Designer in Team.</div>}
      </div>

      {edit && <PostingModal d={d} edit={edit} meId={meId} ret={ret} close={() => setEdit(null)} />}
      {importing && <ImportModal week={d.week} weekLabel={d.weekLabel} close={() => setImporting(false)} />}
    </div>
  );
}

function PostingModal({ d, edit, meId, ret, close }: { d: DesignPostingBoardData; edit: Editing; meId: string; ret: string; close: () => void }) {
  const row = edit.row;
  const full = d.lead; // the lead / admin sets everything; a designer updates done + note
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-bold">{row ? row.clientName : "Assign client"}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Week {d.weekLabel}{row ? ` · ${row.target} post${row.target === 1 ? "" : "s"} planned` : " · which designer does this client’s posts"}</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={saveDesignPosting} className="flex flex-col gap-4 overflow-y-auto p-6">
          {row && <input type="hidden" name="id" value={row.id} />}
          <input type="hidden" name="week" value={d.week} />
          <input type="hidden" name="return" value={ret} />
          {full && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="eyebrow">Designer</span>
                  <select name="userId" required defaultValue={edit.designerId} className="select mt-1.5">
                    <option value="">— Select designer —</option>
                    {d.designers.map((x) => <option key={x.id} value={x.id}>{x.name}{x.id === meId ? " (me)" : ""}</option>)}
                  </select>
                </label>
                <label className="block"><span className="eyebrow">Client</span>
                  <input name="clientName" required list="dp-clients" defaultValue={row?.clientName ?? ""} placeholder="Type or pick the client" autoComplete="off" className="input mt-1.5" />
                  <datalist id="dp-clients">{d.clientNames.map((n) => <option key={n} value={n} />)}</datalist>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="eyebrow">Posts per month</span><input type="number" name="monthlyPosts" min={0} max={999} defaultValue={row?.monthlyPosts || ""} placeholder="e.g. 20" className="input mt-1.5 font-bold tnum" /></label>
                <label className="block"><span className="eyebrow">Total post this week</span><input type="number" name="target" min={0} max={999} defaultValue={row ? row.target : ""} placeholder="empty = a quarter of the month" className="input mt-1.5 font-bold tnum" /></label>
              </div>
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-[190px_1fr]">
            <label className="block"><span className="eyebrow">Posts done{row?.target ? ` (of ${row.target})` : ""}</span><div className="mt-1.5"><CountStepper name="done" defaultValue={row?.done ?? ""} /></div></label>
            <label className="block"><span className="eyebrow">Note (optional)</span><input name="note" maxLength={300} defaultValue={row?.note ?? ""} placeholder="e.g. All done, waiting for content…" className="input mt-1.5" /></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div>
              {row && full && (
                <button type="submit" formAction={deleteDesignPosting} formNoValidate onClick={(e) => { if (!window.confirm(`Remove ${row.clientName} from this week?`)) e.preventDefault(); }} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] font-bold text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_9%,white)]"><Trash2 size={14} /> Remove</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
              {row && row.target > 0 && row.done < row.target && <button type="submit" name="complete" value="1" className="btn" style={{ background: "var(--emerald)", color: "white" }}><Check size={15} /> All done</button>}
              <button type="submit" className="btn btn-violet"><Save size={15} /> Save</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({ close, week, weekLabel }: { close: () => void; week: string; weekLabel: string }) {
  const [result, action, pending] = useActionState<DesignPostingImportResult, FormData>(importDesignPostings, null);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Import assigned postings sheet</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Loads the designers’ sheet into the week <b>{weekLabel}</b>.</p>
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
            <input type="hidden" name="week" value={week} />
            <label className="block">
              <span className="eyebrow">Postings file (CSV)</span>
              <input name="file" type="file" accept=".csv,text/csv" required className="input mt-1 !py-1.5 text-[12px]" />
            </label>
            <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
              Columns: <b>Designer, Client, Monthly posts, Total post, Done, Note</b>.<br />
              A designer + client already in this week is replaced, so the same file can be imported again safely.
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
