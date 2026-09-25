"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { createLead, setLeadStage, addLeadNote, deleteLead } from "@/app/sales-actions";
import { SALES_STAGES, SALES_STAGE_KEYS, FUNNEL_KEYS, SALES_STAGE_TONE, serviceGroupsFor, LEAD_SOURCES, serviceKind } from "@/lib/domain";
import { Search, Plus, X, ArrowRight, LayoutGrid, List, Filter, Download, StickyNote, Trash2 } from "lucide-react";

type Row = {
  id: string; code: string; name: string; company: string; contact: string; phone: string; email: string;
  source: string; services: string[]; value: number; stage: string; owner: string; ownerId: string | null;
  pipeline: string; createdAt: string; updatedAt: string;
};
type Exec = { id: string; name: string };

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const initials = (nm: string) => (nm || "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

type Reminder = { id: string; leadId: string; leadName: string; company: string; pipeline: string; date: string; time: string; type: string; notes: string; overdue: boolean };
export default function SalesWorkspace({
  rows, dueReminders = [], upcomingReminders = [], execs, canPickExec, pipeline: initialPipeline, initialStage = "ALL", initialCategory = "ALL",
}: {
  rows: Row[]; dueReminders?: Reminder[]; upcomingReminders?: Reminder[]; execs: Exec[];
  canPickExec: boolean; myId: string; pipeline: string; initialStage?: string; initialCategory?: string;
}) {
  const [pipeline] = useState(initialPipeline || "WEBROCZ");
  const [q, setQ] = useState("");
  const [exec, setExec] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [category, setCategory] = useState(initialCategory || "ALL"); // ALL | WEBSITE | DM
  const [stage, setStage] = useState(initialStage || "ALL");
  // Sidebar links change the URL (?stage=… / ?category=…) via SPA navigation — keep the table
  // filters in sync at render time (no setState-in-effect) so each nav item scopes the list.
  const [prevNav, setPrevNav] = useState(`${initialCategory}|${initialStage}`);
  const navSig = `${initialCategory}|${initialStage}`;
  if (prevNav !== navSig) { setPrevNav(navSig); setCategory(initialCategory || "ALL"); setStage(initialStage || "ALL"); }
  const [range, setRange] = useState("ALL");
  const [month, setMonth] = useState("");
  const [view, setView] = useState<"board" | "list" | "funnel">("list");
  const [modal, setModal] = useState(false);
  const [noteRow, setNoteRow] = useState<string | null>(null);

  // Show the full known source list plus any custom sources already present in the leads,
  // so the filter is always usable even when the current leads have no source set.
  const sourceOptions = useMemo(() => {
    const present = rows.filter((r) => r.pipeline === pipeline).map((r) => r.source).filter(Boolean);
    return [...new Set([...LEAD_SOURCES, ...present])];
  }, [rows, pipeline]);

  const inRange = (created: string) => {
    if (range === "ALL") return true;
    const t = new Date(); const todayStr = t.toISOString().slice(0, 10);
    if (range === "TODAY") return created === todayStr;
    if (range === "MONTH") return created.slice(0, 7) === todayStr.slice(0, 7);
    const days = range === "7" ? 7 : 30;
    const diff = (t.getTime() - new Date(created + "T00:00:00").getTime()) / 86400000;
    return diff >= 0 && diff <= days;
  };

  // base filter = everything EXCEPT stage (KPI counts use this so per-stage counts stay real)
  const baseFiltered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.pipeline !== pipeline) return false;
      if (exec !== "ALL" && r.ownerId !== exec) return false;
      if (source !== "ALL" && r.source !== source) return false;
      if (category !== "ALL") { const k = serviceKind(r.services); if (category === "WEBSITE" && !k.web) return false; if (category === "DM" && !k.dm) return false; }
      if (month && r.createdAt.slice(0, 7) !== month) return false;
      if (!inRange(r.createdAt)) return false;
      if (n && !(r.name.toLowerCase().includes(n) || r.company.toLowerCase().includes(n) || r.code.toLowerCase().includes(n) || r.phone.includes(n) || r.contact.toLowerCase().includes(n))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, pipeline, q, exec, source, category, range, month]);

  // "All stages" = every lead; a specific stage (incl. "Leads" = Positive) = just that stage.
  const visible = useMemo(() => baseFiltered.filter((r) =>
    stage === "ALL" ? true : r.stage === stage
  ), [baseFiltered, stage]);

  // stage counts from the base set so every KPI shows its true count
  const vStageCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of baseFiltered) m[r.stage] = (m[r.stage] ?? 0) + 1;
    return m;
  }, [baseFiltered]);

  // header totals + reminders, all for the selected pipeline (client-side = instant switch)
  const totals = useMemo(() => ({
    total: baseFiltered.length,
    activeValue: baseFiltered.filter((r) => r.stage !== "LOST").reduce((s, r) => s + r.value, 0),
    wonValue: baseFiltered.filter((r) => r.stage === "ONBOARDED").reduce((s, r) => s + r.value, 0),
  }), [baseFiltered]);

  // reminder count per day (for the Reminder stage view)
  const reminderDays = useMemo(() => {
    const all = [...dueReminders, ...upcomingReminders].filter((r) => r.pipeline === pipeline);
    const today = new Date().toISOString().slice(0, 10);
    const byDay: Record<string, { date: string; count: number; overdue: boolean; today: boolean }> = {};
    for (const r of all) { const d = (byDay[r.date] ??= { date: r.date, count: 0, overdue: r.date < today, today: r.date === today }); d.count++; }
    return Object.values(byDay).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [dueReminders, upcomingReminders, pipeline]);
  const reminderTotal = reminderDays.reduce((s, d) => s + d.count, 0);

  const funnelMax = Math.max(1, ...FUNNEL_KEYS.map((k) => vStageCount[k] ?? 0));
  const filtersOn = exec !== "ALL" || source !== "ALL" || category !== "ALL" || stage !== "ALL" || range !== "ALL" || month !== "" || q.trim() !== "";
  const resetFilters = () => { setExec("ALL"); setSource("ALL"); setCategory("ALL"); setStage("ALL"); setRange("ALL"); setMonth(""); setQ(""); };
  const downloadCsv = () => {
    const head = ["Code", "Name", "Company", "Contact", "Phone", "Email", "Source", "Category", "Services", "Value", "Stage", "Owner", "Created"];
    const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const catLabel = (svs: string[]) => { const k = serviceKind(svs); return [k.web ? "Website" : "", k.dm ? "Digital Marketing" : ""].filter(Boolean).join(" + "); };
    const lines = [head.join(",")];
    for (const r of visible) lines.push([r.code, r.name, r.company, r.contact, r.phone, r.email, r.source, catLabel(r.services), r.services.join("; "), r.value, SALES_STAGES[r.stage as keyof typeof SALES_STAGES] ?? r.stage, r.owner, r.createdAt].map(esc).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads-${pipeline}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* branded header band */}
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--violet) 10%, white), color-mix(in srgb, var(--magenta) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-[20px] font-black text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--magenta), var(--violet))" }}>W</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">Web Rocz</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">Sales CRM</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{totals.total} leads · <b className="text-[var(--ink-2)]">{inr(totals.activeValue)}</b> in pipeline · <b style={{ color: "var(--emerald)" }}>{inr(totals.wonValue)}</b> won</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={() => setModal(true)} className="btn btn-violet"><Plus size={16} /> New Lead</button>
          </div>
        </div>
      </div>

      {/* view title — Leads dashboard, or the specific stage opened from the sidebar */}
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage === "ALL" ? "var(--sky)" : SALES_STAGE_TONE[stage] }} />
        <h2 className="text-[18px] font-bold tracking-tight">{stage === "ALL" ? "All stages" : (SALES_STAGES[stage as keyof typeof SALES_STAGES] ?? stage)}</h2>
        <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[12px] font-bold tnum text-[var(--ink-2)]">{visible.length}</span>
      </div>

      {/* Reminder stage — day-wise reminder count */}
      {stage === "REMINDER" && reminderTotal > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5">
          <span className="text-[12.5px] font-bold text-[var(--ink-2)]">Reminders ({reminderTotal}):</span>
          {reminderDays.map((d) => (
            <span key={d.date} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: d.overdue ? "color-mix(in srgb,var(--rose) 12%,white)" : d.today ? "color-mix(in srgb,var(--amber) 15%,white)" : "color-mix(in srgb,var(--violet) 10%,white)", color: d.overdue ? "var(--rose)" : d.today ? "#92600a" : "var(--violet)" }}>
              {d.date}{d.today ? " (today)" : d.overdue ? " (overdue)" : ""} · <b className="tnum">{d.count}</b>
            </span>
          ))}
        </div>
      )}

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[300px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lead, company, phone…" className="input !py-2 !pl-9" />
        </div>
        <div className="relative">
          <Filter size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <select value={exec} onChange={(e) => setExec(e.target.value)} className="select !w-auto !pl-8" title="Employee"><option value="ALL">All employees</option>{execs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value)} className="select !w-auto" title="Created date"><option value="ALL">All dates</option><option value="TODAY">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="MONTH">This month</option></select>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="select !w-auto" title="Filter by month" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="select !w-auto" title="Category"><option value="ALL">All categories</option><option value="WEBSITE">Website Development</option><option value="DM">Digital Marketing</option></select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="select !w-auto"><option value="ALL">All stages</option>{SALES_STAGE_KEYS.map((k) => <option key={k} value={k}>{SALES_STAGES[k]}</option>)}</select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="select !w-auto"><option value="ALL">All sources</option>{sourceOptions.map((sv) => <option key={sv} value={sv}>{sv}</option>)}</select>
        {filtersOn && <button onClick={resetFilters} className="btn btn-ghost btn-sm">Clear</button>}
        <button onClick={downloadCsv} className="btn btn-ghost btn-sm"><Download size={14} /> Export</button>
        <div className="ml-auto inline-flex rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface)] p-0.5">
          {([["list", List, "Table"], ["board", LayoutGrid, "Board"], ["funnel", ArrowRight, "Funnel"]] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)} className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition ${view === v ? "bg-[var(--ink)] text-white" : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"}`}><Icon size={14} /> {label}</button>
          ))}
        </div>
      </div>

      {/* ---- PIPELINE (Kanban) ---- */}
      {view === "board" && (
        <div className="overflow-x-auto scroll-thin pb-2">
          <div className="flex gap-3" style={{ minWidth: "max-content" }}>
            {SALES_STAGE_KEYS.map((k) => {
              const items = visible.filter((r) => r.stage === k);
              const val = items.reduce((s, r) => s + r.value, 0);
              const tone = SALES_STAGE_TONE[k];
              return (
                <div key={k} className="flex w-[270px] flex-none flex-col rounded-[12px] border border-[var(--line)] bg-[var(--surface-2)]">
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2.5">
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: tone }} /><span className="text-[12.5px] font-bold">{SALES_STAGES[k]}</span></div>
                    <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[11px] font-bold tnum text-[var(--ink-2)]">{items.length}</span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto scroll-thin p-2" style={{ maxHeight: "calc(100vh - 340px)", minHeight: 80 }}>
                    {items.map((r) => (
                      <div key={r.id} className="rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] p-3 shadow-[var(--shadow-xs)]" style={{ borderLeft: `3px solid ${tone}` }}>
                        <a href={`/sales/${r.id}`} className="block text-[13px] font-semibold leading-snug hover:text-[var(--violet)]">{r.name}</a>
                        {r.company && <div className="mt-0.5 text-[11px] text-[var(--faint)]">{r.company}</div>}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[13px] font-bold tnum">{r.value ? inr(r.value) : "—"}</span>
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-3)] text-[10px] font-bold text-[var(--ink-2)]" title={r.owner}>{initials(r.owner)}</span>
                        </div>
                        {r.services.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{r.services.slice(0, 2).map((sv) => <span key={sv} className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">{sv}</span>)}{r.services.length > 2 && <span className="text-[10px] text-[var(--faint)]">+{r.services.length - 2}</span>}</div>}
                        <form action={setLeadStage} className="mt-2">
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="from" value="board" />
                          <select name="stage" defaultValue={r.stage} onChange={(e) => { const v = e.target.value; if (v === "ONBOARDED") { window.location.assign(`/sales/${r.id}?do=onboard`); } else if (v === "LOST") { window.location.assign(`/sales/${r.id}?do=lost`); } else { e.currentTarget.form?.requestSubmit(); } }} className="w-full rounded-md border border-[var(--line-2)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-medium text-[var(--ink-2)] outline-none">
                            {SALES_STAGE_KEYS.map((sk) => <option key={sk} value={sk}>{SALES_STAGES[sk]}</option>)}
                          </select>
                        </form>
                      </div>
                    ))}
                    {items.length === 0 && <div className="rounded-[8px] border border-dashed border-[var(--line-2)] py-6 text-center text-[11px] text-[var(--faint)]">Empty</div>}
                    {items.length > 0 && <div className="pt-1 text-center text-[10.5px] font-semibold text-[var(--faint)] tnum">{inr(val)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- LIST ---- */}
      {view === "list" && (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[860px] text-left">
              <thead><tr className="border-b border-[var(--line)]">{["Lead", "Contact", "Stage", "Services", "Value", "Owner", "Updated", ""].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {visible.map((r) => (
                  <Fragment key={r.id}>
                  <tr className="border-b border-[var(--line)] hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3"><Link href={`/sales/${r.id}`} prefetch className="text-[13.5px] font-semibold hover:text-[var(--violet)]">{r.name}</Link><div className="text-[11px] text-[var(--faint)]">{r.code}{r.company ? ` · ${r.company}` : ""}</div></td>
                    <td className="px-5 py-3 text-[12.5px] text-[var(--ink-2)]"><div>{r.contact || "—"}</div><div className="text-[11px] text-[var(--muted)] tnum">{r.phone}</div></td>
                    <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: `color-mix(in srgb, ${SALES_STAGE_TONE[r.stage]} 12%, white)`, color: SALES_STAGE_TONE[r.stage] }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: SALES_STAGE_TONE[r.stage] }} />{SALES_STAGES[r.stage as keyof typeof SALES_STAGES] ?? r.stage}</span></td>
                    <td className="px-5 py-3 text-[11.5px] text-[var(--muted)]"><CategoryChip services={r.services} /><div className="mt-1">{r.services.slice(0, 2).join(", ")}{r.services.length > 2 ? ` +${r.services.length - 2}` : ""}</div></td>
                    <td className="px-5 py-3 text-[13px] font-semibold tnum">{r.value ? inr(r.value) : "—"}</td>
                    <td className="px-5 py-3 text-[12.5px]">{r.owner}</td>
                    <td className="px-5 py-3 text-[12px] text-[var(--muted)] tnum">{r.updatedAt}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setNoteRow(noteRow === r.id ? null : r.id)} title="Add note" className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] font-semibold ${noteRow === r.id ? "border-[var(--violet)] text-[var(--violet)]" : "border-[var(--line-2)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}><StickyNote size={13} /> Note</button>
                        <form action={setLeadStage} title="Move stage">
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="from" value="board" />
                          <select name="stage" defaultValue={r.stage} onChange={(e) => { const v = e.target.value; if (v === "ONBOARDED") { window.location.assign(`/sales/${r.id}?do=onboard`); } else if (v === "LOST") { window.location.assign(`/sales/${r.id}?do=lost`); } else { e.currentTarget.form?.requestSubmit(); } }} className="rounded-md border border-[var(--line-2)] bg-[var(--surface-2)] px-2 py-1 text-[11.5px] font-medium text-[var(--ink-2)] outline-none">
                            {SALES_STAGE_KEYS.map((sk) => <option key={sk} value={sk}>{SALES_STAGES[sk]}</option>)}
                          </select>
                        </form>
                        <Link href={`/sales/${r.id}`} prefetch className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--violet)]">Open <ArrowRight size={13} /></Link>
                        <form action={deleteLead} onSubmit={(e) => { if (!confirm(`Delete lead "${r.name}"? This cannot be undone.`)) e.preventDefault(); }}>
                          <input type="hidden" name="id" value={r.id} />
                          <button title="Delete lead" className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--rose)] hover:border-[var(--rose)]"><Trash2 size={13} /></button>
                        </form>
                      </div>
                    </td>
                  </tr>
                  {noteRow === r.id && (
                    <tr className="border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--violet)_4%,white)]">
                      <td colSpan={8} className="px-5 py-3">
                        <form action={addLeadNote} className="flex flex-wrap items-center gap-2" onSubmit={() => setNoteRow(null)}>
                          <input type="hidden" name="leadId" value={r.id} /><input type="hidden" name="from" value="list" />
                          <StickyNote size={14} className="text-[var(--violet)]" />
                          <input name="note" required autoFocus placeholder={`Note for ${r.name}… e.g. Call on 25th`} className="input !py-1.5 flex-1 min-w-[220px]" />
                          <span className="text-[11.5px] font-semibold text-[var(--muted)]">Remind:</span>
                          <input name="remindDate" type="date" className="input !py-1.5 !w-auto" title="Set a follow-up reminder date" />
                          <button className="btn btn-violet btn-sm">Save</button>
                          <button type="button" onClick={() => setNoteRow(null)} className="btn btn-ghost btn-sm">Cancel</button>
                        </form>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
                {visible.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No leads match. Click <b>New Lead</b> to add one.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- FUNNEL ---- */}
      {view === "funnel" && (
        <div className="card card-pad">
          <h2 className="text-[14px] font-bold">Sales Funnel</h2>
          <div className="mt-3 space-y-1.5">
            {FUNNEL_KEYS.map((k) => {
              const v = vStageCount[k] ?? 0;
              return (
                <div key={k} className="flex items-center gap-3">
                  <div className="w-[130px] flex-none text-[12.5px] font-medium text-[var(--ink-2)]">{SALES_STAGES[k]}</div>
                  <div className="h-7 flex-1 overflow-hidden rounded-md bg-[var(--surface-2)]">
                    <div className="flex h-full items-center rounded-md px-2 text-[11.5px] font-bold text-white" style={{ width: `${Math.max(6, (v / funnelMax) * 100)}%`, background: SALES_STAGE_TONE[k] }}>{v}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal && <NewLeadModal execs={execs} canPickExec={canPickExec} pipeline={pipeline} close={() => setModal(false)} />}
    </div>
  );
}

function NewLeadModal({ execs, canPickExec, pipeline, close }: { execs: Exec[]; canPickExec: boolean; pipeline: string; close: () => void }) {
  const groups = serviceGroupsFor(pipeline);
  const dh = pipeline === "DIGITALHAT";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4"><h2 className="text-[16px] font-bold">New Positive Lead</h2><button onClick={close} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button></div>
        <form action={createLead} className="flex flex-col gap-4 overflow-y-auto p-6 scroll-thin">
          <input type="hidden" name="pipeline" value={pipeline} />
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Lead Name *"><input name="name" required className="input" /></L>
            <L label="Company"><input name="company" className="input" /></L>
            <L label="Contact Person"><input name="contactPerson" className="input" /></L>
            <L label="Phone"><input name="phone" className="input" /></L>
            <L label="WhatsApp"><input name="whatsapp" className="input" /></L>
            <L label="Email"><input name="email" type="email" className="input" /></L>
            <L label="Lead Source"><select name="source" className="select"><option value="">— Select —</option>{LEAD_SOURCES.map((x) => <option key={x} value={x}>{x}</option>)}</select></L>
            <L label="Lead Value / Budget (₹)"><input name="value" type="number" className="input" /></L>
            {canPickExec && <L label="Assign Sales Executive"><select name="assignedToId" className="select"><option value="">— Me —</option>{execs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></L>}
          </div>
          <div>
            <span className="eyebrow">{dh ? "Interested Courses / Programs (multi-select)" : "Interested Services (multi-select)"}</span>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {Object.entries(groups).map(([grp, list]) => (
                <div key={grp} className="rounded-[10px] border border-[var(--line)] p-3">
                  <div className="mb-1.5 text-[11.5px] font-bold text-[var(--ink-2)]">{grp}</div>
                  <div className="grid gap-1">{list.map((sv) => <label key={sv} className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)]"><input type="checkbox" name="services" value={sv} className="accent-[var(--violet)]" /> {sv}</label>)}</div>
                </div>
              ))}
            </div>
          </div>
          <L label="Notes"><textarea name="notes" rows={2} className="textarea" /></L>
          <div className="flex items-center justify-end gap-2 pt-1"><button type="button" onClick={close} className="btn btn-ghost">Cancel</button><button type="submit" className="btn btn-violet">Create Lead</button></div>
        </form>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="eyebrow">{label}</span><div className="mt-1.5">{children}</div></label>;
}

// Website / Digital Marketing category chip, derived from the lead's services.
function CategoryChip({ services }: { services: string[] }) {
  const k = serviceKind(services);
  const chips: { label: string; color: string }[] = [];
  if (k.web) chips.push({ label: "Website", color: "var(--indigo)" });
  if (k.dm) chips.push({ label: "Digital Marketing", color: "var(--magenta)" });
  if (chips.length === 0) return null;
  return <span className="flex flex-wrap gap-1">{chips.map((c) => <span key={c.label} className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `color-mix(in srgb, ${c.color} 12%, white)`, color: c.color }}>{c.label}</span>)}</span>;
}
