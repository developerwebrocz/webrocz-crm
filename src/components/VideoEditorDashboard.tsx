import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayIST } from "@/lib/india-date";
import { initials } from "@/lib/domain";
import TodayEditCount from "@/components/TodayEditCount";
import MyShootsStrip from "@/components/MyShootsStrip";
import { advanceVideoTask } from "@/app/video-dashboard-actions";
import {
  Clapperboard, ListOrdered, Plus, AlertTriangle, CalendarClock, Loader, Eye, CheckCircle2, LayoutGrid,
  ArrowRight, Play, Send, Check, ExternalLink, Sparkles, Users, Flame, Clock3,
} from "lucide-react";

// A video editor's home page: what to do today at a glance — today's editing count, the videos
// that need attention (with one-click next step), what is coming up, and overall progress.
// The full list with filters stays in "My Videos". The team lead also sees the team's day.

type Row = {
  id: string; code: string; title: string; client: string; type: string; priority: string; status: string;
  dueDate: string; overdue: boolean; dueToday: boolean; dueLabel: string; rel: string; rawLink: string; brief: string;
};
type Counts = { total: number; dueToday: number; inProgress: number; review: number; completed: number; overdue: number };

const NEXT: Record<string, { label: string; to: string; icon: typeof Play; style: React.CSSProperties } | undefined> = {
  PENDING: { label: "Start editing", to: "IN_PROGRESS", icon: Play, style: { background: "var(--violet)", color: "white" } },
  IN_PROGRESS: { label: "Send for review", to: "REVIEW", icon: Send, style: { background: "var(--ink)", color: "white" } },
  REVIEW: { label: "Mark completed", to: "COMPLETED", icon: Check, style: { background: "var(--emerald)", color: "white" } },
};
const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Pending", tone: "var(--amber)" },
  IN_PROGRESS: { label: "In progress", tone: "var(--sky)" },
  REVIEW: { label: "In review", tone: "var(--violet)" },
  COMPLETED: { label: "Completed", tone: "var(--emerald)" },
};
const PRIORITY: Record<string, { label: string; tone: string }> = {
  HIGH: { label: "High", tone: "var(--rose)" },
  MEDIUM: { label: "Medium", tone: "var(--amber)" },
  LOW: { label: "Low", tone: "var(--emerald)" },
};
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;
const byDue = (a: Row, b: Row) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999");

function DueChip({ r }: { r: Row }) {
  if (!r.dueDate) return <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">No due date</span>;
  const tone = r.overdue ? "var(--rose)" : r.dueToday ? "var(--amber)" : "var(--muted)";
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: tint(tone, r.overdue || r.dueToday ? 12 : 9), color: r.dueToday && !r.overdue ? "#92600a" : tone }}>
      {r.overdue ? <AlertTriangle size={11} /> : <CalendarClock size={11} />} {r.overdue ? r.rel || "Overdue" : r.dueToday ? "Due today" : `${r.dueLabel}${r.rel ? ` · ${r.rel}` : ""}`}
    </span>
  );
}

function TaskRow({ r, action = true }: { r: Row; action?: boolean }) {
  const st = STATUS[r.status] ?? STATUS.PENDING;
  const pr = PRIORITY[r.priority] ?? PRIORITY.MEDIUM;
  const next = NEXT[r.status];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3" style={{ boxShadow: `inset 3px 0 0 ${r.overdue ? "var(--rose)" : st.tone}` }}>
      <div className="min-w-0 flex-1 basis-[240px]">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-bold">{r.title}</span>
          {r.priority === "HIGH" && <span className="inline-flex flex-none items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold uppercase" style={{ background: tint(pr.tone, 11), color: pr.tone }}><Flame size={10} /> High</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink-2)]">{r.client}</span><span>·</span><span>{r.type}</span><span>·</span><span className="tnum">{r.code}</span>
          {r.rawLink && <a href={r.rawLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-[var(--violet)] hover:underline"><ExternalLink size={11} /> Footage</a>}
        </div>
      </div>
      <div className="flex flex-none items-center gap-2">
        <span className="hidden rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline-flex" style={{ background: tint(st.tone, 11), color: st.tone }}>{st.label}</span>
        <DueChip r={r} />
      </div>
      {action && next && (
        <form action={advanceVideoTask} className="flex-none">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="status" value={next.to} />
          <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-bold transition hover:opacity-90" style={next.style}><next.icon size={13} /> {next.label}</button>
        </form>
      )}
    </div>
  );
}

export default async function VideoEditorDashboard({ user, rows, counts, progress }: { user: { id: string; name: string; teamLead?: boolean | null }; rows: Row[]; counts: Counts; progress: number }) {
  const today = todayIST();
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false })) % 24;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  const open = rows.filter((r) => r.status !== "COMPLETED");
  const pending = open.filter((r) => r.status === "PENDING").length;
  const rank = (r: Row) => (r.overdue ? 0 : r.dueToday ? 1 : 2);
  const focus = open.filter((r) => r.overdue || r.dueToday || r.status === "IN_PROGRESS").sort((a, b) => rank(a) - rank(b) || byDue(a, b)).slice(0, 7);
  const focusIds = new Set(focus.map((r) => r.id));
  const focusTotal = open.filter((r) => r.overdue || r.dueToday || r.status === "IN_PROGRESS").length;
  const upcoming = open.filter((r) => !focusIds.has(r.id) && r.status === "PENDING").sort(byDue).slice(0, 5);
  const inReview = open.filter((r) => !focusIds.has(r.id) && r.status === "REVIEW").sort(byDue).slice(0, 5);

  const summary = counts.overdue > 0
    ? `${counts.overdue} video${counts.overdue === 1 ? " is" : "s are"} overdue${counts.dueToday ? ` and ${counts.dueToday} due today` : ""} — start with those.`
    : counts.dueToday > 0 ? `${counts.dueToday} video${counts.dueToday === 1 ? " is" : "s are"} due today.`
    : open.length > 0 ? `Nothing is due today. ${open.length} video${open.length === 1 ? "" : "s"} in your queue.`
    : "No videos in your queue right now.";

  const tiles = [
    { label: "In my queue", n: open.length, icon: LayoutGrid, tone: "#c4b5fd", href: "/videos" },
    { label: "Due today", n: counts.dueToday, icon: CalendarClock, tone: "#fcd34d", href: "/videos?f=DUE_TODAY" },
    { label: "In progress", n: counts.inProgress, icon: Loader, tone: "#7dd3fc", href: "/videos?f=IN_PROGRESS" },
    { label: "In review", n: counts.review, icon: Eye, tone: "#d8b4fe", href: "/videos?f=REVIEW" },
    { label: "Overdue", n: counts.overdue, icon: AlertTriangle, tone: "#fda4af", href: "/videos?f=OVERDUE" },
  ];
  const pipeline = [
    { key: "PENDING", n: pending }, { key: "IN_PROGRESS", n: counts.inProgress }, { key: "REVIEW", n: counts.review }, { key: "COMPLETED", n: counts.completed },
  ];

  // Team lead: the team's day (today's count + open videos per editor).
  const team = user.teamLead
    ? await (async () => {
        const [editors, todayCounts, openTasks] = await Promise.all([
          prisma.user.findMany({ where: { role: "EDITOR", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
          prisma.editCount.findMany({ where: { date: today }, select: { userId: true, count: true } }),
          prisma.creativeTask.groupBy({ by: ["assignedToId"], where: { kind: "VIDEO", status: { not: "COMPLETED" } }, _count: { _all: true } }),
        ]);
        const c = new Map(todayCounts.map((x) => [x.userId, x.count]));
        const o = new Map(openTasks.map((x) => [x.assignedToId, x._count._all]));
        const list = editors.map((e) => ({ ...e, today: c.has(e.id) ? c.get(e.id)! : null, open: o.get(e.id) ?? 0 }));
        return { list, total: list.reduce((s, e) => s + (e.today ?? 0), 0), updated: list.filter((e) => e.today !== null).length };
      })()
    : null;

  return (
    <div className="space-y-5">
      {/* hero */}
      <div className="relative overflow-hidden rounded-[18px] px-6 py-6 text-white shadow-[var(--shadow-md)] sm:px-7" style={{ background: "linear-gradient(120deg, #14152a 0%, #231a4d 55%, #4c1d95 100%)" }}>
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(167,139,250,.35), transparent 70%)" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-white/60"><Clapperboard size={13} /> Video studio · {dateLabel}</div>
            <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight !text-white sm:text-[28px]">{greeting}, {user.name.split(" ")[0]}</h1>
            <p className="mt-1.5 text-[13.5px] text-white/75">{summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/videos" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white/10 px-3.5 text-[12.5px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20"><Clapperboard size={14} /> My Videos</Link>
            <Link href="/video-team" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white/10 px-3.5 text-[12.5px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20"><ListOrdered size={14} /> Editing Count</Link>
            <Link href="/videos/new" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white px-3.5 text-[12.5px] font-bold text-[var(--ink)] transition hover:bg-white/90"><Plus size={14} /> Add video</Link>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className="group rounded-[13px] bg-white/[.07] px-4 py-3 ring-1 ring-white/10 transition hover:bg-white/[.13]">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-white/60">{t.label}</span>
                <t.icon size={14} style={{ color: t.tone }} />
              </div>
              <div className="mt-1.5 flex items-end justify-between">
                <span className="text-[26px] font-extrabold leading-none tnum" style={{ color: t.n > 0 ? t.tone : "rgba(255,255,255,.45)" }}>{t.n}</span>
                <ArrowRight size={13} className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <MyShootsStrip userId={user.id} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        {/* left: today's count + the work */}
        <div className="min-w-0 space-y-5">
          <TodayEditCount userId={user.id} />

          <div className="card !p-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: tint("var(--rose)", 11), color: "var(--rose)" }}><Flame size={16} /></span>
                <div>
                  <div className="text-[14px] font-bold">Needs your attention</div>
                  <div className="text-[11.5px] text-[var(--muted)]">Overdue, due today and in progress — one click moves a video to its next step</div>
                </div>
              </div>
              {focusTotal > focus.length && <Link href="/videos" className="text-[12px] font-bold text-[var(--violet)] hover:underline">+{focusTotal - focus.length} more</Link>}
            </div>
            {focus.length > 0 ? (
              <div className="divide-y divide-[var(--line)]">{focus.map((r) => <TaskRow key={r.id} r={r} />)}</div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: tint("var(--emerald)", 12), color: "var(--emerald)" }}><Sparkles size={20} /></span>
                <div className="text-[14px] font-bold">You are all caught up</div>
                <div className="text-[12.5px] text-[var(--muted)]">Nothing is overdue, due today or in progress.</div>
              </div>
            )}
          </div>

          {upcoming.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: tint("var(--amber)", 13), color: "var(--amber)" }}><Clock3 size={16} /></span>
                  <div><div className="text-[14px] font-bold">Coming up next</div><div className="text-[11.5px] text-[var(--muted)]">Not started yet — earliest due date first</div></div>
                </div>
                <Link href="/videos" className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--violet)] hover:underline">All videos <ArrowRight size={12} /></Link>
              </div>
              <div className="divide-y divide-[var(--line)]">{upcoming.map((r) => <TaskRow key={r.id} r={r} />)}</div>
            </div>
          )}
        </div>

        {/* right: progress, review, team */}
        <div className="min-w-0 space-y-5">
          <div className="card card-pad">
            <div className="text-[14px] font-bold">My progress</div>
            <div className="mt-4 flex items-center gap-5">
              <div className="relative grid h-[104px] w-[104px] flex-none place-items-center rounded-full" style={{ background: `conic-gradient(var(--emerald) ${progress * 3.6}deg, var(--surface-3) 0deg)` }}>
                <div className="grid h-[80px] w-[80px] place-items-center rounded-full bg-[var(--surface)]">
                  <div className="text-center"><div className="text-[22px] font-extrabold leading-none tnum">{progress}%</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">done</div></div>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                {pipeline.map((p) => {
                  const st = STATUS[p.key];
                  return (
                    <div key={p.key}>
                      <div className="flex items-center justify-between text-[12px]"><span className="font-semibold text-[var(--ink-2)]">{st.label}</span><span className="font-extrabold tnum">{p.n}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${counts.total ? (p.n / counts.total) * 100 : 0}%`, background: st.tone }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-[10px] bg-[var(--surface-2)] px-3.5 py-2.5 text-[12.5px]">
              <span className="text-[var(--muted)]">Completed</span>
              <span className="font-bold tnum"><span className="text-[var(--emerald)]">{counts.completed}</span> of {counts.total} videos</span>
            </div>
          </div>

          <div className="card !p-0 overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-5 py-3.5">
              <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: tint("var(--violet)", 11), color: "var(--violet)" }}><Eye size={16} /></span>
              <div><div className="text-[14px] font-bold">Waiting for review</div><div className="text-[11.5px] text-[var(--muted)]">Sent — mark completed once approved</div></div>
            </div>
            {inReview.length > 0 ? (
              <div className="divide-y divide-[var(--line)]">
                {inReview.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0"><div className="truncate text-[13px] font-semibold">{r.title}</div><div className="truncate text-[11.5px] text-[var(--muted)]">{r.client} · {r.type}</div></div>
                    <form action={advanceVideoTask} className="flex-none">
                      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="COMPLETED" />
                      <button type="submit" title="Mark completed" className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--line-2)] text-[var(--emerald)] transition hover:bg-[color-mix(in_srgb,var(--emerald)_10%,white)]"><CheckCircle2 size={16} /></button>
                    </form>
                  </div>
                ))}
              </div>
            ) : <div className="px-5 py-6 text-center text-[12.5px] text-[var(--muted)]">{counts.review > 0 ? "They are listed in “Needs your attention”." : "Nothing is waiting for review."}</div>}
          </div>

          {team && (
            <div className="card !p-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: tint("var(--sky)", 12), color: "var(--sky)" }}><Users size={16} /></span>
                  <div><div className="text-[14px] font-bold">My team today</div><div className="text-[11.5px] text-[var(--muted)]">{team.total} videos · {team.updated} of {team.list.length} updated</div></div>
                </div>
                <Link href="/video-team" className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--violet)] hover:underline">Open <ArrowRight size={12} /></Link>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {team.list.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] text-[11.5px] font-extrabold" style={{ background: tint("var(--violet)", 11), color: "var(--violet)" }}>{initials(e.name)}</span>
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{e.name}{e.id === user.id ? " (me)" : ""}</div><div className="text-[11.5px] text-[var(--muted)]">{e.open} open video{e.open === 1 ? "" : "s"}</div></div>
                    {e.today !== null
                      ? <span className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: tint("var(--emerald)", 11), color: "var(--emerald)" }}>{e.today} today</span>
                      : <span className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: tint("var(--amber)", 13), color: "#92600a" }}>Not updated</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
