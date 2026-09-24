import { getClientStatement } from "@/lib/queries";
import { viewMonthInvoice } from "@/app/actions";
import { notFound } from "next/navigation";
import Image from "next/image";
import { inr, SERVICES } from "@/lib/domain";
import { Card } from "@/components/ui";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StatementPage({ params }: PageProps<"/billing/statement/[id]">) {
  const { id } = await params;
  const data = await getClientStatement(id);
  if (!data) notFound();
  const { client: c, rows, totals } = data;
  const paidMonths = rows.filter((r) => r.status === "PAID").length;
  const pendingMonths = rows.length - paidMonths;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <a href="/billing" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">← Back to billing</a>

      {/* client header */}
      <div className="card card-pad">
        <div className="flex items-center gap-3">
          <Image src="/webrocz-mark.png" alt="WebRocz" width={64} height={29} className="h-8 w-auto object-contain" />
          <div className="min-w-0 flex-1">
            <div className="text-xl font-extrabold tracking-tight">{c.name}</div>
            <div className="text-sm text-[var(--muted)]">
              {c.pocName ?? ""} · {c.accountManager?.name ? `AM ${c.accountManager.name}` : "No AM"} · {c.code}
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">{c.services.map((s) => SERVICES[s.service as keyof typeof SERVICES]?.label ?? s.service).join(" · ")}</div>
          </div>
        </div>
      </div>

      {/* how much paid · how much pending · total — for this client */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card style={{ background: "color-mix(in srgb, var(--emerald) 6%, white)", borderColor: "color-mix(in srgb, var(--emerald) 20%, white)" }}>
          <div className="eyebrow">Paid so far</div>
          <div className="mt-1 text-[28px] font-extrabold text-[color:var(--emerald)] tnum">{inr(totals.collected)}</div>
          <div className="eyebrow mt-1 tnum">{paidMonths} of {totals.months} months paid</div>
        </Card>
        <Card style={{ background: "color-mix(in srgb, var(--rose) 5%, white)", borderColor: "color-mix(in srgb, var(--rose) 18%, white)" }}>
          <div className="eyebrow">Pending / remaining</div>
          <div className="mt-1 text-[28px] font-extrabold text-[color:var(--rose)] tnum">{inr(totals.pending)}</div>
          <div className="eyebrow mt-1 tnum">{pendingMonths} months not paid</div>
        </Card>
        <Card>
          <div className="eyebrow">Total (all months)</div>
          <div className="mt-1 text-[28px] font-extrabold tnum">{inr(totals.billed)}</div>
          <div className="eyebrow mt-1 tnum">{totals.months} months · {inr(c.monthlyRetainer)}/mo</div>
        </Card>
      </div>

      {/* every month with its invoice */}
      <Card pad={false}>
        <div className="p-4"><h2 className="text-[15px] font-bold">Month-wise payments</h2><p className="text-xs text-[var(--muted)]">How much is collected and pending for each month. Open the invoice to view or print.</p></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead>
              <tr className="border-y border-[var(--line)]">
                <th className="th">Month</th>
                <th className="th">Invoice #</th>
                <th className="th text-right">Amount</th>
                <th className="th text-right !text-[var(--emerald)]">Collected</th>
                <th className="th text-right !text-[var(--rose)]">Pending</th>
                <th className="th text-right">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const paid = r.status === "PAID";
                return (
                  <tr key={r.month} className="border-b border-[var(--line)] last:border-0">
                    <td className="td font-medium">{r.label}</td>
                    <td className="td text-[var(--muted)]">{r.number ?? "—"}</td>
                    <td className="td text-right font-semibold tnum">{inr(r.amount)}</td>
                    <td className="td text-right tnum font-semibold text-[var(--emerald)]">{paid ? inr(r.amount) : "—"}</td>
                    <td className="td text-right tnum font-semibold text-[var(--rose)]">{paid ? "—" : inr(r.amount)}</td>
                    <td className="td text-right">
                      <form action={viewMonthInvoice} className="inline">
                        <input type="hidden" name="clientId" value={c.id} />
                        <input type="hidden" name="month" value={r.month} />
                        <button className="btn btn-ghost btn-sm"><FileText size={13} /> View</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="td py-8 text-center text-[var(--muted)]">No billable months yet.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--line-2)] bg-[var(--surface-2)] font-bold">
                  <td className="td" colSpan={2}>Total · {totals.months} months</td>
                  <td className="td text-right tnum">{inr(totals.billed)}</td>
                  <td className="td text-right tnum text-[var(--emerald)]">{inr(totals.collected)}</td>
                  <td className="td text-right tnum text-[var(--rose)]">{inr(totals.pending)}</td>
                  <td className="td"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
