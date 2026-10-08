"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { downloadCsv } from "@/lib/csv";
import { companyLabel } from "@/lib/domain";
import type { PayInvoice, PayEntry, PayClient } from "@/lib/payments-queries";
import PaymentCollectorModal from "@/components/PaymentCollectorModal";
import { Wallet, Users, CheckCircle2, AlertTriangle, IndianRupee, CalendarDays, Search, Download, Clock } from "lucide-react";

// Payments pipeline (/payments): who still owes money, who has paid in full, and how much
// was collected day by day and by whom. Everything is worked out from the invoices and the
// payment ledger passed in, so every filter responds instantly.

const inr = (v: number) => "₹" + Math.round(v || 0).toLocaleString("en-IN");
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthOf = (iso: string) => { const [y, m] = (iso || "").split("-"); return m ? `${MON[parseInt(m, 10) - 1] ?? m} '${y.slice(2)}` : "—"; };
// Local calendar date (not UTC), so "today" matches the accountant's day.
const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (iso: string, days: number) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return localISO(d); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const MODE: Record<string, string> = { UPI: "UPI", BANK: "Bank", CHEQUE: "Cheque", CASH: "Cash", CARD: "Card", OTHER: "Other" };

const COMPANIES = [{ k: "ALL", label: "All companies" }, { k: "WEB_SOLUTIONS", label: "Web Solutions" }, { k: "WEB_ROCZ", label: "Web Rocz" }, { k: "WEB_ROCZ_PVT", label: "Web Rocz Pvt Ltd" }];
const PERIODS = [{ k: "TODAY", label: "Today" }, { k: "YESTERDAY", label: "Yesterday" }, { k: "WEEK", label: "Last 7 days" }, { k: "MONTH", label: "This month" }, { k: "LAST_MONTH", label: "Last month" }, { k: "FY", label: "This financial year" }, { k: "ALL", label: "All time" }, { k: "CUSTOM", label: "Custom dates" }];

function periodBounds(k: string, today: string, from: string, to: string): [string, string] {
  const [y, m] = today.split("-").map(Number);
  const iso = (yy: number, mm: number, dd: number) => localISO(new Date(yy, mm - 1, dd));
  if (k === "TODAY") return [today, today];
  if (k === "YESTERDAY") return [shift(today, -1), shift(today, -1)];
  if (k === "WEEK") return [shift(today, -6), today];
  if (k === "MONTH") return [iso(y, m, 1), iso(y, m + 1, 0)];
  if (k === "LAST_MONTH") return [iso(y, m - 1, 1), iso(y, m, 0)];
  if (k === "FY") { const fy = m >= 4 ? y : y - 1; return [`${fy}-04-01`, `${fy + 1}-03-31`]; }
  if (k === "CUSTOM") return [from, to];
  return ["", ""];
}

type ClientRow = { key: string; id: string | null; code: string; name: string; phone: string; accountManager: string; companies: string[]; invoices: number; billed: number; received: number; pending: number; overdue: number; pendingInvoices: number; oldestPending: string; overdueDays: number; lastPayDate: string; lastPayAmount: number };

// `today` comes from the server (India date) so the first render matches in the browser.
// `canReassign` (Super / Sub Admin) shows "Change name" beside each accountant.
export default function PaymentsPipeline({ invoices, payments, clients, today, canReassign }: { invoices: PayInvoice[]; payments: PayEntry[]; clients: PayClient[]; today: string; canReassign?: boolean }) {
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [company, setCompany] = useState("ALL");
  const [period, setPeriod] = useState("MONTH");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [by, setBy] = useState("ALL");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"PENDING" | "RECEIVED" | "ALL">("PENDING");
  const [showAllPays, setShowAllPays] = useState(false);
  const nq = q.trim().toLowerCase();
  const [pFrom, pTo] = periodBounds(period, today, from, to);
  const inCo = (c: string) => company === "ALL" || c === company;
  const inPeriod = (d: string) => (!pFrom || d >= pFrom) && (!pTo || d <= pTo);

  // ---- who owes / who has paid (as of now, for the chosen company) ----
  const clientRows = useMemo<ClientRow[]>(() => {
    const meta = new Map(clients.map((c) => [c.key, c]));
    const map = new Map<string, ClientRow>();
    for (const i of invoices) {
      if (!inCo(i.company)) continue;
      const m = meta.get(i.clientKey);
      const r = map.get(i.clientKey) ?? { key: i.clientKey, id: i.clientId, code: m?.code ?? "", name: i.clientName, phone: m?.phone ?? "", accountManager: m?.accountManager ?? "", companies: [], invoices: 0, billed: 0, received: 0, pending: 0, overdue: 0, pendingInvoices: 0, oldestPending: "", overdueDays: 0, lastPayDate: "", lastPayAmount: 0 };
      const bal = Math.max(0, i.total - i.received);
      r.invoices++; r.billed += i.total; r.received += i.total - bal; r.pending += bal;
      if (!r.companies.includes(i.company)) r.companies.push(i.company);
      if (bal > 0) {
        r.pendingInvoices++;
        if (!r.oldestPending || i.issueDate < r.oldestPending) r.oldestPending = i.issueDate;
        if (i.dueDate && i.dueDate < today) { r.overdue += bal; r.overdueDays = Math.max(r.overdueDays, daysBetween(i.dueDate, today)); }
      }
      map.set(i.clientKey, r);
    }
    for (const p of payments) {
      if (!inCo(p.company)) continue;
      const r = map.get(p.clientKey);
      if (r && p.date > r.lastPayDate) { r.lastPayDate = p.date; r.lastPayAmount = p.amount; }
    }
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, payments, clients, company, today]);

  const pendingClients = clientRows.filter((r) => r.pending > 0);
  const receivedClients = clientRows.filter((r) => r.pending <= 0 && r.billed > 0);
  const overdueClients = clientRows.filter((r) => r.overdue > 0);
  const sum = (rows: ClientRow[], f: (r: ClientRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const totalBilled = sum(clientRows, (r) => r.billed), totalReceived = sum(clientRows, (r) => r.received), totalPending = sum(clientRows, (r) => r.pending), totalOverdue = sum(clientRows, (r) => r.overdue);

  const shownClients = (tab === "PENDING" ? pendingClients : tab === "RECEIVED" ? receivedClients : clientRows)
    .filter((r) => !nq || `${r.name} ${r.code} ${r.phone} ${r.accountManager}`.toLowerCase().includes(nq))
    .sort((a, b) => (tab === "RECEIVED" ? (a.lastPayDate < b.lastPayDate ? 1 : -1) : b.pending - a.pending || b.billed - a.billed));

  // ---- collections (payment ledger) ----
  const coPays = useMemo(() => payments.filter((p) => inCo(p.company)), [payments, company]); // eslint-disable-line react-hooks/exhaustive-deps
  const collectors = useMemo(() => [...new Set(coPays.map((p) => p.by))].sort(), [coPays]);
  const byMatch = (p: PayEntry) => by === "ALL" || p.by === by;
  const periodPays = coPays.filter((p) => inPeriod(p.date) && byMatch(p));
  const amountOn = (rows: PayEntry[], f: (p: PayEntry) => boolean) => rows.filter(f).reduce((s, p) => s + p.amount, 0);
  const collectedToday = amountOn(coPays, (p) => p.date === today && byMatch(p));
  const collectedPeriod = periodPays.reduce((s, p) => s + p.amount, 0);
  const [mFrom, mTo] = periodBounds("MONTH", today, "", "");

  // day by day, newest first
  const daily = useMemo(() => {
    const map = new Map<string, { date: string; amount: number; count: number; by: Map<string, number> }>();
    for (const p of periodPays) {
      const d = map.get(p.date) ?? { date: p.date, amount: 0, count: 0, by: new Map<string, number>() };
      d.amount += p.amount; d.count++; d.by.set(p.by, (d.by.get(p.by) ?? 0) + p.amount);
      map.set(p.date, d);
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, company, by, pFrom, pTo]);

  // per accountant
  const perCollector = collectors.map((name) => {
    const mine = coPays.filter((p) => p.by === name);
    return { name, today: amountOn(mine, (p) => p.date === today), yesterday: amountOn(mine, (p) => p.date === shift(today, -1)), month: amountOn(mine, (p) => p.date >= mFrom && p.date <= mTo), period: amountOn(mine, (p) => inPeriod(p.date)), count: mine.filter((p) => inPeriod(p.date)).length };
  }).filter((c) => by === "ALL" || c.name === by).sort((a, b) => b.period - a.period);

  const periodLabel = PERIODS.find((p) => p.k === period)?.label ?? "";
  // Today / Yesterday / This month already have their own columns in the accountant table.
  const extraPeriodCol = !["TODAY", "YESTERDAY", "MONTH"].includes(period);
  const visiblePays = showAllPays ? periodPays : periodPays.slice(0, 15);

  const exportClients = () => downloadCsv(`payments-${tab.toLowerCase()}-clients.csv`,
    ["Client ID", "Client", "Company", "Phone", "Account Manager", "Invoices", "Billed", "Received", "Pending", "Overdue", "Pending since", "Last payment date", "Last payment"],
    shownClients.map((r) => [r.code, r.name, r.companies.map(companyLabel).join(" / "), r.phone, r.accountManager, r.invoices, r.billed, r.received, r.pending, r.overdue, r.oldestPending, r.lastPayDate, r.lastPayAmount]));
  const exportPays = () => downloadCsv("payments-collected.csv",
    ["Date", "Client", "Company", "Invoice", "Amount", "Mode", "Ref", "Collected by", "Note"],
    periodPays.map((p) => [p.date, p.clientName, companyLabel(p.company), p.invoiceNumber, p.amount, MODE[p.mode] ?? p.mode, p.ref, p.by, p.note]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight"><Wallet size={24} className="text-[var(--violet)]" /> Payments</h1>
          <p className="text-[13px] text-[var(--muted)]">Who has paid, who is pending, and what was collected each day.</p>
        </div>
      </div>

      {/* where things stand now */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Clock size={15} />} tone="var(--amber)" label="Clients with payment pending" value={String(pendingClients.length)} sub={`${inr(totalPending)} pending`} />
        <Kpi icon={<CheckCircle2 size={15} />} tone="var(--emerald)" label="Clients fully received" value={String(receivedClients.length)} sub={`${inr(totalReceived)} received in all`} />
        <Kpi icon={<AlertTriangle size={15} />} tone="var(--rose)" label="Overdue" value={inr(totalOverdue)} sub={`${overdueClients.length} client${overdueClients.length === 1 ? "" : "s"} past the due date`} />
        <Kpi icon={<IndianRupee size={15} />} tone="var(--violet)" label="Total billed" value={inr(totalBilled)} sub={`${clientRows.length} client${clientRows.length === 1 ? "" : "s"} billed`} />
      </div>

      {/* collections */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={<CalendarDays size={15} />} tone="var(--emerald)" label={`Collected today · ${fmtDate(today)}`} value={inr(collectedToday)} sub={by === "ALL" ? "by everyone" : `by ${by}`} />
        <Kpi icon={<Wallet size={15} />} tone="var(--emerald)" label={`Collected · ${periodLabel}`} value={inr(collectedPeriod)} sub={`${periodPays.length} payment${periodPays.length === 1 ? "" : "s"}${pFrom ? ` · ${fmtDate(pFrom)} to ${fmtDate(pTo)}` : ""}`} />
        <Kpi icon={<Clock size={15} />} tone="var(--amber)" label="Still to collect" value={inr(totalPending)} sub={`from ${pendingClients.length} client${pendingClients.length === 1 ? "" : "s"}`} />
      </div>

      {/* filters — under the summary cards */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="eyebrow block">Company</span><select value={company} onChange={(e) => setCompany(e.target.value)} className="select mt-1 !w-auto">{COMPANIES.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}</select></label>
          <label className="block"><span className="eyebrow block">Collections period</span><select value={period} onChange={(e) => setPeriod(e.target.value)} className="select mt-1 !w-auto">{PERIODS.map((p) => <option key={p.k} value={p.k}>{p.label}</option>)}</select></label>
          {period === "CUSTOM" && <>
            <label className="block"><span className="eyebrow block">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input mt-1 !w-auto" /></label>
            <label className="block"><span className="eyebrow block">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input mt-1 !w-auto" /></label>
          </>}
          <label className="block"><span className="eyebrow block">Collected by</span><select value={by} onChange={(e) => setBy(e.target.value)} className="select mt-1 !w-auto"><option value="ALL">Everyone</option>{collectors.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          {(company !== "ALL" || period !== "MONTH" || by !== "ALL" || q) && <button onClick={() => { setCompany("ALL"); setPeriod("MONTH"); setBy("ALL"); setQ(""); setFrom(""); setTo(""); }} className="btn btn-ghost btn-sm mb-0.5">Clear filters</button>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* per accountant */}
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-3"><h2 className="text-[14px] font-bold">Collected by accountant</h2><p className="text-[11.5px] text-[var(--muted)]">Who recorded the payments.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]"><th className="th">Accountant</th><th className="th !text-right">Today</th><th className="th !text-right">Yesterday</th><th className="th !text-right">This month</th>{extraPeriodCol && <th className="th !text-right">{periodLabel}</th>}</tr></thead>
              <tbody>
                {perCollector.length === 0 && <tr><td colSpan={extraPeriodCol ? 5 : 4} className="px-5 py-8 text-center text-[var(--muted)]">No payments recorded yet.</td></tr>}
                {perCollector.map((c) => (
                  <tr key={c.name} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-5 py-2.5 font-semibold">{c.name}{canReassign && <button onClick={() => setMoveFrom(c.name)} title="These payments were collected by someone else? Put them under the right name." className="ml-2 text-[11.5px] font-semibold text-[var(--violet)] hover:underline">Change name</button>}</td>
                    <td className="px-5 py-2.5 text-right tnum" style={{ color: c.today ? "var(--emerald)" : "var(--faint)" }}>{inr(c.today)}</td>
                    <td className="px-5 py-2.5 text-right tnum">{inr(c.yesterday)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold tnum">{inr(c.month)}</td>
                    {extraPeriodCol && <td className="px-5 py-2.5 text-right font-semibold tnum">{inr(c.period)} <span className="text-[11px] font-normal text-[var(--faint)]">· {c.count}</span></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* day by day */}
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-3"><h2 className="text-[14px] font-bold">Daily collection · {periodLabel}</h2><p className="text-[11.5px] text-[var(--muted)]">Each day&apos;s total, newest first.</p></div>
          <div className="max-h-[320px] overflow-auto scroll-thin">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]"><th className="th">Date</th><th className="th !text-right">Collected</th><th className="th !text-right">Payments</th><th className="th">By</th></tr></thead>
              <tbody>
                {daily.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--muted)]">Nothing collected in this period.</td></tr>}
                {daily.map((d) => (
                  <tr key={d.date} className="border-b border-[var(--line)] last:border-0">
                    <td className="whitespace-nowrap px-5 py-2.5 font-semibold">{fmtDate(d.date)}{d.date === today && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ color: "var(--emerald)", background: "color-mix(in srgb, var(--emerald) 12%, white)" }}>Today</span>}</td>
                    <td className="px-5 py-2.5 text-right font-semibold tnum" style={{ color: "var(--emerald)" }}>{inr(d.amount)}</td>
                    <td className="px-5 py-2.5 text-right tnum">{d.count}</td>
                    <td className="px-5 py-2.5 text-[12px] text-[var(--ink-2)]">{[...d.by].map(([n, a]) => `${n} ${inr(a)}`).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* clients */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-5 py-3">
          <h2 className="flex items-center gap-1.5 text-[14px] font-bold"><Users size={15} /> Clients</h2>
          <div className="flex flex-wrap gap-1.5">
            <Tab active={tab === "PENDING"} onClick={() => setTab("PENDING")} tone="var(--amber)">Payment pending · {pendingClients.length}</Tab>
            <Tab active={tab === "RECEIVED"} onClick={() => setTab("RECEIVED")} tone="var(--emerald)">Fully received · {receivedClients.length}</Tab>
            <Tab active={tab === "ALL"} onClick={() => setTab("ALL")} tone="var(--violet)">All · {clientRows.length}</Tab>
          </div>
          <div className="relative ml-auto min-w-[200px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, phone, manager…" className="input !py-1.5 !pl-8" />
          </div>
          <button onClick={exportClients} className="btn btn-ghost btn-sm"><Download size={13} /> Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
              <th className="th">Client</th><th className="th">Company</th><th className="th !text-right">Invoices</th><th className="th !text-right">Billed</th><th className="th !text-right">Received</th><th className="th !text-right">Pending</th><th className="th">Pending since</th><th className="th">Last payment</th><th className="th">Account manager</th>
            </tr></thead>
            <tbody>
              {shownClients.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-[var(--muted)]">{tab === "PENDING" ? "No client has a payment pending." : tab === "RECEIVED" ? "No client is fully paid yet." : "No clients billed."}</td></tr>}
              {shownClients.map((r) => (
                <tr key={r.key} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-2.5">
                    {r.id ? <Link href={`/accounts/${r.id}${company !== "ALL" ? `?company=${company}` : r.companies.length === 1 ? `?company=${r.companies[0]}` : ""}`} prefetch className="font-semibold text-[var(--violet)] hover:underline">{r.name}</Link> : <span className="font-semibold">{r.name}</span>}
                    <div className="text-[11.5px] text-[var(--faint)]">{[r.code, r.phone].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-5 py-2.5 text-[12px] text-[var(--ink-2)]">{r.companies.map(companyLabel).join(", ")}</td>
                  <td className="px-5 py-2.5 text-right tnum">{r.invoices}</td>
                  <td className="px-5 py-2.5 text-right tnum">{inr(r.billed)}</td>
                  <td className="px-5 py-2.5 text-right tnum" style={{ color: "var(--emerald)" }}>{inr(r.received)}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tnum" style={{ color: r.pending > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(r.pending)}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-[12px]">
                    {r.pending > 0
                      ? <>{monthOf(r.oldestPending)} <span className="text-[var(--faint)]">· {r.pendingInvoices} invoice{r.pendingInvoices === 1 ? "" : "s"}</span>{r.overdue > 0 && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold" style={{ color: "var(--rose)", background: "color-mix(in srgb, var(--rose) 10%, white)" }}>{r.overdueDays}d overdue</span>}</>
                      : <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: "var(--emerald)", background: "color-mix(in srgb, var(--emerald) 12%, white)" }}>All received</span>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-[12px]">{r.lastPayDate ? <>{fmtDate(r.lastPayDate)} <span className="text-[var(--faint)]">· {inr(r.lastPayAmount)}</span></> : <span className="text-[var(--faint)]">{r.received > 0 ? "—" : "No payment yet"}</span>}</td>
                  <td className="px-5 py-2.5 text-[12.5px]">{r.accountManager || <span className="text-[var(--faint)]">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* payments in the period */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-[14px] font-bold">Payments received · {periodLabel} <span className="font-normal text-[var(--muted)]">({periodPays.length})</span></h2>
          <button onClick={exportPays} className="btn btn-ghost btn-sm ml-auto"><Download size={13} /> Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]"><th className="th">Date</th><th className="th">Client</th><th className="th">Company</th><th className="th">Invoice</th><th className="th !text-right">Amount</th><th className="th">Mode</th><th className="th">Ref</th><th className="th">Collected by</th></tr></thead>
            <tbody>
              {periodPays.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-[var(--muted)]">No payments in this period.</td></tr>}
              {visiblePays.map((p) => (
                <tr key={p.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="whitespace-nowrap px-5 py-2.5">{fmtDate(p.date)}</td>
                  <td className="px-5 py-2.5 font-semibold">{p.clientName}</td>
                  <td className="px-5 py-2.5 text-[12px] text-[var(--ink-2)]">{companyLabel(p.company)}</td>
                  <td className="whitespace-nowrap px-5 py-2.5"><Link href={`/invoices/${p.invoiceId}`} prefetch className="text-[var(--violet)] hover:underline">{p.invoiceNumber}</Link></td>
                  <td className="px-5 py-2.5 text-right font-semibold tnum" style={{ color: "var(--emerald)" }}>{inr(p.amount)}</td>
                  <td className="px-5 py-2.5">{MODE[p.mode] ?? p.mode}</td>
                  <td className="px-5 py-2.5 text-[12px] text-[var(--ink-2)]">{p.ref && !p.ref.startsWith("/uploads/") ? p.ref : p.ref ? <a href={p.ref} target="_blank" rel="noreferrer" className="text-[var(--violet)] hover:underline">Proof</a> : "—"}</td>
                  <td className="px-5 py-2.5">{p.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {periodPays.length > 15 && <div className="border-t border-[var(--line)] px-5 py-2.5 text-center"><button onClick={() => setShowAllPays((v) => !v)} className="text-[12.5px] font-semibold text-[var(--violet)] hover:underline">{showAllPays ? "Show fewer" : `Show all ${periodPays.length} payments`}</button></div>}
      </div>
      {moveFrom && <PaymentCollectorModal key={moveFrom} from={moveFrom} all={coPays.filter((p) => p.by === moveFrom)} inPeriod={coPays.filter((p) => p.by === moveFrom && inPeriod(p.date))} periodLabel={periodLabel} close={() => setMoveFrom(null)} />}
    </div>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]"><span style={{ color: tone }}>{icon}</span>{label}</div>
      <div className="mt-1.5 text-[24px] font-extrabold leading-tight tnum" style={{ color: tone }}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
}
function Tab({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: string; children: React.ReactNode }) {
  return <button onClick={onClick} className="rounded-full border px-3 py-1 text-[12px] font-semibold transition" style={active ? { background: tone, borderColor: tone, color: "white" } : { borderColor: "var(--line-2)", color: "var(--ink-2)" }}>{children}</button>;
}
