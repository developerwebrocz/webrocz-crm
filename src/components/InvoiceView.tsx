"use client";

import { useRef, useState } from "react";
import { generateInvoice, saveInvoice, emailInvoice, approveInvoice, addInvoiceNote } from "@/app/sales-actions";
import { SELLER } from "@/lib/domain";
import InvoicePrintable from "@/components/InvoicePrintable";
import { printInvoiceAs, invoiceFileName } from "@/lib/print-invoice";
import { buildInvoicePdf, greetingForNow } from "@/lib/invoice-pdf";
import { sendInvoiceOnWhatsApp } from "@/app/whatsapp-actions";
import { ArrowLeft, Download, Mail, Pencil, FileText, CheckCircle2, Lock, ShieldCheck, MessageCircle } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function InvoiceView({ lead, invoice, canManage, isSuperAdmin, approvalOff, sent, backHref }: { lead: any; invoice: any; canManage: boolean; isSuperAdmin: boolean; approvalOff?: boolean; sent: string; backHref: string }) {
  const [edit, setEdit] = useState(false);
  // "Send on WhatsApp": busy while the PDF is made, then what happened (saved / shared / …).
  const [wa, setWa] = useState<"" | "busy" | "sent" | "apiError" | "saved" | "shared" | "tap" | "error">("");
  const [waMsg, setWaMsg] = useState(""); // what the WhatsApp API answered (sent to … / why not)
  const [waFile, setWaFile] = useState("");
  const [pendingShare, setPendingShare] = useState<{ file: File; text: string } | null>(null);
  const [waLink, setWaLink] = useState(""); // shown when the browser did not let the chat open by itself
  // The PDF is started as soon as the pointer reaches the button, so the click itself is instant
  // (browsers only let a click open WhatsApp / the share sheet for a few seconds).
  const pdfJob = useRef<{ at: number; job: Promise<Blob> } | null>(null);
  const preparePdf = () => {
    const node = typeof document !== "undefined" ? document.getElementById("invoice") : null;
    if (!node) return null;
    if (!pdfJob.current || Date.now() - pdfJob.current.at > 20_000) {
      const job = buildInvoicePdf(node);
      job.catch(() => { pdfJob.current = null; });
      pdfJob.current = { at: Date.now(), job };
    }
    return pdfJob.current.job;
  };
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
  // The invoice goes as a PDF file (not a link), with a greeting that follows the time of day.
  //  • Phone: the PDF is handed to the phone's share sheet → WhatsApp → pick the client.
  //  • Computer: WhatsApp opens on the client's chat with the message typed in, and the PDF is
  //    saved with the client's name, ready to attach (a website cannot attach it by itself).
  const sendWhatsApp = async () => {
    const digits = (invoice.phone || "").replace(/\D/g, "");
    if (!digits || wa === "busy") return;
    const phone = digits.length === 10 ? `91${digits}` : digits; // default to India country code
    const rupees = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
    const text = [
      `Hi ${invoice.contact || invoice.billTo}, ${greetingForNow()}.`,
      "",
      `Please find attached your invoice *${invoice.number}* from Web Rocz.`,
      `Amount: ${rupees(invoice.total)}`,
      balance > 0 ? `Balance due: ${rupees(balance)}` : "Status: Paid in full",
      "",
      "Thank you for choosing us.",
    ].join("\n");
    const job = preparePdf();
    if (!job) return;
    const onPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const chat = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    setWa("busy"); setWaLink("");
    try {
      const file = new File([await job], `${invoiceFileName(invoice.billTo, invoice.number)}.pdf`, { type: "application/pdf" });
      setWaFile(file.name);
      // WhatsApp Business API set up on the server → the message and the PDF go straight into
      // the client's chat from here; nothing is downloaded and no WhatsApp window is opened.
      const fd = new FormData();
      fd.append("invoiceId", invoice.id); fd.append("greeting", greetingForNow()); fd.append("pdf", file);
      const api = await sendInvoiceOnWhatsApp(fd).catch(() => null);
      if (api?.ok) { setWaMsg(api.message); setWa("sent"); return; }
      if (api && api.code !== "NOT_CONFIGURED") { setWaMsg(api.message); setWa("apiError"); return; }
      // API not set up yet → the manual way below
      if (onPhone && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); setWa("shared"); }
        catch (e) {
          if ((e as Error)?.name === "AbortError") { setWa(""); return; }
          // the phone wants a fresh tap before sharing — keep the PDF ready behind a button
          setPendingShare({ file, text }); setWa("tap");
        }
        return;
      }
      // save the PDF with the client's name
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      // then open the client's chat with the message typed in
      if (onPhone) window.location.href = chat;
      else { const w = window.open(chat, "_blank"); if (w) w.opener = null; else setWaLink(chat); }
      setWa("saved");
    } catch { setWa("error"); }
  };
  const shareReady = async () => {
    if (!pendingShare) return;
    try { await navigator.share({ files: [pendingShare.file], text: pendingShare.text }); setWa("shared"); setPendingShare(null); }
    catch (e) { if ((e as Error)?.name !== "AbortError") setWa("error"); }
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
            ? <button onClick={() => printInvoiceAs(invoice.billTo, invoice.number)} title="The PDF is saved with the client's name" className="btn btn-violet btn-sm"><Download size={14} /> Download PDF</button>
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
      {sent === "dupno" && <div className="no-print rounded-[10px] px-4 py-2.5 text-[13px] font-medium" style={{ background: "color-mix(in srgb,var(--rose) 8%,white)", color: "var(--rose)" }}>That invoice number is already used by another invoice — the number was not changed.</div>}
      {sent === "locked" && <div className="no-print rounded-[10px] px-4 py-2.5 text-[13px] font-medium" style={{ background: "color-mix(in srgb,var(--amber) 12%,white)", color: "#92600a" }}>Cannot send yet — needs Super Admin approval first.</div>}

      {/* edit panel */}
      {edit && canManage && (
        <div className="no-print card card-pad">
          <h3 className="text-[14px] font-bold">Edit invoice</h3>
          <form action={saveInvoice} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="invoiceId" value={invoice.id} /><input type="hidden" name="leadId" value={leadId} />
            {/* Web Rocz Pvt Ltd only: its invoice number can be corrected, and the project date
                entered on its invoice form can be changed. */}
            {invoice.company === "WEB_ROCZ_PVT" && (
              <>
                <L label="Invoice number"><input name="number" defaultValue={invoice.number} className="input" /></L>
                <L label="Project date"><input type="date" name="projectDate" defaultValue={invoice.projectDate ?? ""} className="input" /></L>
              </>
            )}
            <L label="Bill to (client)"><input name="billTo" defaultValue={invoice.billTo} className="input" /></L>
            <L label="Contact person"><input name="contact" defaultValue={invoice.contact ?? ""} className="input" /></L>
            <L label="Phone"><input name="phone" defaultValue={invoice.phone ?? ""} className="input" /></L>
            <L label="Email"><input name="email" defaultValue={invoice.email ?? ""} className="input" /></L>
            {/* Web Solutions and Web Rocz are non-GST: address / GSTIN / state / place of supply
                are not asked. The saved address + GSTIN ride along hidden so an edit never wipes them. */}
            {invoice.company === "WEB_SOLUTIONS" || invoice.company === "WEB_ROCZ" ? (
              <><input type="hidden" name="clientAddress" value={invoice.clientAddress ?? ""} /><input type="hidden" name="clientGstin" value={invoice.clientGstin ?? ""} /></>
            ) : (
              <>
                <div className="sm:col-span-2"><L label="Client address"><input name="clientAddress" defaultValue={invoice.clientAddress ?? ""} className="input" /></L></div>
                <L label="Client GSTIN"><input name="clientGstin" defaultValue={invoice.clientGstin ?? ""} className="input" /></L>
                <L label="Client State"><input name="clientState" defaultValue={invoice.clientState ?? SELLER.state} className="input" /></L>
                <L label="Place of supply"><input name="placeOfSupply" defaultValue={invoice.placeOfSupply ?? SELLER.state} className="input" /></L>
              </>
            )}
            {/* Web Solutions lists its services as invoice lines, so the description is not
                edited here — it rides along hidden and the lines are kept on save. */}
            {invoice.company === "WEB_SOLUTIONS" || invoice.company === "WEB_ROCZ" /* Web Rocz always prints "Digital Marketing" */
              ? <input type="hidden" name="itemName" value={items[0]?.name ?? ""} />
              : <L label="Item / service description"><input name="itemName" defaultValue={items[0]?.name ?? ""} className="input" /></L>}
            <L label="Taxable amount (₹)"><input type="number" name="total" defaultValue={invoice.subtotal} className="input" /></L>
            {invoice.company === "WEB_SOLUTIONS" || invoice.company === "WEB_ROCZ"
              ? <input type="hidden" name="taxPct" value={invoice.taxPct} />
              : <L label="GST %"><input type="number" name="taxPct" defaultValue={invoice.taxPct} className="input" /></L>}
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
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{ready ? "Email a branded copy, or send the invoice PDF on WhatsApp." : "Locked — needs Super Admin approval first."}{invoice.emailedAt ? ` Last emailed: ${new Date(invoice.emailedAt).toLocaleString("en-IN")}.` : ""}</p>
          <form action={emailInvoice} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="invoiceId" value={invoice.id} /><input type="hidden" name="leadId" value={leadId} />
            <div className="flex-1 min-w-[240px]"><L label="Client email"><input name="to" type="email" required defaultValue={invoice.email ?? lead?.email ?? ""} placeholder="client@example.com" className="input" /></L></div>
            <button disabled={!ready} className="btn btn-violet disabled:opacity-40"><Mail size={15} /> Email invoice</button>
            <button type="button" onClick={sendWhatsApp} onPointerEnter={() => { if (ready && invoice.phone) preparePdf(); }} onFocus={() => { if (ready && invoice.phone) preparePdf(); }} disabled={!ready || wa === "busy"} title={invoice.phone ? `Send the invoice PDF on WhatsApp to ${invoice.phone}` : "No phone number on this invoice"} className="btn btn-ghost disabled:opacity-40" style={{ borderColor: "color-mix(in srgb, #25D366 55%, white)", color: "#128C4B" }}><MessageCircle size={15} /> {wa === "busy" ? "Sending…" : "Send on WhatsApp"}</button>
          </form>
          {wa === "sent" && <p className="mt-2.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold" style={{ background: "color-mix(in srgb, #25D366 10%, white)", color: "#0f5132" }}>✓ {waMsg}</p>}
          {wa === "apiError" && <p className="mt-2.5 rounded-[10px] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--rose)]" style={{ background: "color-mix(in srgb, var(--rose) 8%, white)" }}>Not sent. {waMsg}</p>}
          {wa === "saved" && (
            <div className="mt-2.5 rounded-[10px] px-3.5 py-2.5 text-[12.5px] leading-relaxed" style={{ background: "color-mix(in srgb, #25D366 9%, white)", color: "#0f5132" }}>
              <b>PDF saved:</b> {waFile}<br />
              {waLink
                ? <><a href={waLink} target="_blank" rel="noreferrer" className="font-bold underline">Open this client&apos;s WhatsApp chat</a> — the message is already typed. </>
                : <>WhatsApp is open on this client&apos;s chat with the message typed. </>}
              In the chat click the <b>attach (📎 / +)</b> button → <b>Document</b> → choose this PDF (or drag it into the chat) and press Send.
            </div>
          )}
          {wa === "tap" && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[12.5px]" style={{ background: "color-mix(in srgb, #25D366 9%, white)", color: "#0f5132" }}>
              <span>The PDF is ready.</span>
              <button type="button" onClick={shareReady} className="btn btn-sm text-white" style={{ background: "#128C4B" }}><MessageCircle size={14} /> Share PDF on WhatsApp</button>
            </div>
          )}
          {wa === "shared" && <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "#128C4B" }}>✓ Invoice PDF handed to WhatsApp.</p>}
          {wa === "error" && <p className="mt-2 text-[12.5px] font-semibold text-[var(--rose)]">Could not prepare the PDF. Use Download PDF above and attach it in WhatsApp.</p>}
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
