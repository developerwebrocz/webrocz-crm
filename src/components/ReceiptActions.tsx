"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, MessageCircle, Link2, Check, CheckCircle2, Clock3, RotateCcw } from "lucide-react";
import { buildInvoicePdf, greetingForNow } from "@/lib/invoice-pdf";
import { downloadInvoicePdf } from "@/lib/invoice-download";
import { invoiceFileName, printInvoiceAs } from "@/lib/print-invoice";
import { setReceiptSent } from "@/app/receipt-actions";

// Send a payment receipt to the client: Download PDF, Send on WhatsApp (the PDF with a typed
// message — same way invoices are sent), Copy link, and the "sent" mark so no receipt is missed.

type R = { id: string; receiptNo: string; billTo: string; contact: string; phone: string; amount: number; date: string; invoiceNumber: string; balanceAfter: number; sentAt: string; sentBy: string };

const rupees = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmt = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return d ? `${d}-${m}-${y}` : iso; };

export default function ReceiptActions({ r, isNew = false }: { r: R; isNew?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "pdf" | "wa" | "mark">("");
  const [wa, setWa] = useState<"" | "saved" | "shared" | "tap" | "error">("");
  const [waLink, setWaLink] = useState("");
  const [pending, setPending] = useState<{ file: File; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileName = invoiceFileName(r.billTo, `Receipt ${r.receiptNo}`);
  const shareUrl = () => `${window.location.origin}/share/receipt/${r.id}`;
  const sent = !!r.sentAt;

  // the PDF is started when the pointer reaches a button, so the click itself is quick
  const pdfJob = useRef<{ at: number; job: Promise<Blob> } | null>(null);
  const preparePdf = () => {
    const node = document.getElementById("invoice");
    if (!node) return null;
    if (!pdfJob.current || Date.now() - pdfJob.current.at > 20_000) {
      const job = buildInvoicePdf(node);
      job.catch(() => { pdfJob.current = null; });
      pdfJob.current = { at: Date.now(), job };
    }
    return pdfJob.current.job;
  };

  const mark = async (on: boolean) => {
    setBusy("mark");
    try { await setReceiptSent(r.id, on); router.refresh(); } finally { setBusy(""); }
  };
  const download = async () => {
    if (busy) return;
    setBusy("pdf");
    try { await downloadInvoicePdf(r.billTo, `Receipt ${r.receiptNo}`, preparePdf()); }
    catch { printInvoiceAs(r.billTo, `Receipt ${r.receiptNo}`); }
    finally { setBusy(""); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl()); } catch { window.prompt("Copy this receipt link", shareUrl()); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  // Phone: the PDF goes to the share sheet → WhatsApp. Computer: the PDF is saved with the
  // client's name and the client's chat opens with the message typed (attach the saved PDF).
  const sendWhatsApp = async () => {
    const digits = (r.phone || "").replace(/\D/g, "");
    if (!digits || busy) return;
    const phone = digits.length === 10 ? `91${digits}` : digits;
    const text = [
      `Hi ${r.contact || r.billTo}, ${greetingForNow()}.`,
      "",
      `We have received your payment of *${rupees(r.amount)}* on ${fmt(r.date)} against invoice *${r.invoiceNumber}*. Thank you!`,
      `Receipt No: ${r.receiptNo}`,
      r.balanceAfter > 0 ? `Balance on this invoice: ${rupees(r.balanceAfter)}` : "This invoice is now paid in full.",
      "",
      `Your payment receipt: ${shareUrl()}`,
      "",
      "— Web Rocz",
    ].join("\n");
    const job = preparePdf();
    if (!job) return;
    const onPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const chat = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    setBusy("wa"); setWaLink(""); setWa("");
    try {
      const file = new File([await job], `${fileName}.pdf`, { type: "application/pdf" });
      if (onPhone && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); setWa("shared"); await setReceiptSent(r.id, true); router.refresh(); }
        catch (e) {
          if ((e as Error)?.name === "AbortError") return;
          setPending({ file, text }); setWa("tap"); // the phone wants a fresh tap before sharing
        }
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      if (onPhone) window.location.href = chat;
      else { const w = window.open(chat, "_blank"); if (w) w.opener = null; else setWaLink(chat); }
      setWa("saved");
      await setReceiptSent(r.id, true); router.refresh();
    } catch { setWa("error"); }
    finally { setBusy(""); }
  };
  const shareReady = async () => {
    if (!pending) return;
    try { await navigator.share({ files: [pending.file], text: pending.text }); setPending(null); setWa("shared"); await setReceiptSent(r.id, true); router.refresh(); }
    catch { /* cancelled — the button stays */ }
  };

  return (
    <div className="card card-pad no-print" style={isNew && !sent ? { borderColor: "color-mix(in srgb, var(--emerald) 40%, white)", background: "color-mix(in srgb, var(--emerald) 4%, white)" } : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-bold">
            {isNew && !sent ? "Payment recorded — send this receipt to the client" : "Send receipt to client"}
            {sent
              ? <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--emerald)]" style={{ background: "color-mix(in srgb, var(--emerald) 11%, white)" }}><CheckCircle2 size={12} /> Sent{r.sentBy ? ` by ${r.sentBy}` : ""} · {new Date(r.sentAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
              : <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: "color-mix(in srgb, var(--amber) 14%, white)", color: "#92600a" }}><Clock3 size={12} /> Not sent yet</span>}
          </div>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{rupees(r.amount)} received on {fmt(r.date)} · invoice {r.invoiceNumber} · {r.phone ? `WhatsApp ${r.phone}` : "no phone number on the invoice"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={sendWhatsApp} onPointerEnter={() => { if (r.phone) preparePdf(); }} onFocus={() => { if (r.phone) preparePdf(); }} disabled={!r.phone || busy === "wa"} className="btn text-white disabled:opacity-50" style={{ background: "#128C4B" }}><MessageCircle size={15} /> {busy === "wa" ? "Preparing…" : "Send on WhatsApp"}</button>
          <button type="button" onClick={download} onPointerEnter={() => { preparePdf(); }} disabled={busy === "pdf"} className="btn btn-violet disabled:opacity-60"><Download size={15} /> {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}</button>
          <button type="button" onClick={copy} className="btn btn-ghost">{copied ? <><Check size={15} /> Link copied</> : <><Link2 size={15} /> Copy link</>}</button>
          {sent
            ? <button type="button" onClick={() => mark(false)} disabled={busy === "mark"} className="btn btn-ghost" title="Mark as not sent"><RotateCcw size={14} /> Not sent</button>
            : <button type="button" onClick={() => mark(true)} disabled={busy === "mark"} className="btn btn-ghost"><Check size={15} /> Mark as sent</button>}
        </div>
      </div>
      {wa === "saved" && (
        <p className="mt-2.5 text-[12.5px] font-semibold" style={{ color: "#128C4B" }}>
          ✓ Receipt PDF saved as “{fileName}.pdf”. {waLink
            ? <><a href={waLink} target="_blank" rel="noreferrer" className="font-bold underline">Open this client’s WhatsApp chat</a> — the message is already typed. </>
            : <>WhatsApp is open on this client’s chat with the message typed. </>}
          Attach the saved PDF and press Send.
        </p>
      )}
      {wa === "tap" && <div className="mt-2.5"><button type="button" onClick={shareReady} className="btn btn-sm text-white" style={{ background: "#128C4B" }}><MessageCircle size={14} /> Share receipt PDF on WhatsApp</button></div>}
      {wa === "shared" && <p className="mt-2.5 text-[12.5px] font-semibold" style={{ color: "#128C4B" }}>✓ Receipt PDF handed to WhatsApp.</p>}
      {wa === "error" && <p className="mt-2.5 text-[12.5px] font-semibold text-[var(--rose)]">Could not prepare the PDF. Use Download PDF and attach it in WhatsApp.</p>}
      {!r.phone && <p className="mt-2 text-[11.5px] text-[var(--amber)]">Add the client’s phone on the invoice (Edit) to send on WhatsApp — or use Copy link / Download PDF.</p>}
    </div>
  );
}
