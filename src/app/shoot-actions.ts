"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Studio X extras kept in their own file: follow-ups on a shoot (Phone / WhatsApp) and the
// "what is already booked on this date" lookup used when an account manager requests a shoot.

const STUDIO_MANAGERS = ["STUDIO_HEAD", "SUPER_ADMIN", "SUB_ADMIN"];
const SHOOT_PEOPLE = ["STUDIO_HEAD", "VIDEOGRAPHER", "EDITOR", "ACCOUNT_MANAGER", "DM_EXEC", "AM_HEAD", "SUPER_ADMIN", "SUB_ADMIN"];

const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" ? v.trim() : ""; };

// Log a follow-up on a shoot — how the client / renter was reached (Phone or WhatsApp), when
// (date + time, filled with "now" on the form and editable) and what was said. Studio X
// managers, the assigned shooter and the account manager who requested the shoot may log one.
export async function logShootFollowup(fd: FormData) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const id = str(fd, "id");
  const back = str(fd, "return") || "/shoots";
  const shoot = id ? await prisma.shoot.findUnique({ where: { id }, select: { id: true, assignedToId: true, requestedById: true, followupLog: true } }) : null;
  if (!shoot) redirect(back);
  if (!STUDIO_MANAGERS.includes(me.role) && shoot.assignedToId !== me.id && shoot.requestedById !== me.id) redirect(back);
  const note = str(fd, "note");
  if (!note) redirect(back);

  let log: { date: string; time?: string; by: string; note: string; via?: string }[] = [];
  try { const arr = JSON.parse(shoot.followupLog || "[]"); if (Array.isArray(arr)) log = arr; } catch { /* start a fresh log */ }
  // what was entered on the form, else now by the clock in India (the server may run on UTC)
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const formDate = str(fd, "date");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(formDate) && formDate <= today ? formDate : today;
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(str(fd, "time")) ? str(fd, "time") : now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  const via = ["PHONE", "WHATSAPP"].includes(str(fd, "via")) ? str(fd, "via") : "";
  log.push({ date, time, by: me.name, note, ...(via ? { via } : {}) });
  await prisma.shoot.update({ where: { id: shoot.id }, data: { followupLog: JSON.stringify(log) } });
  revalidatePath("/shoots"); revalidatePath("/");
  redirect(back);
}

export type BookedShoot = { code: string; title: string; client: string; startTime: string; endTime: string; locationType: string; shooter: string; status: string };

// Read-only: the shoots already on the Studio X calendar for a date (cancelled ones left out),
// so whoever is asking for a shoot sees straight away that a slot is taken.
export async function getShootsOnDate(date: string): Promise<BookedShoot[]> {
  const me = await getCurrentUser();
  if (!me || !SHOOT_PEOPLE.includes(me.role) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const rows = await prisma.shoot.findMany({
    where: { date, status: { not: "CANCELLED" } },
    orderBy: [{ startTime: "asc" }],
    select: { code: true, title: true, startTime: true, endTime: true, locationType: true, status: true, category: true, renterName: true, client: { select: { name: true } }, assignedTo: { select: { name: true } } },
  });
  return rows.map((r) => ({
    code: r.code, title: r.title, client: r.category === "STUDIO_RENT" ? (r.renterName || "Studio X rental") : (r.client?.name ?? ""),
    startTime: r.startTime, endTime: r.endTime, locationType: r.locationType, shooter: r.assignedTo?.name ?? "", status: r.status,
  }));
}
