"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { downloadInvoicePdf } from "@/lib/invoice-download";
import { printInvoiceAs } from "@/lib/print-invoice";

// "Download PDF" on the shared invoice link: saves the invoice as a PDF file named after the
// client ("<client name> - <invoice number>.pdf"). No print box, so the browser cannot stamp
// its own date / web address on the page. If the PDF cannot be built, it falls back to printing.
export default function InvoicePrintButton({ clientName = "", invoiceNumber = "" }: { clientName?: string; invoiceNumber?: string }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (busy) return;
    setBusy(true);
    try { await downloadInvoicePdf(clientName, invoiceNumber); }
    catch { printInvoiceAs(clientName, invoiceNumber); }
    finally { setBusy(false); }
  };
  return (
    <button onClick={download} disabled={busy} className="btn btn-violet btn-sm disabled:opacity-60">
      <Download size={14} /> {busy ? "Preparing PDF…" : "Download PDF"}
    </button>
  );
}
