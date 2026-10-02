import { getClientBook, getCreativeTeam, getClientOptions } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { Eyebrow } from "@/components/ui";
import ClientBook from "@/components/ClientBook";
import AssignCreativeForm from "@/components/AssignCreativeForm";

export const dynamic = "force-dynamic";

const CREATIVE_ASSIGNER = ["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "ACCOUNT_MANAGER", "DM_EXEC"];

export default async function ClientsPage() {
  const [{ rows, counts }, me] = await Promise.all([getClientBook(), getCurrentUser()]);
  const isSuper = me?.role === "SUPER_ADMIN" || me?.role === "SUB_ADMIN";
  const canAssign = CREATIVE_ASSIGNER.includes(me?.role ?? "");
  const [creativeTeam, clientOpts] = canAssign
    ? await Promise.all([getCreativeTeam(), getClientOptions()])
    : [[], []];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{counts.all} on record · {counts.active} active</Eyebrow>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Clients</h1>
        </div>
        {canAssign && <AssignCreativeForm members={creativeTeam} clients={clientOpts.map((c) => ({ id: c.id, name: c.name }))} />}
      </div>
      <ClientBook rows={rows} counts={counts} isSuper={isSuper} />
    </div>
  );
}
