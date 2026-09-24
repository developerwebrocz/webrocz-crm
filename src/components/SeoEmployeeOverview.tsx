"use client";

import { useMemo, useState } from "react";
import { Search, Users, FileText, CheckCircle2, Flag, ArrowRight, AlertTriangle } from "lucide-react";

type Row = { id: string; name: string; industry: string; am: string; priority: string; pct: number; written: number; target: number; status: string };
type Data = {
  name: string; isHead: boolean; month: string; months: { key: string; label: string }[]; monthLabel: string;
  activeClients: number; overallPct: number;
  rows: { id: string; name: string; industry: string; am: string; priority: string; pct: number; written: number; target: number; status: string }[];
};

const STATUS_TONE: Record<string, string> = { Completed: "emerald", "In Review": "violet", "In Progress": "amber", Pending: "rose" };
const PRIORITY_TONE: Record<string, string> = { A: "rose", B: "amber", C: "sky" };

export default function SeoEmployeeOverview({ data }: { data: Data }) {
  const [q, setQ] = useState("");
  const first = data.name.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const kpis = useMemo(() => {
    const written = data.rows.reduce((s, r) => s + r.written, 0);
    const target = data.rows.reduce((s, r) => s + r.target, 0);
    return {
      clients: data.rows.length,
      written, target,
      completed: data.rows.filter((r) => r.status === "Completed").length,
      needs: data.rows.filter((r) => r.pct < 100).length,
    };
  }, [data.rows]);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return [...data.rows]
      .filter((r) => (n ? r.name.toLowerCase().includes(n) || r.am.toLowerCase().includes(n) : true))
      .sort((a, b) => a.pct - b.pct);
  }, [data.rows, q]);

  const attention = useMemo(() => {
    const notStarted = data.rows.filter((r) => r.pct === 0 && r.target > 0);
    const behind = data.rows.filter((r) => r.pct > 0 && r.pct < 100);
    return { notStarted, behind, list: [...notStarted, ...behind].slice(0, 10) };
  }, [data.rows]);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">SEO Performance · {data.monthLabel}</span>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">{greet}, {first}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Your SEO performance at a glance. Search a client and open it to update blogs, keywords, backlinks & reports.</p>
        </div>
        <a href="/seo" className="btn btn-violet"><FileText size={15} /> Open SEO Performance</a>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} tone="violet" label="My clients" value={kpis.clients} note="assigned" />
        <Kpi icon={FileText} tone="emerald" label="Blogs published" value={`${kpis.written} / ${kpis.target}`} note={`${data.overallPct}%`} />
        <Kpi icon={CheckCircle2} tone="sky" label="Completed" value={kpis.completed} note="clients" />
        <Kpi icon={Flag} tone="amber" label="Needs work" value={kpis.needs} note="this month" />
      </div>

      {/* needs attention */}
      {(attention.notStarted.length > 0 || attention.behind.length > 0) && (
        <div className="card card-pad" style={{ borderColor: "color-mix(in srgb, var(--amber) 35%, white)", background: "color-mix(in srgb, var(--amber) 5%, white)" }}>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "color-mix(in srgb, var(--amber) 14%, white)", color: "var(--amber)" }}><AlertTriangle size={16} /></span>
            <h2 className="text-[14.5px] font-bold">Needs your attention</h2>
            <span className="text-[12px] text-[var(--muted)]">{attention.notStarted.length} not started · {attention.behind.length} behind</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {attention.list.map((r) => (
              <a key={r.id} href={`/seo?client=${r.id}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--line-2)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-semibold hover:border-[var(--amber)]">
                <span className="h-2 w-2 rounded-full" style={{ background: r.pct === 0 ? "var(--rose)" : "var(--amber)" }} />
                {r.name} <span className="tnum text-[var(--muted)]">{r.written}/{r.target}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* month progress */}
      <div className="card card-pad flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13.5px] font-semibold">This month · blog delivery across your clients</div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-48 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-[var(--violet)]" style={{ width: `${data.overallPct}%` }} /></div>
          <span className="text-[16px] font-extrabold tnum">{data.overallPct}%</span>
        </div>
      </div>

      {/* searchable client list */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold">My clients <span className="ml-1 font-medium text-[var(--muted)]">· {rows.length}</span></h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Click a client to open its editor in SEO Performance.</p>
          </div>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client…" className="w-[200px] rounded-xl border border-[var(--line-2)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-[var(--violet)]" />
          </div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Client", "Pr.", "Account Mgr", "Status", "Blogs", "Progress", ""].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => {
                const tone = STATUS_TONE[r.status] ?? "amber";
                return (
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3"><a href={`/seo?client=${r.id}`} className="text-[13.5px] font-semibold hover:text-[var(--violet)]">{r.name}</a></td>
                    <td className="px-5 py-3">{r.priority ? <span className="grid h-6 w-6 place-items-center rounded-md text-[11px] font-extrabold" style={{ background: `color-mix(in srgb, var(--${PRIORITY_TONE[r.priority] ?? "muted"}) 14%, white)`, color: `var(--${PRIORITY_TONE[r.priority] ?? "muted"})` }}>{r.priority}</span> : <span className="text-[var(--faint)]">—</span>}</td>
                    <td className="px-5 py-3 text-[12.5px] text-[var(--muted)]">{r.am}</td>
                    <td className="px-5 py-3"><span className="badge" style={{ background: `color-mix(in srgb, var(--${tone}) 12%, white)`, color: `var(--${tone})` }}>{r.status}</span></td>
                    <td className="px-5 py-3 text-[13px] font-bold tnum">{r.written}<span className="font-medium text-[var(--muted)]">/{r.target}</span></td>
                    <td className="px-5 py-3" style={{ minWidth: 150 }}><div className="flex items-center gap-2.5"><div className="h-1.5 flex-1 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, r.pct)}%`, background: r.pct >= 100 ? "var(--emerald)" : "var(--violet)" }} /></div><span className="text-[12px] font-bold text-[var(--muted)] tnum">{r.pct}%</span></div></td>
                    <td className="px-5 py-3 text-right"><a href={`/seo?client=${r.id}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--violet)]">Open <ArrowRight size={13} /></a></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No clients match your search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value, note }: { icon: typeof Users; tone: string; label: string; value: React.ReactNode; note?: string }) {
  const c: Record<string, string> = { violet: "var(--violet)", emerald: "var(--emerald)", sky: "var(--sky)", amber: "var(--amber)" };
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: `color-mix(in srgb, ${c[tone]} 12%, white)`, color: c[tone] }}><Icon size={17} /></span>
        {note && <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)] tnum">{note}</span>}
      </div>
      <div className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-[30px] font-extrabold leading-none tracking-tight tnum">{value}</div>
    </div>
  );
}
