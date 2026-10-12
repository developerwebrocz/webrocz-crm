import { getUsers, getClientForEdit } from "@/lib/queries";
import { updateClient } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { Eyebrow } from "@/components/ui";
import NewClientForm from "@/components/NewClientForm";
import { notFound, redirect } from "next/navigation";
import { ownClientsOf } from "@/lib/am-scope";
import { managesClient } from "@/lib/am-access";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const me = await getCurrentUser();
  // the admins, and the account-management team (an account manager: only the clients they manage)
  if (!me || !["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "ACCOUNT_MANAGER", "DM_EXEC"].includes(me.role)) redirect("/");
  const { id } = await params;
  const [users, initial] = await Promise.all([getUsers(), getClientForEdit(id)]);
  if (!initial) notFound();
  const ownOnly = !!ownClientsOf(me);
  if (ownOnly && !(await managesClient(me.id, id))) redirect("/clients");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <a href={`/clients/${id}`} className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">← Back to client</a>
      <div>
        <Eyebrow>Edit info</Eyebrow>
        <h1 className="mt-1 text-[26px] font-extrabold tracking-tight">Edit {initial.name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Update details, team and agreed deliverables — changes flow to every dashboard and report.</p>
      </div>
      <NewClientForm users={users.map((u) => ({ id: u.id, name: u.name, role: u.role }))} action={updateClient} today={today} initial={initial} shareLocked={ownOnly} />
    </div>
  );
}
