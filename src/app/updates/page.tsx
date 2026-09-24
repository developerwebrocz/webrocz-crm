import { getClientOptions, getUsers, getReport, workScopeFor } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createUpdate } from "@/app/actions";
import { Eyebrow, Card } from "@/components/ui";
import UpdateForm from "@/components/UpdateForm";
import { WORK_STATUS } from "@/lib/domain";
import { ClipboardList, CheckCircle2, Clock3 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UpdatesPage({ searchParams }: PageProps<"/updates">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const clientId = typeof sp.clientId === "string" ? sp.clientId : undefined;
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN";
  // The activity feed is scoped: employee → own, head → their team, admin → all.
  const scope = workScopeFor(user.role, user.id);
  const [clients, users, report] = await Promise.all([
    getClientOptions(),
    isAdmin ? getUsers() : Promise.resolve([]),
    getReport("today", scope),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Activity record</Eyebrow>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Update work</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Log every unit of work — it&apos;s dated, so today / week / month totals and reports build themselves. Only a completing status counts toward the monthly target.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <UpdKpi icon={ClipboardList} tone="violet" label="Logged today" value={report.kpis.total} />
        <UpdKpi icon={CheckCircle2} tone="emerald" label="Completed" value={report.kpis.completed} />
        <UpdKpi icon={Clock3} tone="amber" label="Pending" value={report.kpis.pending} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <UpdateForm
          clients={clients}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          action={createUpdate}
          defaultClientId={clientId}
          today={today}
          currentUser={{ id: user.id, name: user.name }}
          lockUser={!isAdmin}
        />
      </div>

      <div className="space-y-4">
        <Card pad={false}>
          <div className="p-4"><Eyebrow>Today&apos;s updates</Eyebrow></div>
          <div className="max-h-[420px] overflow-auto scroll-thin">
            {report.rows.slice(0, 20).map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-2.5 text-sm">
                <span className={`badge ${["COMPLETED", "APPROVED"].includes(r.status) ? "badge-emerald" : "badge-amber"}`}>
                  {WORK_STATUS[r.status as keyof typeof WORK_STATUS] ?? r.status}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.client.name}</div>
                  <div className="eyebrow">{r.workType} · {r.user.name}</div>
                </div>
              </div>
            ))}
            {report.rows.length === 0 && <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">No updates logged today yet.</div>}
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
}

function UpdKpi({ icon: Icon, tone, label, value }: { icon: typeof ClipboardList; tone: string; label: string; value: number }) {
  const c: Record<string, string> = { violet: "var(--violet)", emerald: "var(--emerald)", amber: "var(--amber)" };
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: `color-mix(in srgb, ${c[tone]} 12%, white)`, color: c[tone] }}><Icon size={17} /></span>
      </div>
      <div className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-[30px] font-extrabold leading-none tracking-tight tnum">{value}</div>
    </Card>
  );
}
