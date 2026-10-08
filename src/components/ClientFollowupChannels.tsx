"use client";

import { Phone, MessageCircle, CalendarClock, MessageSquarePlus } from "lucide-react";
import { logClientFollowup } from "@/app/actions";

// Client follow-ups kept separately by how the client was reached: Phone and WhatsApp.
// Each side has its own "log a follow-up" form (note + next follow-up date) and its own
// history, newest first. Follow-ups saved before this existed carry no type and are listed
// under "Earlier follow-ups". Used by the Follow-up popup in the clients list and by the
// Follow-ups card on a client's page.

export type ClientFollowup = { date: string; by: string; note: string; next?: string; via?: string };

const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split(" ")[0].split("-"); return d ? `${d}-${m}-${y}` : iso; };
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso: string, n: number) => { const d = new Date((iso || todayISO()) + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const CHANNELS = [
  { key: "PHONE", label: "Phone", Icon: Phone, color: "var(--indigo)", placeholder: "e.g. Called — will pay by Friday" },
  { key: "WHATSAPP", label: "WhatsApp", Icon: MessageCircle, color: "var(--emerald)", placeholder: "e.g. Sent the invoice on WhatsApp — seen, no reply yet" },
] as const;

export default function ClientFollowupChannels({ clientId, returnTo, followups }: { clientId: string; returnTo: string; followups: ClientFollowup[] }) {
  const newestFirst = [...followups].sort((a, b) => (a.date < b.date ? 1 : -1));
  const earlier = newestFirst.filter((f) => f.via !== "PHONE" && f.via !== "WHATSAPP");
  return (
    <div className="space-y-5">
      <div className="grid items-start gap-4 md:grid-cols-2">
        {CHANNELS.map(({ key, label, Icon, color, placeholder }) => {
          const list = newestFirst.filter((f) => f.via === key);
          const next = list.find((f) => f.next)?.next ?? "";
          return (
            <section key={key} className="overflow-hidden rounded-[14px] border bg-[var(--surface)]" style={{ borderColor: `color-mix(in srgb, ${color} 28%, white)` }}>
              {/* header: what this side is, how many, and when the next one is due */}
              <header className="flex items-center gap-2.5 px-4 py-3" style={{ background: `color-mix(in srgb, ${color} 7%, white)` }}>
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full text-white" style={{ background: color }}><Icon size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-bold leading-tight text-[var(--ink)]">{label} follow-up</div>
                  <div className="mt-0.5 text-[11.5px] leading-tight text-[var(--muted)]">{list.length === 0 ? "None yet" : `${list.length} logged`}</div>
                </div>
                {next && (
                  <span className="flex-none rounded-full px-2.5 py-1 text-right text-[11.5px] font-semibold leading-none" style={{ color: "#92600a", background: "color-mix(in srgb, var(--amber) 14%, white)" }}>
                    <span className="mr-1 font-medium">Next</span><span className="tnum">{fmtDate(next)}</span>
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
                <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
                  <label className="block">
                    <span className="text-[12.5px] font-semibold text-[var(--ink-2)]">Next follow-up date</span>
                    <input name="next" type="date" defaultValue={addDaysISO(todayISO(), 3)} className="input mt-1.5 !text-[13.5px]" />
                  </label>
                  <button type="submit" className="btn h-[43px] justify-center whitespace-nowrap px-5 text-white" style={{ background: color }}><MessageSquarePlus size={15} /> Save</button>
                </div>
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

// One logged follow-up: date + who on the left, its next-follow-up date on the right, note below.
function Entry({ n }: { n: ClientFollowup }) {
  return (
    <div className="rounded-[10px] border border-[var(--line)] px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-[12px] leading-tight">
          <span className="font-semibold tnum text-[var(--ink)]">{fmtDate(n.date)}</span>
          <span className="text-[var(--muted)]"> · {n.by || "—"}</span>
        </div>
        {n.next && <span className="inline-flex flex-none items-center gap-1 text-[11.5px] font-medium leading-tight text-[var(--muted)]"><CalendarClock size={12} /> Next <span className="tnum font-semibold text-[var(--ink-2)]">{fmtDate(n.next)}</span></span>}
      </div>
      <div className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ink)]">{n.note}</div>
    </div>
  );
}
