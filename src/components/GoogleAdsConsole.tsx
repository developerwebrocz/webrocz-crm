"use client";

import { useMemo, useState } from "react";
import { inr, GADS_TYPES } from "@/lib/domain";
import {
  Users, CircleAlert,
  ChevronDown, Search, SlidersHorizontal, Plus, Download, Eye, Pencil,
  Send, MessageCircle, TrendingUp, TrendingDown, CircleCheck,
} from "lucide-react";

type Campaign = { name: string; type: string; spent: number; leads: number; conv: number; status: string; cpl: number; convPct: number };
type Row = {
  id: string; name: string; budget: number; onHold: boolean;
  spent: number; leads: number; conv: number; cpl: number; convPct: number;
  campaigns: Campaign[]; ready: boolean; updatedBy: string; updatedAt: string | null;
  monthSpend: number; usedPct: number;
};
type Kpis = { totalSpent: number; totalLeads: number; totalConv: number; costPerLead: number; convPct: number };
type Counts = { clients: number; campaigns: number; smart: number; pending: number };
type BudgetClient = { name: string; budget: number; spend: number; usedPct: number } | null;

const PERIODS = [
  { key: "YESTERDAY", label: "Yesterday" },
  { key: "TODAY", label: "Today" },
  { key: "WEEK", label: "This Week" },
  { key: "MONTH", label: "This Month" },
];
const SUFFIX: Record<string, string> = { YESTERDAY: "Yesterday", TODAY: "Today", WEEK: "This Week", MONTH: "This Month" };
const STATUS_FILTERS = [
  { key: "ALL", label: "All clients" },
  { key: "READY", label: "Ready" },
  { key: "PENDING", label: "Pending update" },
];

const k1 = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k`;
  return `₹${n}`;
};
const typeTone: Record<string, string> = { SEARCH: "var(--muted)", DISPLAY: "var(--amber)", PMAX: "var(--violet)", SMART: "var(--sky)" };

export default function GoogleAdsConsole({
  rows, kpis, budgetClient, period, periodDate,
}: {
  rows: Row[]; kpis: Kpis; counts?: Counts; budgetClient: BudgetClient;
  period: string; periodDate: string; userName?: string; userRole?: string;
}) {
  const suffix = SUFFIX[period] ?? "Yesterday";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [statusOpen, setStatusOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(rows.find((r) => r.ready) ? [rows.find((r) => r.ready)!.id] : []));

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "READY" && !r.ready) return false;
      if (status === "PENDING" && r.ready) return false;
      if (type !== "ALL" && !r.campaigns.some((c) => c.type === type)) return false;
      if (n && !(r.name.toLowerCase().includes(n) || r.campaigns.some((c) => c.name.toLowerCase().includes(n)))) return false;
      return true;
    });
  }, [rows, q, status, type]);

  const filterCampaigns = (list: Campaign[]) => {
    const n = q.trim().toLowerCase();
    return list.filter((c) => (type === "ALL" || c.type === type) && (!n || c.name.toLowerCase().includes(n) || true));
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Google Ads · Account Manager</span>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">My Clients — {suffix} Ready</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Daily campaign performance across your Google Ads clients · {periodDate}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[var(--line-2)] bg-[var(--surface-2)] p-1">
          {PERIODS.map((p) => (
            <a key={p.key} href={`/google-ads?period=${p.key}`}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${period === p.key ? "bg-[var(--violet)] text-white shadow-sm" : "text-[var(--ink-2)] hover:bg-white"}`}>
              {p.label}
            </a>
          ))}
        </div>
      </div>

      {/* filter row */}
      <div className="flex flex-wrap items-center gap-2">
            {/* status dropdown */}
            <div className="relative">
              <button onClick={() => { setStatusOpen((o) => !o); setTypeOpen(false); }} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] font-semibold hover:border-[var(--ink)]">
                <SlidersHorizontal size={14} className="text-[var(--muted)]" /> {STATUS_FILTERS.find((s) => s.key === status)?.label} <ChevronDown size={14} className="text-[var(--faint)]" />
              </button>
              {statusOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
                  {STATUS_FILTERS.map((s) => (
                    <button key={s.key} onClick={() => { setStatus(s.key); setStatusOpen(false); }} className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-2)] ${status === s.key ? "font-bold text-[var(--violet)]" : ""}`}>
                      {s.label} {status === s.key && <CircleCheck size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* campaign search */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients or campaigns…"
                className="w-full rounded-xl border border-[var(--line-2)] bg-[var(--surface)] py-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-[var(--faint)] focus:border-[var(--violet)] focus:ring-2 focus:ring-[var(--violet)]/20" />
            </div>

            {/* type dropdown */}
            <div className="relative">
              <button onClick={() => { setTypeOpen((o) => !o); setStatusOpen(false); }} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] font-semibold hover:border-[var(--ink)]">
                {type === "ALL" ? "All types" : GADS_TYPES[type as keyof typeof GADS_TYPES].label} <ChevronDown size={14} className="text-[var(--faint)]" />
              </button>
              {typeOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
                  <button onClick={() => { setType("ALL"); setTypeOpen(false); }} className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-2)] ${type === "ALL" ? "font-bold text-[var(--violet)]" : ""}`}>All types {type === "ALL" && <CircleCheck size={14} />}</button>
                  {Object.entries(GADS_TYPES).map(([k, v]) => (
                    <button key={k} onClick={() => { setType(k); setTypeOpen(false); }} className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-2)] ${type === k ? "font-bold text-[var(--violet)]" : ""}`}>{v.label} {type === k && <CircleCheck size={14} />}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <a href={`/google-ads/entry?period=${period}`} className="btn btn-violet !py-2"><Plus size={15} /> Add Daily Data</a>
              <a href={`/reports`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] font-semibold hover:border-[var(--ink)]"><Download size={15} /> Export {suffix} Report</a>
            </div>
          </div>

        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label={`Total spent ${suffix}`} value={inr(kpis.totalSpent)} sub={periodDate} icon={TrendingUp} tone="violet" />
            <Kpi label={`Total leads ${suffix}`} value={String(kpis.totalLeads)} sub="across active clients" icon={Users} tone="emerald" />
            <Kpi label={`Cost / lead ${suffix}`} value={inr(kpis.costPerLead)} sub="spend / leads" icon={TrendingDown} tone="sky" />
            <Kpi label="Total conversions / sale" value={String(kpis.totalConv)} sub={`${kpis.convPct}% conv%`} icon={CircleCheck} tone="amber" chip={`${kpis.convPct}% Conv%`} />
          </div>

          {/* budget banner */}
          {budgetClient && (
            <div className="card card-pad">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[14px] font-bold">Budget this month · {budgetClient.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[var(--muted)]">
                    <span>Budget: <b className="text-[var(--ink)]">{k1(budgetClient.budget)}</b></span>
                    <span>Spend: <b className="text-[var(--ink)]">{k1(budgetClient.spend)}</b></span>
                    <span>Remaining: <b className="text-[var(--ink)]">{k1(Math.max(0, budgetClient.budget - budgetClient.spend))}</b></span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-bold tnum">{budgetClient.usedPct}% used</div>
                  <div className={`text-[12px] font-bold ${budgetClient.usedPct >= 85 ? "text-[var(--amber)]" : "text-[var(--emerald)]"}`}>{budgetClient.usedPct >= 100 ? "Over budget" : budgetClient.usedPct >= 85 ? "Needs attention" : "On track"}</div>
                </div>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-[var(--surface-3)]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, budgetClient.usedPct)}%`, background: budgetClient.usedPct >= 100 ? "var(--rose)" : budgetClient.usedPct >= 85 ? "var(--amber)" : "var(--violet)" }} />
              </div>
            </div>
          )}

          {/* client cards */}
          {visible.length === 0 && <div className="card card-pad text-center text-sm text-[var(--muted)]">No clients match your filters.</div>}
          {visible.map((r) => {
            const isOpen = expanded.has(r.id);
            const camps = filterCampaigns(r.campaigns);
            return (
              <div key={r.id} className="card !p-0 overflow-hidden" style={{ borderLeft: `4px solid ${r.ready ? "var(--emerald)" : "var(--rose)"}` }}>
                {/* header */}
                <button onClick={() => r.ready && toggle(r.id)} className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold">{r.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.onHold ? "bg-[color-mix(in_srgb,var(--amber)_14%,white)] text-[var(--amber)]" : "bg-[color-mix(in_srgb,var(--emerald)_14%,white)] text-[var(--emerald)]"}`}>{r.onHold ? "On Hold" : "Active"}</span>
                      <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">Budget {k1(r.budget)}/mo</span>
                    </div>
                    {r.ready ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[var(--muted)]">
                        <span>Spend {suffix}: <b className="text-[var(--ink)]">{inr(r.spent)}</b></span>
                        <span>Leads: <b className="text-[var(--ink)]">{r.leads}</b></span>
                        <span>CPL: <b className="text-[var(--ink)]">{inr(r.cpl)}</b></span>
                        <span>Conv: <b className="text-[var(--ink)]">{r.conv}</b></span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--emerald)_12%,white)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--emerald)]"><CircleCheck size={12} /> Ready for Morning Report</span>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
                        <span className="text-[var(--muted)]">Spend {suffix}: <b className="text-[var(--ink)]">₹0</b></span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--rose)_12%,white)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--rose)]"><CircleAlert size={12} /> Pending Update</span>
                      </div>
                    )}
                  </div>
                  {r.ready && <span className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} /></span>}
                </button>

                {r.ready && r.updatedAt && (
                  <div className="px-5 pb-1 text-[11.5px] text-[var(--faint)]">Last updated {new Date(r.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{r.updatedBy ? ` by ${r.updatedBy}` : ""}</div>
                )}

                {/* pending actions */}
                {!r.ready && (
                  <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
                    <span className="text-[12.5px] font-semibold text-[var(--rose)]">Not updated {suffix.toLowerCase()}!</span>
                    <div className="ml-auto flex gap-2">
                      <button className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rose)]/40 px-3 py-1.5 text-[12.5px] font-semibold text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_8%,white)]"><CircleAlert size={14} /> Remind Team</button>
                      <a href={`/google-ads/entry?client=${r.id}&period=${period}`} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rose)] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"><Plus size={14} /> Add Now</a>
                    </div>
                  </div>
                )}

                {/* expanded campaign table */}
                {r.ready && isOpen && (
                  <div className="border-t border-[var(--line)]">
                    <div className="overflow-x-auto scroll-thin">
                      <table className="w-full min-w-[820px] text-left">
                        <thead><tr className="border-b border-[var(--line)]">{["Campaign", "Type", "Spent", "Leads", "CPL auto", "Conv", "Conv% auto", "Status", ""].map((h, i) => <th key={i} className={`th px-5 py-2.5 ${i >= 2 && i <= 6 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
                        <tbody>
                          {camps.map((c, i) => (
                            <tr key={i} className="border-b border-[var(--line)] hover:bg-[var(--surface-2)]">
                              <td className="px-5 py-3 text-[13.5px] font-semibold">{c.name}</td>
                              <td className="px-5 py-3"><span className="rounded-md px-2 py-1 text-[11.5px] font-semibold" style={{ background: `color-mix(in srgb, ${typeTone[c.type]} 12%, white)`, color: typeTone[c.type] }}>{GADS_TYPES[c.type as keyof typeof GADS_TYPES]?.label ?? c.type}</span></td>
                              <td className="px-5 py-3 text-right text-[13px] tnum">{inr(c.spent)}</td>
                              <td className="px-5 py-3 text-right text-[13px] font-semibold tnum">{c.leads}</td>
                              <td className="px-5 py-3 text-right text-[13px] tnum text-[var(--muted)]">{inr(c.cpl)}</td>
                              <td className="px-5 py-3 text-right text-[13px] tnum">{c.conv}</td>
                              <td className="px-5 py-3 text-right text-[13px] tnum text-[var(--muted)]">{c.convPct}%</td>
                              <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.status === "ACTIVE" ? "bg-[color-mix(in_srgb,var(--emerald)_12%,white)] text-[var(--emerald)]" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>{c.status === "ACTIVE" ? "Active" : "Paused"}</span></td>
                              <td className="px-5 py-3 text-right"><a href={`/google-ads/entry?client=${r.id}&period=${period}`} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--violet)] hover:underline"><Pencil size={13} /> Edit</a></td>
                            </tr>
                          ))}
                          {camps.length === 0 && <tr><td colSpan={9} className="px-5 py-6 text-center text-[13px] text-[var(--muted)]">No campaigns match the current type/search filter.</td></tr>}
                          <tr className="bg-[var(--surface-2)] font-bold">
                            <td className="px-5 py-3 text-[13px]">Total {suffix}</td>
                            <td />
                            <td className="px-5 py-3 text-right text-[13px] tnum">{inr(camps.reduce((s, c) => s + c.spent, 0))}</td>
                            <td className="px-5 py-3 text-right text-[13px] tnum">{camps.reduce((s, c) => s + c.leads, 0)} leads</td>
                            <td className="px-5 py-3 text-right text-[13px] tnum text-[var(--muted)]">Avg {inr(camps.reduce((s, c) => s + c.leads, 0) ? Math.round(camps.reduce((s, c) => s + c.spent, 0) / camps.reduce((s, c) => s + c.leads, 0)) : 0)}</td>
                            <td className="px-5 py-3 text-right text-[13px] tnum">{camps.reduce((s, c) => s + c.conv, 0)}</td>
                            <td className="px-5 py-3 text-right text-[13px] tnum">{camps.reduce((s, c) => s + c.leads, 0) ? ((camps.reduce((s, c) => s + c.conv, 0) / camps.reduce((s, c) => s + c.leads, 0)) * 100).toFixed(1) : 0}%</td>
                            <td colSpan={2} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap gap-2 px-5 py-4">
                      <ActionBtn icon={Eye} label="View History" href={`/clients/${r.id}`} />
                      <ActionBtn icon={Pencil} label={`Edit ${suffix} Data`} href={`/google-ads/entry?client=${r.id}&period=${period}`} />
                      <ActionBtn icon={Send} label="Send Report to Client" href={`/reports`} />
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--emerald)]/40 px-3 py-1.5 text-[12.5px] font-semibold text-[var(--emerald)]"><MessageCircle size={14} /> WhatsApp</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, href }: { icon: typeof Eye; label: string; href: string }) {
  return <a href={href} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line-2)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-2)] hover:border-[var(--ink)]"><Icon size={14} /> {label}</a>;
}

function Kpi({ label, value, sub, icon: Icon, tone, chip }: { label: string; value: string; sub: string; icon: typeof Users; tone: string; chip?: string }) {
  const c: Record<string, string> = { violet: "var(--violet)", emerald: "var(--emerald)", sky: "var(--sky)", amber: "var(--amber)" };
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: `color-mix(in srgb, ${c[tone]} 12%, white)`, color: c[tone] }}><Icon size={15} /></span>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-[28px] font-extrabold leading-none tracking-tight tnum">{value}</span>
        {chip && <span className="mb-0.5 rounded-md bg-[color-mix(in_srgb,var(--emerald)_12%,white)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--emerald)]">{chip}</span>}
      </div>
      <div className="mt-1.5 text-[12px] text-[var(--muted)]">{sub}</div>
    </div>
  );
}
