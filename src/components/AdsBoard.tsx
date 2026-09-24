"use client";

import { useMemo, useState } from "react";
import { CAMPAIGN_TYPES, CAMPAIGN_KEYS, inr, inrShort, type CampaignType } from "@/lib/domain";
import ClientAdCard from "./ClientAdCard";
import { IconChip } from "./ui";
import { Plus } from "lucide-react";
import { Wallet, Target, TrendingDown, CheckCircle2, Award } from "lucide-react";

type Entry = { type: string; results: number; spent: number; conversions: number; saleValue: number; ordersConverted: number };
type Row = { id: string; code: string; name: string; industry: string | null; retainer: number; pocName: string | null; am: string | null; entries: Entry[] };
type Totals = { spend: number; leads: number; conversions: number; saleValue: number; reach: number; cpl: number; roas: number; bestClient: { name: string; cpl: number } | null };

export default function AdsBoard({
  rows, date, action, counts, totalEntries, totals, amName, dateLabel,
}: {
  rows: Row[]; date: string; action: (fd: FormData) => void;
  counts: Record<string, number>; totalEntries: number; totals: Totals; amName: string; dateLabel: string;
}) {
  const [filter, setFilter] = useState<CampaignType | null>(null);

  const visible = useMemo(
    () => (filter ? rows.filter((r) => r.entries.some((e) => e.type === filter)) : rows),
    [rows, filter],
  );

  function saveAllVisible() {
    document.querySelectorAll<HTMLFormElement>("form[data-adcard]").forEach((f) => {
      if (f.offsetParent !== null) f.requestSubmit();
    });
  }

  return (
    <>
      {/* day summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} tone="violet" label="Total spend" value={inrShort(totals.spend)} sub={`${totalEntries} campaign entries`} />
        <Kpi icon={Target} tone="sky" label="Total leads" value={totals.leads.toLocaleString("en-IN")} sub={`${totals.conversions} conversions`} />
        <Kpi icon={TrendingDown} tone="emerald" label="Avg CPL" value={totals.cpl ? inr(totals.cpl) : "—"} sub="cost per lead" />
        <Kpi icon={totals.saleValue ? Award : CheckCircle2} tone="amber" label={totals.saleValue ? "ROAS" : "Reach"} value={totals.saleValue ? `${totals.roas}x` : totals.reach.toLocaleString("en-IN")} sub={totals.saleValue ? `${inrShort(totals.saleValue)} sales` : "awareness"} />
      </div>
      {totals.bestClient && (
        <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--emerald)_25%,white)] bg-[color-mix(in_srgb,var(--emerald)_6%,white)] px-4 py-2.5 text-[13px]">
          <Award size={15} className="text-[var(--emerald)]" /> <span className="font-semibold">Best CPL today:</span> {totals.bestClient.name} · <span className="font-bold text-[var(--emerald)] tnum">{inr(totals.bestClient.cpl)}</span>
        </div>
      )}

      {/* filter bar */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="eyebrow">Filter client cards by campaign</span>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="badge badge-violet tnum">Showing {visible.length} of {rows.length} clients</span>
            <button type="button" onClick={() => setFilter(null)} className="font-semibold text-[var(--violet)] hover:underline">Select all</button>
            {filter && <button type="button" onClick={() => setFilter(null)} className="font-semibold text-[var(--muted)] hover:underline">Clear</button>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterPill active={filter === null} onClick={() => setFilter(null)}>All <span className="tnum opacity-70">{rows.length}</span></FilterPill>
          {CAMPAIGN_KEYS.map((t) => (
            <FilterPill key={t} active={filter === t} onClick={() => setFilter(filter === t ? null : t)}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--${CAMPAIGN_TYPES[t].tone})` }} /> {CAMPAIGN_TYPES[t].label} <span className="tnum opacity-70">{counts[t] ?? 0}</span>
            </FilterPill>
          ))}
        </div>
      </div>

      {/* client cards */}
      <div className="space-y-4 pb-24">
        {visible.map((r) => <ClientAdCard key={r.id} row={r} date={date} action={action} />)}
        {visible.length === 0 && (
          <div className="card card-pad text-center">
            <p className="text-sm text-[var(--muted)]">{rows.length === 0 ? "No Meta Ads clients yet." : "No clients running this campaign."}</p>
            {rows.length === 0 && (
              <>
                <a href="/clients/new" className="btn btn-violet mt-4 inline-flex"><Plus size={15} /> Add a Meta Ads client</a>
                <p className="mx-auto mt-3 max-w-[420px] text-[12.5px] text-[var(--faint)]">Add a client with the <b className="text-[var(--muted)]">Meta Ads</b> service and assign this Account Manager — the client then appears here with daily entry fields.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* bottom sticky submission bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:left-[236px]">
        <div className="mx-auto max-w-[1600px] px-5 pb-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--r-lg)] bg-[var(--ink)] px-5 py-3.5 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
            <div>
              <div className="text-[13px] font-bold">Daily submission · {amName}</div>
              <div className="text-[11.5px] text-white/70 tnum">{totalEntries} saved entries · {visible.length} clients visible · {dateLabel}</div>
            </div>
            <button type="button" onClick={saveAllVisible} className="ml-auto rounded-[var(--r-md)] bg-white/15 px-4 py-2 text-[13px] font-semibold hover:bg-white/25">Save all visible</button>
          </div>
        </div>
      </div>
    </>
  );
}

const TONEV: Record<string, string> = { violet: "var(--violet)", sky: "var(--sky)", emerald: "var(--emerald)", amber: "var(--amber)" };
function Kpi({ icon, tone, label, value, sub }: { icon: typeof Wallet; tone: string; label: string; value: React.ReactNode; sub: string }) {
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
