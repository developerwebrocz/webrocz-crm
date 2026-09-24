import { getCurrentUser } from "@/lib/auth";
import { getMyDashboard } from "@/lib/queries";
import { redirect } from "next/navigation";
import { ROLES, WORK_STATUS } from "@/lib/domain";
import { Avatar, Badge, Card, Eyebrow, IconChip, Progress, PageHeader, ServiceChips } from "@/components/ui";
import { Users, CheckCircle2, Clock, Gauge, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = await getMyDashboard(user.id, user.role);
  const roleLabel = ROLES[user.role as keyof typeof ROLES] ?? user.role;
  const monitor = d.scope.monitor;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${roleLabel} · my workspace`}
        title={`Welcome, ${user.name.split(" ")[0]}`}
        sub={monitor ? "Health across all your clients, monitored across departments." : "Your assigned clients and this month's target vs actual."}
        actions={<a href="/updates" className="btn btn-dark"><Plus size={15} /> Update work</a>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatMini icon={Users} tone="violet" label="My clients" value={d.stats.clients} />
        <StatMini icon={CheckCircle2} tone="emerald" label="Completed this month" value={d.stats.completed} />
        <StatMini icon={Clock} tone="amber" label="Open updates" value={d.stats.pending} />
        <StatMini icon={Gauge} tone="sky" label="Avg progress" value={`${d.stats.avg}%`} />
      </div>

      {/* my clients */}
      <Card pad={false}>
        <div className="flex items-center justify-between p-4">
          <h2 className="text-[15px] font-bold">{monitor ? "My clients · health" : "My clients · target vs actual"}</h2>
          <span className="tag tnum">{d.rows.length}</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead>
              <tr className="border-y border-[var(--line)]">
                <th className="th">Client</th>
                <th className="th">Services</th>
                <th className="th">{monitor ? "Agreed" : "Target"}</th>
                <th className="th">Done</th>
                <th className="th">Progress</th>
                <th className="th">{monitor ? "Health" : "Last update"}</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.id} className="row-link border-b border-[var(--line)] last:border-0">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} size={34} />
                      <div><div className="font-semibold">{r.name}</div><div className="eyebrow">{r.code}</div></div>
                    </div>
                  </td>
                  <td className="td"><ServiceChips services={r.services} /></td>
                  <td className="td tnum font-semibold">{r.target}</td>
                  <td className="td tnum">{r.completed}</td>
                  <td className="td min-w-[150px]">
                    <div className="flex justify-between text-xs tnum"><span className="font-semibold">{r.pct}%</span><span className="text-[var(--muted)]">{r.pending} left</span></div>
                    <div className="mt-1"><Progress pct={r.pct} tone={r.band.tone} /></div>
                  </td>
                  <td className="td">
                    {monitor
                      ? <Badge tone={r.band.tone}>{r.band.label}</Badge>
                      : <span className="text-[var(--muted)] tnum">{r.last ? new Date(r.last).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</span>}
                  </td>
                  <td className="td text-right"><a href={`/clients/${r.id}`} className="text-sm font-semibold text-[var(--violet)]">Open</a></td>
                </tr>
              ))}
              {d.rows.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-[var(--muted)]">No clients assigned to you yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* my updates */}
      <Card pad={false}>
        <div className="flex items-center justify-between p-4">
          <h2 className="text-[15px] font-bold">My updates this month</h2>
          <span className="tag tnum">{d.updates.length}</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead>
              <tr className="border-y border-[var(--line)]">
                <th className="th">Date</th><th className="th">Client</th><th className="th">Work type</th>
                <th className="th">Qty</th><th className="th">Status</th><th className="th">Detail</th>
              </tr>
            </thead>
            <tbody>
              {d.updates.map((u) => (
                <tr key={u.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="td whitespace-nowrap tnum">{new Date(u.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                  <td className="td font-medium">{u.client}</td>
                  <td className="td">{u.workType}</td>
                  <td className="td tnum">{u.quantity}</td>
                  <td className="td"><span className={`badge ${["COMPLETED", "APPROVED"].includes(u.status) ? "badge-emerald" : "badge-amber"}`}>{WORK_STATUS[u.status as keyof typeof WORK_STATUS] ?? u.status}</span></td>
                  <td className="td text-[var(--muted)]">{u.keyword ? `${u.keyword} · ${u.prevPosition}→${u.currPosition}` : (u.title ?? "—")}</td>
                </tr>
              ))}
              {d.updates.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-[var(--muted)]">No updates logged this month. <a href="/updates" className="text-[var(--violet)] font-semibold">Log your first →</a></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatMini({ icon: Icon, tone, label, value }: { icon: typeof Users; tone: string; label: string; value: React.ReactNode }) {
  return (
    <Card hover>
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <IconChip icon={Icon} tone={tone} size={34} />
      </div>
      <div className="mt-3 text-[30px] font-extrabold leading-none tracking-tight tnum">{value}</div>
    </Card>
  );
}
