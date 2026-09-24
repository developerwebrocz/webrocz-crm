import { getTasksView } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { createTask, createMyTask, setTaskStatus, deleteTask } from "@/app/actions";
import { redirect } from "next/navigation";
import { ROLES, TASK_STATUS, TASK_STATUS_KEYS, PRIORITIES, PRIORITY_KEYS } from "@/lib/domain";
import { Avatar, Card, PageHeader } from "@/components/ui";
import { Play, Check, RotateCcw, Trash2, Flag, CalendarClock, Inbox, Send, ListTodo, Loader, CheckCircle2, AlertTriangle, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = { slate: "var(--ink-2)", violet: "var(--violet)", emerald: "var(--emerald)", amber: "var(--amber)", rose: "var(--rose)" };

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { isAssigner, myTasks, assignedByMe, users, clients } = await getTasksView(user.id, user.role);

  const open = myTasks.filter((t) => t.status !== "DONE");
  const done = myTasks.filter((t) => t.status === "DONE");
  const inProgress = myTasks.filter((t) => t.status === "IN_PROGRESS");
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate + "T23:59:59").getTime() < Date.now());

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Work assignments" title="My Tasks" sub={isAssigner ? "Your tasks, and the work you've assigned to the team." : "Everything assigned to you — update the status as you go."} />

      {/* KPI summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TaskKpi icon={ListTodo} tone="violet" label="Open tasks" value={open.length} />
        <TaskKpi icon={Loader} tone="amber" label="In progress" value={inProgress.length} />
        <TaskKpi icon={CheckCircle2} tone="emerald" label="Completed" value={done.length} />
        <TaskKpi icon={AlertTriangle} tone="rose" label="Overdue" value={overdue.length} />
      </div>

      {/* add my own task (everyone — a personal to-do) */}
      {(
        <Card>
          <div className="flex items-center gap-2"><Plus size={16} className="text-[var(--violet)]" /><h2 className="text-[15px] font-bold">Add a task</h2><span className="text-[12px] text-[var(--muted)]">— a personal to-do for yourself</span></div>
          <form action={createMyTask} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block lg:col-span-2"><span className="eyebrow">Task *</span><input name="title" required className="input mt-1.5" placeholder="e.g. Finish Anupama Hospital backlinks" /></label>
            <label className="block"><span className="eyebrow">Priority</span>
              <select name="priority" className="select mt-1.5" defaultValue="MEDIUM">{PRIORITY_KEYS.map((k) => <option key={k} value={k}>{PRIORITIES[k].label}</option>)}</select>
            </label>
            <label className="block"><span className="eyebrow">Due date</span><input type="date" name="dueDate" className="input mt-1.5" /></label>
            <label className="block lg:col-span-2"><span className="eyebrow">Client (optional)</span>
              <select name="clientId" className="select mt-1.5" defaultValue=""><option value="">— None —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            <label className="block lg:col-span-2"><span className="eyebrow">Details</span><input name="detail" className="input mt-1.5" placeholder="Notes (optional)" /></label>
            <div className="flex items-end lg:col-span-4"><button className="btn btn-violet"><Plus size={15} /> Add task</button></div>
          </form>
        </Card>
      )}

      {/* my tasks */}
      <div>
        <div className="mb-3 flex items-center gap-2"><Inbox size={16} className="text-[var(--violet)]" /><h2 className="text-[15px] font-bold">Assigned to me</h2><span className="badge badge-violet tnum">{open.length} open</span></div>
        {myTasks.length === 0 ? (
          <Card className="py-12 text-center text-sm text-[var(--muted)]">No tasks assigned to you yet.</Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {[...open, ...done].map((t) => {
              const st = TASK_STATUS[t.status as keyof typeof TASK_STATUS];
              const pr = PRIORITIES[t.priority as keyof typeof PRIORITIES];
              const overdue = t.status !== "DONE" && t.dueDate && new Date(t.dueDate + "T23:59:59").getTime() < Date.now();
              return (
                <Card key={t.id} className={`flex flex-col ${t.status === "DONE" ? "opacity-70" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{t.title}</span>
                        {!t.seen && t.status === "TODO" && <span className="badge tnum" style={{ background: "color-mix(in srgb, var(--rose) 12%, white)", color: "var(--rose)" }}>New</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--muted)]">
                        <span>from <b className="text-[var(--ink-2)]">{t.from}</b></span>
                        {t.client && <span>· {t.client}</span>}
                        {pr && <span className="inline-flex items-center gap-1" style={{ color: TONE[pr.tone] }}><Flag size={11} /> {pr.label}</span>}
                        {t.dueDate && <span className="inline-flex items-center gap-1" style={overdue ? { color: "var(--rose)", fontWeight: 700 } : undefined}><CalendarClock size={11} /> {t.dueDate}{overdue ? " · overdue" : ""}</span>}
                      </div>
                    </div>
                    <span className="badge flex-none tnum" style={{ background: `color-mix(in srgb, ${TONE[st.tone]} 12%, white)`, color: TONE[st.tone] }}>{st.label}</span>
                  </div>
                  {t.detail && <p className="mt-2 text-[13px] text-[var(--ink-2)]">{t.detail}</p>}
                  {/* status controls */}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                    {t.status === "TODO" && <StatusBtn id={t.id} to="IN_PROGRESS" icon={Play} label="Start" tone="violet" />}
                    {t.status !== "DONE" && <StatusBtn id={t.id} to="DONE" icon={Check} label="Mark done" tone="emerald" solid />}
                    {t.status === "DONE" && <StatusBtn id={t.id} to="IN_PROGRESS" icon={RotateCcw} label="Reopen" tone="slate" />}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* assign a task (heads / super admin) */}
      {isAssigner && (
        <Card>
          <div className="flex items-center gap-2"><Send size={16} className="text-[var(--violet)]" /><h2 className="text-[15px] font-bold">Assign a task</h2></div>
          <form action={createTask} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="redirectTo" value="1" />
            <label className="block lg:col-span-3"><span className="eyebrow">Task *</span><input name="title" required className="input mt-1.5" placeholder="e.g. Design Diwali sale creatives" /></label>
            <label className="block"><span className="eyebrow">Assign to *</span>
              <select name="assignedToId" required className="select mt-1.5" defaultValue="">
                <option value="" disabled>Select a team member</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLES[u.role as keyof typeof ROLES] ?? u.role}</option>)}
              </select>
            </label>
            <label className="block"><span className="eyebrow">Client</span>
              <select name="clientId" className="select mt-1.5" defaultValue=""><option value="">— None —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            <label className="block"><span className="eyebrow">Priority</span>
              <select name="priority" className="select mt-1.5" defaultValue="MEDIUM">{PRIORITY_KEYS.map((k) => <option key={k} value={k}>{PRIORITIES[k].label}</option>)}</select>
            </label>
            <label className="block"><span className="eyebrow">Due date</span><input type="date" name="dueDate" className="input mt-1.5" /></label>
            <label className="block lg:col-span-2"><span className="eyebrow">Details</span><input name="detail" className="input mt-1.5" placeholder="Brief / notes (optional)" /></label>
            <div className="flex items-end lg:col-span-3"><button className="btn btn-violet"><Send size={15} /> Assign task</button></div>
          </form>

          {/* what I assigned */}
          {assignedByMe.length > 0 && (
            <div className="mt-5 border-t border-[var(--line)] pt-4">
              <div className="eyebrow mb-2">Assigned by me · {assignedByMe.length}</div>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead><tr className="border-b border-[var(--line)]">{["Task", "Assigned to", "Client", "Due", "Status", ""].map((h) => <th key={h} className="th px-3 py-2">{h}</th>)}</tr></thead>
                  <tbody>
                    {assignedByMe.map((t) => {
                      const st = TASK_STATUS[t.status as keyof typeof TASK_STATUS];
                      return (
                        <tr key={t.id} className="border-b border-[var(--line)] last:border-0">
                          <td className="px-3 py-2 font-semibold">{t.title}</td>
                          <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5"><Avatar name={t.to} size={20} tone="slate" /> {t.to}</span></td>
                          <td className="px-3 py-2 text-[var(--muted)]">{t.client ?? "—"}</td>
                          <td className="px-3 py-2 tnum text-[var(--muted)]">{t.dueDate || "—"}</td>
                          <td className="px-3 py-2"><span className="badge tnum" style={{ background: `color-mix(in srgb, ${TONE[st.tone]} 12%, white)`, color: TONE[st.tone] }}>{st.label}</span></td>
                          <td className="px-3 py-2 text-right"><form action={deleteTask}><input type="hidden" name="id" value={t.id} /><button className="text-[var(--faint)] hover:text-[var(--rose)]" title="Delete"><Trash2 size={14} /></button></form></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function TaskKpi({ icon: Icon, tone, label, value }: { icon: typeof Play; tone: string; label: string; value: number }) {
  const c = TONE[tone];
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: `color-mix(in srgb, ${c} 12%, white)`, color: c }}><Icon size={17} /></span>
      </div>
      <div className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-[30px] font-extrabold leading-none tracking-tight tnum">{value}</div>
    </div>
  );
}

function StatusBtn({ id, to, icon: Icon, label, tone, solid }: { id: string; to: string; icon: typeof Play; label: string; tone: string; solid?: boolean }) {
  const c = TONE[tone];
  return (
    <form action={setTaskStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={to} />
      <button className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] px-3 py-1.5 text-[13px] font-semibold transition"
        style={solid ? { background: c, color: "white" } : { border: `1px solid var(--line-2)`, color: c }}>
        <Icon size={14} /> {label}
      </button>
    </form>
  );
}
