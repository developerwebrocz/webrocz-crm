import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Camera, MapPin, CalendarClock } from "lucide-react";

// Shoots assigned to this person that are still to be done, shown on top of their own
// dashboard. Used for video editors, who can be picked as the shooter by Studio X but whose
// home page is the video board (so an assigned shoot was easy to miss). Renders nothing when
// there is no open shoot.

const fmtDate = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return d ? `${d}-${m}-${y}` : iso || "—"; };
const STATUS: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Scheduled", color: "var(--sky)" },
  IN_PROGRESS: { label: "In progress", color: "var(--violet)" },
};

// Today's date in India (UTC+5:30), where the team works.
const todayInIndia = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default async function MyShootsStrip({ userId }: { userId: string }) {
  const shoots = await prisma.shoot.findMany({
    where: { assignedToId: userId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
    include: { client: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  if (shoots.length === 0) return null;
  const today = todayInIndia(); // to flag today's shoots
  return (
    <div className="card !p-0 overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--violet) 30%, white)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3" style={{ background: "color-mix(in srgb, var(--violet) 6%, white)" }}>
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: "var(--violet)" }}><Camera size={15} /></span>
          <div>
            <div className="text-[14.5px] font-bold">Shoots assigned to you</div>
            <div className="text-[12px] text-[var(--muted)]">{shoots.length} shoot{shoots.length === 1 ? "" : "s"} to do — scheduled by Studio X</div>
          </div>
        </div>
        <Link href="/shoots" prefetch className="btn btn-violet btn-sm">Open My Shoots</Link>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {shoots.map((s) => {
          const st = STATUS[s.status] ?? STATUS.SCHEDULED;
          return (
            <div key={s.id} className="grid gap-x-5 gap-y-1 px-5 py-3 sm:grid-cols-[170px_1fr_auto] sm:items-start">
              <div>
                <div className="flex items-center gap-1.5 text-[13px] font-semibold"><CalendarClock size={13} className="text-[var(--violet)]" /> {fmtDate(s.date)}{s.date === today && <span className="rounded bg-[color-mix(in_srgb,var(--violet)_14%,white)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--violet)]">Today</span>}</div>
                <div className="mt-0.5 text-[12px] tnum text-[var(--muted)]">{s.startTime || "—"}{s.endTime ? ` – ${s.endTime}` : ""}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">{s.title} <span className="text-[11px] font-normal text-[var(--faint)]">{s.code}</span></div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[var(--muted)]">
                  <span>{s.category === "STUDIO_RENT" ? (s.renterName || "Studio X rental") : (s.client?.name ?? "WebRocz shoot")}</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={11} /> {s.locationType === "ON_LOCATION" ? "On location" : "In-house (Studio X)"}{s.location ? ` · ${s.location}` : ""}</span>
                </div>
                {s.notes && <div className="mt-1 whitespace-pre-wrap text-[12.5px] text-[var(--ink-2)]"><b className="font-semibold">Note:</b> {s.notes}</div>}
              </div>
              <span className="justify-self-start whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold sm:justify-self-end" style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 13%, white)` }}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
