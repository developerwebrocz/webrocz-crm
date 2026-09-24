import { SALES_PIPELINES } from "@/lib/domain";
import ReportDownload from "@/components/ReportDownload";

type ExecRow = { id: string; name: string; leads: number; positive: number; followups: number; meetings: number; quotations: number; proposals: number; onboarded: number; lost: number; revenue: number };
type DayRow = { date: string; leads: number; onboarded: number; lost: number; revenue: number };
type MonthRow = { month: string; leads: number; onboarded: number; lost: number; revenue: number };
type CatRow = { category: string; leads: number; quotations: number; onboarded: number; lost: number; revenue: number };

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const monthLabel = (m: string) => { const [y, mo] = m.split("-"); const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${names[parseInt(mo, 10) - 1] ?? mo} ${y}`; };

export default function SalesReports({ execRows, categoryRows, dailyRows, monthlyRows, totals, execs, exec, pipeline, from, to }: {
  execRows: ExecRow[]; categoryRows: CatRow[]; dailyRows: DayRow[]; monthlyRows: MonthRow[]; totals: { leads: number; onboarded: number; lost: number; revenue: number };
  execs: { id: string; name: string }[]; exec: string; pipeline: string; from: string; to: string;
}) {
  const csvSections = [
    { title: "Summary", head: ["Total leads", "Onboarded", "Lost", "Revenue"], rows: [[totals.leads, totals.onboarded, totals.lost, totals.revenue]] },
    { title: "Category-wise report", head: ["Category", "Leads", "Quotations", "Onboarded", "Lost", "Revenue"], rows: categoryRows.map((r) => [r.category, r.leads, r.quotations, r.onboarded, r.lost, r.revenue]) },
    { title: "Daily report", head: ["Date", "Leads", "Onboarded", "Lost", "Revenue"], rows: dailyRows.map((r) => [r.date, r.leads, r.onboarded, r.lost, r.revenue]) },
    { title: "Monthly report", head: ["Month", "Leads", "Onboarded", "Lost", "Revenue"], rows: monthlyRows.map((r) => [monthLabel(r.month), r.leads, r.onboarded, r.lost, r.revenue]) },
    { title: "Executive performance", head: ["Executive", "Leads", "Active", "Follow-ups", "Meetings", "Quotations", "Onboarded", "Lost", "Revenue"], rows: execRows.map((r) => [r.name, r.leads, r.positive, r.followups, r.meetings, r.quotations, r.onboarded, r.lost, r.revenue]) },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Sales CRM · Reports</span>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">Sales Reports</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">{SALES_PIPELINES[pipeline as keyof typeof SALES_PIPELINES] ?? pipeline} · all figures from live data</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {/* date-range filter (GET form → query params) */}
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="pipeline" value={pipeline} />
            <label className="block"><span className="eyebrow">Employee</span><select name="exec" defaultValue={exec} className="select !py-2 mt-1 !w-auto"><option value="">All employees</option>{execs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
            <label className="block"><span className="eyebrow">From</span><input type="date" name="from" defaultValue={from} className="input !py-2 mt-1" /></label>
            <label className="block"><span className="eyebrow">To</span><input type="date" name="to" defaultValue={to} className="input !py-2 mt-1" /></label>
            <button className="btn btn-dark">Apply</button>
            {(from || to || exec) && <a href={`/sales/reports?pipeline=${pipeline}`} className="btn btn-ghost">Clear</a>}
          </form>
          <ReportDownload sections={csvSections} filename={`sales-report-${pipeline}-${new Date().toISOString().slice(0, 10)}.csv`} />
        </div>
      </div>

      {/* totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Total leads" value={totals.leads} />
        <Tile label="Onboarded" value={totals.onboarded} tone="var(--emerald)" />
        <Tile label="Lost" value={totals.lost} tone="var(--rose)" />
        <Tile label="Revenue (won)" value={inr(totals.revenue)} tone="var(--violet)" />
      </div>

      {/* category-wise */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3.5"><h2 className="text-[14.5px] font-bold">Category-wise report</h2></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Category", "Leads", "Quotations", "Onboarded", "Lost", "Revenue"].map((h, i) => <th key={h} className={`th px-5 py-2.5 ${i > 0 && i < 5 ? "text-center" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {categoryRows.map((r) => (
                <tr key={r.category} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[13px] font-bold" style={{ color: r.category === "Website Development" ? "var(--indigo)" : "var(--magenta)" }}>{r.category}</td>
                  <td className="px-5 py-3 text-center text-[13px] font-semibold tnum">{r.leads}</td>
                  <td className="px-5 py-3 text-center text-[13px] tnum">{r.quotations}</td>
                  <td className="px-5 py-3 text-center text-[13px] tnum" style={{ color: "var(--emerald)" }}>{r.onboarded}</td>
                  <td className="px-5 py-3 text-center text-[13px] tnum" style={{ color: "var(--rose)" }}>{r.lost}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum">{r.revenue ? inr(r.revenue) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* daily + monthly */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-3.5"><h2 className="text-[14.5px] font-bold">Daily report</h2></div>
          <div className="max-h-[360px] overflow-auto scroll-thin">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[var(--surface)]"><tr className="border-b border-[var(--line)]">{["Date", "Leads", "Onboarded", "Lost", "Revenue"].map((h, i) => <th key={h} className={`th px-4 py-2.5 ${i > 0 && i < 4 ? "text-center" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>
                {dailyRows.map((r) => (
                  <tr key={r.date} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-2.5 text-[12.5px] font-semibold tnum">{r.date}</td>
                    <td className="px-4 py-2.5 text-center text-[12.5px] tnum">{r.leads}</td>
                    <td className="px-4 py-2.5 text-center text-[12.5px] tnum" style={{ color: "var(--emerald)" }}>{r.onboarded}</td>
                    <td className="px-4 py-2.5 text-center text-[12.5px] tnum" style={{ color: "var(--rose)" }}>{r.lost}</td>
                    <td className="px-4 py-2.5 text-[12.5px] font-semibold tnum">{r.revenue ? inr(r.revenue) : "—"}</td>
                  </tr>
                ))}
                {dailyRows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--muted)]">No data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-3.5"><h2 className="text-[14.5px] font-bold">Monthly report</h2></div>
          <div className="max-h-[360px] overflow-auto scroll-thin">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[var(--surface)]"><tr className="border-b border-[var(--line)]">{["Month", "Leads", "Onboarded", "Lost", "Revenue"].map((h, i) => <th key={h} className={`th px-4 py-2.5 ${i > 0 && i < 4 ? "text-center" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>
                {monthlyRows.map((r) => (
                  <tr key={r.month} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-2.5 text-[12.5px] font-semibold">{monthLabel(r.month)}</td>
                    <td className="px-4 py-2.5 text-center text-[12.5px] tnum">{r.leads}</td>
                    <td className="px-4 py-2.5 text-center text-[12.5px] tnum" style={{ color: "var(--emerald)" }}>{r.onboarded}</td>
                    <td className="px-4 py-2.5 text-center text-[12.5px] tnum" style={{ color: "var(--rose)" }}>{r.lost}</td>
                    <td className="px-4 py-2.5 text-[12.5px] font-semibold tnum">{r.revenue ? inr(r.revenue) : "—"}</td>
                  </tr>
                ))}
                {monthlyRows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--muted)]">No data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* executive performance */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3.5"><h2 className="text-[14.5px] font-bold">Sales executive performance</h2></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[860px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Executive", "Leads", "Active", "Follow-ups", "Meetings", "Quotations", "Proposals", "Onboarded", "Lost", "Revenue"].map((h, i) => <th key={h} className={`th px-5 py-2.5 ${i > 0 && i < 9 ? "text-center" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {execRows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[13px] font-semibold">{r.name}</td>
                  <td className="px-5 py-3 text-center text-[13px] font-bold tnum">{r.leads}</td>
                  <td className="px-5 py-3 text-center text-[13px] tnum">{r.positive}</td>
                  <td className="px-5 py-3 text-center text-[13px] tnum">{r.followups}</td>
                  <td className="px-5 py-3 text-center text-[13px] tnum">{r.meetings}</td>
                  <td className="px-5 py-3 text-center text-[13px] tnum">{r.quotations}</td>
                  <td className="px-5 py-3 text-center text-[13px] tnum">{r.proposals}</td>
                  <td className="px-5 py-3 text-center text-[13px] tnum" style={{ color: "var(--emerald)" }}>{r.onboarded}</td>
                  <td className="px-5 py-3 text-center text-[13px] tnum" style={{ color: "var(--rose)" }}>{r.lost}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum">{r.revenue ? inr(r.revenue) : "—"}</td>
                </tr>
              ))}
              {execRows.length === 0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No data for this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="card card-pad">
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tone ?? "var(--muted)" }}>{label}</div>
      <div className="mt-1.5 text-[24px] font-extrabold leading-none tnum">{value}</div>
    </div>
  );
}
