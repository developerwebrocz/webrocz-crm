import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDesignerWork, canOpenDesignerWork, PERIODS } from "@/lib/designer-work-queries";
import { DESIGN_WORK_TYPES, groupByClient } from "@/lib/design-work";
import { DESIGN_TYPES, initials } from "@/lib/domain";
import { Eyebrow } from "@/components/ui";
import { Palette, Users, CalendarDays, CheckCircle2, Clock3, AlertTriangle, ExternalLink, Filter } from "lucide-react";

export const dynamic = "force-dynamic";

// Designer Work — click a designer and see everything: what they designed each day, for which
// client and how many of each kind (logo, banner, poster …), the design tasks given to them and
// who gave them, and their weekly postings. Filters: designer, period, client, design type.

const fmt = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }) : "—");
const fmtShort = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—");
const PALETTE = ["#6d28d9", "#0284c7", "#059669", "#d97706", "#e11d48", "#0d9488", "#840a92", "#4f46e5"];
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;
const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Pending", tone: "var(--muted)" }, IN_PROGRESS: { label: "In progress", tone: "var(--sky)" },
  REVIEW: { label: "Review", tone: "var(--violet)" }, COMPLETED: { label: "Completed", tone: "var(--emerald)" },
};
const TYPES = [...new Set<string>([...DESIGN_WORK_TYPES, ...DESIGN_TYPES])];

export default async function DesignWorkPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canOpenDesignerWork(user)) redirect("/");
  const sp = await searchParams;
  const q = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const d = await getDesignerWork(user, { designer: q("designer"), period: q("from") && q("to") ? "custom" : q("period"), from: q("from"), to: q("to"), client: q("client"), type: q("type") });
  const color = (name: string) => PALETTE[Math.max(0, d.designers.findIndex((x) => x.name === name)) % PALETTE.length];
  const who = d.designers.find((x) => x.id === d.designerId);
  // links keep the other filters
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(d.designerId ? { designer: d.designerId } : {}), period: d.period, ...(d.period === "custom" ? { from: d.range.from, to: d.range.to } : {}), ...(d.filters.client ? { client: d.filters.client } : {}), ...(d.filters.type ? { type: d.filters.type } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/design-work?${p.toString()}`;
  };
  const rangeLabel = d.range.from === d.range.to ? fmt(d.range.from) : `${fmtShort(d.range.from)} – ${fmtShort(d.range.to)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Design team · work log</Eyebrow>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">{who ? `${who.name}’s work` : d.all ? "Designer Work" : "My work"}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{rangeLabel} · what was designed each day, for which client, and the work that was assigned</p>
        </div>
        <Link href="/design-team" className="btn btn-ghost btn-sm">Design Count</Link>
      </div>

      {/* designers — click a person */}
      {d.all && (
        <div className="flex flex-wrap gap-2">
          <Link href={href({ designer: "" })} className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold" style={!d.designerId ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { borderColor: "var(--line-2)", color: "var(--ink-2)" }}><Users size={14} /> All designers</Link>
          {d.designers.filter((x) => x.active).map((x) => {
            const on = d.designerId === x.id; const c = color(x.name);
            return (
              <Link key={x.id} href={href({ designer: x.id })} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold" style={on ? { background: c, color: "#fff", borderColor: c } : { borderColor: tint(c, 40), color: c, background: tint(c, 6) }}>
                <span className="grid h-5 w-5 place-items-center rounded-full text-[9.5px] font-extrabold" style={{ background: on ? "rgba(255,255,255,.25)" : tint(c, 18) }}>{initials(x.name)}</span>{x.name}{x.lead ? " · Lead" : ""}
              </Link>
            );
          })}
        </div>
      )}

      {/* filters */}
      <form method="get" className="card card-pad flex flex-wrap items-end gap-3">
        {d.designerId && <input type="hidden" name="designer" value={d.designerId} />}
        <label className="block"><span className="eyebrow">Period</span>
          <select name="period" defaultValue={d.period === "custom" ? "month" : d.period} className="select mt-1 !w-auto">{PERIODS.filter((p) => p.key !== "custom").map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
        </label>
        <label className="block"><span className="eyebrow">Or from</span><input type="date" name="from" defaultValue={d.period === "custom" ? d.range.from : ""} className="input mt-1 !w-auto" /></label>
        <label className="block"><span className="eyebrow">to</span><input type="date" name="to" defaultValue={d.period === "custom" ? d.range.to : ""} className="input mt-1 !w-auto" /></label>
        <label className="block"><span className="eyebrow">Client</span><input name="client" defaultValue={d.filters.client} placeholder="Any client" className="input mt-1 !w-auto min-w-[180px]" /></label>
        <label className="block"><span className="eyebrow">Design type</span>
          <select name="type" defaultValue={d.filters.type} className="select mt-1 !w-auto"><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        </label>
        <button type="submit" className="btn btn-violet"><Filter size={14} /> Apply</button>
        <Link href={d.designerId ? `/design-work?designer=${d.designerId}` : "/design-work"} className="btn btn-ghost">Clear</Link>
      </form>

      {/* the numbers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Designs done", value: d.totals.designs, sub: `${d.totals.days} working day${d.totals.days === 1 ? "" : "s"}`, icon: Palette, tone: "var(--violet)" },
          { label: "Clients", value: d.totals.clients, sub: "worked for", icon: Users, tone: "var(--sky)" },
          { label: "Assigned — open", value: d.totals.tasksOpen, sub: d.totals.overdue ? `${d.totals.overdue} overdue` : "none overdue", icon: Clock3, tone: d.totals.overdue ? "var(--rose)" : "var(--amber)" },
          { label: "Assigned — completed", value: d.totals.tasksDone, sub: "in this period's tasks", icon: CheckCircle2, tone: "var(--emerald)" },
        ].map((k) => (
          <div key={k.label} className="card card-pad">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{k.label}<k.icon size={15} style={{ color: k.tone }} /></div>
            <div className="mt-1.5 text-[28px] font-extrabold leading-none tnum" style={{ color: k.tone }}>{k.value}</div>
            <div className="mt-1 text-[11.5px] text-[var(--muted)]">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* by type / by client / by designer */}
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: "By design type", rows: d.byType, link: (n: string) => href({ type: n }) },
          { title: "By client", rows: d.byClient, link: (n: string) => href({ client: n }) },
          ...(d.all && !d.designerId ? [{ title: "By designer", rows: d.byDesigner, link: (n: string) => href({ designer: d.designers.find((x) => x.name === n)?.id ?? "" }) }] : []),
        ].map((box) => {
          const max = Math.max(1, ...box.rows.map((r) => r.n));
          return (
            <div key={box.title} className="card !p-0 overflow-hidden">
              <div className="border-b border-[var(--line)] px-4 py-3 text-[13.5px] font-bold">{box.title}</div>
              <div className="max-h-[260px] divide-y divide-[var(--line)] overflow-y-auto scroll-thin">
                {box.rows.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">Nothing in this period.</div>}
                {box.rows.map((r) => (
                  <Link key={r.name} href={box.link(r.name)} className="block px-4 py-2 hover:bg-[var(--surface-2)]">
                    <div className="flex items-center justify-between gap-2 text-[13px]"><span className="truncate font-semibold">{r.name}</span><b className="tnum">{r.n}</b></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: box.title === "By designer" ? color(r.name) : "var(--violet)" }} /></div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* day by day */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <div className="flex items-center gap-2 text-[14px] font-bold"><CalendarDays size={16} className="text-[var(--violet)]" /> Daily work</div>
          <span className="text-[12px] text-[var(--muted)]">{d.days.length} day{d.days.length === 1 ? "" : "s"}</span>
        </div>
        {d.days.length === 0 && <div className="px-5 py-10 text-center text-[13px] text-[var(--muted)]">No work logged in this period{d.filters.client || d.filters.type ? " for these filters" : ""}.</div>}
        <div className="divide-y divide-[var(--line)]">
          {d.days.map((day) => (
            <div key={day.date} className="px-5 py-3">
              <div className="flex items-center justify-between"><span className="text-[13.5px] font-bold">{fmt(day.date)}</span><span className="text-[12.5px] text-[var(--muted)]"><b className="text-[var(--ink)] tnum">{day.total}</b> designs</span></div>
              <div className="mt-2 space-y-2">
                {day.people.map((p) => (
                  <div key={p.userId} className="rounded-[10px] border border-[var(--line)] px-3 py-2" style={{ borderLeft: `3px solid ${color(p.designer)}` }}>
                    <div className="flex items-center justify-between gap-2 text-[12.5px]"><span className="font-bold" style={{ color: color(p.designer) }}>{p.designer}</span><span className="tnum text-[var(--muted)]">{p.total} total</span></div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                      {groupByClient(p.lines.filter((l) => l.client)).map((g) => <span key={g.client}><b className="font-semibold">{g.client}</b> <span className="text-[var(--muted)]">— {g.parts}</span></span>)}
                      {p.lines.some((l) => !l.client) && <span className="text-[var(--muted)]">{p.lines.filter((l) => !l.client).reduce((s, l) => s + l.count, 0)} designs · client not given</span>}
                    </div>
                    {p.note && <div className="mt-1 text-[11.5px] text-[var(--faint)]">Note: {p.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* assigned work */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <div className="text-[14px] font-bold">Assigned work — who gave it</div>
          <span className="text-[12px] text-[var(--muted)]">{d.tasks.length} task{d.tasks.length === 1 ? "" : "s"} · open ones of any date included</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead><tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              {["Assigned on", ...(d.designerId ? [] : ["Designer"]), "Work", "Client", "Type", "Assigned by", "Due", "Status"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
            </tr></thead>
            <tbody>
              {d.tasks.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">No design work assigned in this period.</td></tr>}
              {d.tasks.map((t) => {
                const st = STATUS[t.status] ?? STATUS.PENDING;
                return (
                  <tr key={t.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="whitespace-nowrap px-4 py-2.5 tnum">{fmtShort(t.assignedDate)}</td>
                    {!d.designerId && <td className="px-4 py-2.5 font-semibold" style={{ color: color(t.designer) }}>{t.designer}</td>}
                    <td className="px-4 py-2.5"><div className="font-semibold">{t.title}</div><div className="text-[11px] text-[var(--faint)]">{t.code}{t.finalLink && <> · <a href={t.finalLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[var(--violet)] hover:underline"><ExternalLink size={10} /> Final</a></>}</div></td>
                    <td className="px-4 py-2.5">{t.client || <span className="text-[var(--faint)]">—</span>}</td>
                    <td className="px-4 py-2.5 text-[var(--ink-2)]">{t.type}</td>
                    <td className="px-4 py-2.5 font-semibold">{t.by || <span className="font-normal text-[var(--faint)]">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tnum">{t.dueDate ? <span className={t.overdue ? "font-bold text-[var(--rose)]" : ""}>{fmtShort(t.dueDate)}{t.overdue ? " · overdue" : ""}</span> : <span className="text-[var(--faint)]">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-2.5"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: tint(st.tone, 13), color: st.tone }}>{st.label}</span>{t.doneOn && <span className="ml-1.5 text-[11px] text-[var(--muted)]">{fmtShort(t.doneOn)}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* weekly postings */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <div className="text-[14px] font-bold">Weekly postings</div>
          <span className="text-[12px] text-[var(--muted)]">{d.postings.length} line{d.postings.length === 1 ? "" : "s"}</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead><tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              {["Week of", ...(d.designerId ? [] : ["Designer"]), "Client", "Posts this week", "Done", "Updated by"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
            </tr></thead>
            <tbody>
              {d.postings.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">No weekly postings in this period.</td></tr>}
              {d.postings.map((p) => (
                <tr key={p.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 tnum">{fmtShort(p.weekStart)}</td>
                  {!d.designerId && <td className="px-4 py-2.5 font-semibold" style={{ color: color(p.designer) }}>{p.designer}</td>}
                  <td className="px-4 py-2.5">{p.client}</td>
                  <td className="px-4 py-2.5 tnum">{p.target}</td>
                  <td className="px-4 py-2.5 tnum"><b style={{ color: p.done >= p.target && p.target > 0 ? "var(--emerald)" : "var(--ink)" }}>{p.done}</b>{p.target > 0 && p.done < p.target && <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] text-[var(--amber)]"><AlertTriangle size={10} /> {p.target - p.done} left</span>}</td>
                  <td className="px-4 py-2.5 text-[var(--ink-2)]">{p.by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
