import Link from "next/link";
import { getCreativeTeam, getClientOptions, getAssignedByMe } from "@/lib/queries";
import { getAmHome } from "@/lib/am-dashboard-queries";
import { ownClientsOf } from "@/lib/am-scope";
import { inrShort, inr } from "@/lib/domain";
import AssignCreativeForm from "@/components/AssignCreativeForm";
import MyShootRequests from "@/components/MyShootRequests";
import AmReportDownload from "@/components/AmReportDownload";
import {
  Users, Megaphone, Target, Images, IndianRupee, TrendingUp, AlertTriangle, ArrowRight, Palette, Clapperboard,
  CheckCircle2, Clock3, Plus, ListChecks, Pencil, Briefcase, UserPlus, FileBarChart, Sparkles,
} from "lucide-react";

// Account manager's home page: greeting and the day in one line, this month's figures for
// their clients, what still has to be entered today (yesterday's ad results, today's posts),
// every client with its numbers and a monthly report to download, and the work they assigned.
// Real dates and real data only — an account manager sees the clients they manage.

const CREATIVE_STATUS_TONE: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Pending", tone: "amber" }, IN_PROGRESS: { label: "In progress", tone: "sky" },
  REVIEW: { label: "Review", tone: "violet" }, COMPLETED: { label: "Completed", tone: "emerald" },
};
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;
const fmtDay = (d: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—");

export default async function AmOverview({ user }: { user: { id: string; name: string; role: string } }) {
  const [d, creativeTeam, clientOpts, assigned] = await Promise.all([
    getAmHome(user.id, user.role),
    getCreativeTeam(),
    getClientOptions(ownClientsOf(user)), // only the clients this manager handles
    getAssignedByMe(user.id),
  ]);
  const first = user.name.split(" ")[0] || "there";
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false })) % 24;
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const t = d.totals, todo = d.todo;
  const pendingBits = [
    todo.meta.total - todo.meta.done > 0 ? `Meta results pending for ${todo.meta.total - todo.meta.done} client${todo.meta.total - todo.meta.done === 1 ? "" : "s"}` : "",
    todo.google.total - todo.google.done > 0 ? `Google results pending for ${todo.google.total - todo.google.done}` : "",
    t.creativeOverdue > 0 ? `${t.creativeOverdue} design / video task${t.creativeOverdue === 1 ? "" : "s"} overdue` : "",
  ].filter(Boolean);
  const summary = !t.clients ? "No clients are assigned to you yet — ask the admin to set you as the account manager on your clients."
    : pendingBits.length ? pendingBits.join(" · ") + "." : "Everything is up to date for today.";

  const tiles = [
    { label: d.isHead ? "Active clients" : "My clients", value: String(t.clients), sub: "active", icon: Users, tone: "#c4b5fd", href: "/clients" },
    { label: "Ad spend", value: inrShort(t.spend), sub: d.monthLabel, icon: IndianRupee, tone: "#6ee7b7", href: "/ads" },
    { label: "Leads", value: String(t.leads), sub: "Meta + Google", icon: TrendingUp, tone: "#7dd3fc", href: "/ads" },
    { label: "Cost / lead", value: t.cpl ? inr(t.cpl) : "—", sub: "this month", icon: Target, tone: "#fcd34d", href: "/ads" },
    { label: "Posts logged", value: String(t.posts), sub: d.monthLabel, icon: Images, tone: "#f9a8d4", href: "/smo" },
    { label: "Creative work", value: String(t.creativeOpen), sub: t.creativeOverdue ? `${t.creativeOverdue} overdue` : "open", icon: Palette, tone: t.creativeOverdue ? "#fda4af" : "#d8b4fe", href: "/reports/creative" },
  ];

  // "what to update today" — one line per daily job, with who is still pending
  const names = (list: string[]) => (list.length ? list.slice(0, 3).join(", ") + (list.length > 3 ? ` +${list.length - 3} more` : "") : "");
  const jobs = [
    { key: "meta", icon: Megaphone, tone: "var(--violet)", title: "Meta Ads — yesterday’s results", href: "/ads", cta: "Enter Meta results",
      total: todo.meta.total, done: todo.meta.done, none: "No client takes Meta Ads yet.", pending: names(todo.meta.pending), unit: `${d.yesterdayLabel}` },
    { key: "google", icon: Target, tone: "var(--emerald)", title: "Google Ads — yesterday’s results", href: "/google-ads", cta: "Enter Google results",
      total: todo.google.total, done: todo.google.done, none: "No client takes Google Ads yet.", pending: names(todo.google.pending), unit: `${d.yesterdayLabel}` },
    { key: "smo", icon: Images, tone: "var(--sky)", title: "SM Posts — today’s posts", href: "/smo", cta: "Log today’s posts",
      total: todo.smo.total, done: todo.smo.done, none: "No client takes SMO yet.", pending: names(todo.smo.pending), unit: `${todo.smo.postsToday} post${todo.smo.postsToday === 1 ? "" : "s"} logged today` },
  ];

  return (
    <div className="space-y-5">
      {/* hero */}
      <div className="relative overflow-hidden rounded-[18px] px-6 py-6 text-white shadow-[var(--shadow-md)] sm:px-7" style={{ background: "linear-gradient(120deg, #14152a 0%, #231a4d 55%, #4c1d95 100%)" }}>
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(167,139,250,.35), transparent 70%)" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-white/60"><Briefcase size={13} /> {user.role === "DM_EXEC" ? "Digital marketing" : d.isHead ? "AM Head" : "Account management"} · {d.todayLabel}</div>
            <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight !text-white sm:text-[28px]">{greet}, {first}</h1>
            <p className="mt-1.5 text-[13.5px] text-white/75">{summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/clients" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white/10 px-3.5 text-[12.5px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20"><Users size={14} /> My clients</Link>
            <Link href="/clients/new" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white/10 px-3.5 text-[12.5px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20"><UserPlus size={14} /> New client</Link>
            <AssignCreativeForm members={creativeTeam} clients={clientOpts.map((c) => ({ id: c.id, name: c.name }))} />
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {tiles.map((k) => (
            <Link key={k.label} href={k.href} className="group rounded-[13px] bg-white/[.07] px-4 py-3 ring-1 ring-white/10 transition hover:bg-white/[.13]">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-white/60">{k.label}</span>
                <k.icon size={14} style={{ color: k.tone }} />
              </div>
              <div className="mt-1.5 text-[24px] font-extrabold leading-none tnum" style={{ color: k.tone }}>{k.value}</div>
              <div className="mt-1 truncate text-[10.5px] text-white/55">{k.sub}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        {/* what to update today */}
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-5 py-3.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: tint("var(--amber)", 13), color: "var(--amber)" }}><ListChecks size={16} /></span>
            <div>
              <div className="text-[14px] font-bold">What to update today</div>
              <div className="text-[11.5px] text-[var(--muted)]">Enter yesterday’s ad results each morning and log the posts that go out today</div>
            </div>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {jobs.map((j) => {
              const allDone = j.total > 0 && j.done >= j.total;
              return (
                <div key={j.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px]" style={{ background: tint(j.tone, 12), color: j.tone }}><j.icon size={17} /></span>
                  <div className="min-w-0 flex-1 basis-[240px]">
                    <div className="text-[13.5px] font-bold">{j.title}</div>
                    <div className="mt-0.5 text-[12px] text-[var(--muted)]">
                      {j.total === 0 ? j.none : <><b className="text-[var(--ink-2)] tnum">{j.done} of {j.total}</b> client{j.total === 1 ? "" : "s"} done · {j.unit}{j.pending ? <> · pending: <span className="text-[var(--ink-2)]">{j.pending}</span></> : null}</>}
                    </div>
                  </div>
                  {j.total > 0 && (allDone
                    ? <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold text-[var(--emerald)]" style={{ background: tint("var(--emerald)", 11) }}><CheckCircle2 size={12} /> Done</span>
                    : <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: tint("var(--amber)", 14), color: "#92600a" }}><Clock3 size={12} /> {j.total - j.done} pending</span>)}
                  <Link href={j.href} className={j.total > 0 && !allDone ? "btn btn-violet btn-sm" : "btn btn-ghost btn-sm"}>{j.cta} <ArrowRight size={13} /></Link>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px]" style={{ background: tint("var(--rose)", 11), color: "var(--rose)" }}><Palette size={17} /></span>
              <div className="min-w-0 flex-1 basis-[240px]">
                <div className="text-[13.5px] font-bold">Design / video work for my clients</div>
                <div className="mt-0.5 text-[12px] text-[var(--muted)]"><b className="text-[var(--ink-2)] tnum">{t.creativeOpen}</b> open · <b className="tnum" style={{ color: t.creativeOverdue ? "var(--rose)" : "var(--ink-2)" }}>{t.creativeOverdue}</b> overdue · <b className="text-[var(--ink-2)] tnum">{t.creativeDone}</b> completed this month</div>
              </div>
              <Link href="/reports/creative" className="btn btn-ghost btn-sm">Creative Report <ArrowRight size={13} /></Link>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px]" style={{ background: tint("var(--indigo)", 11), color: "var(--indigo)" }}><ListChecks size={17} /></span>
              <div className="min-w-0 flex-1 basis-[240px]">
                <div className="text-[13.5px] font-bold">My tasks</div>
                <div className="mt-0.5 text-[12px] text-[var(--muted)]"><b className="text-[var(--ink-2)] tnum">{todo.tasks.open}</b> open{todo.tasks.overdue ? <> · <b className="text-[var(--rose)] tnum">{todo.tasks.overdue}</b> overdue</> : null}</div>
              </div>
              <Link href="/tasks" className="btn btn-ghost btn-sm">Open My Tasks <ArrowRight size={13} /></Link>
            </div>
          </div>
        </div>

        {/* how the work is added */}
        <div className="card card-pad">
          <div className="flex items-center gap-2 text-[14px] font-bold"><Sparkles size={16} className="text-[var(--violet)]" /> How to add your work</div>
          <ol className="mt-3 space-y-3">
            {[
              { n: 1, title: "Keep the client’s details right", text: "Open a client → Edit info: contact, services, monthly posts / reels, designer and editor.", href: "/clients", cta: "My clients" },
              { n: 2, title: "Enter ad results every morning", text: "Meta Ads and Google Ads: yesterday’s spend and leads for each client.", href: "/ads", cta: "Meta Ads" },
              { n: 3, title: "Log the posts that go out", text: "SM Posts: each post’s platform, type, link and status.", href: "/smo", cta: "SM Posts" },
              { n: 4, title: "Give work to the design / video team", text: "Assign to Design / Video team: title, client, due date and brief — they are notified.", href: "/reports/creative", cta: "Track it" },
              { n: 5, title: "Send the monthly report", text: "Download report (below) gives each client’s spend, leads, posts and creative work for the month.", href: "#clients-report", cta: "Report" },
            ].map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full text-[11.5px] font-extrabold text-white" style={{ background: "var(--violet)" }}>{s.n}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold">{s.title}</div>
                  <div className="text-[12px] leading-relaxed text-[var(--muted)]">{s.text} <a href={s.href} className="font-bold text-[var(--violet)] hover:underline">{s.cta} →</a></div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* every client, this month — and the report */}
      <div id="clients-report" className="card !p-0 scroll-mt-24 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: tint("var(--sky)", 12), color: "var(--sky)" }}><FileBarChart size={16} /></span>
            <div>
              <div className="text-[14px] font-bold">{d.isHead ? "Clients" : "My clients"} · {d.monthLabel}</div>
              <div className="text-[11.5px] text-[var(--muted)]">Spend, leads, posts and creative work this month — the client report</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AmReportDownload rows={d.rows} monthLabel={d.monthLabel} manager={user.name} />
            <Link href="/clients" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--violet)] hover:underline">All details <ArrowRight size={13} /></Link>
          </div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[1040px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                <th className="px-5 py-2.5 text-left">Client</th>
                <th className="px-3 py-2.5 text-left">Services</th>
                <th className="px-3 py-2.5 text-right">Meta spend</th>
                <th className="px-3 py-2.5 text-right">Meta leads</th>
                <th className="px-3 py-2.5 text-right">Google spend</th>
                <th className="px-3 py-2.5 text-right">Google leads</th>
                <th className="px-3 py-2.5 text-center">Posts</th>
                <th className="px-3 py-2.5 text-center">Creative</th>
                <th className="px-3 py-2.5 text-left">Yesterday</th>
                <th className="px-5 py-2.5 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => {
                const needs = (r.hasMeta && !r.metaYesterday) || (r.hasGoogle && !r.googleYesterday);
                const anyAds = r.hasMeta || r.hasGoogle;
                return (
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="max-w-[240px] px-5 py-2.5">
                      <Link href={`/clients/${r.id}`} className="block truncate font-bold hover:text-[var(--violet)]" title={r.name}>{r.name}</Link>
                      <div className="truncate text-[11.5px] text-[var(--muted)]">{[r.poc, d.isHead ? r.am : ""].filter(Boolean).join(" · ") || r.code}</div>
                    </td>
                    <td className="px-3 py-2.5"><div className="flex max-w-[220px] flex-wrap gap-1">{r.services.slice(0, 4).map((s) => <span key={s} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--ink-2)]">{s}</span>)}{r.services.length > 4 && <span className="text-[10.5px] text-[var(--muted)]">+{r.services.length - 4}</span>}{r.services.length === 0 && <span className="text-[11.5px] text-[var(--amber)]">Not set — Edit info</span>}</div></td>
                    <td className="px-3 py-2.5 text-right tnum">{r.metaSpend ? inrShort(r.metaSpend) : <span className="text-[var(--line-2)]">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-bold tnum">{r.metaLeads || <span className="font-normal text-[var(--line-2)]">—</span>}</td>
                    <td className="px-3 py-2.5 text-right tnum">{r.gSpend ? inrShort(r.gSpend) : <span className="text-[var(--line-2)]">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-bold tnum">{r.gLeads || <span className="font-normal text-[var(--line-2)]">—</span>}</td>
                    <td className="px-3 py-2.5 text-center font-bold tnum">{r.posts || <span className="font-normal text-[var(--line-2)]">—</span>}</td>
                    <td className="px-3 py-2.5 text-center text-[12px]">{r.creativeOpen || r.creativeDone ? <><b className="tnum">{r.creativeDone}</b> done · <b className="tnum" style={{ color: r.creativeOverdue ? "var(--rose)" : undefined }}>{r.creativeOpen}</b> open</> : <span className="text-[var(--line-2)]">—</span>}</td>
                    <td className="px-3 py-2.5">
                      {!anyAds ? <span className="text-[11.5px] text-[var(--faint)]">No ads</span>
                        : needs ? <Link href={r.hasMeta && !r.metaYesterday ? "/ads" : "/google-ads"} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: tint("var(--amber)", 14), color: "#92600a" }}><AlertTriangle size={11} /> Enter results</Link>
                        : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-[var(--emerald)]" style={{ background: tint("var(--emerald)", 11) }}><CheckCircle2 size={11} /> Updated</span>}
                      {r.lastUpdate && <div className="mt-0.5 text-[10.5px] text-[var(--faint)]">last {fmtDay(r.lastUpdate)}</div>}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/clients/${r.id}/edit`} title="Edit info" className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--surface-3)]"><Pencil size={13} /></Link>
                        <Link href={`/clients/${r.id}`} className="inline-flex h-8 items-center gap-1 rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 text-[12px] font-bold hover:bg-[var(--surface-3)]">Open <ArrowRight size={12} /></Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {d.rows.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-12 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]"><Users size={20} /></div>
                  <div className="mt-2 text-[14px] font-bold">No clients yet</div>
                  <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">A client shows here when you are its account manager. Add one with <Link href="/clients/new" className="font-bold text-[var(--violet)]">New client</Link>, or ask the admin to set you on your existing clients.</div>
                </td></tr>
              )}
            </tbody>
            {d.rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--line-2)] bg-[var(--surface-2)] text-[13px] font-extrabold">
                  <td className="px-5 py-3" colSpan={2}>Total · {t.clients} client{t.clients === 1 ? "" : "s"}</td>
                  <td className="px-3 py-3 text-right tnum">{inrShort(t.metaSpend)}</td>
                  <td className="px-3 py-3 text-right tnum">{t.metaLeads}</td>
                  <td className="px-3 py-3 text-right tnum">{inrShort(t.gSpend)}</td>
                  <td className="px-3 py-3 text-right tnum">{t.gLeads}</td>
                  <td className="px-3 py-3 text-center tnum">{t.posts}</td>
                  <td className="px-3 py-3 text-center text-[12px]">{t.creativeDone} done · {t.creativeOpen} open</td>
                  <td colSpan={2} className="px-5 py-3 text-right text-[12px] font-bold text-[var(--muted)]">{t.cpl ? `Cost per lead ${inr(t.cpl)}` : ""}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* shoot requests sent to Studio X — status of each */}
      <MyShootRequests userId={user.id} clients={clientOpts.map((c) => ({ id: c.id, name: c.name }))} />

      {/* creative work this AM has assigned to the design / video team */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: tint("var(--rose)", 11), color: "var(--rose)" }}><Plus size={16} /></span>
            <div>
              <div className="text-[14px] font-bold">Work I assigned</div>
              <div className="text-[11.5px] text-[var(--muted)]">{assigned.open} open · {assigned.total} total briefed to the design / video team</div>
            </div>
          </div>
          <Link href="/reports/creative" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--violet)] hover:underline">Creative Report <ArrowRight size={13} /></Link>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="border-b border-[var(--line)] bg-[var(--surface-2)]">{["Task", "Assigned to", "Client", "Type", "Due", "Status"].map((h) => <th key={h} className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{h}</th>)}</tr></thead>
            <tbody>
              {assigned.rows.map((x) => {
                const st = CREATIVE_STATUS_TONE[x.status] ?? CREATIVE_STATUS_TONE.PENDING;
                return (
                  <tr key={x.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-2.5"><div className="text-[13.5px] font-semibold">{x.title}</div><div className="text-[11px] text-[var(--faint)]">{x.code}</div></td>
                    <td className="px-5 py-2.5 text-[12.5px]"><span className="inline-flex items-center gap-1.5">{x.memberRole === "EDITOR" ? <Clapperboard size={13} className="text-[var(--rose)]" /> : <Palette size={13} className="text-[var(--amber)]" />}{x.member}</span></td>
                    <td className="px-5 py-2.5 text-[12.5px] text-[var(--ink-2)]">{x.client}</td>
                    <td className="px-5 py-2.5 text-[12.5px] text-[var(--muted)]">{x.type}</td>
                    <td className="px-5 py-2.5 text-[12px] tnum">{x.dueDate ? <span className={x.overdue ? "font-semibold text-[var(--rose)]" : "text-[var(--muted)]"}>{fmtDay(x.dueDate)}{x.overdue ? " · overdue" : ""}</span> : <span className="text-[var(--faint)]">—</span>}</td>
                    <td className="px-5 py-2.5"><span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, var(--${st.tone}) 14%, white)`, color: `var(--${st.tone})` }}>{st.label}</span></td>
                  </tr>
                );
              })}
              {assigned.rows.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--muted)]">You have not assigned any design / video work yet. Use <b className="text-[var(--ink-2)]">Assign to Design / Video team</b> at the top.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
