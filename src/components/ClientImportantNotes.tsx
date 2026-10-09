"use client";

import { StickyNote, Plus } from "lucide-react";
import { addClientImportantNote, type ImportantNote } from "@/app/client-notes-actions";

// "Important notes" card on a client's page (accountants' section), shown beside the
// Registration & renewal box. Add a note; every note is stamped with the date, time and the
// person who wrote it, and the earlier ones stay listed below, newest first.

const fmtDate = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return d ? `${d}-${m}-${y}` : iso || "—"; };
const fmtTime = (hm: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(hm || ""); if (!m) return ""; const h = Number(m[1]); return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`; };

export function parseImportantNotes(raw: string | null | undefined): ImportantNote[] {
  try { const arr = JSON.parse(raw || "[]"); return Array.isArray(arr) ? arr.filter((n) => n && n.note) : []; } catch { return []; }
}

export default function ClientImportantNotes({ clientId, returnTo, notes }: { clientId: string; returnTo: string; notes: ImportantNote[] }) {
  // newest first (same date + time → the one saved later first)
  const list = notes.map((n, i) => ({ n, i })).sort((a, b) => { const ka = `${a.n.date} ${a.n.time}`, kb = `${b.n.date} ${b.n.time}`; return ka === kb ? b.i - a.i : ka < kb ? 1 : -1; }).map((x) => x.n);
  return (
    // Beside the details box (wide screens) the card takes exactly that box's height and its
    // list scrolls inside; stacked below it (narrower screens) the list is capped instead.
    <div className="relative xl:min-h-[340px]">
    <div className="card flex flex-col !p-0 overflow-hidden xl:absolute xl:inset-0">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3" style={{ background: "color-mix(in srgb, var(--amber) 7%, white)" }}>
        <h3 className="flex items-center gap-2 text-[13.5px] font-bold text-[var(--ink)]"><span className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: "var(--amber)" }}><StickyNote size={14} /></span> Important notes</h3>
        <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-[11.5px] font-bold tnum text-[var(--ink-2)]">{list.length}</span>
      </div>

      <form action={addClientImportantNote} className="border-b border-[var(--line)] px-5 py-3.5">
        <input type="hidden" name="id" value={clientId} />
        <input type="hidden" name="return" value={returnTo} />
        <textarea name="note" rows={2} required maxLength={2000} className="input resize-none !text-[13px] leading-relaxed" placeholder="Write an important note about this client…" />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-[var(--faint)]">Saved with your name, date and time.</span>
          <button type="submit" className="btn btn-sm whitespace-nowrap text-white" style={{ background: "var(--amber)" }}><Plus size={14} /> Add note</button>
        </div>
      </form>

      <div className="max-h-[300px] min-h-0 flex-1 space-y-2.5 overflow-y-auto scroll-thin px-5 py-3.5 xl:max-h-none">
        {list.length === 0 && <p className="py-3 text-center text-[12.5px] text-[var(--muted)]">No important notes yet.</p>}
        {list.map((n, i) => (
          <div key={i} className="rounded-[10px] border-l-[3px] bg-[var(--surface-2)] px-3.5 py-2.5" style={{ borderLeftColor: i === 0 ? "var(--amber)" : "var(--line-2)" }}>
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ink)]">{n.note}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-[var(--muted)]">
              <span className="font-semibold tnum text-[var(--ink-2)]">{fmtDate(n.date)}{fmtTime(n.time) ? ` · ${fmtTime(n.time)}` : ""}</span>
              <span>· {n.by || "—"}</span>
              {i === 0 && list.length > 1 && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ color: "#92600a", background: "color-mix(in srgb, var(--amber) 16%, white)" }}>Latest</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
