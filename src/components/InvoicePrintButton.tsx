"use client";

import { Download } from "lucide-react";

// Client-side "Download PDF" — browsers' print-to-PDF renders the isolated #invoice block.
export default function InvoicePrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn-violet btn-sm">
      <Download size={14} /> Download PDF
    </button>
  );
}
