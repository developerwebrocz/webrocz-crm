"use client";

import { useMemo, useState } from "react";
import { saveSeoClientBoard, createSeoClient, updateSeoClient, deleteSeoClient } from "@/app/actions";
import { ChevronDown, Search, Plus, X, FileText, TrendingUp, TrendingDown, Minus, Check, Download, Upload, UserPlus, Pencil, Trash2 } from "lucide-react";

/* ---- exact palette from the uploaded design ---- */
const C = {
  violet: "#6D28D9", violetHover: "#5B21B6", violetSoft: "#A78BFA",
  v50: "#F8F7FF", v75: "#FBFAFF", v100: "#F5F3FF", v150: "#F3F0FF", v200: "#EDE9FE", v300: "#DDD6FE",
  bd: "#ECE9FF", bd2: "#E5E3F5", bd3: "#D8D0FF",
  ink: "#111827", ink2: "#374151", muted: "#6B7280", faint: "#9CA3AF", indigo: "#4338CA",
  green: "#16A34A", greenD: "#166534", greenBg: "#DCFCE7", greenBg2: "#F0FDF4", greenBd: "#BBF7D0",
  amber: "#854D0E", amberBg: "#FEF9C3",
  red: "#DC2626", redD: "#991B1B", redBg: "#FEE2E2", redBg2: "#FEF2F2", redBd: "#FECACA",
};
const BLOG_STATUSES = ["Published", "Draft", "Pending Review"];
const BLOG_TONE: Record<string, [string, string]> = { "Published": [C.greenBg, C.greenD], "Draft": [C.amberBg, C.amber], "Pending Review": [C.v200, C.violet] };
const BL_TYPES = ["Guest Post", "Directory Submission", "Social Bookmarking", "Blog Comment", "Forum Submission", "Profile Link", "Business Listing", "Press Release", "Web 2.0", "Niche Edit", "PBN", "Edu/Gov", "Image Link", "Article Submission", "Citation"];
const BL_STATUSES = ["Live", "Pending", "Removed"];
const BL_TONE: Record<string, [string, string]> = { "Live": [C.greenBg, C.greenD], "Pending": [C.amberBg, C.amber], "Removed": [C.redBg, C.redD] };

type Blog = { id?: string; title: string; link: string; status: string; date: string };
type Kw = { id?: string; keyword: string; lastPos: number; currPos: number };
type Bl = { id?: string; type: string; status: string; link: string; da: number; date: string };
type Client = {
  id: string; name: string; industry: string; budget: number; keywordsTarget: number; poc: string;
  am: string; amId: string; seo: string; website: string; schedule: string; priority: string; pct: number; written: number; target: number; status: string;
  taskType: string[]; lastUpdated: string; da: number; backlinkTarget: number; backlinksDone: number; notes: string;
  blogs: Blog[]; keywords: Kw[]; backlinks: Bl[];
  gsc: { impressions: number; clicks: number; ctr: number; position: number }; gscPrev: { impressions: number; clicks: number } | null;
  ga: { active: number; newUsers: number; organic: number; organicSocial: number; sessions: number; bounce: number; engagement: string }; gaPrev: { active: number; organic: number } | null;
  monthly: { month: string; label: string; clicks: number; impressions: number; ctr: number; position: number; active: number; newUsers: number; organicSocial: number; organicSearch: number }[];
  chart: { label: string; impressions: number; clicks: number; active: number; organic: number }[];
};
type Data = {
  name: string; isHead: boolean; month: string; months: { key: string; label: string }[]; monthLabel: string;
  dueLabel: string; dueFull: string; activeClients: number; overallPct: number;
  amUsers: { id: string; name: string }[]; rows: Client[];
};

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const STATUS_TONE: Record<string, [string, string]> = {
  "Completed": [C.greenBg, C.greenD], "In Review": [C.greenBg, C.greenD], "In Progress": [C.v200, C.violet], "Pending": [C.amberBg, C.amber],
};

export default function SeoEmployeeBoard({ data, initialClientId }: { data: Data; initialClientId?: string }) {
  const [q, setQ] = useState("");
  const [am, setAm] = useState("ALL");
  const [pr, setPr] = useState("ALL");
  const [showNew, setShowNew] = useState(false);
  const [sel, setSel] = useState<string | null>((initialClientId && data.rows.some((r) => r.id === initialClientId) ? initialClientId : data.rows[0]?.id) ?? null);
  const ams = useMemo(() => [...new Set(data.rows.map((r) => r.am).filter((a) => a && a !== "—"))].sort(), [data.rows]);
  const rows = useMemo(() => data.rows.filter((r) => (am === "ALL" || r.am === am) && (pr === "ALL" || r.priority === pr) && (q ? r.name.toLowerCase().includes(q.toLowerCase()) : true)), [data.rows, q, am, pr]);
  const selClient = data.rows.find((r) => r.id === sel) ?? null;
  const pipeline = useMemo(() => {
    const g = { Completed: 0, "In Review": 0, "In Progress": 0, Pending: 0 };
    for (const r of data.rows) g[r.status as keyof typeof g] = (g[r.status as keyof typeof g] ?? 0) + 1;
    return g;
  }, [data.rows]);

  return (
    <div className="mx-auto max-w-[1320px] space-y-5 pb-10">
      {/* ===== HEADER ===== */}
      <div className="rounded-[20px] border bg-white p-5 shadow-[0_2px_16px_rgba(109,40,217,0.06)]" style={{ borderColor: C.bd }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] text-[16px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${C.violet}, ${C.indigo})` }}>W</span>
            <div>
              <h1 className="text-[18px] font-bold tracking-tight" style={{ color: C.ink }}>WebRocz SEO Dashboard</h1>
              <p className="text-[12.5px]" style={{ color: C.muted }}>{data.name} · {data.activeClients} Active Clients · Month of {data.monthLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Dropdown label="Month" value={data.month} onChange={(v) => window.location.assign(`/seo?month=${v}`)} options={data.months.map((m) => [m.key, m.label] as [string, string])} />
            <Dropdown label="AM" value={am} onChange={setAm} options={[["ALL", "All AMs"], ...ams.map((a) => [a, a] as [string, string])]} />
            <Dropdown label="Priority" value={pr} onChange={setPr} options={[["ALL", "All"], ["A", "A"], ["B", "B"], ["C", "C"]]} />
            <Dropdown label="Open client" value={sel ?? ""} onChange={setSel} wide options={data.rows.map((r) => [r.id, r.name] as [string, string])} />
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.faint }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter clients" className="w-[150px] rounded-[12px] border bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none" style={{ borderColor: C.bd2, color: C.ink }} />
            </div>
            <button type="button" onClick={() => setShowNew((v) => !v)} className="inline-flex items-center gap-1.5 rounded-[12px] border px-3.5 py-2.5 text-[13px] font-semibold" style={{ borderColor: C.bd3, color: C.violet, background: C.v100 }}><UserPlus size={15} /> New Client</button>
            <a href="/seo?view=reports" className="rounded-[12px] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(109,40,217,0.25)]" style={{ background: C.violet }}>Submit SEO Report</a>
          </div>
        </div>
      </div>

      {/* ===== NEW CLIENT FORM ===== */}
      {showNew && (
        <form action={createSeoClient} className="rounded-[20px] border bg-white p-5 shadow-[0_2px_16px_rgba(109,40,217,0.06)]" style={{ borderColor: C.bd }}>
          <div className="mb-3 flex items-center gap-2"><UserPlus size={16} style={{ color: C.violet }} /><h3 className="text-[15px] font-bold" style={{ color: C.ink }}>Add a new SEO client</h3></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2"><Lbl>Client name *</Lbl><input name="name" required placeholder="e.g. Skin Care Clinic" style={fld} /></div>
            <div className="lg:col-span-2"><Lbl>Website</Lbl><input name="website" placeholder="https://..." style={fld} /></div>
            <div><Lbl>Industry</Lbl><input name="industry" placeholder="e.g. Healthcare" style={fld} /></div>
            <div><Lbl>Account Manager</Lbl><div className="relative"><select name="accountManagerId" defaultValue="" className="w-full appearance-none rounded-[10px] border bg-white py-2 pl-2.5 pr-7 text-[12.5px] outline-none" style={{ borderColor: C.bd2, color: C.ink }}><option value="">— None —</option>{data.amUsers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: C.faint }} /></div></div>
            <div><Lbl>Priority</Lbl><div className="relative"><select name="priority" defaultValue="A" className="w-full appearance-none rounded-[10px] border bg-white py-2 pl-2.5 pr-7 text-[12.5px] outline-none" style={{ borderColor: C.bd2, color: C.ink }}><option value="A">A</option><option value="B">B</option><option value="C">C</option></select><ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: C.faint }} /></div></div>
            <div><Lbl>POC</Lbl><input name="poc" placeholder="e.g. Dr. Rajesh" style={fld} /></div>
            <div><Lbl>Blogs / month</Lbl><input name="blogTarget" type="number" defaultValue={8} style={fld} /></div>
            <div><Lbl>Backlinks / month</Lbl><input name="backlinkTarget" type="number" defaultValue={100} style={fld} /></div>
            <div><Lbl>Keywords</Lbl><input name="keywordTarget" type="number" defaultValue={10} style={fld} /></div>
            <div><Lbl>SEO Budget (₹)</Lbl><input name="budget" type="number" defaultValue={30000} style={fld} /></div>
            <div className="lg:col-span-2"><Lbl>Work schedule</Lbl><input name="schedule" placeholder="e.g. Mon, Wed, Fri" style={fld} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowNew(false)} className="rounded-[12px] border px-4 py-2 text-[13px] font-semibold" style={{ borderColor: C.bd2, color: C.ink2 }}>Cancel</button>
            <button type="submit" className="rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(109,40,217,0.25)]" style={{ background: C.violet }}>Add client</button>
          </div>
        </form>
      )}

      {/* ===== SELECTED CLIENT EDITOR (on top) ===== */}
      {selClient ? (
        <div key={selClient.id} className="space-y-3">
          <ClientAdminBar c={selClient} amUsers={data.amUsers} />
          <ClientCard c={selClient} month={data.month} />
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed p-10 text-center" style={{ borderColor: C.bd3, background: C.v75 }}>
          <p className="text-[13px] font-semibold" style={{ color: C.muted }}>Select a client from the pipeline below to open its editor.</p>
        </div>
      )}

      {/* ===== PIPELINE TABLE (below) ===== */}
      <div className="overflow-hidden rounded-[20px] border bg-white shadow-[0_2px_16px_rgba(109,40,217,0.06)]" style={{ borderColor: C.bd }}>
        <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between" style={{ borderColor: C.v150 }}>
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: C.ink }}>Monthly SEO Pipeline · End of Month {data.dueLabel}</h2>
            <p className="mt-0.5 text-[12.5px]" style={{ color: C.muted }}>{data.activeClients} active SEO clients · Due {data.dueFull} · Click a client to open its editor above</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Stage label="Completed" n={pipeline.Completed} tone={C.green} />
            <Stage label="In review" n={pipeline["In Review"]} tone={C.violet} />
            <Stage label="Working" n={pipeline["In Progress"]} tone={C.amber} />
            <Stage label="Pending" n={pipeline.Pending} tone={C.muted} />
            <div className="ml-1 flex items-center gap-2">
              <div className="h-2 w-20 overflow-hidden rounded-full" style={{ background: C.v200 }}><div className="h-full rounded-full" style={{ width: `${data.overallPct}%`, background: C.violet }} /></div>
              <span className="text-[13px] font-bold" style={{ color: C.ink }}>{data.overallPct}%</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr style={{ background: C.v75 }}>{["Client", "Account Mgr", "Status", "Blogs", "Progress", ""].map((h) => <th key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => {
                const [bg, fg] = STATUS_TONE[r.status] ?? STATUS_TONE["Pending"];
                const on = sel === r.id;
                return (
                  <tr key={r.id} onClick={() => setSel(r.id)} className="cursor-pointer border-t transition" style={{ borderColor: C.v150, background: on ? C.v100 : undefined, boxShadow: on ? `inset 3px 0 0 ${C.violet}` : undefined }}>
                    <td className="px-5 py-3"><span className="text-[13.5px] font-semibold" style={{ color: on ? C.violet : C.ink }}>{r.name}</span></td>
                    <td className="px-5 py-3 text-[12.5px]" style={{ color: C.ink2 }}>{r.am}</td>
                    <td className="px-5 py-3"><span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: bg, color: fg }}>{r.status}</span></td>
                    <td className="px-5 py-3 text-[12.5px] font-bold" style={{ color: C.ink2 }}>{r.written}/{r.target}</td>
                    <td className="px-5 py-3"><div className="flex items-center gap-2.5"><div className="h-1.5 w-[120px] overflow-hidden rounded-full" style={{ background: C.v200 }}><div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.pct >= 100 ? C.green : C.violet }} /></div><span className="text-[12px] font-bold" style={{ color: C.muted }}>{r.pct}%</span></div></td>
                    <td className="px-5 py-3 text-right"><span className="text-[12px] font-semibold" style={{ color: on ? C.violet : C.faint }}>{on ? "Open ↓" : "Open"}</span></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[13px]" style={{ color: C.muted }}>No clients match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function Stage({ label, n, tone }: { label: string; n: number; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: C.v150, color: C.ink2 }}>
      <span className="h-2 w-2 rounded-full" style={{ background: tone }} /> {label} <b style={{ color: C.ink }}>{n}</b>
    </span>
  );
}

function Dropdown({ label, value, onChange, options, wide }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; wide?: boolean }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="pointer-events-none absolute -top-2 left-2.5 z-10 bg-white px-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: C.faint }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${wide ? "max-w-[180px]" : ""} appearance-none rounded-[12px] border bg-white py-2.5 pl-3 pr-9 text-[13px] font-semibold outline-none`} style={{ borderColor: C.bd2, color: C.ink2 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: C.faint }} />
    </label>
  );
}

/* ============ per-client card ============ */
function ClientCard({ c, month }: { c: Client; month: string }) {
  const [tab, setTab] = useState("Blogs");
  const [blogs, setBlogs] = useState<Blog[]>(c.blogs.length ? c.blogs : [{ title: "", link: "", status: "Draft", date: "" }]);
  const [kws, setKws] = useState<Kw[]>(c.keywords.length ? c.keywords : []);
  const [bls, setBls] = useState<Bl[]>(c.backlinks.length ? c.backlinks : []);
  const [gsc, setGsc] = useState(c.gsc);
  const [ga, setGa] = useState(c.ga);
  const [da, setDa] = useState(c.da);
  const [notes, setNotes] = useState(c.notes);

  const TABS = ["Blogs", "Keywords", "Backlinks", "GSC", "GA4", "Monthly Data", "Work Report", "Notes"];
  return (
    <form id={`c-${c.id}`} action={saveSeoClientBoard} className="rounded-[20px] border bg-white p-5 shadow-[0_2px_16px_rgba(109,40,217,0.06)] scroll-mt-4" style={{ borderColor: C.bd }}>
      <input type="hidden" name="clientId" value={c.id} />
      <input type="hidden" name="month" value={month} />
      {/* header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-[16px] font-bold" style={{ color: C.ink }}>{c.name}</h3>
          <Tag>{c.industry}</Tag>
          <Tag>{c.keywordsTarget} Keywords</Tag>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: C.greenBg2, color: C.greenD, border: `1px solid ${C.greenBd}` }}>Account Manager: {c.am || "—"}</span>
          {c.seo && c.seo !== "—" && <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: C.v200, color: C.violet }}>SEO: {c.seo}</span>}
          {c.poc && <span className="text-[12px]" style={{ color: C.muted }}>POC {c.poc}</span>}
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="mr-1 hidden text-[11px] lg:inline" style={{ color: C.faint }}>Updated {c.lastUpdated}</span>
          <button type="button" onClick={() => downloadClientCsv(c, blogs, kws, bls, gsc, ga, month)} className="inline-flex items-center gap-1.5 rounded-[12px] border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: C.bd3, color: C.violet, background: C.v100 }}><Download size={14} /> Download</button>
          <button type="submit" className="rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(109,40,217,0.25)]" style={{ background: C.violet }}>Save Client</button>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = tab === t;
          return <button type="button" key={t} onClick={() => setTab(t)} className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition" style={on ? { background: C.violet, color: "#fff" } : { background: C.v150, color: C.ink2 }}>{t}</button>;
        })}
      </div>

      {/* all panels stay mounted (hidden when inactive) so every tab's fields submit together */}
      <div className="mt-4">
        <div className={tab === "Blogs" ? "" : "hidden"}><BlogsTab blogs={blogs} setBlogs={setBlogs} /></div>
        <div className={tab === "Keywords" ? "" : "hidden"}><KeywordsTab kws={kws} setKws={setKws} /></div>
        <div className={tab === "Backlinks" ? "" : "hidden"}><BacklinksTab bls={bls} setBls={setBls} target={c.backlinkTarget} /></div>
        <div className={tab === "GSC" ? "" : "hidden"}><GscTab gsc={gsc} setGsc={setGsc} prev={c.gscPrev} chart={c.chart} da={da} setDa={setDa} /></div>
        <div className={tab === "GA4" ? "" : "hidden"}><GaTab ga={ga} setGa={setGa} prev={c.gaPrev} chart={c.chart} /></div>
        <div className={tab === "Monthly Data" ? "" : "hidden"}><MonthlyTab rows={c.monthly} da={da} name={c.name} /></div>
        <div className={tab === "Work Report" ? "" : "hidden"}><WorkReportTab c={c} month={month} blogs={blogs} bls={bls} kws={kws} gsc={gsc} ga={ga} /></div>
        <div className={tab === "Notes" ? "" : "hidden"}>
          <p className="mb-2 text-[13px] font-bold" style={{ color: C.ink }}>Internal notes</p>
          <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} placeholder="Notes about this client — strategy, client requests, reminders…" className="w-full rounded-[12px] border p-3 text-[13px] outline-none" style={{ borderColor: C.bd2 }} />
          <p className="mt-1.5 text-[11px]" style={{ color: C.faint }}>Saved with the client (Save Client button). Visible to your SEO team & admin.</p>
        </div>
      </div>

      {/* footer */}
      <div className="mt-4 flex items-center justify-between border-t pt-4 text-[12px]" style={{ borderColor: C.v150, color: C.muted }}>
        <span>Last updated {c.lastUpdated} · Total progress</span>
        <span className="text-[13px] font-bold" style={{ color: c.pct >= 100 ? C.green : C.violet }}>{c.pct}%</span>
      </div>
    </form>
  );
}

/* ---------- Edit / delete a client ---------- */
function ClientAdminBar({ c, amUsers }: { c: Client; amUsers: { id: string; name: string }[] }) {
  const [edit, setEdit] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border px-4 py-2.5" style={{ borderColor: C.bd, background: C.v75 }}>
        <span className="text-[12.5px] font-semibold" style={{ color: C.ink2 }}>Managing: <span style={{ color: C.violet }}>{c.name}</span></span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEdit((v) => !v)} className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: C.bd2, color: C.ink2, background: "#fff" }}><Pencil size={13} /> Edit details</button>
          <form action={deleteSeoClient}>
            <input type="hidden" name="clientId" value={c.id} />
            <button type="submit" onClick={(e) => { if (!window.confirm(`Delete client "${c.name}" and all its SEO data? This cannot be undone.`)) e.preventDefault(); }} className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: C.redBd, color: C.red, background: C.redBg2 }}><Trash2 size={13} /> Delete</button>
          </form>
        </div>
      </div>
      {edit && (
        <form action={updateSeoClient} className="mt-2 rounded-[16px] border bg-white p-4 shadow-[0_2px_16px_rgba(109,40,217,0.06)]" style={{ borderColor: C.bd }}>
          <input type="hidden" name="clientId" value={c.id} />
          <div className="mb-3 flex items-center gap-2"><Pencil size={15} style={{ color: C.violet }} /><h3 className="text-[14px] font-bold" style={{ color: C.ink }}>Edit client details</h3></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2"><Lbl>Client name *</Lbl><input name="name" required defaultValue={c.name} style={fld} /></div>
            <div className="lg:col-span-2"><Lbl>Website</Lbl><input name="website" defaultValue={c.website} placeholder="https://..." style={fld} /></div>
            <div><Lbl>Industry</Lbl><input name="industry" defaultValue={c.industry} style={fld} /></div>
            <div><Lbl>Account Manager</Lbl><div className="relative"><select name="accountManagerId" defaultValue={c.amId} className="w-full appearance-none rounded-[10px] border bg-white py-2 pl-2.5 pr-7 text-[12.5px] outline-none" style={{ borderColor: C.bd2, color: C.ink }}><option value="">— None —</option>{amUsers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: C.faint }} /></div></div>
            <div><Lbl>Priority</Lbl><div className="relative"><select name="priority" defaultValue={c.priority || "A"} className="w-full appearance-none rounded-[10px] border bg-white py-2 pl-2.5 pr-7 text-[12.5px] outline-none" style={{ borderColor: C.bd2, color: C.ink }}><option value="A">A</option><option value="B">B</option><option value="C">C</option></select><ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: C.faint }} /></div></div>
            <div><Lbl>POC</Lbl><input name="poc" defaultValue={c.poc} style={fld} /></div>
            <div><Lbl>Blogs / month</Lbl><input name="blogTarget" type="number" defaultValue={c.target} style={fld} /></div>
            <div><Lbl>Backlinks / month</Lbl><input name="backlinkTarget" type="number" defaultValue={c.backlinkTarget} style={fld} /></div>
            <div><Lbl>Keywords</Lbl><input name="keywordTarget" type="number" defaultValue={c.keywordsTarget} style={fld} /></div>
            <div><Lbl>SEO Budget (₹)</Lbl><input name="budget" type="number" defaultValue={c.budget} style={fld} /></div>
            <div className="lg:col-span-2"><Lbl>Work schedule</Lbl><input name="schedule" defaultValue={c.schedule} placeholder="e.g. Mon, Wed, Fri" style={fld} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setEdit(false)} className="rounded-[12px] border px-4 py-2 text-[13px] font-semibold" style={{ borderColor: C.bd2, color: C.ink2 }}>Cancel</button>
            <button type="submit" className="rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(109,40,217,0.25)]" style={{ background: C.violet }}>Save changes</button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------- Blogs tab ---------- */
function BlogsTab({ blogs, setBlogs }: { blogs: Blog[]; setBlogs: (b: Blog[]) => void }) {
  const set = (i: number, k: keyof Blog, v: string) => setBlogs(blogs.map((b, idx) => (idx === i ? { ...b, [k]: v } : b)));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-bold" style={{ color: C.ink }}>SEO Blogs - Title and Link</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setBlogs(blogs.map((b) => ({ ...b, status: "Published" })))} className="inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[12px] font-semibold" style={{ borderColor: C.greenBd, color: C.greenD, background: C.greenBg2 }}><Check size={13} /> Mark all Published</button>
          <span className="text-[11px]" style={{ color: C.faint }}>No of Blogs</span><CountSelect value={blogs.length} options={[1, 2, 3, 4, 5, 6, 8, 10]} onChange={(n) => setBlogs(resize(blogs, n, { title: "", link: "", status: "Draft", date: "" }))} />
        </div>
      </div>
      <input type="hidden" name="blogCount" value={blogs.length} />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {blogs.map((b, i) => (
          <div key={i} className="rounded-[12px] border p-3.5" style={{ borderColor: C.bd, background: C.v75 }}>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Blog {i + 1}</span>
              <Badge tone={BLOG_TONE[b.status]}>{b.status}</Badge>
            </div>
            <div className="grid gap-2.5">
              <div><Lbl>Blog Title</Lbl><input name={`blog_${i}_title`} value={b.title} onChange={(e) => set(i, "title", e.target.value)} placeholder="Enter blog title, e.g. 10 Best Skin Care Tips" style={fld} /></div>
              <div><Lbl>Blog Link</Lbl><input name={`blog_${i}_link`} value={b.link} onChange={(e) => set(i, "link", e.target.value)} placeholder="https://..." style={fld} /></div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div><Lbl>Status</Lbl><Select name={`blog_${i}_status`} value={b.status} onChange={(v) => set(i, "status", v)} options={BLOG_STATUSES} /></div>
                <div><Lbl>Date</Lbl><input name={`blog_${i}_date`} type="date" value={b.date} onChange={(e) => set(i, "date", e.target.value)} style={fld} /></div>
              </div>
            </div>
          </div>
        ))}
        {blogs.length === 0 && <p className="rounded-[12px] border p-4 text-center text-[12.5px] md:col-span-2" style={{ borderColor: C.bd, color: C.faint }}>No blogs yet — add one below.</p>}
      </div>
      <TabFooter onAdd={() => setBlogs([...blogs, { title: "", link: "", status: "Draft", date: "" }])} addLabel="+ Add Blog" importNode={<ImportRow hint="One blog per line: Title, Link, Status (Published/Draft/Pending Review), Date (YYYY-MM-DD)." placeholder={"Diabetes care guide\thttps://...\tPublished\t2026-08-05"} onImport={(rows) => setBlogs([...blogs.filter((b) => b.title || b.link || b.date || b.status !== "Draft"), ...rows.map((r) => ({ title: r[0] ?? "", link: r[1] ?? "", status: normBlogStatus(r[2] ?? ""), date: r[3] ?? "" }))])} />} />
    </div>
  );
}

/* ---------- Keywords tab ---------- */
function KeywordsTab({ kws, setKws }: { kws: Kw[]; setKws: (k: Kw[]) => void }) {
  const set = (i: number, k: keyof Kw, v: string) => setKws(kws.map((r, idx) => (idx === i ? { ...r, [k]: k === "keyword" ? v : (parseInt(v) || 0) } : r)));
  const diffs = kws.map((k) => k.lastPos - k.currPos); // positive = improved (lower position number)
  const improved = diffs.filter((d) => d > 0).length, dropped = diffs.filter((d) => d < 0).length, stable = diffs.filter((d) => d === 0).length;
  const avg = diffs.length ? (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1) : "0";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-bold" style={{ color: C.ink }}>Keywords - Last Month Position vs Current Position Difference Auto</p>
        <div className="flex items-center gap-2"><span className="text-[11px]" style={{ color: C.faint }}>No of Keywords</span><CountSelect value={kws.length} options={[5, 10, 15, 20]} onChange={(n) => setKws(resize(kws, n, { keyword: "", lastPos: 0, currPos: 0 }))} /></div>
      </div>
      <input type="hidden" name="kwCount" value={kws.length} />
      <div className="mt-3 overflow-hidden rounded-[12px] border" style={{ borderColor: C.bd }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr style={{ background: C.v75 }}>{["Keyword", "Last Month Pos", "Current Pos (End This Month)", "Difference Auto", "Trend", "Action"].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{h}</th>)}</tr></thead>
            <tbody>
              {kws.map((k, i) => {
                const diff = k.lastPos - k.currPos, down = diff < 0;
                return (
                  <tr key={i} className="border-t" style={{ borderColor: C.v150 }}>
                    <td className="px-4 py-2.5"><input name={`kw_${i}_keyword`} value={k.keyword} onChange={(e) => set(i, "keyword", e.target.value)} placeholder="keyword" style={fld} /></td>
                    <td className="px-4 py-2.5 w-[100px]"><input name={`kw_${i}_last`} type="number" value={k.lastPos || ""} onChange={(e) => set(i, "lastPos", e.target.value)} className="text-center" style={fld} /></td>
                    <td className="px-4 py-2.5 w-[110px]"><input name={`kw_${i}_curr`} type="number" value={k.currPos || ""} onChange={(e) => set(i, "currPos", e.target.value)} className="text-center" style={{ ...fld, borderColor: down ? C.redBd : C.bd2, background: down ? C.redBg2 : "#fff" }} /></td>
                    <td className="px-4 py-2.5"><DiffPill diff={diff} /></td>
                    <td className="px-4 py-2.5"><TrendCell diff={diff} /></td>
                    <td className="px-4 py-2.5"><button type="button" onClick={() => setKws(kws.filter((_, x) => x !== i))} className="grid h-7 w-7 place-items-center rounded-md border" style={{ borderColor: C.redBd, color: C.red }}><X size={13} /></button></td>
                  </tr>
                );
              })}
              {kws.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-[12.5px]" style={{ color: C.faint }}>No keywords yet — add one below.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] border p-3" style={{ borderColor: C.bd, background: C.v75 }}>
        <span className="text-[12.5px] font-bold" style={{ color: C.ink2 }}>Summary:</span>
        <Pill bg={C.v150} fg={C.ink2}>Total {kws.length}</Pill>
        <Pill bg={C.greenBg} fg={C.greenD}>Improved {improved}</Pill>
        <Pill bg={C.redBg} fg={C.redD}>Dropped {dropped}</Pill>
        <Pill bg={C.v150} fg={C.muted}>No Change {stable}</Pill>
        <Pill bg={C.v200} fg={C.violet}>Avg Diff {+avg > 0 ? "+" : ""}{avg}</Pill>
      </div>
      <TabFooter onAdd={() => setKws([...kws, { keyword: "", lastPos: 0, currPos: 0 }])} addLabel="+ Add Keyword" importNode={<ImportRow hint="One keyword per line: Keyword, Last-month position, Current position." placeholder={"skin treatment cost\t18\t9"} onImport={(rows) => setKws([...kws.filter((k) => k.keyword || k.lastPos || k.currPos), ...rows.map((r) => ({ keyword: r[0] ?? "", lastPos: parseInt(r[1]) || 0, currPos: parseInt(r[2]) || 0 }))])} />} />
    </div>
  );
}

/* ---------- Backlinks tab ---------- */
function BacklinksTab({ bls, setBls, target }: { bls: Bl[]; setBls: (b: Bl[]) => void; target: number }) {
  const set = (i: number, k: keyof Bl, v: string) => setBls(bls.map((r, idx) => (idx === i ? { ...r, [k]: k === "da" ? (parseInt(v) || 0) : v } : r)));
  const live = bls.filter((b) => b.status === "Live").length, pending = bls.filter((b) => b.status === "Pending").length;
  const tPct = target ? Math.min(100, Math.round((live / target) * 100)) : 0;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-bold" style={{ color: C.ink }}>Backlinks - Type of Link Dropdown and Links</p>
        <div className="flex items-center gap-2"><span className="text-[11px]" style={{ color: C.faint }}>No of Backlinks</span><CountSelect value={bls.length} options={[1, 3, 5, 10]} onChange={(n) => setBls(resize(bls, n, { type: "Guest Post", status: "Live", link: "", da: 0, date: "" }))} /></div>
      </div>
      {target > 0 && (
        <div className="mt-2 flex items-center gap-3 rounded-[10px] border p-2.5" style={{ borderColor: C.bd, background: C.v75 }}>
          <span className="text-[12px] font-semibold" style={{ color: C.ink2 }}>Monthly target</span>
          <span className="text-[12.5px] font-bold" style={{ color: tPct >= 100 ? C.greenD : C.violet }}>{live} / {target} live</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: C.v200 }}><div className="h-full rounded-full" style={{ width: `${tPct}%`, background: tPct >= 100 ? C.green : C.violet }} /></div>
          <span className="text-[12px] font-bold" style={{ color: C.muted }}>{tPct}%</span>
        </div>
      )}
      <input type="hidden" name="blCount" value={bls.length} />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {bls.map((b, i) => (
          <div key={i} className="rounded-[12px] border p-3.5" style={{ borderColor: C.bd, background: C.v75 }}>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Backlink {i + 1}</span>
              <Badge tone={BL_TONE[b.status]}>{b.status}</Badge>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div><Lbl>Type of Link</Lbl><Select name={`bl_${i}_type`} value={b.type} onChange={(v) => set(i, "type", v)} options={BL_TYPES} /></div>
              <div><Lbl>Status</Lbl><Select name={`bl_${i}_status`} value={b.status} onChange={(v) => set(i, "status", v)} options={BL_STATUSES} /></div>
              <div className="sm:col-span-2"><Lbl>Link</Lbl><input name={`bl_${i}_link`} value={b.link} onChange={(e) => set(i, "link", e.target.value)} placeholder="https://..." style={fld} /></div>
              <div><Lbl>Domain Authority</Lbl><input name={`bl_${i}_da`} type="number" value={b.da || ""} onChange={(e) => set(i, "da", e.target.value)} placeholder="DA 45" style={fld} /></div>
              <div><Lbl>Date</Lbl><input name={`bl_${i}_date`} type="date" value={b.date} onChange={(e) => set(i, "date", e.target.value)} style={fld} /></div>
            </div>
          </div>
        ))}
        {bls.length === 0 && <p className="rounded-[12px] border p-4 text-center text-[12.5px] md:col-span-2" style={{ borderColor: C.bd, color: C.faint }}>No backlinks yet — add one below.</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] border p-3" style={{ borderColor: C.bd, background: C.v75 }}>
        <span className="text-[12.5px] font-bold" style={{ color: C.ink2 }}>Summary:</span>
        <Pill bg={C.v150} fg={C.ink2}>Total {bls.length}</Pill>
        <Pill bg={C.greenBg} fg={C.greenD}>Live {live}</Pill>
        <Pill bg={C.amberBg} fg={C.amber}>Pending {pending}</Pill>
      </div>
      <TabFooter onAdd={() => setBls([...bls, { type: "Guest Post", status: "Live", link: "", da: 0, date: "" }])} addLabel="+ Add Backlink" importNode={<ImportRow hint="One backlink per line: Type, Status (Live/Pending/Removed), Link, DA, Date." placeholder={"Guest Post\tLive\thttps://...\t45\t2026-08-12"} onImport={(rows) => setBls([...bls.filter((b) => b.link || b.da || b.date), ...rows.map((r) => ({ type: r[0] || "Guest Post", status: normBlStatus(r[1] ?? ""), link: r[2] ?? "", da: parseInt(r[3]) || 0, date: r[4] ?? "" }))])} />} />
    </div>
  );
}

/* ---------- GSC tab ---------- */
function GscTab({ gsc, setGsc, prev, chart, da, setDa }: { gsc: Client["gsc"]; setGsc: (g: Client["gsc"]) => void; prev: Client["gscPrev"]; chart: Client["chart"]; da: number; setDa: (n: number) => void }) {
  const ctr = gsc.impressions ? ((gsc.clicks / gsc.impressions) * 100).toFixed(2) : "0";
  return (
    <div>
      <p className="mb-3 text-[13px] font-bold" style={{ color: C.ink }}>Google Search Console - Last 28 Days</p>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Impressions"><input name="gsc_impressions" type="number" value={gsc.impressions || ""} onChange={(e) => setGsc({ ...gsc, impressions: parseInt(e.target.value) || 0 })} style={fld} /></MetricCard>
        <MetricCard label="Clicks"><input name="gsc_clicks" type="number" value={gsc.clicks || ""} onChange={(e) => setGsc({ ...gsc, clicks: parseInt(e.target.value) || 0 })} style={fld} /></MetricCard>
        <MetricCard label="CTR Auto (Clicks/Impressions*100)"><div className="rounded-[10px] px-3 py-2 text-[13px] font-bold" style={{ background: C.v150, color: C.violet }}>{ctr}%</div></MetricCard>
        <MetricCard label="Average Position"><input name="gsc_position" type="number" step="0.1" value={gsc.position || ""} onChange={(e) => setGsc({ ...gsc, position: parseFloat(e.target.value) || 0 })} style={fld} /></MetricCard>
        <MetricCard label="Domain Authority (DA)"><input name="da" type="number" value={da || ""} onChange={(e) => setDa(parseInt(e.target.value) || 0)} style={fld} /></MetricCard>
      </div>
      {prev && <Compare items={[["Last Month Impressions", prev.impressions, gsc.impressions], ["Clicks", prev.clicks, gsc.clicks]]} />}
      <BarChart title="Impressions vs Clicks Last 6 Months" chart={chart} a="impressions" b="clicks" aLabel="Impressions" bLabel="Clicks" />
      <p className="mt-2 text-[11px]" style={{ color: C.faint }}>Data from Google Search Console.</p>
    </div>
  );
}

/* ---------- GA4 tab ---------- */
function GaTab({ ga, setGa, prev, chart }: { ga: Client["ga"]; setGa: (g: Client["ga"]) => void; prev: Client["gaPrev"]; chart: Client["chart"] }) {
  return (
    <div>
      <p className="mb-3 text-[13px] font-bold" style={{ color: C.ink }}>Google Analytics - Active Users New Users Organic Search</p>
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Active Users"><input name="ga_active" type="number" value={ga.active || ""} onChange={(e) => setGa({ ...ga, active: parseInt(e.target.value) || 0 })} style={fld} /></MetricCard>
        <MetricCard label="New Users"><input name="ga_new" type="number" value={ga.newUsers || ""} onChange={(e) => setGa({ ...ga, newUsers: parseInt(e.target.value) || 0 })} style={fld} /></MetricCard>
        <MetricCard label="Organic Search Users"><input name="ga_organic" type="number" value={ga.organic || ""} onChange={(e) => setGa({ ...ga, organic: parseInt(e.target.value) || 0 })} style={fld} /></MetricCard>
        <MetricCard label="Organic Social"><input name="ga_organicsocial" type="number" value={ga.organicSocial || ""} onChange={(e) => setGa({ ...ga, organicSocial: parseInt(e.target.value) || 0 })} style={fld} /></MetricCard>
        <MetricCard label="Total Sessions"><input name="ga_sessions" type="number" value={ga.sessions || ""} onChange={(e) => setGa({ ...ga, sessions: parseInt(e.target.value) || 0 })} style={fld} /></MetricCard>
        <MetricCard label="Bounce Rate"><input name="ga_bounce" type="number" step="0.1" value={ga.bounce || ""} onChange={(e) => setGa({ ...ga, bounce: parseFloat(e.target.value) || 0 })} style={fld} /></MetricCard>
        <MetricCard label="Avg Engagement Time"><input name="ga_engagement" value={ga.engagement} onChange={(e) => setGa({ ...ga, engagement: e.target.value })} placeholder="2m 15s" style={fld} /></MetricCard>
      </div>
      {prev && <Compare items={[["Last Month Active", prev.active, ga.active], ["Organic", prev.organic, ga.organic]]} />}
      <BarChart title="Active vs Organic Last 6 Months" chart={chart} a="active" b="organic" aLabel="Active Users" bLabel="Organic" />
      <p className="mt-2 text-[11px]" style={{ color: C.faint }}>Data from Google Analytics (GA4).</p>
    </div>
  );
}

/* ---------- Work Report tab (what we did, day by day — to send the client) ---------- */
const niceDate = (d: string) => { if (!d) return "—"; const dt = new Date(d + "T00:00:00"); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }); };
function WorkReportTab({ c, month, blogs, bls, kws, gsc, ga }: { c: Client; month: string; blogs: Blog[]; bls: Bl[]; kws: Kw[]; gsc: Client["gsc"]; ga: Client["ga"] }) {
  const monthLabel = new Date(month + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const pubBlogs = blogs.filter((b) => b.status === "Published");
  const liveBl = bls.filter((b) => b.status === "Live");
  const kwUp = kws.filter((k) => k.keyword && k.lastPos - k.currPos > 0).map((k) => ({ kw: k.keyword, from: k.lastPos, to: k.currPos, gain: k.lastPos - k.currPos }));
  const pct = (cur: number, prev?: number) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0);
  const clkP = pct(gsc.clicks, c.gscPrev?.clicks), imprP = pct(gsc.impressions, c.gscPrev?.impressions), usrP = pct(ga.active, c.gaPrev?.active);

  // day-by-day events (blogs by blogDate, backlinks by date)
  const events: { date: string; text: string }[] = [];
  pubBlogs.forEach((b) => events.push({ date: b.date, text: `Published blog: ${b.title || "Blog"}${b.link ? ` (${b.link})` : ""}` }));
  liveBl.forEach((b) => events.push({ date: b.date, text: `Built backlink: ${b.type}${b.link ? ` (${b.link})` : ""}${b.da ? ` — DA ${b.da}` : ""}` }));
  const byDate = new Map<string, string[]>();
  events.filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => { const k = e.date; byDate.set(k, [...(byDate.get(k) ?? []), e.text]); });
  const days = [...byDate.entries()];

  const buildText = () => {
    const L: string[] = [];
    L.push(`WebRocz — SEO Work Report`); L.push(`Client: ${c.name}   |   Month: ${monthLabel}`); L.push("");
    L.push(`SUMMARY`);
    L.push(`- Blogs published: ${pubBlogs.length}`);
    L.push(`- Backlinks built: ${liveBl.length}`);
    L.push(`- Keywords improved: ${kwUp.length}`);
    L.push(`- Search clicks: ${gsc.clicks} (${clkP >= 0 ? "+" : ""}${clkP}% vs last month)`);
    L.push(`- Impressions: ${gsc.impressions} (${imprP >= 0 ? "+" : ""}${imprP}%)`);
    L.push(`- Website users: ${ga.active} (${usrP >= 0 ? "+" : ""}${usrP}%)`);
    L.push("");
    if (days.length) { L.push(`DAY-BY-DAY WORK`); days.forEach(([d, items]) => { L.push(`${niceDate(d)}:`); items.forEach((t) => L.push(`  • ${t}`)); }); L.push(""); }
    if (kwUp.length) { L.push(`KEYWORD MOVEMENTS`); kwUp.forEach((k) => L.push(`  • ${k.kw}: #${k.from} → #${k.to} (up ${k.gain})`)); L.push(""); }
    L.push(`— Prepared by WebRocz SEO team`);
    return L.join("\n");
  };
  const copy = () => { navigator.clipboard?.writeText(buildText()); };
  const download = () => { const blob = new Blob([buildText()], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${c.name.replace(/[^a-z0-9]+/gi, "-")}-Work-Report-${month}.txt`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };

  const Stat = ({ label, v, tone }: { label: string; v: React.ReactNode; tone: string }) => <div className="rounded-[12px] border p-3" style={{ borderColor: C.bd, background: C.v75 }}><div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.faint }}>{label}</div><div className="mt-0.5 text-[20px] font-extrabold" style={{ color: tone }}>{v}</div></div>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-bold" style={{ color: C.ink }}>Work Report — {c.name} · {monthLabel}</p>
        <div className="flex gap-2">
          <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: C.bd2, color: C.ink2, background: "#fff" }}><FileText size={13} /> Copy to send</button>
          <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold text-white" style={{ background: C.violet }}><Download size={13} /> Download</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Blogs published" v={pubBlogs.length} tone={C.violet} />
        <Stat label="Backlinks built" v={liveBl.length} tone={C.greenD} />
        <Stat label="Keywords improved" v={kwUp.length} tone={C.violet} />
        <Stat label="Search clicks" v={<>{gsc.clicks} <span style={{ fontSize: 12, color: clkP >= 0 ? C.green : C.red }}>{clkP >= 0 ? "▲" : "▼"}{Math.abs(clkP)}%</span></>} tone={C.ink} />
      </div>

      {/* day-by-day */}
      <div className="mt-4 rounded-[12px] border" style={{ borderColor: C.bd }}>
        <div className="border-b px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide" style={{ borderColor: C.v150, color: C.muted, background: C.v75 }}>Day-by-day work</div>
        <div className="divide-y" style={{ borderColor: C.v150 }}>
          {days.map(([d, items]) => (
            <div key={d} className="flex gap-3 p-3">
              <div className="w-[64px] flex-none text-[12.5px] font-bold" style={{ color: C.violet }}>{niceDate(d)}</div>
              <ul className="flex-1 space-y-1">{items.map((t, i) => <li key={i} className="text-[12.5px]" style={{ color: C.ink2 }}>• {t}</li>)}</ul>
            </div>
          ))}
          {days.length === 0 && <div className="p-4 text-center text-[12.5px]" style={{ color: C.faint }}>No dated blog/backlink work yet. Add dates in the Blogs & Backlinks tabs and they&apos;ll appear here.</div>}
        </div>
      </div>

      {kwUp.length > 0 && (
        <div className="mt-4 rounded-[12px] border" style={{ borderColor: C.bd }}>
          <div className="border-b px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide" style={{ borderColor: C.v150, color: C.muted, background: C.v75 }}>Keyword movements</div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {kwUp.map((k, i) => <div key={i} className="flex items-center justify-between rounded-[8px] border px-3 py-1.5 text-[12.5px]" style={{ borderColor: C.bd2 }}><span className="font-semibold">{k.kw}</span><span style={{ color: C.greenD }}>#{k.from} → #{k.to} ▲{k.gain}</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Monthly Data tab (month-by-month GSC + GA + DA table) ---------- */
const fmtK = (n: number) => (n >= 1000 ? (n / 1000).toFixed(2).replace(/\.00$/, "") + "k" : String(n));
const dash = (n: number) => (n ? n.toLocaleString("en-IN") : "-");
function MonthlyTab({ rows, da, name }: { rows: Client["monthly"]; da: number; name: string }) {
  const gscHead: React.CSSProperties = { background: "#FEF3C7", color: "#854D0E", fontWeight: 700 };
  const gaHead: React.CSSProperties = { background: "#FFEDD5", color: "#9A3412", fontWeight: 700 };
  const daHead: React.CSSProperties = { background: C.greenBg, color: C.greenD, fontWeight: 700 };
  const subHead: React.CSSProperties = { background: C.greenBg, color: C.greenD, fontWeight: 700, fontSize: 11, padding: "8px 10px", border: `1px solid ${C.bd2}` };
  const cell: React.CSSProperties = { padding: "10px", border: `1px solid ${C.bd2}`, fontSize: 12.5, color: C.ink };
  // value + month-over-month trend (▲/▼ with the difference). invert=true → lower is better (Avg Position).
  const tv = (cur: number, prev: number | undefined, kind: "int" | "k" | "pct" | "pos", invert = false) => {
    const txt = kind === "k" ? (cur ? fmtK(cur) : "—") : kind === "pct" ? (cur ? `${cur}%` : "—") : kind === "pos" ? (cur || "—") : dash(cur);
    if (prev == null || cur === 0) return <span style={{ fontWeight: 600 }}>{txt}</span>;
    const delta = +(cur - prev).toFixed(kind === "pct" || kind === "pos" ? 1 : 0);
    const good = delta === 0 ? null : invert ? delta < 0 : delta > 0;
    const dtxt = Math.abs(delta) >= 1000 ? (Math.abs(delta) / 1000).toFixed(1) + "k" : Math.abs(delta);
    return (<><div style={{ fontWeight: 600 }}>{txt}</div>{delta !== 0 && <div style={{ fontSize: 10, fontWeight: 700, color: good ? C.green : C.red, marginTop: 2 }}>{good ? "▲" : "▼"} {dtxt}</div>}</>);
  };
  return (
    <div>
      <p className="mb-3 text-[13px] font-bold" style={{ color: C.ink }}>Monthly Performance — {name} <span className="font-medium" style={{ color: C.muted }}>· ▲ up / ▼ down vs previous month</span></p>
      <div className="overflow-x-auto rounded-[12px] border" style={{ borderColor: C.bd }}>
        <table className="w-full min-w-[920px] border-collapse text-center">
          <thead>
            <tr>
              <th style={subHead} rowSpan={2}>Month</th>
              <th style={{ ...gscHead, padding: 8, border: `1px solid ${C.bd2}` }} colSpan={4}>Google Search Console</th>
              <th style={{ ...gaHead, padding: 8, border: `1px solid ${C.bd2}` }} colSpan={4}>Google Analytics</th>
              <th style={{ ...daHead, padding: 8, border: `1px solid ${C.bd2}` }} rowSpan={2}>DA</th>
            </tr>
            <tr>
              {["Total Clicks", "Total Impressions", "Avg. CTR (%)", "Avg. Position", "Active Users", "New Users", "Organic Social", "Organic Search"].map((h) => <th key={h} style={subHead}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const p = i > 0 ? rows[i - 1] : undefined;
              return (
              <tr key={m.month}>
                <td style={{ ...cell, fontWeight: 700, background: C.v75 }}>{m.label}</td>
                <td style={cell}>{tv(m.clicks, p?.clicks, "int")}</td>
                <td style={cell}>{tv(m.impressions, p?.impressions, "k")}</td>
                <td style={cell}>{tv(m.ctr, p?.ctr, "pct")}</td>
                <td style={cell}>{tv(m.position, p?.position, "pos", true)}</td>
                <td style={cell}>{tv(m.active, p?.active, "int")}</td>
                <td style={cell}>{tv(m.newUsers, p?.newUsers, "int")}</td>
                <td style={cell}>{tv(m.organicSocial, p?.organicSocial, "int")}</td>
                <td style={cell}>{tv(m.organicSearch, p?.organicSearch, "int")}</td>
                {i === 0 && <td style={{ ...cell, fontWeight: 700, background: C.greenBg2, verticalAlign: "middle" }} rowSpan={rows.length}>{da || "-"}</td>}
              </tr>
              );
            })}
            {rows.length === 0 && <tr><td style={cell} colSpan={10}>No monthly data yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px]" style={{ color: C.faint }}>Edit each month&apos;s numbers in the GSC / GA4 tabs (switch the Month selector at the top to add other months).</p>
    </div>
  );
}

/* ============ small pieces ============ */
const fld: React.CSSProperties = { width: "100%", background: "#fff", border: `1px solid ${C.bd2}`, borderRadius: 10, padding: "8px 10px", fontSize: 13, color: C.ink, outline: "none" };
function Tag({ children }: { children: React.ReactNode }) { return <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: C.v200, color: C.violet }}>{children}</span>; }
function Badge({ tone, children }: { tone?: [string, string]; children: React.ReactNode }) { const [bg, fg] = tone ?? [C.v150, C.muted]; return <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: bg, color: fg }}>{children}</span>; }
function Sum({ label, v, tone }: { label: string; v: React.ReactNode; tone?: string }) { return <span className="rounded-lg px-2.5 py-1 font-semibold" style={{ background: C.v150, color: tone ?? C.ink2 }}>{label}: <b style={{ color: tone ?? C.ink }}>{v}</b></span>; }
function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-dashed px-3 py-2 text-[12.5px] font-semibold" style={{ borderColor: C.bd3, color: C.violet, background: C.v100 }}>{children}</button>; }
function Lbl({ children }: { children: React.ReactNode }) { return <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide" style={{ color: C.faint }}>{children}</span>; }
function Pill({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) { return <span className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: bg, color: fg }}>{children}</span>; }
function MetricCard({ label, children }: { label: string; children: React.ReactNode }) { return <div className="rounded-[12px] border p-3" style={{ borderColor: C.bd, background: C.v75 }}><Lbl>{label}</Lbl>{children}</div>; }
function CountSelect({ value, options, onChange }: { value: number; options: number[]; onChange: (n: number) => void }) {
  const opts = [...new Set([...options, value])].sort((a, b) => a - b);
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="appearance-none rounded-[8px] border bg-white py-1.5 pl-3 pr-8 text-[13px] font-semibold outline-none" style={{ borderColor: C.bd2, color: C.ink }}>
        {opts.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: C.faint }} />
    </div>
  );
}
function DiffPill({ diff }: { diff: number }) {
  if (diff > 0) return <Pill bg={C.greenBg} fg={C.greenD}>+{diff} Improved</Pill>;
  if (diff < 0) return <Pill bg={C.redBg} fg={C.redD}>{diff} Dropped</Pill>;
  return <Pill bg={C.v150} fg={C.muted}>0 No Change</Pill>;
}
function TrendCell({ diff }: { diff: number }) {
  const up = diff > 0, down = diff < 0, c = up ? C.green : down ? C.red : C.muted;
  return <span className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: c }}>{up ? <><TrendingUp size={13} /> Up</> : down ? <><TrendingDown size={13} /> Down</> : <><Minus size={13} /> Stable</>}</span>;
}
function TabFooter({ onAdd, addLabel, importNode }: { onAdd: () => void; addLabel: string; importNode: React.ReactNode }) {
  return (
    <div className="mt-3 flex flex-wrap items-start gap-2">
      <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-[10px] border border-dashed px-3 py-2 text-[12.5px] font-semibold" style={{ borderColor: C.bd3, color: C.violet, background: C.v100 }}>{addLabel}</button>
      {importNode}
    </div>
  );
}
function Select({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative w-full">
      <select name={name} value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none rounded-[10px] border bg-white py-2 pl-2.5 pr-7 text-[12.5px] outline-none" style={{ borderColor: C.bd2, color: C.ink }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: C.faint }} />
    </div>
  );
}
function Compare({ items }: { items: [string, number, number][] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] border p-3" style={{ borderColor: C.bd, background: C.v75 }}>
      <span className="text-[12.5px] font-bold" style={{ color: C.ink2 }}>Comparison:</span>
      {items.map(([label, prev, cur]) => {
        const delta = prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0;
        const up = delta >= 0;
        return (
          <span key={label} className="inline-flex items-center gap-2">
            <Pill bg={C.v150} fg={C.ink2}>{label} {prev.toLocaleString("en-IN")}</Pill>
            <Pill bg={C.v150} fg={C.ink2}>Current {cur.toLocaleString("en-IN")}</Pill>
            <Pill bg={up ? C.greenBg : C.redBg} fg={up ? C.greenD : C.redD}>{up ? "+" : ""}{delta}% {up ? "Improved" : "Dropped"}</Pill>
          </span>
        );
      })}
    </div>
  );
}
function BarChart({ title, chart, a, b, aLabel, bLabel }: { title: string; chart: Client["chart"]; a: keyof Client["chart"][number]; b: keyof Client["chart"][number]; aLabel: string; bLabel: string }) {
  const max = Math.max(1, ...chart.map((d) => Math.max(Number(d[a]), Number(d[b]))));
  return (
    <div className="mt-4 rounded-[12px] border p-4" style={{ borderColor: C.bd, background: C.v75 }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{title}</span>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: C.muted }}>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.violet }} /> {aLabel}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.violetSoft }} /> {bLabel}</span>
        </div>
      </div>
      <div className="flex h-[92px] items-end gap-3">
        {chart.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-[72px] w-full items-end justify-center gap-1">
              <div className="w-[45%] rounded-t" style={{ height: `${(Number(d[a]) / max) * 100}%`, background: C.violet, minHeight: 2 }} title={`${aLabel}: ${d[a]}`} />
              <div className="w-[45%] rounded-t" style={{ height: `${(Number(d[b]) / max) * 100}%`, background: C.violetSoft, minHeight: 2 }} title={`${bLabel}: ${d[b]}`} />
            </div>
            <span className="text-[10px]" style={{ color: C.faint }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function resize<T>(arr: T[], n: number, blank: T): T[] {
  if (n <= arr.length) return arr.slice(0, n);
  return [...arr, ...Array.from({ length: n - arr.length }, () => ({ ...blank }))];
}

/* ---- Excel import: paste rows from a sheet (tab- or comma-separated) ---- */
function ImportRow({ hint, placeholder, onImport }: { hint: string; placeholder: string; onImport: (rows: string[][]) => void }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[12px] font-semibold" style={{ borderColor: C.bd2, color: C.ink2, background: "#fff" }}><Upload size={13} /> Import from Excel</button>;
  const doImport = () => {
    const rows = txt.split(/\r?\n/).map((l) => l.split(/\t|,/).map((c) => c.trim())).filter((r) => r.some((c) => c));
    if (rows.length) onImport(rows);
    setTxt(""); setOpen(false);
  };
  return (
    <div className="w-full rounded-[12px] border p-3" style={{ borderColor: C.bd3, background: C.v100 }}>
      <p className="mb-1.5 text-[12px] font-semibold" style={{ color: C.ink2 }}>Paste from Excel</p>
      <p className="mb-2 text-[11px]" style={{ color: C.muted }}>{hint}</p>
      <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={4} placeholder={placeholder} className="w-full rounded-[10px] border p-2 font-mono text-[12px] outline-none" style={{ borderColor: C.bd2 }} />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={doImport} className="rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold text-white" style={{ background: C.violet }}>Import rows</button>
        <button type="button" onClick={() => { setTxt(""); setOpen(false); }} className="rounded-[10px] border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: C.bd2, color: C.ink2 }}>Cancel</button>
      </div>
    </div>
  );
}

const csvCell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function downloadClientCsv(c: Client, blogs: Blog[], kws: Kw[], bls: Bl[], gsc: Client["gsc"], ga: Client["ga"], month: string) {
  const L: string[] = [];
  L.push(`WebRocz SEO Report,${csvCell(c.name)},${month}`);
  L.push(`Industry,${csvCell(c.industry)},POC,${csvCell(c.poc)},SEO Budget,${inr(c.budget)}`);
  L.push("");
  L.push("BLOGS"); L.push("#,Title,Link,Status,Date");
  blogs.forEach((b, i) => L.push([i + 1, csvCell(b.title), csvCell(b.link), b.status, b.date].join(",")));
  L.push("");
  L.push("KEYWORDS"); L.push("#,Keyword,Last Position,Current Position,Difference");
  kws.forEach((k, i) => L.push([i + 1, csvCell(k.keyword), k.lastPos, k.currPos, k.lastPos - k.currPos].join(",")));
  L.push("");
  L.push("BACKLINKS"); L.push("#,Type,Status,Link,Domain Authority,Date");
  bls.forEach((b, i) => L.push([i + 1, csvCell(b.type), b.status, csvCell(b.link), b.da, b.date].join(",")));
  L.push("");
  const ctr = gsc.impressions ? ((gsc.clicks / gsc.impressions) * 100).toFixed(2) : "0";
  L.push("SEARCH CONSOLE"); L.push(`Impressions,${gsc.impressions}`); L.push(`Clicks,${gsc.clicks}`); L.push(`CTR %,${ctr}`); L.push(`Avg Position,${gsc.position}`);
  L.push("");
  L.push("GOOGLE ANALYTICS"); L.push(`Active Users,${ga.active}`); L.push(`New Users,${ga.newUsers}`); L.push(`Organic Search,${ga.organic}`); L.push(`Organic Social,${ga.organicSocial}`); L.push(`Sessions,${ga.sessions}`); L.push(`Bounce Rate %,${ga.bounce}`); L.push(`Avg Engagement,${csvCell(ga.engagement)}`);
  L.push(""); L.push(`Domain Authority (DA),${c.da}`);
  const blob = new Blob(["﻿" + L.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${c.name.replace(/[^a-z0-9]+/gi, "-")}-SEO-${month}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const normBlogStatus = (s: string) => { const l = (s || "").toLowerCase(); return l.startsWith("pub") ? "Published" : l.startsWith("pend") || l.startsWith("rev") ? "Pending Review" : "Draft"; };
const normBlStatus = (s: string) => { const l = (s || "").toLowerCase(); return l.startsWith("rem") ? "Removed" : l.startsWith("pen") ? "Pending" : "Live"; };
