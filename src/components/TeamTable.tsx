"use client";

import { Fragment, useMemo, useState } from "react";
import { initials, ROLES } from "@/lib/domain";
import { toggleUserActive, impersonate, resetUserPassword, updateUser, deleteUser, resendInvite } from "@/app/actions";
import { Search, Eye, KeyRound, Pencil, Trash2, Mail } from "lucide-react";

type Member = {
  id: string; name: string; role: string; email: string | null; phone: string | null; active: boolean;
  hasPassword: boolean;
  clients: number; projects: number; done: number; pending: number; total: number; openTasks: number;
  completion: number; lastActive: string | null;
};

const ROLE_ORDER = ["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "ACCOUNT_MANAGER", "DM_EXEC", "SEO_HEAD", "SEO", "DESIGNER", "EDITOR", "DEV_HEAD", "WEB_DEV"];
const roleTone: Record<string, string> = {
  SUPER_ADMIN: "var(--magenta)", SUB_ADMIN: "var(--magenta)", AM_HEAD: "var(--violet)", ACCOUNT_MANAGER: "var(--violet)", DM_EXEC: "var(--violet)",
  SEO_HEAD: "var(--sky)", SEO: "var(--sky)", DESIGNER: "var(--amber)", EDITOR: "var(--rose)",
  DEV_HEAD: "var(--emerald)", WEB_DEV: "var(--emerald)",
};

export default function TeamTable({ members }: { members: Member[] }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("ALL");
  const [editId, setEditId] = useState<string | null>(null);

  const roles = useMemo(() => {
    const present = new Set(members.map((m) => m.role));
    return ROLE_ORDER.filter((r) => present.has(r));
  }, [members]);

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return members
      .filter((m) => (role === "ALL" || m.role === role) && (!n || m.name.toLowerCase().includes(n) || (m.email ?? "").toLowerCase().includes(n)))
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || b.done - a.done);
  }, [members, q, role]);

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—");

  return (
    <div className="card !p-0 overflow-hidden">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[300px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team…"
            className="w-full rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[var(--violet)] focus:bg-[var(--surface)]" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterPill active={role === "ALL"} onClick={() => setRole("ALL")}>All</FilterPill>
          {roles.map((r) => (
            <FilterPill key={r} active={role === r} onClick={() => setRole(r)}>{ROLES[r as keyof typeof ROLES] ?? r}</FilterPill>
          ))}
        </div>
        <span className="ml-auto text-[12px] text-[var(--muted)] tnum">{visible.length} members</span>
      </div>

      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-[var(--line)]">
              {["Member", "Role", "Clients", "Output (mo)", "Pending", "Completion", "Open tasks", "Last active", ""].map((h, i) => (
                <th key={i} className={`th px-5 py-3 ${i >= 2 && i <= 6 ? "text-center" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <Fragment key={m.id}>
              <tr className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="avatar h-9 w-9 text-[12px]" style={{ borderRadius: 10 }}>{initials(m.name)}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold">{m.name}</span>
                        {!m.active && <span className="badge badge-slate">Inactive</span>}
                        {!m.hasPassword && <span className="badge badge-amber" title="Account created — the user still needs to set their password on the login page.">Pending set-up</span>}
                      </div>
                      <div className="truncate text-[11.5px] text-[var(--faint)]">{m.email ?? m.phone ?? ""}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: roleTone[m.role] ?? "var(--ink-2)" }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: roleTone[m.role] ?? "var(--ink-2)" }} />
                    {ROLES[m.role as keyof typeof ROLES] ?? m.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-center text-[13px] font-semibold tnum">{m.projects || m.clients || "—"}</td>
                <td className="px-5 py-3 text-center text-[13px] font-bold tnum">{m.done || "—"}</td>
                <td className="px-5 py-3 text-center text-[13px] tnum">{m.pending ? <span className="text-[var(--amber)] font-semibold">{m.pending}</span> : <span className="text-[var(--faint)]">0</span>}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${m.completion}%`, background: m.completion >= 80 ? "var(--emerald)" : m.completion >= 50 ? "var(--violet)" : "var(--amber)" }} /></div>
                    <span className="w-9 text-right text-[12px] font-semibold tnum text-[var(--muted)]">{m.total ? `${m.completion}%` : "—"}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-center text-[13px] tnum">{m.openTasks || <span className="text-[var(--faint)]">0</span>}</td>
                <td className="px-5 py-3 text-center text-[12.5px] text-[var(--muted)] tnum">{fmtDate(m.lastActive)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {m.active && m.role !== "SUPER_ADMIN" && (
                      <form action={impersonate}>
                        <input type="hidden" name="userId" value={m.id} />
                        <button title={`Open ${m.name}'s dashboard`} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--violet)]/40 text-[var(--violet)] transition hover:bg-[color-mix(in_srgb,var(--violet)_8%,white)]"><Eye size={14} /></button>
                      </form>
                    )}
                    {!m.hasPassword && m.email && (
                      <form action={resendInvite}>
                        <input type="hidden" name="id" value={m.id} />
                        <button title="Resend invite email (set-password link)" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--violet)]/40 text-[var(--violet)] transition hover:bg-[color-mix(in_srgb,var(--violet)_8%,white)]"><Mail size={13} /></button>
                      </form>
                    )}
                    <button title="Edit details" onClick={() => setEditId(editId === m.id ? null : m.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line-2)] text-[var(--ink-2)] transition hover:border-[var(--ink)]"><Pencil size={13} /></button>
                    {m.hasPassword && m.role !== "SUPER_ADMIN" && (
                      <form action={resetUserPassword}>
                        <input type="hidden" name="id" value={m.id} />
                        <button title="Reset password" onClick={(e) => { if (!window.confirm(`Reset ${m.name}'s password? They'll set a new one on the login page.`)) e.preventDefault(); }} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line-2)] text-[var(--ink-2)] transition hover:border-[var(--amber)] hover:text-[var(--amber)]"><KeyRound size={13} /></button>
                      </form>
                    )}
                    <form action={toggleUserActive}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="rounded-lg border border-[var(--line-2)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ink-2)] transition hover:border-[var(--ink)]">{m.active ? "Disable" : "Enable"}</button>
                    </form>
                    {m.role !== "SUPER_ADMIN" && (
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={m.id} />
                        <button title="Delete member" onClick={(e) => { if (!window.confirm(`Permanently delete ${m.name}? This removes their account and access.`)) e.preventDefault(); }} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line-2)] text-[var(--muted)] transition hover:border-[var(--rose)] hover:text-[var(--rose)]"><Trash2 size={13} /></button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
              {editId === m.id && (
                <tr className="bg-[var(--surface-2)]"><td colSpan={9} className="px-5 py-4">
                  <form action={updateUser} onSubmit={() => setEditId(null)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
                    <input type="hidden" name="id" value={m.id} />
                    <label className="block"><span className="eyebrow">Name</span><input name="name" required defaultValue={m.name} className="input mt-1.5" /></label>
                    <label className="block"><span className="eyebrow">Role</span><select name="role" defaultValue={m.role} className="select mt-1.5">{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                    <label className="block"><span className="eyebrow">Email (login)</span><input name="email" type="email" defaultValue={m.email ?? ""} className="input mt-1.5" /></label>
                    <label className="block"><span className="eyebrow">Phone</span><input name="phone" defaultValue={m.phone ?? ""} className="input mt-1.5" /></label>
                    <div className="flex items-end gap-2"><button type="submit" className="btn btn-violet">Save</button><button type="button" onClick={() => setEditId(null)} className="btn btn-ghost">Cancel</button></div>
                  </form>
                </td></tr>
              )}
              </Fragment>
            ))}
            {visible.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No team members match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${active ? "bg-[var(--ink)] text-white" : "border border-[var(--line-2)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}>
      {children}
    </button>
  );
}
