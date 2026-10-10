import "server-only";
import { prisma } from "./prisma";
import { fyOfDate } from "./invoice-number";

// Payment receipts: every payment received against an invoice gets a receipt the client can be
// sent (its own number, a printable page / PDF and a share link). The receipt is the payment
// itself — nothing is stored twice — plus a number and whether it has been sent.

// Receipts are sent from this day on. Payments received before it still have a receipt that
// can be opened and sent, but they are not counted as "to send" (no backlog of old payments).
export const RECEIPTS_SINCE = "2026-10-10";

const pad4 = (n: number) => String(n).padStart(4, "0");

// Numbers the given payments (oldest first) in the series of their financial year:
// RCPT/2026-27/0001, 0002 … Payments that already have a number keep it.
async function numberPayments(payments: { id: string; date: string; receiptNo: string }[]) {
  const todo = payments.filter((p) => !p.receiptNo);
  if (!todo.length) return;
  const next = new Map<string, number>(); // FY → next free number
  for (const p of todo) {
    const fy = fyOfDate(p.date || undefined);
    if (!next.has(fy)) {
      const prefix = `RCPT/${fy}/`;
      const used = await prisma.payment.findMany({ where: { receiptNo: { startsWith: prefix } }, select: { receiptNo: true } });
      next.set(fy, used.reduce((m, u) => { const v = u.receiptNo.slice(prefix.length); return /^\d+$/.test(v) ? Math.max(m, parseInt(v, 10)) : m; }, 0) + 1);
    }
    const n = next.get(fy)!;
    next.set(fy, n + 1);
    await prisma.payment.update({ where: { id: p.id }, data: { receiptNo: `RCPT/${fy}/${pad4(n)}` } });
  }
}

// Give every received payment that has no receipt number yet its number (oldest payment first).
// A minus entry (a correction) is not a receipt. Safe to call any time.
export async function ensureReceiptNumbers(where: { invoiceId?: string; id?: string } = {}) {
  const missing = await prisma.payment.findMany({
    where: { ...where, amount: { gt: 0 }, receiptNo: "" },
    select: { id: true, date: true, receiptNo: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  await numberPayments(missing);
}

// One receipt, with the invoice it was paid against. `null` for an unknown id or a correction entry.
export async function getReceipt(paymentId: string) {
  if (!paymentId) return null;
  await ensureReceiptNumbers(); // earlier payments first, so the series stays in date order
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
  if (!p || p.amount <= 0 || !p.invoice) return null;
  const inv = p.invoice;
  // received up to and including this payment (so an older receipt does not show later money)
  const upTo = await prisma.payment.aggregate({ _sum: { amount: true }, where: { invoiceId: inv.id, OR: [{ date: { lt: p.date } }, { date: p.date, createdAt: { lte: p.createdAt } }] } });
  const receivedTillThis = Math.max(p.amount, Math.min(inv.total, upTo._sum.amount ?? p.amount));
  return {
    id: p.id, receiptNo: p.receiptNo, date: p.date, amount: p.amount, mode: p.mode, ref: p.ref, note: p.note, by: p.by,
    sentAt: p.receiptSentAt ? p.receiptSentAt.toISOString() : "", sentBy: p.receiptSentBy,
    invoiceId: inv.id, invoiceNumber: inv.number, invoiceDate: inv.issueDate, invoiceTotal: inv.total, company: inv.company,
    billTo: inv.billTo ?? "", contact: inv.contact ?? "", phone: inv.phone ?? "", email: inv.email ?? "", clientAddress: inv.clientAddress ?? "", clientGstin: inv.clientGstin ?? "", clientState: inv.clientState ?? "",
    receivedTillThis, balanceAfter: Math.max(0, inv.total - receivedTillThis),
    clientId: inv.clientId ?? "",
  };
}
export type Receipt = NonNullable<Awaited<ReturnType<typeof getReceipt>>>;

// Receipts of one invoice (newest first) — shown on the invoice page.
export async function getInvoiceReceipts(invoiceId: string) {
  await ensureReceiptNumbers({ invoiceId });
  const rows = await prisma.payment.findMany({ where: { invoiceId, amount: { gt: 0 } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  return rows.map((p) => ({ id: p.id, receiptNo: p.receiptNo, date: p.date, amount: p.amount, mode: p.mode, ref: p.ref, sent: !!p.receiptSentAt }));
}

// All receipts for the list page (newest first), with what is still to be sent.
export async function getReceiptList() {
  await ensureReceiptNumbers();
  const rows = await prisma.payment.findMany({
    where: { amount: { gt: 0 } },
    include: { invoice: { select: { number: true, billTo: true, company: true, phone: true, total: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 600,
  });
  const list = rows.map((p) => ({
    id: p.id, receiptNo: p.receiptNo, date: p.date, amount: p.amount, mode: p.mode, ref: p.ref, by: p.by,
    sentAt: p.receiptSentAt ? p.receiptSentAt.toISOString() : "", sentBy: p.receiptSentBy,
    invoiceId: p.invoiceId, invoiceNumber: p.invoice?.number ?? "", client: p.invoice?.billTo ?? "", company: p.invoice?.company ?? "", phone: p.invoice?.phone ?? "",
    earlier: !p.receiptSentAt && p.date < RECEIPTS_SINCE,
  }));
  return { list, toSend: list.filter((r) => !r.sentAt && !r.earlier).length, sent: list.filter((r) => r.sentAt).length, total: list.reduce((s, r) => s + r.amount, 0) };
}
