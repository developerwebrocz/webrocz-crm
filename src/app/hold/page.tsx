import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { companyLabel } from "@/lib/domain";
import { setInvoiceHold } from "@/app/reminder-actions";
import { Eyebrow } from "@/components/ui";
import { PauseCircle, PlayCircle, Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

// Hold — the accounts team's invoices put on hold (Invoices → an invoice → Hold). They are out of
// Payment Reminders until taken off hold here or on the invoice.
const ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmt = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; };

export default async function HoldPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ROLES.includes(user.role)) redirect("/");
  const rows = await prisma.salesInvoice.findMany({
    where: { onHold: true },
    select: { id: true, number: true, billTo: true, company: true, total: true, received: true, issueDate: true, holdOn: true, holdBy: true },
    orderBy: [{ holdOn: "desc" }, { issueDate: "desc" }],
  });
  const balance = rows.reduce((s, r) => s + Math.max(0, r.total - r.received), 0);

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Accounts · invoices on hold</Eyebrow>
        <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Hold</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Invoices moved to Hold (Invoices → open the client → Hold). They are out of Payment Reminders until you remove the hold.</p>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]"><PauseCircle size={16} className="text-[var(--amber)]" /> {rows.length} invoice{rows.length === 1 ? "" : "s"} on hold</div>
          <div className="text-[13px] text-[var(--muted)]">Pending <b className="text-[15px] text-[var(--ink)] tnum">{inr(balance)}</b></div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
              <th className="th px-5 py-2.5">Client</th><th className="th">Invoice</th><th className="th">Company</th><th className="th">Invoice date</th>
              <th className="th !text-right">Total</th><th className="th !text-right">Pending</th><th className="th">On hold since</th><th className="th">Actions</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-[13.5px] text-[var(--muted)]">No invoices on hold.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 font-semibold text-[var(--ink)]">{r.billTo || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{r.number}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">{r.company ? companyLabel(r.company) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)] tnum">{fmt(r.issueDate)}</td>
                  <td className="px-4 py-3 text-right tnum">{inr(r.total)}</td>
                  <td className="px-4 py-3 text-right font-semibold tnum text-[var(--amber)]">{inr(Math.max(0, r.total - r.received))}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]"><span className="tnum">{fmt(r.holdOn)}</span>{r.holdBy && <span className="text-[var(--muted)]"> · {r.holdBy}</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Link href={`/invoices/${r.id}`} className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface)]"><Pencil size={13} /> Open</Link>
                      <form action={setInvoiceHold}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="hold" value="0" />
                        <button type="submit" title="Back to Payment Reminders" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--emerald)] hover:bg-[var(--surface)]"><PlayCircle size={13} /> Remove hold</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
