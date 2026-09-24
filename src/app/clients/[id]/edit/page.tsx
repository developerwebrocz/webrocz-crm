import { getUsers, getClientForEdit } from "@/lib/queries";
import { updateClient } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { Eyebrow } from "@/components/ui";
import NewClientForm from "@/components/NewClientForm";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const me = await getCurrentUser();
  if (!(me?.role === "SUPER_ADMIN" || me?.role === "SUB_ADMIN")) redirect("/");
  const { id } = await params;
  const [users, initial] = await Promise.all([getUsers(), getClientForEdit(id)]);
  if (!initial) notFound();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <a href={`/clients/${id}`} className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">← Back to client</a>
      <div>
        <Eyebrow>Module 01 · Edit client</Eyebrow>
        <h1 className="mt-1 text-[26px] font-extrabold tracking-tight">Edit {initial.name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Update details, team and agreed deliverables — changes flow to every dashboard and report.</p>
      </div>
      <NewClientForm users={users.map((u) => ({ id: u.id, name: u.name, role: u.role }))} action={updateClient} today={today} initial={initial} />
    </div>
  );
}
