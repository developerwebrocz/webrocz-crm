"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { getInvoiceForDownload } from "@/app/payments-actions";
import InvoicePrintable from "@/components/InvoicePrintable";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { invoiceFileName } from "@/lib/print-invoice";

// "Download invoice" on the Payments pipeline (Super Admin). The invoice is loaded, drawn
// off-screen exactly as it prints, turned into a PDF and saved as
// "<client name> - <invoice number>.pdf" — without leaving the Payments page.

/* eslint-disable @typescript-eslint/no-explicit-any */
const inr = (v: number) => "₹" + Math.round(v || 0).toLocaleString("en-IN");
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };

export type DownloadableInvoice = { id: string; number: string; issueDate: string; total: number; balance: number };

// One button = one invoice. `label` is the button text; `compact` shows just the icon.
export function InvoiceDownloadButton({ invoiceId, number, clientName, label = "Download", compact }: { invoiceId: string; number: string; clientName: string; label?: string; compact?: boolean }) {
  const [state, setState] = useState<"" | "busy" | "error">("");
  const [invoice, setInvoice] = useState<any>(null); // loaded invoice, drawn off-screen until the PDF is saved
  const holder = useRef<HTMLDivElement>(null);

  // Once the invoice is on the page (off-screen), turn it into a PDF and save it.
  useEffect(() => {
    if (!invoice) return;
    let alive = true;
    (async () => {
      try {
        const node = holder.current?.querySelector<HTMLElement>("#invoice");
        if (!node) throw new Error("not drawn");
        const blob = await buildInvoicePdf(node);
        if (!alive) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${invoiceFileName(invoice.billTo || clientName, invoice.number || number)}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        setState("");
      } catch { if (alive) setState("error"); }
      finally { if (alive) setInvoice(null); }
    })();
    return () => { alive = false; };
  }, [invoice, clientName, number]);

  const start = async () => {
    if (state === "busy") return;
    setState("busy");
    const inv = await getInvoiceForDownload(invoiceId).catch(() => null);
    if (!inv) { setState("error"); return; }
    setInvoice(inv);
  };

  return (
    <>
      <button type="button" onClick={start} disabled={state === "busy"} title={state === "error" ? "Could not download — click to try again" : `Download invoice ${number} as PDF`}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[7px] border px-2.5 py-1 text-[12px] font-semibold hover:bg-[var(--surface)] disabled:opacity-60 ${state === "error" ? "border-[var(--rose)] text-[var(--rose)]" : "border-[var(--line-2)] text-[var(--ink-2)]"}`}>
        <Download size={13} />{compact ? null : state === "busy" ? "Preparing…" : state === "error" ? "Try again" : label}
      </button>
      {invoice && (
        <div ref={holder} aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 820, background: "#ffffff", pointerEvents: "none" }}>
          <InvoicePrintable invoice={invoice} />
        </div>
      )}
    </>
  );
}

// A client with several invoices: list them, each with its own download.
export function ClientInvoicesModal({ clientName, invoices, close }: { clientName: string; invoices: DownloadableInvoice[]; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[88vh] w-full max-w-[620px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Invoices · {clientName}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{invoices.length} invoice{invoices.length === 1 ? "" : "s"} — download any of them as a PDF.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto scroll-thin">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]"><th className="th">Invoice</th><th className="th">Date</th><th className="th !text-right">Total</th><th className="th !text-right">Pending</th><th className="th" /></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="whitespace-nowrap px-5 py-2.5 font-semibold">{i.number}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 tnum text-[var(--ink-2)]">{fmtDate(i.issueDate)}</td>
                  <td className="px-5 py-2.5 text-right tnum">{inr(i.total)}</td>
                  <td className="px-5 py-2.5 text-right tnum" style={{ color: i.balance > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(i.balance)}</td>
                  <td className="px-5 py-2.5 text-right"><InvoiceDownloadButton invoiceId={i.id} number={i.number} clientName={clientName} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end border-t border-[var(--line)] px-6 py-3"><button type="button" onClick={close} className="btn btn-ghost">Close</button></div>
      </div>
    </div>
  );
}
