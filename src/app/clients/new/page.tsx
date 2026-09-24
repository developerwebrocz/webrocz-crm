import { getUsers } from "@/lib/queries";
import { createClient } from "@/app/actions";
import { Eyebrow } from "@/components/ui";
import NewClientForm from "@/components/NewClientForm";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const users = await getUsers();
  const today = new Date().toISOString().slice(0, 10); // computed on server, passed as prop → no hydration drift

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Module 01 · Client onboarding</Eyebrow>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Add new client</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Team assignments and agreed monthly deliverables set here drive every department dashboard, client health score and report.
        </p>
      </div>
      <NewClientForm users={users.map((u) => ({ id: u.id, name: u.name, role: u.role }))} action={createClient} today={today} />
    </div>
  );
}
