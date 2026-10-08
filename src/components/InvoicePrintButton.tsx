"use client";

import { Download } from "lucide-react";
import { printInvoiceAs } from "@/lib/print-invoice";

// Client-side "Download PDF" — browsers' print-to-PDF renders the isolated #invoice block.
// The PDF is named after the client ("<client name> - <invoice number>").
export default function InvoicePrintButton({ clientName = "", invoiceNumber = "" }: { clientName?: string; invoiceNumber?: string }) {
  return (
    <button onClick={() => printInvoiceAs(clientName, invoiceNumber)} className="btn btn-violet btn-sm">
      <Download size={14} /> Download PDF
    </button>
  );
}
