"use client";

import { useMemo, useState } from "react";
import { Landmark, Download, ReceiptText } from "lucide-react";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const monthLabel = (m: string) => { if (!m) return "—"; const [y, mo] = m.split("-"); const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${names[parseInt(mo, 10) - 1] ?? mo} ${y}`; };

type Row = { month: string; count: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number; total: number };
type InvRow = { number: string; date: string; billTo: string; gstin: string; placeOfSupply: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number; total: number };
const fmtD = (iso: string) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };

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

export default function FinanceGst({ rows, invoiceRows = [], supplierState }: { rows: Row[]; invoiceRows?: InvRow[]; supplierState: string }) {
  const [period, setPeriod] = useState("THIS_FY");
  // "Custom": From – To dates picked on the calendar (invoice date, both days included)
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const custom = period === "CUSTOM";
  const inCustom = (d: string) => (!cFrom || (d || "") >= cFrom) && (!cTo || (d || "") <= cTo);
  const now = new Date();

  const [pFrom, pTo] = useMemo(() => {
    if (period === "THIS_FY") return fyRange(0);
    if (period === "LAST_FY") return fyRange(-1);
    if (period === "THIS_YEAR") return [`${now.getFullYear()}-01`, `${now.getFullYear()}-12`] as [string, string];
    return ["", ""] as [string, string];
  }, [period]);

  // custom dates: the month rows are added up from the invoices inside the dates
  const filtered = useMemo(() => {
    if (!custom) return rows.filter((r) => (!pFrom || r.month >= pFrom) && (!pTo || r.month <= pTo));
    const byMonth = new Map<string, Row>();
    for (const i of invoiceRows) {
      if (!i.date || !inCustom(i.date)) continue;
      const month = i.date.slice(0, 7);
      const m = byMonth.get(month) ?? { month, count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 };
      m.count += 1; m.taxable += i.taxable; m.cgst += i.cgst; m.sgst += i.sgst; m.igst += i.igst; m.tax += i.cgst + i.sgst + i.igst; m.total += i.total;
      byMonth.set(month, m);
    }
    return [...byMonth.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [rows, invoiceRows, pFrom, pTo, custom, cFrom, cTo]); // eslint-disable-line react-hooks/exhaustive-deps
  const fileTag = custom ? `${cFrom || "start"}-to-${cTo || "today"}` : period.toLowerCase();

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
    a.href = url; a.download = `gst-summary-${fileTag}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // GSTR-1 (B2B) invoice-wise export — the format a CA needs for filing.
  // the GST invoices of the chosen period (custom dates or months) — the list below and the GSTR-1 file
  const periodInvoices = invoiceRows
    .filter((r) => { if (custom) return inCustom(r.date); const m = (r.date || "").slice(0, 7); return (!pFrom || m >= pFrom) && (!pTo || m <= pTo); })
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.number.localeCompare(b.number, undefined, { numeric: true }));
  const exportGstr1 = () => {
    const inv = periodInvoices;
    const head = ["Invoice No", "Invoice Date", "Client", "Client GSTIN", "Place of Supply", "Rate %", "Taxable Value", "CGST", "SGST", "IGST", "Invoice Total"];
    const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = inv.map((r) => [r.number, fmtD(r.date), r.billTo, r.gstin, r.placeOfSupply, r.rate, r.taxable, r.cgst, r.sgst, r.igst, r.total].map(esc).join(","));
    const csv = [head.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `gstr1-b2b-${fileTag}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const periodName = custom ? `${cFrom ? fmtD(cFrom) : "Start"} – ${cTo ? fmtD(cTo) : "today"}` : period === "THIS_FY" ? fyLabel(0) : period === "LAST_FY" ? fyLabel(-1) : period === "THIS_YEAR" ? String(now.getFullYear()) : "All time";

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
          <div className="flex flex-wrap items-center gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="select !w-auto">
              <option value="THIS_FY">{fyLabel(0)}</option>
              <option value="LAST_FY">{fyLabel(-1)}</option>
              <option value="THIS_YEAR">This year ({now.getFullYear()})</option>
              <option value="ALL">All time</option>
              <option value="CUSTOM">Custom</option>
            </select>
            {custom && (
              <>
                <label className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--muted)]">From
                  <input type="date" value={cFrom} max={cTo || undefined} onChange={(e) => setCFrom(e.target.value)} className="input !w-auto" />
                </label>
                <label className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--muted)]">To
                  <input type="date" value={cTo} min={cFrom || undefined} onChange={(e) => setCTo(e.target.value)} className="input !w-auto" />
                </label>
              </>
            )}
            <button onClick={exportCsv} className="btn btn-ghost"><Download size={15} /> Summary CSV</button>
            <button onClick={exportGstr1} className="btn btn-violet"><ReceiptText size={15} /> GSTR-1 (invoice-wise)</button>
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

      {/* every GST invoice of the period, with the count — what makes up the figures above */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
          <h2 className="text-[13.5px] font-bold">Invoices · {periodName}</h2>
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12px] font-bold tnum">{periodInvoices.length} invoice{periodInvoices.length === 1 ? "" : "s"}</span>
        </div>
        <div className="max-h-[560px] overflow-auto scroll-thin">
          <table className="w-full min-w-[980px]">
            <thead className="sticky top-0 bg-[var(--surface)]"><tr className="border-b border-[var(--line)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">Invoice no</th><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Client</th><th className="px-4 py-2.5">GSTIN</th>
              <th className="px-4 py-2.5 text-right">Taxable</th><th className="px-4 py-2.5 text-right">CGST</th><th className="px-4 py-2.5 text-right">SGST</th><th className="px-4 py-2.5 text-right">IGST</th><th className="px-4 py-2.5 text-right">Total</th>
            </tr></thead>
            <tbody>
              {periodInvoices.length === 0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No invoices in this period.</td></tr>}
              {periodInvoices.map((r, i) => (
                <tr key={r.number} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-2.5 text-[12px] text-[var(--muted)] tnum">{i + 1}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[13px] font-semibold">{r.number}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[12.5px] tnum">{fmtD(r.date)}</td>
                  <td className="px-4 py-2.5 text-[13px]">{r.billTo}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-[var(--muted)]">{r.gstin || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-[13px] tnum">{inr(r.taxable)}</td>
                  <td className="px-4 py-2.5 text-right text-[12.5px] tnum text-[var(--muted)]">{inr(r.cgst)}</td>
                  <td className="px-4 py-2.5 text-right text-[12.5px] tnum text-[var(--muted)]">{inr(r.sgst)}</td>
                  <td className="px-4 py-2.5 text-right text-[12.5px] tnum text-[var(--muted)]">{inr(r.igst)}</td>
                  <td className="px-4 py-2.5 text-right text-[13px] font-semibold tnum">{inr(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11.5px] text-[var(--faint)]">Intra-state (client in {supplierState}) is split into CGST + SGST; inter-state is charged as IGST. Figures are derived from each invoice&apos;s tax and place of supply — verify against your books before filing.</p>
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
