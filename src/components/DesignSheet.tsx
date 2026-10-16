"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import type { DesignSheetData } from "@/lib/design-sheet-queries";

// The team's work as one sheet: pick the day / week / month and a client; click a person's
// box to see only their work. One line per piece of work — person, client, work, how many,
// who assigned it, status — and the total at the bottom.
// `path`: the page it sits on (Design Count / Editing Count). `mine`: a designer's / editor's
// own page — no people boxes, no person column.

const PERIODS = [["today", "Today"], ["yesterday", "Yesterday"], ["week", "This week"], ["month", "This month"]] as const;
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
const TONE: Record<string, string> = { Done: "var(--emerald)", "In progress": "var(--sky)", "In review": "var(--violet)", Pending: "var(--amber)", "Sent for approval": "var(--violet)", Planned: "var(--muted)", "No edit needed": "var(--muted)" };
const toneOf = (s: string) => TONE[s] ?? (/left$/.test(s) ? "var(--amber)" : "var(--muted)");
const tint = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, white)`;

export default function DesignSheet({ d, path = "/design-team", everyone = "All designers", person = "Designer", mine = false, title }: { d: DesignSheetData; path?: string; everyone?: string; person?: string; mine?: boolean; title?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    p.delete("saved");
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    router.push(`${path}?${p.toString()}`, { scroll: false });
  };
  const periodLabel = PERIODS.find(([k]) => k === d.period)?.[1] ?? "Today";
  const cols = (d.showDate ? 1 : 0) + (mine ? 0 : 1) + 5;
  // the day-to-day work, and (designers) the weekly posting plan per client — two tables
  const workRows = d.rows.filter((r) => !r.key.startsWith("post|"));
  const planRows = d.rows.filter((r) => r.key.startsWith("post|"));

  return (
    <div className="space-y-4">
      {/* date + client */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {title ? <h2 className="text-[16px] font-semibold text-[var(--ink)]">{title}</h2> : <span />}
        <div className="flex flex-wrap items-center gap-2">
          <select value={d.period} onChange={(e) => go({ period: e.target.value })} className="select !h-9 !w-auto !py-1 text-[13px]" aria-label="Period">
            {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}{k === "today" ? ` · ${fmt(d.today)}` : ""}</option>)}
          </select>
          <select value={d.clientQ} onChange={(e) => go({ client: e.target.value })} className="select !h-9 !w-auto !py-1 max-w-[240px] text-[13px]" aria-label="Client">
            <option value="">All clients</option>
            {d.clients.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* people — click one to see only their work */}
      {!mine && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {[{ id: "", name: everyone, total: d.allTotal, notUpdated: false, lead: false }, ...d.people].map((p) => {
            const on = d.designerQ === p.id;
            return (
              <button key={p.id || "all"} type="button" onClick={() => go({ designer: p.id })}
                className="rounded-[12px] border bg-[var(--surface)] px-4 py-3 text-left transition hover:border-[var(--violet)]"
                style={{ borderColor: on ? "var(--violet)" : "var(--line)", background: on ? tint("var(--violet)", 5) : undefined }}>
                <div className="truncate text-[13px] font-medium text-[var(--ink-2)]">{p.name}{p.lead ? <span className="font-normal text-[var(--muted)]"> · Lead</span> : ""}</div>
                {p.notUpdated && p.total === 0
                  ? <div className="mt-1.5 text-[13px] font-medium text-[var(--rose)]">Not updated</div>
                  : <div className="mt-1 text-[24px] font-semibold leading-tight text-[var(--ink)] tnum">{p.total}</div>}
              </button>
            );
          })}
        </div>
      )}

      {/* the sheet */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-3 text-[14px] font-semibold text-[var(--ink)]">Work done</div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-left text-[12.5px] text-[var(--muted)]">
                {d.showDate && <th className="px-4 py-3 font-medium">Date</th>}
                {!mine && <th className="px-4 py-3 font-medium">{person}</th>}
                <th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Work</th>
                <th className="px-4 py-3 text-center font-medium">How many</th><th className="px-4 py-3 font-medium">Assigned by</th><th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {workRows.length === 0 && (
                <tr><td colSpan={cols} className="px-4 py-12 text-center text-[13.5px] text-[var(--muted)]">No work entered for {periodLabel.toLowerCase()}{d.clientQ ? ` for ${d.clientQ}` : ""}.</td></tr>
              )}
              {workRows.map((r) => (
                <tr key={r.key} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  {d.showDate && <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">{fmt(r.date)}</td>}
                  {!mine && <td className="px-4 py-3 font-medium text-[var(--ink)]">{r.designer}</td>}
                  <td className="px-4 py-3 text-[var(--ink)]">{r.client || <span className="text-[var(--faint)]">Not given</span>}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--ink)]">{r.work}</div>
                    {r.detail && <div className="mt-0.5 text-[13px] text-[var(--muted)]">{r.detail}</div>}
                    {r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--violet)] hover:underline">Open files <ExternalLink size={12} /></a>}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-[var(--ink)] tnum">{r.count ?? <span className="font-normal text-[var(--faint)]">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">{r.by || <span className="text-[var(--faint)]">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: tint(toneOf(r.status), 12), color: toneOf(r.status) }}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
            {workRows.length > 0 && (
              <tfoot>
                <tr className="border-t border-[var(--line-2)] bg-[var(--surface-2)]">
                  <td colSpan={cols - 3} className="px-4 py-3 font-semibold text-[var(--ink)]">Total</td>
                  <td className="px-4 py-3 text-center text-[15px] font-semibold text-[var(--ink)] tnum">{d.total}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* designers: each client's weekly posting plan — planned, done, left */}
      {planRows.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <div className="text-[14px] font-semibold text-[var(--ink)]">Weekly posting plan</div>
            <div className="text-[12.5px] text-[var(--muted)]">Posts planned for each client this week, and how many are done</div>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[620px] text-[14px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-left text-[12.5px] text-[var(--muted)]">
                  {!mine && <th className="px-4 py-3 font-medium">{person}</th>}
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 text-center font-medium">Planned</th>
                  <th className="px-4 py-3 text-center font-medium">Done</th>
                  <th className="px-4 py-3 text-center font-medium">Left</th>
                  <th className="px-4 py-3 font-medium">Set by</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((r) => {
                  const left = Math.max(0, (r.planned ?? 0) - (r.done ?? 0));
                  return (
                    <tr key={r.key} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                      {!mine && <td className="px-4 py-3 font-medium text-[var(--ink)]">{r.designer}</td>}
                      <td className="px-4 py-3 text-[var(--ink)]">{r.client}</td>
                      <td className="px-4 py-3 text-center tnum">{r.planned ?? 0}</td>
                      <td className="px-4 py-3 text-center font-semibold tnum">{r.done ?? 0}</td>
                      <td className="px-4 py-3 text-center tnum" style={{ color: left > 0 ? "var(--amber)" : "var(--emerald)" }}>{left}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">{r.by}</td>
                      <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: tint(toneOf(r.status), 12), color: toneOf(r.status) }}>{r.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
