import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";

// Payment Reminders (accounts). A reminder is something the accountant set by hand: "follow up
// again on this date" — on a client (from the Phone / WhatsApp Follow-up popup) or on one invoice
// (from the invoice's follow-up). On that date it shows in the reminder pipeline.
// Invoices with money pending and no reminder set are listed apart ("No reminder set"), so the
// accountant can set one.

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// due date: the one on the invoice, else 15 days from the invoice date (same rule as the dashboard)
const dueOf = (i: { dueDate: string; issueDate: string }) => i.dueDate || (i.issueDate ? addDays(i.issueDate, 15) : "");
const isDate = (v: string | null | undefined): v is string => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");

export type PaymentReminder = {
  key: string; kind: "client" | "invoice"; id: string; clientId: string | null;
  name: string; label: string; // who, and what it is about ("Client follow-up" / the invoice number)
  contact: string; phone: string; company: string;
  balance: number; total: number; dueDate: string; issueDate: string;
  remindOn: string; // "" = no reminder set
  lastNote: string; lastBy: string; lastOn: string; // the latest follow-up note, for context
};

type Note = { date?: string; time?: string; by?: string; note?: string };
const latest = (json: string): Note => {
  try {
    const a = JSON.parse(json || "[]") as Note[];
    if (!Array.isArray(a) || !a.length) return {};
    return a.reduce((best, n) => (`${n.date ?? ""} ${n.time ?? ""}` >= `${best.date ?? ""} ${best.time ?? ""}` ? n : best));
  } catch { return {}; }
};

export async function getPaymentReminders(): Promise<PaymentReminder[]> {
  const [clients, invoices] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true, pocName: true, pocMobile: true, billingCompany: true, nextFollowup: true, followupLog: true } }),
    prisma.salesInvoice.findMany({ select: { id: true, clientId: true, number: true, billTo: true, contact: true, phone: true, total: true, received: true, issueDate: true, dueDate: true, nextFollowup: true, notesLog: true, company: true }, orderBy: { issueDate: "asc" } }),
  ]);
  // an invoice with no linked client belongs to the client with exactly its bill-to name
  const byName = new Map<string, string>();
  for (const c of clients) { const k = c.name.trim().toLowerCase(); byName.set(k, byName.has(k) ? "" : c.id); }
  const pending = invoices.filter((i) => i.total - i.received > 0).map((i) => ({ ...i, clientId: i.clientId || byName.get(i.billTo.trim().toLowerCase()) || null }));
  const out: PaymentReminder[] = [];

  // reminders set on a client
  const withClientReminder = new Set<string>();
  for (const c of clients) {
    if (!isDate(c.nextFollowup)) continue;
    withClientReminder.add(c.id);
    const mine = pending.filter((i) => i.clientId === c.id);
    const n = latest(c.followupLog);
    out.push({
      key: `c-${c.id}`, kind: "client", id: c.id, clientId: c.id, name: c.name, label: mine.length ? `${mine.length} invoice${mine.length === 1 ? "" : "s"} pending` : "Client follow-up",
      contact: c.pocName ?? "", phone: c.pocMobile ?? "", company: c.billingCompany || mine[0]?.company || "",
      balance: mine.reduce((s, i) => s + (i.total - i.received), 0), total: mine.reduce((s, i) => s + i.total, 0),
      dueDate: mine.map(dueOf).filter(Boolean).sort()[0] ?? "", issueDate: "",
      remindOn: c.nextFollowup, lastNote: n.note ?? "", lastBy: n.by ?? "", lastOn: n.date ?? "",
    });
  }

  // invoices with money pending: with their own reminder, or with none at all
  for (const i of pending) {
    const own = isDate(i.nextFollowup) ? i.nextFollowup : "";
    // no reminder of its own, but its client has one → that client reminder covers it
    if (!own && i.clientId && withClientReminder.has(i.clientId)) continue;
    const n = latest(i.notesLog);
    out.push({
      key: `i-${i.id}`, kind: "invoice", id: i.id, clientId: i.clientId, name: i.billTo, label: i.number,
      contact: i.contact ?? "", phone: i.phone ?? "", company: i.company,
      balance: i.total - i.received, total: i.total, dueDate: dueOf(i), issueDate: i.issueDate,
      remindOn: own, lastNote: n.note ?? "", lastBy: n.by ?? "", lastOn: (n.date ?? "").slice(0, 10),
    });
  }
  return out;
}

// For the menu badge: reminders set for today or earlier (still to be followed up).
export async function getPaymentReminderCount(): Promise<number> {
  const today = todayIST();
  const [clients, invoices] = await Promise.all([
    prisma.client.findMany({ where: { nextFollowup: { not: "" } }, select: { nextFollowup: true } }),
    prisma.salesInvoice.findMany({ where: { nextFollowup: { not: null } }, select: { total: true, received: true, nextFollowup: true } }),
  ]);
  return clients.filter((c) => isDate(c.nextFollowup) && c.nextFollowup <= today).length
    + invoices.filter((i) => i.total - i.received > 0 && isDate(i.nextFollowup) && i.nextFollowup <= today).length;
}
