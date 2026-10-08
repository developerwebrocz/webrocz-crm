// "Download PDF" on an invoice uses the browser's print-to-PDF, which names the file after the
// page title. So the title is switched to "<client name> - <invoice number>" just for the
// print and put back afterwards — the saved PDF carries the client's name.

// Characters Windows / macOS do not allow in a file name are replaced ("GST/2026-27/005" → "GST-2026-27-005").
const clean = (v: string) => (v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().replace(/^[-. ]+|[-. ]+$/g, "");

export function invoiceFileName(clientName: string, invoiceNumber: string): string {
  return [clean(clientName), clean(invoiceNumber)].filter(Boolean).join(" - ") || "Invoice";
}

export function printInvoiceAs(clientName: string, invoiceNumber: string) {
  const original = document.title;
  let restored = false;
  const restore = () => { if (restored) return; restored = true; document.title = original; window.removeEventListener("afterprint", restore); };
  document.title = invoiceFileName(clientName, invoiceNumber);
  window.addEventListener("afterprint", restore);
  window.print();
  // Browsers that never fire "afterprint" still get the title back.
  setTimeout(restore, 60_000);
}
