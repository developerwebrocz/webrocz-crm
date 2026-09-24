"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { DEV_PLATFORMS, PROJECT_TYPES, PROJECT_STATUS, PROJECT_STATUS_KEYS, PRIORITIES, PRIORITY_KEYS, type ProjectStatus } from "@/lib/domain";
import { Eyebrow, IconChip, Avatar } from "./ui";
import DevKanban from "./DevKanban";
import DevSwimlanes from "./DevSwimlanes";
import { Plus, Trash2, ExternalLink, LayoutGrid, Timer, Eye, Rocket, Code2, CalendarClock, User2, KanbanSquare, List, Search, Flag, GitBranch, AlertTriangle, Rows3, Activity, CheckSquare, Square, X, Share2, Copy, Check } from "lucide-react";

const TONE: Record<string, string> = { slate: "var(--ink-2)", violet: "var(--violet)", amber: "var(--amber)", emerald: "var(--emerald)", rose: "var(--rose)", sky: "var(--sky)", indigo: "var(--indigo)" };
const PLAT_SHORT: Record<string, string> = { WORDPRESS: "WP", SHOPIFY: "SH", REACT: "Re", NEXTJS: "Nx", NODEJS: "Nd", HTML: "</>" };

type Task = { id: string; title: string; done: boolean };
type Row = {
  id: string; name: string; client: string | null; clientCode: string | null;
  assignee: string | null; assigneeId: string | null;
  projectType: string; platform: string; status: string; priority: string; progress: number;
  dueDate: string; liveUrl: string; repoUrl: string; notes: string; shareId: string;
  tasks: Task[]; taskDone: number; taskTotal: number;
  daysLeft: number | null; overdue: boolean;
};
type Dev = { id: string; name: string };
type Client = { id: string; name: string; code: string };
type Load = { id: string; name: string; total: number; live: number; inProgress: number; review: number; avg: number };
type Act = { id: string; actor: string; message: string; project: string; date: string | Date };
type Act2 = (fd: FormData) => void;

export default function DevBoard({
  rows, stats, devs, workload, unassigned, activity, canPickAssignee, isSuper, selfName,
  updateAction, deleteAction, addTaskAction, toggleTaskAction, deleteTaskAction, shareAction,
}: {
  rows: Row[]; stats: { total: number; planning: number; inProgress: number; review: number; live: number; onHold: number; overdue: number };
  devs: Dev[]; clients: Client[]; workload: Load[]; unassigned: number; activity: Act[];
  canPickAssignee: boolean; isSuper: boolean; selfId: string; selfName: string;
  createAction: Act2; updateAction: Act2; deleteAction: Act2;
  addTaskAction: Act2; toggleTaskAction: Act2; deleteTaskAction: Act2; shareAction: Act2;
}) {
  const [filter, setFilter] = useState<ProjectStatus | null>(null);
  const [devFilter, setDevFilter] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"board" | "swimlanes" | "list">("board");

  const byDev = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (devFilter && r.assigneeId !== devFilter) return false;
      if (!needle) return true;
      return r.name.toLowerCase().includes(needle) || (r.client ?? "").toLowerCase().includes(needle) || (r.assignee ?? "").toLowerCase().includes(needle);
    });
  }, [rows, devFilter, q]);
  const visible = useMemo(() => (filter ? byDev.filter((r) => r.status === filter) : byDev), [byDev, filter]);
  // remounts the board/swimlanes when projects are added, removed or change status/progress,
  // so a newly-created project shows up immediately after the server action.
  const boardKey = useMemo(() => byDev.map((r) => `${r.id}:${r.status}:${r.progress}`).join("|"), [byDev]);

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Developer team · build tracker</Eyebrow>
          <h1 className="mt-1.5 text-[27px] font-extrabold tracking-tight">{canPickAssignee ? "Developer Team" : `Welcome, ${selfName.split(" ")[0]}`}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Websites &amp; landing pages — every build, its stack, status and go-live in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search builds, client, dev…" className="input !h-10 !w-[220px] !pl-9 !text-[13px]" />
          </div>
          <a href="/projects/new" className="btn btn-dark"><Plus size={15} /> New project</a>
        </div>
      </div>

      {stats.overdue > 0 && (
        <div className="flex items-center gap-2.5 rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--rose)_30%,white)] bg-[color-mix(in_srgb,var(--rose)_7%,white)] px-4 py-2.5 text-[13px] font-semibold text-[var(--rose)]">
          <AlertTriangle size={16} /> {stats.overdue} build{stats.overdue !== 1 ? "s" : ""} past due date — needs attention.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={LayoutGrid} tone="violet" label="Total projects" value={stats.total} sub={`${stats.planning} planning · ${stats.onHold} on hold`} />
        <Kpi icon={Timer} tone="indigo" label="In progress" value={stats.inProgress} sub="active builds" />
        <Kpi icon={Eye} tone="amber" label="In review" value={stats.review} sub="awaiting sign-off" />
        <Kpi icon={Rocket} tone="emerald" label="Live" value={stats.live} sub="shipped & running" />
      </div>

      {/* team — who's building what (head / admin only) */}
      {canPickAssignee && workload.length > 0 && (
        <div className="card card-pad">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">Team · who&apos;s building what</h2>
            {devFilter && <button type="button" onClick={() => setDevFilter(null)} className="eyebrow hover:text-[var(--violet)]">Clear filter</button>}
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {workload.map((w) => {
              const on = devFilter === w.id;
              return (
                <button
                  type="button" key={w.id} onClick={() => setDevFilter(on ? null : w.id)}
                  className={`flex items-center gap-3 rounded-[var(--r-md)] border p-3 text-left transition ${on ? "border-[var(--violet)] bg-[var(--violet-wash,#f3edfd)]" : "border-[var(--line)] hover:border-[var(--violet)]"}`}
                >
                  <Avatar name={w.name} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{w.name}</div>
                    <div className="text-[11.5px] text-[var(--muted)] tnum">{w.total} build{w.total !== 1 ? "s" : ""} · {w.inProgress} active · {w.live} live</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-[var(--violet)]" style={{ width: `${Math.max(2, w.avg)}%` }} /></div>
                  </div>
                  <span className="text-[13px] font-bold tnum text-[var(--violet)]">{w.avg}%</span>
                </button>
              );
            })}
          </div>
          {unassigned > 0 && <div className="mt-2.5 text-[12px] text-[var(--amber)]">{unassigned} project{unassigned !== 1 ? "s" : ""} not assigned to anyone yet.</div>}
        </div>
      )}


      {/* toolbar: view toggle + (list-only) status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-[var(--r-md)] bg-[var(--surface-2)] p-1">
          <button type="button" onClick={() => setView("board")} className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition ${view === "board" ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}><KanbanSquare size={15} /> Board</button>
          {canPickAssignee && <button type="button" onClick={() => setView("swimlanes")} className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition ${view === "swimlanes" ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}><Rows3 size={15} /> Swimlanes</button>}
          <button type="button" onClick={() => setView("list")} className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition ${view === "list" ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}><List size={15} /> List</button>
        </div>
        {(view === "board" || view === "swimlanes") && <span className="text-[12px] text-[var(--muted)]">Drag a card between columns to change its status.</span>}
        {view === "list" && (
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill active={filter === null} onClick={() => setFilter(null)}>All <span className="tnum opacity-60">{byDev.length}</span></FilterPill>
            {PROJECT_STATUS_KEYS.map((k) => (
              <FilterPill key={k} active={filter === k} onClick={() => setFilter(filter === k ? null : k)}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[PROJECT_STATUS[k].tone] }} /> {PROJECT_STATUS[k].label}
                <span className="tnum opacity-60">{byDev.filter((r) => r.status === k).length}</span>
              </FilterPill>
            ))}
          </div>
        )}
      </div>

      {/* board / swimlanes / list */}
      {byDev.length === 0 ? (
        <div className="card card-pad text-center text-sm text-[var(--muted)]">No projects yet — click New project to add your first build.</div>
      ) : view === "board" ? (
        <DevKanban key={boardKey} rows={byDev} updateAction={updateAction as (fd: FormData) => Promise<void>} />
      ) : view === "swimlanes" ? (
        <DevSwimlanes key={boardKey} rows={byDev} devs={devs} updateAction={updateAction as (fd: FormData) => Promise<void>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((r) => (
            <ProjectCard key={`${r.id}-${r.progress}-${r.taskDone}-${r.taskTotal}-${r.status}-${r.shareId}-${r.assigneeId}`} row={r} canDelete={isSuper}
              devs={devs} canAssign={canPickAssignee}
              updateAction={updateAction} deleteAction={deleteAction}
              addTaskAction={addTaskAction} toggleTaskAction={toggleTaskAction} deleteTaskAction={deleteTaskAction} shareAction={shareAction} />
          ))}
          {visible.length === 0 && <div className="card card-pad text-center text-sm text-[var(--muted)] lg:col-span-2">No projects in this status.</div>}
        </div>
      )}

      {/* recent activity */}
      {activity.length > 0 && (
        <div className="card card-pad">
          <div className="flex items-center gap-2"><Activity size={16} className="text-[var(--violet)]" /><h2 className="text-[15px] font-bold">Recent activity</h2></div>
          <div className="mt-3 space-y-2.5">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[var(--violet)]" />
                <div className="min-w-0">
                  <span className="font-semibold">{a.actor}</span> <span className="text-[var(--ink-2)]">{a.message}</span> <span className="text-[var(--muted)]">· {a.project}</span>
                  <span className="ml-1.5 text-[11px] text-[var(--faint)] tnum">{new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, tone, label, value, sub }: { icon: typeof LayoutGrid; tone: string; label: string; value: number; sub: string }) {
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between">
        <span className="eyebrow">{label}</span>
        <IconChip icon={icon} tone={tone} size={34} />
      </div>
      <div className="mt-3 text-[32px] font-extrabold leading-none tracking-tight tnum" style={{ color: TONE[tone] }}>{value}</div>
      <div className="mt-1.5 text-[11.5px] text-[var(--muted)] tnum">{sub}</div>
    </div>
  );
}

function ProjectCard({ row, updateAction, deleteAction, canDelete, devs, canAssign, addTaskAction, toggleTaskAction, deleteTaskAction, shareAction }: {
  row: Row; updateAction: Act2; deleteAction: Act2; canDelete: boolean; devs: Dev[]; canAssign: boolean;
  addTaskAction: Act2; toggleTaskAction: Act2; deleteTaskAction: Act2; shareAction: Act2;
}) {
  const [status, setStatus] = useState(row.status);
  const [priority, setPriority] = useState(row.priority);
  const [progress, setProgress] = useState(row.progress);
  const [liveUrl, setLiveUrl] = useState(row.liveUrl);
  const [repoUrl, setRepoUrl] = useState(row.repoUrl);
  const [notes, setNotes] = useState(row.notes);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const pf = DEV_PLATFORMS[row.platform as keyof typeof DEV_PLATFORMS];
  const platTone = TONE[pf?.tone ?? "slate"];
  const stCur = PROJECT_STATUS[status as keyof typeof PROJECT_STATUS];
  const stTone = TONE[stCur?.tone ?? "violet"];
  const pr = PRIORITIES[priority as keyof typeof PRIORITIES];
  const shareUrl = row.shareId ? `${origin}/share/${row.shareId}` : "";

  return (
    <div className="card flex flex-col overflow-hidden">
      {/* body */}
      <div className="flex-1 p-5">
        <div className="flex items-start gap-3">
          {/* platform badge */}
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl text-[12px] font-extrabold" style={{ background: `color-mix(in srgb, ${platTone} 13%, white)`, color: platTone }}>
            {PLAT_SHORT[row.platform] ?? <Code2 size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[15px] font-bold leading-tight">{row.name}</span>
              <span className="flex flex-none items-center gap-1.5">
                {pr && <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold uppercase" style={{ color: TONE[pr.tone] }} title={`${pr.label} priority`}><Flag size={11} /> {pr.label}</span>}
                <span className="badge tnum" style={{ background: `color-mix(in srgb, ${stTone} 12%, white)`, color: stTone }}>{stCur?.label ?? status}</span>
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink-2)]">{pf?.label ?? row.platform}</span>
              <span>{PROJECT_TYPES[row.projectType as keyof typeof PROJECT_TYPES] ?? row.projectType}</span>
              <span className="inline-flex items-center gap-1"><User2 size={12} /> {row.assignee ?? "Unassigned"}</span>
              {row.dueDate && (
                <span className="inline-flex items-center gap-1" style={row.overdue ? { color: "var(--rose)", fontWeight: 700 } : undefined}>
                  <CalendarClock size={12} /> {row.dueDate}{row.overdue ? ` · ${Math.abs(row.daysLeft ?? 0)}d overdue` : row.daysLeft !== null && row.daysLeft <= 7 && row.status !== "LIVE" ? ` · ${row.daysLeft}d left` : ""}
                </span>
              )}
            </div>
            <div className="mt-1 text-[12px] text-[var(--muted)]">{row.client ? `${row.client} · ${row.clientCode}` : "Internal project"}</div>
          </div>
        </div>

        {/* progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="eyebrow">Progress</span>
            <span className="font-bold tnum" style={{ color: stTone }}>{progress}%</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-[var(--surface-3)]">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, progress)}%`, background: stTone }} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {row.liveUrl && (
            <a href={row.liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--violet)] hover:underline">
              <ExternalLink size={12} /> {row.liveUrl.replace(/^https?:\/\//, "")}
            </a>
          )}
          {row.repoUrl && (
            <a href={row.repoUrl.startsWith("http") ? row.repoUrl : `https://${row.repoUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink-2)] hover:underline">
              <GitBranch size={12} /> Repo
            </a>
          )}
        </div>
        {row.notes && (
          <div className="mt-3 rounded-[var(--r-md)] bg-[color-mix(in_srgb,var(--amber)_8%,white)] px-3 py-2 text-[12px] text-[var(--ink-2)]">
            <span className="font-bold text-[var(--amber)]">Follow-up:</span> {row.notes}
          </div>
        )}
      </div>

      {/* checklist */}
      <div className="border-t border-[var(--line)] px-5 py-3">
        <div className="eyebrow mb-2 flex items-center justify-between">
          <span>Checklist</span>
          {row.taskTotal > 0 && <span className="tnum text-[var(--muted)]">{row.taskDone}/{row.taskTotal} done</span>}
        </div>
        <div className="space-y-1">
          {row.tasks.map((t) => (
            <div key={t.id} className="group flex items-center gap-2">
              <form action={toggleTaskAction} className="min-w-0 flex-1">
                <input type="hidden" name="id" value={t.id} />
                <button className="flex w-full items-center gap-2 text-left text-[13px]">
                  {t.done ? <CheckSquare size={15} className="flex-none text-[var(--emerald)]" /> : <Square size={15} className="flex-none text-[var(--faint)]" />}
                  <span className={t.done ? "truncate text-[var(--faint)] line-through" : "truncate text-[var(--ink-2)]"}>{t.title}</span>
                </button>
              </form>
              <form action={deleteTaskAction} className="opacity-0 transition group-hover:opacity-100">
                <input type="hidden" name="id" value={t.id} />
                <button className="grid h-6 w-6 place-items-center rounded text-[var(--faint)] hover:text-[var(--rose)]"><X size={13} /></button>
              </form>
            </div>
          ))}
        </div>
        <form action={addTaskAction} className="mt-2 flex gap-2">
          <input type="hidden" name="projectId" value={row.id} />
          <input name="title" required placeholder="Add a task…" className="input !h-8 flex-1 !text-[12.5px]" />
          <button className="btn btn-ghost btn-sm">Add</button>
        </form>
      </div>

      {/* edit strip */}
      <form action={updateAction} className="flex flex-col gap-3 border-t border-[var(--line)] bg-[var(--surface-2)] px-5 py-3">
        <input type="hidden" name="id" value={row.id} />
        <label className="block">
          <span className="eyebrow">Follow-up note</span>
          <input name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. waiting on client logo, deploy Friday…" className="input !h-9 mt-1 !text-[12.5px]" />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="eyebrow">Status</span>
            <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="select !h-9 mt-1 !w-auto !py-1.5 !text-[13px] font-semibold">
              {PROJECT_STATUS_KEYS.map((k) => <option key={k} value={k}>{PROJECT_STATUS[k].label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow">Priority</span>
            <select name="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="select !h-9 mt-1 !w-auto !py-1.5 !text-[13px] font-semibold">
              {PRIORITY_KEYS.map((k) => <option key={k} value={k}>{PRIORITIES[k].label}</option>)}
            </select>
          </label>
          {canAssign && (
            <label className="block">
              <span className="eyebrow">Developer</span>
              <select name="assignedToId" defaultValue={row.assigneeId ?? ""} className="select !h-9 mt-1 !w-auto !py-1.5 !text-[13px] font-semibold">
                <option value="">Unassigned</option>
                {devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )}
          <label className="block flex-1 min-w-[110px]">
            <span className="eyebrow">Progress</span>
            <input name="progress" type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(parseInt(e.target.value, 10))} className="mt-2.5 w-full accent-[var(--violet)]" />
          </label>
          <label className="block w-[150px]">
            <span className="eyebrow">Live URL</span>
            <input name="liveUrl" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://…" className="input !h-9 mt-1 !text-[12.5px]" />
          </label>
          <label className="block w-[150px]">
            <span className="eyebrow">Repo URL</span>
            <input name="repoUrl" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="github.com/…" className="input !h-9 mt-1 !text-[12.5px]" />
          </label>
          <SubmitBtn label="Save" small />
          {canDelete && (
            <button formAction={deleteAction} className="grid h-9 w-9 place-items-center rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--rose)] hover:text-[var(--rose)]" title="Delete project">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </form>

      {/* client share link */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-2.5">
        <form action={shareAction}>
          <input type="hidden" name="id" value={row.id} />
          <button className={`btn btn-sm ${row.shareId ? "btn-ghost" : "btn-ghost"}`}><Share2 size={13} /> {row.shareId ? "Disable client link" : "Create client link"}</button>
        </form>
        {row.shareId && shareUrl && (
          <div className="flex flex-1 items-center gap-2">
            <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} className="input !h-8 min-w-[140px] flex-1 !text-[11.5px]" />
            <button type="button" onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn btn-ghost btn-sm">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitBtn({ label, small }: { label: string; small?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={`btn btn-violet ${small ? "btn-sm" : ""} disabled:opacity-60`} disabled={pending}>{pending ? "Saving…" : label}</button>;
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${active ? "bg-[var(--violet)] text-white" : "border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--violet)]"}`}>
      {children}
    </button>
  );
}
