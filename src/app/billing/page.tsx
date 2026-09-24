import { getBillingMatrix, currentMonthKey } from "@/lib/queries";
import { toggleMonthPayment } from "@/app/actions";
import { inr, inrShort } from "@/lib/domain";
import { Avatar, Card, Eyebrow, PageHeader, ServiceChips } from "@/components/ui";
import MonthPicker from "@/components/MonthPicker";
import { Check, IndianRupee, CircleCheck, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const sp = await searchParams;
  const selMonth = typeof sp.month === "string" ? sp.month : currentMonthKey();
  const selYear = parseInt(selMonth.slice(0, 4), 10);
  const selIdx = parseInt(selMonth.slice(5, 7), 10) - 1; // 0-based month index
  const { months, rows, colTotals, totals, allMonths } = await getBillingMatrix(selYear);
  const monthLabel = new Date(selMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // selected month figures
  const mCol = colTotals[selIdx] ?? { paid: 0, pending: 0 };
  const mTotal = mCol.paid + mCol.pending;
  const mCollected = mCol.paid;
  const mPending = mCol.pending;
  const collectedPct = mTotal ? Math.round((mCollected / mTotal) * 100) : 0;

  // Show months newest-first, and don't show future months. e.g. Aug · Jul · Jun …
  const nowY = currentMonthKey().slice(0, 4);
  const lastIdx = String(selYear) === nowY ? parseInt(currentMonthKey().slice(5, 7), 10) - 1 : (selYear < parseInt(nowY, 10) ? 11 : -1);
  const displayIdx: number[] = [];
  for (let i = lastIdx; i >= 0; i--) displayIdx.push(i);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Super admin · confidential"
        title="Billing & Payments"
        sub="Monthly client payments — total, collected and pending per month. Visible to Super Admin only."
        actions={<MonthPicker months={allMonths} active={selMonth} />}
      />

      {/* summary KPIs — for the SELECTED month */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-start justify-between"><Eyebrow>{monthLabel} total</Eyebrow><span className="icon-chip chip-violet" style={{ width: 34, height: 34 }}><IndianRupee size={16} /></span></div>
          <div className="mt-2 text-[32px] font-extrabold tracking-tight tnum">{inrShort(mTotal)}</div>
          <div className="eyebrow mt-1">billable this month</div>
        </Card>
        <Card>
          <div className="flex items-start justify-between"><Eyebrow>{monthLabel} collected</Eyebrow><span className="icon-chip chip-emerald" style={{ width: 34, height: 34 }}><CircleCheck size={16} /></span></div>
          <div className="mt-2 text-[32px] font-extrabold tracking-tight text-[color:var(--emerald)] tnum">{inrShort(mCollected)}</div>
          <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-[var(--emerald)]" style={{ width: `${collectedPct}%` }} /></div>
          <div className="eyebrow mt-1.5">{collectedPct}% of {monthLabel} collected</div>
        </Card>
        <Card>
          <div className="flex items-start justify-between"><Eyebrow>{monthLabel} pending</Eyebrow><span className="icon-chip chip-rose" style={{ width: 34, height: 34 }}><Clock size={16} /></span></div>
          <div className="mt-2 text-[32px] font-extrabold tracking-tight text-[color:var(--rose)] tnum">{inrShort(mPending)}</div>
          <div className="eyebrow mt-1">unpaid this month</div>
        </Card>
      </div>

      {/* how-to strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[13px]">
        <span className="font-semibold">Payment tracker · {selYear}</span>
        <span className="flex items-center gap-1.5 text-[var(--muted)]"><span className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: "color-mix(in srgb, var(--emerald) 14%, white)", color: "var(--emerald)" }}><Check size={11} /> collected</span></span>
        <span className="flex items-center gap-1.5 text-[var(--muted)]"><span className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--faint)]">unpaid</span></span>
        <span className="ml-auto text-[var(--muted)]"><b className="text-[var(--ink)]">Tip:</b> click a month to mark it collected · click a client name to see every month&apos;s invoice</span>
      </div>

      {/* matrix */}
      <Card pad={false}>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="th">S.No</th>
                <th className="th">Date</th>
                <th className="th sticky left-0 z-10 bg-[var(--surface)]">Client</th>
                <th className="th">Services</th>
                <th className="th">Account manager</th>
                <th className="th">Amount</th>
                {displayIdx.map((i) => <th key={i} className={`th text-center ${i === selIdx ? "!text-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_7%,white)]" : ""}`}>{months[i]}</th>)}
                <th className="th text-right border-l border-[var(--line)] !text-[var(--emerald)]">Collected</th>
                <th className="th text-right !text-[var(--rose)]">Pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="td text-[var(--muted)] tnum">{r.sno}</td>
                  <td className="td whitespace-nowrap text-[13px] tnum">{new Date(r.onboardDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                  <td className="td sticky left-0 z-10 bg-[var(--surface)]">
                    <a href={`/billing/statement/${r.id}`} className="flex items-center gap-2.5" title="View full statement">
                      <Avatar name={r.name} size={28} />
                      <div className="min-w-0"><div className="truncate text-[13px] font-semibold">{r.name}</div><div className="eyebrow">{r.code}</div></div>
                    </a>
                  </td>
                  <td className="td"><ServiceChips services={r.services} /></td>
                  <td className="td whitespace-nowrap text-[13px]">{r.am ?? "—"}</td>
                  <td className="td whitespace-nowrap text-[13px] font-semibold tnum">{r.monthly > 0 ? inr(r.monthly) : "—"}</td>
                  {displayIdx.map((i) => <Cell key={i} cell={r.cells[i]} clientId={r.id} disabled={r.monthly <= 0} />)}
                  <td className="td text-right text-[13px] font-semibold text-[var(--emerald)] tnum border-l border-[var(--line)]">{r.paid > 0 ? inrShort(r.paid) : "—"}</td>
                  <td className="td text-right text-[13px] font-semibold text-[var(--rose)] tnum">{r.pending > 0 ? inrShort(r.pending) : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={months.length + 8} className="td py-12 text-center text-[var(--muted)]">No clients yet.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--line-2)] bg-[var(--surface-2)] text-[12px] font-bold">
                  <td className="td" colSpan={5}>Monthly collected / total</td>
                  <td className="td"></td>
                  {displayIdx.map((i) => {
                    const c = colTotals[i]; const tot = c.paid + c.pending;
                    return (
                      <td key={i} className="td text-center tnum">
                        {tot > 0 ? <div><span className="text-[var(--emerald)]">{inrShort(c.paid)}</span><span className="text-[var(--faint)]"> / {inrShort(tot)}</span></div> : <span className="text-[var(--faint)]">—</span>}
                      </td>
                    );
                  })}
                  <td className="td text-right text-[var(--emerald)] tnum border-l border-[var(--line)]">{inrShort(totals.paid)}</td>
                  <td className="td text-right text-[var(--rose)] tnum">{inrShort(totals.pending)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <p className="text-xs text-[var(--muted)]">
        Click <b>Generate all due invoices</b> to create an invoice for every month since each client was onboarded. Then click any month cell to open the invoice — view, print, or mark it paid. Green = paid, amber = pending, empty box = due (not generated yet).
      </p>
    </div>
  );
}

type CellData = { state: string; id?: string; month?: string; amount?: number };

function Cell({ cell, clientId, disabled }: { cell: CellData; clientId: string; disabled: boolean }) {
  if (cell.state === "na" || cell.state === "future") {
    return <td className="px-2 py-2 text-center"><span className="text-[var(--faint)]">–</span></td>;
  }
  const paid = cell.state === "paid";
  const amt = cell.amount ? inrShort(cell.amount) : "—";
  return (
    <td className="px-1.5 py-1.5 text-center">
      <form action={toggleMonthPayment} className="contents">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="month" value={cell.month} />
        <button
          type="submit"
          disabled={disabled}
          title={disabled ? "Set a monthly amount first" : paid ? `Paid ${cell.amount ? inr(cell.amount) : ""} — click to mark unpaid` : `Unpaid ${cell.amount ? inr(cell.amount) : ""} — click to mark collected`}
          className="mx-auto flex h-7 min-w-[52px] items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold transition hover:ring-2 hover:ring-[var(--violet)]/30 disabled:cursor-not-allowed disabled:opacity-40"
          style={paid
            ? { background: "color-mix(in srgb, var(--emerald) 14%, white)", color: "var(--emerald)" }
            : { background: "var(--surface-2)", color: "var(--faint)", border: "1px solid var(--line)" }}
        >
          {paid && <Check size={12} />}{amt}
        </button>
      </form>
    </td>
  );
}
