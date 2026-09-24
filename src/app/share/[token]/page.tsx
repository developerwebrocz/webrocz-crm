import { getProjectShare } from "@/lib/queries";
import { DEV_PLATFORMS, PROJECT_TYPES, PROJECT_STATUS } from "@/lib/domain";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import Image from "next/image";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = { slate: "var(--ink-2)", violet: "var(--violet)", amber: "var(--amber)", emerald: "var(--emerald)", rose: "var(--rose)", sky: "var(--sky)", indigo: "var(--indigo)" };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await getProjectShare(token);

  if (!p) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4">
        <div className="text-center">
          <div className="text-[15px] font-bold">Link not available</div>
          <p className="mt-1 text-sm text-[var(--muted)]">This share link is invalid or has been turned off.</p>
        </div>
      </div>
    );
  }

  const st = PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS];
  const stTone = TONE[st?.tone ?? "violet"];
  const pf = DEV_PLATFORMS[p.platform as keyof typeof DEV_PLATFORMS];

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="flex items-center justify-center gap-2">
          <Image src="/webrocz-horizontal.png" alt="WebRocz" width={150} height={38} className="h-[26px] w-auto object-contain" priority />
        </div>
        <div className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--violet)]">Project status</div>

        <div className="card mt-5 p-6 sm:p-7" style={{ boxShadow: "var(--shadow-md)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-extrabold tracking-tight">{p.name}</h1>
              <div className="mt-1 text-[13px] text-[var(--muted)]">
                {p.client ?? "—"} · {pf?.label ?? p.platform} · {PROJECT_TYPES[p.projectType as keyof typeof PROJECT_TYPES] ?? p.projectType}
              </div>
            </div>
            <span className="badge tnum" style={{ background: `color-mix(in srgb, ${stTone} 12%, white)`, color: stTone }}>{st?.label ?? p.status}</span>
          </div>

          {/* progress */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="eyebrow">Overall progress</span>
              <span className="text-[15px] font-extrabold tnum" style={{ color: stTone }}>{p.progress}%</span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-[var(--surface-3)]">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, p.progress)}%`, background: stTone }} />
            </div>
            {p.dueDate && <div className="mt-2 text-[12px] text-[var(--muted)] tnum">Target date · {p.dueDate}</div>}
          </div>

          {/* checklist */}
          {p.tasks.length > 0 && (
            <div className="mt-6">
              <div className="eyebrow mb-2">Milestones</div>
              <div className="space-y-1.5">
                {p.tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13.5px]">
                    {t.done ? <CheckCircle2 size={16} className="flex-none text-[var(--emerald)]" /> : <Circle size={16} className="flex-none text-[var(--faint)]" />}
                    <span className={t.done ? "text-[var(--muted)] line-through" : "text-[var(--ink-2)]"}>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.liveUrl && (
            <a href={p.liveUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--violet)] hover:underline">
              <ExternalLink size={14} /> View live site
            </a>
          )}

          {/* recent updates */}
          {p.activity.length > 0 && (
            <div className="mt-6 border-t border-[var(--line)] pt-4">
              <div className="eyebrow mb-2">Recent updates</div>
              <div className="space-y-2">
                {p.activity.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12.5px]">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[var(--violet)]" />
                    <div><span className="font-semibold">{a.actor}</span> <span className="text-[var(--ink-2)]">{a.message}</span>
                      <span className="ml-1.5 text-[11px] text-[var(--faint)] tnum">{new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[12px] text-[var(--faint)]">Live status shared by WebRocz · updates automatically</p>
      </div>
    </div>
  );
}
