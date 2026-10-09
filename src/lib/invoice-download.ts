import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { invoiceFileName } from "@/lib/print-invoice";

// "Download PDF" saves a real PDF file of the invoice, named after the client.
//
// It used to open the browser's Print box. A browser prints its own header and footer on every
// page it prints — today's date and time, the page title and the web address — so the saved
// PDF carried a second date (the day it was downloaded) next to the invoice's own date. Building
// the PDF directly leaves only what is on the invoice.

export function saveBlobAs(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// `ready` lets a caller pass a PDF it has already started building (to make the click instant).
export async function downloadInvoicePdf(clientName: string, invoiceNumber: string, ready?: Promise<Blob> | null): Promise<void> {
  const node = document.getElementById("invoice");
  if (!node) throw new Error("Invoice is not on the page.");
  const blob = await (ready ?? buildInvoicePdf(node));
  saveBlobAs(blob, `${invoiceFileName(clientName, invoiceNumber)}.pdf`);
}
