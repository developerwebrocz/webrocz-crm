"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Actions for the Payments pipeline (/payments).

export type Collector = { name: string; role: string };

// Read-only: the people a payment can be recorded under — accountants first, then admins.
export async function getPaymentCollectors(): Promise<Collector[]> {
  const me = await getCurrentUser();
  if (!me || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(me.role)) return [];
  const users = await prisma.user.findMany({ where: { active: true, role: { in: ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"] } }, orderBy: { name: "asc" }, select: { name: true, role: true } });
  return [...users.filter((u) => u.role === "ACCOUNTANT"), ...users.filter((u) => u.role !== "ACCOUNTANT")];
}

export type ReassignResult = { ok: boolean; message: string } | null;

// Super Admin / Sub Admin: put payments that were recorded under one person's name under
// another (e.g. an admin imported old payments that the accountant actually collected).
// Only the "collected by" name changes — amounts, dates and invoices are untouched.
export async function reassignPaymentCollector(_prev: ReassignResult, fd: FormData): Promise<ReassignResult> {
  const me = await getCurrentUser();
  if (!me || !["SUPER_ADMIN", "SUB_ADMIN"].includes(me.role)) return { ok: false, message: "Only a Super Admin or Sub Admin can change who collected a payment." };
  const from = String(fd.get("from") ?? "").trim();
  const to = String(fd.get("to") ?? "").trim();
  if (!from || !to) return { ok: false, message: "Choose who the payments should be under." };
  if (from === to) return { ok: false, message: "Choose a different person." };
  if (!(await prisma.user.findFirst({ where: { name: to, active: true }, select: { id: true } }))) return { ok: false, message: `${to} is not an active team member.` };
  let ids: string[] = [];
  try { const a = JSON.parse(String(fd.get("ids") ?? "[]")); if (Array.isArray(a)) ids = a.map(String); } catch { /* ignore */ }
  if (!ids.length) return { ok: false, message: "There are no payments to move." };
  let moved = 0;
  for (let i = 0; i < ids.length; i += 200) moved += (await prisma.payment.updateMany({ where: { id: { in: ids.slice(i, i + 200) }, by: from }, data: { by: to } })).count;
  revalidatePath("/payments");
  return { ok: true, message: `${moved} payment${moved === 1 ? "" : "s"} moved from ${from} to ${to}.` };
}
