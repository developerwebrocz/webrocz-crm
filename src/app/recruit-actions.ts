"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const HR_ROLES = ["SUPER_ADMIN", "SUB_ADMIN"];
function s(fd: FormData, k: string) { return (fd.get(k) as string | null)?.toString().trim() ?? ""; }
function n(fd: FormData, k: string) { const v = parseInt(s(fd, k).replace(/[^\d-]/g, ""), 10); return Number.isFinite(v) ? v : 0; }
async function guard() { const me = await getCurrentUser(); return me && HR_ROLES.includes(me.role) ? me : null; }

async function saveUpload(file: unknown): Promise<string> {
  if (!file || typeof file === "string") return "";
  const f = file as File;
  if (!f.size || !f.arrayBuffer) return "";
  const { writeFile, mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const buf = Buffer.from(await f.arrayBuffer());
  const safe = (f.name || "resume").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const fname = `${Date.now()}-${safe}`;
  const dir = path.join(process.cwd(), "public", "uploads", "resumes");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fname), buf);
  return `/uploads/resumes/${fname}`;
}

export async function createCandidate(fd: FormData) {
  const me = await guard();
  if (!me) redirect("/");
  const name = s(fd, "name");
  if (!name) redirect("/hiring");
  const last = await prisma.candidate.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const num = last ? parseInt(last.code.replace(/\D/g, ""), 10) + 1 : 1;
  const resume = await saveUpload(fd.get("resume"));
  await prisma.candidate.create({
    data: {
      code: `CAND-${String(num).padStart(4, "0")}`, name, phone: s(fd, "phone"), email: s(fd, "email"),
      position: s(fd, "position"), department: s(fd, "department"), source: s(fd, "source"),
      experience: s(fd, "experience"), expectedCtc: n(fd, "expectedCtc"), resumeUrl: resume || s(fd, "resumeUrl"),
      notes: s(fd, "notes"), stage: "APPLIED",
    },
  });
  revalidatePath("/hiring");
  redirect("/hiring");
}

export async function setCandidateStage(fd: FormData) {
  const me = await guard();
  if (!me) redirect("/");
  const id = s(fd, "id"); const stage = s(fd, "stage");
  const VALID = ["APPLIED", "INTERVIEW", "SHORTLISTED", "OFFER", "HIRED", "REJECTED"];
  if (!id || !VALID.includes(stage)) redirect("/hiring");
  await prisma.candidate.update({ where: { id }, data: { stage, ...(stage === "REJECTED" ? { rejectReason: s(fd, "rejectReason") } : {}) } });
  revalidatePath("/hiring");
  redirect("/hiring");
}

export async function updateCandidate(fd: FormData) {
  const me = await guard();
  if (!me) redirect("/");
  const id = s(fd, "id");
  const c = await prisma.candidate.findUnique({ where: { id } });
  if (!c) redirect("/hiring");
  const resume = await saveUpload(fd.get("resume"));
  await prisma.candidate.update({
    where: { id },
    data: {
      name: s(fd, "name") || c.name, phone: s(fd, "phone"), email: s(fd, "email"),
      position: s(fd, "position"), department: s(fd, "department"), source: s(fd, "source"),
      experience: s(fd, "experience"), expectedCtc: n(fd, "expectedCtc"), resumeUrl: resume || s(fd, "resumeUrl") || c.resumeUrl,
      notes: s(fd, "notes"),
    },
  });
  revalidatePath("/hiring");
  redirect("/hiring");
}

export async function addCandidateNote(fd: FormData) {
  const me = await guard();
  if (!me) redirect("/");
  const id = s(fd, "id"); const note = s(fd, "note");
  const c = await prisma.candidate.findUnique({ where: { id } });
  if (!c || !note) redirect("/hiring");
  let log: { date: string; by: string; note: string }[] = [];
  try { const a = JSON.parse(c.notesLog || "[]"); if (Array.isArray(a)) log = a; } catch { /* ignore */ }
  log.unshift({ date: new Date().toISOString().slice(0, 16).replace("T", " "), by: me.name, note });
  await prisma.candidate.update({ where: { id }, data: { notesLog: JSON.stringify(log.slice(0, 100)) } });
  revalidatePath("/hiring");
  redirect("/hiring");
}

export async function deleteCandidate(fd: FormData) {
  const me = await guard();
  if (!me) redirect("/");
  const id = s(fd, "id");
  if (id) { try { await prisma.candidate.delete({ where: { id } }); } catch { /* gone */ } }
  revalidatePath("/hiring");
  redirect("/hiring");
}
