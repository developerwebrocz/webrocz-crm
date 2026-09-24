"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ROLES } from "@/lib/domain";
import { ReceiptText, Wallet, Clock, Search, Phone, Mail, TrendingUp, X } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const monthLabel = (m: string) => { if (!m) return "—"; const [y, mo] = m.split("-"); const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${names[parseInt(mo, 10) - 1] ?? mo} ${y}`; };
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };

type Inv = { id: string; number: string; billTo: string; contact: string | null; phone: string | null; email: string | null; total: number; received: number; balance: number; approved: boolean; paymentStatus: string; issueDate: string; month: string; category: string; overdue: boolean };
type MonthRow = { month: string; billed: number; received: number; pending: number; web: number; dm: number };
type Emp = { id: string; name: string; role: string; email: string | null; phone: string | null };

export default function AccountantDashboard({ totals, invoiceRows, monthlyRows, employees, userName }: { totals: any; invoiceRows: Inv[]; monthlyRows: MonthRow[]; employees: Emp[]; userName: string }) {
  const [tab, setTab] = useState<"invoices" | "monthly" | "employees">("invoices");
  const [client, setClient] = useState<string | null>(null);
  const [cat, setCat] = useState("ALL");
  const [pay, setPay] = useState("ALL"); // ALL | pending | paid
  const [q, setQ] = useState("");
  const nq = q.trim().toLowerCase();

  const invFiltered = useMemo(() => invoiceRows.filter((r) => {
    if (cat !== "ALL") { if (cat === "WEBSITE" && !(r.category === "Website" || r.category === "Both")) return false; if (cat === "DM" && !(r.category === "Digital Marketing" || r.category === "Both")) return false; }
    if (pay === "pending" && r.balance <= 0) return false;
    if (pay === "paid" && r.balance > 0) return false;
    if (nq && !`${r.number} ${r.billTo} ${r.contact ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(nq)) return false;
    return true;
  }), [invoiceRows, cat, pay, nq]);
  const empFiltered = useMemo(() => employees.filter((e) => !nq || `${e.name} ${e.email ?? ""} ${e.phone ?? ""} ${ROLES[e.role as keyof typeof ROLES] ?? e.role}`.toLowerCase().includes(nq)), [employees, nq]);

  return (
    <div className="space-y-5">
      {/* branded header */}
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--violet) 10%, white), color-mix(in srgb, var(--magenta) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-[20px] font-black text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--magenta), var(--violet))" }}>W</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">Accountant Dashboard</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">Finance</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Hi {userName.split(" ")[0]} · {totals.invoices} invoices · {totals.clients} clients · Pending <b style={{ color: "var(--amber)" }}>{inr(totals.pending)}</b></p>
            </div>
          </div>
          <Link href="/invoices" prefetch className="btn btn-violet"><ReceiptText size={16} /> All Invoices</Link>
        </div>
      </div>

      {/* finance KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total billed" value={inr(totals.billed)} icon={<ReceiptText size={15} />} />
        <Kpi label="Received" value={inr(totals.received)} tone="var(--emerald)" />
        <Kpi label="Pending" value={inr(totals.pending)} tone="var(--amber)" icon={<Wallet size={15} />} />
        <Kpi label="Overdue invoices" value={String(totals.overdue)} tone="var(--rose)" icon={<Clock size={15} />} />
        <Kpi label="DM monthly (recurring)" value={inr(totals.monthlyDm)} tone="var(--magenta)" icon={<TrendingUp size={15} />} />
        <Kpi label="Pending approval" value={String(totals.pendingApproval)} tone="var(--violet)" />
      </div>

      {/* search + tabs */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, invoice, phone…" className="input !py-2 !pl-9" />
        </div>
        {tab === "invoices" && (<>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="select !w-auto"><option value="ALL">All categories</option><option value="WEBSITE">Website Development</option><option value="DM">Digital Marketing</option></select>
          <select value={pay} onChange={(e) => setPay(e.target.value)} className="select !w-auto"><option value="ALL">All payments</option><option value="pending">Pending / balance due</option><option value="paid">Fully paid</option></select>
        </>)}
        <div className="ml-auto inline-flex rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface)] p-0.5">
          {(["invoices", "monthly", "employees"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-[7px] px-3.5 py-1.5 text-[12.5px] font-semibold capitalize transition ${tab === t ? "bg-[var(--ink)] text-white" : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"}`}>{t === "invoices" ? "Clients & Invoices" : t}</button>
          ))}
        </div>
      </div>

      {/* Clients & Invoices */}
      {tab === "invoices" && (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[1000px] text-left">
              <thead><tr className="border-b border-[var(--line)]">{["Client", "Category", "Invoice", "Date", "Total", "Received", "Pending", "Payment", ""].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {invFiltered.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No invoices found.</td></tr>}
                {invFiltered.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3"><button onClick={() => setClient(r.billTo)} className="text-left text-[13px] font-semibold text-[var(--violet)] hover:underline">{r.billTo}</button><div className="text-[11px] text-[var(--faint)]">{r.phone || r.email || ""}</div></td>
                    <td className="px-5 py-3"><CatChip c={r.category} /></td>
                    <td className="px-5 py-3 text-[12.5px] font-semibold">{r.number}{!r.approved && <span className="ml-1 text-[10.5px] font-bold text-[var(--amber)]">(unapproved)</span>}</td>
                    <td className="px-5 py-3 text-[12.5px] text-[var(--muted)] tnum">{fmtDate(r.issueDate)}</td>
                    <td className="px-5 py-3 text-[13px] font-semibold tnum">{inr(r.total)}</td>
                    <td className="px-5 py-3 text-[13px] tnum" style={{ color: "var(--emerald)" }}>{inr(r.received)}</td>
                    <td className="px-5 py-3 text-[13px] font-semibold tnum" style={{ color: r.balance > 0 ? (r.overdue ? "var(--rose)" : "var(--amber)") : "var(--emerald)" }}>{inr(r.balance)}{r.overdue ? " ⚠" : ""}</td>
                    <td className="px-5 py-3 text-[12px]">{r.balance <= 0 ? <span style={{ color: "var(--emerald)" }}>Paid</span> : r.received > 0 ? <span style={{ color: "var(--violet)" }}>Part paid</span> : <span style={{ color: "var(--amber)" }}>{r.paymentStatus || "Pending"}</span>}</td>
                    <td className="px-5 py-3 text-right"><Link href={`/invoices/${r.id}`} prefetch className="btn btn-ghost btn-sm">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      {tab === "monthly" && (
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-3.5"><h2 className="text-[14.5px] font-bold">Monthly report — Website vs Digital Marketing</h2></div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[720px] text-left">
              <thead><tr className="border-b border-[var(--line)]">{["Month", "Website billed", "Digital Marketing billed", "Total billed", "Received", "Pending"].map((h, i) => <th key={h} className={`th px-5 py-2.5 ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>
                {monthlyRows.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No data yet.</td></tr>}
                {monthlyRows.map((r) => (
                  <tr key={r.month} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3 text-[13px] font-semibold">{monthLabel(r.month)}</td>
                    <td className="px-5 py-3 text-right text-[13px] tnum" style={{ color: "var(--indigo)" }}>{inr(r.web)}</td>
                    <td className="px-5 py-3 text-right text-[13px] tnum" style={{ color: "var(--magenta)" }}>{inr(r.dm)}</td>
                    <td className="px-5 py-3 text-right text-[13px] font-semibold tnum">{inr(r.billed)}</td>
                    <td className="px-5 py-3 text-right text-[13px] tnum" style={{ color: "var(--emerald)" }}>{inr(r.received)}</td>
                    <td className="px-5 py-3 text-right text-[13px] font-semibold tnum" style={{ color: r.pending > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(r.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {client && <ClientModal name={client} invoices={invoiceRows.filter((r) => r.billTo === client)} close={() => setClient(null)} />}

      {/* Employees */}
      {tab === "employees" && (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[640px] text-left">
              <thead><tr className="border-b border-[var(--line)]">{["Employee", "Role", "Phone", "Email"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {empFiltered.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3 text-[13px] font-semibold">{e.name}</td>
                    <td className="px-5 py-3 text-[12.5px] text-[var(--ink-2)]">{ROLES[e.role as keyof typeof ROLES] ?? e.role}</td>
                    <td className="px-5 py-3 text-[12.5px] tnum">{e.phone ? <a href={`tel:${e.phone}`} className="inline-flex items-center gap-1 text-[var(--violet)]"><Phone size={12} /> {e.phone}</a> : "—"}</td>
                    <td className="px-5 py-3 text-[12px]">{e.email ? <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1 text-[var(--violet)]"><Mail size={12} /> {e.email}</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientModal({ name, invoices, close }: { name: string; invoices: Inv[]; close: () => void }) {
  const total = invoices.reduce((s, r) => s + r.total, 0);
  const received = invoices.reduce((s, r) => s + r.received, 0);
  const pending = invoices.reduce((s, r) => s + r.balance, 0);
  const first = invoices[0];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[780px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[17px] font-bold">{name}</h2>
            <div className="mt-1 flex flex-wrap gap-3 text-[12.5px] text-[var(--muted)]">
              {first?.contact && <span>{first.contact}</span>}
              {first?.phone && <a href={`tel:${first.phone}`} className="inline-flex items-center gap-1 text-[var(--violet)]"><Phone size={12} /> {first.phone}</a>}
              {first?.email && <a href={`mailto:${first.email}`} className="inline-flex items-center gap-1 text-[var(--violet)]"><Mail size={12} /> {first.email}</a>}
            </div>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-3 gap-3 border-b border-[var(--line)] px-6 py-4">
          <div><div className="eyebrow">Total billed</div><div className="mt-1 text-[18px] font-extrabold tnum">{inr(total)}</div></div>
          <div><div className="eyebrow">Received</div><div className="mt-1 text-[18px] font-extrabold tnum" style={{ color: "var(--emerald)" }}>{inr(received)}</div></div>
          <div><div className="eyebrow">Pending</div><div className="mt-1 text-[18px] font-extrabold tnum" style={{ color: pending > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(pending)}</div></div>
        </div>
        <div className="overflow-y-auto scroll-thin p-4">
          <div className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Invoices ({invoices.length})</div>
          <div className="space-y-2">
            {invoices.map((r) => (
              <Link key={r.id} href={`/invoices/${r.id}`} prefetch className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-[var(--line)] px-4 py-2.5 text-[12.5px] hover:border-[var(--violet)]">
                <span className="font-semibold">{r.number}</span>
                <CatChip c={r.category} />
                <span className="text-[var(--muted)] tnum">{fmtDate(r.issueDate)}</span>
                <span className="ml-auto tnum">Total {inr(r.total)}</span>
                <span className="tnum" style={{ color: "var(--emerald)" }}>Recd {inr(r.received)}</span>
                <span className="font-semibold tnum" style={{ color: r.balance > 0 ? "var(--amber)" : "var(--emerald)" }}>Pending {inr(r.balance)}</span>
                <span className="font-semibold text-[var(--violet)]">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CatChip({ c }: { c: string }) {
  const map: Record<string, string> = { Website: "var(--indigo)", "Digital Marketing": "var(--magenta)", Both: "var(--violet)", Other: "var(--muted)" };
  const color = map[c] ?? "var(--muted)";
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `color-mix(in srgb, ${color} 12%, white)`, color }}>{c}</span>;
}
function Kpi({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div>
      <div className="mt-1.5 text-[19px] font-extrabold tnum" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}
