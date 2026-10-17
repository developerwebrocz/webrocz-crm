import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";
import { chosenClientFollowup, chosenInvoiceFollowup, parseNotes } from "./followup-shown";

// Payment Reminders (accounts). A reminder is something the accountant set by hand: "follow up
// again on this date" — on a client (from the Phone / WhatsApp Follow-up popup) or on one invoice
// (from the invoice's follow-up). On that date it shows in the reminder pipeline.
// Invoices with money pending and no reminder set are listed apart ("No reminder set"), so the
// accountant can set one.

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// due date: the one on the invoice, else 15 days from the invoice date (same rule as the dashboard)
const dueOf = (i: { dueDate: string; issueDate: string }) => i.dueDate || (i.issueDate ? addDays(i.issueDate, 15) : "");

export type PaymentReminder = {
  key: string; kind: "client" | "invoice"; id: string; clientId: string | null;
  name: string; label: string; // who, and what it is about ("Client follow-up" / the invoice number)
  contact: string; phone: string; company: string;
  balance: number; total: number; dueDate: string; issueDate: string;
  remindOn: string; // "" = no reminder set
  followupBy: string; // who follows up the client's payments: "Rajesh Sir" (the Super Admin) | "Accountant" | ""
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

// Whose follow-ups a person sees: a client marked "Rajesh Sir" (Edit info → Follow-up payment by)
// is followed up by the Super Admin, so it is not in the accountant's reminders.
export const RAJESH = "Rajesh Sir";
export function remindersFor<T extends { followupBy: string }>(rows: T[], role: string): T[] {
  return role === "ACCOUNTANT" ? rows.filter((r) => r.followupBy !== RAJESH) : rows;
}

export async function getPaymentReminders(role = ""): Promise<PaymentReminder[]> {
  const [clients, invoices] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true, pocName: true, pocMobile: true, billingCompany: true, nextFollowup: true, followupLog: true, paymentFollowupBy: true } }),
    prisma.salesInvoice.findMany({ select: { id: true, clientId: true, number: true, billTo: true, contact: true, phone: true, total: true, received: true, issueDate: true, dueDate: true, nextFollowup: true, notesLog: true, company: true, onHold: true }, orderBy: { issueDate: "asc" } }),
  ]);
  // an invoice with no linked client belongs to the client with exactly its bill-to name
  const byName = new Map<string, string>();
  for (const c of clients) { const k = c.name.trim().toLowerCase(); byName.set(k, byName.has(k) ? "" : c.id); }
  // an invoice put on Hold is out of the reminders (it waits in the Hold list)
  const pending = invoices.filter((i) => i.total - i.received > 0 && !i.onHold).map((i) => ({ ...i, clientId: i.clientId || byName.get(i.billTo.trim().toLowerCase()) || null }));
  const out: PaymentReminder[] = [];
  const followupByOf = new Map(clients.map((c) => [c.id, c.paymentFollowupBy] as const));

  // reminders set on a client
  const withClientReminder = new Set<string>();
  for (const c of clients) {
    // only a date somebody chose (not one an old form filled in by itself)
    const remindOn = chosenClientFollowup(c.nextFollowup, parseNotes(c.followupLog));
    if (!remindOn) continue;
    withClientReminder.add(c.id);
    const mine = pending.filter((i) => i.clientId === c.id);
    const n = latest(c.followupLog);
    out.push({
      key: `c-${c.id}`, kind: "client", id: c.id, clientId: c.id, name: c.name, label: mine.length ? `${mine.length} invoice${mine.length === 1 ? "" : "s"} pending` : "Client follow-up",
      contact: c.pocName ?? "", phone: c.pocMobile ?? "", company: c.billingCompany || mine[0]?.company || "",
      balance: mine.reduce((s, i) => s + (i.total - i.received), 0), total: mine.reduce((s, i) => s + i.total, 0),
      dueDate: mine.map(dueOf).filter(Boolean).sort()[0] ?? "", issueDate: "",
      remindOn, followupBy: c.paymentFollowupBy, lastNote: n.note ?? "", lastBy: n.by ?? "", lastOn: n.date ?? "",
    });
  }

  // invoices with money pending: with their own reminder, or with none at all
  for (const i of pending) {
    const own = chosenInvoiceFollowup(i.nextFollowup, parseNotes(i.notesLog));
    // no reminder of its own, but its client has one → that client reminder covers it
    if (!own && i.clientId && withClientReminder.has(i.clientId)) continue;
    const n = latest(i.notesLog);
    out.push({
      key: `i-${i.id}`, kind: "invoice", id: i.id, clientId: i.clientId, name: i.billTo, label: i.number,
      contact: i.contact ?? "", phone: i.phone ?? "", company: i.company,
      balance: i.total - i.received, total: i.total, dueDate: dueOf(i), issueDate: i.issueDate,
      remindOn: own, followupBy: (i.clientId && followupByOf.get(i.clientId)) || "", lastNote: n.note ?? "", lastBy: n.by ?? "", lastOn: (n.date ?? "").slice(0, 10),
    });
  }
  return remindersFor(out, role);
}

// For the menu badge: reminders set for today or earlier that this person follows up — the
// accountant's (not Rajesh Sir's), the Super Admin's own (Rajesh Sir's), everything for a Sub Admin.
export async function getPaymentReminderCount(role = ""): Promise<number> {
  const today = todayIST();
  const rows = (await getPaymentReminders(role)).filter((r) => role !== "SUPER_ADMIN" || r.followupBy === RAJESH);
  return rows.filter((r) => r.remindOn && r.remindOn <= today).length;
}
