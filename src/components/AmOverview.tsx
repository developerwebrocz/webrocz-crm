import { getAmDashboard, getCreativeTeam, getClientOptions } from "@/lib/queries";
import { inrShort, inr } from "@/lib/domain";
import AssignCreativeForm from "@/components/AssignCreativeForm";
import {
  Users, Megaphone, Target, Images, IndianRupee, TrendingUp, AlertTriangle,
  ArrowRight, Wallet, Zap,
} from "lucide-react";

export default async function AmOverview({ user }: { user: { id: string; name: string; role: string } }) {
  const [d, creativeTeam, clientOpts] = await Promise.all([
    getAmDashboard(user.id, user.role),
    getCreativeTeam(),
    getClientOptions(),
  ]);
  const first = user.name.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">{user.role === "DM_EXEC" ? "Digital Marketing Executive" : d.isHead ? "AM Head" : "Account Manager"} · {d.monthLabel}</span>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">{greet}, {first}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Ads performance across your clients — enter daily Meta & Google Ads results and keep every client updated.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/ads" className="btn btn-ghost"><Megaphone size={15} /> Meta entry</a>
          <a href="/google-ads" className="btn btn-ghost"><Target size={15} /> Google Ads</a>
          <AssignCreativeForm members={creativeTeam} clients={clientOpts.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} tone="violet" label="My clients" value={d.clients} note="active" />
        <Kpi icon={IndianRupee} tone="emerald" label="Ad spend · this month" value={inrShort(d.totalSpend)} note="Meta + Google" />
        <Kpi icon={Zap} tone="sky" label="Total leads" value={d.totalLeads} note="this month" />
        <Kpi icon={TrendingUp} tone="amber" label="Avg cost / lead" value={inr(d.avgCpl)} note="blended" />
      </div>

      {/* needs attention */}
      {(d.pending.length > 0 || d.budgetAlerts.length > 0) && (
        <div className="card card-pad" style={{ borderColor: "color-mix(in srgb, var(--rose) 35%, white)", background: "color-mix(in srgb, var(--rose) 4%, white)" }}>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "color-mix(in srgb, var(--rose) 12%, white)", color: "var(--rose)" }}><AlertTriangle size={16} /></span>
            <h2 className="text-[14.5px] font-bold">Needs your attention</h2>
            <span className="text-[12px] text-[var(--muted)]">{d.pending.length} not updated yesterday · {d.budgetAlerts.length} near budget</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {d.pending.map((r) => (
              <a key={r.id} href="/google-ads" className="inline-flex items-center gap-2 rounded-full border border-[var(--line-2)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-semibold hover:border-[var(--rose)]">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--rose)" }} /> {r.name} <span className="text-[var(--muted)]">· update Google Ads</span>
              </a>
            ))}
            {d.budgetAlerts.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: "color-mix(in srgb, var(--amber) 40%, white)", color: "var(--amber)" }}>
                <Wallet size={12} /> {r.name} · {r.gBudgetPct}% budget
              </span>
            ))}
          </div>
        </div>
      )}

      {/* channel split + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChannelCard href="/ads" icon={Megaphone} tone="sky" title="Meta Ads" rows={[["Spend", inrShort(d.meta.spend)], ["Leads", d.meta.leads], ["ROAS", `${d.meta.roas}x`]]} cta="Daily entry" />
        <ChannelCard href="/google-ads" icon={Target} tone="violet" title="Google Ads" rows={[["Spend", inrShort(d.google.spend)], ["Leads", d.google.leads], ["Conversions", d.google.conv]]} cta="Open console" />
        <ChannelCard href="/smo" icon={Images} tone="emerald" title="SM Posts" rows={[["Clients", d.clients], ["Channel", "Instagram · FB"], ["Entry", "Daily posts"]]} cta="Post tracker" />
      </div>

      {/* clients table */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold">My clients · ad performance</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">This month across Meta & Google. Click a client to open its daily entry.</p>
          </div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Client", "Meta spend", "Meta leads", "Google spend", "Google leads", "Budget", ""].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3"><a href={`/clients/${r.id}`} className="text-[13.5px] font-semibold hover:text-[var(--violet)]">{r.name}</a><div className="text-[11px] text-[var(--muted)]">{r.industry}</div></td>
                  <td className="px-5 py-3 text-[13px] tnum">{r.metaSpend ? inrShort(r.metaSpend) : "—"}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum">{r.metaLeads || "—"}</td>
                  <td className="px-5 py-3 text-[13px] tnum">{r.gSpend ? inrShort(r.gSpend) : "—"}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum">{r.gLeads || "—"}</td>
                  <td className="px-5 py-3">
                    {r.hasGoogle ? (
                      <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, r.gBudgetPct)}%`, background: r.gBudgetPct >= 90 ? "var(--rose)" : "var(--violet)" }} /></div><span className="text-[11.5px] font-bold tnum" style={{ color: r.gBudgetPct >= 90 ? "var(--rose)" : "var(--muted)" }}>{r.gBudgetPct}%</span></div>
                    ) : <span className="text-[var(--faint)]">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.gPending ? <a href="/google-ads" className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--rose)_12%,white)] px-2 py-1 text-[11.5px] font-bold text-[var(--rose)]">Pending</a>
                      : <a href={r.hasGoogle ? "/google-ads" : "/ads"} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--violet)]">Open <ArrowRight size={13} /></a>}
                  </td>
                </tr>
              ))}
              {d.rows.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No active clients assigned to you yet.</td></tr>}
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
        {note && <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">{note}</span>}
      </div>
      <div className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-[28px] font-extrabold leading-none tracking-tight tnum">{value}</div>
    </div>
  );
}

function ChannelCard({ href, icon: Icon, tone, title, rows, cta }: { href: string; icon: typeof Users; tone: string; title: string; rows: [string, React.ReactNode][]; cta: string }) {
  const c: Record<string, string> = { violet: "var(--violet)", emerald: "var(--emerald)", sky: "var(--sky)" };
  return (
    <a href={href} className="card card-hover card-pad group block">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${c[tone]} 12%, white)`, color: c[tone] }}><Icon size={19} /></span>
        <ArrowRight size={16} className="text-[var(--faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--ink)]" />
      </div>
      <div className="mt-3 text-[15px] font-bold">{title}</div>
      <div className="mt-2 space-y-1">
        {rows.map(([k, v]) => <div key={k} className="flex items-center justify-between text-[12.5px]"><span className="text-[var(--muted)]">{k}</span><span className="font-bold tnum">{v}</span></div>)}
      </div>
      <div className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: c[tone] }}>{cta} <ArrowRight size={13} /></div>
    </a>
  );
}
