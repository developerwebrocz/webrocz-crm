import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayIST } from "@/lib/india-date";
import { initials } from "@/lib/domain";
import { getClientOptions } from "@/lib/queries";
import { weekStartOf, weekLabel, getMyDesignWeek } from "@/lib/design-posting-queries";
import AssignCreativeForm from "@/components/AssignCreativeForm";
import { Users, Crown, CheckCircle2, Clock3, ImageIcon, ListChecks, Palette, ArrowRight, Plus, ListOrdered, CalendarDays } from "lucide-react";

// Design team lead's dashboard: the whole design team at a glance — what each designer did
// today, this week's client postings (done / planned) and open design tasks — and the two ways
// to give work: a client's posts for the week ("Assign client") or a single design task.

const PALETTE = ["#6d28d9", "#0284c7", "#059669", "#d97706", "#e11d48", "#0d9488", "#840a92", "#4f46e5"];
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;

export default async function DesignTeamLeadBoard({ meId }: { meId: string }) {
  const today = todayIST();
  const week = weekStartOf(today);
  const [designers, todayCounts, monthCounts, postings, openTasks, clients] = await Promise.all([
    prisma.user.findMany({ where: { role: "DESIGNER", active: true }, select: { id: true, name: true, teamLead: true }, orderBy: { name: "asc" } }),
    prisma.editCount.findMany({ where: { date: today, user: { role: "DESIGNER" } }, select: { userId: true, count: true } }),
    prisma.editCount.groupBy({ by: ["userId"], where: { date: { startsWith: today.slice(0, 7) }, user: { role: "DESIGNER" } }, _sum: { count: true } }),
    prisma.designPosting.findMany({ where: { weekStart: week }, orderBy: { createdAt: "asc" } }),
    prisma.creativeTask.groupBy({ by: ["assignedToId"], where: { kind: "DESIGN", status: { not: "COMPLETED" } }, _count: { _all: true } }),
    getClientOptions(),
  ]);
  const t = new Map(todayCounts.map((x) => [x.userId, x.count]));
  const m = new Map(monthCounts.map((x) => [x.userId, x._sum.count ?? 0]));
  const tasks = new Map(openTasks.map((x) => [x.assignedToId, x._count._all]));
  const members = designers
    .map((d) => {
      const mine = postings.filter((p) => p.userId === d.id);
      return { ...d, today: t.has(d.id) ? t.get(d.id)! : null, monthTotal: m.get(d.id) ?? 0, openTasks: tasks.get(d.id) ?? 0, rows: mine, target: mine.reduce((s, p) => s + p.target, 0), done: mine.reduce((s, p) => s + p.done, 0) };
    })
    .sort((a, b) => Number(b.teamLead) - Number(a.teamLead) || a.name.localeCompare(b.name));
  const target = members.reduce((s, x) => s + x.target, 0);
  const done = members.reduce((s, x) => s + x.done, 0);
  const stats = [
    { label: "Team today", value: members.reduce((s, x) => s + (x.today ?? 0), 0), sub: `${members.filter((x) => x.today !== null).length} of ${members.length} updated`, icon: Palette, tone: "var(--violet)" },
    { label: "Posts done this week", value: done, sub: `of ${target} planned`, icon: ListChecks, tone: "var(--emerald)" },
    { label: "Posts pending", value: Math.max(0, postings.reduce((s, p) => s + Math.max(0, p.target - p.done), 0)), sub: weekLabel(week), icon: Clock3, tone: "var(--amber)" },
    { label: "Clients this week", value: postings.length, sub: postings.length ? "assigned to designers" : "not assigned yet", icon: ImageIcon, tone: "var(--sky)" },
  ];

  return (
    <div className="card !p-0 overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--violet) 22%, white)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4" style={{ background: tint("var(--violet)", 4) }}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[11px] text-white" style={{ background: "var(--grad)" }}><Users size={18} /></span>
          <div>
            <div className="flex items-center gap-1.5 text-[16px] font-extrabold tracking-tight">My team <Crown size={14} className="text-[var(--amber)]" /></div>
            <div className="text-[12px] text-[var(--muted)]">Every designer’s work — and assign a client’s posts or a design task</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AssignCreativeForm members={designers.map((d) => ({ id: d.id, name: d.name, role: "DESIGNER" }))} clients={clients.map((c) => ({ id: c.id, name: c.name }))} from="/" label="Assign design task" />
          <Link href="/design-postings?add=1" className="btn btn-violet"><Plus size={15} /> Assign client posts</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-[var(--line)] bg-[var(--line)] lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 bg-[var(--surface)] px-5 py-3.5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px]" style={{ background: tint(s.tone, 12), color: s.tone }}><s.icon size={16} /></span>
            <div className="min-w-0">
              <div className="text-[22px] font-extrabold leading-none tnum">{s.value}</div>
              <div className="mt-1 truncate text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{s.label}</div>
              <div className="truncate text-[11px] text-[var(--faint)]">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-px bg-[var(--line)]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        {members.map((mb, i) => {
          const c = PALETTE[i % PALETTE.length];
          const pct = mb.target ? Math.min(100, Math.round((mb.done / mb.target) * 100)) : 0;
          const pending = mb.rows.filter((r) => r.done < r.target);
          return (
            <div key={mb.id} className="flex flex-col bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-[12.5px] font-extrabold" style={{ background: tint(c, 14), color: c }}>{initials(mb.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-[14px] font-bold">{mb.name}{mb.id === meId ? <span className="text-[11px] font-semibold text-[var(--muted)]">(me)</span> : null}{mb.teamLead && <Crown size={12} className="flex-none text-[var(--amber)]" />}</div>
                  <div className="text-[11px] text-[var(--muted)]">{mb.monthTotal} designs this month</div>
                </div>
                {mb.today !== null
                  ? <span className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: tint("var(--emerald)", 11), color: "var(--emerald)" }}><CheckCircle2 size={12} /> {mb.today} today</span>
                  : <span className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: tint("var(--amber)", 13), color: "#92600a" }}><Clock3 size={12} /> Not updated</span>}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                {[[mb.rows.length, "Clients"], [`${mb.done}/${mb.target}`, "Posts done"], [mb.openTasks, "Design tasks"]].map(([v, l]) => (
                  <div key={l} className="rounded-[8px] bg-[var(--surface-2)] px-1 py-1.5"><div className="text-[14px] font-extrabold tnum">{v}</div><div className="text-[9.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">{l}</div></div>
                ))}
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} /></div>

              <div className="mt-3 flex-1 space-y-1.5">
                {pending.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="truncate font-semibold" title={r.clientName}>{r.clientName}</span>
                    <span className="flex-none text-[11.5px] font-bold tnum">{r.done}<span className="font-normal text-[var(--muted)]"> / {r.target}</span></span>
                  </div>
                ))}
                {pending.length > 4 && <div className="text-[11.5px] font-semibold text-[var(--muted)]">+{pending.length - 4} more pending</div>}
                {pending.length === 0 && <div className="rounded-[8px] border border-dashed border-[var(--line-2)] px-3 py-3 text-center text-[11.5px] text-[var(--muted)]">{mb.rows.length ? "All posts done this week" : "No clients assigned this week"}</div>}
              </div>

              <Link href={`/design-postings?add=${mb.id}`} className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[9px] border border-dashed border-[var(--line-2)] text-[12px] font-bold text-[var(--violet)] transition hover:border-[var(--violet)] hover:bg-[color-mix(in_srgb,var(--violet)_6%,white)]"><Plus size={13} /> Assign to {mb.name.split(" ")[0]}</Link>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t border-[var(--line)] bg-[var(--surface-2)] px-5 py-2.5 text-[12px] font-bold">
        <Link href="/design-postings" className="inline-flex items-center gap-1 text-[var(--violet)] hover:underline"><CalendarDays size={13} /> Assigned postings <ArrowRight size={12} /></Link>
        <Link href="/design-team" className="inline-flex items-center gap-1 text-[var(--violet)] hover:underline"><ListOrdered size={13} /> Team design count <ArrowRight size={12} /></Link>
      </div>
    </div>
  );
}

// A designer's own week, on their dashboard: posts done of planned, and the link to update.
export async function MyDesignWeekStrip({ userId }: { userId: string }) {
  const w = await getMyDesignWeek(userId);
  if (!w.clients) return null;
  const pct = w.target ? Math.min(100, Math.round((w.done / w.target) * 100)) : 0;
  return (
    <Link href="/design-postings" className="card card-pad flex flex-wrap items-center gap-x-5 gap-y-3 transition hover:shadow-[var(--shadow-md)]">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px]" style={{ background: tint("var(--sky)", 13), color: "var(--sky)" }}><ImageIcon size={18} /></span>
      <div className="min-w-0 flex-1 basis-[220px]">
        <div className="text-[14.5px] font-bold">My postings this week <span className="text-[12px] font-normal text-[var(--muted)]">· {w.label}</span></div>
        <div className="mt-0.5 text-[12px] text-[var(--muted)]">{w.clients} client{w.clients === 1 ? "" : "s"} · {w.pendingClients ? `${w.pendingClients} still pending` : "all done"}</div>
      </div>
      <div className="w-[190px]">
        <div className="flex items-center justify-between text-[12px]"><span className="font-extrabold tnum">{w.done} <span className="font-normal text-[var(--muted)]">of {w.target} posts</span></span><span className="font-bold tnum">{pct}%</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--emerald)" }} /></div>
      </div>
      <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--violet)]">Update <ArrowRight size={13} /></span>
    </Link>
  );
}
