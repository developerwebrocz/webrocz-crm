"use client";

import { useActionState, useEffect, useState } from "react";
import { X, ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { ROLES } from "@/lib/domain";
import { getTransferSummary, transferWork, type TransferSummary, type TransferResult } from "@/app/team-transfer-actions";

// "Transfer work" dialog on the Team page: hand a member's open work to another member
// (e.g. when someone leaves), optionally disabling the original login in the same step.
type Person = { id: string; name: string; role: string; active: boolean };

const KINDS: { key: keyof TransferSummary; label: string; hint: string }[] = [
  { key: "managedClients", label: "Clients (as account manager)", hint: "The new member becomes their account manager." },
  { key: "assignments", label: "Client team assignments", hint: "SEO / design / video / dev seats on clients." },
  { key: "tasks", label: "Open tasks", hint: "Tasks not marked done." },
  { key: "creative", label: "Design / video tasks", hint: "Creative tasks not yet completed." },
  { key: "devProjects", label: "Dev projects", hint: "Projects that are not live yet." },
  { key: "leads", label: "Sales leads", hint: "Open leads (not onboarded or lost)." },
  { key: "shoots", label: "Shoots", hint: "Scheduled or in-progress shoots." },
];
const roleLabel = (r: string) => ROLES[r as keyof typeof ROLES] ?? r;

export default function TransferWorkModal({ member, members, close }: { member: Person; members: Person[]; close: () => void }) {
  const [summary, setSummary] = useState<TransferSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [result, action, pending] = useActionState<TransferResult, FormData>(transferWork, null);
  useEffect(() => {
    let alive = true;
    getTransferSummary(member.id).then((s) => { if (alive) { setSummary(s); setLoaded(true); } }).catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [member.id]);

  // Same-role colleagues first — they are the usual choice to take the work over.
  const others = members.filter((m) => m.active && m.id !== member.id);
  const sameRole = others.filter((m) => m.role === member.role);
  const otherRole = others.filter((m) => m.role !== member.role);
  const kinds = KINDS.filter((k) => (summary?.[k.key] ?? 0) > 0);
  const done = result?.ok;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[500px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Transfer work · {member.name}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{roleLabel(member.role)} · hand their open work to another team member.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>

        {done ? (
          <div className="space-y-4 px-6 py-6">
            <p className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[var(--emerald)]" style={{ background: "color-mix(in srgb, var(--emerald) 8%, white)" }}><CheckCircle2 size={16} className="mt-0.5 flex-none" /> {result?.message}</p>
            <div className="flex justify-end"><button type="button" onClick={close} className="btn btn-violet">Done</button></div>
          </div>
        ) : (
          <form action={action} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
            <input type="hidden" name="fromId" value={member.id} />
            <label className="block">
              <span className="eyebrow">Transfer to</span>
              <select name="toId" required defaultValue="" className="select mt-1">
                <option value="" disabled>Choose a team member…</option>
                {sameRole.length > 0 && <optgroup label={`Same role · ${roleLabel(member.role)}`}>{sameRole.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>}
                {otherRole.length > 0 && <optgroup label="Other roles">{otherRole.map((m) => <option key={m.id} value={m.id}>{m.name} — {roleLabel(m.role)}</option>)}</optgroup>}
              </select>
            </label>

            <div>
              <span className="eyebrow">What to move</span>
              <div className="mt-1.5 space-y-2 rounded-[10px] border border-[var(--line)] p-3">
                {!loaded && <p className="text-[12.5px] text-[var(--muted)]">Checking {member.name}&apos;s work…</p>}
                {loaded && kinds.length === 0 && <p className="text-[12.5px] text-[var(--muted)]">{member.name} has no open work to move.</p>}
                {kinds.map((k) => (
                  <label key={k.key} className="flex cursor-pointer items-start gap-2.5 text-[13px]">
                    <input type="checkbox" name={k.key} defaultChecked className="mt-0.5 h-4 w-4 accent-[var(--violet)]" />
                    <span className="flex-1"><span className="font-semibold">{k.label}</span><span className="block text-[11.5px] text-[var(--muted)]">{k.hint}</span></span>
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[12px] font-bold tnum">{summary?.[k.key]}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--faint)]">Finished work and past reports stay under {member.name}.</p>
            </div>

            {member.role !== "SUPER_ADMIN" && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-[var(--line)] p-3 text-[13px]">
                <input type="checkbox" name="disable" defaultChecked={member.active} className="mt-0.5 h-4 w-4 accent-[var(--rose)]" />
                <span><span className="font-semibold">Disable {member.name}&apos;s login</span><span className="block text-[11.5px] text-[var(--muted)]">Tick when they have left. You can enable it again from the Team list.</span></span>
              </label>
            )}

            {result && !result.ok && <p className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold text-[var(--rose)]" style={{ background: "color-mix(in srgb, var(--rose) 8%, white)" }}>{result.message}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={pending} className="btn btn-violet disabled:opacity-60"><ArrowRightLeft size={15} /> {pending ? "Transferring…" : "Transfer work"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
