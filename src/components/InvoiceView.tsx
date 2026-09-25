"use client";

import { useState } from "react";
import { generateInvoice, saveInvoice, emailInvoice, approveInvoice, addInvoiceNote } from "@/app/sales-actions";
import { SELLER } from "@/lib/domain";
import InvoicePrintable from "@/components/InvoicePrintable";
import { ArrowLeft, Download, Mail, Pencil, FileText, CheckCircle2, Lock, ShieldCheck, MessageCircle } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function InvoiceView({ lead, invoice, canManage, isSuperAdmin, approvalOff, sent, backHref }: { lead: any; invoice: any; canManage: boolean; isSuperAdmin: boolean; approvalOff?: boolean; sent: string; backHref: string }) {
  const [edit, setEdit] = useState(false);
  const leadId = lead?.id ?? "";

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

  // Open WhatsApp (web/app) with the invoice details pre-filled to the client's number.
  // Click-to-send: the accountant reviews and taps Send (no messages leave without a person).
  const sendWhatsApp = () => {
    const digits = (invoice.phone || "").replace(/\D/g, "");
    if (!digits) return;
    const phone = digits.length === 10 ? `91${digits}` : digits; // default to India country code
    const rupees = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
    // Public, no-login invoice link (opens the printable PDF invoice directly for the client).
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/share/invoice/${invoice.id}`;
    const lines = [
      `Dear ${invoice.contact || invoice.billTo},`,
      "",
      `Please find your invoice *${invoice.number}* from Web Rocz.`,
      `Amount: ${rupees(invoice.total)}`,
      balance > 0 ? `Balance due: ${rupees(balance)}` : "Status: Paid in full",
      "",
      `Open / download your invoice PDF: ${link}`,
      "",
      "Thank you for choosing us.",
    ];
    const msg = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank", "noopener,noreferrer");
  };
  // In the accountant CRM there's no approval gate — treat invoices as ready to download/send.
  const ready = invoice.approved || approvalOff;

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
          {isSuperAdmin && !approvalOff && (
            <form action={approveInvoice}><input type="hidden" name="invoiceId" value={invoice.id} /><input type="hidden" name="leadId" value={leadId} /><input type="hidden" name="approve" value={invoice.approved ? "0" : "1"} />
              <button className={`btn btn-sm ${invoice.approved ? "btn-ghost" : "btn-violet"}`}><ShieldCheck size={14} /> {invoice.approved ? "Approved — revoke" : "Approve"}</button>
            </form>
          )}
          {canManage && <button onClick={() => setEdit((v) => !v)} className="btn btn-ghost btn-sm"><Pencil size={14} /> Edit</button>}
          {ready
            ? <button onClick={() => window.print()} className="btn btn-violet btn-sm"><Download size={14} /> Download PDF</button>
            : <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--line-2)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--muted)]"><Lock size={13} /> Download after approval</span>}
        </div>
      </div>

      {/* approval status banner — hidden in the accountant CRM (no approval gate) */}
      {!approvalOff && (
      <div className={`no-print rounded-[10px] border px-4 py-2.5 text-[12.5px] font-medium`} style={invoice.approved
        ? { borderColor: "color-mix(in srgb, var(--emerald) 40%, white)", background: "color-mix(in srgb, var(--emerald) 8%, white)", color: "var(--emerald)" }
        : { borderColor: "color-mix(in srgb, var(--amber) 45%, white)", background: "color-mix(in srgb, var(--amber) 10%, white)", color: "#92600a" }}>
        {invoice.approved
          ? <><CheckCircle2 size={14} className="mr-1 inline" /> Approved by {invoice.approvedBy} — sales &amp; accountant can now download and send.</>
          : <><Lock size={14} className="mr-1 inline" /> Waiting for Super Admin approval. Download &amp; send are locked until then.</>}
      </div>
      )}

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

      {/* ============ printable GST tax invoice (shared with the public share link) ============ */}
      <InvoicePrintable invoice={invoice} />

      {/* send to client — email + WhatsApp */}
      {canManage && (
        <div className="no-print card card-pad">
          <h3 className="text-[14px] font-bold">Send to client</h3>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{ready ? "Email a branded copy, or open WhatsApp with the invoice details ready to send." : "Locked — needs Super Admin approval first."}{invoice.emailedAt ? ` Last emailed: ${new Date(invoice.emailedAt).toLocaleString("en-IN")}.` : ""}</p>
          <form action={emailInvoice} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="invoiceId" value={invoice.id} /><input type="hidden" name="leadId" value={leadId} />
            <div className="flex-1 min-w-[240px]"><L label="Client email"><input name="to" type="email" required defaultValue={invoice.email ?? lead?.email ?? ""} placeholder="client@example.com" className="input" /></L></div>
            <button disabled={!ready} className="btn btn-violet disabled:opacity-40"><Mail size={15} /> Email invoice</button>
            <button type="button" onClick={sendWhatsApp} disabled={!ready} title={invoice.phone ? `Open WhatsApp to ${invoice.phone}` : "No phone number on this invoice"} className="btn btn-ghost disabled:opacity-40" style={{ borderColor: "color-mix(in srgb, #25D366 55%, white)", color: "#128C4B" }}><MessageCircle size={15} /> Send on WhatsApp</button>
          </form>
          {!invoice.phone && <p className="mt-1.5 text-[11.5px] text-[var(--amber)]">Add the client&apos;s phone (Edit above) to enable WhatsApp.</p>}
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

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="eyebrow">{label}</span><div className="mt-1.5">{children}</div></label>;
}
