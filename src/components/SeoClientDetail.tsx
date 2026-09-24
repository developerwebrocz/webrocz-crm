"use client";

import { useMemo, useState } from "react";
import { initials } from "@/lib/domain";
import { addSeoItem, importSeoItems, setSeoItemStatus, deleteSeoItem, toggleBlogStage, saveBlogSlot, addBlogSlot, deleteBlogSlot, saveSeoReport } from "@/app/actions";
import {
  ArrowLeft, FileText, Link2, TrendingUp, MapPin, Search as SearchIcon, BarChart3,
  UserRound, UserCog, ExternalLink, Globe, Users, ChevronDown, MousePointerClick, Eye, Target, Gauge, CircleCheck, CalendarRange, RotateCcw,
  Plus, Upload, Trash2, Check, X, Image as ImageIcon, Send, Flag, CalendarClock,
} from "lucide-react";

type Item = { id: string; category: string; title: string; status: string; date: string; by: string; keyword: string | null; prev: number | null; curr: number | null; proofLink: string | null };
type BlogSlot = { id: string; slot: number; writer: string; blog: string; image: string; web: string; title: string; link: string };
type Data = {
  client: { id: string; name: string; code: string; status: string; industry: string | null; website: string | null };
  am: string | null; seoStaff: string[]; team: { name: string; role: string }[]; canEdit: boolean;
  month: string; months: { key: string; label: string }[];
  targets: { priority: string; schedule: string; blogTarget: number; backlinkTarget: number; keywordTarget: number; gscLink: string; gaLink: string };
  blogSlots: BlogSlot[];
  blogStats: { target: number; written: number; images: number; live: number; pending: number; pct: number };
  da: number;
  monthly: { month: string; label: string; clicks: number; impressions: number; ctr: number; position: number; active: number; newUsers: number; organicSocial: number; organicSearch: number }[];
  report: { reportDate: string; status: string; gscDone: boolean; gaDone: boolean; assigned: string; keywordStatus: string; note: string } | null;
  summary: {
    blog: { done: number; pending: number; total: number; target: number };
    backlink: { done: number; pending: number; total: number };
    ranking: { total: number; improved: number; avgGain: number };
    localseo: { done: number; pending: number; total: number };
    audit: { done: number; pending: number; total: number };
  };
  analytics: { gsc: { clicks: number; impressions: number; ctr: number; position: number }; ga: { users: number; sessions: number; bounce: number; conversions: number } } | null;
  items: Item[];
};

const isDone = (s: string) => s === "COMPLETED" || s === "APPROVED";
const nf = (n: number) => n.toLocaleString("en-IN");

const TABS = [
  { key: "blog", label: "Blogs", icon: FileText, tone: "violet" },
  { key: "backlink", label: "Backlinks", icon: Link2, tone: "sky" },
  { key: "ranking", label: "Keywords", icon: TrendingUp, tone: "emerald" },
  { key: "localseo", label: "Local SEO", icon: MapPin, tone: "amber" },
  { key: "gsc", label: "Search Console", icon: SearchIcon, tone: "rose" },
  { key: "ga", label: "Analytics", icon: BarChart3, tone: "indigo" },
  { key: "monthly", label: "Monthly Data", icon: CalendarRange, tone: "sky" },
  { key: "report", label: "Report", icon: Send, tone: "magenta" },
] as const;

const PRIORITY_TONE: Record<string, string> = { A: "rose", B: "amber", C: "sky" };

export default function SeoClientDetail({ data, inline = false }: { data: Data; inline?: boolean }) {
  const { client, am, seoStaff, team, canEdit, month, months, targets, blogSlots, blogStats, da, monthly, report, summary, analytics, items } = data;
  const initialTab = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab");
  const [tab, setTab] = useState<string>(initialTab && TABS.some((t) => t.key === initialTab) ? initialTab : "blog");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const list = useMemo(() => items.filter((i) => {
    if (i.category !== tab) return false;
    const d = i.date.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }), [items, tab, from, to]);
  const isWorkTab = ["backlink", "ranking", "localseo"].includes(tab);
  const monthHref = (v: string) => inline ? `/seo?client=${client.id}&month=${v}` : `/seo/${client.id}?month=${v}`;

  return (
    <div className="space-y-5">
      {!inline && <a href="/seo" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Back to SEO performance</a>}

      {/* header */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-extrabold tracking-tight">{client.name}</h1>
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-bold tnum text-[var(--muted)]">{client.code}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${client.status === "ACTIVE" ? "bg-[color-mix(in_srgb,var(--emerald)_14%,white)] text-[var(--emerald)]" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>{client.status}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[var(--muted)]">
              {client.industry && <span>{client.industry}</span>}
              {client.website && <a href={`https://${client.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--violet)]"><Globe size={13} /> {client.website}</a>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Person icon={UserCog} label="Account Manager" name={am ?? "—"} tone="violet" />
            <Person icon={UserRound} label="SEO Employee" name={seoStaff.length ? seoStaff.join(", ") : "Unassigned"} tone="emerald" />
            {/* month selector — full-page nav so data is re-fetched for that month */}
            <label className="relative inline-flex items-center">
              <span className="pointer-events-none absolute -top-2 left-2.5 bg-[var(--surface)] px-1 text-[9px] font-bold uppercase tracking-wide text-[var(--faint)]">Month</span>
              <select value={month} onChange={(e) => window.location.assign(monthHref(e.target.value))}
                className="appearance-none rounded-xl border border-[var(--line-2)] bg-[var(--surface)] py-2.5 pl-3 pr-9 text-[13px] font-semibold outline-none focus:border-[var(--violet)]">
                {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            </label>
          </div>
        </div>

        {/* monthly targets & schedule — mirrors the SEO Clients Data sheet */}
        <div className="mt-4 grid gap-2.5 border-t border-[var(--line)] pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <TargetCell label="Priority" value={targets.priority || "—"} tone={PRIORITY_TONE[targets.priority] ?? "slate"} big />
          <TargetCell label="Blogs / mo" value={targets.blogTarget || "—"} tone="violet" big />
          <TargetCell label="Backlinks / mo" value={targets.backlinkTarget || "—"} tone="sky" big />
          <TargetCell label="Keywords" value={targets.keywordTarget || "—"} tone="emerald" big />
          <div className="rounded-xl border border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-2 sm:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--faint)]">Work schedule</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink-2)]"><CalendarClock size={13} className="text-[var(--muted)]" /> {targets.schedule || "—"}</div>
          </div>
        </div>
        {(targets.gscLink || targets.gaLink) && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {targets.gscLink && <a href={targets.gscLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ink-2)] hover:border-[var(--rose)]"><SearchIcon size={13} className="text-[var(--rose)]" /> Search Console <ExternalLink size={11} /></a>}
            {targets.gaLink && <a href={targets.gaLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ink-2)] hover:border-[var(--indigo)]"><BarChart3 size={13} className="text-[var(--indigo)]" /> Analytics <ExternalLink size={11} /></a>}
          </div>
        )}

        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]"><Users size={13} /> Team handling this client</div>
          <div className="flex flex-wrap gap-2">
            {team.map((m) => (
              <div key={m.name + m.role} className="inline-flex items-center gap-2.5 rounded-full border border-[var(--line-2)] bg-[var(--surface-2)] py-1.5 pl-1.5 pr-3.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[var(--magenta)] to-[var(--indigo)] text-[11px] font-bold text-white">{initials(m.name)}</span>
                <span className="leading-tight"><span className="block text-[12.5px] font-semibold">{m.name}</span><span className="block text-[10.5px] text-[var(--muted)]">{m.role}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold transition ${on ? "border-transparent bg-[var(--violet)] text-white shadow-sm" : "border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}>
              <t.icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* date-range filter (applies to the work tabs' items) */}
      {isWorkTab && (
        <div className="card flex flex-wrap items-center gap-3 p-3">
          <span className="inline-flex items-center gap-2 pl-1 text-[12.5px] font-bold text-[var(--ink-2)]"><CalendarRange size={15} className="text-[var(--muted)]" /> Date filter</span>
          <label className="inline-flex items-center gap-2 text-[12px] text-[var(--muted)]">From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--violet)]" />
          </label>
          <label className="inline-flex items-center gap-2 text-[12px] text-[var(--muted)]">To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--violet)]" />
          </label>
          {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[12px] font-semibold text-[var(--violet)] hover:underline"><RotateCcw size={13} /> Clear dates</button>}
          <span className="ml-auto text-[12px] text-[var(--muted)] tnum">{list.length} shown</span>
        </div>
      )}

      {/* tab content */}
      {tab === "blog" && (
        <BlogGrid clientId={client.id} month={month} slots={blogSlots} stats={blogStats} canEdit={canEdit} />
      )}
      {tab === "monthly" && (
        <MonthlyTable rows={monthly} da={da} name={client.name} />
      )}
      {tab === "report" && (
        <ReportCard clientId={client.id} month={month} report={report} canEdit={canEdit} inline={inline} />
      )}
      {tab === "backlink" && (
        <TabWork category="backlink" clientId={client.id} canEdit={canEdit} monthKey={month}
          stats={[["Backlinks built", summary.backlink.done, "sky"], ["Pending", summary.backlink.pending, "amber"], ["Total", summary.backlink.total, "violet"]]}
          columns={["Backlink", "Proof", "By", "Date", "Status"]} list={list} render={(i) => [i.title, i.proofLink ? <a key="p" href={i.proofLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--violet)] hover:underline">Open <ExternalLink size={12} /></a> : "—", i.by, dt(i.date), <StatusBadge key="s" s={i.status} />]} empty="No backlinks this month." />
      )}
      {tab === "ranking" && (
        <TabWork category="ranking" clientId={client.id} canEdit={canEdit} monthKey={month}
          stats={[["Keywords tracked", summary.ranking.total, "emerald"], ["Improved", summary.ranking.improved, "violet"], ["Avg. rank gain", `+${summary.ranking.avgGain}`, "sky"]]}
          columns={["Keyword", "Movement", "Change", "By", "Date"]} list={list}
          render={(i) => [
            <span key="k" className="font-semibold">{i.keyword}</span>,
            <span key="m" className="tnum text-[var(--muted)]">#{i.prev} → <b className="text-[var(--emerald)]">#{i.curr}</b></span>,
            <span key="c" className="inline-flex items-center gap-1 font-bold text-[var(--emerald)]"><TrendingUp size={13} /> {(i.prev ?? 0) - (i.curr ?? 0)}</span>,
            i.by, dt(i.date),
          ]} empty="No keyword updates this month." />
      )}
      {tab === "localseo" && (
        <TabWork category="localseo" clientId={client.id} canEdit={canEdit} monthKey={month}
          stats={[["Completed", summary.localseo.done, "amber"], ["Pending", summary.localseo.pending, "violet"], ["Total", summary.localseo.total, "emerald"]]}
          columns={["Task", "By", "Date", "Status"]} list={list} render={(i) => [i.title, i.by, dt(i.date), <StatusBadge key="s" s={i.status} />]} empty="No local SEO tasks this month." />
      )}
      {tab === "gsc" && (
        <MetricPanel title="Google Search Console" subtitle="Organic search performance from Google." data={analytics && [
          { icon: MousePointerClick, tone: "rose", label: "Total clicks", value: nf(analytics.gsc.clicks) },
          { icon: Eye, tone: "violet", label: "Impressions", value: nf(analytics.gsc.impressions) },
          { icon: Target, tone: "emerald", label: "Avg. CTR", value: `${analytics.gsc.ctr}%` },
          { icon: Gauge, tone: "sky", label: "Avg. position", value: analytics.gsc.position },
        ]} />
      )}
      {tab === "ga" && (
        <MetricPanel title="Google Analytics" subtitle="Website traffic & conversions." data={analytics && [
          { icon: Users, tone: "indigo", label: "Users", value: nf(analytics.ga.users) },
          { icon: BarChart3, tone: "violet", label: "Sessions", value: nf(analytics.ga.sessions) },
          { icon: Gauge, tone: "amber", label: "Bounce rate", value: `${analytics.ga.bounce}%` },
          { icon: CircleCheck, tone: "emerald", label: "Conversions", value: nf(analytics.ga.conversions) },
        ]} />
      )}
    </div>
  );
}

function dt(iso: string) { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }); }

function StatusBadge({ s }: { s: string }) {
  return <span className={`badge ${isDone(s) ? "badge-emerald" : "badge-amber"}`}>{isDone(s) ? "Completed" : "Pending"}</span>;
}

const ADD_LABEL: Record<string, string> = { blog: "blog", backlink: "backlink", ranking: "keyword", localseo: "local SEO task", audit: "audit" };
const IMPORT_HINT: Record<string, string> = {
  blog: "One blog title per line.",
  backlink: "One per line — domain or URL, then a comma and the proof link. e.g.  medium.com, https://medium.com/xyz",
  ranking: "One per line — keyword, from position, to position. e.g.  best cafe hyderabad, 22, 6",
  localseo: "One task per line (e.g. GBP post, NAP citation).",
  audit: "One audit note per line.",
};

function TabWork({ stats, columns, list, render, empty, category, clientId, canEdit, monthKey }: {
  stats: [string, React.ReactNode, string][]; columns: string[]; list: Item[];
  render: (i: Item) => React.ReactNode[]; empty: string;
  category: string; clientId: string; canEdit: boolean; monthKey: string;
}) {
  const [panel, setPanel] = useState<"none" | "add" | "import">("none");
  const defDate = `${monthKey}-15`;
  const cols = canEdit ? [...columns, ""] : columns;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(([label, value, tone]) => (
          <div key={label} className="card card-pad">
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: `var(--${tone})` }}>{label}</div>
            <div className="mt-1.5 text-[28px] font-extrabold leading-none tracking-tight tnum">{value}</div>
          </div>
        ))}
      </div>

      {/* edit toolbar */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setPanel(panel === "add" ? "none" : "add")} className="btn btn-violet !py-2"><Plus size={15} /> Add {ADD_LABEL[category]}</button>
          <button onClick={() => setPanel(panel === "import" ? "none" : "import")} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] font-semibold hover:border-[var(--ink)]"><Upload size={15} /> Import from Excel</button>
        </div>
      )}

      {/* add form */}
      {canEdit && panel === "add" && (
        <form action={addSeoItem} className="card card-pad grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="category" value={category} />
          {category === "ranking" ? (
            <>
              <Field label="Keyword"><input name="keyword" required className="sfld" placeholder="e.g. best cafe near me" /></Field>
              <Field label="From position"><input name="prev" type="number" className="sfld" placeholder="e.g. 22" /></Field>
              <Field label="To position"><input name="curr" type="number" className="sfld" placeholder="e.g. 6" /></Field>
              <Field label="Date"><input name="date" type="date" defaultValue={defDate} className="sfld" /></Field>
            </>
          ) : (
            <>
              <div className="lg:col-span-2"><Field label={category === "backlink" ? "Backlink (domain / title)" : "Title"}><input name="title" required className="sfld" placeholder={category === "backlink" ? "e.g. medium.com" : "e.g. blog title"} /></Field></div>
              {category === "backlink" && <div className="lg:col-span-2"><Field label="Proof link"><input name="proofLink" className="sfld" placeholder="https://…" /></Field></div>}
              <Field label="Date"><input name="date" type="date" defaultValue={defDate} className="sfld" /></Field>
              <Field label="Status"><select name="status" className="sfld" defaultValue="DONE"><option value="DONE">Completed</option><option value="PENDING">Pending</option></select></Field>
            </>
          )}
          <div className="col-span-full flex justify-end gap-2">
            <button type="button" onClick={() => setPanel("none")} className="rounded-xl border border-[var(--line-2)] px-4 py-2 text-[13px] font-semibold hover:border-[var(--ink)]">Cancel</button>
            <button type="submit" className="btn btn-violet">Save</button>
          </div>
        </form>
      )}

      {/* import form */}
      {canEdit && panel === "import" && (
        <form action={importSeoItems} className="card card-pad space-y-3">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="date" value={defDate} />
          <div>
            <div className="text-[13px] font-bold">Import {ADD_LABEL[category]}s from Excel</div>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">Copy the cells from Excel and paste below. {IMPORT_HINT[category]}</p>
          </div>
          <textarea name="rows" rows={6} required className="sfld resize-none font-mono !text-[12.5px]" placeholder={category === "ranking" ? "best cafe hyderabad, 22, 6\ntop bakery, 30, 12" : category === "backlink" ? "medium.com, https://medium.com/xyz\nquora.com, https://quora.com/abc" : "First item\nSecond item"} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPanel("none")} className="rounded-xl border border-[var(--line-2)] px-4 py-2 text-[13px] font-semibold hover:border-[var(--ink)]">Cancel</button>
            <button type="submit" className="btn btn-violet"><Upload size={15} /> Import all</button>
          </div>
        </form>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{cols.map((h, idx) => <th key={idx} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  {render(i).map((cell, idx) => <td key={idx} className="px-5 py-3 text-[13px]">{cell}</td>)}
                  {canEdit && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <form action={setSeoItemStatus}>
                          <input type="hidden" name="id" value={i.id} /><input type="hidden" name="clientId" value={clientId} />
                          <input type="hidden" name="status" value={isDone(i.status) ? "PENDING" : "DONE"} />
                          <button title={isDone(i.status) ? "Mark pending" : "Mark completed"} className={`grid h-7 w-7 place-items-center rounded-md border ${isDone(i.status) ? "border-[var(--line-2)] text-[var(--muted)] hover:border-[var(--ink)]" : "border-[var(--emerald)]/40 text-[var(--emerald)] hover:bg-[color-mix(in_srgb,var(--emerald)_10%,white)]"}`}>{isDone(i.status) ? <X size={14} /> : <Check size={14} />}</button>
                        </form>
                        <form action={deleteSeoItem}>
                          <input type="hidden" name="id" value={i.id} /><input type="hidden" name="clientId" value={clientId} />
                          <button title="Delete" className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--muted)] hover:border-[var(--rose)] hover:text-[var(--rose)]"><Trash2 size={13} /></button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={cols.length} className="px-5 py-12 text-center text-sm text-[var(--muted)]">{empty}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">{label}</span>{children}</label>;
}

function MetricPanel({ title, subtitle, data }: { title: string; subtitle: string; data: { icon: typeof Users; tone: string; label: string; value: React.ReactNode }[] | null }) {
  return (
    <div className="space-y-4">
      <div><h2 className="text-[16px] font-bold">{title}</h2><p className="text-[12.5px] text-[var(--muted)]">{subtitle}</p></div>
      {!data ? <div className="card card-pad text-center text-sm text-[var(--muted)]">No data connected for this month.</div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.map((m) => (
            <div key={m.label} className="card card-pad">
              <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, var(--${m.tone}) 12%, white)`, color: `var(--${m.tone})` }}><m.icon size={19} /></span>
              <div className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">{m.label}</div>
              <div className="mt-1 text-[26px] font-extrabold leading-none tracking-tight tnum">{m.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TargetCell({ label, value, tone, big }: { label: string; value: React.ReactNode; tone: string; big?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--faint)]">{label}</div>
      <div className={`mt-0.5 font-extrabold tnum ${big ? "text-[18px]" : "text-[13px]"}`} style={{ color: `var(--${tone})` }}>{value}</div>
    </div>
  );
}

// ===== Blog slot grid — 8 slots × 3 stages (Blog · Image · Website), the heart of the sheet =====
const STAGE_ON: Record<string, string> = { blog: "PUBLISHED", image: "DONE", web: "LIVE" };
function BlogGrid({ clientId, month, slots, stats, canEdit }: { clientId: string; month: string; slots: BlogSlot[]; stats: Data["blogStats"]; canEdit: boolean }) {
  const [addWriter, setAddWriter] = useState("");
  return (
    <div className="space-y-4">
      {/* stat strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatBox label="Target" value={stats.target} tone="violet" icon={FileText} />
        <StatBox label="Blogs written" value={stats.written} tone="emerald" icon={CircleCheck} />
        <StatBox label="Images done" value={stats.images} tone="sky" icon={ImageIcon} />
        <StatBox label="Website live" value={stats.live} tone="indigo" icon={Globe} />
        <div className="card card-pad">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--amber)]">Completion</span>
            <span className="text-[15px] font-extrabold tnum">{stats.pct}%</span>
          </div>
          <div className="mt-2 track"><span style={{ width: `${stats.pct}%` }} /></div>
          <div className="mt-1.5 text-[11.5px] text-[var(--muted)] tnum">{stats.pending} pending</div>
        </div>
      </div>

      {/* slot table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["#", "Blog title", "Writer", "Blog", "Image", "Website", canEdit ? "" : null].filter((h) => h !== null).map((h, idx) => <th key={idx} className="th px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {slots.map((sl) => (
                <tr key={sl.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 text-[12px] font-bold text-[var(--muted)] tnum">{sl.slot}</td>
                  <td className="px-4 py-3 text-[13px]">{sl.title ? (sl.link ? <a href={sl.link} target="_blank" rel="noreferrer" className="font-semibold text-[var(--ink)] hover:text-[var(--violet)]">{sl.title}</a> : <span className="font-medium">{sl.title}</span>) : <span className="text-[var(--faint)]">Blog {sl.slot}</span>}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[var(--muted)]">{sl.writer || "—"}</td>
                  <StageCell clientId={clientId} slot={sl} field="blog" canEdit={canEdit} />
                  <StageCell clientId={clientId} slot={sl} field="image" canEdit={canEdit} />
                  <StageCell clientId={clientId} slot={sl} field="web" canEdit={canEdit} />
                  {canEdit && (
                    <td className="px-4 py-3">
                      <form action={deleteBlogSlot}>
                        <input type="hidden" name="id" value={sl.id} /><input type="hidden" name="clientId" value={clientId} />
                        <button title="Remove slot" className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--muted)] hover:border-[var(--rose)] hover:text-[var(--rose)]"><Trash2 size={13} /></button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
              {slots.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No blog slots for this month yet.{canEdit && " Add one below."}</td></tr>}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <form action={addBlogSlot} className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
            <input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="month" value={month} />
            <input name="writer" value={addWriter} onChange={(e) => setAddWriter(e.target.value)} placeholder="Writer (optional)" className="sfld max-w-[200px] !bg-[var(--surface)]" />
            <button type="submit" className="btn btn-violet btn-sm"><Plus size={14} /> Add blog slot</button>
            <span className="text-[12px] text-[var(--muted)]">Tap the Blog / Image / Website cells to mark progress.</span>
          </form>
        )}
      </div>
    </div>
  );
}

function StageCell({ clientId, slot, field, canEdit }: { clientId: string; slot: BlogSlot; field: "blog" | "image" | "web"; canEdit: boolean }) {
  const val = slot[field];
  const on = val === STAGE_ON[field];
  const label = on ? val.charAt(0) + val.slice(1).toLowerCase() : "Pending";
  const chip = (
    <span className={`badge ${on ? "badge-emerald" : "badge-amber"} !px-2.5`}>
      {on ? <Check size={12} /> : null} {label}
    </span>
  );
  if (!canEdit) return <td className="px-4 py-3">{chip}</td>;
  return (
    <td className="px-4 py-3">
      <form action={toggleBlogStage}>
        <input type="hidden" name="id" value={slot.id} /><input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="field" value={field} />
        <button title={`Toggle ${field}`} className="transition hover:opacity-80">{chip}</button>
      </form>
    </td>
  );
}

function StatBox({ label, value, tone, icon: Icon }: { label: string; value: React.ReactNode; tone: string; icon: typeof FileText }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: `var(--${tone})` }}>{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, var(--${tone}) 12%, white)`, color: `var(--${tone})` }}><Icon size={15} /></span>
      </div>
      <div className="mt-1.5 text-[28px] font-extrabold leading-none tracking-tight tnum">{value}</div>
    </div>
  );
}

// ===== Monthly report card — report delivery status, editable =====
function ReportCard({ clientId, month, report, canEdit, inline }: { clientId: string; month: string; report: Data["report"]; canEdit: boolean; inline: boolean }) {
  const [edit, setEdit] = useState(false);
  const sent = report?.status === "SENT";
  if (edit && canEdit) {
    return (
      <form action={saveSeoReport} className="card card-pad grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="month" value={month} />
        <input type="hidden" name="back" value={inline ? `/seo?client=${clientId}&tab=report` : `/seo/${clientId}?tab=report`} />
        <Field label="Report date (e.g. 1st / 10th)"><input name="reportDate" defaultValue={report?.reportDate ?? ""} className="sfld" placeholder="10th" /></Field>
        <Field label="Status"><select name="status" defaultValue={report?.status ?? "PENDING"} className="sfld"><option value="PENDING">Pending</option><option value="SENT">Sent</option></select></Field>
        <Field label="Prepared by"><input name="assigned" defaultValue={report?.assigned ?? ""} className="sfld" placeholder="e.g. Bhanu" /></Field>
        <Field label="Keyword positions"><select name="keywordStatus" defaultValue={report?.keywordStatus ?? ""} className="sfld"><option value="">—</option><option value="Done">Done</option><option value="Pending">Pending</option></select></Field>
        <label className="flex items-center gap-2 text-[13px] font-semibold"><input type="checkbox" name="gscDone" defaultChecked={report?.gscDone} className="h-4 w-4 accent-[var(--violet)]" /> Search Console updated</label>
        <label className="flex items-center gap-2 text-[13px] font-semibold"><input type="checkbox" name="gaDone" defaultChecked={report?.gaDone} className="h-4 w-4 accent-[var(--violet)]" /> Analytics updated</label>
        <div className="sm:col-span-2"><Field label="Note"><input name="note" defaultValue={report?.note ?? ""} className="sfld" placeholder="Optional note" /></Field></div>
        <div className="col-span-full flex justify-end gap-2">
          <button type="button" onClick={() => setEdit(false)} className="rounded-xl border border-[var(--line-2)] px-4 py-2 text-[13px] font-semibold hover:border-[var(--ink)]">Cancel</button>
          <button type="submit" className="btn btn-violet">Save report status</button>
        </div>
      </form>
    );
  }
  return (
    <div className="card card-pad space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`badge ${sent ? "badge-emerald" : "badge-amber"} !text-[12px] !px-3 !py-1`}>{sent ? <><Check size={13} /> Report sent</> : <><Flag size={12} /> Pending</>}</span>
          {report?.reportDate && <span className="text-[13px] text-[var(--muted)]">Due <b className="text-[var(--ink-2)]">{report.reportDate}</b> of the month</span>}
        </div>
        {canEdit && <button onClick={() => setEdit(true)} className="btn btn-ghost btn-sm">Update status</button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Search Console" ok={report?.gscDone} />
        <MiniStat label="Analytics" ok={report?.gaDone} />
        <MiniStat label="Keyword positions" text={report?.keywordStatus || "—"} ok={report?.keywordStatus === "Done"} />
        <div className="rounded-xl border border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--faint)]">Prepared by</div>
          <div className="mt-0.5 text-[13px] font-semibold">{report?.assigned || "—"}</div>
        </div>
      </div>
      {report?.note && <p className="text-[12.5px] text-[var(--muted)]">{report.note}</p>}
      {!report && <p className="text-[13px] text-[var(--muted)]">No report logged for this month yet.{canEdit && " Click “Update status” to add one."}</p>}
    </div>
  );
}

function MiniStat({ label, ok, text }: { label: string; ok?: boolean; text?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--faint)]">{label}</div>
      <div className={`mt-0.5 inline-flex items-center gap-1.5 text-[13px] font-semibold ${ok ? "text-[var(--emerald)]" : "text-[var(--muted)]"}`}>
        {text ? text : ok ? <><Check size={13} /> Done</> : <><X size={13} /> Pending</>}
      </div>
    </div>
  );
}

// Month-by-month GSC + GA + DA table (mirrors the SEO team's monthly report sheet).
function MonthlyTable({ rows, da, name }: { rows: Data["monthly"]; da: number; name: string }) {
  const fmtK = (n: number) => (n >= 1000 ? (n / 1000).toFixed(2).replace(/\.00$/, "") + "k" : String(n));
  const dash = (n: number) => (n ? n.toLocaleString("en-IN") : "—");
  const grp: React.CSSProperties = { padding: 8, border: "1px solid var(--line-2)", fontWeight: 700, fontSize: 12 };
  const sub: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--line-2)", fontWeight: 600, fontSize: 11, background: "color-mix(in srgb, var(--emerald) 10%, white)", color: "var(--emerald)" };
  const cell: React.CSSProperties = { padding: 10, border: "1px solid var(--line-2)", fontSize: 13 };
  // value + month-over-month trend (▲/▼ with the difference). invert=true → lower is better (Avg Position).
  const tv = (cur: number, prev: number | undefined, kind: "int" | "k" | "pct" | "pos", invert = false) => {
    const txt = kind === "k" ? (cur ? fmtK(cur) : "—") : kind === "pct" ? (cur ? `${cur}%` : "—") : kind === "pos" ? (cur || "—") : dash(cur);
    if (prev == null || cur === 0) return <span style={{ fontWeight: 600 }}>{txt}</span>;
    const delta = +(cur - prev).toFixed(kind === "pct" || kind === "pos" ? 1 : 0);
    const good = delta === 0 ? null : invert ? delta < 0 : delta > 0;
    const dtxt = Math.abs(delta) >= 1000 ? (Math.abs(delta) / 1000).toFixed(1) + "k" : Math.abs(delta);
    return (<><div style={{ fontWeight: 600 }}>{txt}</div>{delta !== 0 && <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2, color: good ? "var(--emerald)" : "var(--rose)" }}>{good ? "▲" : "▼"} {dtxt}</div>}</>);
  };
  return (
    <div className="space-y-3">
      <div><h2 className="text-[16px] font-bold">Monthly performance</h2><p className="text-[12.5px] text-[var(--muted)]">Search Console · Analytics · DA, month by month · <span className="font-semibold">▲ up / ▼ down vs previous month</span> — {name}</p></div>
      <div className="card !p-0 overflow-x-auto scroll-thin">
        <table className="w-full min-w-[900px] border-collapse text-center">
          <thead>
            <tr>
              <th style={sub} rowSpan={2}>Month</th>
              <th style={{ ...grp, background: "#FEF3C7", color: "#854D0E" }} colSpan={4}>Google Search Console</th>
              <th style={{ ...grp, background: "#FFEDD5", color: "#9A3412" }} colSpan={4}>Google Analytics</th>
              <th style={{ ...grp, background: "color-mix(in srgb, var(--emerald) 14%, white)", color: "var(--emerald)" }} rowSpan={2}>DA</th>
            </tr>
            <tr>{["Total Clicks", "Total Impressions", "Avg. CTR (%)", "Avg. Position", "Active Users", "New Users", "Organic Social", "Organic Search"].map((h) => <th key={h} style={sub}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const p = i > 0 ? rows[i - 1] : undefined;
              return (
              <tr key={m.month}>
                <td style={{ ...cell, fontWeight: 700, background: "var(--surface-2)" }}>{m.label}</td>
                <td style={cell}>{tv(m.clicks, p?.clicks, "int")}</td>
                <td style={cell}>{tv(m.impressions, p?.impressions, "k")}</td>
                <td style={cell}>{tv(m.ctr, p?.ctr, "pct")}</td>
                <td style={cell}>{tv(m.position, p?.position, "pos", true)}</td>
                <td style={cell}>{tv(m.active, p?.active, "int")}</td>
                <td style={cell}>{tv(m.newUsers, p?.newUsers, "int")}</td>
                <td style={cell}>{tv(m.organicSocial, p?.organicSocial, "int")}</td>
                <td style={cell}>{tv(m.organicSearch, p?.organicSearch, "int")}</td>
                {i === 0 && <td style={{ ...cell, fontWeight: 700, background: "color-mix(in srgb, var(--emerald) 8%, white)", verticalAlign: "middle" }} rowSpan={rows.length}>{da || "—"}</td>}
              </tr>
              );
            })}
            {rows.length === 0 && <tr><td style={cell} colSpan={10}>No monthly data yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Person({ icon: Icon, label, name, tone }: { icon: typeof UserCog; label: string; name: string; tone: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, var(--${tone}) 12%, white)`, color: `var(--${tone})` }}><Icon size={15} /></span>
      <div><div className="text-[10px] font-bold uppercase tracking-wide text-[var(--faint)]">{label}</div><div className="text-[13px] font-semibold">{name}</div></div>
    </div>
  );
}
