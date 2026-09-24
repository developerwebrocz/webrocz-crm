"use client";

import { Fragment, useMemo, useState } from "react";
import { createCandidate, setCandidateStage, addCandidateNote, deleteCandidate } from "@/app/recruit-actions";
import { RECRUIT_STAGES, RECRUIT_STAGE_KEYS, RECRUIT_STAGE_TONE, RECRUIT_SOURCES, HIRING_DEPARTMENTS } from "@/lib/domain";
import { Plus, X, Search, StickyNote, Trash2, FileText } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

export default function HiringBoard({ rows, stageCount }: { rows: any[]; stageCount: Record<string, number> }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("ALL");
  const [dept, setDept] = useState("ALL");
  const [modal, setModal] = useState(false);
  const [noteRow, setNoteRow] = useState<string | null>(null);
  const nq = q.trim().toLowerCase();

  const visible = useMemo(() => rows.filter((r) => {
    if (stage !== "ALL" && r.stage !== stage) return false;
    if (dept !== "ALL" && r.department !== dept) return false;
    if (nq && !`${r.name} ${r.position} ${r.phone} ${r.email} ${r.department}`.toLowerCase().includes(nq)) return false;
    return true;
  }), [rows, stage, dept, nq]);
  const depts = useMemo(() => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(), [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">HR · Recruitment</span>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">Hiring Pipeline</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">{rows.length} candidates · {stageCount.HIRED ?? 0} hired</p>
        </div>
        <button onClick={() => setModal(true)} className="btn btn-violet"><Plus size={16} /> New Candidate</button>
      </div>

      {/* KPI per stage */}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {RECRUIT_STAGE_KEYS.map((k) => (
          <button key={k} onClick={() => setStage(stage === k ? "ALL" : k)} className="card px-3.5 py-3 text-left transition hover:shadow-[var(--shadow-sm)]" style={{ borderColor: stage === k ? RECRUIT_STAGE_TONE[k] : undefined, borderWidth: stage === k ? 2 : undefined, background: stage === k ? `color-mix(in srgb, ${RECRUIT_STAGE_TONE[k]} 7%, white)` : undefined }}>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: RECRUIT_STAGE_TONE[k] }}>{RECRUIT_STAGES[k]}</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none tnum">{stageCount[k] ?? 0}</div>
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, position, phone…" className="input !py-2 !pl-9" />
        </div>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="select !w-auto"><option value="ALL">All stages</option>{RECRUIT_STAGE_KEYS.map((k) => <option key={k} value={k}>{RECRUIT_STAGES[k]}</option>)}</select>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="select !w-auto"><option value="ALL">All departments</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        {(stage !== "ALL" || dept !== "ALL" || q) && <button onClick={() => { setStage("ALL"); setDept("ALL"); setQ(""); }} className="btn btn-ghost btn-sm">Clear</button>}
      </div>

      {/* table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[920px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Candidate", "Position", "Department", "Contact", "Exp / CTC", "Resume", "Stage", ""].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {visible.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No candidates. Click <b>New Candidate</b> to add one.</td></tr>}
              {visible.map((r) => (
                <Fragment key={r.id}>
                <tr className="border-b border-[var(--line)] hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3"><div className="text-[13.5px] font-semibold">{r.name}</div><div className="text-[11px] text-[var(--faint)]">{r.code} · {r.source || "—"}</div></td>
                  <td className="px-5 py-3 text-[12.5px]">{r.position || "—"}</td>
                  <td className="px-5 py-3 text-[12.5px] text-[var(--ink-2)]">{r.department || "—"}</td>
                  <td className="px-5 py-3 text-[12px]"><div>{r.phone || "—"}</div><div className="text-[var(--muted)]">{r.email}</div></td>
                  <td className="px-5 py-3 text-[12px]"><div>{r.experience || "—"}</div>{r.expectedCtc > 0 && <div className="text-[var(--muted)] tnum">{inr(r.expectedCtc)}</div>}</td>
                  <td className="px-5 py-3">{r.resumeUrl ? <a href={r.resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--violet)]"><FileText size={12} /> Open</a> : "—"}</td>
                  <td className="px-5 py-3">
                    <form action={setCandidateStage}><input type="hidden" name="id" value={r.id} />
                      <select name="stage" defaultValue={r.stage} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="rounded-md border border-[var(--line-2)] bg-[var(--surface-2)] px-2 py-1 text-[11.5px] font-medium outline-none" style={{ color: RECRUIT_STAGE_TONE[r.stage] }}>
                        {RECRUIT_STAGE_KEYS.map((sk) => <option key={sk} value={sk}>{RECRUIT_STAGES[sk]}</option>)}
                      </select>
                    </form>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setNoteRow(noteRow === r.id ? null : r.id)} title="Note" className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--ink-2)] hover:border-[var(--ink)]"><StickyNote size={13} /></button>
                      <form action={deleteCandidate} onSubmit={(e) => { if (!confirm(`Delete candidate "${r.name}"?`)) e.preventDefault(); }}><input type="hidden" name="id" value={r.id} /><button title="Delete" className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--rose)] hover:border-[var(--rose)]"><Trash2 size={13} /></button></form>
                    </div>
                  </td>
                </tr>
                {noteRow === r.id && (
                  <tr className="border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--violet)_4%,white)]">
                    <td colSpan={8} className="px-5 py-3">
                      {r.notesArr?.length > 0 && <div className="mb-2 space-y-1">{r.notesArr.slice(0, 4).map((nt: any, i: number) => <div key={i} className="text-[12px]"><b>{nt.by}</b> <span className="text-[var(--faint)]">· {nt.date}</span> — {nt.note}</div>)}</div>}
                      <form action={addCandidateNote} className="flex flex-wrap items-center gap-2" onSubmit={() => setNoteRow(null)}><input type="hidden" name="id" value={r.id} />
                        <input name="note" required autoFocus placeholder={`Note for ${r.name}… e.g. Interview on 25th, good fit`} className="input !py-1.5 flex-1 min-w-[240px]" />
                        <button className="btn btn-violet btn-sm">Save note</button>
                        <button type="button" onClick={() => setNoteRow(null)} className="btn btn-ghost btn-sm">Cancel</button>
                      </form>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <NewCandidateModal close={() => setModal(false)} />}
    </div>
  );
}

function NewCandidateModal({ close }: { close: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4"><h2 className="text-[16px] font-bold">New Candidate</h2><button onClick={close} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button></div>
        <form action={createCandidate} className="grid gap-3 overflow-y-auto p-6 scroll-thin sm:grid-cols-2">
          <L label="Name *"><input name="name" required className="input" /></L>
          <L label="Position"><input name="position" placeholder="e.g. Digital Marketing Executive" className="input" /></L>
          <L label="Department"><select name="department" className="select"><option value="">— Select —</option>{HIRING_DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></L>
          <L label="Source"><select name="source" className="select"><option value="">— Select —</option>{RECRUIT_SOURCES.map((sc) => <option key={sc}>{sc}</option>)}</select></L>
          <L label="Phone"><input name="phone" className="input" /></L>
          <L label="Email"><input name="email" type="email" className="input" /></L>
          <L label="Experience"><input name="experience" placeholder="e.g. 2 years" className="input" /></L>
          <L label="Expected CTC (₹)"><input name="expectedCtc" type="number" className="input" /></L>
          <div className="sm:col-span-2"><L label="Resume (PDF / DOC) — upload or link"><input type="file" name="resume" accept=".pdf,.doc,.docx" className="input !py-1.5" /></L></div>
          <div className="sm:col-span-2"><L label="Notes"><textarea name="notes" rows={2} className="textarea" /></L></div>
          <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={close} className="btn btn-ghost">Cancel</button><button className="btn btn-violet">Add Candidate</button></div>
        </form>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="eyebrow">{label}</span><div className="mt-1.5">{children}</div></label>;
}
