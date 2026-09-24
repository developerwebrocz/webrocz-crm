"use client";

import { useMemo, useState } from "react";
import { PLATFORMS, PLATFORM_KEYS, type Platform } from "@/lib/domain";
import ClientPostCard from "./ClientPostCard";
import { IconChip } from "./ui";
import { Plus } from "lucide-react";
import { Images, CheckCircle2, Clock, Users } from "lucide-react";

type PF = { platform: string; posts: { postType: string; link: string; status: string }[] };
type Row = { id: string; code: string; name: string; industry: string | null; retainer: number; pocName: string | null; am: string | null; platforms: PF[] };
type Totals = { posts: number; posted: number; scheduled: number; activeClients: number; platforms: number };

export default function SmoBoard({
  rows, date, action, counts, totalPosts, totals, amName, dateLabel,
}: {
  rows: Row[]; date: string; action: (fd: FormData) => void;
  counts: Record<string, number>; totalPosts: number; totals: Totals; amName: string; dateLabel: string;
}) {
  const [filter, setFilter] = useState<Platform | null>(null);

  const visible = useMemo(
    () => (filter ? rows.filter((r) => r.platforms.some((p) => p.platform === filter)) : rows),
    [rows, filter],
  );

  function saveAllVisible() {
    document.querySelectorAll<HTMLFormElement>("form[data-adcard]").forEach((f) => {
      if (f.offsetParent !== null) f.requestSubmit();
    });
  }

  const postedPct = totals.posts ? Math.round((totals.posted / totals.posts) * 100) : 0;

  return (
    <>
      {/* day summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Images} tone="violet" label="Total posts" value={totals.posts} sub={`across ${totals.platforms} platform${totals.platforms !== 1 ? "s" : ""}`} />
        <Kpi icon={CheckCircle2} tone="emerald" label="Posted" value={totals.posted} sub={`${postedPct}% of today`} />
        <Kpi icon={Clock} tone="amber" label="Scheduled" value={totals.scheduled} sub="queued to publish" />
        <Kpi icon={Users} tone="sky" label="Active clients" value={totals.activeClients} sub={`of ${rows.length} total`} />
      </div>

      {/* filter bar */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="eyebrow">Filter client cards by platform</span>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="badge badge-violet tnum">Showing {visible.length} of {rows.length} clients</span>
            <button type="button" onClick={() => setFilter(null)} className="font-semibold text-[var(--violet)] hover:underline">Select all</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterPill active={filter === null} onClick={() => setFilter(null)}>All <span className="tnum opacity-70">{rows.length}</span></FilterPill>
          {PLATFORM_KEYS.map((t) => (
            <FilterPill key={t} active={filter === t} onClick={() => setFilter(filter === t ? null : t)}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--${PLATFORMS[t].tone})` }} /> {PLATFORMS[t].label} <span className="tnum opacity-70">{counts[t] ?? 0}</span>
            </FilterPill>
          ))}
        </div>
      </div>

      {/* client cards */}
      <div className="space-y-4 pb-24">
        {visible.map((r) => <ClientPostCard key={r.id} row={r} date={date} action={action} />)}
        {visible.length === 0 && (
          <div className="card card-pad text-center">
            <p className="text-sm text-[var(--muted)]">{rows.length === 0 ? "No SM Posts clients yet." : "No clients posting on this platform."}</p>
            {rows.length === 0 && (
              <>
                <a href="/clients/new" className="btn btn-violet mt-4 inline-flex"><Plus size={15} /> Add an SM Posts client</a>
                <p className="mx-auto mt-3 max-w-[420px] text-[12.5px] text-[var(--faint)]">Add a client with the <b className="text-[var(--muted)]">SMO / Social Media</b> service and assign this Account Manager — the client then appears here to log posts.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* bottom sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:left-[236px]">
        <div className="mx-auto max-w-[1600px] px-5 pb-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--r-lg)] bg-[var(--ink)] px-5 py-3.5 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
            <div>
              <div className="text-[13px] font-bold">Daily submission · {amName}</div>
              <div className="text-[11.5px] text-white/70 tnum">{totalPosts} saved posts · {visible.length} clients visible · {dateLabel}</div>
            </div>
            <button type="button" onClick={saveAllVisible} className="ml-auto rounded-[var(--r-md)] bg-white/15 px-4 py-2 text-[13px] font-semibold hover:bg-white/25">Save all visible</button>
          </div>
        </div>
      </div>
    </>
  );
}

const TONEV: Record<string, string> = { violet: "var(--violet)", sky: "var(--sky)", emerald: "var(--emerald)", amber: "var(--amber)" };
function Kpi({ icon, tone, label, value, sub }: { icon: typeof Images; tone: string; label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between">
        <span className="eyebrow">{label}</span>
        <IconChip icon={icon} tone={tone} size={34} />
      </div>
      <div className="mt-3 text-[28px] font-extrabold leading-none tracking-tight tnum" style={{ color: TONEV[tone] }}>{value}</div>
      <div className="mt-1.5 text-[11.5px] text-[var(--muted)] tnum">{sub}</div>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${active ? "bg-[var(--violet)] text-white" : "border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--violet)]"}`}
    >
      {children}
    </button>
  );
}
