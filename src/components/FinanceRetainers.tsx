"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { billRetainer } from "@/app/sales-actions";
import { TrendingUp, Search, CalendarClock, ReceiptText, Repeat, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const PAGE_SIZE = 10;

type Row = { id: string; code: string; name: string; phone: string; email: string; retainer: number; status: string; renewalDate: string; daysToRenewal: number | null; billedThisMonth: boolean; invReceived: number; invTotal: number; invNumber: string };
type Counts = { all: number; active: number; onHold: number; unbilled: number; renewing: number };
type Totals = { mrr: number; unbilledAmt: number; clients: number };

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", ON_HOLD: "On hold", UPCOMING: "Upcoming" };
const STATUS_TONE: Record<string, string> = { ACTIVE: "var(--emerald)", ON_HOLD: "var(--amber)", UPCOMING: "var(--violet)" };

export default function FinanceRetainers({ rows, counts, totals }: { rows: Row[]; counts: Counts; totals: Totals }) {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const nq = q.trim().toLowerCase();

  const filtered = useMemo(() => rows.filter((r) => {
    if (tab === "active" && r.status !== "ACTIVE") return false;
    if (tab === "unbilled" && !(r.status === "ACTIVE" && !r.billedThisMonth)) return false;
    if (tab === "renewing" && !(r.daysToRenewal !== null && r.daysToRenewal <= 30)) return false;
    if (tab === "onhold" && r.status !== "ON_HOLD") return false;
    if (nq && !`${r.name} ${r.code} ${r.phone}`.toLowerCase().includes(nq)) return false;
    return true;
  }), [rows, tab, nq]);

  const filterSig = `${tab}|${nq}`;
  const [prevSig, setPrevSig] = useState(filterSig);
  if (prevSig !== filterSig) { setPrevSig(filterSig); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  const TABS = [
    { k: "all", label: "All", n: counts.all },
    { k: "active", label: "Active", n: counts.active },
    { k: "unbilled", label: "Unbilled this month", n: counts.unbilled },
    { k: "renewing", label: "Renewing soon", n: counts.renewing },
    { k: "onhold", label: "On hold", n: counts.onHold },
  ];

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--magenta) 10%, white), color-mix(in srgb, var(--violet) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--magenta), var(--violet))" }}><Repeat size={20} /></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">Renewals</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">Finance</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{counts.active} active · MRR <b style={{ color: "var(--magenta)" }}>{inr(totals.mrr)}</b>/mo · {counts.unbilled} unbilled this month</p>
            </div>
          </div>
          <Link href="/" prefetch className="btn btn-ghost">← Dashboard</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="MRR (monthly recurring)" value={inr(totals.mrr)} tone="var(--magenta)" icon={<TrendingUp size={15} />} />
        <Kpi label="Unbilled this month" value={inr(totals.unbilledAmt)} sub={`${counts.unbilled} clients`} tone="var(--amber)" icon={<ReceiptText size={15} />} />
        <Kpi label="Renewing soon (≤30d)" value={String(counts.renewing)} tone="var(--rose)" icon={<CalendarClock size={15} />} />
        <Kpi label="Active retainers" value={String(counts.active)} icon={<Repeat size={15} />} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, code, phone…" className="input !py-2 !pl-9" />
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface)] p-0.5">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition ${tab === t.k ? "bg-[var(--ink)] text-white" : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"}`}>{t.label}<span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tnum ${tab === t.k ? "bg-white/20" : "bg-[var(--surface-2)]"}`}>{t.n}</span></button>
          ))}
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[960px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["#", "Client", "Retainer / mo", "Status", "Renewal", "Renews in", "This month", ""].map((h) => <th key={h} className="th px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No retainer clients here.</td></tr>}
              {paged.map((r, i) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 text-[12.5px] text-[var(--faint)] tnum">{start + i + 1}</td>
                  <td className="px-4 py-3"><Link href={`/accounts/${r.id}`} prefetch className="text-[13px] font-semibold text-[var(--violet)] hover:underline">{r.name}</Link><div className="text-[11px] text-[var(--faint)]">{r.code}{r.phone ? ` · ${r.phone}` : ""}</div></td>
                  <td className="px-4 py-3 text-[13px] font-semibold tnum" style={{ color: "var(--magenta)" }}>{inr(r.retainer)}</td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `color-mix(in srgb, ${STATUS_TONE[r.status] ?? "var(--muted)"} 12%, white)`, color: STATUS_TONE[r.status] ?? "var(--muted)" }}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                  <td className="px-4 py-3 text-[12.5px] tnum text-[var(--muted)]">{fmtDate(r.renewalDate)}</td>
                  <td className="px-4 py-3 text-[12.5px] tnum">
                    {r.daysToRenewal === null ? <span className="text-[var(--faint)]">—</span>
                      : r.daysToRenewal < 0 ? <span style={{ color: "var(--rose)" }}>{-r.daysToRenewal}d overdue</span>
                      : r.daysToRenewal <= 30 ? <span style={{ color: "var(--amber)" }}>{r.daysToRenewal}d</span>
                      : <span className="text-[var(--muted)]">{r.daysToRenewal}d</span>}
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    {r.billedThisMonth
                      ? <span className="inline-flex items-center gap-1 font-semibold" style={{ color: r.invReceived >= r.invTotal ? "var(--emerald)" : "var(--violet)" }}><CheckCircle2 size={13} /> {r.invReceived >= r.invTotal ? "Billed · paid" : "Billed"}</span>
                      : <span style={{ color: "var(--amber)" }}>Not billed</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "ACTIVE" && !r.billedThisMonth
                      ? <form action={billRetainer}><input type="hidden" name="clientId" value={r.id} /><button type="submit" className="btn btn-violet btn-sm"><ReceiptText size={13} /> Bill retainer</button></form>
                      : <Link href={`/accounts/${r.id}`} prefetch className="btn btn-ghost btn-sm">Open</Link>}
                  </td>
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

function Kpi({ label, value, tone, icon, sub }: { label: string; value: string; tone?: string; icon?: React.ReactNode; sub?: string }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div>
      <div className="mt-1.5 text-[19px] font-extrabold tnum" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--faint)] tnum">{sub}</div>}
    </div>
  );
}
