import "server-only";

// Email is optional infrastructure. It only sends when RESEND_API_KEY is configured in
// the environment; otherwise sendEmail() is a no-op (the manual "set your password" flow
// still works). Uses fetch — no npm dependency — against the Resend transactional API.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// EMAIL_FROM can be a bare address (e.g. noreply@webrocz.com) — we add the "WebRocz" display name.
const RAW_FROM = process.env.EMAIL_FROM || "noreply@webrocz.com";
const EMAIL_FROM = RAW_FROM.includes("<") ? RAW_FROM : `WebRocz <${RAW_FROM}>`;
// Optional: replies to our emails go here (e.g. a Gmail inbox the team actually watches).
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "";
export const APP_URL = (process.env.APP_URL || "https://admin.webrocz.com").replace(/\/$/, "");

export function emailConfigured() {
  return !!RESEND_API_KEY;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {}) }),
    });
    return res.ok;
  } catch {
    return false;
  }
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
