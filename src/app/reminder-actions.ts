"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayIST } from "@/lib/india-date";
import { setClientFollowupDate, setInvoiceFollowupDate } from "@/lib/followup-date";
import { revalidatePath } from "next/cache";

// Payment Reminders (accounts): the accountant sets "follow up again on this date" by hand, on a
// client or on one invoice, with an optional note of what the client said — and marks it done
// when it needs no more reminding. The note joins that client's / invoice's follow-up log.
const CAN_REMIND = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const refresh = () => { revalidatePath("/"); revalidatePath("/reminders"); revalidatePath("/invoices"); revalidatePath("/accounts"); };
const nowIST = () => {
  const now = new Date();
  return { date: todayIST(now), time: now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }) };
};

export async function setPaymentReminder(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !CAN_REMIND.includes(me.role)) return;
  const kind = String(fd.get("kind") ?? "invoice");
  const id = String(fd.get("id") ?? fd.get("invoiceId") ?? "");
  const date = String(fd.get("date") ?? "").trim();
  const note = String(fd.get("note") ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!id || !isDate(date)) return;
  const { date: today, time } = nowIST();

  if (kind === "client") {
    const c = await prisma.client.findUnique({ where: { id }, select: { followupLog: true } });
    if (!c) return;
    let log: Record<string, unknown>[] = [];
    try { const a = JSON.parse(c.followupLog || "[]"); if (Array.isArray(a)) log = a; } catch { /* keep empty */ }
    if (note) log.push({ date: today, time, by: me.name, note, next: date, via: "REMINDER" });
    if (note) await prisma.client.update({ where: { id }, data: { followupLog: JSON.stringify(log) } });
    await setClientFollowupDate(id, date);
  } else {
    const inv = await prisma.salesInvoice.findUnique({ where: { id }, select: { notesLog: true } });
    if (!inv) return;
    let log: { date: string; by: string; note: string }[] = [];
    try { const a = JSON.parse(inv.notesLog || "[]"); if (Array.isArray(a)) log = a; } catch { /* keep empty */ }
    if (note) log.unshift({ date: `${today} ${time}`, by: me.name, note });
    if (note) await prisma.salesInvoice.update({ where: { id }, data: { notesLog: JSON.stringify(log.slice(0, 100)) } });
    await setInvoiceFollowupDate(id, date); // goes on the invoice's client (one date per client)
  }
  refresh();
}

// "Done": this follow-up needs no more reminding — the reminder date is removed (the follow-up
// notes stay). It can be set again any time.
export async function clearPaymentReminder(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !CAN_REMIND.includes(me.role)) return;
  const kind = String(fd.get("kind") ?? "invoice");
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  if (kind === "client") await setClientFollowupDate(id, "");
  else await setInvoiceFollowupDate(id, "");
  refresh();
}
