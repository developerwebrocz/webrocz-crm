"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { WORK_STATUS, WORK_TYPES } from "@/lib/domain";
import { Eyebrow } from "./ui";

type Opt = { id: string; name: string; code?: string };

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}{required && <span className="text-[var(--rose)]"> *</span>}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn btn-dark disabled:opacity-60" disabled={pending}>{pending ? "Saving…" : "Save update"}</button>;
}

export default function UpdateForm({
  clients, users, action, defaultClientId, today, currentUser, lockUser = false,
}: {
  clients: Opt[]; users: Opt[]; action: (fd: FormData) => void; defaultClientId?: string; today: string;
  currentUser?: { id: string; name: string }; lockUser?: boolean;
}) {
  const [workType, setWorkType] = useState("static");
  const isRanking = workType === "ranking";

  return (
    <form action={action} className="card card-pad grid gap-4 sm:grid-cols-2">
      <Field label="Client" required>
        <select name="clientId" required className="select" defaultValue={defaultClientId ?? ""}>
          <option value="">Select client</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` · ${c.code}` : ""}</option>)}
        </select>
      </Field>
      <Field label="Team member" required>
        {lockUser && currentUser ? (
          <>
            <input type="hidden" name="userId" value={currentUser.id} />
            <div className="input flex items-center bg-[var(--surface-2)] text-[var(--muted)]">{currentUser.name} (you)</div>
          </>
        ) : (
          <select name="userId" required className="select" defaultValue={currentUser?.id ?? ""}>
            <option value="">Select member</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </Field>

      <Field label="Update date" required>
        <input name="date" type="date" required className="input" defaultValue={today} />
      </Field>
      <Field label="Work type" required>
        <select name="workType" className="select" value={workType} onChange={(e) => setWorkType(e.target.value)}>
          {WORK_TYPES.map((w) => <option key={w.v} value={w.v}>{w.l}</option>)}
        </select>
      </Field>

      <Field label="Quantity"><input name="quantity" type="number" min={1} defaultValue={1} className="input" /></Field>
      <Field label="Status" required>
        <select name="status" className="select" defaultValue="COMPLETED">
          {Object.entries(WORK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>

      <div className="sm:col-span-2">
        <Field label="Title / description"><input name="title" className="input" placeholder="Short summary of the work" /></Field>
      </div>

      {isRanking && (
        <>
          <div className="sm:col-span-2 -mb-1"><Eyebrow>SEO ranking</Eyebrow></div>
          <Field label="Keyword"><input name="keyword" className="input" placeholder="best cakes near me" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Previous position"><input name="prevPosition" type="number" className="input" /></Field>
            <Field label="Current position"><input name="currPosition" type="number" className="input" /></Field>
          </div>
        </>
      )}

      <Field label="Proof / work link"><input name="proofLink" className="input" placeholder="https://…" /></Field>
      <Field label="Next follow-up date"><input name="followUpDate" type="date" className="input" /></Field>

      <Field label="Outcome / effect"><input name="effect" className="input" placeholder="e.g. +3 positions, 12 leads" /></Field>
      <div className="hidden sm:block" />
      <div className="sm:col-span-2">
        <Field label="Notes"><textarea name="notes" rows={3} className="textarea" placeholder="Anything worth recording" /></Field>
      </div>

      <div className="sm:col-span-2 flex gap-2">
        <Submit />
        <a href="/clients" className="btn btn-ghost">Cancel</a>
      </div>
    </form>
  );
}
