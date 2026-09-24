"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { downloadCsv } from "@/lib/csv";
import { IndianRupee, Search, Wallet, Hash, ChevronLeft, ChevronRight, Download } from "lucide-react";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const PAGE_SIZE = 10;

type Row = { id: string; date: string; amount: number; mode: string; ref: string; note: string; by: string; invoiceNumber: string; clientId: string | null; clientName: string; category: string };

function periodBounds(period: string): [string, string] {
  if (period === "ALL" || period === "CUSTOM" || period === "ON_DATE") return ["", ""];
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (period === "THIS_MONTH") return [iso(new Date(Date.UTC(y, m, 1))), iso(new Date(Date.UTC(y, m + 1, 0)))];
  if (period === "LAST_MONTH") return [iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))];
  if (period === "THIS_FY") { const fy = m >= 3 ? y : y - 1; return [iso(new Date(Date.UTC(fy, 3, 1))), iso(new Date(Date.UTC(fy + 1, 2, 31)))]; }
  if (period === "THIS_YEAR") return [`${y}-01-01`, `${y}-12-31`];
  return ["", ""];
}

const MODES = ["UPI", "BANK", "CHEQUE", "CASH", "CARD", "OTHER"];
const modeLabel: Record<string, string> = { UPI: "UPI", BANK: "Bank", CHEQUE: "Cheque", CASH: "Cash", CARD: "Card", OTHER: "Other" };

export default function FinancePayments({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("ALL");
  const [cat, setCat] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const [onDate, setOnDate] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const nq = q.trim().toLowerCase();

  const [pFrom, pTo] = period === "CUSTOM" ? [from, to] : period === "ON_DATE" ? [onDate, onDate] : periodBounds(period);
  const catMatch = (c: string) => cat === "ALL" || (cat === "WEBSITE" ? (c === "Website" || c === "Both") : (c === "Digital Marketing" || c === "Both"));

  const filtered = useMemo(() => rows.filter((r) => {
    if (mode !== "ALL" && r.mode !== mode) return false;
    if (!catMatch(r.category)) return false;
    if (pFrom && r.date < pFrom) return false;
    if (pTo && r.date > pTo) return false;
    if (nq && !`${r.clientName} ${r.invoiceNumber} ${r.ref} ${r.note} ${r.by}`.toLowerCase().includes(nq)) return false;
    return true;
  }), [rows, mode, cat, pFrom, pTo, nq]);

  const filterSig = `${nq}|${mode}|${cat}|${pFrom}|${pTo}`;
  const [prevSig, setPrevSig] = useState(filterSig);
  if (prevSig !== filterSig) { setPrevSig(filterSig); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  const totals = useMemo(() => {
    const sum = filtered.reduce((s, r) => s + r.amount, 0);
    return { sum, count: filtered.length, avg: filtered.length ? Math.round(sum / filtered.length) : 0 };
  }, [filtered]);

  const exportCsv = () => downloadCsv(
    `payments-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Date", "Client", "Invoice", "Category", "Amount", "Mode", "Ref", "Note", "By"],
    filtered.map((r) => [r.date, r.clientName, r.invoiceNumber, r.category, r.amount, r.mode, r.ref, r.note, r.by]),
  );

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--emerald) 12%, white), color-mix(in srgb, var(--violet) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--emerald), var(--violet))" }}><IndianRupee size={20} /></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">Payments</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">Finance</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{totals.count} payments · Collected <b style={{ color: "var(--emerald)" }}>{inr(totals.sum)}</b></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="btn btn-ghost"><Download size={15} /> Export CSV</button>
            <Link href="/accounts" prefetch className="btn btn-ghost">Clients</Link>
            <Link href="/" prefetch className="btn btn-ghost">← Dashboard</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Total collected" value={inr(totals.sum)} tone="var(--emerald)" icon={<Wallet size={15} />} />
        <Kpi label="Payments" value={String(totals.count)} icon={<Hash size={15} />} />
        <Kpi label="Avg payment" value={inr(totals.avg)} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-[300px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, invoice, ref…" className="input !py-2 !pl-9" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="select !w-auto"><option value="ALL">All categories</option><option value="WEBSITE">Website Development</option><option value="DM">Digital Marketing</option></select>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="select !w-auto"><option value="ALL">All modes</option>{MODES.map((m) => <option key={m} value={m}>{modeLabel[m]}</option>)}</select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="select !w-auto"><option value="ALL">All dates</option><option value="THIS_MONTH">This month</option><option value="LAST_MONTH">Last month</option><option value="THIS_FY">This financial year</option><option value="THIS_YEAR">This year</option><option value="ON_DATE">On a specific date…</option><option value="CUSTOM">Custom range…</option></select>
        {period === "ON_DATE" && <input type="date" value={onDate} onChange={(e) => setOnDate(e.target.value)} className="input !w-auto !py-2" aria-label="Pick a date" />}
        {period === "CUSTOM" && (<>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input !w-auto !py-2" aria-label="From date" />
          <span className="text-[12px] text-[var(--muted)]">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-auto !py-2" aria-label="To date" />
        </>)}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[900px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["#", "Date", "Client", "Invoice", "Category", "Amount", "Mode", "Ref", "By"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No payments found.</td></tr>}
              {paged.map((r, i) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[12.5px] text-[var(--faint)] tnum">{start + i + 1}</td>
                  <td className="px-5 py-3 text-[12.5px] tnum">{fmtDate(r.date)}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold">{r.clientId ? <Link href={`/accounts/${r.clientId}`} prefetch className="text-[var(--violet)] hover:underline">{r.clientName}</Link> : r.clientName}</td>
                  <td className="px-5 py-3 text-[12.5px] font-semibold">{r.invoiceNumber || "—"}</td>
                  <td className="px-5 py-3"><CatChip c={r.category} /></td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum" style={{ color: "var(--emerald)" }}>{inr(r.amount)}</td>
                  <td className="px-5 py-3 text-[12px]"><span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)]">{modeLabel[r.mode] ?? r.mode}</span></td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted)]">{r.ref || "—"}</td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted)]">{r.by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
            <span className="text-[12.5px] text-[var(--muted)]">Showing <b className="tnum">{start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)}</b> of <b className="tnum">{filtered.length}</b></span>
            <div className="flex items-center gap-1.5">
              <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="btn btn-ghost btn-sm disabled:opacity-40"><ChevronLeft size={14} /> Prev</button>
              <span className="px-2 text-[12.5px] font-semibold tnum">{cur} / {totalPages}</span>
              <button disabled={cur >= totalPages} onClick={() => setPage(cur + 1)} className="btn btn-ghost btn-sm disabled:opacity-40">Next <ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CatChip({ c }: { c: string }) {
  const map: Record<string, string> = { Website: "var(--indigo)", "Digital Marketing": "var(--magenta)", Both: "var(--violet)" };
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
