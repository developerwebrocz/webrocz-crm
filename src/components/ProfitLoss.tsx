"use client";

import { useState } from "react";
import Link from "next/link";
import { companyLabel } from "@/lib/domain";
import { addExpense, deleteExpense } from "@/app/actions";
import { TrendingUp, TrendingDown, Wallet, IndianRupee, ReceiptText, Plus, Trash2, X, Building2 } from "lucide-react";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const monthName = (m: string) => { const [y, mo] = (m || "").split("-"); return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(mo, 10) - 1] ?? mo} ${y}`; };
const fmtD = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const coLabel = (k: string) => (k === "GENERAL" ? "General / shared" : companyLabel(k));

const CATEGORIES = ["Salaries", "Ads Spend", "Tools/Software", "Rent", "Utilities", "Marketing", "Contractor", "Misc"];

type PL = { companies: { company: string; billed: number; received: number; expenses: number; profit: number }[]; monthly: { month: string; billed: number; received: number; expenses: number; profit: number }[]; totals: { billed: number; received: number; expenses: number; profit: number } };
type Exp = { rows: { id: string; company: string; category: string; vendor: string; amount: number; date: string; notes: string; by: string }[]; total: number; count: number; byCategory: { category: string; amount: number }[] };

export default function ProfitLoss({ pl, expenses, canDelete }: { pl: PL; expenses: Exp; canDelete?: boolean }) {
  const [addOpen, setAddOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const profitTone = pl.totals.profit >= 0 ? "var(--emerald)" : "var(--rose)";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Profit &amp; Loss</h1>
          <p className="text-[13px] text-[var(--muted)]">Income (collected) minus expenses — company-wise, across all billing entities.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAddOpen(true)} className="btn btn-violet"><Plus size={16} /> Add expense</button>
          <Link href="/" prefetch className="btn btn-ghost">← Dashboard</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Billed" value={inr(pl.totals.billed)} icon={<ReceiptText size={16} />} />
        <Kpi label="Collected (income)" value={inr(pl.totals.received)} tone="var(--emerald)" icon={<IndianRupee size={16} />} />
        <Kpi label="Expenses" value={inr(pl.totals.expenses)} tone="var(--amber)" icon={<Wallet size={16} />} />
        <Kpi label="Net profit" value={inr(pl.totals.profit)} tone={profitTone} icon={pl.totals.profit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} />
      </div>

      {/* Company-wise P&L */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3"><h2 className="text-[14px] font-bold">Company-wise Profit &amp; Loss</h2></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
              <th className="th px-5 py-2.5">Company</th><th className="th px-5 py-2.5 text-right">Billed</th><th className="th px-5 py-2.5 text-right">Collected</th><th className="th px-5 py-2.5 text-right">Expenses</th><th className="th px-5 py-2.5 text-right">Net profit</th>
            </tr></thead>
            <tbody>
              {pl.companies.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-[var(--muted)]">No data yet.</td></tr>}
              {pl.companies.map((c) => (
                <tr key={c.company} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-5 py-3 font-semibold"><span className="inline-flex items-center gap-2"><Building2 size={14} className="text-[var(--muted)]" /> {coLabel(c.company)}</span></td>
                  <td className="px-5 py-3 text-right tnum">{inr(c.billed)}</td>
                  <td className="px-5 py-3 text-right tnum text-[var(--emerald)]">{inr(c.received)}</td>
                  <td className="px-5 py-3 text-right tnum text-[var(--amber)]">{inr(c.expenses)}</td>
                  <td className="px-5 py-3 text-right font-bold tnum" style={{ color: c.profit >= 0 ? "var(--emerald)" : "var(--rose)" }}>{inr(c.profit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-[var(--line)] font-bold">
              <td className="px-5 py-3">Total</td>
              <td className="px-5 py-3 text-right tnum">{inr(pl.totals.billed)}</td>
              <td className="px-5 py-3 text-right tnum text-[var(--emerald)]">{inr(pl.totals.received)}</td>
              <td className="px-5 py-3 text-right tnum text-[var(--amber)]">{inr(pl.totals.expenses)}</td>
              <td className="px-5 py-3 text-right tnum" style={{ color: profitTone }}>{inr(pl.totals.profit)}</td>
            </tr></tfoot>
          </table>
        </div>
      </div>

      {/* Monthly P&L */}
      {pl.monthly.length > 0 && (
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3"><h2 className="text-[14px] font-bold">Monthly Profit &amp; Loss</h2></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
              <th className="th px-5 py-2.5">Month</th><th className="th px-5 py-2.5 text-right">Collected</th><th className="th px-5 py-2.5 text-right">Expenses</th><th className="th px-5 py-2.5 text-right">Profit</th>
            </tr></thead>
            <tbody>
              {pl.monthly.map((m) => (
                <tr key={m.month} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-5 py-3 font-semibold">{monthName(m.month)}</td>
                  <td className="px-5 py-3 text-right tnum text-[var(--emerald)]">{inr(m.received)}</td>
                  <td className="px-5 py-3 text-right tnum text-[var(--amber)]">{inr(m.expenses)}</td>
                  <td className="px-5 py-3 text-right font-bold tnum" style={{ color: m.profit >= 0 ? "var(--emerald)" : "var(--rose)" }}>{inr(m.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Expenses */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-[14px] font-bold">Expenses ({expenses.count})</h2>
          <div className="flex flex-wrap gap-1.5">{expenses.byCategory.slice(0, 6).map((c) => <span key={c.category} className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">{c.category}: {inr(c.amount)}</span>)}</div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
              <th className="th px-5 py-2.5">Date</th><th className="th px-5 py-2.5">Category</th><th className="th px-5 py-2.5">Company</th><th className="th px-5 py-2.5">Vendor / note</th><th className="th px-5 py-2.5 text-right">Amount</th><th className="th px-5 py-2.5"></th>
            </tr></thead>
            <tbody>
              {expenses.rows.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[var(--muted)]">No expenses recorded yet. Add one to track profit.</td></tr>}
              {expenses.rows.map((e) => (
                <tr key={e.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 tnum">{fmtD(e.date)}</td>
                  <td className="px-5 py-3"><span className="rounded-full bg-[color-mix(in_srgb,var(--amber)_12%,white)] px-2 py-0.5 text-[11px] font-bold text-[var(--amber)]">{e.category || "Misc"}</span></td>
                  <td className="px-5 py-3 text-[12px] text-[var(--ink-2)]">{e.company ? coLabel(e.company) : "General"}</td>
                  <td className="px-5 py-3 text-[12.5px]">{e.vendor || "—"}{e.notes ? <span className="text-[var(--faint)]"> · {e.notes}</span> : ""}</td>
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
          <input type="hidden" name="return" value="/profit-loss" />
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
          <input type="hidden" name="return" value="/profit-loss" />
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
