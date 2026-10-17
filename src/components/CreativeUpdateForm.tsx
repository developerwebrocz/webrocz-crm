"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Minus, Plus, Save, CheckCircle2, Check, X } from "lucide-react";
import { WORK_TYPES } from "@/lib/domain";
import { NAME_ONLY } from "@/lib/team-kinds";

// Update Work for a designer / video editor: one piece of work at a time — the day, the client,
// what they made (picked from buttons), how many, done or not, a line about it and the files link.
// Saved as a normal work update, so it shows in Design Count / Editing Count for the Super Admin.

type Opt = { id: string; name: string; code?: string };
const STATUSES = [["COMPLETED", "Done"], ["IN_PROGRESS", "In progress"], ["PENDING_APPROVAL", "Sent for approval"]] as const;
const clean = (l: string) => l.replace(/ \((SMO|Video)\)$/, "");

function Submit({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-violet px-6 disabled:opacity-60" disabled={pending || disabled}><Save size={15} /> {pending ? "Saving…" : "Save work"}</button>;
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <div className="mb-1.5 text-[13px] font-medium text-[var(--ink-2)]">{children}{hint && <span className="font-normal text-[var(--muted)]"> · {hint}</span>}</div>;
}

export default function CreativeUpdateForm({ dept, clients, names = [], today, action, saved }: {
  dept: "DESIGN" | "VIDEO"; clients: Opt[]; names?: string[]; today: string; action: (fd: FormData) => void; saved?: boolean;
}) {
  const types = [...WORK_TYPES.filter((w) => w.dept === dept).map((w) => ({ v: w.v as string, l: clean(w.l) })), { v: "task", l: "Other" }];
  // every kind of work made for this client, with how many of each (Banner 3, Logo 2 …)
  const [picked, setPicked] = useState<{ v: string; n: number }[]>([]);
  const toggle = (v: string) => setPicked((ps) => (ps.some((p) => p.v === v) ? ps.filter((p) => p.v !== v) : [...ps, { v, n: 1 }]));
  const setN = (v: string, n: number) => setPicked((ps) => ps.map((p) => (p.v === v ? { ...p, n: Math.max(1, Math.min(200, n)) } : p)));
  const labelOf = (v: string) => types.find((t) => t.v === v)?.l ?? v;
  const total = picked.reduce((s, p) => s + p.n, 0);
  const other = picked.some((p) => p.v === "task");
  const [status, setStatus] = useState<string>("COMPLETED");
  const noun = dept === "VIDEO" ? "video" : "design";
  // a client that is not in the list: "+ Add new client" → type the name (kept as a name on the
  // update; it shows in the list from then on). A name that is already a client picks that client.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const typed = newName.replace(/\s+/g, " ").trim();
  const known = clients.find((c) => c.name.trim().toLowerCase() === typed.toLowerCase());

  return (
    <form action={action} className="card overflow-hidden !p-0">
      <input type="hidden" name="back" value="updates" />
      <input type="hidden" name="items" value={JSON.stringify(picked.map((p) => ({ workType: p.v, quantity: p.n })))} />
      <input type="hidden" name="status" value={status} />

      <div className="border-b border-[var(--line)] px-5 py-4">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Add your work</h2>
        <p className="mt-0.5 text-[13px] text-[var(--muted)]">Add each piece of work you finish — the client, what you made and how many</p>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <label className="block"><Label>Date</Label><input name="date" type="date" required max={today} defaultValue={today} className="input" /></label>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>Client</Label>
              <button type="button" onClick={() => { setAdding((a) => !a); setNewName(""); }} className="mb-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--violet)] hover:underline">
                {adding ? "Pick from the list" : <><Plus size={13} /> Add new client</>}
              </button>
            </div>
            {adding ? (
              <>
                <input type="hidden" name="clientId" value={known ? known.id : typed ? NAME_ONLY + typed : ""} />
                <input value={newName} onChange={(e) => setNewName(e.target.value)} required maxLength={160} autoFocus className="input" placeholder="Type the new client's name" aria-label="New client name" />
              </>
            ) : (
            <select name="clientId" required className="select" defaultValue="">
              <option value="">Select the client</option>
              {names.length > 0 ? (
                <>
                  <optgroup label={dept === "VIDEO" ? "Our brands · added by the team" : "Added by the design team"}>{names.map((n) => <option key={n} value={NAME_ONLY + n}>{n}</option>)}</optgroup>
                  <optgroup label="Clients">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </>
              ) : clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            )}
          </div>
        </div>

        <div>
          <Label hint="tap every kind you made">What did you make?</Label>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => {
              const on = picked.some((p) => p.v === t.v);
              return (
                <button key={t.v} type="button" onClick={() => toggle(t.v)} aria-pressed={on}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition"
                  style={{ borderColor: on ? "var(--violet)" : "var(--line-2)", background: on ? "var(--violet)" : "var(--surface)", color: on ? "white" : "var(--ink-2)" }}>
                  {on ? <Check size={13} /> : <Plus size={13} />}{t.l}
                </button>
              );
            })}
          </div>
        </div>

        {/* how many of each kind picked — the total is worked out */}
        <div className="overflow-hidden rounded-[12px] border border-[var(--line)]">
          <div className="grid grid-cols-[minmax(0,1fr)_150px_36px] items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-[12px] font-medium text-[var(--muted)]">
            <span>Kind of {noun}</span><span className="text-center">How many</span><span />
          </div>
          {picked.length === 0 && <div className="px-4 py-5 text-center text-[13px] text-[var(--muted)]">Tap what you made above — Banner, Logo, Poster …</div>}
          {picked.map((p) => (
            <div key={p.v} className="grid grid-cols-[minmax(0,1fr)_150px_36px] items-center gap-3 border-b border-[var(--line)] px-4 py-2 last:border-0">
              <span className="truncate text-[14px] font-medium text-[var(--ink)]">{labelOf(p.v)}</span>
              <div className="flex h-[38px] items-stretch overflow-hidden rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)]">
                <button type="button" onClick={() => setN(p.v, p.n - 1)} className="grid w-9 flex-none place-items-center border-r border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)]" aria-label={`One less ${labelOf(p.v)}`}><Minus size={14} /></button>
                <input type="number" min={1} max={200} value={p.n} onChange={(e) => setN(p.v, parseInt(e.target.value, 10) || 1)} aria-label={`How many ${labelOf(p.v)}`}
                  className="w-full min-w-0 border-0 bg-transparent text-center text-[15px] font-semibold outline-none tnum [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                <button type="button" onClick={() => setN(p.v, p.n + 1)} className="grid w-9 flex-none place-items-center border-l border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)]" aria-label={`One more ${labelOf(p.v)}`}><Plus size={14} /></button>
              </div>
              <button type="button" onClick={() => toggle(p.v)} className="grid h-[34px] w-9 place-items-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--rose)]" title="Remove"><X size={15} /></button>
            </div>
          ))}
          {picked.length > 0 && (
            <div className="flex items-center justify-between bg-[var(--surface-2)] px-4 py-2.5 text-[13px]">
              <span className="font-medium text-[var(--ink-2)]">Total</span>
              <span><b className="text-[16px] font-semibold text-[var(--ink)] tnum">{total}</b> <span className="text-[var(--muted)]">{noun}{total === 1 ? "" : "s"}</span></span>
            </div>
          )}
        </div>

        <div>
          <Label>Status</Label>
            <div className="inline-flex h-[42px] overflow-hidden rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)]">
              {STATUSES.map(([k, l], i) => {
                const on = status === k;
                return (
                  <button key={k} type="button" onClick={() => setStatus(k)} aria-pressed={on}
                    className={`px-4 text-[13px] font-medium transition ${i ? "border-l border-[var(--line-2)]" : ""}`}
                    style={{ background: on ? "color-mix(in srgb, var(--violet) 10%, white)" : undefined, color: on ? "var(--violet)" : "var(--ink-2)" }}>
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

        <label className="block">
          <Label hint={other ? "required" : "optional"}>What was it about?</Label>
          <input name="title" required={other} maxLength={200} className="input"
            placeholder={other ? `Type the work you did` : dept === "VIDEO" ? "e.g. Diwali offer reel, client testimonial" : "e.g. Diwali offer posts, new menu poster"} />
        </label>

        <label className="block">
          <Label hint="optional">Link to the files</Label>
          <input name="proofLink" type="url" className="input" placeholder="Google Drive / Canva link" />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-2)] px-5 py-3.5">
        <span className="text-[13px] text-[var(--muted)]">
          {saved ? <span className="inline-flex items-center gap-1.5 font-medium text-[var(--emerald)]"><CheckCircle2 size={15} /> Saved — it&apos;s in your list below</span>
            : picked.length ? <>Adding: <b className="font-medium text-[var(--ink)]">{picked.map((p) => `${labelOf(p.v)} ${p.n}`).join(" · ")}</b></> : "Pick what you made"}
        </span>
        <Submit disabled={picked.length === 0} />
      </div>
    </form>
  );
}
