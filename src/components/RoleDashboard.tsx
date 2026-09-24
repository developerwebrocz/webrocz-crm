import { getMyDashboard } from "@/lib/queries";
import { ROLES, DEPARTMENTS } from "@/lib/domain";
import { monthLabel, monthGonePct } from "@/lib/period";
import { Card, Eyebrow, Avatar, ServiceChips, IconChip } from "@/components/ui";
import { Users, CheckCircle2, Clock, Gauge, Plus, Megaphone, ArrowRight, TrendingUp } from "lucide-react";

const TONE: Record<string, string> = { emerald: "var(--emerald)", amber: "var(--amber)", rose: "var(--rose)", violet: "var(--violet)", sky: "var(--sky)" };

const DEPT_OF: Record<string, keyof typeof DEPARTMENTS> = {
  SEO: "SEO", SEO_HEAD: "SEO", DESIGNER: "DESIGN", EDITOR: "VIDEO", ACCOUNT_MANAGER: "ACCOUNT", AM_HEAD: "ACCOUNT", DM_EXEC: "ACCOUNT",
};

function StatMini({ icon: Icon, tone, label, value }: { icon: typeof Users; tone: string; label: string; value: React.ReactNode }) {
  return (
    <Card hover>
      <div className="flex items-start justify-between">
        <span className="eyebrow">{label}</span>
        <IconChip icon={Icon} tone={tone} size={34} />
      </div>
      <div className="mt-3 text-[32px] font-extrabold leading-none tracking-tight tnum">{value}</div>
    </Card>
  );
}

export default async function RoleDashboard({ user }: { user: { id: string; name: string; role: string } }) {
  const d = await getMyDashboard(user.id, user.role);
  const isAM = d.scope.monitor;
  const roleLabel = ROLES[user.role as keyof typeof ROLES] ?? user.role;
  const deptLabel = DEPARTMENTS[DEPT_OF[user.role] ?? "ACCOUNT"];
  const gone = monthGonePct();

  // health counts across the user's portfolio
  const health = { on_track: 0, attention: 0, critical: 0 };
  for (const r of d.rows) health[r.band.key as keyof typeof health]++;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{roleLabel} · my workspace</Eyebrow>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Welcome, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isAM
              ? "Health across all the clients you manage — targets, pace and what needs attention."
              : `Your assigned clients and this month's ${deptLabel} target vs actual.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAM && <a href="/ads" className="btn btn-ghost"><Megaphone size={15} /> Ads entry</a>}
          <a href="/updates" className="btn btn-dark"><Plus size={15} /> Update work</a>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isAM ? (
          <>
            <StatMini icon={Users} tone="violet" label="My clients" value={d.stats.clients} />
            <StatMini icon={CheckCircle2} tone="emerald" label="On track" value={health.on_track} />
            <StatMini icon={Clock} tone="amber" label="Needs attention" value={health.attention} />
            <StatMini icon={TrendingUp} tone="rose" label="Critical" value={health.critical} />
          </>
        ) : (
          <>
            <StatMini icon={Users} tone="violet" label="My clients" value={d.stats.clients} />
            <StatMini icon={CheckCircle2} tone="emerald" label="Completed this month" value={d.stats.completed} />
            <StatMini icon={Clock} tone="amber" label="Open updates" value={d.stats.pending} />
            <StatMini icon={Gauge} tone="sky" label="Avg progress" value={`${d.stats.avg}%`} />
          </>
        )}
      </div>

      {/* AM: ads entry banner */}
      {isAM && (
        <a href="/ads" className="card card-pad flex items-center gap-4 transition hover:border-[var(--violet)]">
          <IconChip icon={Megaphone} tone="violet" size={42} />
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-bold">Daily Meta Ads entry</div>
            <div className="text-[12.5px] text-[var(--muted)]">Log today&apos;s numbers per client — CPL, CPM &amp; ROAS calculate automatically.</div>
          </div>
          <ArrowRight size={18} className="text-[var(--muted)]" />
        </a>
      )}

      {/* clients table */}
      <Card pad={false}>
        <div className="flex items-center justify-between px-4 py-3.5">
          <h2 className="text-[15px] font-bold">{isAM ? "My clients · health" : "My clients · target vs actual"}</h2>
          <span className="badge badge-slate tnum">{gone}% of month gone</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-y border-[var(--line)]">
                <th className="th px-4 py-2.5">Client</th>
                <th className="th px-4 py-2.5">Services</th>
                <th className="th px-4 py-2.5">{isAM ? "Agreed" : "Target"}</th>
                <th className="th px-4 py-2.5">Done</th>
                <th className="th px-4 py-2.5" style={{ minWidth: 160 }}>Progress</th>
                <th className="th px-4 py-2.5">{isAM ? "Health" : "Status"}</th>
                <th className="th px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} size={32} />
                      <div className="min-w-0"><div className="truncate text-[13.5px] font-semibold">{r.name}</div><div className="text-[10.5px] text-[var(--muted)] tnum">{r.code}</div></div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><ServiceChips services={r.services} max={2} /></td>
                  <td className="px-4 py-2.5 text-[13px] font-semibold tnum">{r.target}</td>
                  <td className="px-4 py-2.5 text-[13px] font-semibold tnum">{r.completed}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-between text-[11.5px]"><span className="tnum text-[var(--muted)]">{r.completed}/{r.target}</span><span className="font-bold tnum" style={{ color: TONE[r.band.tone] }}>{r.pct}%</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, r.pct)}%`, background: TONE[r.band.tone] }} /></div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="badge tnum" style={{ background: `color-mix(in srgb, ${TONE[r.band.tone]} 11%, white)`, color: TONE[r.band.tone] }}>{r.band.label}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right"><a href={`/clients/${r.id}`} className="text-[12px] font-semibold text-[var(--violet)]">Open</a></td>
                </tr>
              ))}
              {d.rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--muted)]">No clients assigned to you yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* recent updates (employees) */}
      {!isAM && (
        <Card>
          <h2 className="text-[15px] font-bold">My recent updates</h2>
          <div className="mt-3 space-y-2.5 max-h-[320px] overflow-auto scroll-thin pr-1">
            {d.updates.length === 0 && <p className="text-sm text-[var(--muted)]">Your logged work will appear here. Use “Update work” to add your first entry.</p>}
            {d.updates.slice(0, 12).map((u) => {
              const done = u.status === "COMPLETED" || u.status === "APPROVED";
              return (
                <div key={u.id} className="flex items-center gap-3 text-[13px]">
                  <span className="dot" style={{ background: done ? "var(--emerald)" : "var(--amber)" }} />
                  <span className="font-semibold">{u.workType}</span>
                  <span className="text-[var(--muted)]">×{u.quantity}</span>
                  <span className="truncate text-[var(--ink-2)]">— {u.client}</span>
                  <span className="ml-auto text-[11px] text-[var(--faint)] tnum">{new Date(u.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="text-center text-[11px] text-[var(--faint)]">{monthLabel()} · {roleLabel}</div>
    </div>
  );
}
