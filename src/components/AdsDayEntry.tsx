"use client";

import { useState } from "react";
import { GADS_TYPES, inr, inrShort } from "@/lib/domain";
import { ArrowLeft, ArrowRight, Check, CalendarClock, CircleCheck } from "lucide-react";

type Client = { id: string; name: string; googleBudget: number };
type EntryRow = { name: string; type: string; spent: number; leads: number; conv: number; status: string };

export default function AdsDayEntry({
  clients, selected, date, dateLabel, period, rows, rowCount, action,
}: {
  clients: Client[]; selected: string | null; date: string; dateLabel: string; period: string;
  rows: EntryRow[]; rowCount: number; action: (fd: FormData) => void;
}) {
  const [step, setStep] = useState(1);
  const selectedClient = clients.find((c) => c.id === selected);

  // Live totals / auto-calc for the campaign checklist (display only — inputs stay uncontrolled).
  const [calc, setCalc] = useState(() => rows.map((r) => ({ name: r.name, spent: r.spent || 0, leads: r.leads || 0, conv: r.conv || 0 })));
  const upd = (i: number, field: "name" | "spent" | "leads" | "conv", v: string) =>
    setCalc((c) => c.map((x, j) => (j === i ? { ...x, [field]: field === "name" ? v : Number(v) || 0 } : x)));
  const cpl = (spent: number, leads: number) => (leads > 0 ? Math.round(spent / leads) : 0);
  const convPct = (conv: number, leads: number) => (leads > 0 ? +((conv / leads) * 100).toFixed(1) : 0);
  const active = calc.filter((r) => r.name.trim());
  const totSpent = active.reduce((s, r) => s + r.spent, 0);
  const totLeads = active.reduce((s, r) => s + r.leads, 0);
  const totConv = active.reduce((s, r) => s + r.conv, 0);

  return (
    <>
      {/* stepper */}
      <div className="mt-6 flex items-center gap-2 sm:gap-3">
        <StepPill n={1} label="Client & Date" active={step === 1} done={step > 1} onClick={() => setStep(1)} />
        <div className="h-px w-6 flex-none bg-[var(--line-2)] sm:w-10" />
        <StepPill n={2} label="Campaign List Checklist" active={step === 2} done={false} disabled={!selected} onClick={() => selected && setStep(2)} />
      </div>

      {/* ---- STEP 1 · Client & Date ---- */}
      {step === 1 && (
        <div className="card card-pad mt-5 space-y-6">
          <div>
            <span className="eyebrow">Date</span>
            <div className="mt-1.5 inline-flex items-center gap-2 rounded-xl border border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-2 text-[13px] font-semibold">
              <CalendarClock size={15} className="text-[var(--muted)]" /> {dateLabel}
            </div>
            <p className="mt-1.5 text-[11.5px] text-[var(--muted)]">Daily data is entered for this date. Future dates are not allowed.</p>
          </div>
          <div>
            <span className="eyebrow">Client *</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {clients.map((c) => (
                <a key={c.id} href={`/google-ads/entry?client=${c.id}&period=${period}`}
                  className={`rounded-xl border px-3 py-2 text-[13px] font-semibold transition ${c.id === selected ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_8%,white)] text-[var(--violet)]" : "border-[var(--line-2)] hover:border-[var(--ink)]"}`}>
                  {c.name} <span className="text-[var(--faint)]">· {inrShort(c.googleBudget)}/mo</span>
                </a>
              ))}
            </div>
            {selectedClient && <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--emerald)]"><CircleCheck size={14} /> {selectedClient.name} selected</p>}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => setStep(2)} disabled={!selected} className="btn btn-violet disabled:opacity-50">Continue to campaigns <ArrowRight size={15} /></button>
          </div>
        </div>
      )}

      {/* ---- STEP 2 · Campaign List Checklist ---- */}
      {step === 2 && (
        <form action={action} className="card !p-0 mt-5 overflow-hidden">
          <input type="hidden" name="clientId" value={selected ?? ""} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="period" value={period} />
          <input type="hidden" name="rows" value={rowCount} />

          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
            <div>
              <div className="text-[15px] font-bold">{selectedClient?.name}</div>
              <div className="text-[12px] text-[var(--muted)]">{dateLabel} · leave a row&apos;s campaign name blank to skip it</div>
            </div>
            <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Back</button>
          </div>

          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[860px] text-left">
              <thead><tr className="border-b border-[var(--line)]">{["Campaign name", "Type", "Spent (₹)", "Leads", "Conv", "CPL auto", "Conv% auto", "Status"].map((h) => <th key={h} className="th px-4 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const c = calc[i] ?? { spent: 0, leads: 0, conv: 0 };
                  const hasName = (c.name ?? r.name).trim().length > 0;
                  return (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-2"><input name={`name_${i}`} defaultValue={r.name} onChange={(e) => upd(i, "name", e.target.value)} placeholder="e.g. Search - Brand" className="w-full min-w-[180px] rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--violet)]" /></td>
                    <td className="px-4 py-2">
                      <select name={`type_${i}`} defaultValue={r.type} className="rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-2 py-2 text-[13px] outline-none focus:border-[var(--violet)]">
                        {Object.entries(GADS_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2"><input name={`spent_${i}`} type="number" min={0} defaultValue={r.spent || ""} onChange={(e) => upd(i, "spent", e.target.value)} className="w-24 rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] tnum outline-none focus:border-[var(--violet)]" /></td>
                    <td className="px-4 py-2"><input name={`leads_${i}`} type="number" min={0} defaultValue={r.leads || ""} onChange={(e) => upd(i, "leads", e.target.value)} className="w-20 rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] tnum outline-none focus:border-[var(--violet)]" /></td>
                    <td className="px-4 py-2"><input name={`conv_${i}`} type="number" min={0} defaultValue={r.conv || ""} onChange={(e) => upd(i, "conv", e.target.value)} className="w-20 rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] tnum outline-none focus:border-[var(--violet)]" /></td>
                    <td className="px-4 py-2 text-[13px] tnum text-[var(--muted)]">{hasName && c.leads > 0 ? inr(cpl(c.spent, c.leads)) : "—"}</td>
                    <td className="px-4 py-2 text-[13px] tnum text-[var(--muted)]">{hasName && c.leads > 0 ? `${convPct(c.conv, c.leads)}%` : "—"}</td>
                    <td className="px-4 py-2">
                      <select name={`status_${i}`} defaultValue={r.status} className="rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-2 py-2 text-[13px] outline-none focus:border-[var(--violet)]">
                        <option value="ACTIVE">Active</option>
                        <option value="PAUSED">Paused</option>
                      </select>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--line)] bg-[var(--surface-2)] font-bold">
                  <td className="px-4 py-3 text-[13px]">Total · {active.length} campaign{active.length === 1 ? "" : "s"}</td>
                  <td />
                  <td className="px-4 py-3 text-[13px] tnum">{inr(totSpent)}</td>
                  <td className="px-4 py-3 text-[13px] tnum">{totLeads}</td>
                  <td className="px-4 py-3 text-[13px] tnum">{totConv}</td>
                  <td className="px-4 py-3 text-[13px] tnum">{totLeads > 0 ? inr(cpl(totSpent, totLeads)) : "—"}</td>
                  <td className="px-4 py-3 text-[13px] tnum">{totLeads > 0 ? `${convPct(totConv, totLeads)}%` : "—"}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-4">
            <a href={`/google-ads?period=${period}`} className="rounded-xl border border-[var(--line-2)] px-4 py-2 text-[13px] font-semibold hover:border-[var(--ink)]">Cancel</a>
            <button type="submit" className="btn btn-violet"><Check size={15} /> Save daily data</button>
          </div>
        </form>
      )}
    </>
  );
}

function StepPill({ n, label, active, done, disabled, onClick }: { n: number; label: string; active: boolean; done: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_8%,white)] text-[var(--violet)]" : done ? "border-[var(--emerald)]/40 text-[var(--emerald)]" : "border-[var(--line-2)] text-[var(--muted)]"}`}>
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${active ? "bg-[var(--violet)] text-white" : done ? "bg-[var(--emerald)] text-white" : "bg-[var(--surface-3)] text-[var(--muted)]"}`}>
        {done ? <Check size={12} /> : n}
      </span>
      Step {n} · {label}
    </button>
  );
}
