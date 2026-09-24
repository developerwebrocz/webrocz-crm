import { getInvoice } from "@/lib/queries";
import { notFound } from "next/navigation";
import Image from "next/image";
import { inr, SERVICES } from "@/lib/domain";
import PrintButton from "@/components/PrintButton";
import { setInvoicePaid } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: PageProps<"/billing/invoice/[id]">) {
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) notFound();
  const c = inv.client;
  const monthLabel = new Date(inv.month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between no-print">
        <a href="/billing" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">← Back to billing</a>
        <div className="flex gap-2">
          <form action={setInvoicePaid}>
            <input type="hidden" name="id" value={inv.id} />
            <input type="hidden" name="paid" value={inv.status === "PAID" ? "false" : "true"} />
            <button className={`btn ${inv.status === "PAID" ? "btn-ghost" : "btn-violet"}`}>{inv.status === "PAID" ? "Mark unpaid" : "Mark as paid"}</button>
          </form>
          <PrintButton />
        </div>
      </div>

      <div className="card card-pad">
        {/* header */}
        <div className="flex items-start justify-between border-b border-[var(--line)] pb-6">
          <div className="flex items-center gap-3">
            <Image src="/webrocz-mark.png" alt="WebRocz" width={64} height={29} className="h-8 w-auto object-contain" />
            <div>
              <div className="text-lg font-extrabold tracking-tight">WebRocz</div>
              <div className="text-xs text-[var(--muted)]">Digital Marketing Agency</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold tracking-tight">INVOICE</div>
            <div className="mt-1 text-sm font-semibold tnum">{inv.number}</div>
            <div className="text-xs text-[var(--muted)]">{monthLabel}</div>
          </div>
        </div>

        {/* bill to */}
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="eyebrow">Bill to</div>
            <div className="mt-1 font-bold">{c.name}</div>
            <div className="text-sm text-[var(--muted)]">{c.pocName ?? ""}</div>
            <div className="text-sm text-[var(--muted)]">{c.pocEmail ?? ""}{c.pocMobile ? ` · ${c.pocMobile}` : ""}</div>
            <div className="text-sm text-[var(--muted)]">{c.website ?? ""}</div>
          </div>
          <div className="text-right">
            <div className="eyebrow">Details</div>
            <Row k="Invoice date" v={new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
            <Row k="Account manager" v={c.accountManager?.name ?? "—"} />
            <Row k="Client code" v={c.code} />
            <Row k="Status" v={inv.status === "PAID" ? "PAID" : "PENDING"} />
          </div>
        </div>

        {/* line items */}
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-y border-[var(--line)]">
              <th className="th">Description</th>
              <th className="th text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--line)]">
              <td className="td">
                <div className="font-semibold">Monthly retainer — {monthLabel}</div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  {c.services.map((s) => SERVICES[s.service as keyof typeof SERVICES]?.label ?? s.service).join(" · ") || "Services"}
                </div>
              </td>
              <td className="td text-right font-semibold tnum">{inr(inv.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-[var(--muted)]">Subtotal</span><span className="tnum">{inr(inv.amount)}</span></div>
            <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold"><span>Total</span><span className="tnum">{inr(inv.amount)}</span></div>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
          Thank you for your business. This is a system-generated invoice from WebRocz Agency OS.
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="mt-0.5 text-sm"><span className="text-[var(--muted)]">{k}: </span><span className="font-semibold">{v}</span></div>;
}
