"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

// Number of videos with big − / + buttons (easy on a phone); still typeable. Posts as `name`.
// An empty box stays empty (that is how a wrong entry is removed).
export default function CountStepper({ name = "count", defaultValue = "", big = false }: { name?: string; defaultValue?: number | ""; big?: boolean }) {
  const [v, setV] = useState(defaultValue === "" ? "" : String(defaultValue));
  const step = (by: number) => setV((cur) => String(Math.min(500, Math.max(0, (parseInt(cur, 10) || 0) + by))));
  const h = big ? "h-12" : "h-[42px]";
  const btn = `grid ${h} ${big ? "w-12" : "w-10"} flex-none place-items-center text-[var(--ink-2)] transition hover:bg-[var(--surface-3)] active:scale-95`;
  return (
    <div className="flex items-stretch overflow-hidden rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] focus-within:border-[var(--violet)]">
      <button type="button" onClick={() => step(-1)} className={`${btn} border-r border-[var(--line-2)] bg-[var(--surface-2)]`} aria-label="One less"><Minus size={big ? 18 : 15} /></button>
      <input type="number" name={name} min={0} max={500} step={1} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} placeholder="0"
        className={`${h} w-full min-w-0 border-0 bg-transparent text-center font-extrabold outline-none tnum ${big ? "text-[22px]" : "text-[16px]"} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
      <button type="button" onClick={() => step(1)} className={`${btn} border-l border-[var(--line-2)] bg-[var(--surface-2)]`} aria-label="One more"><Plus size={big ? 18 : 15} /></button>
    </div>
  );
}
