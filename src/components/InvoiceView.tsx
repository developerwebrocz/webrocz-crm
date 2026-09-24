"use client";

import { useState } from "react";
import { generateInvoice, saveInvoice, emailInvoice, approveInvoice, addInvoiceNote } from "@/app/sales-actions";
import { SELLER, amountInWords } from "@/lib/domain";
import { ArrowLeft, Download, Mail, Pencil, FileText, CheckCircle2, Lock, ShieldCheck } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const inr = (v: number) => "₨ " + (v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceView({ lead, invoice, canManage, isSuperAdmin, sent, backHref }: { lead: any; invoice: any; canManage: boolean; isSuperAdmin: boolean; sent: string; backHref: string }) {
  const [edit, setEdit] = useState(false);
  const leadId = lead?.id ?? "";
  const brand = (invoice?.pipeline ?? lead?.pipeline) === "DIGITALHAT" ? "Digital Hat" : "WebRocz";

  if (!invoice) {
    return (
      <div className="mx-auto max-w-[720px] space-y-5">
        <a href={backHref} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Back</a>
        <div className="card card-pad text-center">
          <FileText size={30} className="mx-auto text-[var(--muted)]" />
          <h2 className="mt-3 text-[18px] font-bold">No invoice generated yet</h2>
          <p className="mx-auto mt-1 max-w-[420px] text-[13px] text-[var(--muted)]">Invoices are created automatically when a lead is onboarded. Click below to generate one now.</p>
          {canManage && leadId && (
            <form action={generateInvoice} className="mt-4"><input type="hidden" name="id" value={leadId} />
              <button className="btn btn-violet"><FileText size={15} /> Generate invoice</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const items = invoice.itemsArr ?? [];
  const notes = invoice.notesArr ?? [];
  const balance = invoice.total - (invoice.received || 0);
  const intraState = (invoice.clientState || SELLER.state) === SELLER.state;
  const halfPct = invoice.taxPct / 2;
  const halfTax = Math.round(invoice.taxAmount / 2);
  const payTone = balance <= 0 ? "var(--emerald)" : (invoice.received > 0 ? "var(--violet)" : "var(--amber)");
  const V = "var(--violet)";

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #invoice, #invoice * { visibility: visible !important; }
        #invoice { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
        .no-print { display: none !important; }
      }`}</style>

      {/* action bar */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <a href={backHref} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Back</a>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <form action={approveInvoice}><input type="hidden" name="invoiceId" value={invoice.id} /><input type="hidden" name="leadId" value={leadId} /><input type="hidden" name="approve" value={invoice.approved ? "0" : "1"} />
              <button className={`btn btn-sm ${invoice.approved ? "btn-ghost" : "btn-violet"}`}><ShieldCheck size={14} /> {invoice.approved ? "Approved — revoke" : "Approve"}</button>
            </form>
          )}
          {canManage && <button onClick={() => setEdit((v) => !v)} className="btn btn-ghost btn-sm"><Pencil size={14} /> Edit</button>}
          {invoice.approved
            ? <button onClick={() => window.print()} className="btn btn-violet btn-sm"><Download size={14} /> Download PDF</button>
            : <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--line-2)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--muted)]"><Lock size={13} /> Download after approval</span>}
        </div>
      </div>

      {/* approval status banner */}
      <div className={`no-print rounded-[10px] border px-4 py-2.5 text-[12.5px] font-medium`} style={invoice.approved
        ? { borderColor: "color-mix(in srgb, var(--emerald) 40%, white)", background: "color-mix(in srgb, var(--emerald) 8%, white)", color: "var(--emerald)" }
        : { borderColor: "color-mix(in srgb, var(--amber) 45%, white)", background: "color-mix(in srgb, var(--amber) 10%, white)", color: "#92600a" }}>
        {invoice.approved
          ? <><CheckCircle2 size={14} className="mr-1 inline" /> Approved by {invoice.approvedBy} — sales &amp; accountant can now download and send.</>
          : <><Lock size={14} className="mr-1 inline" /> Waiting for Super Admin approval. Download &amp; send are locked until then.</>}
      </div>

      {sent === "ok" && <div className="no-print rounded-[10px] px-4 py-2.5 text-[13px] font-medium" style={{ background: "color-mix(in srgb,var(--emerald) 8%,white)", color: "var(--emerald)" }}>✓ Invoice emailed to the client.</div>}
      {sent === "fail" && <div className="no-print rounded-[10px] px-4 py-2.5 text-[13px] font-medium" style={{ background: "color-mix(in srgb,var(--rose) 8%,white)", color: "var(--rose)" }}>Could not send — email not configured or address invalid. Use Download PDF instead.</div>}
      {sent === "locked" && <div className="no-print rounded-[10px] px-4 py-2.5 text-[13px] font-medium" style={{ background: "color-mix(in srgb,var(--amber) 12%,white)", color: "#92600a" }}>Cannot send yet — needs Super Admin approval first.</div>}

      {/* edit panel */}
      {edit && canManage && (
        <div className="no-print card card-pad">
          <h3 className="text-[14px] font-bold">Edit invoice</h3>
          <form action={saveInvoice} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="invoiceId" value={invoice.id} /><input type="hidden" name="leadId" value={leadId} />
            <L label="Bill to (client)"><input name="billTo" defaultValue={invoice.billTo} className="input" /></L>
            <L label="Contact person"><input name="contact" defaultValue={invoice.contact ?? ""} className="input" /></L>
            <L label="Phone"><input name="phone" defaultValue={invoice.phone ?? ""} className="input" /></L>
            <L label="Email"><input name="email" defaultValue={invoice.email ?? ""} className="input" /></L>
            <div className="sm:col-span-2"><L label="Client address"><input name="clientAddress" defaultValue={invoice.clientAddress ?? ""} className="input" /></L></div>
            <L label="Client GSTIN"><input name="clientGstin" defaultValue={invoice.clientGstin ?? ""} className="input" /></L>
            <L label="Client State"><input name="clientState" defaultValue={invoice.clientState ?? SELLER.state} className="input" /></L>
            <L label="Place of supply"><input name="placeOfSupply" defaultValue={invoice.placeOfSupply ?? SELLER.state} className="input" /></L>
            <L label="Item / service description"><input name="itemName" defaultValue={items[0]?.name ?? ""} className="input" /></L>
            <L label="Taxable amount (₹)"><input type="number" name="total" defaultValue={invoice.subtotal} className="input" /></L>
            <L label="GST %"><input type="number" name="taxPct" defaultValue={invoice.taxPct} className="input" /></L>
            <L label="Received (₹)"><input type="number" name="received" defaultValue={invoice.received} className="input" /></L>
            <L label="Payment status"><select name="paymentStatus" defaultValue={invoice.paymentStatus} className="select"><option>Pending</option><option>Advance Paid</option><option>Fully Paid</option></select></L>
            <L label="Invoice date"><input type="date" name="issueDate" defaultValue={invoice.issueDate} className="input" /></L>
            <div className="sm:col-span-2"><L label="Terms / notes"><textarea name="notes" defaultValue={invoice.notes ?? ""} rows={2} className="textarea" /></L></div>
            <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setEdit(false)} className="btn btn-ghost btn-sm">Cancel</button><button className="btn btn-violet btn-sm">Save invoice</button></div>
          </form>
        </div>
      )}

      {/* ============ printable GST tax invoice ============ */}
      <div id="invoice" className="card overflow-hidden !p-0 text-[12px]">
        <div className="border-b-2 py-2 text-center text-[15px] font-bold" style={{ borderColor: V, color: "var(--ink)" }}>Tax Invoice</div>

        {/* seller header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4">
          <div className="text-[20px] font-extrabold tracking-tight" style={{ color: V }}>{brand === "Digital Hat" ? "Digital Hat" : "Web Rocz"}</div>
          <div className="text-right leading-relaxed">
            <div className="text-[15px] font-extrabold">{SELLER.name}</div>
            <div className="text-[11px] text-[var(--ink-2)]">{SELLER.address}</div>
            <div className="text-[11px] text-[var(--ink-2)]">Phone no.: {SELLER.phone} &nbsp; Email: {SELLER.email}</div>
            <div className="text-[11px] text-[var(--ink-2)]">GSTIN: {SELLER.gstin}, State: {SELLER.state}</div>
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
              <div className="text-[11.5px] text-[var(--ink-2)]">State: {invoice.clientState || SELLER.state}</div>
            </div>
          </div>
          <div className="border-t border-[var(--line)]">
            <Bar>Invoice Details</Bar>
            <div className="px-4 py-3 text-right leading-relaxed">
              <div className="text-[12px]">Invoice No. : <b>{invoice.number}</b></div>
              <div className="text-[12px]">Date : {fmt(invoice.issueDate)}</div>
              <div className="text-[12px]">Place of supply: {invoice.placeOfSupply || SELLER.state}</div>
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
              <th className="px-3 py-2 text-right font-semibold">GST</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i: number) => {
              const gst = Math.round((it.amount * invoice.taxPct) / 100);
              return (
                <tr key={i} className="border-b border-[var(--line)]">
                  <td className="px-3 py-2.5">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium">{it.name}</td>
                  <td className="px-3 py-2.5 text-right tnum">{inr(it.rate)}</td>
                  <td className="px-3 py-2.5 text-right tnum">{inr(gst)} ({invoice.taxPct}%)</td>
                  <td className="px-3 py-2.5 text-right tnum">{inr(it.amount + gst)}</td>
                </tr>
              );
            })}
            <tr className="font-bold">
              <td className="px-3 py-2.5" colSpan={3}>Total</td>
              <td className="px-3 py-2.5 text-right tnum">{inr(invoice.taxAmount)}</td>
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
              <Row k="Sub Total" v={inr(invoice.subtotal + invoice.taxAmount)} />
              <Row k="Total" v={inr(invoice.total)} bold />
              <Row k="Received" v={inr(invoice.received || 0)} />
              <Row k="Balance" v={inr(balance)} />
            </div>
          </div>
        </div>

        {/* tax split */}
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

        {/* bank + terms + signatory */}
        <div className="grid grid-cols-3 border-t border-[var(--line)]">
          <div className="border-r border-[var(--line)]">
            <Bar>Bank Details</Bar>
            <div className="px-4 py-3 text-[11.5px] leading-relaxed">
              <div>Name : {SELLER.bankName}</div>
              <div>Account No. : {SELLER.bankAccount}</div>
              <div>IFSC code : {SELLER.bankIfsc}</div>
              <div>Account holder&apos;s name : {SELLER.bankHolder}</div>
            </div>
          </div>
          <div className="border-r border-[var(--line)]">
            <Bar>Terms and Conditions</Bar>
            <div className="px-4 py-3 text-[11.5px] leading-relaxed">{invoice.notes || SELLER.terms}</div>
          </div>
          <div className="flex flex-col items-center justify-between px-4 py-3 text-center">
            <div className="text-[11.5px]">For : {SELLER.name}</div>
            <div className="mt-6 text-[11.5px] font-semibold">Authorized Signatory</div>
          </div>
        </div>
      </div>

      {/* email to client */}
      {canManage && (
        <div className="no-print card card-pad">
          <h3 className="text-[14px] font-bold">Send to client</h3>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{invoice.approved ? "Emails the client a branded copy with a link to view / download." : "Locked — needs Super Admin approval first."}{invoice.emailedAt ? ` Last sent: ${new Date(invoice.emailedAt).toLocaleString("en-IN")}.` : ""}</p>
          <form action={emailInvoice} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="invoiceId" value={invoice.id} /><input type="hidden" name="leadId" value={leadId} />
            <div className="flex-1 min-w-[240px]"><L label="Client email"><input name="to" type="email" required defaultValue={invoice.email ?? lead?.email ?? ""} placeholder="client@example.com" className="input" /></L></div>
            <button disabled={!invoice.approved} className="btn btn-violet disabled:opacity-40"><Mail size={15} /> Email invoice</button>
          </form>
        </div>
      )}

      {/* accountant follow-up notes (visible to Super Admin) */}
      {canManage && (
        <div className="no-print card card-pad">
          <h3 className="text-[14px] font-bold">Payment follow-up notes</h3>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Accountant follow-ups. Every note notifies &amp; is visible to the Super Admin.</p>
          <form action={addInvoiceNote} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="invoiceId" value={invoice.id} /><input type="hidden" name="leadId" value={leadId} />
            <div className="flex-1 min-w-[240px]"><L label="Note"><input name="note" required placeholder="e.g. Called client, will pay by 25th" className="input" /></L></div>
            <div><L label="Next follow-up"><input name="nextFollowup" type="date" defaultValue={invoice.nextFollowup ?? ""} className="input" /></L></div>
            <button className="btn btn-ghost">Add note</button>
          </form>
          {notes.length > 0 && (
            <div className="mt-3 space-y-2">
              {notes.map((nt: any, i: number) => (
                <div key={i} className="rounded-[10px] border border-[var(--line)] p-2.5 text-[12.5px]"><b>{nt.by}</b> <span className="text-[var(--faint)]">· {nt.date}</span><div className="text-[var(--ink-2)]">{nt.note}</div></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Bar({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-1.5 text-[11.5px] font-bold text-white" style={{ background: "var(--violet)" }}>{children}</div>;
}
function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={`flex justify-between border-b border-[var(--line)] py-1.5 ${bold ? "font-bold" : ""}`}><span>{k}</span><span className="tnum">{v}</span></div>;
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="eyebrow">{label}</span><div className="mt-1.5">{children}</div></label>;
}
function fmt(iso: string) { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; }
