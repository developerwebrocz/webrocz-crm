"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayIST } from "@/lib/india-date";
import { revalidatePath } from "next/cache";

// Payment reminders (accountant dashboard): "remind me again on this date" for an invoice with
// money still pending, with an optional note of what the client said. The date is the invoice's
// next follow-up; the note joins the invoice's follow-up log (the one the invoice page shows).
const CAN_REMIND = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];

export async function setPaymentReminder(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !CAN_REMIND.includes(me.role)) return;
  const id = String(fd.get("invoiceId") ?? "");
  const date = String(fd.get("date") ?? "").trim();
  const note = String(fd.get("note") ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const inv = await prisma.salesInvoice.findUnique({ where: { id }, select: { notesLog: true } });
  if (!inv) return;

  let log: { date: string; by: string; note: string }[] = [];
  try { const a = JSON.parse(inv.notesLog || "[]"); if (Array.isArray(a)) log = a; } catch { /* keep empty */ }
  if (note) {
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
    log.unshift({ date: `${todayIST(now)} ${time}`, by: me.name, note });
  }
  await prisma.salesInvoice.update({ where: { id }, data: { nextFollowup: date, ...(note ? { notesLog: JSON.stringify(log.slice(0, 100)) } : {}) } });
  revalidatePath("/");
  revalidatePath("/reminders");
  revalidatePath("/invoices");
}
