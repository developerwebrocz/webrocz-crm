"use client";

import { useMemo, useState } from "react";
import { DESIGN_TYPES, VIDEO_TYPES } from "@/lib/domain";
import { saveCreativeTask, setCreativeStatus, addCreativeTask, deleteCreativeTask, logout } from "@/app/actions";
import Notifications from "@/components/Notifications";
import {
  Search, ChevronDown, Plus, ExternalLink, X, Palette, Clapperboard,
  CalendarClock, Play, Send, Check, Save, Eye, Home, Loader, CheckCircle2,
  AlertTriangle, ListChecks, Settings, Menu, Trash2, LogOut,
} from "lucide-react";

type AlertData = { count: number; items: { tone: string; title: string; sub: string; href: string }[] };

type Row = {
  id: string; code: string; title: string; client: string; type: string;
  priority: string; status: string; source: string; assignedDate: string; dueDate: string;
  dimensions: string; brief: string; notes: string; refLink: string; rawLink: string; finalLink: string;
  overdue: boolean; dueToday: boolean; dueLabel: string; rel: string;
};
type Counts = { total: number; dueToday: number; inProgress: number; review: number; completed: number; overdue: number };
type ClientOpt = { id: string; name: string };

// Clean, professional look: a STRONG left accent + a very faint background wash
// (not a heavy pastel flood). The expanded form always sits on pure white.
const STATUS_FILL: Record<string, { fill: string; edge: string }> = {
  PENDING: { fill: "rgba(245,158,11,.05)", edge: "#F59E0B" },
  IN_PROGRESS: { fill: "rgba(59,130,246,.05)", edge: "#3B82F6" },
  REVIEW: { fill: "rgba(139,92,246,.05)", edge: "#8B5CF6" },
  COMPLETED: { fill: "rgba(16,185,129,.05)", edge: "#10B981" },
};
const OVERDUE_FILL = { fill: "rgba(239,68,68,.05)", edge: "#EF4444" };
const STATUS_PILL: Record<string, { bg: string; fg: string; bd: string; label: string }> = {
  PENDING: { bg: "#FEF3C7", fg: "#92400E", bd: "#FDE68A", label: "Pending" },
  IN_PROGRESS: { bg: "#DBEAFE", fg: "#1E40AF", bd: "#BFDBFE", label: "In Progress" },
  REVIEW: { bg: "#E9D5FF", fg: "#6B21A8", bd: "#DDD6FE", label: "Review Pending" },
  COMPLETED: { bg: "#D1FAE5", fg: "#065F46", bd: "#A7F3D0", label: "Completed" },
};
const PRIORITY_PILL: Record<string, { bg: string; fg: string; bd: string }> = {
  HIGH: { bg: "#FEE2E2", fg: "#B91C1C", bd: "#FECACA" },
  MEDIUM: { bg: "#FEF9C3", fg: "#A16207", bd: "#FDE68A" },
  LOW: { bg: "#DCFCE7", fg: "#15803D", bd: "#BBF7D0" },
};
const STATUS_KEYS = ["PENDING", "IN_PROGRESS", "REVIEW", "COMPLETED"] as const;
const NEXT: Record<string, { label: (v: boolean) => string; to: string; kind: "primary" | "outline" | "green" } | null> = {
  PENDING: { label: (v) => (v ? "Start Editing" : "Start Designing"), to: "IN_PROGRESS", kind: "primary" },
  IN_PROGRESS: { label: () => "Send for Review", to: "REVIEW", kind: "outline" },
  REVIEW: { label: () => "Mark Completed", to: "COMPLETED", kind: "green" },
  COMPLETED: null,
};
// sidebar count-pill tints (on dark)
const NAV_TONE: Record<string, { bg: string; fg: string }> = {
  slate: { bg: "rgba(255,255,255,.10)", fg: "rgba(255,255,255,.75)" },
  orange: { bg: "rgba(249,115,22,.20)", fg: "#FDBA74" },
  blue: { bg: "rgba(59,130,246,.20)", fg: "#93C5FD" },
  purple: { bg: "rgba(168,85,247,.20)", fg: "#D8B4FE" },
  green: { bg: "rgba(16,185,129,.20)", fg: "#6EE7B7" },
  red: { bg: "rgba(239,68,68,.20)", fg: "#FCA5A5" },
};

function dayDiff(due: string, today: string) {
  if (!due) return null;
  return Math.round((Date.parse(due + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000);
}
function shortDate(d: string) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" }) : "";
}
function initials(name: string) {
  return (name || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

export default function CreativeBoard({
  kind, chrome = "embedded", rows, counts, clients, types, progress, today, clientOptions, userName, alerts,
}: {
  kind: "DESIGN" | "VIDEO"; chrome?: "studio" | "embedded"; rows: Row[]; counts: Counts; clients: string[]; types: string[];
  progress: number; today: string; clientOptions: ClientOpt[]; userName?: string; alerts?: AlertData;
}) {
  const isVideo = kind === "VIDEO";
  const L = isVideo
    ? { studio: "Video Studio", role: "Video Editor", crumb: "Video Editor", noun: "Videos", nounLow: "videos", nounOne: "Video",
        raw: "Raw Footage Link", rawPh: "Drive link", dim: "Duration", dimPh: "Ex: 30 sec or 1:20",
        final: "Final Video Link", finalPh: "Paste final video drive link", brief: "Brief / Script Link", briefPh: "Drive link or script text",
        refPh: "YouTube / reference link", searchPh: "Search videos, client, type…", icon: Clapperboard, allTypes: "All Types" }
    : { studio: "Design Studio", role: "Graphic Designer", crumb: "Designer", noun: "Designs", nounLow: "designs", nounOne: "Design",
        raw: "Raw Assets Link", rawPh: "Paste raw assets Drive link (logos, photos)", dim: "Dimensions / Size", dimPh: "Ex: 1080×1080 px or A4",
        final: "Final Design Link", finalPh: "Paste final design Drive link", brief: "Brief / Content", briefPh: "Content, offer details, text to include…",
        refPh: "Reference link (Behance / Dribbble / Drive)", searchPh: "Search designs, client, type…", icon: Palette, allTypes: "All Design Types" };
  const modalTypes = isVideo ? [...VIDEO_TYPES] : [...DESIGN_TYPES];

  const [q, setQ] = useState("");
  const [tab, setTab] = useState("ALL");
  const [client, setClient] = useState("ALL");
  const [due, setDue] = useState("ALL");
  const [origin, setOrigin] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [open, setOpen] = useState<Set<string>>(() => new Set(rows[0] ? [rows[0].id] : []));
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "DUE_TODAY" && !r.dueToday) return false;
      if (tab === "IN_PROGRESS" && r.status !== "IN_PROGRESS") return false;
      if (tab === "REVIEW" && r.status !== "REVIEW") return false;
      if (tab === "COMPLETED" && r.status !== "COMPLETED") return false;
      if (tab === "OVERDUE" && !r.overdue) return false;
      if (client !== "ALL" && r.client !== client) return false;
      if (type !== "ALL" && r.type !== type) return false;
      if (origin === "ONBOARDING" && r.source !== "ONBOARDING") return false;
      if (origin === "ADDITIONAL" && r.source !== "ADDITIONAL") return false;
      if (due === "TODAY" && !r.dueToday) return false;
      if (due === "OVERDUE" && !r.overdue) return false;
      if (due === "WEEK") { const d = dayDiff(r.dueDate, today); if (d === null || d < 0 || d > 7) return false; }
      if (n && !(r.title.toLowerCase().includes(n) || r.client.toLowerCase().includes(n) || r.code.toLowerCase().includes(n) || r.type.toLowerCase().includes(n))) return false;
      return true;
    });
  }, [rows, q, tab, client, type, origin, due, today]);

  const TABS = [
    { key: "ALL", label: `All ${L.noun}`, n: counts.total },
    { key: "DUE_TODAY", label: "Due Today", n: counts.dueToday },
    { key: "IN_PROGRESS", label: "In Progress", n: counts.inProgress },
    { key: "REVIEW", label: "Review Pending", n: counts.review },
    { key: "COMPLETED", label: "Completed", n: counts.completed },
    { key: "OVERDUE", label: "Overdue", n: counts.overdue },
  ];
  const NAV = [
    { key: "ALL", label: `My Assigned ${L.noun}`, icon: L.icon, n: counts.total, tone: "slate" },
    { key: "DUE_TODAY", label: "Due Today", icon: CalendarClock, n: counts.dueToday, tone: "orange" },
    { key: "IN_PROGRESS", label: "In Progress", icon: Loader, n: counts.inProgress, tone: "blue" },
    { key: "REVIEW", label: "Review Pending", icon: Eye, n: counts.review, tone: "purple" },
    { key: "COMPLETED", label: "Completed", icon: CheckCircle2, n: counts.completed, tone: "green" },
    { key: "OVERDUE", label: "Overdue", icon: AlertTriangle, n: counts.overdue, tone: "red" },
  ];

  const dueText = (r: Row) => {
    if (r.status === "COMPLETED") return { text: `Done · ${shortDate(r.dueDate)}`, over: false };
    const d = dayDiff(r.dueDate, today);
    if (d === null) return { text: "No due date", over: false };
    if (d < 0) return { text: `Overdue · ${-d}d ago`, over: true };
    if (d === 0) return { text: "Due Today", over: false };
    if (d === 1) return { text: "Due Tomorrow · 1 day left", over: false };
    return { text: `Due ${shortDate(r.dueDate)} · ${d} days left`, over: false };
  };

  const pickTab = (k: string) => { setTab(k); setDrawer(false); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };

  // ---- shared content pieces ----
  const toolbar = (
    <div className="cb-tools">
      <div className="cb-searchwrap">
        <Search size={15} className="cb-searchicon" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.searchPh} className="cb-search" />
      </div>
      <Sel value={client} onChange={setClient} all="All Clients" options={clients} />
      <Sel value={due} onChange={setDue} raw={[["ALL", "All Due Dates"], ["TODAY", "Today"], ["WEEK", "This Week"], ["OVERDUE", "Overdue"]]} />
      <Sel value={origin} onChange={setOrigin} raw={[["ALL", "All Types"], ["ONBOARDING", "Onboarding Agreed"], ["ADDITIONAL", "Additional"]]} />
      <Sel value={type} onChange={setType} all={L.allTypes} options={types} />
      <button onClick={() => setModal(true)} className="cb-btn cb-btn-purple"><Plus size={15} /> Add Additional {L.nounOne}</button>
    </div>
  );

  const kpiGrid = (
    <div className="cb-kpis">
      <Kpi label="Total Assigned" value={counts.total} sub={`all ${L.nounLow}`} tone="ink" bar={100} />
      <Kpi label="Due Today · Urgent" value={counts.dueToday} sub="needs attention" tone="orange" pill="Needs attention" alert={counts.dueToday > 0} />
      <Kpi label="In Progress" value={counts.inProgress} sub="active" tone="blue" bar={counts.total ? Math.round((counts.inProgress / counts.total) * 100) : 0} />
      <Kpi label="Completed" value={counts.completed} sub={`${progress}% done`} tone="green" bar={progress} />
      <Kpi label="Overdue" value={counts.overdue} sub="critical" tone="red" pill="Immediate action" alert={counts.overdue > 0} span2 />
    </div>
  );

  const chipBar = (
    <div className="cb-chips">
      {TABS.map((t) => (
        <button key={t.key} onClick={() => setTab(t.key)} className={`cb-chip ${tab === t.key ? "cb-chip-on" : ""}`}>
          {t.label}<span className="cb-chip-n">{t.n}</span>
        </button>
      ))}
      <span className="cb-showing">Showing {visible.length} of {counts.total}</span>
    </div>
  );

  const cardList = (
    <div className="cb-list">
      {visible.length === 0 && (
        <div className="cb-empty">
          <span className="cb-empty-icon"><L.icon size={22} /></span>
          <div className="cb-empty-title">No {L.nounLow} found</div>
          <div className="cb-empty-sub">Adjust filters or search query</div>
        </div>
      )}
      {visible.map((r) => {
        const sf = r.overdue ? OVERDUE_FILL : STATUS_FILL[r.status];
        const isOpen = open.has(r.id);
        const next = NEXT[r.status];
        const dt = dueText(r);
        const pr = PRIORITY_PILL[r.priority] ?? PRIORITY_PILL.MEDIUM;
        const sp = STATUS_PILL[r.status];
        return (
          <div key={r.id} className="cb-item" style={{ background: sf?.fill, borderLeft: `4px solid ${sf?.edge}` }}>
            <div className="cb-item-inner">
              <div className="cb-item-head">
                <div className="cb-item-left">
                  <div className="cb-item-titlerow">
                    <h3 className="cb-item-title">{r.title}</h3>
                    <span className="cb-idpill">{r.code}</span>
                    <span className="cb-origin" style={r.source === "ADDITIONAL"
                      ? { background: "#FFEDD5", color: "#C2410C", borderColor: "#FED7AA" }
                      : { background: "#EDE9FE", color: "#6D28D9", borderColor: "#DDD6FE" }}>
                      {r.source === "ADDITIONAL" ? "Additional" : "Onboarding Agreed"}
                    </span>
                  </div>
                  <div className="cb-meta">
                    <span className="cb-pill-client">{r.client}</span>
                    <span className="cb-pill-type">{r.type}</span>
                    <span className="cb-pill-prio" style={{ background: pr.bg, color: pr.fg, borderColor: pr.bd }}>{r.priority}</span>
                    <span className="cb-assigned">{r.code} · Assigned {r.assignedDate ? shortDate(r.assignedDate) : "—"}</span>
                  </div>
                </div>
                <div className="cb-item-right">
                  <span className="cb-due" style={dt.over ? { background: "#DC2626", color: "#fff", borderColor: "#DC2626", fontWeight: 600 } : undefined}>
                    <CalendarClock size={12} /> {dt.text}
                  </span>
                  <form action={setCreativeStatus} className="cb-statusform">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status} onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      className="cb-statussel" style={{ background: sp.bg, color: sp.fg, borderColor: sp.bd }}>
                      {STATUS_KEYS.map((k) => <option key={k} value={k}>{STATUS_PILL[k].label}</option>)}
                    </select>
                  </form>
                </div>
              </div>

              <div className="cb-item-foot">
                <button onClick={() => toggle(r.id)} className="cb-viewbtn"><Eye size={14} /> {isOpen ? "Hide Details" : "View Details"} <ChevronDown size={13} className={isOpen ? "cb-rot" : ""} /></button>
                {next && (
                  <form action={setCreativeStatus} className="cb-nextform">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value={next.to} />
                    <button className={`cb-btn ${next.kind === "primary" ? "cb-btn-purple" : next.kind === "green" ? "cb-btn-green" : "cb-btn-outline"}`}>
                      {next.kind === "primary" ? <Play size={14} /> : next.kind === "green" ? <Check size={14} /> : <Send size={14} />}
                      {next.label(isVideo)}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {isOpen && (
              <form action={saveCreativeTask} className="cb-detail">
                <input type="hidden" name="id" value={r.id} />
                <div className="cb-detail-grid">
                  <div className="cb-col">
                    <div className="cb-two">
                      <Field label="Assigned Date"><input disabled value={r.assignedDate || "—"} className="cb-fld cb-fld-ro" /></Field>
                      <Field label="Due Date"><input type="date" name="dueDate" defaultValue={r.dueDate} className="cb-fld" /></Field>
                    </div>
                    <Field label={L.dim}><input name="dimensions" defaultValue={r.dimensions} placeholder={L.dimPh} className="cb-fld" /></Field>
                    <Field label={L.brief}><textarea name="brief" defaultValue={r.brief} rows={3} placeholder={L.briefPh} className="cb-fld cb-ta" /></Field>
                    <Field label="Reference Link"><LinkInput name="refLink" value={r.refLink} placeholder={L.refPh} /></Field>
                  </div>
                  <div className="cb-col">
                    <Field label={L.raw}><LinkInput name="rawLink" value={r.rawLink} placeholder={L.rawPh} /></Field>
                    <Field label={L.final}><LinkInput name="finalLink" value={r.finalLink} placeholder={L.finalPh} /></Field>
                    <Field label="Editor Notes"><textarea name="notes" defaultValue={r.notes} rows={2} placeholder="Add notes…" className="cb-fld cb-ta" /></Field>
                    <div className="cb-infobox">
                      <div><span>Client:</span> <b>{r.client}</b></div>
                      <div><span>Type:</span> <b>{r.type}</b></div>
                      <div><span>Origin:</span> <b>{r.source === "ADDITIONAL" ? "Additional" : "Onboarding"}</b></div>
                      <div><span>Priority:</span> <b>{r.priority}</b></div>
                    </div>
                  </div>
                </div>
                <div className="cb-detail-foot">
                  <button formAction={deleteCreativeTask} className="cb-btn cb-btn-danger"
                    onClick={(e) => { if (!window.confirm(`Delete "${r.title}" (${r.code})? This can't be undone.`)) e.preventDefault(); }}>
                    <Trash2 size={14} /> Delete
                  </button>
                  <div className="cb-quicklinks">
                    {r.refLink && <a href={r.refLink} target="_blank" rel="noreferrer" className="cb-ql">Ref</a>}
                    {r.rawLink && <a href={r.rawLink} target="_blank" rel="noreferrer" className="cb-ql">Assets</a>}
                    {r.finalLink && <a href={r.finalLink} target="_blank" rel="noreferrer" className="cb-ql cb-ql-final">Final</a>}
                  </div>
                  <button type="submit" className="cb-btn cb-btn-dark"><Save size={14} /> Save {L.nounOne}</button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );

  const modalEl = modal && (
    <div className="cb-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
      <div className="cb-modal">
        <div className="cb-modal-head">
          <div>
            <h2 className="cb-modal-title">Add Additional {L.nounOne}</h2>
            <p className="cb-modal-sub">Origin will be set to “Additional” automatically</p>
          </div>
          <button onClick={() => setModal(false)} className="cb-modal-x"><X size={16} /></button>
        </div>
        <form action={addCreativeTask}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="assignedDate" value={today} />
          <div className="cb-modal-body">
            <div className="cb-two">
              <Field label="Client"><select name="clientId" className="cb-fld"><option value="">— Select client —</option>{clientOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label={`${L.nounOne} Type`}><select name="type" className="cb-fld">{modalTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
            </div>
            <Field label={`${L.nounOne} Title`}><input name="title" required placeholder={isVideo ? "Ex: Product Launch Reel 15 sec" : "Ex: Instagram Post — Offer Creative"} className="cb-fld" /></Field>
            <div className="cb-three">
              <Field label={L.dim}><input name="dimensions" placeholder={L.dimPh} className="cb-fld" /></Field>
              <Field label="Due Date"><input type="date" name="dueDate" className="cb-fld" /></Field>
              <Field label="Priority"><select name="priority" defaultValue="MEDIUM" className="cb-fld"><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></Field>
            </div>
            <Field label={L.brief}><textarea name="brief" rows={2} placeholder={L.briefPh} className="cb-fld cb-ta" /></Field>
            <div className="cb-two">
              <Field label="Reference Link"><input name="refLink" placeholder={L.refPh} className="cb-fld" /></Field>
              <Field label={L.raw}><input name="rawLink" placeholder={L.rawPh} className="cb-fld" /></Field>
            </div>
            <div className="cb-two">
              <Field label="Origin"><input disabled value="Additional" className="cb-fld" style={{ background: "#FFF7ED", color: "#C2410C", borderColor: "#FED7AA" }} /></Field>
              <Field label="Assigned To"><input disabled value={`${userName ?? "You"} · ${L.role}`} className="cb-fld cb-fld-ro" /></Field>
            </div>
          </div>
          <div className="cb-modal-foot">
            <button type="button" onClick={() => setModal(false)} className="cb-btn cb-btn-outline">Cancel</button>
            <button type="submit" className="cb-btn cb-btn-purple">Save Additional {L.nounOne}</button>
          </div>
        </form>
      </div>
    </div>
  );

  // ---- EMBEDDED (inside CRM shell: Super Admin / impersonation) ----
  if (chrome === "embedded") {
    return (
      <div>
        <style>{cssVars}</style>
        <div className="cb-head">
          <div>
            <div className="cb-crumb">{L.crumb} <span>›</span> My Assigned {L.noun}</div>
            <h1 className="cb-title">{L.crumb} · {L.noun}</h1>
            <p className="cb-sub">{counts.completed} of {counts.total} completed · {progress}% done this cycle</p>
          </div>
          {toolbar}
        </div>
        <div className="cb-card cb-prog">
          <span className="cb-prog-icon"><L.icon size={19} /></span>
          <div className="cb-prog-body">
            <div className="cb-prog-title">Progress</div>
            <div className="cb-prog-note">{counts.completed} of {counts.total} completed</div>
          </div>
          <span className="cb-prog-pct">{progress}%</span>
          <div className="cb-prog-track"><div className="cb-prog-fill" style={{ width: `${progress}%` }} /></div>
        </div>
        {kpiGrid}
        {chipBar}
        {cardList}
        {modalEl}
      </div>
    );
  }

  // ---- STUDIO (full-screen dedicated layout for the designer / editor) ----
  const sidebar = (
    <>
      <div className="cbs-brand">
        <span className="cbs-logo">WR</span>
        <div><div className="cbs-brand-name">WebRocz</div><div className="cbs-brand-sub">{L.studio}</div></div>
      </div>
      <div className="cbs-usercard">
        <span className="cbs-avatar">{initials(userName ?? "")}</span>
        <div className="cbs-user-body">
          <div className="cbs-user-name">{userName ?? "Team member"}</div>
          <div className="cbs-user-role">{L.role}</div>
        </div>
        <span className="cbs-online" title="Online" />
      </div>
      <nav className="cbs-nav">
        <button className={`cbs-navrow ${tab === "ALL" ? "cbs-navrow-on" : ""}`} onClick={() => pickTab("ALL")}>
          <span className="cbs-ico"><Home size={16} /></span><span className="cbs-navlabel">Home</span>
        </button>
        <div className="cbs-section">Workspace</div>
        {NAV.map((it) => {
          const on = it.key !== "ALL" && tab === it.key;
          const t = NAV_TONE[it.tone];
          return (
            <button key={it.key} className={`cbs-navrow ${on ? "cbs-navrow-on" : ""}`} onClick={() => pickTab(it.key)}>
              <span className="cbs-ico"><it.icon size={16} /></span>
              <span className="cbs-navlabel">{it.label}</span>
              <span className="cbs-count" style={{ background: t.bg, color: t.fg }}>{it.n}</span>
            </button>
          );
        })}
        <div className="cbs-section">Manage</div>
        <a href="/tasks" className="cbs-navrow"><span className="cbs-ico"><ListChecks size={16} /></span><span className="cbs-navlabel">My Tasks</span></a>
        <a href="/me" className="cbs-navrow"><span className="cbs-ico"><Settings size={16} /></span><span className="cbs-navlabel">Settings</span></a>
        <form action={logout} className="cbs-logout"><button type="submit" className="cbs-navrow"><span className="cbs-ico"><LogOut size={16} /></span><span className="cbs-navlabel">Log out</span></button></form>
      </nav>
      <div className="cbs-foot">
        <div className="cbs-progpanel">
          <div className="cbs-prog-row"><span>Progress</span><b>{counts.completed}/{counts.total}</b></div>
          <div className="cbs-prog-track"><div className="cbs-prog-fill" style={{ width: `${progress}%` }} /></div>
          <div className="cbs-prog-cap">{progress}% completed</div>
        </div>
        <div className="cbs-copy">© {new Date().getFullYear()} WebRocz Studio</div>
      </div>
    </>
  );

  return (
    <div className="cbs-root">
      <style>{cssVars + studioCss}</style>
      <aside className="cbs-side">{sidebar}</aside>
      {drawer && <div className="cbs-drawer-wrap"><div className="cbs-drawer-bg" onClick={() => setDrawer(false)} /><aside className="cbs-side cbs-side-drawer">{sidebar}</aside></div>}
      <div className="cbs-main">
        <header className="cbs-header">
          <div className="cbs-header-left">
            <button className="cbs-burger" onClick={() => setDrawer(true)}><Menu size={18} /></button>
            <div className="cb-crumb">{L.crumb} <span>›</span> My Assigned {L.noun}</div>
          </div>
          <div className="cbs-header-actions">
            <Notifications count={alerts?.count ?? 0} items={alerts?.items ?? []} />
            {toolbar}
          </div>
        </header>
        <main className="cbs-content">
          {kpiGrid}
          {chipBar}
          {cardList}
        </main>
      </div>
      {modalEl}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="cb-field"><span>{label}</span>{children}</label>;
}
function LinkInput({ name, value, placeholder }: { name: string; value: string; placeholder: string }) {
  return (
    <div className="cb-linkinput">
      <input name={name} defaultValue={value} placeholder={placeholder} className="cb-fld" />
      {value && <a href={value} target="_blank" rel="noreferrer" className="cb-linkbtn"><ExternalLink size={15} /></a>}
    </div>
  );
}
function Sel({ value, onChange, all, options, raw }: { value: string; onChange: (v: string) => void; all?: string; options?: string[]; raw?: [string, string][] }) {
  return (
    <div className="cb-selwrap">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="cb-sel">
        {raw ? raw.map(([v, l]) => <option key={v} value={v}>{l}</option>)
          : (<><option value="ALL">{all}</option>{options?.map((o) => <option key={o} value={o}>{o}</option>)}</>)}
      </select>
      <ChevronDown size={14} className="cb-sel-chev" />
    </div>
  );
}
function Kpi({ label, value, sub, tone, bar, pill, alert, span2 }: { label: string; value: number; sub: string; tone: string; bar?: number; pill?: string; alert?: boolean; span2?: boolean }) {
  const tint: Record<string, { fg: string; barBg: string; barFill: string; pillBg: string; pillBd: string }> = {
    ink: { fg: "#64748B", barBg: "#F8F7FF", barFill: "#0F172A", pillBg: "", pillBd: "" },
    orange: { fg: "#EA580C", barBg: "#FFF7ED", barFill: "#EA580C", pillBg: "#FFF7ED", pillBd: "#FFEDD5" },
    blue: { fg: "#2563EB", barBg: "#EFF6FF", barFill: "#3B82F6", pillBg: "", pillBd: "" },
    green: { fg: "#059669", barBg: "#ECFDF5", barFill: "#10B981", pillBg: "", pillBd: "" },
    red: { fg: "#DC2626", barBg: "#FEF2F2", barFill: "#EF4444", pillBg: "#FEF2F2", pillBd: "#FEE2E2" },
  };
  const t = tint[tone];
  return (
    <div className={`cb-kpi ${span2 ? "cb-kpi-span2" : ""}`} style={tone === "red" ? { borderColor: "#FECACA", background: "#FEF2F2" } : undefined}>
      <div className="cb-kpi-label" style={{ color: tone === "ink" ? "#64748B" : t.fg }}>{label}</div>
      <div className="cb-kpi-value" style={{ color: tone === "ink" ? "#0F172A" : t.fg }}>{value}</div>
      <div className="cb-kpi-sub" style={{ color: t.fg }}>{sub}</div>
      {pill
        ? <span className="cb-kpi-pill" style={{ color: t.fg, background: t.pillBg, borderColor: t.pillBd }}>{pill}</span>
        : <div className="cb-kpi-track" style={{ background: t.barBg }}><div style={{ width: `${bar ?? 0}%`, height: "100%", borderRadius: 999, background: t.barFill }} /></div>}
    </div>
  );
}

const cssVars = `
.cb-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}
.cb-crumb{font-size:12px;color:#64748B}.cb-crumb span{color:#CBD5E1;margin:0 4px}
.cb-title{font-size:24px;font-weight:800;letter-spacing:-0.02em;margin-top:2px;color:#0F172A}
.cb-sub{font-size:13px;color:#64748B;margin-top:4px}
.cb-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.cb-searchwrap{position:relative}
.cb-searchicon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#94A3B8;pointer-events:none}
.cb-search{width:210px;height:36px;padding:0 12px 0 32px;border-radius:12px;background:#F8F7FF;border:1px solid #ECE9FF;font-size:13px;color:#0F172A;outline:none}
.cb-search:focus{border-color:#6D28D9;background:#fff;box-shadow:0 0 0 3px #ede9fe}
.cb-selwrap{position:relative}
.cb-sel{appearance:none;height:36px;padding:0 30px 0 12px;border-radius:12px;background:#fff;border:1px solid #ECE9FF;font-size:12px;font-weight:500;color:#334155;outline:none;cursor:pointer}
.cb-sel:focus{border-color:#6D28D9}
.cb-sel-chev{position:absolute;right:9px;top:50%;transform:translateY(-50%);color:#94A3B8;pointer-events:none}
.cb-btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 16px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;white-space:nowrap;transition:all .15s ease}
.cb-btn-purple{background:#6D28D9;color:#fff;box-shadow:0 2px 8px rgba(109,40,217,.25)}.cb-btn-purple:hover{background:#5B21B6}
.cb-btn-outline{background:#fff;border-color:#6D28D9;color:#6D28D9}.cb-btn-outline:hover{background:#F8F7FF}
.cb-btn-green{background:#059669;color:#fff}.cb-btn-green:hover{background:#047857}
.cb-btn-dark{background:#0F172A;color:#fff}.cb-btn-dark:hover{background:#000}
.cb-btn-danger{background:#fff;border-color:#FECACA;color:#DC2626}.cb-btn-danger:hover{background:#FEF2F2;border-color:#DC2626}
.cb-card{background:#fff;border:1px solid #ECE9FF;border-radius:20px}
.cb-prog{display:flex;align-items:center;gap:14px;padding:18px 20px;margin-bottom:16px;flex-wrap:wrap}
.cb-prog-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#F5F3FF;color:#6D28D9;flex:none}
.cb-prog-body{min-width:160px}
.cb-prog-title{font-size:13px;font-weight:600;color:#0F172A}
.cb-prog-note{font-size:11px;color:#64748B;margin-top:2px}
.cb-prog-pct{margin-left:auto;font-size:13px;font-weight:800;color:#6D28D9}
.cb-prog-track{flex-basis:100%;height:10px;border-radius:999px;background:#F8F7FF;border:1px solid #ECE9FF;overflow:hidden}
.cb-prog-fill{height:100%;border-radius:999px;background:#6D28D9;transition:width .5s ease}
.cb-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px}
@media(min-width:1024px){.cb-kpis{grid-template-columns:repeat(5,1fr);gap:16px}}
.cb-kpi{background:#fff;border:1px solid #ECE9FF;border-radius:16px;padding:16px}
.cb-kpi-span2{grid-column:span 2}@media(min-width:1024px){.cb-kpi-span2{grid-column:span 1}}
.cb-kpi-label{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.cb-kpi-value{font-size:26px;font-weight:800;line-height:1;margin-top:8px;letter-spacing:-.02em}
.cb-kpi-sub{font-size:11px;margin-top:6px}
.cb-kpi-track{height:4px;border-radius:999px;margin-top:10px;overflow:hidden}
.cb-kpi-pill{display:inline-block;margin-top:8px;font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:999px;border:1px solid}
.cb-chips{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#fff;border:1px solid #ECE9FF;border-radius:20px;padding:8px;margin-bottom:16px}
.cb-chip{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:12px;font-size:12.5px;font-weight:600;color:#475569;background:#F8F7FF;border:1px solid #ECE9FF;cursor:pointer;transition:all .15s ease}
.cb-chip:hover{background:#fff}
.cb-chip-on{background:#6D28D9;color:#fff;border-color:#6D28D9;box-shadow:0 2px 8px rgba(109,40,217,.25)}
.cb-chip-n{font-size:11px;padding:1px 7px;border-radius:999px;background:#F1F5F9;color:#475569}
.cb-chip-on .cb-chip-n{background:rgba(255,255,255,.22);color:#fff}
.cb-showing{margin-left:auto;font-size:12px;color:#64748B}
.cb-list{display:flex;flex-direction:column;gap:16px}
.cb-empty{background:#fff;border:1px solid #ECE9FF;border-radius:20px;padding:48px;text-align:center}
.cb-empty-icon{display:inline-grid;place-items:center;width:48px;height:48px;border-radius:12px;background:#F8F7FF;color:#94A3B8;margin-bottom:8px}
.cb-empty-title{font-size:14px;font-weight:500;color:#334155}.cb-empty-sub{font-size:13px;color:#64748B;margin-top:2px}
.cb-item{border:1px solid #ECE9FF;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.04);transition:box-shadow .18s ease,transform .18s ease}
.cb-item:hover{box-shadow:0 8px 28px rgba(15,23,42,.08);transform:translateY(-1px)}
.cb-item-inner{padding:18px 20px}
.cb-item-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px}
.cb-item-left{min-width:0}
.cb-item-titlerow{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.cb-item-title{font-size:15.5px;font-weight:700;color:#0F172A;letter-spacing:-.01em}
.cb-idpill{font-size:10px;font-weight:600;padding:2px 7px;border-radius:6px;background:#F1F5F9;color:#475569;border:1px solid #E2E8F0}
.cb-origin{font-size:11px;font-weight:600;padding:2px 9px;border-radius:999px;border:1px solid}
.cb-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}
.cb-pill-client{font-size:12px;padding:3px 9px;border-radius:999px;background:#F1F5F9;color:#334155;border:1px solid #E2E8F0;font-weight:500}
.cb-pill-type{font-size:11px;padding:3px 9px;border-radius:999px;background:#fff;color:#475569;border:1px solid #ECE9FF}
.cb-pill-prio{font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;border:1px solid;text-transform:uppercase}
.cb-assigned{font-size:11px;color:#94A3B8}
.cb-item-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cb-due{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:5px 10px;border-radius:999px;background:#fff;color:#475569;border:1px solid #ECE9FF}
.cb-statusform{display:inline-flex}
.cb-statussel{appearance:none;height:32px;padding:0 26px 0 12px;border-radius:999px;border:1px solid;font-size:12px;font-weight:600;outline:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.cb-item-foot{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:14px}
.cb-viewbtn{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#6D28D9;background:none;border:none;cursor:pointer}
.cb-viewbtn:hover{text-decoration:underline}
.cb-rot{transform:rotate(180deg)}
.cb-nextform{margin-left:auto}
.cb-detail{border-top:1px solid #EEF0F6;background:#fff;padding:22px 20px}
.cb-detail-grid{display:grid;grid-template-columns:1fr;gap:20px}
@media(min-width:1024px){.cb-detail-grid{grid-template-columns:1fr 1fr}}
.cb-col{display:flex;flex-direction:column;gap:14px}
.cb-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cb-three{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:640px){.cb-three{grid-template-columns:1fr 1fr 1fr}}
.cb-field{display:block}
.cb-field>span{display:block;margin-bottom:6px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8}
.cb-fld{width:100%;background:#F9FAFC;border:1px solid #E6E8F0;border-radius:10px;padding:10px 12px;font-size:13px;color:#0F172A;outline:none;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease}
.cb-fld:focus{border-color:#6D28D9;background:#fff;box-shadow:0 0 0 3px #ede9fe}
.cb-fld-ro{background:#F1F3F9;color:#64748B}
.cb-ta{resize:none;line-height:1.5}
.cb-linkinput{display:flex;align-items:center;gap:8px}
.cb-linkbtn{display:grid;place-items:center;width:38px;height:38px;flex:none;border-radius:10px;border:1px solid #ECE9FF;color:#64748B}
.cb-linkbtn:hover{border-color:#0F172A}
.cb-infobox{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;background:#F9FAFC;border:1px solid #EEF0F6;border-radius:12px;padding:14px;font-size:12px;color:#475569}
.cb-infobox span{color:#94A3B8}
.cb-infobox b{color:#0F172A;font-weight:600}
.cb-detail-foot{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(236,233,255,.7)}
.cb-quicklinks{display:flex;gap:12px}
.cb-ql{font-size:11px;color:#64748B;text-decoration:underline}
.cb-ql-final{color:#6D28D9;font-weight:600}
.cb-detail-foot>.cb-btn-dark{margin-left:auto}
.cb-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.45);backdrop-filter:blur(4px)}
.cb-modal{background:#fff;border:1px solid #ECE9FF;border-radius:20px;width:100%;max-width:640px;max-height:92vh;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);display:flex;flex-direction:column}
.cb-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 24px;border-bottom:1px solid #ECE9FF}
.cb-modal-title{font-size:16px;font-weight:600;color:#0F172A}
.cb-modal-sub{font-size:12px;color:#64748B;margin-top:2px}
.cb-modal-x{display:grid;place-items:center;width:32px;height:32px;border-radius:999px;background:#F8F7FF;border:1px solid #ECE9FF;color:#475569;cursor:pointer}
.cb-modal-body{padding:24px;overflow-y:auto;display:flex;flex-direction:column;gap:16px}
.cb-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:16px 24px;border-top:1px solid #ECE9FF;background:rgba(248,247,255,.6)}
`;

const studioCss = `
.cbs-root{min-height:100vh;background:#F8F7FF;color:#0F172A}
.cbs-side{position:fixed;top:0;left:0;bottom:0;width:260px;background:#0F172A;color:#fff;display:none;flex-direction:column;z-index:40}
@media(min-width:1024px){.cbs-side{display:flex}}
.cbs-brand{display:flex;align-items:center;gap:12px;padding:22px 24px;border-bottom:1px solid rgba(255,255,255,.08)}
.cbs-logo{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:#6D28D9;font-size:13px;font-weight:800;color:#fff}
.cbs-brand-name{font-size:15px;font-weight:700}
.cbs-brand-sub{font-size:11px;color:rgba(255,255,255,.55);letter-spacing:.03em}
.cbs-usercard{display:flex;align-items:center;gap:10px;margin:16px;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}
.cbs-avatar{display:grid;place-items:center;width:38px;height:38px;border-radius:999px;background:linear-gradient(135deg,#8b5cf6,#4f46e5);font-size:13px;font-weight:700;color:#fff;flex:none}
.cbs-user-body{min-width:0;flex:1}
.cbs-user-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbs-user-role{font-size:11px;color:rgba(255,255,255,.55)}
.cbs-online{width:9px;height:9px;border-radius:999px;background:#34D399;box-shadow:0 0 0 4px rgba(16,185,129,.15);flex:none}
.cbs-nav{flex:1;overflow-y:auto;padding:6px 12px;display:flex;flex-direction:column;gap:2px}
.cbs-section{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.35);padding:12px 12px 6px}
.cbs-navrow{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:500;color:rgba(255,255,255,.72);background:none;border:none;cursor:pointer;text-align:left;transition:background .15s ease}
.cbs-navrow:hover{background:rgba(255,255,255,.06);color:#fff}
.cbs-navrow-on{background:#6D28D9;color:#fff}
.cbs-ico{display:grid;place-items:center;width:22px;height:22px;flex:none}
.cbs-navlabel{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbs-count{font-size:11px;font-weight:700;min-width:22px;text-align:center;padding:2px 7px;border-radius:999px}
.cbs-logout{width:100%}
.cbs-logout .cbs-navrow:hover{background:rgba(239,68,68,.14);color:#FCA5A5}
.cbs-foot{padding:16px;border-top:1px solid rgba(255,255,255,.08)}
.cbs-progpanel{background:rgba(255,255,255,.05);border-radius:14px;padding:12px}
.cbs-prog-row{display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,.6)}
.cbs-prog-row b{color:#fff}
.cbs-prog-track{height:6px;border-radius:999px;background:rgba(255,255,255,.12);margin:8px 0 6px;overflow:hidden}
.cbs-prog-fill{height:100%;border-radius:999px;background:#6D28D9;transition:width .5s ease}
.cbs-prog-cap{font-size:11px;color:rgba(255,255,255,.5)}
.cbs-copy{margin-top:14px;text-align:center;font-size:10px;color:rgba(255,255,255,.3)}
.cbs-main{min-height:100vh}
@media(min-width:1024px){.cbs-main{margin-left:260px}}
.cbs-header{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;background:#fff;border-bottom:1px solid #ECE9FF;padding:12px 16px}
@media(min-width:1024px){.cbs-header{padding:12px 24px}}
.cbs-header-left{display:flex;align-items:center;gap:10px}
.cbs-header-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.cbs-burger{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:#F8F7FF;border:1px solid #ECE9FF;color:#334155;cursor:pointer}
@media(min-width:1024px){.cbs-burger{display:none}}
.cbs-content{padding:16px}
@media(min-width:1024px){.cbs-content{padding:24px}}
.cbs-drawer-wrap{position:fixed;inset:0;z-index:70}
.cbs-drawer-bg{position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(2px)}
.cbs-side-drawer{display:flex;width:280px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
`;
