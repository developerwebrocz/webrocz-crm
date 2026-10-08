"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Sends an invoice PDF straight into the client's WhatsApp chat through the official
// WhatsApp Business (Cloud) API — no link, nothing to attach by hand. The message itself is an
// approved template with the PDF as its document header:
//
//   Hi {{1}}, {{2}}.                          ← client name, Good morning / afternoon / evening
//   Please find attached your invoice {{3}} from Web Rocz.
//   Amount: {{4}}
//   Balance due: {{5}}
//   Thank you for choosing us.
//
// Server settings (.env on the server, never in git):
//   WHATSAPP_TOKEN          permanent access token of the WhatsApp Business app
//   WHATSAPP_PHONE_ID       "Phone number ID" of the sending number (used for everyone not listed below)
//   WHATSAPP_SENDERS        optional — a different sending number per person, by login email:
//                           prashanth@webrocz.com=111111111111111,other@webrocz.com=222222222222222
//                           (both numbers sit in the same WhatsApp Business account, so they
//                           share the token and the template)
//   WHATSAPP_TEMPLATE       name of the approved template   (default: invoice_pdf)
//   WHATSAPP_TEMPLATE_LANG  its language code               (default: en)
// Until the token + phone id are set this action answers NOT_CONFIGURED and the invoice page
// keeps working the old way (PDF saved + chat opened).

const ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD", "SALES_EXEC", "ACCOUNTANT"];
const GREETINGS = ["Good morning", "Good afternoon", "Good evening"];

export type WhatsAppSendResult = { ok: boolean; code?: "NOT_CONFIGURED" | "LOCKED" | "NO_PHONE" | "FAILED"; message: string };

// Template variables may not contain line breaks / tabs / long runs of spaces.
// The sending number for the person who is logged in: their own (WHATSAPP_SENDERS, matched by
// login email, else by name) or the common one (WHATSAPP_PHONE_ID).
function senderPhoneId(me: { email?: string | null; name: string }): string {
  const key = (v: string) => v.trim().toLowerCase();
  for (const pair of (process.env.WHATSAPP_SENDERS || "").split(/[,;\r\n]+/)) {
    const i = pair.lastIndexOf("=");
    if (i < 1) continue;
    const who = key(pair.slice(0, i)), id = pair.slice(i + 1).trim();
    if (id && who && (who === key(me.email || "") || who === key(me.name))) return id;
  }
  return (process.env.WHATSAPP_PHONE_ID || "").trim();
}

const oneLine = (v: string) => (v || "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim() || "-";
const rupees = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

// What Meta said, in words the accountant can act on.
function explain(err: { code?: number; message?: string; error_data?: { details?: string } } | undefined, fallback: string): string {
  const detail = err?.error_data?.details || err?.message || fallback;
  switch (err?.code) {
    case 190: return "WhatsApp access token is wrong or expired — it has to be updated on the server.";
    case 131026: return "This number cannot receive the message — it may not be on WhatsApp. Check the client's phone number.";
    case 131030: return "This number is not in the allowed test list of the WhatsApp account (the account is still in test mode).";
    case 132000: case 132012: return `The WhatsApp template does not match (number / type of fields). ${detail}`;
    case 132001: return "The WhatsApp template was not found or is not approved yet (check its name and language).";
    case 131047: case 131051: return `WhatsApp refused the message. ${detail}`;
    default: return `WhatsApp could not send it. ${detail}`;
  }
}

export async function sendInvoiceOnWhatsApp(fd: FormData): Promise<WhatsAppSendResult> {
  const me = await getCurrentUser();
  if (!me || !ROLES.includes(me.role)) return { ok: false, code: "FAILED", message: "You do not have access to send invoices." };

  const token = process.env.WHATSAPP_TOKEN || "";
  const phoneId = senderPhoneId(me);
  if (!token || !phoneId) return { ok: false, code: "NOT_CONFIGURED", message: "WhatsApp API is not set up on the server yet." };
  const template = process.env.WHATSAPP_TEMPLATE || "invoice_pdf";
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || "en";
  const api = `${process.env.WHATSAPP_API_BASE || "https://graph.facebook.com"}/${process.env.WHATSAPP_API_VERSION || "v21.0"}/${phoneId}`;

  const inv = await prisma.salesInvoice.findUnique({ where: { id: String(fd.get("invoiceId") || "") } });
  if (!inv) return { ok: false, code: "FAILED", message: "Invoice not found." };
  // Same gate as emailing: needs Super Admin approval, except in the accountant CRM.
  if (!inv.approved && me.role !== "ACCOUNTANT") return { ok: false, code: "LOCKED", message: "Cannot send yet — needs Super Admin approval first." };
  const digits = (inv.phone || "").replace(/\D/g, "");
  if (!digits) return { ok: false, code: "NO_PHONE", message: "Add the client's phone number on the invoice first." };
  const to = digits.length === 10 ? `91${digits}` : digits; // default to India country code

  const file = fd.get("pdf");
  if (!file || typeof file === "string" || !(file as File).size) return { ok: false, code: "FAILED", message: "The invoice PDF was not received." };
  const bytes = new Uint8Array(await (file as File).arrayBuffer());
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "%PDF") return { ok: false, code: "FAILED", message: "The invoice PDF was not received properly." };
  const fileName = ((file as File).name || `${inv.billTo} - ${inv.number}.pdf`).replace(/[\\/:*?"<>|]+/g, "-");
  const greeting = GREETINGS.includes(String(fd.get("greeting") || "")) ? String(fd.get("greeting")) : "Good morning";
  const balance = Math.max(0, inv.total - (inv.received || 0));

  try {
    // 1) hand the PDF to WhatsApp
    const up = new FormData();
    up.append("messaging_product", "whatsapp");
    up.append("type", "application/pdf");
    up.append("file", new Blob([bytes], { type: "application/pdf" }), fileName);
    const upRes = await fetch(`${api}/media`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: up });
    const upJson = await upRes.json().catch(() => ({}));
    if (!upRes.ok || !upJson?.id) return { ok: false, code: "FAILED", message: explain(upJson?.error, "The PDF could not be uploaded.") };

    // 2) send the template message with that PDF attached
    const body = {
      messaging_product: "whatsapp", to, type: "template",
      template: {
        name: template, language: { code: lang },
        components: [
          { type: "header", parameters: [{ type: "document", document: { id: upJson.id, filename: fileName } }] },
          { type: "body", parameters: [oneLine(inv.contact || inv.billTo), greeting, oneLine(inv.number), rupees(inv.total), rupees(balance)].map((text) => ({ type: "text", text })) },
        ],
      },
    };
    const res = await fetch(`${api}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.messages?.[0]?.id) return { ok: false, code: "FAILED", message: explain(json?.error, "The message was not accepted.") };
    return { ok: true, message: `Invoice PDF sent on WhatsApp to +${to}.` };
  } catch {
    return { ok: false, code: "FAILED", message: "Could not reach WhatsApp from the server. Try again in a minute." };
  }
}
