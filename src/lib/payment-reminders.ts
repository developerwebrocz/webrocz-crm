import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";

// Payment reminders (accounts): every invoice with money still pending, and when the client has
// to be reminded — the follow-up date the accountant set, or the invoice's due date until then.

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// due date: the one on the invoice, else 15 days from the invoice date (same rule as the dashboard)
const dueOf = (i: { dueDate: string; issueDate: string }) => i.dueDate || (i.issueDate ? addDays(i.issueDate, 15) : "");

export async function getPaymentReminderRows() {
  const invoices = await prisma.salesInvoice.findMany({
    select: { id: true, clientId: true, number: true, billTo: true, contact: true, phone: true, total: true, received: true, issueDate: true, dueDate: true, nextFollowup: true, company: true },
    orderBy: { issueDate: "asc" },
  });
  return invoices.filter((i) => i.total - i.received > 0).map((i) => ({
    id: i.id, clientId: i.clientId, number: i.number, billTo: i.billTo, contact: i.contact, phone: i.phone,
    total: i.total, received: i.received, balance: i.total - i.received,
    issueDate: i.issueDate, dueDate: dueOf(i), nextFollowup: i.nextFollowup, company: i.company,
  }));
}

// For the menu badge: reminders that are due today or already late.
export async function getPaymentReminderCount(): Promise<number> {
  const today = todayIST();
  const invoices = await prisma.salesInvoice.findMany({ select: { total: true, received: true, issueDate: true, dueDate: true, nextFollowup: true } });
  return invoices.filter((i) => i.total - i.received > 0 && (i.nextFollowup || dueOf(i) || i.issueDate) <= today).length;
}
