"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SALES_STAGES, SALES_STAGE_KEYS, SALES_STAGE_TONE, SALES_PIPELINES, serviceKind } from "@/lib/domain";
import { Plus, BellRing, ArrowRight } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

type Row = { id: string; name: string; company: string; stage: string; value: number; pipeline: string; services: string[]; updatedAt: string };
type Reminder = { id: string; leadId: string; leadName: string; company: string; pipeline: string; date: string; time: string; type: string; notes: string; overdue: boolean };

export default function SalesDashboard({ rows, dueReminders = [], pipeline: initialPipeline, userName }: { rows: Row[]; dueReminders?: Reminder[]; pipeline: string; userName: string }) {
  const [pipeline] = useState(initialPipeline || "WEBROCZ");
  const pipeRows = useMemo(() => rows.filter((r) => r.pipeline === pipeline), [rows, pipeline]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of pipeRows) m[r.stage] = (m[r.stage] ?? 0) + 1;
    return m;
  }, [pipeRows]);
  const totals = useMemo(() => ({
    total: pipeRows.length,
    active: pipeRows.filter((r) => r.stage !== "LOST" && r.stage !== "ONBOARDED").reduce((s, r) => s + r.value, 0),
    won: pipeRows.filter((r) => r.stage === "ONBOARDED").reduce((s, r) => s + r.value, 0),
  }), [pipeRows]);
  const reminders = useMemo(() => dueReminders.filter((r) => r.pipeline === pipeline), [dueReminders, pipeline]);
  const cats = useMemo(() => {
    let web = 0, dm = 0, webRev = 0, dmRev = 0;
    for (const r of pipeRows) {
      const k = serviceKind(r.services || []);
      if (k.web) { web++; if (r.stage === "ONBOARDED") webRev += r.value; }
      if (k.dm) { dm++; if (r.stage === "ONBOARDED") dmRev += r.value; }
    }
    return { web, dm, webRev, dmRev };
  }, [pipeRows]);
  const onboarded = useMemo(() => pipeRows.filter((r) => r.stage === "ONBOARDED").slice(0, 8), [pipeRows]);
  const stageHref = (k: string) => `/sales?stage=${k}`;

  return (
    <div className="space-y-5">
      {/* branded header */}
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--violet) 10%, white), color-mix(in srgb, var(--magenta) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-[20px] font-black text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--magenta), var(--violet))" }}>W</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">Sales Dashboard</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">{SALES_PIPELINES[pipeline as keyof typeof SALES_PIPELINES]}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Hi {userName.split(" ")[0]} · {totals.total} leads · <b className="text-[var(--ink-2)]">{inr(totals.active)}</b> in pipeline · <b style={{ color: "var(--emerald)" }}>{inr(totals.won)}</b> won</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/sales" prefetch className="btn btn-violet"><Plus size={16} /> Open Pipeline</Link>
          </div>
        </div>
      </div>

      {/* KPI cards — click a card to open that stage */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        {SALES_STAGE_KEYS.map((k) => (
          <Link key={k} href={stageHref(k)} prefetch className="card px-4 py-3.5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]" style={{ borderTop: `3px solid ${SALES_STAGE_TONE[k]}` }}>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: SALES_STAGE_TONE[k] }}>{SALES_STAGES[k]}</div>
            <div className="mt-1.5 text-[26px] font-extrabold leading-none tnum">{counts[k] ?? 0}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--faint)]">Open <ArrowRight size={11} /></div>
          </Link>
        ))}
      </div>

      {/* category split — Website Development vs Digital Marketing */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/sales?category=WEBSITE" prefetch className="card card-pad flex items-center justify-between transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]" style={{ borderLeft: "4px solid var(--indigo)" }}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--indigo)" }}>Website Development</div>
            <div className="mt-1 text-[24px] font-extrabold tnum">{cats.web}<span className="ml-1.5 text-[12px] font-semibold text-[var(--muted)]">leads</span></div>
          </div>
          <div className="text-right"><div className="text-[11px] text-[var(--muted)]">Won</div><div className="text-[15px] font-bold tnum" style={{ color: "var(--emerald)" }}>{inr(cats.webRev)}</div></div>
        </Link>
        <Link href="/sales?category=DM" prefetch className="card card-pad flex items-center justify-between transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]" style={{ borderLeft: "4px solid var(--magenta)" }}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--magenta)" }}>Digital Marketing</div>
            <div className="mt-1 text-[24px] font-extrabold tnum">{cats.dm}<span className="ml-1.5 text-[12px] font-semibold text-[var(--muted)]">leads</span></div>
          </div>
          <div className="text-right"><div className="text-[11px] text-[var(--muted)]">Won</div><div className="text-[15px] font-bold tnum" style={{ color: "var(--emerald)" }}>{inr(cats.dmRev)}</div></div>
        </Link>
      </div>

      {/* Recent onboardings — check where each one was routed */}
      {onboarded.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-3.5"><h2 className="text-[14.5px] font-bold">Recent client onboardings — team assignment</h2></div>
          <div className="divide-y divide-[var(--line)]">
            {onboarded.map((r) => {
              const k = serviceKind(r.services || []);
              return (
                <Link key={r.id} href={`/sales/${r.id}`} prefetch className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-[13px] hover:bg-[var(--surface-2)]">
                  <span className="font-semibold">{r.company || r.name}</span>
                  <span className="text-[var(--faint)]">· {r.updatedAt}</span>
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    {k.web && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "color-mix(in srgb,var(--indigo) 12%,white)", color: "var(--indigo)" }}>Website → Developer team</span>}
                    {k.dm && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "color-mix(in srgb,var(--magenta) 12%,white)", color: "var(--magenta)" }}>Digital Marketing → Marketing team</span>}
                    {!k.web && !k.dm && <span className="text-[11px] text-[var(--muted)]">No service category</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Reminders due */}
      {reminders.length > 0 && (
        <div className="rounded-[14px] border px-4 py-3.5" style={{ borderColor: "color-mix(in srgb, var(--amber) 45%, white)", background: "color-mix(in srgb, var(--amber) 9%, white)" }}>
          <div className="mb-2.5 flex items-center gap-2 text-[13.5px] font-bold" style={{ color: "#92600a" }}><BellRing size={16} /> Reminders due ({reminders.length}) — follow up today</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {reminders.slice(0, 8).map((rm) => (
              <Link key={rm.id} href={`/sales/${rm.leadId}`} prefetch className="flex items-center gap-2 rounded-[8px] bg-white/70 px-3 py-2 text-[12.5px] hover:bg-white">
                <span className="font-semibold">{rm.leadName}</span>
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: rm.overdue ? "color-mix(in srgb,var(--rose) 15%,white)" : "color-mix(in srgb,var(--amber) 18%,white)", color: rm.overdue ? "var(--rose)" : "#92600a" }}>{rm.type} · {rm.date}{rm.overdue ? " · overdue" : " · today"}</span>
                <span className="ml-auto font-semibold text-[var(--violet)]">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
