import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayIST } from "@/lib/india-date";
import { saveEditCount } from "@/app/edit-count-actions";
import CountStepper from "@/components/CountStepper";
import { Film, CheckCircle2, Clock3, ArrowRight, Save } from "lucide-react";

// On top of a video editor's own dashboard: enter today's editing count right there (no need
// to open another page), with this month's figures and the last 7 days beside it.

const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", timeZone: "UTC" });

export default async function TodayEditCount({ userId }: { userId: string }) {
  const today = todayIST();
  const month = today.slice(0, 7);
  const weekAgo = new Date(new Date(`${today}T00:00:00Z`).getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const from = weekAgo < `${month}-01` ? weekAgo : `${month}-01`;
  const rows = await prisma.editCount.findMany({ where: { userId, date: { gte: from, lte: today } }, select: { date: true, count: true, note: true } });
  const by = new Map(rows.map((r) => [r.date, r]));
  const mine = by.get(today);
  const inMonth = rows.filter((r) => r.date.startsWith(month));
  const total = inMonth.reduce((s, r) => s + r.count, 0);
  const worked = inMonth.filter((r) => r.count > 0).length;
  const avg = worked ? Math.round((total / worked) * 10) / 10 : 0;
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(new Date(`${weekAgo}T00:00:00Z`).getTime() + i * 86400000).toISOString().slice(0, 10);
    return { date, count: by.get(date)?.count ?? null, letter: ["S", "M", "T", "W", "T", "F", "S"][new Date(`${date}T00:00:00Z`).getUTCDay()] };
  });
  const weekMax = Math.max(1, ...week.map((w) => w.count ?? 0));

  return (
    <div className="card !p-0 overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--violet) 26%, white)" }}>
      <div className="grid gap-0 lg:grid-cols-[1.5fr_1fr]">
        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-[11px] text-white" style={{ background: "var(--grad)" }}><Film size={18} /></span>
              <div>
                <div className="text-[15px] font-bold">Today’s editing count</div>
                <div className="text-[12px] text-[var(--muted)]">{fmt(today)}</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={mine ? { background: "color-mix(in srgb, var(--emerald) 11%, white)", color: "var(--emerald)" } : { background: "color-mix(in srgb, var(--amber) 13%, white)", color: "#92600a" }}>
              {mine ? <><CheckCircle2 size={13} /> Updated · {mine.count} video{mine.count === 1 ? "" : "s"}</> : <><Clock3 size={13} /> Not updated yet</>}
            </span>
          </div>
          <form action={saveEditCount} className="mt-4 space-y-3">
            <input type="hidden" name="date" value={today} />
            <input type="hidden" name="return" value="home" />
            {/* count + save on one line, the note under it — reads well at any width */}
            <div className="flex flex-wrap items-end gap-3">
              <label className="block w-[200px] max-w-full"><span className="eyebrow">Videos edited today</span><div className="mt-1.5"><CountStepper key={mine?.count ?? "new"} defaultValue={mine?.count ?? ""} big /></div></label>
              <button type="submit" className="btn btn-violet !h-12 px-6"><Save size={15} /> {mine ? "Update count" : "Save count"}</button>
            </div>
            <label className="block"><span className="eyebrow">Note (optional)</span><input name="note" maxLength={300} defaultValue={mine?.note ?? ""} placeholder="What did you edit? e.g. 2 reels + 1 testimonial" className="input mt-1.5" /></label>
          </form>
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-[var(--line)] bg-[var(--surface-2)] p-5 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["This month", total], ["Days", worked], ["Avg / day", avg]].map(([l, v]) => (
              <div key={l} className="rounded-[10px] bg-[var(--surface)] px-2 py-2.5 shadow-[var(--shadow-xs)]"><div className="text-[20px] font-extrabold leading-none tnum">{v}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{l}</div></div>
            ))}
          </div>
          <div>
            <div className="flex h-12 items-end gap-1.5">
              {week.map((w) => (
                <div key={w.date} className="flex h-full flex-1 flex-col justify-end" title={`${fmt(w.date)}: ${w.count === null ? "no entry" : w.count}`}>
                  <div className="rounded-t-[4px]" style={{ height: w.count ? `${Math.max(12, (w.count / weekMax) * 100)}%` : 3, background: w.count ? (w.date === today ? "var(--violet)" : "color-mix(in srgb, var(--violet) 45%, white)") : "var(--line-2)" }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1.5">{week.map((w) => <div key={w.date} className={`flex-1 text-center text-[10px] ${w.date === today ? "font-extrabold text-[var(--violet)]" : "text-[var(--faint)]"}`}>{w.letter}</div>)}</div>
            <Link href="/video-team" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--violet)] hover:underline">Open Editing Count <ArrowRight size={13} /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
