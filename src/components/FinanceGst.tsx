"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Landmark, Download, ReceiptText } from "lucide-react";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const monthLabel = (m: string) => { if (!m) return "—"; const [y, mo] = m.split("-"); const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${names[parseInt(mo, 10) - 1] ?? mo} ${y}`; };

type Row = { month: string; count: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number; total: number };

// Indian financial year (Apr–Mar) month-string range, offset 0 = current FY.
function fyRange(offset = 0): [string, string] {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const start = (m >= 3 ? y : y - 1) + offset;
  return [`${start}-04`, `${start + 1}-03`];
}
function fyLabel(offset = 0) {
  const [from] = fyRange(offset);
  const sy = parseInt(from.slice(0, 4), 10);
  return `FY ${sy}-${String((sy + 1) % 100).padStart(2, "0")}`;
}

export default function FinanceGst({ rows, supplierState }: { rows: Row[]; supplierState: string }) {
  const [period, setPeriod] = useState("THIS_FY");
  const now = new Date();

  const [pFrom, pTo] = useMemo(() => {
    if (period === "THIS_FY") return fyRange(0);
    if (period === "LAST_FY") return fyRange(-1);
    if (period === "THIS_YEAR") return [`${now.getFullYear()}-01`, `${now.getFullYear()}-12`] as [string, string];
    return ["", ""] as [string, string];
  }, [period]);

  const filtered = useMemo(() => rows.filter((r) => (!pFrom || r.month >= pFrom) && (!pTo || r.month <= pTo)), [rows, pFrom, pTo]);

  const totals = useMemo(() => filtered.reduce((a, r) => ({
    count: a.count + r.count, taxable: a.taxable + r.taxable, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst,
    igst: a.igst + r.igst, tax: a.tax + r.tax, total: a.total + r.total,
  }), { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 }), [filtered]);

  const exportCsv = () => {
    const head = ["Month", "Invoices", "Taxable value", "CGST", "SGST", "IGST", "Total GST", "Total incl. GST"];
    const lines = filtered.map((r) => [monthLabel(r.month), r.count, r.taxable, r.cgst, r.sgst, r.igst, r.tax, r.total].join(","));
    const totalLine = ["Total", totals.count, totals.taxable, totals.cgst, totals.sgst, totals.igst, totals.tax, totals.total].join(",");
    const csv = [head.join(","), ...lines, totalLine].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `gst-summary-${period.toLowerCase()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const periodName = period === "THIS_FY" ? fyLabel(0) : period === "LAST_FY" ? fyLabel(-1) : period === "THIS_YEAR" ? String(now.getFullYear()) : "All time";

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--indigo) 10%, white), color-mix(in srgb, var(--violet) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--indigo), var(--violet))" }}><Landmark size={20} /></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">GST Summary</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">Finance</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{periodName} · GST collected <b style={{ color: "var(--indigo)" }}>{inr(totals.tax)}</b> · Supplier state {supplierState}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="select !w-auto">
              <option value="THIS_FY">{fyLabel(0)}</option>
              <option value="LAST_FY">{fyLabel(-1)}</option>
              <option value="THIS_YEAR">This year ({now.getFullYear()})</option>
              <option value="ALL">All time</option>
            </select>
            <button onClick={exportCsv} className="btn btn-violet"><Download size={15} /> Export CSV</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Taxable value" value={inr(totals.taxable)} icon={<ReceiptText size={15} />} />
        <Kpi label="Total GST collected" value={inr(totals.tax)} tone="var(--indigo)" icon={<Landmark size={15} />} />
        <Kpi label="Intra-state (CGST + SGST)" value={inr(totals.cgst + totals.sgst)} tone="var(--violet)" sub={`${inr(totals.cgst)} + ${inr(totals.sgst)}`} />
        <Kpi label="Inter-state (IGST)" value={inr(totals.igst)} tone="var(--magenta)" />
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-[13.5px] font-bold">Month-wise GST</h2>
          <span className="text-[12px] text-[var(--muted)]">For GSTR-1 / GSTR-3B filing</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[820px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Month", "Invoices", "Taxable value", "CGST", "SGST", "IGST", "Total GST", "Total incl. GST"].map((h, i) => <th key={h} className={`th px-4 py-2.5 ${i > 0 ? "!text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No invoices in this period.</td></tr>}
              {filtered.map((r) => (
                <tr key={r.month} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 text-[13px] font-semibold">{monthLabel(r.month)}</td>
                  <td className="px-4 py-3 text-right text-[12.5px] tnum">{r.count}</td>
                  <td className="px-4 py-3 text-right text-[13px] tnum">{inr(r.taxable)}</td>
                  <td className="px-4 py-3 text-right text-[12.5px] tnum text-[var(--muted)]">{inr(r.cgst)}</td>
                  <td className="px-4 py-3 text-right text-[12.5px] tnum text-[var(--muted)]">{inr(r.sgst)}</td>
                  <td className="px-4 py-3 text-right text-[12.5px] tnum text-[var(--muted)]">{inr(r.igst)}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold tnum" style={{ color: "var(--indigo)" }}>{inr(r.tax)}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold tnum">{inr(r.total)}</td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot><tr className="border-t-2 border-[var(--line-2)] bg-[var(--surface-2)] font-bold">
                <td className="px-4 py-3 text-[13px]">Total · {periodName}</td>
                <td className="px-4 py-3 text-right text-[12.5px] tnum">{totals.count}</td>
                <td className="px-4 py-3 text-right text-[13px] tnum">{inr(totals.taxable)}</td>
                <td className="px-4 py-3 text-right text-[12.5px] tnum">{inr(totals.cgst)}</td>
                <td className="px-4 py-3 text-right text-[12.5px] tnum">{inr(totals.sgst)}</td>
                <td className="px-4 py-3 text-right text-[12.5px] tnum">{inr(totals.igst)}</td>
                <td className="px-4 py-3 text-right text-[13px] tnum" style={{ color: "var(--indigo)" }}>{inr(totals.tax)}</td>
                <td className="px-4 py-3 text-right text-[13px] tnum">{inr(totals.total)}</td>
              </tr></tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-[11.5px] text-[var(--faint)]">Intra-state (client in {supplierState}) is split into CGST + SGST; inter-state is charged as IGST. Figures are derived from each invoice&apos;s tax and place of supply — verify against your books before filing. <Link href="/payments" prefetch className="text-[var(--violet)] hover:underline">Payments →</Link></p>
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
