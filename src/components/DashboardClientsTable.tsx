"use client";

import { useMemo, useState } from "react";
import { Avatar } from "./ui";
import { serviceTag, inr, inrShort, CLIENT_STATUS, STATUS_TONE, type ClientStatus } from "@/lib/domain";

export type ClientRow = {
  id: string; code: string; name: string; status: string;
  industry: string | null; website: string | null;
  pocName: string | null; am: string | null;
  retainer: number; services: string[]; team: string[];
  agreed: number; completed: number; pct: number;
  adSpend: number; adLeads: number;
  band: { label: string; tone: string };
};

const TONE_VAR: Record<string, string> = {
  emerald: "var(--emerald)", amber: "var(--amber)", rose: "var(--rose)",
  violet: "var(--violet)", sky: "var(--sky)", indigo: "var(--indigo)", magenta: "var(--magenta)", slate: "var(--ink-2)",
};

function Tag({ label, tone }: { label: string; tone: string }) {
  const c = TONE_VAR[tone] ?? TONE_VAR.slate;
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none"
      style={{ background: `color-mix(in srgb, ${c} 11%, white)`, color: c }}
    >
      {label}
    </span>
  );
}

export default function DashboardClientsTable({ rows }: { rows: ClientRow[] }) {
  const [q, setQ] = useState("");
  const [am, setAm] = useState<string>("ALL");

  const ams = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.am) m.set(r.am, (m.get(r.am) ?? 0) + 1);
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (am !== "ALL" && r.am !== am) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        (r.pocName ?? "").toLowerCase().includes(needle) ||
        r.code.toLowerCase().includes(needle) ||
        (r.industry ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, q, am]);

  return (
    <div className="card">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3.5">
        <h2 className="text-[15px] font-bold">Clients</h2>
        <span className="badge badge-slate tnum">{filtered.length} / {rows.length}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search client, POC, CRM…"
            className="input !h-9 !w-[240px] !text-[13px]"
          />
        </div>
      </div>

      {/* AM filter pills */}
      <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] px-4 py-2.5">
        <FilterPill active={am === "ALL"} onClick={() => setAm("ALL")}>All <span className="tnum opacity-70">{rows.length}</span></FilterPill>
        {ams.map((a) => (
          <FilterPill key={a.name} active={am === a.name} onClick={() => setAm(a.name)}>
            {a.name.split(" ")[0]} <span className="tnum opacity-70">{a.count}</span>
          </FilterPill>
        ))}
      </div>

      {/* table */}
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[1040px] text-left">
          <thead>
            <tr className="border-b border-[var(--line)]">
              {["Client & POC", "AM", "Services", "Budget", "Ad spend", "Leads", "Posts & videos", "Team", "Status"].map((h) => (
                <th key={h} className="th whitespace-nowrap px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const statusTone = STATUS_TONE[r.status as ClientStatus] ?? "slate";
              const statusLabel = CLIENT_STATUS[r.status as ClientStatus] ?? r.status;
              return (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  {/* client & poc */}
                  <td className="px-4 py-2.5">
                    <a href={`/clients/${r.id}`} className="flex items-center gap-2.5 group">
                      <Avatar name={r.name} size={34} />
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold group-hover:text-[var(--violet)]">{r.name}</div>
                        <div className="truncate text-[11px] text-[var(--muted)]">{r.pocName ?? "—"}{r.industry ? ` · ${r.industry}` : ""}</div>
                      </div>
                    </a>
                  </td>
                  {/* AM */}
                  <td className="px-4 py-2.5">
                    <div className="text-[13px] font-semibold">{r.am ?? "—"}</div>
                    <div className="text-[10.5px] text-[var(--muted)] tnum">{r.code}</div>
                  </td>
                  {/* services */}
                  <td className="px-4 py-2.5">
                    <div className="flex max-w-[180px] flex-wrap gap-1">
                      {r.services.slice(0, 3).map((s) => { const t = serviceTag(s); return <Tag key={s} label={t.short} tone={t.tone} />; })}
                      {r.services.length > 3 && <span className="text-[11px] font-semibold text-[var(--muted)]">+{r.services.length - 3}</span>}
                      {r.services.length === 0 && <span className="text-[11px] text-[var(--muted)]">—</span>}
                    </div>
                  </td>
                  {/* budget */}
                  <td className="px-4 py-2.5">
                    <div className="text-[13px] font-bold tnum">{r.retainer > 0 ? inr(r.retainer) : "—"}</div>
                    <div className="text-[10.5px] text-[var(--muted)] tnum">Quota {r.agreed}</div>
                  </td>
                  {/* ad spend (this month) */}
                  <td className="px-4 py-2.5">
                    {r.adSpend > 0 ? <div className="text-[13px] font-bold tnum text-[var(--violet)]">{inrShort(r.adSpend)}</div> : <span className="text-[11px] text-[var(--muted)]">—</span>}
                  </td>
                  {/* leads (this month) */}
                  <td className="px-4 py-2.5">
                    {r.adLeads > 0 ? <div className="text-[13px] font-bold tnum">{r.adLeads}</div> : <span className="text-[11px] text-[var(--muted)]">—</span>}
                  </td>
                  {/* posts & videos */}
                  <td className="px-4 py-2.5" style={{ minWidth: 150 }}>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="font-semibold tnum">{r.completed}/{r.agreed}</span>
                      <span className="font-bold tnum" style={{ color: TONE_VAR[r.band.tone] }}>{r.pct}% {r.band.label}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-3)]">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, r.pct)}%`, background: TONE_VAR[r.band.tone] }} />
                    </div>
                  </td>
                  {/* team */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center">
                      {r.team.slice(0, 3).map((t, i) => (
                        <span key={t + i} style={{ marginLeft: i ? -8 : 0, zIndex: 3 - i }} className="ring-2 ring-[var(--surface)] rounded-full">
                          <Avatar name={t} size={26} tone="slate" />
                        </span>
                      ))}
                      {r.team.length === 0 && <span className="text-[11px] text-[var(--muted)]">—</span>}
                      {r.team.length > 3 && <span className="ml-1 text-[11px] font-semibold text-[var(--muted)]">+{r.team.length - 3}</span>}
                    </div>
                  </td>
                  {/* status */}
                  <td className="px-4 py-2.5">
                    <span className="badge tnum" style={{ background: `color-mix(in srgb, ${TONE_VAR[statusTone]} 11%, white)`, color: TONE_VAR[statusTone] }}>{statusLabel}</span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--muted)]">No clients match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${active ? "bg-[var(--violet)] text-white" : "bg-[var(--surface-2)] text-[var(--ink-2)] hover:bg-[var(--surface-3)]"}`}
    >
      {children}
    </button>
  );
}
