"use client";

import { useState } from "react";
import { NAME_ONLY } from "@/lib/team-kinds";

// The Client field of a work form: pick from the list, or "＋ Add new client" and type the name.
// Sends `clientId` — the client's id, or "name:<typed name>" (kept as a name, not a client
// record; a typed name that is already a client picks that client).
type Opt = { id: string; name: string; code?: string };
const NEW = "__new__";

export default function ClientPickField({ clients, names = [], namesLabel = "Added by the team", className = "select", required, defaultClientId = "", emptyLabel = "Select client" }: {
  clients: Opt[]; names?: string[]; namesLabel?: string; className?: string; required?: boolean; defaultClientId?: string; emptyLabel?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [typed, setTyped] = useState("");
  const name = typed.replace(/\s+/g, " ").trim();
  const known = clients.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());

  if (adding) return (
    <div className="relative">
      <input type="hidden" name="clientId" value={known ? known.id : name ? NAME_ONLY + name : ""} />
      <input value={typed} onChange={(e) => setTyped(e.target.value)} required={required} maxLength={160} autoFocus className={`${className} !pr-[100px]`} placeholder="Type the new client's name" aria-label="New client name" autoComplete="off" />
      <button type="button" onClick={() => { setAdding(false); setTyped(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[6px] px-1.5 py-0.5 text-[12px] font-medium text-[var(--violet)] hover:bg-[var(--surface-2)]">Pick from list</button>
    </div>
  );
  return (
    <select name="clientId" required={required} className={className} defaultValue={defaultClientId} onChange={(e) => { if (e.target.value === NEW) setAdding(true); }}>
      <option value="">{emptyLabel}</option>
      <option value={NEW}>＋ Add new client</option>
      {names.length > 0 ? (
        <>
          <optgroup label={namesLabel}>{names.map((n) => <option key={n} value={NAME_ONLY + n}>{n}</option>)}</optgroup>
          <optgroup label="Clients">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` · ${c.code}` : ""}</option>)}</optgroup>
        </>
      ) : clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` · ${c.code}` : ""}</option>)}
    </select>
  );
}
