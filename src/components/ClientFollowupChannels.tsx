"use client";

import { Phone, MessageCircle, MessageSquarePlus } from "lucide-react";
import { logClientFollowup } from "@/app/actions";

// Client follow-ups kept separately by how the client was reached: Phone and WhatsApp.
// Each side has its own "log a follow-up" form (note and when it was done — date + time; the
// team follows up every day, so no "next follow-up" date is asked) and its own
// history, newest first. Follow-ups saved before this existed carry no type and are listed
// under "Earlier follow-ups". Used by the Follow-up popup in the clients list and by the
// Follow-ups card on a client's page.

export type ClientFollowup = { date: string; time?: string; by: string; note: string; next?: string; nextTime?: string; via?: string };

const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split(" ")[0].split("-"); return d ? `${d}-${m}-${y}` : iso; };
// "17:42" → "5:42 PM" (follow-ups saved before the time was recorded have none).
export const fmtTime = (hm?: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(hm || ""); if (!m) return ""; const h = Number(m[1]); return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`; };
// "08-10-2026 · 5:42 PM" — when a follow-up was done.
export const followupWhen = (f: { date: string; time?: string }) => fmtDate(f.date) + (fmtTime(f.time) ? ` · ${fmtTime(f.time)}` : "");
// The newest follow-up of a client (by date, then time; later-saved wins a tie), or null.
export function latestFollowup<T extends { date: string; time?: string }>(list: T[]): T | null {
  let best: T | null = null, key = "";
  for (const f of list) { const k = `${f.date} ${f.time || ""}`; if (!best || k >= key) { best = f; key = k; } }
  return best;
}

const CHANNELS = [
  { key: "PHONE", label: "Phone", Icon: Phone, color: "var(--indigo)", placeholder: "e.g. Called — will pay by Friday" },
  { key: "WHATSAPP", label: "WhatsApp", Icon: MessageCircle, color: "var(--emerald)", placeholder: "e.g. Sent the invoice on WhatsApp — seen, no reply yet" },
] as const;

export default function ClientFollowupChannels({ clientId, returnTo, followups }: { clientId: string; returnTo: string; followups: ClientFollowup[] }) {
  // newest first: by date, then time; same moment (or no time) → the one saved later first
  const newestFirst = followups.map((f, i) => ({ f, i })).sort((a, b) => { const ka = a.f.date + " " + (a.f.time || ""), kb = b.f.date + " " + (b.f.time || ""); return ka === kb ? b.i - a.i : ka < kb ? 1 : -1; }).map((x) => x.f);
  const earlier = newestFirst.filter((f) => f.via !== "PHONE" && f.via !== "WHATSAPP");
  // The follow-up date + time boxes are filled with "now" on this computer as soon as they
  // appear (in the browser, so it is the user's clock and not the server's).
  const two = (v: number) => String(v).padStart(2, "0");
  const fillToday = (el: HTMLInputElement | null) => { if (el && !el.value) { const d = new Date(); el.value = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`; el.max = el.value; } };
  const fillNow = (el: HTMLInputElement | null) => { if (el && !el.value) { const d = new Date(); el.value = `${two(d.getHours())}:${two(d.getMinutes())}`; } };
  const lbl = "text-[12.5px] font-semibold text-[var(--ink-2)]";
  return (
    <div className="space-y-5">
      <div className="grid items-start gap-4 md:grid-cols-2">
        {CHANNELS.map(({ key, label, Icon, color, placeholder }) => {
          const list = newestFirst.filter((f) => f.via === key);
          const last = list[0]; // newest first → the previous follow-up
          return (
            <section key={key} className="overflow-hidden rounded-[14px] border bg-[var(--surface)]" style={{ borderColor: `color-mix(in srgb, ${color} 28%, white)` }}>
              {/* header: what this side is, how many, and when the next one is due */}
              <header className="flex items-center gap-2.5 px-4 py-3" style={{ background: `color-mix(in srgb, ${color} 7%, white)` }}>
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full text-white" style={{ background: color }}><Icon size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-bold leading-tight text-[var(--ink)]">{label} follow-up</div>
                  <div className="mt-0.5 text-[11.5px] leading-tight text-[var(--muted)]">{list.length === 0 ? "None yet" : `${list.length} logged`}</div>
                </div>
                {last && (
                  <span className="flex-none rounded-full px-2.5 py-1 text-right text-[11.5px] font-semibold leading-none" style={{ color, background: `color-mix(in srgb, ${color} 12%, white)` }}>
                    <span className="mr-1 font-medium">Last</span><span className="tnum">{followupWhen(last)}</span>
                  </span>
                )}
              </header>

              <form action={logClientFollowup} className="space-y-3 px-4 py-4">
                <input type="hidden" name="id" value={clientId} />
                <input type="hidden" name="return" value={returnTo} />
                <input type="hidden" name="via" value={key} />
                <label className="block">
                  <span className="text-[12.5px] font-semibold text-[var(--ink-2)]">Response / note</span>
                  <textarea name="note" rows={3} required className="input mt-1.5 resize-none !text-[13.5px] leading-relaxed" placeholder={placeholder} />
                </label>
                {/* when this follow-up was done — filled with now, can be changed */}
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block"><span className={lbl}>Follow-up date</span><input ref={fillToday} name="date" type="date" className="input mt-1.5 !text-[13.5px]" /></label>
                  <label className="block"><span className={lbl}>Follow-up time</span><input ref={fillNow} name="time" type="time" className="input mt-1.5 !text-[13.5px]" /></label>
                </div>
                <div className="flex justify-end"><button type="submit" className="btn justify-center whitespace-nowrap px-6 text-white" style={{ background: color }}><MessageSquarePlus size={15} /> Save follow-up</button></div>
              </form>

              <div className="border-t border-[var(--line)] px-4 py-3.5">
                <div className="mb-2 text-[12.5px] font-semibold text-[var(--ink-2)]">Previous {label} follow-ups</div>
                {list.length === 0
                  ? <p className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5 text-[12.5px] text-[var(--muted)]">Nothing logged yet.</p>
                  : <div className="max-h-[230px] space-y-2 overflow-y-auto scroll-thin pr-0.5">{list.map((n, i) => <Entry key={i} n={n} />)}</div>}
              </div>
            </section>
          );
        })}
      </div>

      {earlier.length > 0 && (
        <div>
          <div className="mb-2 text-[12.5px] font-semibold text-[var(--ink-2)]">Earlier follow-ups <span className="font-normal text-[var(--muted)]">· saved before Phone and WhatsApp were separate</span></div>
          <div className="space-y-2">{earlier.map((n, i) => <Entry key={i} n={n} />)}</div>
        </div>
      )}
    </div>
  );
}

// One logged follow-up: when it was done (date · time), by whom, and the note.
function Entry({ n }: { n: ClientFollowup }) {
  const time = fmtTime(n.time);
  return (
    <div className="rounded-[10px] border border-[var(--line)] px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3 text-[12px] leading-tight">
        <span className="whitespace-nowrap font-semibold tnum text-[var(--ink)]">{fmtDate(n.date)}{time ? ` · ${time}` : ""}</span>
        <span className="min-w-0 truncate text-[var(--muted)]">{n.by || "—"}</span>
      </div>
      <div className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ink)]">{n.note}</div>
    </div>
  );
}
