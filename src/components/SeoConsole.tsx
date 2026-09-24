"use client";

import { useMemo, useState } from "react";
import SeoClientDetail from "@/components/SeoClientDetail";
import { saveGmb, deleteGmb, saveSeoReport } from "@/app/actions";
import {
  Users, FileText, Image as ImageIcon, TrendingUp, ArrowUp, MapPin, Send, Search,
  ChevronDown, UserRound, UserCog, RotateCcw, CheckCircle2, Pencil, Trash2, Plus, ExternalLink, Star, Check, X, CalendarClock,
} from "lucide-react";

type Row = {
  id: string; name: string; dot: string; priority: string; schedule: string;
  blogs: number; written: number; images: number; live: number; pending: number;
  keywords: number; backlinks: number; pct: number; status: string; am: string; seo: string;
};
type Kpis = { activeClients: number; blogsPublished: number; imagesDone: number; pctPublished: number; blogsTotal: number };
type Gmb = {
  rows: { id: string; name: string; assigned: string; gmbLink: string; monthlyPosts: number; postsDone: number; lastPostDate: string; citations: number; reviews: number; reviewsNote: string; localo: boolean }[];
  owners: string[]; kpis: { locations: number; totalPosts: number; postsDone: number; pct: number };
};
type Reports = {
  rows: { id: string; clientId: string; client: string; am: string; reportDate: string; status: string; gscDone: boolean; gaDone: boolean; assigned: string; keywordStatus: string; note: string }[];
  month: string; months: { key: string; label: string }[]; kpis: { total: number; sent: number; pending: number };
};
type Leaderboard = {
  month: string; months: { key: string; label: string }[];
  rows: { id: string; name: string; role: string; clients: number; written: number; target: number; pct: number; onTrack: number; kwImproved: number; blLive: number }[];
};

const ST: Record<string, { label: string; tone: string }> = {
  PLANNED: { label: "Not started", tone: "var(--muted)" },
  IN_PROGRESS: { label: "In Progress", tone: "var(--amber)" },
  REVIEW: { label: "Almost done", tone: "var(--violet)" },
  APPROVED: { label: "Completed", tone: "var(--emerald)" },
};
const PRIORITY_TONE: Record<string, string> = { A: "var(--rose)", B: "var(--amber)", C: "var(--sky)" };

const SORTS = [
  { key: "PCT_DESC", label: "Completion (high → low)" },
  { key: "PCT_ASC", label: "Completion (low → high)" },
  { key: "NAME", label: "Client name (A → Z)" },
  { key: "PRIORITY", label: "Priority (A first)" },
];

export default function SeoConsole({
  rows, kpis, overall, month, months, userName, userRole = "", detail,
  view = "clients", gmb, reports, leaderboard,
}: {
  rows: Row[]; kpis: Kpis; overall: number; monthLabel?: string; month: string; months: { key: string; label: string }[];
  userName: string; userRole?: string;
  view?: string; gmb: Gmb; reports: Reports; leaderboard: Leaderboard;
  detail?: React.ComponentProps<typeof SeoClientDetail>["data"] | null;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("PCT_DESC");

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    let out = rows.filter((r) => (n ? (r.name.toLowerCase().includes(n) || r.seo.toLowerCase().includes(n) || r.am.toLowerCase().includes(n)) : true) && (status === "ALL" ? true : r.status === status));
    out = [...out].sort((a, b) => {
      if (sort === "NAME") return a.name.localeCompare(b.name);
      if (sort === "PRIORITY") return (a.priority || "Z").localeCompare(b.priority || "Z") || b.pct - a.pct;
      if (sort === "PCT_ASC") return a.pct - b.pct;
      return b.pct - a.pct;
    });
    return out;
  }, [rows, q, status, sort]);

  const counts = useMemo(() => ({
    APPROVED: rows.filter((r) => r.status === "APPROVED").length,
    IN_PROGRESS: rows.filter((r) => r.status === "IN_PROGRESS").length,
    REVIEW: rows.filter((r) => r.status === "REVIEW").length,
    PLANNED: rows.filter((r) => r.status === "PLANNED").length,
  }), [rows]);

  const reset = () => { setQ(""); setStatus("ALL"); setSort("PCT_DESC"); };
  const clientOptions: [string, string][] = [["ALL", "All clients"], ...[...rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => [r.id, r.name] as [string, string])];
  const goClient = (v: string) => window.location.assign(v === "ALL" ? "/seo" : `/seo?client=${v}`);

  // ===== DETAIL MODE =====
  if (detail) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">SEO Performance</span>
            <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">Client SEO detail</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Sel label="Client" value={detail.client.id} onChange={goClient} wide options={clientOptions} />
            <a href="/seo" className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line-2)] px-3 py-2.5 text-[13px] font-semibold hover:border-[var(--ink)]"><RotateCcw size={14} /> All clients</a>
          </div>
        </div>
        <SeoClientDetail data={detail} inline />
      </div>
    );
  }

  const VIEWS: [string, string, typeof FileText][] = [
    ["clients", "Blogs & Clients", FileText],
    ["gmb", "Local SEO (GMB)", MapPin],
    ["reports", "Reports", Send],
    ["team", "Team", Users],
  ];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">SEO Performance</span>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">SEO team workspace</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{kpis.activeClients} active SEO clients · {monthLabelOf(month, months)} · Lead {userName}</p>
        </div>
      </div>

      {/* view tabs */}
      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map(([key, label, Icon]) => {
          const on = view === key;
          return (
            <a key={key} href={key === "clients" ? "/seo" : `/seo?view=${key}`}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition ${on ? "border-transparent bg-[var(--ink)] text-white shadow-sm" : "border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}>
              <Icon size={15} /> {label}
            </a>
          );
        })}
      </div>

      {view === "gmb" && <GmbPanel gmb={gmb} canEdit={canEdit(userRole)} />}
      {view === "reports" && <ReportsPanel reports={reports} canEdit={canEdit(userRole)} />}
      {view === "team" && <TeamPanel data={leaderboard} />}

      {view === "clients" && (
        <>
          {/* filter toolbar */}
          <div className="card flex flex-wrap items-center gap-3 p-3">
            <Sel label="Open client" value="ALL" onChange={goClient} wide options={clientOptions} />
            <Sel label="Status" value={status} onChange={setStatus}
              options={[["ALL", `All (${rows.length})`], ["APPROVED", `Completed (${counts.APPROVED})`], ["REVIEW", `Almost (${counts.REVIEW})`], ["IN_PROGRESS", `In progress (${counts.IN_PROGRESS})`], ["PLANNED", `Not started (${counts.PLANNED})`]]} />
            <Sel label="Sort by" value={sort} onChange={setSort} options={SORTS.map((s) => [s.key, s.label] as [string, string])} />
            <Sel label="Month" value={month} onChange={(v) => window.location.assign(`/seo?month=${v}`)} options={months.map((m) => [m.key, m.label] as [string, string])} />
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client / team…"
                className="w-[170px] rounded-xl border border-[var(--line-2)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-[var(--violet)]" />
            </div>
            {(q || status !== "ALL" || sort !== "PCT_DESC") && <button onClick={reset} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-[var(--violet)] hover:underline"><RotateCcw size={13} /> Reset</button>}
          </div>

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Users} tone="violet" label="Active clients" value={kpis.activeClients} note="SEO book" />
            <Kpi icon={FileText} tone="emerald" label="Blogs published" value={`${kpis.blogsPublished} / ${kpis.blogsTotal}`} delta="this month" up />
            <Kpi icon={ImageIcon} tone="sky" label="Images done" value={kpis.imagesDone} note="creatives" />
            <Kpi icon={TrendingUp} tone="amber" label="% Published" value={`${kpis.pctPublished}%`} note="overall" />
          </div>

          {/* deliverables table */}
          <div className="card !p-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-bold">Blog progress by client <span className="ml-1 font-medium text-[var(--muted)]">· {visible.length} of {rows.length}</span></h2>
                <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Open a client to update the 8-slot blog tracker, backlinks, keywords, GSC/GA & reports.</p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="eyebrow">Overall</span>
                <div className="h-1.5 w-28 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-[var(--violet)]" style={{ width: `${overall}%` }} /></div>
                <span className="text-[14px] font-extrabold tnum">{overall}%</span>
              </div>
            </div>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[960px] text-left">
                <thead><tr className="border-b border-[var(--line)]">{["Client", "Pr.", "Team (AM · SEO)", "Schedule", "Blogs", "Status", "Progress"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
                <tbody>
                  {visible.map((r) => {
                    const st = ST[r.status] ?? ST.IN_PROGRESS;
                    return (
                      <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                        <td className="px-5 py-3"><a href={`/seo?client=${r.id}`} className="flex items-center gap-2.5 font-semibold hover:text-[var(--violet)]"><span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: r.dot }} /> {r.name}</a></td>
                        <td className="px-5 py-3">{r.priority && r.priority !== "—" ? <span className="grid h-6 w-6 place-items-center rounded-md text-[11px] font-extrabold" style={{ background: `color-mix(in srgb, ${PRIORITY_TONE[r.priority] ?? "var(--muted)"} 14%, white)`, color: PRIORITY_TONE[r.priority] ?? "var(--muted)" }}>{r.priority}</span> : <span className="text-[var(--faint)]">—</span>}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-0.5 text-[12px]">
                            <span className="inline-flex items-center gap-1.5"><UserCog size={12} className="text-[var(--violet)]" /> <span className="font-semibold text-[var(--ink-2)]">{r.am}</span></span>
                            <span className="inline-flex items-center gap-1.5"><UserRound size={12} className="text-[var(--emerald)]" /> <span className="text-[var(--muted)]">{r.seo}</span></span>
                          </div>
                        </td>
                        <td className="px-5 py-3"><span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--muted)]"><CalendarClock size={12} /> {r.schedule || "—"}</span></td>
                        <td className="px-5 py-3"><span className="text-[13px] font-bold tnum">{r.written}<span className="font-medium text-[var(--muted)]">/{r.blogs}</span></span></td>
                        <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: `color-mix(in srgb, ${st.tone} 11%, white)`, color: st.tone }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: st.tone }} /> {st.label}</span></td>
                        <td className="px-5 py-3" style={{ minWidth: 160 }}><div className="flex items-center gap-2.5"><div className="h-1.5 flex-1 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.pct >= 100 ? "var(--emerald)" : "var(--violet)" }} /></div><span className="text-[12.5px] font-bold text-[var(--muted)] tnum">{r.pct}%</span></div></td>
                      </tr>
                    );
                  })}
                  {visible.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No clients match. <button onClick={reset} className="font-semibold text-[var(--violet)] underline">Reset</button></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const canEdit = (role: string) => ["SUPER_ADMIN", "SUB_ADMIN", "SEO_HEAD", "SEO"].includes(role);
function monthLabelOf(m: string, months: { key: string; label: string }[]) { return months.find((x) => x.key === m)?.label ?? m; }

/* ===================== Local SEO (GMB) ===================== */
function GmbPanel({ gmb, canEdit: editable }: { gmb: Gmb; canEdit: boolean }) {
  const [owner, setOwner] = useState("ALL");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const rows = useMemo(() => gmb.rows.filter((r) => (owner === "ALL" || r.assigned === owner) && (q ? r.name.toLowerCase().includes(q.toLowerCase()) : true)), [gmb.rows, owner, q]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={MapPin} tone="amber" label="GMB locations" value={gmb.kpis.locations} note="active" />
        <Kpi icon={FileText} tone="violet" label="Posts target" value={gmb.kpis.totalPosts} note="/ month" />
        <Kpi icon={CheckCircle2} tone="emerald" label="Posts done" value={gmb.kpis.postsDone} note="this month" />
        <Kpi icon={TrendingUp} tone="sky" label="Completion" value={`${gmb.kpis.pct}%`} note="posted" />
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <Sel label="Owner" value={owner} onChange={setOwner} options={[["ALL", `All owners (${gmb.rows.length})`], ...gmb.owners.map((o) => [o, o] as [string, string])]} />
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search location…" className="w-[180px] rounded-xl border border-[var(--line-2)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-[var(--violet)]" />
        </div>
        {editable && <button onClick={() => { setAdding(!adding); setOpenId(null); }} className="ml-auto btn btn-violet !py-2"><Plus size={15} /> Add location</button>}
      </div>

      {editable && adding && <GmbForm onClose={() => setAdding(false)} />}

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[880px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Location", "Owner", "Posts", "Last post", "Citations", "Reviews", "Localo", editable ? "" : null].filter((h) => h !== null).map((h, i) => <th key={i} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <>
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3 text-[13px] font-semibold">{r.gmbLink ? <a href={r.gmbLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-[var(--violet)]">{r.name} <ExternalLink size={11} className="text-[var(--faint)]" /></a> : r.name}</td>
                    <td className="px-5 py-3 text-[12.5px] text-[var(--muted)]">{r.assigned || "—"}</td>
                    <td className="px-5 py-3 text-[13px] font-bold tnum">{r.postsDone}<span className="font-medium text-[var(--muted)]">/{r.monthlyPosts}</span></td>
                    <td className="px-5 py-3 text-[12.5px] text-[var(--muted)]">{r.lastPostDate || "—"}</td>
                    <td className="px-5 py-3 text-[13px] tnum">{r.citations || "—"}</td>
                    <td className="px-5 py-3 text-[12.5px]">{r.reviewsNote || (r.reviews || "—")}</td>
                    <td className="px-5 py-3">{r.localo ? <span className="badge badge-emerald"><Check size={12} /> Yes</span> : <span className="text-[var(--faint)]">—</span>}</td>
                    {editable && (
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => { setOpenId(openId === r.id ? null : r.id); setAdding(false); }} className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"><Pencil size={13} /></button>
                          <form action={deleteGmb}><input type="hidden" name="id" value={r.id} /><button className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--muted)] hover:border-[var(--rose)] hover:text-[var(--rose)]"><Trash2 size={13} /></button></form>
                        </div>
                      </td>
                    )}
                  </tr>
                  {editable && openId === r.id && <tr key={r.id + "-edit"}><td colSpan={8} className="bg-[var(--surface-2)] px-5 py-4"><GmbForm row={r} onClose={() => setOpenId(null)} /></td></tr>}
                </>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No GMB locations.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GmbForm({ row, onClose }: { row?: Gmb["rows"][number]; onClose: () => void }) {
  return (
    <form action={saveGmb} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {row && <input type="hidden" name="id" value={row.id} />}
      <Field label="Location name"><input name="name" required defaultValue={row?.name ?? ""} className="sfld" placeholder="e.g. Thaswika Hair (Manikonda)" /></Field>
      <Field label="Owner"><input name="assigned" defaultValue={row?.assigned ?? ""} className="sfld" placeholder="e.g. Kishore" /></Field>
      <Field label="GMB link"><input name="gmbLink" defaultValue={row?.gmbLink ?? ""} className="sfld" placeholder="https://…" /></Field>
      <Field label="Last post date"><input name="lastPostDate" defaultValue={row?.lastPostDate ?? ""} className="sfld" placeholder="e.g. 20 Aug" /></Field>
      <Field label="Monthly posts (target)"><input name="monthlyPosts" type="number" defaultValue={row?.monthlyPosts ?? 0} className="sfld" /></Field>
      <Field label="Posts done"><input name="postsDone" type="number" defaultValue={row?.postsDone ?? 0} className="sfld" /></Field>
      <Field label="Citations"><input name="citations" type="number" defaultValue={row?.citations ?? 0} className="sfld" /></Field>
      <Field label="Reviews note"><input name="reviewsNote" defaultValue={row?.reviewsNote ?? ""} className="sfld" placeholder="e.g. 10 / No commitment" /></Field>
      <label className="flex items-center gap-2 self-end text-[13px] font-semibold"><input type="checkbox" name="localo" defaultChecked={row?.localo} className="h-4 w-4 accent-[var(--violet)]" /> Localo tool</label>
      <div className="col-span-full flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-[var(--line-2)] px-4 py-2 text-[13px] font-semibold hover:border-[var(--ink)]">Cancel</button>
        <button type="submit" className="btn btn-violet">Save location</button>
      </div>
    </form>
  );
}

/* ===================== Reports ===================== */
function ReportsPanel({ reports, canEdit: editable }: { reports: Reports; canEdit: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={Send} tone="violet" label="Reports this month" value={reports.kpis.total} note="clients" />
        <Kpi icon={CheckCircle2} tone="emerald" label="Sent" value={reports.kpis.sent} note="delivered" />
        <Kpi icon={CalendarClock} tone="amber" label="Pending" value={reports.kpis.pending} note="to send" />
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <Sel label="Month" value={reports.month} onChange={(v) => window.location.assign(`/seo?view=reports&month=${v}`)} options={reports.months.map((m) => [m.key, m.label] as [string, string])} />
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[900px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Client", "AM", "Due", "Prepared by", "GSC", "GA", "Keywords", "Status", editable ? "" : null].filter((h) => h !== null).map((h, i) => <th key={i} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {reports.rows.map((r) => {
                const sent = r.status === "SENT";
                return (
                  <>
                    <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                      <td className="px-5 py-3 text-[13px] font-semibold"><a href={`/seo?client=${r.clientId}&tab=report`} className="hover:text-[var(--violet)]">{r.client}</a></td>
                      <td className="px-5 py-3 text-[12.5px] text-[var(--muted)]">{r.am}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[var(--muted)]">{r.reportDate || "—"}</td>
                      <td className="px-5 py-3 text-[12.5px]">{r.assigned || "—"}</td>
                      <td className="px-5 py-3">{r.gscDone ? <Check size={15} className="text-[var(--emerald)]" /> : <X size={15} className="text-[var(--faint)]" />}</td>
                      <td className="px-5 py-3">{r.gaDone ? <Check size={15} className="text-[var(--emerald)]" /> : <X size={15} className="text-[var(--faint)]" />}</td>
                      <td className="px-5 py-3 text-[12.5px]">{r.keywordStatus || "—"}</td>
                      <td className="px-5 py-3"><span className={`badge ${sent ? "badge-emerald" : "badge-amber"}`}>{sent ? "Sent" : "Pending"}</span></td>
                      {editable && <td className="px-5 py-3 text-right"><button onClick={() => setOpenId(openId === r.id ? null : r.id)} className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"><Pencil size={13} /></button></td>}
                    </tr>
                    {editable && openId === r.id && (
                      <tr key={r.id + "-edit"}><td colSpan={9} className="bg-[var(--surface-2)] px-5 py-4">
                        <form action={saveSeoReport} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <input type="hidden" name="clientId" value={r.clientId} /><input type="hidden" name="month" value={reports.month} /><input type="hidden" name="back" value={`/seo?view=reports&month=${reports.month}`} />
                          <Field label="Report date"><input name="reportDate" defaultValue={r.reportDate} className="sfld" placeholder="10th" /></Field>
                          <Field label="Status"><select name="status" defaultValue={r.status} className="sfld"><option value="PENDING">Pending</option><option value="SENT">Sent</option></select></Field>
                          <Field label="Prepared by"><input name="assigned" defaultValue={r.assigned} className="sfld" /></Field>
                          <Field label="Keyword positions"><select name="keywordStatus" defaultValue={r.keywordStatus} className="sfld"><option value="">—</option><option value="Done">Done</option><option value="Pending">Pending</option></select></Field>
                          <label className="flex items-center gap-2 self-end text-[13px] font-semibold"><input type="checkbox" name="gscDone" defaultChecked={r.gscDone} className="h-4 w-4 accent-[var(--violet)]" /> GSC updated</label>
                          <label className="flex items-center gap-2 self-end text-[13px] font-semibold"><input type="checkbox" name="gaDone" defaultChecked={r.gaDone} className="h-4 w-4 accent-[var(--violet)]" /> GA updated</label>
                          <div className="lg:col-span-2"><Field label="Note"><input name="note" defaultValue={r.note} className="sfld" /></Field></div>
                          <div className="col-span-full flex justify-end gap-2"><button type="button" onClick={() => setOpenId(null)} className="rounded-xl border border-[var(--line-2)] px-4 py-2 text-[13px] font-semibold hover:border-[var(--ink)]">Cancel</button><button type="submit" className="btn btn-violet">Save</button></div>
                        </form>
                      </td></tr>
                    )}
                  </>
                );
              })}
              {reports.rows.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No reports logged for this month. Open a client → Report tab to add one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===================== Team leaderboard ===================== */
function TeamPanel({ data }: { data: Leaderboard }) {
  const top = data.rows[0];
  const totalWritten = data.rows.reduce((s, r) => s + r.written, 0);
  const totalKw = data.rows.reduce((s, r) => s + r.kwImproved, 0);
  const totalBl = data.rows.reduce((s, r) => s + r.blLive, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} tone="violet" label="SEO team" value={data.rows.length} note="active" />
        <Kpi icon={FileText} tone="emerald" label="Blogs published" value={totalWritten} note="team total" />
        <Kpi icon={TrendingUp} tone="sky" label="Keywords improved" value={totalKw} note="this month" />
        <Kpi icon={CheckCircle2} tone="amber" label="Backlinks live" value={totalBl} note="this month" />
      </div>
      {top && <div className="card card-pad flex flex-wrap items-center gap-3"><Star size={16} className="text-[var(--amber)]" /><span className="text-[13.5px] font-semibold">Top performer this month:</span><span className="text-[14px] font-extrabold text-[var(--violet)]">{top.name}</span><span className="text-[12.5px] text-[var(--muted)]">{top.written}/{top.target} blogs · {top.pct}% completion</span></div>}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4"><h2 className="text-[15px] font-bold">SEO team leaderboard <span className="ml-1 font-medium text-[var(--muted)]">· ranked by blog completion</span></h2></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["#", "Member", "Clients", "Blogs (done/target)", "On track", "Keywords ↑", "Backlinks live", "Completion"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[13px] font-bold text-[var(--muted)] tnum">{i + 1}</td>
                  <td className="px-5 py-3"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: "var(--grad)" }}>{r.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span><div><div className="text-[13.5px] font-semibold">{r.name}</div><div className="text-[11px] text-[var(--muted)]">{r.role === "SEO_HEAD" ? "Team Lead" : "SEO Specialist"}</div></div></div></td>
                  <td className="px-5 py-3 text-[13px] tnum">{r.clients}</td>
                  <td className="px-5 py-3 text-[13px] font-bold tnum">{r.written}<span className="font-medium text-[var(--muted)]">/{r.target}</span></td>
                  <td className="px-5 py-3 text-[13px] tnum">{r.onTrack}/{r.clients}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum text-[var(--emerald)]">{r.kwImproved}</td>
                  <td className="px-5 py-3 text-[13px] tnum">{r.blLive}</td>
                  <td className="px-5 py-3" style={{ minWidth: 150 }}><div className="flex items-center gap-2.5"><div className="h-1.5 flex-1 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.pct >= 100 ? "var(--emerald)" : "var(--violet)" }} /></div><span className="text-[12.5px] font-bold text-[var(--muted)] tnum">{r.pct}%</span></div></td>
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No SEO team data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===================== shared ===================== */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">{label}</span>{children}</label>;
}

function Sel({ label, value, onChange, options, wide }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; wide?: boolean }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="pointer-events-none absolute -top-2 left-2.5 bg-[var(--surface)] px-1 text-[9px] font-bold uppercase tracking-wide text-[var(--faint)]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={`${wide ? "max-w-[220px]" : ""} appearance-none rounded-xl border border-[var(--line-2)] bg-[var(--surface)] py-2.5 pl-3 pr-9 text-[13px] font-semibold text-[var(--ink-2)] outline-none focus:border-[var(--violet)]`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
    </label>
  );
}

function Kpi({ icon: Icon, tone, label, value, delta, up, note }: { icon: typeof Users; tone: string; label: string; value: React.ReactNode; delta?: string; up?: boolean; note?: string }) {
  const c: Record<string, string> = { violet: "var(--violet)", emerald: "var(--emerald)", sky: "var(--sky)", amber: "var(--amber)", indigo: "var(--indigo)" };
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: `color-mix(in srgb, ${c[tone]} 12%, white)`, color: c[tone] }}><Icon size={17} /></span>
        {delta && <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--emerald)_12%,white)] px-2 py-1 text-[11px] font-bold text-[var(--emerald)]">{up && <ArrowUp size={11} />} {delta}</span>}
        {note && !delta && <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">{note}</span>}
      </div>
      <div className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-[30px] font-extrabold leading-none tracking-tight tnum">{value}</div>
    </div>
  );
}
