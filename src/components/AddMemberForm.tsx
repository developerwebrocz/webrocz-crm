"use client";

import { useFormStatus } from "react-dom";
import { ROLES } from "@/lib/domain";
import { UserPlus } from "lucide-react";

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn btn-violet disabled:opacity-60" disabled={pending}><UserPlus size={15} /> {pending ? "Adding…" : "Add member"}</button>;
}

export default function AddMemberForm({ action }: { action: (fd: FormData) => void }) {
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <label className="block lg:col-span-1">
        <span className="eyebrow">Name *</span>
        <input name="name" required className="input mt-1.5" placeholder="Full name" />
      </label>
      <label className="block">
        <span className="eyebrow">Role *</span>
        <select name="role" required className="select mt-1.5" defaultValue="">
          <option value="" disabled>Select role</option>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="eyebrow">Email * <span className="font-normal normal-case text-[var(--faint)]">(their login)</span></span>
        <input name="email" type="email" required className="input mt-1.5" placeholder="name@webrocz.com" />
      </label>
      <label className="block">
        <span className="eyebrow">Phone</span>
        <input name="phone" className="input mt-1.5" placeholder="+91 …" />
      </label>
      <label className="block">
        <span className="eyebrow">Password <span className="font-normal normal-case text-[var(--faint)]">(optional)</span></span>
        <input name="password" type="text" className="input mt-1.5" placeholder="Leave blank → user sets it" />
      </label>
      <div className="sm:col-span-2 lg:col-span-5">
        <p className="text-[11.5px] text-[var(--muted)]">Add the member by email and leave the password blank — they set their own password on the login page (“First time here? Set your password”). Or type a password to set one for them.</p>
      </div>
      <Submit />
    </form>
  );
}
