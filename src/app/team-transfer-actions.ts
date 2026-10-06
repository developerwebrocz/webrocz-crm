"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Hand one team member's ongoing work over to another — used when someone leaves or changes
// role. Only OPEN work moves (clients they manage, client-team assignments, unfinished tasks,
// design / video tasks, dev projects, open sales leads, upcoming shoots). Finished work and
// history (work updates, time sessions, completed tasks, won / lost leads) stay with the
// original member so past reports do not change.

const ADMIN_ROLES = ["SUPER_ADMIN", "SUB_ADMIN"];

// What "open" means per kind of work — shared by the summary and the transfer itself.
const openTasks = (userId: string) => ({ assignedToId: userId, status: { not: "DONE" } });
const openCreative = (userId: string) => ({ assignedToId: userId, status: { not: "COMPLETED" } });
const openDev = (userId: string) => ({ assignedToId: userId, status: { not: "LIVE" } });
const openLeads = (userId: string) => ({ assignedToId: userId, stage: { notIn: ["ONBOARDED", "LOST"] } });
const openShoots = (userId: string) => ({ assignedToId: userId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } });

export type TransferSummary = { managedClients: number; assignments: number; tasks: number; creative: number; devProjects: number; leads: number; shoots: number };
export type TransferResult = { ok: boolean; message: string } | null;

// Counts of the open work a member currently holds — shown in the transfer dialog.
export async function getTransferSummary(userId: string): Promise<TransferSummary | null> {
  const me = await getCurrentUser();
  if (!me || !ADMIN_ROLES.includes(me.role) || !userId) return null;
  const [managedClients, assignments, tasks, creative, devProjects, leads, shoots] = await Promise.all([
    prisma.client.count({ where: { accountManagerId: userId } }),
    prisma.assignment.count({ where: { userId } }),
    prisma.task.count({ where: openTasks(userId) }),
    prisma.creativeTask.count({ where: openCreative(userId) }),
    prisma.devProject.count({ where: openDev(userId) }),
    prisma.lead.count({ where: openLeads(userId) }),
    prisma.shoot.count({ where: openShoots(userId) }),
  ]);
  return { managedClients, assignments, tasks, creative, devProjects, leads, shoots };
}

// Move the ticked kinds of work from one member to another, optionally disabling the
// original member's login. Returns a message for the dialog (no redirect).
export async function transferWork(_prev: TransferResult, fd: FormData): Promise<TransferResult> {
  const me = await getCurrentUser();
  if (!me || !ADMIN_ROLES.includes(me.role)) return { ok: false, message: "Only a Super Admin or Sub Admin can transfer work." };
  const fromId = String(fd.get("fromId") ?? "");
  const toId = String(fd.get("toId") ?? "");
  if (!fromId || !toId) return { ok: false, message: "Choose who should take over the work." };
  if (fromId === toId) return { ok: false, message: "Choose a different team member to take over." };
  const [from, to] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromId }, select: { id: true, name: true, role: true } }),
    prisma.user.findUnique({ where: { id: toId }, select: { id: true, name: true, active: true } }),
  ]);
  if (!from || !to) return { ok: false, message: "That team member no longer exists." };
  if (!to.active) return { ok: false, message: `${to.name} is disabled — choose an active team member.` };
  if (from.role === "SUPER_ADMIN" && me.role !== "SUPER_ADMIN") return { ok: false, message: "Only the Super Admin can transfer a Super Admin's work." };
  const disable = fd.get("disable") === "on";
  if (disable && fromId === me.id) return { ok: false, message: "You cannot disable your own login." };
  const want = (k: string) => fd.get(k) === "on";

  const moved: string[] = [];
  const say = (n: number, one: string, many: string) => { if (n > 0) moved.push(`${n} ${n === 1 ? one : many}`); };
  await prisma.$transaction(async (tx) => {
    if (want("managedClients")) {
      const r = await tx.client.updateMany({ where: { accountManagerId: fromId }, data: { accountManagerId: toId } });
      say(r.count, "client", "clients");
    }
    if (want("assignments")) {
      // A member can sit on a client's team once per department: where the new member is
      // already on it, the old row is simply dropped; otherwise it moves across.
      const [mine, theirs] = await Promise.all([
        tx.assignment.findMany({ where: { userId: fromId }, select: { id: true, clientId: true, department: true } }),
        tx.assignment.findMany({ where: { userId: toId }, select: { clientId: true, department: true } }),
      ]);
      const has = new Set(theirs.map((a) => `${a.clientId}:${a.department}`));
      const dup = mine.filter((a) => has.has(`${a.clientId}:${a.department}`)).map((a) => a.id);
      const move = mine.filter((a) => !has.has(`${a.clientId}:${a.department}`)).map((a) => a.id);
      if (dup.length) await tx.assignment.deleteMany({ where: { id: { in: dup } } });
      if (move.length) await tx.assignment.updateMany({ where: { id: { in: move } }, data: { userId: toId } });
      say(mine.length, "client team assignment", "client team assignments");
    }
    if (want("tasks")) say((await tx.task.updateMany({ where: openTasks(fromId), data: { assignedToId: toId } })).count, "task", "tasks");
    if (want("creative")) say((await tx.creativeTask.updateMany({ where: openCreative(fromId), data: { assignedToId: toId } })).count, "design / video task", "design / video tasks");
    if (want("devProjects")) say((await tx.devProject.updateMany({ where: openDev(fromId), data: { assignedToId: toId } })).count, "dev project", "dev projects");
    if (want("leads")) say((await tx.lead.updateMany({ where: openLeads(fromId), data: { assignedToId: toId } })).count, "sales lead", "sales leads");
    if (want("shoots")) say((await tx.shoot.updateMany({ where: openShoots(fromId), data: { assignedToId: toId } })).count, "shoot", "shoots");
    if (disable) await tx.user.update({ where: { id: fromId }, data: { active: false } });
  });

  if (moved.length) {
    // Tell the new owner what just landed on them (best-effort).
    try { await prisma.notification.create({ data: { userId: toId, title: `Work handed over from ${from.name}`, body: moved.join(" · "), link: "/", tone: "violet" } }); } catch { /* ignore */ }
  }
  revalidatePath("/team");
  revalidatePath("/");
  const what = moved.length ? `Moved ${moved.join(", ")} to ${to.name}.` : `${from.name} had nothing open to move.`;
  return { ok: true, message: `${what}${disable ? ` ${from.name}'s login is now disabled.` : ""}` };
}
