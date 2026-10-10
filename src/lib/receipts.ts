import "server-only";
import { prisma } from "./prisma";
import { fyOfDate } from "./invoice-number";

// Receipts: every amount received against an invoice has a receipt the client can be sent (its
// own number, a printable page / PDF and a share link).
//
// • A payment entry (recorded payment)            → one receipt, id = the payment's id.
// • Money already marked as "received" on an invoice with no payment entry behind it (invoices
//   entered or imported as paid, before receipts existed) → one receipt for that amount,
//   id = "inv-<invoice id>", dated the invoice date. Nothing is added to the payment ledger.
//
// Nothing is stored twice: a receipt is the payment (or the invoice's unrecorded received
// amount) plus a number and whether it has been sent.

const pad4 = (n: number) => String(n).padStart(4, "0");
const OPEN = "inv-";
export const isOpeningReceiptId = (id: string) => id.startsWith(OPEN);

// received on the invoice that no payment entry accounts for
async function openingAmounts(where: { id?: string } = {}) {
  const invoices = await prisma.salesInvoice.findMany({ where: { ...where, received: { gt: 0 } }, select: { id: true, received: true, total: true, issueDate: true, openReceiptNo: true } });
  if (!invoices.length) return [];
  const sums = await prisma.payment.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: invoices.map((i) => i.id) } }, _sum: { amount: true } });
  const paid = new Map(sums.map((s) => [s.invoiceId, s._sum.amount ?? 0]));
  return invoices.map((i) => ({ ...i, gap: Math.min(i.received, i.total > 0 ? i.total : i.received) - (paid.get(i.id) ?? 0) })).filter((i) => i.gap > 0);
}

// Give every receipt that has no number yet its number, oldest first, in the series of its
// financial year: RCPT/2026-27/0001, 0002 … Existing numbers are kept. A minus payment entry
// (a correction) is not a receipt. Safe to call any time.
export async function ensureReceiptNumbers() {
  const [payments, openings] = await Promise.all([
    prisma.payment.findMany({ where: { amount: { gt: 0 }, receiptNo: "" }, select: { id: true, date: true, createdAt: true } }),
    openingAmounts(),
  ]);
  const todo = [
    ...openings.filter((o) => !o.openReceiptNo).map((o) => ({ kind: "open" as const, id: o.id, date: o.issueDate || "", at: 0 })),
    ...payments.map((p) => ({ kind: "pay" as const, id: p.id, date: p.date || "", at: p.createdAt.getTime() })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);
  if (!todo.length) return;
  const next = new Map<string, number>(); // FY → next free number
  for (const t of todo) {
    const fy = fyOfDate(t.date || undefined);
    if (!next.has(fy)) {
      const prefix = `RCPT/${fy}/`;
      const [a, b] = await Promise.all([
        prisma.payment.findMany({ where: { receiptNo: { startsWith: prefix } }, select: { receiptNo: true } }),
        prisma.salesInvoice.findMany({ where: { openReceiptNo: { startsWith: prefix } }, select: { openReceiptNo: true } }),
      ]);
      const used = [...a.map((x) => x.receiptNo), ...b.map((x) => x.openReceiptNo)];
      next.set(fy, used.reduce((m, u) => { const v = u.slice(prefix.length); return /^\d+$/.test(v) ? Math.max(m, parseInt(v, 10)) : m; }, 0) + 1);
    }
    const n = next.get(fy)!;
    next.set(fy, n + 1);
    const no = `RCPT/${fy}/${pad4(n)}`;
    if (t.kind === "pay") await prisma.payment.update({ where: { id: t.id }, data: { receiptNo: no } });
    else await prisma.salesInvoice.update({ where: { id: t.id }, data: { openReceiptNo: no } });
  }
}

// One receipt, with the invoice it was paid against. `null` for an unknown id or a correction entry.
export async function getReceipt(receiptId: string) {
  if (!receiptId) return null;
  await ensureReceiptNumbers();
  const opening = isOpeningReceiptId(receiptId);
  const p = opening ? null : await prisma.payment.findUnique({ where: { id: receiptId } });
  if (!opening && (!p || p.amount <= 0)) return null;
  const inv = await prisma.salesInvoice.findUnique({ where: { id: opening ? receiptId.slice(OPEN.length) : p!.invoiceId } });
  if (!inv) return null;
  const gap = (await openingAmounts({ id: inv.id }))[0]?.gap ?? 0; // received with no payment entry — counted first
  if (opening && gap <= 0) return null;
  // received up to and including this receipt (so an older receipt does not show later money)
  const upTo = opening ? 0 : (await prisma.payment.aggregate({ _sum: { amount: true }, where: { invoiceId: inv.id, OR: [{ date: { lt: p!.date } }, { date: p!.date, createdAt: { lte: p!.createdAt } }] } }))._sum.amount ?? p!.amount;
  const amount = opening ? gap : p!.amount;
  const receivedTillThis = Math.max(amount, inv.total > 0 ? Math.min(inv.total, gap + upTo) : gap + upTo);
  const sentAt = opening ? inv.openReceiptSentAt : p!.receiptSentAt;
  return {
    id: receiptId, opening, receiptNo: opening ? inv.openReceiptNo : p!.receiptNo, date: opening ? inv.issueDate : p!.date, amount,
    mode: opening ? "" : p!.mode, ref: opening ? "" : p!.ref, note: opening ? "" : p!.note, by: opening ? "" : p!.by,
    sentAt: sentAt ? sentAt.toISOString() : "", sentBy: opening ? inv.openReceiptSentBy : p!.receiptSentBy,
    invoiceId: inv.id, invoiceNumber: inv.number, invoiceDate: inv.issueDate, invoiceTotal: inv.total, company: inv.company,
    billTo: inv.billTo ?? "", contact: inv.contact ?? "", phone: inv.phone ?? "", email: inv.email ?? "", clientAddress: inv.clientAddress ?? "", clientGstin: inv.clientGstin ?? "", clientState: inv.clientState ?? "",
    receivedTillThis, balanceAfter: Math.max(0, inv.total - receivedTillThis),
    clientId: inv.clientId ?? "",
  };
}
export type Receipt = NonNullable<Awaited<ReturnType<typeof getReceipt>>>;

// Receipts of one invoice (newest first) — shown on the invoice page.
export async function getInvoiceReceipts(invoiceId: string) {
  await ensureReceiptNumbers();
  const [rows, inv, open] = await Promise.all([
    prisma.payment.findMany({ where: { invoiceId, amount: { gt: 0 } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.salesInvoice.findUnique({ where: { id: invoiceId }, select: { issueDate: true, openReceiptNo: true, openReceiptSentAt: true } }),
    openingAmounts({ id: invoiceId }),
  ]);
  const list = rows.map((p) => ({ id: p.id, receiptNo: p.receiptNo, date: p.date, amount: p.amount, mode: p.mode, ref: p.ref, sent: !!p.receiptSentAt }));
  if (inv && open[0]) list.push({ id: `${OPEN}${invoiceId}`, receiptNo: inv.openReceiptNo, date: inv.issueDate, amount: open[0].gap, mode: "", ref: "", sent: !!inv.openReceiptSentAt });
  return list;
}

// All receipts for the list page (newest first). `company`: one billing company only.
export async function getReceiptList(company = "") {
  await ensureReceiptNumbers();
  const [rows, openings] = await Promise.all([
    prisma.payment.findMany({
      where: { amount: { gt: 0 }, ...(company ? { invoice: { company } } : {}) },
      include: { invoice: { select: { number: true, billTo: true, company: true, phone: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 1500,
    }),
    openingAmounts(),
  ]);
  const openInvoices = openings.length
    ? await prisma.salesInvoice.findMany({ where: { id: { in: openings.map((o) => o.id) }, ...(company ? { company } : {}) }, select: { id: true, number: true, billTo: true, company: true, phone: true, issueDate: true, openReceiptNo: true, openReceiptSentAt: true, openReceiptSentBy: true } })
    : [];
  const gapOf = new Map(openings.map((o) => [o.id, o.gap]));
  const list = [
    ...rows.map((p) => ({
      id: p.id, receiptNo: p.receiptNo, date: p.date, amount: p.amount, mode: p.mode, ref: p.ref, by: p.by,
      sentAt: p.receiptSentAt ? p.receiptSentAt.toISOString() : "", sentBy: p.receiptSentBy,
      invoiceId: p.invoiceId, invoiceNumber: p.invoice?.number ?? "", client: p.invoice?.billTo ?? "", company: p.invoice?.company ?? "", phone: p.invoice?.phone ?? "",
    })),
    ...openInvoices.map((i) => ({
      id: `${OPEN}${i.id}`, receiptNo: i.openReceiptNo, date: i.issueDate, amount: gapOf.get(i.id) ?? 0, mode: "", ref: "", by: "",
      sentAt: i.openReceiptSentAt ? i.openReceiptSentAt.toISOString() : "", sentBy: i.openReceiptSentBy,
      invoiceId: i.id, invoiceNumber: i.number, client: i.billTo ?? "", company: i.company, phone: i.phone ?? "",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.receiptNo.localeCompare(a.receiptNo));
  return { list };
}
