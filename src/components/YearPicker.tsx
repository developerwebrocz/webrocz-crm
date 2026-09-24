"use client";


export default function YearPicker({ years, active }: { years: number[]; active: number }) {
  return (
    <div className="flex gap-1.5">
      {years.map((y) => (
        <button
          key={y}
          onClick={() => window.location.assign(`/billing?year=${y}`)}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
            y === active ? "bg-[var(--violet)] text-white" : "border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--ink)]"
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}
