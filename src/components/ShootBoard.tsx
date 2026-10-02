"use client";

import { useMemo, useState, useEffect } from "react";
import { saveShoot, setShootStatus, toggleShootPaid, deleteShoot } from "@/app/actions";
import { SHOOT_CATEGORIES, SHOOT_STATUS, SHOOT_STATUS_KEYS, SHOOT_LOCATIONS, inr, inrShort, initials } from "@/lib/domain";
import {
  Camera, Video, CalendarClock, IndianRupee, Plus, X, Pencil, Trash2,
  MapPin, Phone, CheckCircle2, CircleAlert, List, CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";

type Row = {
  id: string; code: string; category: string; title: string;
  client: string | null; clientId: string | null; renterName: string; phone: string;
  date: string; startTime: string; endTime: string; locationType: string; location: string;
  assignee: string | null; assignedToId: string | null;
  status: string; rentAmount: number; paid: boolean; notes: string;
};
type Kpis = { todayShoots: number; upcoming: number; rentalsThisMonth: number; rentalRevenue: number; rentalUnpaid: number; webroczCount: number; rentCount: number; completed: number };
type Opt = { id: string; name: string };
type Shooter = { id: string; name: string; role: string };

const TONE: Record<string, string> = { violet: "var(--violet)", amber: "var(--amber)", sky: "var(--sky)", emerald: "var(--emerald)", rose: "var(--rose)", muted: "var(--muted)" };
function fmtDate(d: string) { return d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) : "—"; }

export default function ShootBoard({
  rows, kpis, clientOptions, shooters, canManage, canAdd = false, selfId, today, userName,
}: {
  rows: Row[]; kpis: Kpis; clientOptions: Opt[]; shooters: Shooter[]; canManage: boolean; canAdd?: boolean; selfId?: string; today: string; userName?: string;
}) {
  const [cat, setCat] = useState<"ALL" | "WEBROCZ" | "STUDIO_RENT">("ALL");
  const [status, setStatus] = useState("ALL");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [edit, setEdit] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);

  const statusRows = useMemo(() => rows.filter((r) => (status === "ALL" || r.status === status) && (cat === "ALL" || r.category === cat)), [rows, status, cat]);
  const webroczRows = statusRows.filter((r) => r.category === "WEBROCZ");
  const rentRows = statusRows.filter((r) => r.category === "STUDIO_RENT");
  const showWebrocz = cat === "ALL" || cat === "WEBROCZ";
  const showRent = cat === "ALL" || cat === "STUDIO_RENT";
  const onEdit = (r: Row) => { setAdding(false); setEdit(r); };

  // status overview (within the current category)
  const statusBase = useMemo(() => rows.filter((r) => cat === "ALL" || r.category === cat), [rows, cat]);
  const statusCounts: Record<string, number> = { ALL: statusBase.length };
  for (const k of SHOOT_STATUS_KEYS) statusCounts[k] = statusBase.filter((r) => r.status === k).length;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">{canManage ? "Studio X · shooting & rentals" : "My shoots"}</span>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Shooting &amp; Studio X</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{canManage ? "Schedule WebRocz client shoots and Studio X rentals, assign the shooter and track rent." : `Your assigned shoots, ${userName ?? ""}.`}</p>
        </div>
        {canAdd && <button onClick={() => { setEdit(null); setAdding(true); }} className="btn btn-violet"><Plus size={15} /> Add shoot / booking</button>}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Camera} tone="violet" label="Today's shoots" value={String(kpis.todayShoots)} sub={`${kpis.upcoming} upcoming (7d)`} />
        <Kpi icon={CalendarClock} tone="sky" label="WebRocz shoots" value={String(kpis.webroczCount)} sub="active (client shoots)" />
        <Kpi icon={Video} tone="amber" label="Studio X rentals" value={String(kpis.rentalsThisMonth)} sub="this month" />
        <Kpi icon={IndianRupee} tone="emerald" label="Rental revenue" value={inrShort(kpis.rentalRevenue)} sub={kpis.rentalUnpaid ? <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--rose)_12%,white)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--rose)]"><CircleAlert size={10} /> {inrShort(kpis.rentalUnpaid)} unpaid</span> : <span className="inline-flex items-center gap-1 text-[var(--emerald)]"><CheckCircle2 size={11} /> all collected</span>} />
      </div>

      {/* category + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-[var(--line-2)] bg-[var(--surface-2)] p-1">
          {([["ALL", "All"], ["WEBROCZ", "WebRocz"], ["STUDIO_RENT", "Studio X Rent"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setCat(k)} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${cat === k ? "bg-[var(--violet)] text-white shadow-sm" : "text-[var(--ink-2)] hover:bg-white"}`}>{l}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-xl border border-[var(--line-2)] bg-[var(--surface-2)] p-1">
          {([["list", List, "List"], ["calendar", CalendarDays, "Calendar"]] as const).map(([v, Icon, l]) => (
            <button key={v} onClick={() => setView(v)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${view === v ? "bg-[var(--violet)] text-white shadow-sm" : "text-[var(--ink-2)] hover:bg-white"}`}><Icon size={14} /> {l}</button>
          ))}
        </div>
      </div>

      {/* status overview — clickable filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setStatus("ALL")} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${status === "ALL" ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line-2)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}>All <span className="tnum opacity-70">{statusCounts.ALL}</span></button>
        {SHOOT_STATUS_KEYS.map((k) => {
          const cfg = SHOOT_STATUS[k]; const on = status === k; const c = TONE[cfg.tone];
          return (
            <button key={k} onClick={() => setStatus(on ? "ALL" : k)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition"
              style={on ? { background: c, color: "#fff", borderColor: c } : { borderColor: "var(--line-2)", color: "var(--ink-2)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? "#fff" : c }} /> {cfg.label} <span className="tnum opacity-70">{statusCounts[k]}</span>
            </button>
          );
        })}
      </div>

      {view === "calendar" ? (
        <ShootCalendar rows={statusRows} today={today} canManage={canManage} onEdit={onEdit} />
      ) : (
        <>
          {/* two clearly-separated categories */}
          {showWebrocz && (
            <ShootSection
              title="WebRocz Client Shoots" desc="WebRocz clients who need a shoot — Mallesh travels to the client's location."
              icon={Camera} tone="violet" rows={webroczRows} canManage={canManage} today={today} onEdit={onEdit}
              empty={canAdd ? "No WebRocz client shoots yet — add one above." : "No WebRocz shoots assigned to you."} />
          )}
          {showRent && (
            <ShootSection
              title="Studio X Rentals" desc="People who book Studio X for rent — Mallesh shoots their content at the studio."
              icon={Video} tone="amber" rows={rentRows} canManage={canManage} today={today} onEdit={onEdit}
              empty={canAdd ? "No studio rentals yet — add one above." : "No studio rentals assigned to you."} />
          )}
        </>
      )}

      {(adding || edit) && canAdd && (
        <ShootModal row={edit} clientOptions={clientOptions} shooters={shooters} today={today} defaultAssignee={!canManage && selfId ? selfId : ""} onClose={() => { setAdding(false); setEdit(null); }} />
      )}
    </div>
  );
}

function ShootModal({ row, clientOptions, shooters, today, defaultAssignee = "", onClose }: { row: Row | null; clientOptions: Opt[]; shooters: Shooter[]; today: string; defaultAssignee?: string; onClose: () => void }) {
  const [category, setCategory] = useState<"WEBROCZ" | "STUDIO_RENT">((row?.category as "WEBROCZ" | "STUDIO_RENT") ?? "WEBROCZ");
  const [locType, setLocType] = useState<"IN_HOUSE" | "ON_LOCATION">((row?.locationType as "IN_HOUSE" | "ON_LOCATION") ?? "ON_LOCATION");
  // new shoot: default a rental to in-house and a WebRocz client shoot to on-location.
  useEffect(() => { if (!row) setLocType(category === "STUDIO_RENT" ? "IN_HOUSE" : "ON_LOCATION"); }, [category, row]);
  const isRent = category === "STUDIO_RENT";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[600px] flex-col overflow-hidden rounded-[18px] border border-[var(--line-2)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">{row ? "Edit shoot" : "Add shoot / booking"}</h2>
            <p className="text-[12px] text-[var(--muted)]">Set the date &amp; time, pick the shooter, and (for rentals) the rent.</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={saveShoot} className="flex flex-col gap-4 overflow-y-auto p-6">
          {row && <input type="hidden" name="id" value={row.id} />}
          {/* category toggle */}
          <div>
            <span className="eyebrow">Category</span>
            <div className="mt-1.5 flex gap-2">
              {([["WEBROCZ", "WebRocz shoot"], ["STUDIO_RENT", "Studio X rent"]] as const).map(([k, l]) => (
                <button type="button" key={k} onClick={() => setCategory(k)} className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-semibold transition ${category === k ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_8%,white)] text-[var(--violet)]" : "border-[var(--line-2)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}>{l}</button>
              ))}
            </div>
            <input type="hidden" name="category" value={category} />
          </div>

          <label className="block"><span className="eyebrow">Shoot title</span><input name="title" required defaultValue={row?.title} placeholder={isRent ? "e.g. Podcast rental — Acme" : "e.g. Product shoot — Bloom Clinic"} className="input mt-1.5" /></label>

          {isRent ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="eyebrow">Renter name</span><input name="renterName" defaultValue={row?.renterName} placeholder="Who is renting the studio" className="input mt-1.5" /></label>
              <label className="block"><span className="eyebrow">Phone</span><input name="phone" defaultValue={row?.phone} placeholder="Contact number" className="input mt-1.5" /></label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="eyebrow">Client</span>
                <select name="clientId" defaultValue={row?.clientId ?? ""} className="select mt-1.5"><option value="">— Select client —</option>{clientOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </label>
              <label className="block"><span className="eyebrow">Contact phone</span><input name="phone" defaultValue={row?.phone} placeholder="Optional" className="input mt-1.5" /></label>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="eyebrow">Date</span><input type="date" name="date" required defaultValue={row?.date || today} className="input mt-1.5" /></label>
            <label className="block"><span className="eyebrow">Start time</span><input type="time" name="startTime" defaultValue={row?.startTime} className="input mt-1.5" /></label>
            <label className="block"><span className="eyebrow">End time</span><input type="time" name="endTime" defaultValue={row?.endTime} className="input mt-1.5" /></label>
          </div>

          <div className="block">
            <span className="eyebrow">Where is the shoot?</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["IN_HOUSE", "ON_LOCATION"] as const).map((k) => (
                <button type="button" key={k} onClick={() => setLocType(k)} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition ${locType === k ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_8%,white)] text-[var(--violet)]" : "border-[var(--line-2)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}><MapPin size={13} /> {SHOOT_LOCATIONS[k].label}</button>
              ))}
            </div>
            <input type="hidden" name="locationType" value={locType} />
            <input name="location" defaultValue={row?.location} placeholder={locType === "IN_HOUSE" ? "Studio X — floor / set (optional)" : "Client address / location"} className="input mt-2" />
          </div>

          <label className="block"><span className="eyebrow">Assign shooter</span>
            <select name="assignedToId" defaultValue={row?.assignedToId ?? defaultAssignee} className="select mt-1.5"><option value="">— Unassigned —</option>{shooters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </label>

          {isRent && (
            <div className="grid items-end gap-3 sm:grid-cols-3">
              <label className="block"><span className="eyebrow">Rent amount (₹)</span><input type="number" min={0} name="rentAmount" defaultValue={row?.rentAmount || ""} placeholder="0" className="input mt-1.5" /></label>
              <label className="mt-1 inline-flex items-center gap-2 text-[13px] font-semibold sm:col-span-2"><input type="checkbox" name="paid" defaultChecked={row?.paid} className="h-4 w-4 accent-[var(--violet)]" /> Rent collected (paid)</label>
            </div>
          )}

          <label className="block"><span className="eyebrow">Notes</span><textarea name="notes" rows={2} defaultValue={row?.notes} placeholder="Equipment, brief, special requests…" className="textarea mt-1.5" /></label>

          {row && (
            <label className="block"><span className="eyebrow">Status</span>
              <select name="status" defaultValue={row.status} className="select mt-1.5">{SHOOT_STATUS_KEYS.map((k) => <option key={k} value={k}>{SHOOT_STATUS[k].label}</option>)}</select>
            </label>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-violet">{row ? "Save shoot" : "Add shoot"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ShootCalendar({ rows, today, canManage, onEdit }: { rows: Row[]; today: string; canManage: boolean; onEdit: (r: Row) => void }) {
  const [ym, setYm] = useState(() => today.slice(0, 7));
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDate = useMemo(() => { const map: Record<string, Row[]> = {}; for (const r of rows) (map[r.date] ??= []).push(r); return map; }, [rows]);
  const monthLabel = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const shift = (delta: number) => { const d = new Date(y, m - 1 + delta, 1); setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const key = (day: number) => `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
        <h2 className="text-[15px] font-bold">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line-2)] text-[var(--muted)] hover:border-[var(--ink)]"><ChevronLeft size={16} /></button>
          <button onClick={() => setYm(today.slice(0, 7))} className="rounded-md border border-[var(--line-2)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-2)] hover:border-[var(--ink)]">Today</button>
          <button onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line-2)] text-[var(--muted)] hover:border-[var(--ink)]"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[var(--surface-2)] text-center text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-[104px] border-b border-r border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-2)_50%,white)]" />;
          const k = key(day);
          const items = byDate[k] ?? [];
          const isToday = k === today;
          return (
            <div key={i} className="min-h-[104px] border-b border-r border-[var(--line)] p-1.5 last:border-r-0">
              <div className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${isToday ? "bg-[var(--violet)] text-white" : "text-[var(--ink-2)]"}`}>{day}</div>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((r) => {
                  const cfg = SHOOT_CATEGORIES[r.category as keyof typeof SHOOT_CATEGORIES];
                  const tone = TONE[cfg?.tone ?? "muted"];
                  return (
                    <button key={r.id} onClick={() => canManage && onEdit(r)} title={`${r.title}${r.startTime ? ` · ${r.startTime}` : ""}`}
                      className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[10.5px] font-semibold ${canManage ? "cursor-pointer" : "cursor-default"}`}
                      style={{ background: `color-mix(in srgb, ${tone} 15%, white)`, color: tone }}>
                      {r.category === "STUDIO_RENT" ? <Video size={9} className="flex-none" /> : <Camera size={9} className="flex-none" />}
                      <span className="truncate">{r.startTime ? `${r.startTime} ` : ""}{r.title}</span>
                    </button>
                  );
                })}
                {items.length > 3 && <div className="px-1 text-[10px] font-semibold text-[var(--muted)]">+{items.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 border-t border-[var(--line)] px-5 py-2.5 text-[11.5px] font-semibold text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE.violet }} /> WebRocz shoot</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE.amber }} /> Studio X rent</span>
      </div>
    </div>
  );
}

function ShootSection({ title, desc, icon: Icon, tone, rows, canManage, today, onEdit, empty }: {
  title: string; desc: string; icon: typeof Camera; tone: string; rows: Row[]; canManage: boolean; today: string; onEdit: (r: Row) => void; empty: string;
}) {
  const isRentSection = title.toLowerCase().includes("rental");
  return (
    <div className="card !p-0 overflow-hidden" style={{ borderTop: `3px solid ${TONE[tone]}` }}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: `color-mix(in srgb, ${TONE[tone]} 13%, white)`, color: TONE[tone] }}><Icon size={16} /></span>
          <div>
            <div className="text-[14px] font-bold">{title}</div>
            <div className="text-[11.5px] text-[var(--muted)]">{desc}</div>
          </div>
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11.5px] font-bold tnum text-[var(--ink-2)]">{rows.length}</span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[880px] text-left">
          <thead><tr className="border-b border-[var(--line)]">{["Date & time", "Shoot", isRentSection ? "Renter" : "Client", "Location", "Shooter", ...(isRentSection ? ["Rent"] : []), "Status", ...(canManage ? [""] : [])].map((h, i) => <th key={i} className="th px-4 py-2.5">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const st = SHOOT_STATUS[r.status as keyof typeof SHOOT_STATUS];
              const isToday = r.date === today;
              return (
                <tr key={r.id} className="border-b border-[var(--line)] hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-[13px] font-semibold">{fmtDate(r.date)} {isToday && <span className="ml-1 rounded bg-[color-mix(in_srgb,var(--violet)_14%,white)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--violet)]">Today</span>}</div>
                    <div className="text-[11.5px] text-[var(--muted)] tnum">{r.startTime || "—"}{r.endTime ? ` – ${r.endTime}` : ""}</div>
                  </td>
                  <td className="px-4 py-3"><div className="text-[13px] font-semibold">{r.title}</div><div className="text-[11px] text-[var(--faint)] tnum">{r.code}</div></td>
                  <td className="px-4 py-3 text-[12.5px]">
                    <div>{isRentSection ? (r.renterName || "—") : (r.client ?? "—")}</div>
                    {r.phone && <div className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] tnum"><Phone size={10} /> {r.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: r.locationType === "ON_LOCATION" ? "var(--amber)" : "var(--sky)" }}>
                      <MapPin size={11} /> {SHOOT_LOCATIONS[r.locationType as keyof typeof SHOOT_LOCATIONS]?.short ?? "In-house"}
                    </span>
                    {r.location && <div className="mt-0.5 text-[11px] text-[var(--muted)]">{r.location}</div>}
                  </td>
                  <td className="px-4 py-3 text-[12.5px]">{r.assignee
                    ? <span className="inline-flex items-center gap-1.5"><span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-3)] text-[10px] font-bold text-[var(--ink-2)]">{initials(r.assignee)}</span> {r.assignee}</span>
                    : <span className="text-[var(--faint)]">Unassigned</span>}</td>
                  {isRentSection && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold tnum">{r.rentAmount ? inr(r.rentAmount) : "—"}</span>
                        {canManage ? (
                          <form action={toggleShootPaid}><input type="hidden" name="id" value={r.id} />
                            <button className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${r.paid ? "bg-[color-mix(in_srgb,var(--emerald)_14%,white)] text-[var(--emerald)]" : "bg-[color-mix(in_srgb,var(--rose)_12%,white)] text-[var(--rose)]"}`}>{r.paid ? <CheckCircle2 size={11} /> : <CircleAlert size={11} />}{r.paid ? "Paid" : "Unpaid"}</button>
                          </form>
                        ) : <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${r.paid ? "text-[var(--emerald)]" : "text-[var(--rose)]"}`}>{r.paid ? "Paid" : "Unpaid"}</span>}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <form action={setShootStatus}>
                      <input type="hidden" name="id" value={r.id} />
                      <select name="status" defaultValue={r.status} onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold outline-none" style={{ background: `color-mix(in srgb, ${TONE[st?.tone ?? "muted"]} 13%, white)`, color: TONE[st?.tone ?? "muted"] }}>
                        {SHOOT_STATUS_KEYS.map((k) => <option key={k} value={k}>{SHOOT_STATUS[k].label}</option>)}
                      </select>
                    </form>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => onEdit(r)} className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--muted)] hover:border-[var(--ink)]"><Pencil size={13} /></button>
                        <form action={deleteShoot} onSubmit={(e) => { if (!confirm(`Delete "${r.title}" (${r.code})?`)) e.preventDefault(); }}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--rose)] hover:border-[var(--rose)]"><Trash2 size={13} /></button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-[var(--muted)]">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value, sub }: { icon: typeof Camera; tone: string; label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="card card-pad relative overflow-hidden">
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: TONE[tone] }} />
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: `color-mix(in srgb, ${TONE[tone]} 12%, white)`, color: TONE[tone] }}><Icon size={15} /></span>
      </div>
      <div className="mt-2.5 text-[28px] font-extrabold leading-none tracking-tight tnum" style={{ color: TONE[tone] }}>{value}</div>
      <div className="mt-1.5 text-[12px] text-[var(--muted)]">{sub}</div>
    </div>
  );
}
