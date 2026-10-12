import "server-only";
import nodemailer from "nodemailer";

// Email is optional infrastructure: invites ("set your password") and invoice emails go out
// only when the server has an email service in its .env — otherwise sendEmail() does nothing
// and the manual "Copy login link" flow is used. Two ways to switch it on (either one):
//
//   A) A Gmail / Google Workspace mailbox (simplest — no DNS changes):
//        GMAIL_USER=crm@yourdomain.com
//        GMAIL_APP_PASSWORD=<16-letter app password from the Google account>
//      (any other mailbox works too: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
//   B) Resend (transactional API):  RESEND_API_KEY=...
//
// Secrets live in the server's .env only — never in git.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""); // Google shows it in groups of 4
const SMTP_HOST = process.env.SMTP_HOST || (GMAIL_USER ? "smtp.gmail.com" : "");
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || GMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || GMAIL_APP_PASSWORD;
const SMTP_ON = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
// EMAIL_FROM can be a bare address (e.g. noreply@webrocz.com) — we add the "WebRocz" display name.
// With a mailbox (SMTP) the mailbox itself is the sender unless EMAIL_FROM says otherwise.
const RAW_FROM = process.env.EMAIL_FROM || (SMTP_ON && !RESEND_API_KEY ? SMTP_USER : "noreply@webrocz.com");
const EMAIL_FROM = RAW_FROM.includes("<") ? RAW_FROM : `WebRocz <${RAW_FROM}>`;
// Optional: replies to our emails go here (e.g. a Gmail inbox the team actually watches).
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "";
export const APP_URL = (process.env.APP_URL || "https://admin.webrocz.com").replace(/\/$/, "");

export function emailConfigured() {
  return !!RESEND_API_KEY || SMTP_ON;
}
// What the Team page shows: which service sends the emails and from which address (no secrets).
export function emailSetup(): { on: boolean; via: string; from: string } {
  if (RESEND_API_KEY) return { on: true, via: "Resend", from: RAW_FROM };
  if (SMTP_ON) return { on: true, via: GMAIL_USER ? "Gmail" : `SMTP (${SMTP_HOST})`, from: RAW_FROM };
  return { on: false, via: "", from: "" };
}

// Sends one email and says what happened (the reason is shown to the admin on a failed test).
export async function sendEmailResult(to: string, subject: string, html: string): Promise<{ ok: boolean; error: string }> {
  if (!to) return { ok: false, error: "No email address." };
  if (RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {}) }),
      });
      if (res.ok) return { ok: true, error: "" };
      return { ok: false, error: `Resend refused it (${res.status}): ${(await res.text().catch(() => "")).slice(0, 160)}` };
    } catch (e) {
      return { ok: false, error: `Could not reach Resend: ${(e as Error)?.message ?? ""}`.slice(0, 200) };
    }
  }
  if (SMTP_ON) {
    try {
      const transport = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
      await transport.sendMail({ from: EMAIL_FROM, to, subject, html, ...(EMAIL_REPLY_TO ? { replyTo: EMAIL_REPLY_TO } : {}) });
      return { ok: true, error: "" };
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      return { ok: false, error: (/Invalid login|Username and Password not accepted|535/i.test(msg) ? "The mailbox did not accept the login — check GMAIL_USER and the app password in the server's .env." : `The mail server refused it: ${msg}`).slice(0, 220) };
    }
  }
  return { ok: false, error: "No email service is set up on the server." };
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  return (await sendEmailResult(to, subject, html)).ok;
}

export function inviteEmailHtml(name: string, email: string): string {
  const link = `${APP_URL}/staff?setpw=1&email=${encodeURIComponent(email)}`;
  const first = (name || "there").split(" ")[0];
  return `
  <div style="font-family:Inter,Arial,sans-serif;background:#f5f5fb;padding:32px 0;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #ece9ff;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#840a92,#6d28d9,#590ebc);padding:22px 28px;">
        <div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.02em;">WebRocz Agency OS</div>
      </div>
      <div style="padding:28px;">
        <p style="font-size:15px;color:#111827;margin:0 0 10px;">Hi ${first},</p>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 18px;">
          You've been given access to the <b>WebRocz CRM</b>. Click the button below to set your password and sign in.
        </p>
        <a href="${link}" style="display:inline-block;background:#6d28d9;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">Set your password →</a>
        <p style="font-size:12.5px;color:#6b7280;line-height:1.6;margin:20px 0 0;">
          Your login email is <b>${email}</b>. If the button doesn't work, open this link:<br/>
          <a href="${link}" style="color:#6d28d9;word-break:break-all;">${link}</a>
        </p>
        <p style="font-size:11.5px;color:#9ca3af;margin:22px 0 0;border-top:1px solid #f3f0ff;padding-top:14px;">
          You received this because a WebRocz admin created your account. If this wasn't expected, ignore this email.
        </p>
      </div>
    </div>
  </div>`;
}
