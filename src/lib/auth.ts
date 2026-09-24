import "server-only";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { SESSION_COOKIE, IMPERSONATE_COOKIE, verifySession, verifyImpersonation } from "./session";

const USER_SELECT = { id: true, name: true, role: true, email: true, active: true } as const;

// ---- password hashing (scrypt, no native deps) ----
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const hashBuf = Buffer.from(hash, "hex");
  const test = scryptSync(password, salt, 64);
  return hashBuf.length === test.length && timingSafeEqual(hashBuf, test);
}

// ---- the REAL signed-in user (ignores "view as") ----
export async function getRealUser() {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.uid }, select: USER_SELECT });
  return user && user.active ? user : null;
}

// ---- effective current user: the impersonated employee when a Super Admin is "viewing as" ----
export async function getCurrentUser() {
  const real = await getRealUser();
  if (!real) return null;
  if (real.role === "SUPER_ADMIN" || real.role === "SUB_ADMIN") {
    const store = await cookies();
    const impUid = await verifyImpersonation(store.get(IMPERSONATE_COOKIE)?.value);
    if (impUid && impUid !== real.id) {
      const target = await prisma.user.findUnique({ where: { id: impUid }, select: USER_SELECT });
      if (target && target.active) return { ...target, impersonatedBy: real.name };
    }
  }
  return { ...real, impersonatedBy: null as string | null };
}
