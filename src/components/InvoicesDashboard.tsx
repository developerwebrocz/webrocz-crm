"use client";

import Link from "next/link";
import { FileText, ShieldCheck, Clock } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

const STATUS = [
  { k: "", label: "All" },
  { k: "pending_approval", label: "Pending approval" },
  { k: "approved", label: "Approved" },
  { k: "unpaid", label: "Balance due" },
  { k: "overdue", label: "Overdue" },
  { k: "paid", label: "Fully paid" },
];

export default function InvoicesDashboard({ rows, totals, q, status }: { rows: any[]; totals: any; q: string; status: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight">Invoices</h1>
        <p className="text-[13px] text-[var(--muted)]">All client invoices — track approval, payments &amp; follow-ups.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Invoices" value={String(totals.count)} icon={<FileText size={16} />} />
        <Kpi label="Total billed" value={inr(totals.billed)} />
        <Kpi label="Received" value={inr(totals.received)} tone="var(--emerald)" />
        <Kpi label="Balance due" value={inr(totals.balance)} tone="var(--amber)" />
        <Kpi label="Pending approval" value={String(totals.pendingApproval)} tone="var(--violet)" icon={<Clock size={16} />} />
      </div>

      {/* filters */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search invoice no. / client / phone…" className="input !w-auto min-w-[240px]" />
        <select name="status" defaultValue={status} className="select !w-auto">{STATUS.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}</select>
        <button className="btn btn-ghost btn-sm">Apply</button>
        {(q || status) && <Link href="/invoices" className="btn btn-ghost btn-sm">Clear</Link>}
      </form>

      {/* table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
              <th className="th">Invoice</th><th className="th">Client</th><th className="th">Date</th><th className="th !text-right">Total</th><th className="th !text-right">Balance</th><th className="th !pl-10">Payment</th><th className="th">Approval</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[var(--muted)]">No invoices found.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 font-semibold">{r.number}</td>
                  <td className="px-4 py-3">{r.billTo}<div className="text-[11.5px] text-[var(--faint)]">{r.phone || r.email || ""}</div></td>
                  <td className="px-4 py-3 text-[var(--ink-2)]">{r.issueDate}</td>
                  <td className="px-4 py-3 text-right tnum">{inr(r.total)}</td>
                  <td className="px-4 py-3 text-right tnum" style={{ color: r.balance > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(r.balance)}</td>
                  <td className="py-3 pl-10 pr-4">{r.paymentStatus}</td>
                  <td className="px-4 py-3">
                    {r.approved
                      ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--emerald)" }}><ShieldCheck size={13} /> Approved</span>
                      : <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--amber)" }}><Clock size={13} /> Pending</span>}
                  </td>
                  <td className="px-4 py-3 text-right"><Link href={`/invoices/${r.id}`} prefetch className="btn btn-ghost btn-sm">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
