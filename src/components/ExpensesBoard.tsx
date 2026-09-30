"use client";

import { useState } from "react";
import Link from "next/link";
import { companyLabel } from "@/lib/domain";
import { addExpense, deleteExpense } from "@/app/actions";
import { Wallet, Plus, Trash2, X, CalendarClock } from "lucide-react";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmtD = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const coLabel = (k: string) => (k ? companyLabel(k) : "General / shared");
const CATEGORIES = ["Salaries", "Ads Spend", "Tools/Software", "Rent", "Utilities", "Marketing", "Contractor", "Misc"];

type Exp = { rows: { id: string; company: string; category: string; vendor: string; amount: number; date: string; notes: string; by: string }[]; total: number; count: number; byCategory: { category: string; amount: number }[] };

export default function ExpensesBoard({ expenses, canDelete }: { expenses: Exp; canDelete?: boolean }) {
  const [addOpen, setAddOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = expenses.rows.filter((e) => (e.date || "").startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Expenses</h1>
          <p className="text-[13px] text-[var(--muted)]">Record business expenses — salaries, ad spend, tools, rent and more.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAddOpen(true)} className="btn btn-violet"><Plus size={16} /> Add expense</button>
          <Link href="/" prefetch className="btn btn-ghost">← Dashboard</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Total expenses" value={inr(expenses.total)} tone="var(--amber)" icon={<Wallet size={16} />} />
        <Kpi label="This month" value={inr(monthTotal)} tone="var(--rose)" icon={<CalendarClock size={16} />} />
        <Kpi label="Entries" value={String(expenses.count)} />
      </div>

      {expenses.byCategory.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--line)] px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">By category</span>
          {expenses.byCategory.map((c) => <span key={c.category} className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--ink-2)]">{c.category}: {inr(c.amount)}</span>)}
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3"><h2 className="text-[14px] font-bold">All expenses ({expenses.count})</h2></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
              <th className="th px-5 py-2.5">Date</th><th className="th px-5 py-2.5">Category</th><th className="th px-5 py-2.5">Company</th><th className="th px-5 py-2.5">Vendor / note</th><th className="th px-5 py-2.5">By</th><th className="th px-5 py-2.5 text-right">Amount</th><th className="th px-5 py-2.5"></th>
            </tr></thead>
            <tbody>
              {expenses.rows.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-[var(--muted)]">No expenses yet. Click “Add expense”.</td></tr>}
              {expenses.rows.map((e) => (
                <tr key={e.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 tnum">{fmtD(e.date)}</td>
                  <td className="px-5 py-3"><span className="rounded-full bg-[color-mix(in_srgb,var(--amber)_12%,white)] px-2 py-0.5 text-[11px] font-bold text-[var(--amber)]">{e.category || "Misc"}</span></td>
                  <td className="px-5 py-3 text-[12px] text-[var(--ink-2)]">{coLabel(e.company)}</td>
                  <td className="px-5 py-3 text-[12.5px]">{e.vendor || "—"}{e.notes ? <span className="text-[var(--faint)]"> · {e.notes}</span> : ""}</td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted)]">{e.by || "—"}</td>
                  <td className="px-5 py-3 text-right font-semibold tnum">{inr(e.amount)}</td>
                  <td className="px-5 py-3 text-right">{canDelete && <button onClick={() => setDelId(e.id)} title="Delete" className="text-[var(--rose)] hover:opacity-70"><Trash2 size={14} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && <AddExpenseModal close={() => setAddOpen(false)} />}
      {delId && <DeleteExpenseModal id={delId} close={() => setDelId(null)} />}
    </div>
  );
}

function AddExpenseModal({ close }: { close: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-[480px] overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <h2 className="text-[16px] font-bold">Add expense</h2>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={addExpense} className="space-y-3 px-6 py-5">
          <input type="hidden" name="return" value="/expenses" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Category</span><select name="category" defaultValue="Misc" className="select mt-1">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="block"><span className="eyebrow">Amount (₹) *</span><input name="amount" type="number" min={1} required className="input mt-1" placeholder="0" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Company</span><select name="company" defaultValue="" className="select mt-1"><option value="">General / shared</option><option value="WEB_SOLUTIONS">Web Solutions</option><option value="WEB_ROCZ">Web Rocz</option><option value="WEB_ROCZ_PVT">Web Rocz Pvt Ltd</option></select></label>
            <label className="block"><span className="eyebrow">Date</span><input name="date" type="date" defaultValue={today} className="input mt-1" /></label>
          </div>
          <label className="block"><span className="eyebrow">Vendor / paid to</span><input name="vendor" className="input mt-1" placeholder="e.g. Google Ads, Office rent" /></label>
          <label className="block"><span className="eyebrow">Notes</span><input name="notes" className="input mt-1" placeholder="optional" /></label>
          <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={close} className="btn btn-ghost">Cancel</button><button type="submit" className="btn btn-violet"><Plus size={15} /> Add expense</button></div>
        </form>
      </div>
    </div>
  );
}

function DeleteExpenseModal({ id, close }: { id: string; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-[380px] overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5"><h2 className="text-[16px] font-bold">Delete this expense?</h2><p className="mt-1 text-[12.5px] text-[var(--muted)]">This cannot be undone.</p></div>
        <form action={deleteExpense} className="flex justify-end gap-2 border-t border-[var(--line)] px-6 py-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="return" value="/expenses" />
          <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
          <button type="submit" className="btn btn-sm" style={{ background: "var(--rose)", color: "#fff" }}><Trash2 size={14} /> Delete</button>
        </form>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div>
      <div className="mt-1.5 text-[20px] font-extrabold tnum" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}
