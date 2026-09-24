import { getCalendar } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PLATFORMS } from "@/lib/domain";
import { PageHeader, Card } from "@/components/ui";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = { magenta: "var(--magenta)", sky: "var(--sky)", indigo: "var(--indigo)", rose: "var(--rose)", violet: "var(--violet)", emerald: "var(--emerald)", amber: "var(--amber)", slate: "var(--ink-2)" };
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAM = user.role === "ACCOUNT_MANAGER" || user.role === "DM_EXEC";

  const sp = await searchParams;
  const now = new Date();
  const m = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : monthKey(now);
  const [yy, mm] = m.split("-").map(Number);
  const first = new Date(yy, mm - 1, 1);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const lead = first.getDay(); // 0=Sun
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const prev = monthKey(new Date(yy, mm - 2, 1));
  const next = monthKey(new Date(yy, mm, 1));
  const title = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const cal = await getCalendar(m, isAM ? user.id : undefined);

  // build 6-week grid
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Content calendar" title="SM Posts calendar" sub="Every scheduled and published social post, by day." />

      <Card className="flex flex-wrap items-center justify-between gap-3 !py-3">
        <div className="flex items-center gap-2">
          <a href={`/calendar?month=${prev}`} className="grid h-9 w-9 place-items-center rounded-[var(--r-md)] border border-[var(--line-2)] hover:border-[var(--ink)]"><ChevronLeft size={16} /></a>
          <span className="min-w-[150px] text-center text-[15px] font-bold">{title}</span>
          <a href={`/calendar?month=${next}`} className="grid h-9 w-9 place-items-center rounded-[var(--r-md)] border border-[var(--line-2)] hover:border-[var(--ink)]"><ChevronRight size={16} /></a>
          <a href="/calendar" className="ml-1 text-[12.5px] font-semibold text-[var(--violet)] hover:underline">Today</a>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          <span className="inline-flex items-center gap-1 text-[var(--muted)]"><CheckCircle2 size={13} className="text-[var(--emerald)]" /> {cal.posted} posted</span>
          <span className="inline-flex items-center gap-1 text-[var(--muted)]"><Clock size={13} className="text-[var(--amber)]" /> {cal.scheduled} scheduled</span>
          <span className="badge badge-violet tnum">{cal.total} posts</span>
        </div>
      </Card>

      <Card pad={false} className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--line)]">
          {WD.map((w) => <div key={w} className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dateKey = day ? `${m}-${String(day).padStart(2, "0")}` : "";
            const posts = day ? cal.byDay[dateKey] ?? [] : [];
            const isToday = dateKey === todayKey;
            return (
              <div key={i} className={`min-h-[104px] border-b border-r border-[var(--line)] p-1.5 [&:nth-child(7n)]:border-r-0 ${day ? "" : "bg-[var(--surface-2)]"}`}>
                {day && (
                  <>
                    <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold tnum ${isToday ? "bg-[var(--violet)] text-white" : "text-[var(--ink-2)]"}`}>{day}</div>
                    <div className="space-y-1">
                      {posts.slice(0, 4).map((p, j) => {
                        const cfg = PLATFORMS[p.platform as keyof typeof PLATFORMS];
                        const tone = TONE[cfg?.tone ?? "slate"];
                        const done = p.status === "POSTED";
                        return (
                          <div key={j} className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: `color-mix(in srgb, ${tone} ${done ? 14 : 8}%, white)`, color: tone }} title={`${p.client} · ${cfg?.label ?? p.platform} · ${p.postType} · ${done ? "Posted" : "Scheduled"}`}>
                            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: tone, opacity: done ? 1 : 0.4 }} />
                            <span className="truncate">{p.client}</span>
                          </div>
                        );
                      })}
                      {posts.length > 4 && <div className="px-1.5 text-[10px] font-semibold text-[var(--muted)]">+{posts.length - 4} more</div>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* platform legend */}
      <div className="flex flex-wrap gap-3 text-[12px]">
        {Object.entries(PLATFORMS).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[var(--muted)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE[v.tone] }} /> {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}
