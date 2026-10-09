import { SELLER, amountInWords, companySeller } from "@/lib/domain";

/* eslint-disable @typescript-eslint/no-explicit-any */
const inr = (v: number) => "₨ " + (v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// The printable GST/Non-GST tax invoice — shared by the in-app invoice page and the
// public share link so both render identically. Pure markup (no hooks), server-safe.
export default function InvoicePrintable({ invoice }: { invoice: any }) {
  // Web Rocz bills digital marketing as one service: its invoice always prints a single
  // "Digital Marketing Services" line for the full amount, whatever services were ticked
  // (SEO, SMO, …). Web Rocz Pvt Ltd prints its saved lines, with the older "Digital Marketing"
  // wording shown as "Digital Marketing Services" too — so invoices saved earlier match the
  // new ones. Web Solutions prints its saved lines as they are.
  const DM_LINE = "Digital Marketing Services";
  const savedLines: any[] = invoice.itemsArr ?? [];
  const items = invoice.company === "WEB_ROCZ"
    ? [{ name: DM_LINE, qty: 1, rate: invoice.subtotal, amount: invoice.subtotal }]
    : invoice.company === "WEB_ROCZ_PVT"
      ? savedLines.map((it) => (String(it?.name ?? "").trim().toLowerCase() === "digital marketing" ? { ...it, name: DM_LINE } : it))
      : savedLines;
  const balance = invoice.total - (invoice.received || 0);
  // The billing entity (company) that issued this invoice drives the seller block details.
  const seller = companySeller(invoice.company || "");
  const intraState = (invoice.clientState || seller.state) === seller.state;
  const hasGst = invoice.taxPct > 0 && invoice.company !== "WEB_SOLUTIONS"; // Web Solutions is non-GST → hide the GST column, tax split, and "Tax" in the title
  const halfPct = invoice.taxPct / 2;
  const halfTax = Math.round(invoice.taxAmount / 2);
  const V = "var(--violet)";

  return (
    <div id="invoice" className="card overflow-hidden !p-0 text-[12px]">
      <div className="border-b-2 py-2 text-center text-[15px] font-bold" style={{ borderColor: V, color: "var(--ink)" }}>{hasGst ? "Tax Invoice" : "Invoice"}</div>

      {/* seller header */}
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        {/* Web Rocz logo on every invoice, regardless of the billing entity. */}
        <img src="/webrocz-horizontal.png" alt="Web Rocz" className="h-[40px] w-auto object-contain" />
        <div className="text-right leading-relaxed">
          <div className="text-[15px] font-extrabold">{seller.name}</div>
          <div className="text-[11px] text-[var(--ink-2)]">{seller.address}</div>
          <div className="text-[11px] text-[var(--ink-2)]">Phone no.: {seller.phone} &nbsp; Email: {seller.email}</div>
          <div className="text-[11px] text-[var(--ink-2)]">{seller.gstin ? `GSTIN: ${seller.gstin}, ` : ""}State: {seller.state}</div>
        </div>
      </div>

      {/* bill-to + invoice details */}
      <div className="grid grid-cols-2">
        <div className="border-t border-r border-[var(--line)]">
          <Bar>Bill To</Bar>
          <div className="px-4 py-3 leading-relaxed">
            <div className="text-[13px] font-bold">{invoice.billTo}</div>
            {invoice.clientAddress && <div className="text-[11.5px] text-[var(--ink-2)]">{invoice.clientAddress}</div>}
            {invoice.phone && <div className="text-[11.5px] text-[var(--ink-2)]">Contact No. : {invoice.phone}</div>}
            {invoice.clientGstin && <div className="text-[11.5px] text-[var(--ink-2)]">GSTIN : {invoice.clientGstin}</div>}
            <div className="text-[11.5px] text-[var(--ink-2)]">State: {invoice.clientState || seller.state}</div>
          </div>
        </div>
        <div className="border-t border-[var(--line)]">
          <Bar>Invoice Details</Bar>
          <div className="px-4 py-3 text-right leading-relaxed">
            <div className="text-[12px]">Invoice No. : <b>{invoice.number}</b></div>
            <div className="text-[12px]">Date : {fmt(invoice.issueDate)}</div>
            {hasGst && <div className="text-[12px]">Place of supply: {invoice.placeOfSupply || seller.state}</div>}
          </div>
        </div>
      </div>

      {/* items */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-white" style={{ background: V }}>
            <th className="px-3 py-2 text-left font-semibold">#</th>
            <th className="px-3 py-2 text-left font-semibold">Item name</th>
            <th className="px-3 py-2 text-right font-semibold">Price/ Unit</th>
            {hasGst && <th className="px-3 py-2 text-right font-semibold">GST</th>}
            <th className="px-3 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it: any, i: number) => {
            const gst = Math.round((it.amount * invoice.taxPct) / 100);
            // A service listed without its own price (covered by another line) reads "Included".
            const included = items.length > 1 && !it.amount && !it.rate;
            return (
              <tr key={i} className="border-b border-[var(--line)]">
                <td className="px-3 py-2.5">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium">{it.name}</td>
                <td className="px-3 py-2.5 text-right tnum">{included ? "—" : inr(it.rate)}</td>
                {hasGst && <td className="px-3 py-2.5 text-right tnum">{included ? "—" : <>{inr(gst)} ({invoice.taxPct}%)</>}</td>}
                <td className="px-3 py-2.5 text-right tnum">{included ? "Included" : inr(it.amount + gst)}</td>
              </tr>
            );
          })}
          <tr className="font-bold">
            <td className="px-3 py-2.5" colSpan={3}>Total</td>
            {hasGst && <td className="px-3 py-2.5 text-right tnum">{inr(invoice.taxAmount)}</td>}
            <td className="px-3 py-2.5 text-right tnum">{inr(invoice.total)}</td>
          </tr>
        </tbody>
      </table>

      {/* words + amounts */}
      <div className="grid grid-cols-2 border-t border-[var(--line)]">
        <div className="border-r border-[var(--line)]">
          <Bar>Invoice Amount In Words</Bar>
          <div className="px-4 py-3 text-[12px] font-medium italic">{amountInWords(invoice.total)}</div>
        </div>
        <div>
          <Bar>Amounts</Bar>
          <div className="px-4 py-2 text-[12px]">
            <Row k="Sub Total" v={inr(invoice.subtotal)} />
            <Row k="Total" v={inr(invoice.total)} bold />
            <Row k="Received" v={inr(invoice.received || 0)} />
            <Row k="Balance" v={inr(balance)} />
          </div>
        </div>
      </div>

      {/* tax split — only for GST invoices */}
      {hasGst && (
      <table className="w-full border-collapse border-t border-[var(--line)]">
        <thead><tr className="text-white text-left" style={{ background: V }}>
          <th className="px-3 py-1.5 font-semibold">Tax type</th><th className="px-3 py-1.5 text-right font-semibold">Taxable amount</th><th className="px-3 py-1.5 text-right font-semibold">Rate</th><th className="px-3 py-1.5 text-right font-semibold">Tax amount</th>
        </tr></thead>
        <tbody>
          {intraState ? (<>
            <tr className="border-b border-[var(--line)]"><td className="px-3 py-2">SGST</td><td className="px-3 py-2 text-right tnum">{inr(invoice.subtotal)}</td><td className="px-3 py-2 text-right tnum">{halfPct}%</td><td className="px-3 py-2 text-right tnum">{inr(halfTax)}</td></tr>
            <tr><td className="px-3 py-2">CGST</td><td className="px-3 py-2 text-right tnum">{inr(invoice.subtotal)}</td><td className="px-3 py-2 text-right tnum">{halfPct}%</td><td className="px-3 py-2 text-right tnum">{inr(invoice.taxAmount - halfTax)}</td></tr>
          </>) : (
            <tr><td className="px-3 py-2">IGST</td><td className="px-3 py-2 text-right tnum">{inr(invoice.subtotal)}</td><td className="px-3 py-2 text-right tnum">{invoice.taxPct}%</td><td className="px-3 py-2 text-right tnum">{inr(invoice.taxAmount)}</td></tr>
          )}
        </tbody>
      </table>
      )}

      {/* terms + signatory */}
      <div className="grid grid-cols-2 border-t border-[var(--line)]">
        <div className="border-r border-[var(--line)]">
          <Bar>Terms and Conditions</Bar>
          <div className="px-4 py-3 text-[11.5px] leading-relaxed">{invoice.notes || seller.terms}</div>
        </div>
        <div className="flex flex-col items-center justify-between px-4 py-3 text-center">
          {/* The signature picture ("For Web Rocz Digital Agency Pvt Ltd" + sign) is printed exactly
              as supplied, on every invoice of every company — old and new. */}
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
  return <div className={`flex justify-between border-b border-[var(--line)] py-1.5 ${bold ? "font-bold" : ""}`}><span>{k}</span><span className="tnum">{v}</span></div>;
}
function fmt(iso: string) { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; }
// SELLER re-exported for callers that only import the printable; keeps tree-shaking simple.
export { SELLER };
