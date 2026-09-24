"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CLIENT_STATUS, SERVICES } from "@/lib/domain";
import { Avatar, Badge } from "./ui";
import { deleteClient } from "@/app/actions";

type Row = {
  id: string; code: string; name: string; status: string;
  industry: string | null; website: string | null; pocName: string | null;
  services: string[]; deliverables: { metric: string; agreed: number }[];
  am: string | null; teamCount: number;
};

const METRIC_LABEL: Record<string, string> = {
  blogs: "Blogs", keywords: "Keywords", static: "Static", carousel: "Carousel",
  reels: "Reels", aiVideos: "AI Videos", reelsEdit: "Reels",
};
const STATUS_TONE: Record<string, string> = { ACTIVE: "emerald", ON_HOLD: "amber", UPCOMING: "violet" };

export default function ClientBook({
  rows, counts, isSuper = false,
}: {
  rows: Row[];
  counts: { all: number; active: number; onHold: number; upcoming: number };
  isSuper?: boolean;
}) {
  const go = (href: string) => { window.location.assign(href); };
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "ALL" && r.status !== status) return false;
    if (q) {
      const hay = `${r.name} ${r.pocName ?? ""} ${r.industry ?? ""} ${r.services.join(" ")}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, q, status]);

  const tabs = [
    { k: "ALL", label: "All", n: counts.all },
    { k: "ACTIVE", label: "Active", n: counts.active },
    { k: "ON_HOLD", label: "On Hold", n: counts.onHold },
    { k: "UPCOMING", label: "Upcoming", n: counts.upcoming },
  ];

  return (
    <div className="space-y-4">
      {/* header row: tabs + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button key={t.k} onClick={() => setStatus(t.k)} className={`pill ${status === t.k ? "pill-dark" : ""}`}>
              {t.label} · {t.n}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input className="input !pl-10" placeholder="Search client / POC / service…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {/* table */}
      <div className="card">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="th">Client &amp; POC</th>
                <th className="th">Services</th>
                <th className="th">Agreed / month</th>
                <th className="th">Team</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => go(`/clients/${r.id}`)} className="row-link cursor-pointer border-b border-[var(--line)] last:border-0">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} size={38} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{r.name}</div>
                        <div className="truncate text-xs text-[var(--muted)]">{r.industry ?? "—"}{r.website ? ` · ${r.website}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {r.services.slice(0, 4).map((s) => (
                        <span key={s} className="rounded-md border border-[var(--line-2)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">
                          {SERVICES[s as keyof typeof SERVICES]?.label ?? s}
                        </span>
                      ))}
                      {r.services.length > 4 && <span className="rounded-md bg-[var(--surface-3)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">+{r.services.length - 4}</span>}
                    </div>
                  </td>
                  <td className="td">
                    {r.deliverables.length === 0 ? <span className="text-sm text-[var(--muted)]">—</span> : (
                      <div className="flex items-center gap-4">
                        {r.deliverables.slice(0, 2).map((d) => (
                          <div key={d.metric}>
                            <div className="text-[15px] font-bold leading-none tnum">{d.agreed}</div>
                            <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">{METRIC_LABEL[d.metric] ?? d.metric}</div>
                          </div>
                        ))}
                        {r.deliverables.length > 2 && <span className="text-xs font-semibold text-[var(--muted)]">+{r.deliverables.length - 2}</span>}
                      </div>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-[13px] text-[var(--ink-2)]">
                    {r.am ? <>AM {r.am}{r.teamCount > 0 ? ` +${r.teamCount}` : ""}</> : <span className="text-[var(--muted)]">Unassigned</span>}
                  </td>
                  <td className="td"><Badge tone={STATUS_TONE[r.status] ?? "violet"}>{CLIENT_STATUS[r.status as keyof typeof CLIENT_STATUS] ?? r.status}</Badge></td>
                  <td className="td" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => go(`/clients/${r.id}`)} className="btn btn-ghost btn-sm">Open</button>
                      {isSuper && <form action={deleteClient}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost btn-sm !text-[var(--rose)]">Remove</button></form>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="td py-14 text-center text-[var(--muted)]">
                  {rows.length === 0 ? "No clients yet — add your first client." : "No clients match your filters."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* bottom bar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--muted)] tnum">{counts.all} clients · {counts.active} active</span>
        <a href="/clients/new" className="btn btn-violet">+ New client</a>
      </div>
    </div>
  );
}
