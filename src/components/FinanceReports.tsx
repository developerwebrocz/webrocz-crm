"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { downloadCsv } from "@/lib/csv";
import { FileBarChart, ReceiptText, Wallet, CheckCircle2, IndianRupee, Download, Trophy } from "lucide-react";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const monthLabel = (m: string) => { if (!m) return "—"; const [y, mo] = m.split("-"); const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${names[parseInt(mo, 10) - 1] ?? mo} ${y}`; };
const modeLabel: Record<string, string> = { UPI: "UPI", BANK: "Bank transfer", CHEQUE: "Cheque", CASH: "Cash", CARD: "Card", OTHER: "Other" };

type M = { month: string; invoices: number; billed: number; received: number; pending: number; collected: number };
type TC = { name: string; billed: number; received: number; pending: number; invoices: number };
type Mode = { mode: string; amount: number };
type Totals = { billed: number; received: number; pending: number; collected: number };

export default function FinanceReports({ monthly, topClients, modes, totals, period, from, to }: { monthly: M[]; topClients: TC[]; modes: Mode[]; totals: Totals; period: string; from: string; to: string }) {
  const router = useRouter();
  const go = (p: string, f = "", t = "") => {
    const params = new URLSearchParams();
    if (p !== "ALL") params.set("period", p);
    if (p === "CUSTOM") { if (f) params.set("from", f); if (t) params.set("to", t); }
    const qs = params.toString();
    router.push(`/statements${qs ? `?${qs}` : ""}`);
  };
  const periodName = period === "THIS_FY" ? "This financial year" : period === "LAST_FY" ? "Last financial year" : period === "THIS_YEAR" ? "This year" : period === "CUSTOM" ? `${from || "…"} → ${to || "…"}` : "All time";
  const exportMonthly = () => downloadCsv(
    `finance-monthly-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Month", "Invoices", "Billed", "Received", "Pending", "Collected (payments)"],
    monthly.map((r) => [monthLabel(r.month), r.invoices, r.billed, r.received, r.pending, r.collected]),
  );
  const exportTop = () => downloadCsv(
    `top-clients-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Client", "Invoices", "Billed", "Received", "Pending"],
    topClients.map((r) => [r.name, r.invoices, r.billed, r.received, r.pending]),
  );
  const modeTotal = modes.reduce((s, m) => s + m.amount, 0);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--indigo) 10%, white), color-mix(in srgb, var(--violet) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--indigo), var(--violet))" }}><FileBarChart size={20} /></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">Reports</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">Finance</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{periodName} · monthly financials · top clients · collections</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={period} onChange={(e) => go(e.target.value, from, to)} className="select !w-auto">
              <option value="ALL">All time</option>
              <option value="THIS_FY">This financial year</option>
              <option value="LAST_FY">Last financial year</option>
              <option value="THIS_YEAR">This year</option>
              <option value="CUSTOM">Custom range…</option>
            </select>
            {period === "CUSTOM" && (<>
              <input type="date" value={from} onChange={(e) => go("CUSTOM", e.target.value, to)} className="input !w-auto !py-2" aria-label="From date" />
              <span className="text-[12px] text-[var(--muted)]">to</span>
              <input type="date" value={to} onChange={(e) => go("CUSTOM", from, e.target.value)} className="input !w-auto !py-2" aria-label="To date" />
            </>)}
            <Link href="/" prefetch className="btn btn-ghost">← Dashboard</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total billed" value={inr(totals.billed)} icon={<ReceiptText size={15} />} />
        <Kpi label="Received" value={inr(totals.received)} tone="var(--emerald)" icon={<CheckCircle2 size={15} />} />
        <Kpi label="Pending" value={inr(totals.pending)} tone="var(--amber)" icon={<Wallet size={15} />} />
        <Kpi label="Collected (ledger)" value={inr(totals.collected)} tone="var(--indigo)" icon={<IndianRupee size={15} />} />
      </div>

      {/* Monthly financials */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-[13.5px] font-bold">Monthly financials</h2>
          <button onClick={exportMonthly} className="btn btn-ghost btn-sm"><Download size={14} /> Export CSV</button>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Month", "Invoices", "Billed", "Received", "Pending", "Collected"].map((h, i) => <th key={h} className={`th px-4 py-2.5 ${i > 0 ? "!text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {monthly.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No data yet.</td></tr>}
              {monthly.map((r) => (
                <tr key={r.month} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 text-[13px] font-semibold">{monthLabel(r.month)}</td>
                  <td className="px-4 py-3 text-right text-[12.5px] tnum">{r.invoices}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold tnum">{inr(r.billed)}</td>
                  <td className="px-4 py-3 text-right text-[13px] tnum" style={{ color: "var(--emerald)" }}>{inr(r.received)}</td>
                  <td className="px-4 py-3 text-right text-[13px] tnum" style={{ color: r.pending > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(r.pending)}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold tnum" style={{ color: "var(--indigo)" }}>{inr(r.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Top clients */}
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold"><Trophy size={14} className="text-[var(--amber)]" /> Top clients by revenue</h2>
            <button onClick={exportTop} className="btn btn-ghost btn-sm"><Download size={14} /> Export</button>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[420px] text-left">
              <thead><tr className="border-b border-[var(--line)]">{["#", "Client", "Billed", "Pending"].map((h, i) => <th key={h} className={`th px-4 py-2.5 ${i > 1 ? "!text-right" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>
                {topClients.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-[var(--muted)]">No data yet.</td></tr>}
                {topClients.map((r, i) => (
                  <tr key={r.name + i} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-2.5 text-[12.5px] text-[var(--faint)] tnum">{i + 1}</td>
                    <td className="px-4 py-2.5 text-[13px] font-semibold">{r.name}<span className="ml-1 text-[11px] text-[var(--faint)]">· {r.invoices} inv</span></td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-semibold tnum">{inr(r.billed)}</td>
                    <td className="px-4 py-2.5 text-right text-[12.5px] tnum" style={{ color: r.pending > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(r.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Collections by mode */}
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-3"><h2 className="text-[13.5px] font-bold">Collections by payment mode</h2></div>
          <div className="p-4">
            {modes.length === 0 && <p className="px-1 py-6 text-center text-sm text-[var(--muted)]">No payments recorded yet.</p>}
            <div className="space-y-2.5">
              {modes.map((m) => {
                const pct = modeTotal > 0 ? Math.round((m.amount / modeTotal) * 100) : 0;
                return (
                  <div key={m.mode}>
                    <div className="flex items-center justify-between text-[12.5px]"><span className="font-semibold">{modeLabel[m.mode] ?? m.mode}</span><span className="tnum" style={{ color: "var(--emerald)" }}>{inr(m.amount)} · {pct}%</span></div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--emerald)" }} /></div>
                  </div>
                );
              })}
            </div>
            {modes.length > 0 && <div className="mt-3 border-t border-[var(--line)] pt-2 text-right text-[12.5px] font-bold tnum">Total collected {inr(modeTotal)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div>
      <div className="mt-1.5 text-[19px] font-extrabold tnum" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}
