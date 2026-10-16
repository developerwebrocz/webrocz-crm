"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Minus, Plus, Save, CheckCircle2 } from "lucide-react";
import { WORK_TYPES } from "@/lib/domain";
import { NAME_ONLY } from "@/lib/team-kinds";

// Update Work for a designer / video editor: one piece of work at a time — the day, the client,
// what they made (picked from buttons), how many, done or not, a line about it and the files link.
// Saved as a normal work update, so it shows in Design Count / Editing Count for the Super Admin.

type Opt = { id: string; name: string; code?: string };
const STATUSES = [["COMPLETED", "Done"], ["IN_PROGRESS", "In progress"], ["PENDING_APPROVAL", "Sent for approval"]] as const;
const clean = (l: string) => l.replace(/ \((SMO|Video)\)$/, "");

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn btn-violet px-6 disabled:opacity-60" disabled={pending}><Save size={15} /> {pending ? "Saving…" : "Save work"}</button>;
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <div className="mb-1.5 text-[13px] font-medium text-[var(--ink-2)]">{children}{hint && <span className="font-normal text-[var(--muted)]"> · {hint}</span>}</div>;
}

export default function CreativeUpdateForm({ dept, clients, names = [], today, action, saved }: {
  dept: "DESIGN" | "VIDEO"; clients: Opt[]; names?: string[]; today: string; action: (fd: FormData) => void; saved?: boolean;
}) {
  const types = [...WORK_TYPES.filter((w) => w.dept === dept).map((w) => ({ v: w.v as string, l: clean(w.l) })), { v: "task", l: "Other" }];
  const [type, setType] = useState(types[0].v);
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<string>("COMPLETED");
  const noun = dept === "VIDEO" ? "video" : "design";

  return (
    <form action={action} className="card overflow-hidden !p-0">
      <input type="hidden" name="back" value="updates" />
      <input type="hidden" name="workType" value={type} />
      <input type="hidden" name="quantity" value={qty} />
      <input type="hidden" name="status" value={status} />

      <div className="border-b border-[var(--line)] px-5 py-4">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Add your work</h2>
        <p className="mt-0.5 text-[13px] text-[var(--muted)]">Add each piece of work you finish — the client, what you made and how many</p>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <label className="block"><Label>Date</Label><input name="date" type="date" required max={today} defaultValue={today} className="input" /></label>
          <label className="block">
            <Label>Client</Label>
            <select name="clientId" required className="select" defaultValue="">
              <option value="">Select the client</option>
              {names.length > 0 ? (
                <>
                  <optgroup label="Our brands">{names.map((n) => <option key={n} value={NAME_ONLY + n}>{n}</option>)}</optgroup>
                  <optgroup label="Clients">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </>
              ) : clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <div>
          <Label>What did you make?</Label>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => {
              const on = t.v === type;
              return (
                <button key={t.v} type="button" onClick={() => setType(t.v)} aria-pressed={on}
                  className="rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition"
                  style={{ borderColor: on ? "var(--violet)" : "var(--line-2)", background: on ? "var(--violet)" : "var(--surface)", color: on ? "white" : "var(--ink-2)" }}>
                  {t.l}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div>
            <Label>How many</Label>
            <div className="flex h-[42px] items-stretch overflow-hidden rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)]">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid w-10 flex-none place-items-center border-r border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)]" aria-label="One less"><Minus size={14} /></button>
              <input type="number" min={1} max={200} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 1)))} aria-label="How many"
                className="w-full min-w-0 border-0 bg-transparent text-center text-[15px] font-semibold outline-none tnum [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <button type="button" onClick={() => setQty((q) => Math.min(200, q + 1))} className="grid w-10 flex-none place-items-center border-l border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)]" aria-label="One more"><Plus size={14} /></button>
            </div>
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
        </div>

        <label className="block">
          <Label hint={type === "task" ? "required" : "optional"}>What was it about?</Label>
          <input name="title" required={type === "task"} maxLength={200} className="input"
            placeholder={type === "task" ? `Type the work you did` : dept === "VIDEO" ? "e.g. Diwali offer reel, client testimonial" : "e.g. Diwali offer posts, new menu poster"} />
        </label>

        <label className="block">
          <Label hint="optional">Link to the files</Label>
          <input name="proofLink" type="url" className="input" placeholder="Google Drive / Canva link" />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-2)] px-5 py-3.5">
        <span className="text-[13px] text-[var(--muted)]">
          {saved ? <span className="inline-flex items-center gap-1.5 font-medium text-[var(--emerald)]"><CheckCircle2 size={15} /> Saved — it&apos;s in your list below</span>
            : <>Adding: <b className="font-medium text-[var(--ink)]">{types.find((t) => t.v === type)?.l ?? noun}</b> × <b className="text-[var(--ink)] tnum">{qty}</b></>}
        </span>
        <Submit />
      </div>
    </form>
  );
}
