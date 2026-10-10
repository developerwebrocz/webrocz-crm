import Image from "next/image";
import { getReceipt } from "@/lib/receipts";
import ReceiptPrintable from "@/components/ReceiptPrintable";
import InvoicePrintButton from "@/components/InvoicePrintButton";

export const dynamic = "force-dynamic";

// Public, no-login payment receipt — the link sent to the client after a payment.
// Shows only the receipt, with a Download PDF button.
export default async function PublicReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getReceipt(id);

  if (!r) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4">
        <div className="text-center">
          <div className="text-[15px] font-bold">Receipt not available</div>
          <p className="mt-1 text-sm text-[var(--muted)]">This receipt link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #invoice, #invoice * { visibility: visible !important; }
        #invoice { position: absolute; left: 8mm; top: 8mm; width: calc(100% - 16mm); box-shadow: none !important; }
        .no-print { display: none !important; }
      }
      @page { size: A4; margin: 0; }`}</style>

      <div className="mx-auto w-full max-w-[900px] space-y-4">
        <div className="no-print flex items-center justify-between gap-3">
          <Image src="/webrocz-horizontal.png" alt="Web Rocz" width={150} height={38} className="h-[26px] w-auto object-contain" priority />
          <InvoicePrintButton clientName={r.billTo} invoiceNumber={`Receipt ${r.receiptNo}`} />
        </div>

        <ReceiptPrintable r={r} />

        <p className="no-print text-center text-[12px] text-[var(--faint)]">Payment receipt issued by Web Rocz · Tip: use “Download PDF” to save a copy.</p>
      </div>
    </div>
  );
}
