"use client";

import { useState } from "react";
import { Plus, Minus, X } from "lucide-react";
import { DESIGN_WORK_TYPES, type DesignWorkItem } from "@/lib/design-work";

// The designer's day, client by client: client · type of design · how many. The total is
// worked out from the lines; both go with the form (`items` as JSON, `count` as the total).
// No lines and saved = the day's entry is removed.

// `custom`: the client is typed in ("+ Add new client") instead of picked from the list
type Row = { key: number; client: string; type: string; count: number; custom?: boolean };
let next = 1;
const rowOf = (it?: Partial<DesignWorkItem>, first: string = DESIGN_WORK_TYPES[0]): Row => ({ key: next++, client: it?.client ?? "", type: it?.type || first, count: it?.count && it.count > 0 ? it.count : 1 });
const NEW = "__new__";

// `types` / `noun`: the team's kinds of work and word (designs by default; the video team passes its own).
export default function DesignWorkEditor({ clientNames, defaultItems = [], defaultCount = null, big = false, types = DESIGN_WORK_TYPES, noun = "design" }: { clientNames: string[]; defaultItems?: DesignWorkItem[]; defaultCount?: number | null; big?: boolean; types?: readonly string[]; noun?: string }) {
  // a day saved before the client lines existed has only a number: start with one line holding it
  const known = new Set(clientNames.map((n) => n.trim().toLowerCase()));
  // a saved line whose client is not in the list opens as a typed name
  const withCustom = (r: Row): Row => ({ ...r, custom: !!r.client && !known.has(r.client.trim().toLowerCase()) });
  const [rows, setRows] = useState<Row[]>(() => (defaultItems.length ? defaultItems.map((it) => rowOf(it, types[0])) : defaultCount ? [rowOf({ count: defaultCount, client: "" }, types[0])] : [rowOf(undefined, types[0])]).map(withCustom));
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // every line with a number counts; a line without a client name still adds to the day's number
  const filled = rows.filter((r) => r.count > 0);
  const named = filled.filter((r) => r.client.trim());
  const total = filled.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-2">
      <input type="hidden" name="items" value={JSON.stringify(named.map((r) => ({ client: r.client.trim(), type: r.type, count: r.count })))} />
      <input type="hidden" name="count" value={filled.length ? String(total) : ""} />
      <div className="hidden gap-2 px-0.5 text-[12px] font-medium text-[var(--muted)] sm:grid sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_132px_32px]">
        <span>Client</span><span>{noun === "design" ? "Design type" : "Video type"}</span><span>How many</span><span />
      </div>
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_132px_32px]">
          {r.custom ? (
            <div className="relative col-span-2 sm:col-span-1">
              <input value={r.client} onChange={(e) => set(r.key, { client: e.target.value })} placeholder="Type the new client's name" className="input !pr-[92px]" autoComplete="off" autoFocus={!r.client} aria-label="New client name" />
              <button type="button" onClick={() => set(r.key, { custom: false, client: "" })} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[6px] px-1.5 py-0.5 text-[12px] font-medium text-[var(--violet)] hover:bg-[var(--surface-2)]">Pick from list</button>
            </div>
          ) : (
            <select value={known.has(r.client.trim().toLowerCase()) ? clientNames.find((n) => n.trim().toLowerCase() === r.client.trim().toLowerCase()) : ""} onChange={(e) => (e.target.value === NEW ? set(r.key, { custom: true, client: "" }) : set(r.key, { client: e.target.value }))} className="select col-span-2 sm:col-span-1" aria-label="Client">
              <option value="">Select the client</option>
              <option value={NEW}>＋ Add new client</option>
              {[...new Set(clientNames)].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <select value={r.type} onChange={(e) => set(r.key, { type: e.target.value })} className="select">
            {[...new Set([...types, r.type])].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex items-stretch overflow-hidden rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)]">
            <button type="button" onClick={() => set(r.key, { count: Math.max(1, r.count - 1) })} className="grid w-9 flex-none place-items-center border-r border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)]" aria-label="One less"><Minus size={14} /></button>
            <input type="number" min={1} max={200} value={r.count} onChange={(e) => set(r.key, { count: Math.max(0, Math.min(200, parseInt(e.target.value, 10) || 0)) })} className="h-[42px] w-full min-w-0 border-0 bg-transparent text-center text-[15px] font-semibold outline-none tnum [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            <button type="button" onClick={() => set(r.key, { count: Math.min(200, r.count + 1) })} className="grid w-9 flex-none place-items-center border-l border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)]" aria-label="One more"><Plus size={14} /></button>
          </div>
          <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="grid h-[42px] w-8 place-items-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--rose)]" title="Remove this line"><X size={15} /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <button type="button" onClick={() => setRows((rs) => [...rs, rowOf(undefined, types[0])])} className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[13px] font-medium text-[var(--violet)] hover:bg-[color-mix(in_srgb,var(--violet)_8%,white)]"><Plus size={14} /> Add another client / {noun}</button>
        <span className="text-[13px] text-[var(--muted)]">Total: <b className="text-[16px] font-semibold text-[var(--ink)] tnum">{total}</b> {noun}{total === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}
