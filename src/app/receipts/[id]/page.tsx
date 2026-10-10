import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getReceipt } from "@/lib/receipts";
import ReceiptPrintable from "@/components/ReceiptPrintable";
import ReceiptActions from "@/components/ReceiptActions";
import { BackButton } from "@/components/NavTrail";

export const dynamic = "force-dynamic";

// One payment receipt: send it to the client (WhatsApp / PDF / link) and see it as the client will.
const ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ROLES.includes(user.role)) redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const r = await getReceipt(id);
  if (!r) redirect("/receipts");
  return (
    <div className="mx-auto w-full max-w-[900px] space-y-4">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #invoice, #invoice * { visibility: visible !important; }
        #invoice { position: absolute; left: 8mm; top: 8mm; width: calc(100% - 16mm); box-shadow: none !important; }
        .no-print { display: none !important; }
      }
      @page { size: A4; margin: 0; }`}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/receipts" />
          <div>
            <div className="eyebrow">Payment receipt</div>
            <h1 className="text-[20px] font-extrabold tracking-tight">{r.receiptNo}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] font-bold">
          <Link href={`/invoices/${r.invoiceId}`} className="text-[var(--violet)] hover:underline">Open invoice {r.invoiceNumber}</Link>
          <span className="text-[var(--line-2)]">·</span>
          <Link href="/receipts" className="text-[var(--violet)] hover:underline">All receipts</Link>
        </div>
      </div>
      <ReceiptActions isNew={sp.new === "1"} r={{ id: r.id, receiptNo: r.receiptNo, billTo: r.billTo, contact: r.contact, phone: r.phone, amount: r.amount, date: r.date, invoiceNumber: r.invoiceNumber, balanceAfter: r.balanceAfter, sentAt: r.sentAt, sentBy: r.sentBy }} />
      <ReceiptPrintable r={r} />
    </div>
  );
}
