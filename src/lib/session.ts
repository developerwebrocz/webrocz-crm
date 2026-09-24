import { SignJWT, jwtVerify } from "jose";

// Edge-safe session helpers (used by middleware + server) — no prisma, no node:crypto.
export const SESSION_COOKIE = "wr_session";
export const IMPERSONATE_COOKIE = "wr_view_as"; // super-admin "view as employee"

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "webrocz-dev-secret-change-in-production-0192837465"
);

export type SessionPayload = { uid: string; name: string; role: string };

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { uid: payload.uid as string, name: payload.name as string, role: payload.role as string };
  } catch {
    return null;
  }
}

// "View as employee" — a short-lived signed token holding the impersonated user's id.
export async function signImpersonation(uid: string) {
  return new SignJWT({ imp: uid }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(secret);
}
export async function verifyImpersonation(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret); return (payload.imp as string) ?? null; } catch { return null; }
}
