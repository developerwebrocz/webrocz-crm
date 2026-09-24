import { getTeamOverview } from "@/lib/queries";
import { createUser } from "@/app/actions";
import { Card, Eyebrow, PageHeader } from "@/components/ui";
import AddMemberForm from "@/components/AddMemberForm";
import TeamTable from "@/components/TeamTable";
import { Users, UserCheck, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { members, totals, monthLabel } = await getTeamOverview();

  const kpis = [
    { label: "Team members", value: totals.members, icon: Users, tone: "var(--violet)" },
    { label: "Active", value: totals.active, icon: UserCheck, tone: "var(--emerald)" },
    { label: `Output · ${monthLabel.split(" ")[0]}`, value: totals.output, icon: CheckCircle2, tone: "var(--sky)" },
    { label: "Pending approval", value: totals.pending, icon: Clock, tone: "var(--amber)" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Organisation" title="Team" sub={`Every member's workload and output this month · ${monthLabel}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card card-pad">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{k.label}</span>
              <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: `color-mix(in srgb, ${k.tone} 12%, white)`, color: k.tone }}><k.icon size={15} /></span>
            </div>
            <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight tnum">{k.value}</div>
          </div>
        ))}
      </div>

      <TeamTable members={members} />

      <Card>
        <Eyebrow>Add team member</Eyebrow>
        <div className="mt-3"><AddMemberForm action={createUser} /></div>
      </Card>
    </div>
  );
}
