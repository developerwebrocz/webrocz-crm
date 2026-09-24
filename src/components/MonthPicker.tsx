"use client";

import { Calendar } from "lucide-react";

export default function MonthPicker({ months, active }: { months: { key: string; label: string }[]; active: string }) {
  return (
    <div className="relative">
      <Calendar size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
      <select
        value={active}
        onChange={(e) => window.location.assign(`/billing?month=${e.target.value}`)}
        className="select !w-auto !pl-9 font-semibold"
        aria-label="Billing month"
      >
        {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
      </select>
    </div>
  );
}
