"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { DesignSheetData } from "@/lib/design-sheet-queries";

// The design team's work as one sheet: pick the day / week / month and a client; click a
// designer's box to see only their work. One line per piece of work — designer, client, work,
// how many, who assigned it, status — and the total at the bottom.

const PERIODS = [["today", "Today"], ["yesterday", "Yesterday"], ["week", "This week"], ["month", "This month"]] as const;
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
const TONE: Record<string, string> = { Done: "var(--emerald)", "In progress": "var(--sky)", "In review": "var(--violet)", Pending: "var(--amber)" };
const tint = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, white)`;

export default function DesignSheet({ d }: { d: DesignSheetData }) {
  const router = useRouter();
  const sp = useSearchParams();
  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    p.delete("saved");
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    router.push(`/design-team?${p.toString()}`, { scroll: false });
  };
  const periodLabel = PERIODS.find(([k]) => k === d.period)?.[1] ?? "Today";

  return (
    <div className="space-y-4">
      {/* date + client */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[13px] text-[var(--muted)]">Date</span>
        <select value={d.period} onChange={(e) => go({ period: e.target.value })} className="select !w-auto">
          {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}{k === "today" ? ` · ${fmt(d.today)}` : ""}</option>)}
        </select>
        <span className="ml-2 text-[13px] text-[var(--muted)]">Client</span>
        <select value={d.clientQ} onChange={(e) => go({ client: e.target.value })} className="select !w-auto max-w-[260px]">
          <option value="">All clients</option>
          {d.clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* designers — click one to see only their work */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {[{ id: "", name: "All designers", total: d.allTotal, notUpdated: false, lead: false }, ...d.people].map((p) => {
          const on = d.designerQ === p.id;
          return (
            <button key={p.id || "all"} type="button" onClick={() => go({ designer: p.id })}
              className="rounded-[12px] border bg-[var(--surface)] px-3.5 py-2.5 text-left transition hover:bg-[var(--surface-2)]"
              style={{ borderColor: on ? "var(--violet)" : "var(--line-2)", boxShadow: on ? "0 0 0 1px var(--violet)" : undefined }}>
              <div className="truncate text-[12.5px] text-[var(--muted)]">{p.name}{p.lead ? " · Lead" : ""}</div>
              {p.notUpdated && p.total === 0
                ? <div className="mt-1 text-[13px] font-semibold text-[var(--rose)]">Not updated</div>
                : <div className="mt-0.5 text-[22px] font-extrabold leading-tight tnum">{p.total}</div>}
            </button>
          );
        })}
      </div>

      {/* the sheet */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[760px] text-[13.5px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-left text-[12px] font-semibold text-[var(--muted)]">
                {d.showDate && <th className="px-4 py-2.5">Date</th>}
                <th className="px-4 py-2.5">Designer</th><th className="px-4 py-2.5">Client</th><th className="px-4 py-2.5">Work</th>
                <th className="px-4 py-2.5 text-center">How many</th><th className="px-4 py-2.5">Assigned by</th><th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.length === 0 && (
                <tr><td colSpan={d.showDate ? 7 : 6} className="px-4 py-10 text-center text-[13px] text-[var(--muted)]">No work entered for {periodLabel.toLowerCase()}{d.clientQ ? ` for ${d.clientQ}` : ""}.</td></tr>
              )}
              {d.rows.map((r) => (
                <tr key={r.key} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  {d.showDate && <td className="whitespace-nowrap px-4 py-2.5 text-[var(--ink-2)]">{fmt(r.date)}</td>}
                  <td className="px-4 py-2.5 font-semibold">{r.designer}</td>
                  <td className="px-4 py-2.5">{r.client || <span className="text-[var(--faint)]">Not given</span>}</td>
                  <td className="px-4 py-2.5">{r.work}</td>
                  <td className="px-4 py-2.5 text-center font-bold tnum">{r.count ?? <span className="font-normal text-[var(--faint)]">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[var(--ink-2)]">{r.by || <span className="text-[var(--faint)]">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2.5"><span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: tint(TONE[r.status] ?? "var(--muted)", 13), color: TONE[r.status] ?? "var(--muted)" }}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
            {d.rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--line-2)] bg-[var(--surface-2)]">
                  <td colSpan={d.showDate ? 4 : 3} className="px-4 py-2.5 font-bold">Total</td>
                  <td className="px-4 py-2.5 text-center text-[15px] font-extrabold tnum">{d.total}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
