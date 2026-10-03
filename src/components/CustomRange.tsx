"use client";

import { useState } from "react";
import { CalendarRange, ArrowRight } from "lucide-react";

// Shown only when the "Custom" period is active. A professional date-range panel:
// quick-pick shortcuts + explicit From/To inputs. Applying reloads /reports with
// period=custom&from=…&to=…. Plain full-page navigation (no router hooks) to match
// PeriodTabs/ReportFilters and avoid a Suspense boundary.

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CustomRange({
  from = "",
  to = "",
  extra = {},
}: {
  from?: string;
  to?: string;
  extra?: Record<string, string>;
}) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function go(fromV: string, toV: string) {
    const params = new URLSearchParams();
    params.set("period", "custom");
    if (fromV) params.set("from", fromV);
    if (toV) params.set("to", toV);
    for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
    window.location.assign(`/reports?${params.toString()}`);
  }

  // Quick ranges, computed against today.
  const presets: { label: string; range: () => [string, string] }[] = [
    { label: "Last 7 days", range: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 6); return [iso(s), iso(e)]; } },
    { label: "Last 30 days", range: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 29); return [iso(s), iso(e)]; } },
    { label: "Last 90 days", range: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 89); return [iso(s), iso(e)]; } },
    { label: "This quarter", range: () => { const n = new Date(); const q = Math.floor(n.getMonth() / 3); const s = new Date(n.getFullYear(), q * 3, 1); const e = new Date(n.getFullYear(), q * 3 + 3, 0); return [iso(s), iso(e)]; } },
    { label: "Year to date", range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), 0, 1)), iso(n)]; } },
  ];

  const applied = !!(from && to);
  const fmt = (s: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

  return (
    <div className="rounded-2xl border border-[var(--line-2)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[color:var(--violet)]/10 text-[var(--violet)]">
            <CalendarRange size={18} />
          </span>
          <div>
            <div className="text-sm font-bold leading-tight">Custom date range</div>
            <div className="text-xs text-[var(--muted)]">
              {applied ? `Showing ${fmt(from)} → ${fmt(to)}` : "Pick a start and end date, or use a shortcut."}
            </div>
          </div>
        </div>
        {applied && (
          <a href="/reports?period=month" className="rounded-lg border border-[var(--line-2)] px-3 py-1.5 text-[13px] font-semibold text-[var(--ink-2)] transition hover:border-[var(--ink)]">
            Reset to this month
          </a>
        )}
      </div>

      {/* Quick-pick shortcuts */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => { const [s, e] = p.range(); setF(s); setT(e); go(s, e); }}
            className="rounded-lg border border-[var(--line-2)] bg-[var(--bg)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-2)] transition hover:border-[var(--violet)] hover:text-[var(--violet)]"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Explicit From / To */}
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">From</span>
          <input type="date" className="select !w-auto" value={f} max={t || undefined} onChange={(e) => setF(e.target.value)} />
        </label>
        <ArrowRight size={16} className="mb-2.5 text-[var(--muted)]" />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">To</span>
          <input type="date" className="select !w-auto" value={t} min={f || undefined} onChange={(e) => setT(e.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => go(f, t)}
          disabled={!f || !t}
          className="rounded-lg bg-[var(--violet)] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply range
        </button>
      </div>
    </div>
  );
}
