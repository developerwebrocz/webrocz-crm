import { getDevBoard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { createDevProject } from "@/app/actions";
import { redirect } from "next/navigation";
import { PROJECT_TYPES, DEV_PLATFORMS, DEV_PLATFORM_KEYS, PROJECT_STATUS, PROJECT_STATUS_KEYS, PRIORITIES, PRIORITY_KEYS } from "@/lib/domain";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isDev = user.role === "WEB_DEV";
  const { devs, clients } = await getDevBoard(isDev ? user.id : undefined);
  const canPickAssignee = !isDev;

  return (
    <div className="mx-auto max-w-[820px] space-y-5">
      <a href="/projects" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">← Developer Team</a>
      <PageHeader eyebrow="Developer team" title="New project" sub="Add a website or landing-page build to the board." />

      <Card>
        <form action={createDevProject} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="redirectTo" value="1" />
          <label className="block lg:col-span-3"><span className="eyebrow">Project name *</span><input name="name" required autoFocus className="input mt-1.5" placeholder="e.g. Acme Corp website" /></label>
          <label className="block"><span className="eyebrow">Client</span>
            <select name="clientId" className="select mt-1.5" defaultValue=""><option value="">— None / internal —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          <label className="block"><span className="eyebrow">Assigned to</span>
            <select name="assignedToId" className="select mt-1.5" defaultValue={canPickAssignee ? "" : user.id}>
              {canPickAssignee && <option value="">— Unassigned —</option>}
              {devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="eyebrow">Type</span>
            <select name="projectType" className="select mt-1.5" defaultValue="WEBSITE">{Object.entries(PROJECT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
          <label className="block"><span className="eyebrow">Platform / stack</span>
            <select name="platform" className="select mt-1.5" defaultValue="WORDPRESS">{DEV_PLATFORM_KEYS.map((k) => <option key={k} value={k}>{DEV_PLATFORMS[k].label}</option>)}</select>
          </label>
          <label className="block"><span className="eyebrow">Status</span>
            <select name="status" className="select mt-1.5" defaultValue="PLANNING">{PROJECT_STATUS_KEYS.map((k) => <option key={k} value={k}>{PROJECT_STATUS[k].label}</option>)}</select>
          </label>
          <label className="block"><span className="eyebrow">Priority</span>
            <select name="priority" className="select mt-1.5" defaultValue="MEDIUM">{PRIORITY_KEYS.map((k) => <option key={k} value={k}>{PRIORITIES[k].label}</option>)}</select>
          </label>
          <label className="block"><span className="eyebrow">Progress %</span><input name="progress" type="number" min={0} max={100} defaultValue={0} className="input mt-1.5" /></label>
          <label className="block"><span className="eyebrow">Due date</span><input name="dueDate" type="date" className="input mt-1.5" /></label>
          <label className="block"><span className="eyebrow">Live URL</span><input name="liveUrl" className="input mt-1.5" placeholder="https://…" /></label>
          <label className="block"><span className="eyebrow">Repo URL</span><input name="repoUrl" className="input mt-1.5" placeholder="github.com/…" /></label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button className="btn btn-violet">Create project</button>
            <a href="/projects" className="btn btn-ghost">Cancel</a>
          </div>
        </form>
      </Card>
    </div>
  );
}
