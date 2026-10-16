"use client";

import { useState } from "react";
import { Save, CheckCircle2 } from "lucide-react";
import { saveEditCount } from "@/app/edit-count-actions";
import DesignWorkEditor from "@/components/DesignWorkEditor";
import type { DesignWorkItem } from "@/lib/design-work";

// A designer's / editor's own entry: pick the day (today by default), then the work client by
// client. A day already saved opens with its lines, so it can be corrected.

type Day = { count: number; note: string; items: DesignWorkItem[] };

export default function DayEntryCard({ team, today, firstDay, days, clientNames, types, noun, saved }: {
  team: string; today: string; firstDay: string; days: Record<string, Day>; clientNames: string[]; types: readonly string[]; noun: string; saved?: boolean;
}) {
  const [date, setDate] = useState(today);
  const cur = days[date];
  const label = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="card overflow-hidden !p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">{date === today ? "Today’s work" : "Work on " + label(date)}</h2>
          <p className="mt-0.5 text-[13px] text-[var(--muted)]">Add each client you worked for, the kind of {noun} and how many</p>
        </div>
        <div className="flex items-center gap-2">
          {cur ? <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--emerald)_10%,white)] px-2.5 py-1 text-[12px] font-medium text-[var(--emerald)]"><CheckCircle2 size={13} /> Saved · {cur.count}</span>
            : <span className="rounded-full bg-[color-mix(in_srgb,var(--amber)_12%,white)] px-2.5 py-1 text-[12px] font-medium text-[#92600a]">Not entered yet</span>}
          <input type="date" value={date} min={firstDay} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="input !h-9 !w-auto !py-1 text-[13px]" aria-label="Day" />
        </div>
      </div>
      <form key={date + "|" + (cur?.count ?? "") + "|" + (cur?.items.length ?? 0)} action={saveEditCount} className="space-y-4 px-5 py-4">
        <input type="hidden" name="team" value={team} />
        <input type="hidden" name="date" value={date} />
        <DesignWorkEditor clientNames={clientNames} defaultItems={cur?.items ?? []} defaultCount={cur && !cur.items.length ? cur.count : null} types={types} noun={noun} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[220px] flex-1"><span className="text-[12.5px] font-medium text-[var(--ink-2)]">Note (optional)</span><input name="note" maxLength={300} defaultValue={cur?.note ?? ""} placeholder="Half day, waiting for client content…" className="input mt-1.5" /></label>
          <button type="submit" className="btn btn-violet px-6"><Save size={15} /> {cur ? "Update" : "Save"}</button>
        </div>
        {saved && <p className="text-[12.5px] font-medium text-[var(--emerald)]">Saved.</p>}
      </form>
    </div>
  );
}
