"use client";

import { useMemo, useState } from "react";
import { saveShoot, setShootStatus, toggleShootPaid, deleteShoot } from "@/app/actions";
import { SHOOT_CATEGORIES, SHOOT_STATUS, SHOOT_STATUS_KEYS, inr, inrShort } from "@/lib/domain";
import {
  Camera, Video, CalendarClock, IndianRupee, Clock, Plus, X, Pencil, Trash2,
  MapPin, Phone, CheckCircle2, CircleAlert,
} from "lucide-react";

type Row = {
  id: string; code: string; category: string; title: string;
  client: string | null; clientId: string | null; renterName: string; phone: string;
  date: string; startTime: string; endTime: string; location: string;
  assignee: string | null; assignedToId: string | null;
  status: string; rentAmount: number; paid: boolean; notes: string;
};
type Kpis = { todayShoots: number; upcoming: number; rentalsThisMonth: number; rentalRevenue: number; rentalUnpaid: number; webroczCount: number; rentCount: number; completed: number };
type Opt = { id: string; name: string };
type Shooter = { id: string; name: string; role: string };

const TONE: Record<string, string> = { violet: "var(--violet)", amber: "var(--amber)", sky: "var(--sky)", emerald: "var(--emerald)", rose: "var(--rose)", muted: "var(--muted)" };
function fmtDate(d: string) { return d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) : "—"; }

export default function ShootBoard({
  rows, kpis, clientOptions, shooters, canManage, today, userName,
}: {
  rows: Row[]; kpis: Kpis; clientOptions: Opt[]; shooters: Shooter[]; canManage: boolean; today: string; userName?: string;
}) {
  const [cat, setCat] = useState<"ALL" | "WEBROCZ" | "STUDIO_RENT">("ALL");
  const [status, setStatus] = useState("ALL");
  const [edit, setEdit] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);

  const visible = useMemo(() => rows.filter((r) => {
    if (cat !== "ALL" && r.category !== cat) return false;
    if (status !== "ALL" && r.status !== status) return false;
    return true;
  }), [rows, cat, status]);

  const catPill = (c: string) => {
    const cfg = SHOOT_CATEGORIES[c as keyof typeof SHOOT_CATEGORIES];
    return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${TONE[cfg?.tone ?? "muted"]} 13%, white)`, color: TONE[cfg?.tone ?? "muted"] }}>{c === "STUDIO_RENT" ? <Video size={11} /> : <Camera size={11} />}{cfg?.label ?? c}</span>;
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">{canManage ? "Studio X · shooting & rentals" : "My shoots"}</span>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Shooting &amp; Studio X</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{canManage ? "Schedule WebRocz client shoots and Studio X rentals, assign the shooter and track rent." : `Your assigned shoots, ${userName ?? ""}.`}</p>
        </div>
        {canManage && <button onClick={() => { setEdit(null); setAdding(true); }} className="btn btn-violet"><Plus size={15} /> Add shoot / booking</button>}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Camera} tone="violet" label="Today's shoots" value={String(kpis.todayShoots)} sub={`${kpis.upcoming} upcoming (7d)`} />
        <Kpi icon={CalendarClock} tone="sky" label="WebRocz shoots" value={String(kpis.webroczCount)} sub="active (client shoots)" />
        <Kpi icon={Video} tone="amber" label="Studio X rentals" value={String(kpis.rentalsThisMonth)} sub="this month" />
        <Kpi icon={IndianRupee} tone="emerald" label="Rental revenue" value={inrShort(kpis.rentalRevenue)} sub={kpis.rentalUnpaid ? `${inrShort(kpis.rentalUnpaid)} unpaid` : "all collected"} />
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-[var(--line-2)] bg-[var(--surface-2)] p-1">
          {([["ALL", "All"], ["WEBROCZ", "WebRocz"], ["STUDIO_RENT", "Studio X Rent"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setCat(k)} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${cat === k ? "bg-[var(--violet)] text-white shadow-sm" : "text-[var(--ink-2)] hover:bg-white"}`}>{l}</button>
          ))}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="select !w-auto">
          <option value="ALL">All status</option>
          {SHOOT_STATUS_KEYS.map((k) => <option key={k} value={k}>{SHOOT_STATUS[k].label}</option>)}
        </select>
        <span className="ml-auto text-[12px] font-semibold text-[var(--muted)] tnum">{visible.length} shoot{visible.length !== 1 ? "s" : ""}</span>
      </div>

      {/* table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[920px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Date & time", "Shoot", "Category", "Client / Renter", "Location", "Shooter", "Rent", "Status", ...(canManage ? [""] : [])].map((h, i) => <th key={i} className="th px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {visible.map((r) => {
                const st = SHOOT_STATUS[r.status as keyof typeof SHOOT_STATUS];
                const isToday = r.date === today;
                return (
                  <tr key={r.id} className="border-b border-[var(--line)] hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-[13px] font-semibold">{fmtDate(r.date)} {isToday && <span className="ml-1 rounded bg-[color-mix(in_srgb,var(--violet)_14%,white)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--violet)]">Today</span>}</div>
                      <div className="text-[11.5px] text-[var(--muted)] tnum">{r.startTime || "—"}{r.endTime ? ` – ${r.endTime}` : ""}</div>
                    </td>
                    <td className="px-4 py-3"><div className="text-[13px] font-semibold">{r.title}</div><div className="text-[11px] text-[var(--faint)] tnum">{r.code}</div></td>
                    <td className="px-4 py-3">{catPill(r.category)}</td>
                    <td className="px-4 py-3 text-[12.5px]">
                      <div>{r.category === "WEBROCZ" ? (r.client ?? "—") : (r.renterName || "—")}</div>
                      {r.phone && <div className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] tnum"><Phone size={10} /> {r.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--muted)]">{r.location ? <span className="inline-flex items-center gap-1"><MapPin size={11} /> {r.location}</span> : "—"}</td>
                    <td className="px-4 py-3 text-[12.5px]">{r.assignee ?? <span className="text-[var(--faint)]">Unassigned</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.category === "STUDIO_RENT" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold tnum">{r.rentAmount ? inr(r.rentAmount) : "—"}</span>
                          {canManage ? (
                            <form action={toggleShootPaid}><input type="hidden" name="id" value={r.id} />
                              <button className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${r.paid ? "bg-[color-mix(in_srgb,var(--emerald)_14%,white)] text-[var(--emerald)]" : "bg-[color-mix(in_srgb,var(--rose)_12%,white)] text-[var(--rose)]"}`}>{r.paid ? <CheckCircle2 size={11} /> : <CircleAlert size={11} />}{r.paid ? "Paid" : "Unpaid"}</button>
                            </form>
                          ) : <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${r.paid ? "text-[var(--emerald)]" : "text-[var(--rose)]"}`}>{r.paid ? "Paid" : "Unpaid"}</span>}
                        </div>
                      ) : <span className="text-[var(--faint)]">—</span>}
                    </td>
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
                          <button onClick={() => { setAdding(false); setEdit(r); }} className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line-2)] text-[var(--muted)] hover:border-[var(--ink)]"><Pencil size={13} /></button>
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
              {visible.length === 0 && <tr><td colSpan={canManage ? 9 : 8} className="px-4 py-12 text-center text-sm text-[var(--muted)]">{canManage ? "No shoots yet — click Add shoot / booking to schedule one." : "No shoots assigned to you."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {(adding || edit) && canManage && (
        <ShootModal row={edit} clientOptions={clientOptions} shooters={shooters} today={today} onClose={() => { setAdding(false); setEdit(null); }} />
      )}
    </div>
  );
}

function ShootModal({ row, clientOptions, shooters, today, onClose }: { row: Row | null; clientOptions: Opt[]; shooters: Shooter[]; today: string; onClose: () => void }) {
  const [category, setCategory] = useState<"WEBROCZ" | "STUDIO_RENT">((row?.category as "WEBROCZ" | "STUDIO_RENT") ?? "WEBROCZ");
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="eyebrow">Location</span><input name="location" defaultValue={row?.location} placeholder={isRent ? "Studio X" : "On location / Studio X"} className="input mt-1.5" /></label>
            <label className="block"><span className="eyebrow">Assign shooter</span>
              <select name="assignedToId" defaultValue={row?.assignedToId ?? ""} className="select mt-1.5"><option value="">— Unassigned —</option>{shooters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </label>
          </div>

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

function Kpi({ icon: Icon, tone, label, value, sub }: { icon: typeof Camera; tone: string; label: string; value: string; sub: string }) {
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: `color-mix(in srgb, ${TONE[tone]} 12%, white)`, color: TONE[tone] }}><Icon size={15} /></span>
      </div>
      <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight tnum">{value}</div>
      <div className="mt-1.5 text-[12px] text-[var(--muted)]">{sub}</div>
    </div>
  );
}
