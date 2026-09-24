import { getClientBook } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { Eyebrow } from "@/components/ui";
import ClientBook from "@/components/ClientBook";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [{ rows, counts }, me] = await Promise.all([getClientBook(), getCurrentUser()]);
  const isSuper = me?.role === "SUPER_ADMIN" || me?.role === "SUB_ADMIN";

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>{counts.all} on record · {counts.active} active</Eyebrow>
        <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Clients</h1>
      </div>
      <ClientBook rows={rows} counts={counts} isSuper={isSuper} />
    </div>
  );
}
