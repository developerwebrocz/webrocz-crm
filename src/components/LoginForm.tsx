"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { User, Lock, Eye, EyeOff, KeyRound, ArrowLeft } from "lucide-react";

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-violet mt-1 w-full !py-3 !text-[15px] disabled:opacity-60">
      {pending ? busy : label}
    </button>
  );
}

const ACT_ERR: Record<string, string> = {
  missing: "Enter your email and a password.",
  short: "Password must be at least 6 characters.",
  match: "The two passwords do not match.",
  nouser: "No account found for this email. Ask your admin to add you first.",
  exists: "You've already set a password — just sign in below (or ask your admin to reset it).",
  portal: "This email isn't allowed on this portal.",
};

export default function LoginForm({
  action, activateAction, next, error, acterr = "", startSetpw = false, prefillEmail = "",
  portal = "management",
  title = "Sign in to your account",
  subtitle = "Enter your email and password.",
  submitLabel = "Sign in",
}: {
  action: (fd: FormData) => void; activateAction: (fd: FormData) => void; next: string; error: number; acterr?: string;
  startSetpw?: boolean; prefillEmail?: string;
  portal?: "management" | "staff";
  title?: string; subtitle?: string; submitLabel?: string;
}) {
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState<"signin" | "setpw">(acterr || startSetpw ? "setpw" : "signin");

  if (mode === "setpw") {
    return (
      <div>
        <h1 className="text-center text-[20px] font-extrabold tracking-tight">Set your password</h1>
        <p className="mt-1 text-center text-[13px] text-[var(--muted)]">First time here? Create a password for your account.</p>

        {acterr && ACT_ERR[acterr] && (
          <div className="mt-5 rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--rose)_30%,white)] bg-[color-mix(in_srgb,var(--rose)_7%,white)] px-3.5 py-2.5 text-center text-[13px] font-medium text-[var(--rose)]">
            {ACT_ERR[acterr]}
          </div>
        )}

        <form action={activateAction} className="mt-6 space-y-4">
          <input type="hidden" name="portal" value={portal} />
          <Field icon={User} label="Your email" name="email" type="text" autoComplete="username" placeholder="you@webrocz.com" defaultValue={prefillEmail} />
          <PwField icon={KeyRound} label="New password" name="password" show={showPw} setShow={setShowPw} placeholder="At least 6 characters" />
          <Field icon={Lock} label="Confirm password" name="confirm" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter password" />
          <Submit label="Set password & continue" busy="Setting…" />
        </form>

        <button onClick={() => setMode("signin")} className="mt-4 flex w-full items-center justify-center gap-1.5 text-[12.5px] font-semibold text-[var(--violet)] hover:underline">
          <ArrowLeft size={14} /> Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-center text-[20px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-center text-[13px] text-[var(--muted)]">{subtitle}</p>

      {error === 1 && (
        <div className="mt-5 rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--rose)_30%,white)] bg-[color-mix(in_srgb,var(--rose)_7%,white)] px-3.5 py-2.5 text-center text-[13px] font-medium text-[var(--rose)]">
          Incorrect email or password.
        </div>
      )}
      {error === 2 && (
        <div className="mt-5 rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--amber)_35%,white)] bg-[color-mix(in_srgb,var(--amber)_9%,white)] px-3.5 py-3 text-center text-[13px] font-medium text-[var(--amber)]">
          {portal === "management"
            ? "This is the Admin portal — Super Admin only."
            : "This is the Team portal — for Account Managers & team members."}
        </div>
      )}

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="portal" value={portal} />
        <Field icon={User} label="Email" name="email" type="text" autoComplete="username" placeholder="you@webrocz.com" />
        <PwField icon={Lock} label="Password" name="password" show={showPw} setShow={setShowPw} placeholder="••••••••" autoComplete="current-password" />
        <Submit label={submitLabel} busy="Signing in…" />
      </form>

      <button onClick={() => setMode("setpw")} className="mt-5 flex w-full items-center justify-center gap-1.5 text-[12.5px] font-semibold text-[var(--violet)] hover:underline">
        <KeyRound size={14} /> First time here? Set your password
      </button>
    </div>
  );
}

function Field({ icon: Icon, label, name, type, autoComplete, placeholder, defaultValue }: { icon: typeof User; label: string; name: string; type: string; autoComplete?: string; placeholder: string; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-[var(--ink-2)]">{label}</span>
      <div className="relative">
        <Icon size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        <input name={name} type={type} required autoComplete={autoComplete} defaultValue={defaultValue} className="input !h-12 !pl-11 !text-[15px]" placeholder={placeholder} />
      </div>
    </label>
  );
}

function PwField({ icon: Icon, label, name, show, setShow, placeholder, autoComplete = "new-password" }: { icon: typeof User; label: string; name: string; show: boolean; setShow: (v: boolean) => void; placeholder: string; autoComplete?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-[var(--ink-2)]">{label}</span>
      <div className="relative">
        <Icon size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        <input name={name} type={show ? "text" : "password"} required autoComplete={autoComplete} className="input !h-12 !pl-11 !pr-11 !text-[15px]" placeholder={placeholder} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-md text-[var(--faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink-2)]">
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );
}
