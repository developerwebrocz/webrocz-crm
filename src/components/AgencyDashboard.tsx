import { getDashboard } from "@/lib/queries";
import { monthLabel, monthGonePct, now, type PeriodKey } from "@/lib/period";
import { inr, inrShort } from "@/lib/domain";
import { Card, Eyebrow, IconChip } from "@/components/ui";
import PeriodTabs from "@/components/PeriodTabs";
import DashboardClientsTable from "@/components/DashboardClientsTable";
import Sparkline from "@/components/Sparkline";
import SalesFinanceOverview from "@/components/SalesFinanceOverview";
import { Megaphone, TrendingUp, TrendingDown, Trophy } from "lucide-react";

const DEPT_BAR: Record<string, string> = { SEO: "var(--emerald)", DESIGN: "var(--violet)", VIDEO: "#f97316", ACCOUNT: "var(--ink)" };
const DEPT_LABEL: Record<string, string> = { SEO: "SEO", DESIGN: "Design · SMO", VIDEO: "Video", ACCOUNT: "Account management" };

export default async function AgencyDashboard({ period }: { period: PeriodKey }) {
  const d = await getDashboard(period);
  const gone = monthGonePct();
  const today = now();

  const smoPending = Math.max(0, d.smo.agreed - d.smo.done);
  const smoPct = d.smo.agreed ? Math.round((d.smo.done / d.smo.agreed) * 100) : 0;
  const normalPct = d.video.reelsAgreed ? Math.round((d.video.reelsDone / d.video.reelsAgreed) * 100) : 0;
  const aiPct = d.video.aiAgreed ? Math.round((d.video.aiDone / d.video.aiAgreed) * 100) : 0;
  const videoTotal = d.video.aiAgreed + d.video.reelsAgreed;
  const videoDone = d.video.aiDone + d.video.reelsDone;
  const videoAvg = videoTotal ? Math.round((videoDone / videoTotal) * 100) : 0;

  const healthTotal = d.health.on_track + d.health.attention + d.health.critical;

  // member names per department for the dept card headers
  const byDept: Record<string, string[]> = { SEO: [], DESIGN: [], VIDEO: [] };
  for (const t of d.team) if (t.dept && byDept[t.dept]) byDept[t.dept].push(t.name.split(" ")[0]);
  const compact = (names: string[]) => (names.length === 0 ? "—" : names.length <= 2 ? names.join(", ") : `${names[0]} +${names.length - 1}`);
  const deptMembers: Record<string, string> = {
    SEO: compact(byDept.SEO),
    DESIGN: compact(byDept.DESIGN),
    VIDEO: compact(byDept.VIDEO),
    ACCOUNT: compact(d.amList.map((a) => a.name.split(" ")[0])),
  };

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Agency overview</Eyebrow>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight">Dashboard</h1>
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{monthLabel()} · {gone}% of month gone</div>
      </div>

      {/* period bar */}
      <Card className="flex flex-wrap items-center justify-between gap-3 !py-3">
        <PeriodTabs showLabel active={period} />
        <span className="text-xs font-semibold text-[var(--muted)] tnum">{today.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}</span>
      </Card>

      {/* Row 1 — overview cards */}
      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        {/* total clients */}
        <Card>
          <Eyebrow>Total clients</Eyebrow>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[38px] font-extrabold leading-none tracking-tight tnum">{d.totals.clients}</span>
            <span className="mb-1 text-sm text-[var(--muted)]">/ {d.totals.active} active</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {d.amList.slice(0, 6).map((a) => (
              <span key={a.name} className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink-2)] tnum">{a.name.split(" ")[0]} {a.count}</span>
            ))}
            {d.amList.length === 0 && <span className="text-xs text-[var(--muted)]">No account managers assigned.</span>}
          </div>
        </Card>

        {/* SMO overview */}
        <Card>
          <Eyebrow>SMO overview</Eyebrow>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[34px] font-extrabold leading-none tracking-tight tnum">{d.smo.agreed}</span>
            <span className="mb-1 text-sm text-[var(--muted)]">agreed / mo</span>
          </div>
          <div className="mt-3 track"><span style={{ width: `${smoPct}%` }} /></div>
          <div className="mt-3 flex gap-2">
            <span className="badge badge-emerald tnum">{d.smo.done} completed</span>
            <span className="badge badge-amber tnum">{smoPending} pending</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([["Static", d.smo.static[1]], ["Carousel", d.smo.carousel[1]], ["Reels", d.smo.reels[1]]] as const).map(([l, v]) => (
              <div key={l}><div className="text-[17px] font-bold tnum">{v}</div><div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">{l}</div></div>
            ))}
          </div>
        </Card>

        {/* video overview */}
        <Card>
          <Eyebrow>Video overview</Eyebrow>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[30px] font-extrabold leading-none tracking-tight tnum">{d.video.reelsAgreed}</span>
            <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Normal · Reels</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-[var(--violet)]" style={{ width: `${normalPct}%` }} /></div>
          <div className="mt-1 text-[10px] text-[var(--muted)] tnum">{normalPct}% completed</div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-[30px] font-extrabold leading-none tracking-tight tnum">{d.video.aiAgreed}</span>
            <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">AI Videos</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${aiPct}%`, background: "var(--pink)" }} /></div>
          <div className="mt-1 text-[10px] text-[var(--muted)] tnum">{aiPct}% completed</div>
          <div className="mt-3 text-xs text-[var(--muted)] tnum">{videoTotal} /mo · {videoAvg}% avg</div>
        </Card>

        {/* urgent work */}
        <Card className="!border-transparent" style={{ background: "color-mix(in srgb, var(--rose) 7%, white)" }}>
          <Eyebrow>Urgent work</Eyebrow>
          <div className="mt-2">
            <span className="text-[34px] font-extrabold leading-none tracking-tight text-[var(--rose)] tnum">{d.urgentWork.total}</span>
            <span className="ml-1 text-[13px] text-[var(--ink-2)]">items behind pace across {d.urgentWork.clients} clients</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {d.urgentWork.top.map((u) => (
              <a key={u.id} href={`/clients/${u.id}`} className="flex items-center justify-between text-[13px]">
                <span className="truncate font-semibold">{u.name}</span>
                <span className="font-semibold text-[var(--rose)] tnum">{u.pending} pending</span>
              </a>
            ))}
            {d.urgentWork.top.length === 0 && <span className="text-sm text-[var(--muted)]">Everything on pace.</span>}
          </div>
        </Card>
      </div>

      {/* Sales & Finance — Super Admin summary (pipeline + invoices at a glance) */}
      <SalesFinanceOverview />

      {/* Row 2 — four department cards */}
      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        {(Object.keys(d.dept) as (keyof typeof d.dept)[]).map((k) => {
          const v = d.dept[k]; const pending = Math.max(0, v.agreed - v.done);
          const pct = v.agreed ? Math.round((v.done / v.agreed) * 100) : 0;
          return (
            <Card key={k} hover>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-bold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: DEPT_BAR[k] }} /> {DEPT_LABEL[k]}
                </span>
                <span className="truncate max-w-[110px] text-[11px] font-semibold text-[var(--muted)]">{deptMembers[k]}</span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-[30px] font-extrabold leading-none tracking-tight tnum">{v.agreed}</span>
                <span className="mb-1 text-[12px] text-[var(--muted)] tnum">total · {v.done} done</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: DEPT_BAR[k] }} /></div>
              <div className="mt-2 flex items-center justify-between text-[11.5px]">
                <span className="text-[var(--muted)] tnum">Pending {pending} · <span className="text-[var(--rose)]">Overdue {v.overdue}</span></span>
                <span className="font-bold tnum" style={{ color: DEPT_BAR[k] }}>{pct}%</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Row 3 — client health (3 cards) + team workload */}
      <div className="grid gap-4 lg:grid-cols-4">
        {([["on_track", "On Track", "emerald", "≥80% completed"], ["attention", "Needs Attention", "amber", "50–79% completed"], ["critical", "Critical", "rose", "<50% completed"]] as const).map(([key, label, tone, hint]) => {
          const count = d.health[key];
          const pct = healthTotal ? Math.round((count / healthTotal) * 100) : 0;
          return (
            <Card key={key} className="!border-transparent" style={{ background: `color-mix(in srgb, var(--${tone}) 7%, white)` }}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-bold"><span className="dot" style={{ background: `var(--${tone})` }} /> {label}</span>
                <span className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[12px] font-bold text-white tnum" style={{ background: `var(--${tone})` }}>{count}</span>
              </div>
              <div className="mt-3 text-[30px] font-extrabold leading-none tracking-tight tnum" style={{ color: `var(--${tone})` }}>{pct}%</div>
              <div className="mt-1.5 text-[12px] text-[var(--muted)] tnum">{count} clients · {hint}</div>
            </Card>
          );
        })}

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold">Team workload</h2>
            <a href="/team" className="eyebrow hover:text-[var(--violet)]">View all</a>
          </div>
          <div className="mt-3 space-y-2.5 max-h-[180px] overflow-auto scroll-thin pr-1">
            {d.team.slice(0, 6).map((t) => {
              const pct = t.target ? Math.round((t.done / t.target) * 100) : 0;
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold">{t.name}</span>
                    <span className="font-bold tnum text-[var(--muted)]">{t.done}/{t.target}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-[var(--violet)]" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                </div>
              );
            })}
            {d.team.length === 0 && <span className="text-sm text-[var(--muted)]">No team members yet.</span>}
          </div>
        </Card>
      </div>

      {/* Row 3.5 — analytics: ads overview + team leaderboard */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconChip icon={Megaphone} tone="violet" size={30} />
              <h2 className="text-[15px] font-bold">Meta Ads · this month</h2>
            </div>
            {d.ads.lastMonthSpend > 0 && (
              <span className="badge tnum" style={{ background: `color-mix(in srgb, var(--${d.ads.spendDelta >= 0 ? "emerald" : "rose"}) 12%, white)`, color: `var(--${d.ads.spendDelta >= 0 ? "emerald" : "rose"})` }}>
                {d.ads.spendDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(d.ads.spendDelta)}% vs last month
              </span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><div className="eyebrow">Ad spend</div><div className="mt-1 text-[24px] font-extrabold tracking-tight tnum text-[var(--violet)]">{inrShort(d.ads.spend)}</div></div>
            <div><div className="eyebrow">Leads</div><div className="mt-1 text-[24px] font-extrabold tracking-tight tnum text-[var(--sky)]">{d.ads.leads.toLocaleString("en-IN")}</div></div>
            <div><div className="eyebrow">Avg CPL</div><div className="mt-1 text-[24px] font-extrabold tracking-tight tnum text-[var(--emerald)]">{d.ads.cpl ? inr(d.ads.cpl) : "—"}</div></div>
            <div><div className="eyebrow">Conversions</div><div className="mt-1 text-[24px] font-extrabold tracking-tight tnum text-[var(--amber)]">{d.ads.conversions.toLocaleString("en-IN")}</div></div>
          </div>
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <div className="eyebrow mb-1">Daily ad spend</div>
            {d.ads.trend.length > 1
              ? <Sparkline data={d.ads.trend.map((t) => t.value)} width={640} height={54} />
              : <p className="text-[13px] text-[var(--muted)]">Not enough data yet — spend shows here as AMs log daily numbers.</p>}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <IconChip icon={Trophy} tone="amber" size={30} />
            <h2 className="text-[15px] font-bold">Top performers</h2>
          </div>
          <div className="mt-3 space-y-2">
            {[...d.team].sort((a, b) => b.done - a.done).slice(0, 5).map((t, i) => {
              const medal = ["#eab308", "#94a3b8", "#c2703f"][i];
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-extrabold tnum" style={{ background: medal ? `color-mix(in srgb, ${medal} 20%, white)` : "var(--surface-3)", color: medal ?? "var(--ink-2)" }}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{t.name}</span>
                  <span className="text-[13px] font-bold tnum">{t.done}</span>
                  <span className="text-[11px] text-[var(--muted)]">done</span>
                </div>
              );
            })}
            {d.team.length === 0 && <span className="text-sm text-[var(--muted)]">No team activity yet.</span>}
          </div>
        </Card>
      </div>

      {/* Row 4 — clients table (the centerpiece) */}
      <DashboardClientsTable rows={d.clients} />
    </div>
  );
}
