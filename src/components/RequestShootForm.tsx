"use client";

import { useEffect, useState } from "react";
import { requestShoot } from "@/app/actions";
import { getShootsOnDate, type BookedShoot } from "@/app/shoot-actions";
import { timesOverlap, timeRange } from "@/lib/shoot-overlap";
import { Camera, X, Send, MapPin, TriangleAlert, CalendarCheck } from "lucide-react";

// Account manager asks Studio X for a client shoot. As soon as a date is picked the form shows
// what is already booked that day, and warns clearly when the chosen time clashes with a shoot
// that is already on the calendar.
export default function RequestShootForm({ clients, from = "/" }: { clients: { id: string; name: string }[]; from?: string }) {
  const [open, setOpen] = useState(false);
  const [locType, setLocType] = useState<"ON_LOCATION" | "IN_HOUSE">("ON_LOCATION");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  // what Studio X already has on the chosen date (null = not looked up yet / still loading)
  const [booked, setBooked] = useState<{ date: string; rows: BookedShoot[] } | null>(null);

  useEffect(() => {
    if (!open || !date) return;
    let alive = true;
    getShootsOnDate(date).then((rows) => { if (alive) setBooked({ date, rows }); }).catch(() => { if (alive) setBooked({ date, rows: [] }); });
    return () => { alive = false; };
  }, [open, date]);

  const dayRows = booked && booked.date === date ? booked.rows : null;
  const clashes = dayRows && start ? dayRows.filter((b) => timesOverlap(start, end, b.startTime, b.endTime)) : [];
  const where = (b: BookedShoot) => (b.locationType === "ON_LOCATION" ? "On location" : "In-house (Studio X)");

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-ghost"><Camera size={15} /> Request a shoot</button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[18px] border border-[var(--line-2)] bg-[var(--surface)] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
              <div>
                <h2 className="text-[16px] font-bold">Request a client shoot</h2>
                <p className="text-[12px] text-[var(--muted)]">Sends a request to Studio X — Raj schedules it and assigns the shooter.</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
            </div>
            <form action={requestShoot} className="flex flex-col gap-4 overflow-y-auto p-6">
              <input type="hidden" name="from" value={from} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="eyebrow">Client *</span>
                  <select name="clientId" required className="select mt-1.5" defaultValue=""><option value="" disabled>Select client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </label>
                <label className="block"><span className="eyebrow">Shoot title</span><input name="title" placeholder="e.g. Product shoot / reel" className="input mt-1.5" /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block"><span className="eyebrow">Preferred date *</span><input type="date" name="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1.5" /></label>
                <label className="block"><span className="eyebrow">Start time</span><input type="time" name="startTime" value={start} onChange={(e) => setStart(e.target.value)} className="input mt-1.5" /></label>
                <label className="block"><span className="eyebrow">End time</span><input type="time" name="endTime" value={end} onChange={(e) => setEnd(e.target.value)} className="input mt-1.5" /></label>
              </div>

              {/* already booked at this date + time → clear warning */}
              {clashes.length > 0 && (
                <div className="rounded-[12px] border px-3.5 py-3 text-[12.5px]" style={{ borderColor: "color-mix(in srgb, var(--rose) 40%, white)", background: "color-mix(in srgb, var(--rose) 7%, white)" }}>
                  <div className="flex items-center gap-1.5 font-bold text-[var(--rose)]"><TriangleAlert size={15} /> A shoot is already booked at this date and time</div>
                  <ul className="mt-1.5 space-y-1 text-[var(--ink-2)]">
                    {clashes.map((b) => <li key={b.code}><b className="tnum">{timeRange(b.startTime, b.endTime)}</b> · {b.client || b.title} · {where(b)}{b.shooter ? ` · Shooter: ${b.shooter}` : " · shooter not assigned yet"}</li>)}
                  </ul>
                  <div className="mt-1.5 text-[var(--muted)]">Pick another time, or send it anyway — Studio X will confirm whether it can be done.</div>
                </div>
              )}
              {/* the rest of that day's bookings, so a free time is easy to pick */}
              {date && dayRows && dayRows.length > 0 && clashes.length < dayRows.length && (
                <div className="rounded-[12px] bg-[var(--surface-2)] px-3.5 py-3 text-[12.5px]">
                  <div className="font-semibold text-[var(--ink-2)]">{clashes.length ? "Also booked on this date" : "Already booked on this date"}</div>
                  <ul className="mt-1 space-y-0.5 text-[var(--muted)]">
                    {dayRows.filter((b) => !clashes.includes(b)).map((b) => <li key={b.code}><span className="font-semibold tnum text-[var(--ink-2)]">{timeRange(b.startTime, b.endTime)}</span> · {b.client || b.title} · {where(b)}{b.shooter ? ` · ${b.shooter}` : ""}</li>)}
                  </ul>
                </div>
              )}
              {date && dayRows && dayRows.length === 0 && (
                <div className="flex items-center gap-1.5 rounded-[12px] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--emerald)]" style={{ background: "color-mix(in srgb, var(--emerald) 8%, white)" }}><CalendarCheck size={14} /> Nothing is booked on this date yet.</div>
              )}

              <div className="block">
                <span className="eyebrow">Where</span>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["IN_HOUSE", "ON_LOCATION"] as const).map((k) => (
                    <button type="button" key={k} onClick={() => setLocType(k)} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition ${locType === k ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_8%,white)] text-[var(--violet)]" : "border-[var(--line-2)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}><MapPin size={13} /> {k === "IN_HOUSE" ? "In-house · Studio X" : "Client location"}</button>
                  ))}
                </div>
                <input type="hidden" name="locationType" value={locType} />
                <input name="location" placeholder={locType === "IN_HOUSE" ? "Studio X (optional)" : "Client address / location"} className="input mt-2" />
              </div>
              <label className="block"><span className="eyebrow">Brief / notes</span><textarea name="notes" rows={2} placeholder="What to shoot, deliverables, special requests…" className="textarea mt-1.5" /></label>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-violet"><Send size={14} /> {clashes.length ? "Send request anyway" : "Send request"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
