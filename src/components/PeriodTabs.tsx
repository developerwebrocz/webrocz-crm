import { PERIODS } from "@/lib/period";

// Plain full-page-nav tabs (no client hooks / no Suspense → the page never has to
// stream, which keeps it loading reliably in every browser). The active period is
// passed from the server; links are relative `?period=` so they resolve on any path.
export default function PeriodTabs({ active = "month", showLabel = false }: { active?: string; showLabel?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showLabel && <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Period</span>}
      {PERIODS.map((p) => (
        <a
          key={p.key}
          href={`?period=${p.key}`}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
            active === p.key ? "bg-[var(--violet)] text-white" : "border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--ink)]"
          }`}
        >
          {p.label}
        </a>
      ))}
    </div>
  );
}
