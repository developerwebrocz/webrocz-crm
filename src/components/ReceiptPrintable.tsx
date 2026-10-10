import { amountInWords, companySeller } from "@/lib/domain";
import type { Receipt } from "@/lib/receipts";

// The printable payment receipt — same look as the invoice (company header, violet bars,
// signature) and shared by the in-app receipt page and the public share link. Pure markup.
// Its root carries id="invoice" so the same "Download PDF" builder is used for it.

const inr = (v: number) => "₨ " + (v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const MODE: Record<string, string> = { UPI: "UPI", BANK: "Bank transfer", CHEQUE: "Cheque", CASH: "Cash", CARD: "Card", OTHER: "Other" };

export default function ReceiptPrintable({ r }: { r: Receipt }) {
  const seller = companySeller(r.company || "");
  const V = "var(--violet)";
  const paidInFull = r.balanceAfter <= 0;
  return (
    <div id="invoice" className="card overflow-hidden !p-0 text-[12px]">
      <div className="border-b-2 py-2 text-center text-[15px] font-bold" style={{ borderColor: V, color: "var(--ink)" }}>Payment Receipt</div>

      {/* seller header */}
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/webrocz-horizontal.png" alt="Web Rocz" className="h-[40px] w-auto object-contain" />
        <div className="text-right leading-relaxed">
          <div className="text-[15px] font-extrabold">{seller.name}</div>
          <div className="text-[11px] text-[var(--ink-2)]">{seller.address}</div>
          <div className="text-[11px] text-[var(--ink-2)]">Phone no.: {seller.phone} &nbsp; Email: {seller.email}</div>
          <div className="text-[11px] text-[var(--ink-2)]">{seller.gstin ? `GSTIN: ${seller.gstin}, ` : ""}State: {seller.state}</div>
        </div>
      </div>

      {/* received from + receipt details */}
      <div className="grid grid-cols-2">
        <div className="border-t border-r border-[var(--line)]">
          <Bar>Received From</Bar>
          <div className="px-4 py-3 leading-relaxed">
            <div className="text-[13px] font-bold">{r.billTo}</div>
            {r.clientAddress && <div className="text-[11.5px] text-[var(--ink-2)]">{r.clientAddress}</div>}
            {r.phone && <div className="text-[11.5px] text-[var(--ink-2)]">Contact No. : {r.phone}</div>}
            {r.clientGstin && <div className="text-[11.5px] text-[var(--ink-2)]">GSTIN : {r.clientGstin}</div>}
          </div>
        </div>
        <div className="border-t border-[var(--line)]">
          <Bar>Receipt Details</Bar>
          <div className="px-4 py-3 text-right leading-relaxed">
            <div>Receipt No. : <b>{r.receiptNo}</b></div>
            <div>Date : {fmt(r.date)}</div>
            <div>Against Invoice : <b>{r.invoiceNumber}</b>{r.invoiceDate ? ` (${fmt(r.invoiceDate)})` : ""}</div>
          </div>
        </div>
      </div>

      {/* the payment */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-white" style={{ background: V }}>
            <th className="px-3 py-2 text-left font-semibold">Description</th>
            <th className="px-3 py-2 text-left font-semibold">Payment mode</th>
            <th className="px-3 py-2 text-left font-semibold">Reference</th>
            <th className="px-3 py-2 text-right font-semibold">Amount received</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[var(--line)]">
            <td className="px-3 py-3 font-medium">Payment received against invoice {r.invoiceNumber}</td>
            <td className="px-3 py-3">{MODE[r.mode] ?? (r.mode || "—")}</td>
            <td className="px-3 py-3">{r.ref || "—"}</td>
            <td className="px-3 py-3 text-right text-[13px] font-bold tnum">{inr(r.amount)}</td>
          </tr>
          <tr className="font-bold">
            <td className="px-3 py-2.5" colSpan={3}>Total received</td>
            <td className="px-3 py-2.5 text-right tnum">{inr(r.amount)}</td>
          </tr>
        </tbody>
      </table>

      {/* words + invoice position */}
      <div className="grid grid-cols-2 border-t border-[var(--line)]">
        <div className="border-r border-[var(--line)]">
          <Bar>Amount Received In Words</Bar>
          <div className="px-4 py-3 text-[12px] italic">{amountInWords(r.amount)}</div>
        </div>
        <div>
          <Bar>Invoice Summary</Bar>
          <div className="px-4 py-2 text-[12px]">
            <Row k="Invoice total" v={inr(r.invoiceTotal)} />
            <Row k="Received so far" v={inr(r.receivedTillThis)} bold />
            <Row k="Balance" v={paidInFull ? "Nil — paid in full" : inr(r.balanceAfter)} />
          </div>
        </div>
      </div>

      {/* note + signatory */}
      <div className="grid grid-cols-2 border-t border-[var(--line)]">
        <div className="border-r border-[var(--line)]">
          <Bar>Note</Bar>
          <div className="px-4 py-3 text-[11.5px] leading-relaxed">
            Received with thanks{paidInFull ? ` — invoice ${r.invoiceNumber} is paid in full.` : `. Balance of ${inr(r.balanceAfter)} is due on invoice ${r.invoiceNumber}.`}
            <br />This is a receipt for the payment only; the tax details are on the invoice.
          </div>
        </div>
        <div className="flex flex-col items-center justify-between px-4 py-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/invoice-signature.png" alt="For Web Rocz Digital Agency Pvt Ltd — signature" width={240} height={60} className="h-[60px] w-[240px] flex-none object-contain" />
          <div className="text-[11.5px] font-semibold">Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
}

function Bar({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-1.5 text-[11.5px] font-bold text-white" style={{ background: "var(--violet)" }}>{children}</div>;
}
function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={`flex justify-between border-b border-[var(--line)] py-1.5 last:border-0 ${bold ? "font-bold" : ""}`}><span>{k}</span><span className="tnum">{v}</span></div>;
}
