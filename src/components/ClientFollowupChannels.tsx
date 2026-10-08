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
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {CHANNELS.map(({ key, label, Icon, color, placeholder }) => {
          const list = newestFirst.filter((f) => f.via === key);
          const next = list.find((f) => f.next)?.next ?? "";
          return (
            <div key={key} className="flex flex-col overflow-hidden rounded-[12px] border" style={{ borderColor: `color-mix(in srgb, ${color} 30%, white)` }}>
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5" style={{ background: `color-mix(in srgb, ${color} 8%, white)` }}>
                <span className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color }}><Icon size={15} /> {label} follow-up <span className="font-semibold text-[var(--muted)]">({list.length})</span></span>
                {next && <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-[var(--amber)]"><CalendarClock size={12} /> Next: {fmtDate(next)}</span>}
              </div>

              <form action={logClientFollowup} className="space-y-2.5 border-b border-[var(--line)] px-3.5 py-3">
                <input type="hidden" name="id" value={clientId} />
                <input type="hidden" name="return" value={returnTo} />
                <input type="hidden" name="via" value={key} />
                <label className="block"><span className="eyebrow">{label} — response / note</span><textarea name="note" rows={2} required className="input mt-1" placeholder={placeholder} /></label>
                <div className="flex items-end gap-2">
                  <label className="block flex-1"><span className="eyebrow">Next follow-up date</span><input name="next" type="date" defaultValue={addDaysISO(todayISO(), 3)} className="input mt-1" /></label>
                  <button type="submit" className="btn btn-sm whitespace-nowrap text-white" style={{ background: color }}><MessageSquarePlus size={14} /> Save</button>
                </div>
              </form>

              <div className="max-h-[220px] flex-1 space-y-2 overflow-y-auto scroll-thin px-3.5 py-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--faint)]">Previous {label} follow-ups</div>
                {list.length === 0 && <p className="text-[12.5px] text-[var(--muted)]">No {label} follow-up yet.</p>}
                {list.map((n, i) => <Entry key={i} n={n} />)}
              </div>
            </div>
          );
        })}
      </div>

      {earlier.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--faint)]">Earlier follow-ups <span className="font-medium normal-case">(saved before Phone / WhatsApp were separate)</span></div>
          <div className="space-y-2">{earlier.map((n, i) => <Entry key={i} n={n} />)}</div>
        </div>
      )}
    </div>
  );
}

function Entry({ n }: { n: ClientFollowup }) {
  return (
    <div className="rounded-[10px] border border-[var(--line)] px-3 py-2 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--faint)]"><span className="tnum">{fmtDate(n.date)}</span><span className="font-semibold text-[var(--violet)]">· {n.by || "—"}</span>{n.next && <span className="ml-auto inline-flex items-center gap-1"><CalendarClock size={11} /> {fmtDate(n.next)}</span>}</div>
      <div className="mt-0.5 whitespace-pre-wrap text-[var(--ink-2)]">{n.note}</div>
    </div>
  );
}
