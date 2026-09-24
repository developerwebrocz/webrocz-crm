import { getReport, getUsers, getClientOptions, workScopeFor } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, Eyebrow } from "@/components/ui";
import PeriodTabs from "@/components/PeriodTabs";
import ReportExport from "@/components/ReportExport";
import ReportFilters from "@/components/ReportFilters";
import { WORK_STATUS, type WorkStatus } from "@/lib/domain";
import { type PeriodKey } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const period = (typeof sp.period === "string" ? sp.period : "month") as PeriodKey;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  // Access model: Super Admin sees everyone (and can filter); a head is locked to their
  // department; every other employee is locked to ONLY their own updates.
  const scope = workScopeFor(user.role, user.id);
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN";
  const isHead = !!scope.dept;
  const reportOpts = {
    userId: scope.userId ?? (isAdmin ? str("member") : undefined),
    dept: scope.dept ?? (isAdmin ? str("dept") : undefined),
    clientId: str("client"),
  };
  const [{ rows, kpis, range }, users, clients] = await Promise.all([
    getReport(period, reportOpts),
    isAdmin ? getUsers() : Promise.resolve([]),
    getClientOptions(),
  ]);

  const fmt = (d: Date) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const exportRows = rows.map((r) => ({
    date: fmt(r.date), client: r.client.name, workType: r.workType,
    qty: r.quantity, status: WORK_STATUS[r.status as WorkStatus] ?? r.status,
    user: r.user.name, detail: r.keyword ? `${r.keyword} ${r.prevPosition}->${r.currPosition}` : (r.title ?? ""),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Report center</Eyebrow>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {fmt(range.start)} – {fmt(range.end)} · {isAdmin ? "every logged update across the agency" : isHead ? "your team's logged work" : "your own logged work"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodTabs active={period} />
          <ReportExport rows={exportRows} filename={`webrocz-report-${period}`} />
        </div>
      </div>

      {isAdmin && (
        <ReportFilters
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          current={{ period, member: str("member") ?? "", dept: str("dept") ?? "", client: str("client") ?? "" }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><Eyebrow>Total updates</Eyebrow><div className="mt-2 text-4xl font-extrabold">{kpis.total}</div></Card>
        <Card><Eyebrow>Completed</Eyebrow><div className="mt-2 text-4xl font-extrabold text-[color:var(--emerald)]">{kpis.completed}</div></Card>
        <Card><Eyebrow>Pending</Eyebrow><div className="mt-2 text-4xl font-extrabold text-[color:var(--amber)]">{kpis.pending}</div></Card>
        <Card><Eyebrow>Contributors</Eyebrow><div className="mt-2 text-4xl font-extrabold">{kpis.contributors}</div></Card>
      </div>

      <Card pad={false}>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="eyebrow border-b border-[var(--line)] text-left">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Work type</th>
                <th className="px-4 py-3 font-semibold">Qty</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)]">
                  <td className="whitespace-nowrap px-4 py-2.5">{fmt(r.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{r.client.name}</td>
                  <td className="px-4 py-2.5">{r.workType}</td>
                  <td className="px-4 py-2.5">{r.quantity}</td>
                  <td className="px-4 py-2.5">
                    <span className={`badge ${["COMPLETED", "APPROVED"].includes(r.status) ? "badge-emerald" : "badge-amber"}`}>
                      {WORK_STATUS[r.status as WorkStatus] ?? r.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">{r.user.name}</td>
                  <td className="px-4 py-2.5 text-[var(--muted)]">{r.keyword ? `${r.keyword} · ${r.prevPosition}→${r.currPosition}` : (r.title ?? "—")}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">No updates in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
