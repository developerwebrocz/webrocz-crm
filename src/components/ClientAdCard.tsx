"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CAMPAIGN_TYPES, CAMPAIGN_KEYS, inrShort, type CampaignType } from "@/lib/domain";
import { Avatar } from "./ui";
import { Check } from "lucide-react";

type Entry = { type: string; results: number; spent: number; conversions: number; saleValue: number; ordersConverted: number };
type Row = { id: string; code: string; name: string; industry: string | null; retainer: number; pocName: string | null; am: string | null; entries: Entry[] };
type Vals = { results: number; spent: number; conversions: number; saleValue: number; ordersConverted: number };

const blank = (): Vals => ({ results: 0, spent: 0, conversions: 0, saleValue: 0, ordersConverted: 0 });

function metric(type: CampaignType, v: Vals) {
  if (type === "AWARENESS") return v.results ? `₹${(v.spent / (v.results / 1000)).toFixed(1)}` : "—";
  if (type === "SALE") return v.spent ? `${(v.saleValue / v.spent).toFixed(2)}x` : "—";
  return v.results ? `₹${(v.spent / v.results).toFixed(1)}` : "—";
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return <button className="btn btn-violet btn-sm disabled:opacity-60" disabled={pending}>{pending ? "Saving…" : "Save client"}</button>;
}

export default function ClientAdCard({ row, date, action }: { row: Row; date: string; action: (fd: FormData) => void }) {
  const initActive = row.entries.map((e) => e.type as CampaignType);
  const initVals: Record<string, Vals> = {};
  for (const e of row.entries) initVals[e.type] = { results: e.results, spent: e.spent, conversions: e.conversions, saleValue: e.saleValue, ordersConverted: e.ordersConverted };

  const [active, setActive] = useState<CampaignType[]>(initActive);
  const [vals, setVals] = useState<Record<string, Vals>>(initVals);

  const toggle = (t: CampaignType) => setActive((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));
  const set = (t: CampaignType, k: keyof Vals, val: number) =>
    setVals((s) => ({ ...s, [t]: { ...(s[t] ?? blank()), [k]: val } }));
  const val = (t: CampaignType) => vals[t] ?? blank();

  const Num = ({ t, k, label }: { t: CampaignType; k: keyof Vals; label: string }) => (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type="number" min={0} name={`${t}_${k}`} value={val(t)[k] || ""}
        onChange={(e) => set(t, k, parseInt(e.target.value || "0", 10) || 0)}
        className="input !h-9 mt-1 !text-[13px]" placeholder="0"
      />
    </label>
  );

  return (
    <form action={action} data-adcard className="card card-pad">
      <input type="hidden" name="clientId" value={row.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="active" value={active.join(",")} />

      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={row.name} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{row.name}</span>
            {row.industry && <span className="tag">{row.industry}</span>}
            {active.length > 0 && <span className="badge badge-violet">{active.length} campaign{active.length > 1 ? "s" : ""}</span>}
          </div>
          <div className="text-xs text-[var(--muted)]">{inrShort(row.retainer)} · POC {row.pocName ?? "—"} · {row.code} · AM {row.am ?? "—"}</div>
        </div>
        <SaveBtn />
      </div>

      {/* campaign toggles */}
      <div className="mt-4">
        <div className="eyebrow mb-2">Campaigns running for this client</div>
        <div className="flex flex-wrap gap-2">
          {CAMPAIGN_KEYS.map((t) => {
            const on = active.includes(t);
            return (
              <button type="button" key={t} onClick={() => toggle(t)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${on ? "bg-[var(--violet)] text-white" : "border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}>
                {!on && <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--${CAMPAIGN_TYPES[t].tone})` }} />} {CAMPAIGN_TYPES[t].label} {on && <Check size={13} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* entry blocks for active campaigns */}
      {active.length > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {active.map((t) => {
            const cfg = CAMPAIGN_TYPES[t];
            return (
              <div key={t} className="rounded-[var(--r-md)] border border-[var(--line)] p-3.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13.5px] font-bold"><span className="h-2 w-2 rounded-full" style={{ background: `var(--${cfg.tone})` }} /> {cfg.label} campaign</span>
                  <span className="badge badge-slate tnum">{cfg.metric} {metric(t, val(t))}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Num t={t} k="results" label={cfg.result} />
                  <Num t={t} k="spent" label="Spent (₹)" />
                  {t === "SALE" ? <Num t={t} k="saleValue" label="Sale value" /> : t === "AWARENESS" ? <div /> : <Num t={t} k="conversions" label="Conversions" />}
                </div>
                {t === "SALE" && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Num t={t} k="ordersConverted" label="Orders converted" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}
