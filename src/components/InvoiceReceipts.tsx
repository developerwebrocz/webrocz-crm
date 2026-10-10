import Link from "next/link";
import { getInvoiceReceipts } from "@/lib/receipts";
import { ReceiptText, CheckCircle2, Clock3, ArrowRight } from "lucide-react";

// Under an invoice: every amount received against it, each with its receipt to send to the client.
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmt = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return d ? `${d}-${m}-${y}` : iso || "—"; };

export default async function InvoiceReceipts({ invoiceId }: { invoiceId: string }) {
  const rows = await getInvoiceReceipts(invoiceId);
  if (!rows.length) return null;
  return (
    <div className="no-print card !p-0 mx-auto mt-5 w-full max-w-[900px] overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-5 py-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: "color-mix(in srgb, var(--emerald) 12%, white)", color: "var(--emerald)" }}><ReceiptText size={16} /></span>
        <div>
          <div className="text-[14px] font-bold">Receipts</div>
          <div className="text-[11.5px] text-[var(--muted)]">One receipt for each amount received on this invoice — send it to the client.</div>
        </div>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {rows.map((r) => {
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1 basis-[220px]">
                <div className="text-[13.5px] font-bold"><span className="text-[var(--emerald)] tnum">{inr(r.amount)}</span> <span className="font-normal text-[var(--muted)]">received on</span> <span className="tnum">{fmt(r.date)}</span></div>
                <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">{[r.receiptNo, r.mode, r.ref].filter(Boolean).join(" · ")}</div>
              </div>
              {r.sent
                ? <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold text-[var(--emerald)]" style={{ background: "color-mix(in srgb, var(--emerald) 11%, white)" }}><CheckCircle2 size={12} /> Receipt sent</span>
                : <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: "color-mix(in srgb, var(--amber) 14%, white)", color: "#92600a" }}><Clock3 size={12} /> Receipt not sent</span>}
              <Link href={`/receipts/${r.id}`} className={r.sent ? "btn btn-ghost btn-sm" : "btn btn-violet btn-sm"}><ReceiptText size={14} /> {r.sent ? "View receipt" : "Send receipt"} <ArrowRight size={13} /></Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Above a paid / part-paid invoice: before payment the client is sent the INVOICE; once they
// have paid, what goes to them is the RECEIPT. This says so and opens the receipt to send.
export async function InvoiceReceiptNotice({ invoiceId, total, received }: { invoiceId: string; total: number; received: number }) {
  if (!(received > 0)) return null;
  const rows = await getInvoiceReceipts(invoiceId);
  if (!rows.length) return null;
  const pending = rows.filter((r) => !r.sent);
  const target = pending[pending.length - 1] ?? rows[0]; // oldest one still to send, else the latest
  const paid = total > 0 && received >= total;
  const tone = pending.length ? "var(--emerald)" : "var(--muted)";
  return (
    <div className="no-print mx-auto mb-4 flex w-full max-w-[900px] flex-wrap items-center justify-between gap-3 rounded-[12px] border px-4 py-3" style={{ background: `color-mix(in srgb, ${tone} 7%, white)`, borderColor: `color-mix(in srgb, ${tone} 28%, white)` }}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-[9px] text-white" style={{ background: pending.length ? "var(--emerald)" : "var(--muted)" }}><ReceiptText size={16} /></span>
        <div>
          <div className="text-[13.5px] font-bold">
            {paid ? "Paid in full" : `${inr(received)} received · ${inr(Math.max(0, total - received))} still due`}
            {pending.length ? ` — send the receipt to the client` : " — receipt sent"}
          </div>
          <div className="text-[12px] text-[var(--muted)]">
            {paid
              ? "The invoice goes to the client before payment. After payment, the client gets the receipt."
              : "Send the receipt for the amount received. The invoice still stands for the balance."}
            {pending.length > 1 ? ` ${pending.length} receipts are waiting.` : ""}
          </div>
        </div>
      </div>
      <Link href={`/receipts/${target.id}`} className={pending.length ? "btn text-white" : "btn btn-ghost"} style={pending.length ? { background: "var(--emerald)" } : undefined}>
        <ReceiptText size={15} /> {pending.length ? "Send receipt" : "View receipt"} <ArrowRight size={14} />
      </Link>
    </div>
  );
}
