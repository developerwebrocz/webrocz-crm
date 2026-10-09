"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// "Important notes" on a client's page in the accountants' section: short notes the accounts
// team wants everyone to see for that client. Each note keeps who wrote it and the date and
// time (India time); earlier notes stay listed underneath.

const ROLES = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" ? v.trim() : ""; };

export type ImportantNote = { date: string; time: string; by: string; note: string };

export async function addClientImportantNote(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !ROLES.includes(me.role)) redirect("/");
  const id = str(fd, "id");
  const back = str(fd, "return") || (id ? `/accounts/${id}` : "/accounts");
  const note = str(fd, "note");
  if (!id || !note) redirect(back);
  const client = await prisma.client.findUnique({ where: { id }, select: { importantNotes: true } });
  if (!client) redirect(back);
  let notes: ImportantNote[] = [];
  try { const arr = JSON.parse(client.importantNotes || "[]"); if (Array.isArray(arr)) notes = arr; } catch { /* start a fresh list */ }
  const now = new Date();
  notes.push({
    date: now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), // YYYY-MM-DD
    time: now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }), // HH:MM
    by: me.name,
    note: note.slice(0, 2000),
  });
  await prisma.client.update({ where: { id }, data: { importantNotes: JSON.stringify(notes) } });
  revalidatePath(`/accounts/${id}`);
  redirect(back);
}
