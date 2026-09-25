"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ROLES } from "@/lib/domain";
import { addClientFromFinance } from "@/app/actions";
import { downloadCsv } from "@/lib/csv";
import { ReceiptText, Wallet, Globe, Search, Phone, Mail, TrendingUp, X, IndianRupee, UserPlus, CheckCircle2, Users, ChevronLeft, ChevronRight, Download } from "lucide-react";

const PAGE_SIZE = 10;

/* eslint-disable @typescript-eslint/no-explicit-any */
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const monthLabel = (m: string) => { if (!m) return "—"; const [y, mo] = m.split("-"); const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${names[parseInt(mo, 10) - 1] ?? mo} ${y}`; };
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };

type Inv = { id: string; clientId: string | null; code: string; number: string; billTo: string; contact: string | null; phone: string | null; email: string | null; total: number; received: number; balance: number; approved: boolean; paymentStatus: string; issueDate: string; dueDate: string; nextFollowup: string | null; month: string; category: string; overdue: boolean };
type MonthRow = { month: string; billed: number; received: number; pending: number; web: number; dm: number };
type Emp = { id: string; name: string; role: string; email: string | null; phone: string | null };
type Aging = { current: number; d30: number; d60: number; d90: number; d90plus: number };

// Where a client name / Pay button should take you: the client's finance page (deep-open Pay if given).
const clientHref = (r: Inv, pay = false) => r.clientId ? `/accounts/${r.clientId}${pay ? `?pay=${r.id}` : ""}` : `/invoices/${r.id}`;

type AmUser = { id: string; name: string };
export default function AccountantDashboard({ totals, invoiceRows, monthlyRows, employees, aging, amUsers, userName }: { totals: any; invoiceRows: Inv[]; monthlyRows: MonthRow[]; employees: Emp[]; aging: Aging; amUsers: AmUser[]; userName: string }) {
  const [tab, setTab] = useState<"invoices" | "monthly" | "employees">("invoices");
  const [cat, setCat] = useState("ALL");
  const [pay, setPay] = useState("ALL"); // ALL | pending | paid | overdue
  const [sort, setSort] = useState("recent"); // recent | pending | overdue
  const [q, setQ] = useState("");
  const [addClient, setAddClient] = useState(false);
  const nq = q.trim().toLowerCase();

  const invFiltered = useMemo(() => {
    const rows = invoiceRows.filter((r) => {
      if (cat !== "ALL") { if (cat === "WEBSITE" && !(r.category === "Website" || r.category === "Both")) return false; if (cat === "DM" && !(r.category === "Digital Marketing" || r.category === "Both")) return false; }
      if (pay === "pending" && r.balance <= 0) return false;
      if (pay === "paid" && r.balance > 0) return false;
      if (pay === "overdue" && !r.overdue) return false;
      if (nq && !`${r.number} ${r.code} ${r.billTo} ${r.contact ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(nq)) return false;
      return true;
    });
    if (sort === "pending") rows.sort((a, b) => b.balance - a.balance);
    else if (sort === "overdue") rows.sort((a, b) => (Number(b.overdue) - Number(a.overdue)) || (a.dueDate < b.dueDate ? -1 : 1));
    return rows;
  }, [invoiceRows, cat, pay, nq, sort]);
  const empFiltered = useMemo(() => employees.filter((e) => !nq || `${e.name} ${e.email ?? ""} ${e.phone ?? ""} ${ROLES[e.role as keyof typeof ROLES] ?? e.role}`.toLowerCase().includes(nq)), [employees, nq]);

  // pagination for the invoices table — reset to page 1 when the filters change (render-time, no effect)
  const [page, setPage] = useState(1);
  const filterSig = `${cat}|${pay}|${nq}|${sort}|${tab}`;
  const [prevSig, setPrevSig] = useState(filterSig);
  if (prevSig !== filterSig) { setPrevSig(filterSig); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(invFiltered.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * PAGE_SIZE;
  const invPaged = invFiltered.slice(start, start + PAGE_SIZE);

  const agingTotal = aging.current + aging.d30 + aging.d60 + aging.d90 + aging.d90plus;

  // This month vs last month collected.
  const lastMonthReceived = totals.lastMonthReceived ?? 0;
  const momPct = lastMonthReceived > 0 ? Math.round(((totals.monthReceived - lastMonthReceived) / lastMonthReceived) * 100) : 0;
  const momSub = lastMonthReceived > 0
    ? <span style={{ color: momPct >= 0 ? "var(--emerald)" : "var(--rose)" }}>{momPct >= 0 ? "▲" : "▼"} {Math.abs(momPct)}% vs last month ({inr(lastMonthReceived)})</span>
    : totals.monthReceived > 0
      ? <span style={{ color: "var(--emerald)" }}>▲ up from ₹0 last month</span>
      : "no payments yet";

  const exportInvoicesCsv = () => downloadCsv(
    `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Client", "Code", "Category", "Invoice", "Date", "Due", "Total", "Received", "Pending", "Payment", "Approved"],
    invFiltered.map((r) => [r.billTo, r.code, r.category, r.number, r.issueDate, r.dueDate, r.total, r.received, r.balance, r.paymentStatus, r.approved ? "Yes" : "No"]),
  );

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
          <div className="flex items-center gap-2">
            <button onClick={() => setAddClient(true)} className="btn btn-ghost"><UserPlus size={16} /> Add Client</button>
            <Link href="/accounts" prefetch className="btn btn-ghost"><Users size={16} /> Clients</Link>
            <Link href="/invoices" prefetch className="btn btn-violet"><ReceiptText size={16} /> All Invoices</Link>
          </div>
        </div>
      </div>

      {/* finance KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <Kpi label="Total billed" value={inr(totals.billed)} icon={<ReceiptText size={15} />} />
        <Kpi label="Received" value={inr(totals.received)} tone="var(--emerald)" icon={<CheckCircle2 size={15} />} />
        <Kpi label="Pending" value={inr(totals.pending)} tone="var(--amber)" icon={<Wallet size={15} />} />
        <Kpi label="Website Dev payment" value={inr(totals.webBilled)} sub={`${inr(totals.webReceived)} received`} tone="var(--indigo)" icon={<Globe size={15} />} />
        <Kpi label="Collected this month" value={inr(totals.monthReceived)} sub={momSub} tone="var(--emerald)" icon={<IndianRupee size={15} />} />
        <Kpi label="DM monthly (recurring)" value={inr(totals.monthlyDm)} tone="var(--magenta)" icon={<TrendingUp size={15} />} />
        <Kpi label="Pending approval" value={String(totals.pendingApproval)} tone="var(--violet)" />
        <Kpi label="Clients" value={String(totals.clients)} />
      </div>

      {/* receivables aging */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-[13.5px] font-bold">Receivables aging</h2>
          <span className="text-[12px] text-[var(--muted)]">Outstanding <b className="tnum">{inr(agingTotal)}</b></span>
        </div>
        <div className="grid grid-cols-2 divide-[var(--line)] sm:grid-cols-5 sm:divide-x">
          <AgeCell label="Not due" value={aging.current} tone="var(--emerald)" total={agingTotal} />
          <AgeCell label="1–30 days" value={aging.d30} tone="var(--amber)" total={agingTotal} />
          <AgeCell label="31–60 days" value={aging.d60} tone="var(--orange, #f97316)" total={agingTotal} />
          <AgeCell label="61–90 days" value={aging.d90} tone="var(--rose)" total={agingTotal} />
          <AgeCell label="90+ days" value={aging.d90plus} tone="var(--rose)" total={agingTotal} />
        </div>
      </div>

      {/* search + tabs */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, invoice, phone…" className="input !py-2 !pl-9" />
        </div>
        {tab === "invoices" && (<>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="select !w-auto"><option value="ALL">All categories</option><option value="WEBSITE">Website Development</option><option value="DM">Digital Marketing</option></select>
          <select value={pay} onChange={(e) => setPay(e.target.value)} className="select !w-auto"><option value="ALL">All payments</option><option value="pending">Pending / balance due</option><option value="overdue">Overdue only</option><option value="paid">Fully paid</option></select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="select !w-auto"><option value="recent">Newest first</option><option value="pending">Highest pending</option><option value="overdue">Most overdue</option></select>
          <button onClick={exportInvoicesCsv} className="btn btn-ghost btn-sm"><Download size={14} /> Export</button>
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
            <table className="w-full min-w-[1080px] text-left">
              <thead><tr className="border-b border-[var(--line)]">{["#", "Client", "Category", "Invoice", "Date", "Due", "Total", "Received", "Pending", "Payment"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {invFiltered.length === 0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No invoices found.</td></tr>}
                {invPaged.map((r, i) => (
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3 text-[12.5px] text-[var(--faint)] tnum">{start + i + 1}</td>
                    <td className="px-5 py-3"><Link href={clientHref(r)} prefetch className="text-left text-[13px] font-semibold text-[var(--violet)] hover:underline">{r.billTo}</Link><div className="text-[11px] text-[var(--faint)]">{r.phone || r.email || ""}</div></td>
                    <td className="px-5 py-3"><CatChip c={r.category} /></td>
                    <td className="px-5 py-3 text-[12.5px] font-semibold">{r.number}{!r.approved && <span className="ml-1 text-[10.5px] font-bold text-[var(--amber)]">(unapproved)</span>}</td>
                    <td className="px-5 py-3 text-[12.5px] text-[var(--muted)] tnum">{fmtDate(r.issueDate)}</td>
                    <td className="px-5 py-3 text-[12.5px] tnum" style={{ color: r.overdue ? "var(--rose)" : "var(--muted)" }}>{fmtDate(r.dueDate)}{r.overdue ? " ⚠" : ""}</td>
                    <td className="px-5 py-3 text-[13px] font-semibold tnum">{inr(r.total)}</td>
                    <td className="px-5 py-3 text-[13px] tnum" style={{ color: "var(--emerald)" }}>{inr(r.received)}</td>
                    <td className="px-5 py-3 text-[13px] font-semibold tnum" style={{ color: r.balance > 0 ? (r.overdue ? "var(--rose)" : "var(--amber)") : "var(--emerald)" }}>{inr(r.balance)}</td>
                    <td className="px-5 py-3 text-[12px]">{r.balance <= 0 ? <span style={{ color: "var(--emerald)" }}>Paid</span> : r.received > 0 ? <span style={{ color: "var(--violet)" }}>Part paid</span> : <span style={{ color: "var(--amber)" }}>{r.paymentStatus || "Pending"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invFiltered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
              <span className="text-[12.5px] text-[var(--muted)]">Showing <b className="tnum">{start + 1}–{Math.min(start + PAGE_SIZE, invFiltered.length)}</b> of <b className="tnum">{invFiltered.length}</b></span>
              <div className="flex items-center gap-1.5">
                <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="btn btn-ghost btn-sm disabled:opacity-40"><ChevronLeft size={14} /> Prev</button>
                <span className="px-2 text-[12.5px] font-semibold tnum">{cur} / {totalPages}</span>
                <button disabled={cur >= totalPages} onClick={() => setPage(cur + 1)} className="btn btn-ghost btn-sm disabled:opacity-40">Next <ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monthly breakdown */}
      {tab === "monthly" && (
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-3.5"><h2 className="text-[14.5px] font-bold">Monthly report — Website vs Digital Marketing</h2></div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[720px] text-left">
              <thead><tr className="border-b border-[var(--line)]">{["Month", "Website billed", "Digital Marketing billed", "Total billed", "Received", "Pending"].map((h, i) => <th key={h} className={`th px-5 py-2.5 ${i > 0 ? "!text-right" : ""}`}>{h}</th>)}</tr></thead>
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

      {addClient && <AddClientModal amUsers={amUsers} close={() => setAddClient(false)} />}

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

function AddClientModal({ amUsers, close }: { amUsers: AmUser[]; close: () => void }) {
  const [gst, setGst] = useState("18");
  const noGst = gst === "0"; // Without GST → no GSTIN to capture
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Add new client</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Register a client for billing. You can raise invoices for them afterwards.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={addClientFromFinance} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <label className="block"><span className="eyebrow">Client / company name *</span><input name="name" required className="input mt-1" placeholder="Acme Pvt Ltd" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Contact person</span><input name="pocName" className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Phone</span><input name="pocMobile" className="input mt-1" /></label>
          </div>
          <label className="block"><span className="eyebrow">Email</span><input name="pocEmail" type="email" className="input mt-1" /></label>
          <label className="block"><span className="eyebrow">Account manager</span>
            <select name="accountManagerId" defaultValue="" className="select mt-1">
              <option value="">— Unassigned —</option>
              {amUsers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">GST</span><select name="gst" value={gst} onChange={(e) => setGst(e.target.value)} className="select mt-1"><option value="0">Without GST</option><option value="18">With GST 18%</option></select></label>
            <label className="block"><span className="eyebrow">Client GSTIN</span><input name="gstin" disabled={noGst} className="input mt-1 disabled:opacity-50 disabled:cursor-not-allowed" placeholder={noGst ? "Not applicable" : "optional"} /></label>
          </div>
          <div className="rounded-[10px] border border-[var(--line)] p-3">
            <div className="eyebrow mb-2">Amount to be paid — per service (before GST)</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-[12px] font-semibold text-[var(--indigo)]">Website Development (₹)</span><input name="webAmount" type="number" min={0} defaultValue={0} className="input mt-1" placeholder="0" /></label>
              <label className="block"><span className="text-[12px] font-semibold text-[var(--magenta)]">Digital Marketing (₹)</span><input name="dmAmount" type="number" min={0} defaultValue={0} className="input mt-1" placeholder="0" /></label>
            </div>
            <label className="mt-3 block"><span className="eyebrow">Amount already paid (₹)</span><input name="paid" type="number" min={0} defaultValue={0} className="input mt-1" placeholder="0" /></label>
            <p className="mt-2 text-[11.5px] text-[var(--faint)]">Each service creates its own invoice (so Website vs DM stays separate). Paid amount is applied Website first. Leave amounts at 0 to just register the client.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-violet"><UserPlus size={15} /> Add client</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AgeCell({ label, value, tone, total }: { label: string; value: number; tone: string; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="px-5 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-[15px] font-extrabold tnum" style={{ color: value > 0 ? tone : "var(--faint)" }}>{inr(value)}</div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} /></div>
    </div>
  );
}

function CatChip({ c }: { c: string }) {
  const map: Record<string, string> = { Website: "var(--indigo)", "Digital Marketing": "var(--magenta)", Both: "var(--violet)", Other: "var(--muted)" };
  const color = map[c] ?? "var(--muted)";
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `color-mix(in srgb, ${color} 12%, white)`, color }}>{c}</span>;
}
function Kpi({ label, value, tone, icon, sub }: { label: string; value: string; tone?: string; icon?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div>
      <div className="mt-1.5 text-[19px] font-extrabold tnum" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--faint)] tnum">{sub}</div>}
    </div>
  );
}
