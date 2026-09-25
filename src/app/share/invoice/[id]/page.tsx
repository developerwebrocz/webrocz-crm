import { getPublicInvoice } from "@/lib/queries";
import InvoicePrintable from "@/components/InvoicePrintable";
import InvoicePrintButton from "@/components/InvoicePrintButton";
import Image from "next/image";

export const dynamic = "force-dynamic";

// Public, no-login invoice page — the link the accountant sends the client on WhatsApp.
// Shows the same printable invoice as the app, with a Download PDF (print) button.
export default async function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getPublicInvoice(id);

  if (!invoice) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4">
        <div className="text-center">
          <div className="text-[15px] font-bold">Invoice not available</div>
          <p className="mt-1 text-sm text-[var(--muted)]">This invoice link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #invoice, #invoice * { visibility: visible !important; }
        #invoice { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="mx-auto w-full max-w-[900px] space-y-4">
        <div className="no-print flex items-center justify-between gap-3">
          <Image src="/webrocz-horizontal.png" alt="Web Rocz" width={150} height={38} className="h-[26px] w-auto object-contain" priority />
          <InvoicePrintButton />
        </div>

        <InvoicePrintable invoice={invoice} />

        <p className="no-print text-center text-[12px] text-[var(--faint)]">Invoice issued by Web Rocz · Tip: use “Download PDF” to save a copy.</p>
      </div>
    </div>
  );
}
