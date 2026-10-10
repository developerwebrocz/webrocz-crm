"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Payment receipts: note that a receipt was sent to the client (or undo that).
const ROLES = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export async function setReceiptSent(paymentId: string, sent: boolean): Promise<{ ok: boolean }> {
  const me = await getCurrentUser();
  if (!me || !ROLES.includes(me.role) || !paymentId) return { ok: false };
  if (paymentId.startsWith("inv-")) {
    const invoiceId = paymentId.slice(4);
    const inv = await prisma.salesInvoice.findUnique({ where: { id: invoiceId }, select: { id: true } });
    if (!inv) return { ok: false };
    await prisma.salesInvoice.update({ where: { id: invoiceId }, data: sent ? { openReceiptSentAt: new Date(), openReceiptSentBy: me.name } : { openReceiptSentAt: null, openReceiptSentBy: "" } });
    revalidatePath("/receipts"); revalidatePath(`/receipts/${paymentId}`); revalidatePath(`/invoices/${invoiceId}`);
    return { ok: true };
  }
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true, invoiceId: true } });
  if (!p) return { ok: false };
  await prisma.payment.update({ where: { id: p.id }, data: sent ? { receiptSentAt: new Date(), receiptSentBy: me.name } : { receiptSentAt: null, receiptSentBy: "" } });
  revalidatePath("/receipts");
  revalidatePath(`/receipts/${p.id}`);
  revalidatePath(`/invoices/${p.invoiceId}`);
  return { ok: true };
}
