import Image from "next/image";
import { redirect } from "next/navigation";
import { login, activateAccount } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Bounce to the app only when a REAL user is signed in (DB-checked). A stale cookie
  // whose user no longer exists falls through to the form — this is what prevents the
  // /login ↔ / redirect loop after a re-seed.
  if (await getCurrentUser()) redirect("/");
  const sp = await searchParams;
  const error = sp.error === "1" ? 1 : sp.error === "2" ? 2 : 0;
  const acterr = typeof sp.acterr === "string" ? sp.acterr : "";
  const startSetpw = sp.setpw === "1";
  const prefillEmail = typeof sp.email === "string" ? sp.email : "";
  const next = typeof sp.next === "string" ? sp.next : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-[400px]">
        {/* logo */}
        <div className="flex justify-center">
          <Image src="/webrocz-lockup.png" alt="WebRocz" width={177} height={121} className="h-[76px] w-auto object-contain" priority />
        </div>

        <div className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--violet)]">Admin Portal</div>

        {/* card */}
        <div className="card mt-4 p-7 sm:p-8" style={{ boxShadow: "var(--shadow-md)" }}>
          <LoginForm
            action={login} activateAction={activateAccount} next={next} error={error} acterr={acterr} startSetpw={startSetpw} prefillEmail={prefillEmail}
            portal="management"
            title="Admin sign in"
            subtitle="Super Admin access only."
          />
        </div>

        <p className="mt-6 text-center text-[12px] text-[var(--faint)]">© {new Date().getFullYear()} WebRocz</p>
      </div>
    </div>
  );
}
