"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Video editor dashboard: move one of MY videos to its next step (start → review → completed)
// and stay on the dashboard. (The full board in "My Videos" keeps its own actions.)
const STEPS = ["PENDING", "IN_PROGRESS", "REVIEW", "COMPLETED"];

export async function advanceVideoTask(fd: FormData) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  const task = id ? await prisma.creativeTask.findUnique({ where: { id }, select: { assignedToId: true, kind: true } }) : null;
  if (task && task.kind === "VIDEO" && task.assignedToId === me.id && STEPS.includes(status)) {
    await prisma.creativeTask.update({ where: { id }, data: { status } });
    revalidatePath("/videos");
  }
  revalidatePath("/");
  redirect("/");
}
