"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Payment receipts: note that a receipt was sent to the client (or undo that).
const ROLES = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export async function setReceiptSent(paymentId: string, sent: boolean): Promise<{ ok: boolean }> {
  const me = await getCurrentUser();
  if (!me || !ROLES.includes(me.role) || !paymentId) return { ok: false };
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true, invoiceId: true } });
  if (!p) return { ok: false };
  await prisma.payment.update({ where: { id: p.id }, data: sent ? { receiptSentAt: new Date(), receiptSentBy: me.name } : { receiptSentAt: null, receiptSentBy: "" } });
  revalidatePath("/receipts");
  revalidatePath(`/receipts/${p.id}`);
  revalidatePath(`/invoices/${p.invoiceId}`);
  return { ok: true };
}
