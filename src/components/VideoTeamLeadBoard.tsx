import Link from "next/link";
import { initials } from "@/lib/domain";
import { getVideoTeamBoard } from "@/lib/video-job-queries";
import { assignVideoJobEditors } from "@/app/video-job-actions";
import AssignClientVideosButton from "@/components/AssignClientVideosButton";
import AssignCreativeForm from "@/components/AssignCreativeForm";
import { Users, Crown, CheckCircle2, Clock3, Film, Scissors, UserPlus, ArrowRight, Camera, Clapperboard, ListOrdered } from "lucide-react";

// Team lead's dashboard: the whole video team at a glance — what each editor did today, which
// client videos and tasks they hold — and the two ways to give work: a client shoot's videos
// ("Assign client videos") or a single video task ("Assign video task"). Client shoots that
// nobody edits yet are listed first, with a one-click assign.

const PALETTE = ["#6d28d9", "#0284c7", "#059669", "#d97706", "#e11d48", "#0d9488", "#840a92", "#4f46e5"];
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });

export default async function VideoTeamLeadBoard({ meId }: { meId: string }) {
  const d = await getVideoTeamBoard();
  const chip = "inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] font-semibold has-[:checked]:border-[var(--violet)] has-[:checked]:bg-[color-mix(in_srgb,var(--violet)_8%,white)]";
  const stats = [
    { label: "Team today", value: d.todayTotal, sub: `${d.updated} of ${d.members.length} updated`, icon: Scissors, tone: "var(--violet)" },
    { label: "Client shoots open", value: d.openJobs, sub: "still being edited", icon: Film, tone: "var(--sky)" },
    { label: "Videos left to edit", value: d.videosLeft, sub: "across the team", icon: Clock3, tone: "var(--amber)" },
    { label: "Not assigned", value: d.unassigned.length, sub: "client shoots without an editor", icon: UserPlus, tone: d.unassigned.length ? "var(--rose)" : "var(--emerald)" },
  ];

  return (
    <div className="card !p-0 overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--violet) 22%, white)" }}>
      {/* header: what this is + the two ways to assign */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4" style={{ background: tint("var(--violet)", 4) }}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[11px] text-white" style={{ background: "var(--grad)" }}><Users size={18} /></span>
          <div>
            <div className="flex items-center gap-1.5 text-[16px] font-extrabold tracking-tight">My team <Crown size={14} className="text-[var(--amber)]" /></div>
            <div className="text-[12px] text-[var(--muted)]">Everyone’s work today — and assign client videos or a video task</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AssignCreativeForm members={d.form.editors.map((e) => ({ id: e.id, name: e.name, role: "EDITOR" }))} clients={d.clients} from="/" label="Assign video task" />
          <AssignClientVideosButton form={d.form} meId={meId} />
        </div>
      </div>

      {/* team figures */}
      <div className="grid grid-cols-2 gap-px border-b border-[var(--line)] bg-[var(--line)] lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 bg-[var(--surface)] px-5 py-3.5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px]" style={{ background: tint(s.tone, 12), color: s.tone }}><s.icon size={16} /></span>
            <div className="min-w-0">
              <div className="text-[22px] font-extrabold leading-none tnum">{s.value}</div>
              <div className="mt-1 truncate text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{s.label}</div>
              <div className="truncate text-[11px] text-[var(--faint)]">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* client shoots nobody edits yet → assign in one click */}
      {d.unassigned.length > 0 && (
        <div className="border-b border-[var(--line)]" style={{ background: tint("var(--amber)", 6) }}>
          <div className="flex items-center gap-2 px-5 pt-3.5 text-[12.5px] font-extrabold" style={{ color: "#7a4f08" }}><UserPlus size={15} /> Waiting to be assigned — pick the editor(s) and click Assign</div>
          <div className="divide-y divide-[color-mix(in_srgb,var(--amber)_18%,white)] px-5 pb-2">
            {d.unassigned.slice(0, 6).map((j) => (
              <form key={j.id} action={assignVideoJobEditors} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                <input type="hidden" name="id" value={j.id} /><input type="hidden" name="return" value="/" />
                <div className="min-w-0 flex-1 basis-[200px]">
                  <div className="truncate text-[13.5px] font-bold">{j.clientName}</div>
                  <div className="flex items-center gap-1 text-[11.5px] text-[var(--muted)]"><Camera size={11} /> {fmtDay(j.date)}{j.shotBy ? ` · ${j.shotBy}` : ""}{j.videosShot ? ` · ${j.videosShot} video${j.videosShot === 1 ? "" : "s"}` : ""}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {d.form.editors.map((e) => <label key={e.id} className={chip}><input type="checkbox" name="editorIds" value={e.id} className="h-3.5 w-3.5 accent-[var(--violet)]" /> {e.name}</label>)}
                </div>
                <button type="submit" className="btn btn-violet btn-sm">Assign</button>
              </form>
            ))}
            {d.unassigned.length > 6 && <Link href="/client-videos?tab=PENDING" className="block py-2 text-center text-[12.5px] font-bold text-[var(--violet)] hover:underline">+{d.unassigned.length - 6} more to assign</Link>}
          </div>
        </div>
      )}

      {/* every editor */}
      <div className="grid gap-px bg-[var(--line)]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        {d.members.map((m, i) => {
          const c = PALETTE[i % PALETTE.length];
          return (
            <div key={m.id} className="flex flex-col bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-[12.5px] font-extrabold" style={{ background: tint(c, 14), color: c }}>{initials(m.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-[14px] font-bold">{m.name}{m.id === meId ? <span className="text-[11px] font-semibold text-[var(--muted)]">(me)</span> : null}{m.lead && <Crown size={12} className="flex-none text-[var(--amber)]" />}</div>
                  <div className="text-[11px] text-[var(--muted)]">{m.monthTotal} videos this month</div>
                </div>
                {m.today !== null
                  ? <span className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: tint("var(--emerald)", 11), color: "var(--emerald)" }}><CheckCircle2 size={12} /> {m.today} today</span>
                  : <span className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: tint("var(--amber)", 13), color: "#92600a" }}><Clock3 size={12} /> Not updated</span>}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                {[[m.jobs.length, "Client shoots"], [m.videosLeft, "Videos left"], [m.openTasks, "Video tasks"]].map(([v, l]) => (
                  <div key={l} className="rounded-[8px] bg-[var(--surface-2)] px-1 py-1.5"><div className="text-[14px] font-extrabold tnum">{v}</div><div className="text-[9.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">{l}</div></div>
                ))}
              </div>

              <div className="mt-3 flex-1 space-y-2">
                {m.jobs.slice(0, 4).map((j) => {
                  const pct = j.videosShot > 0 ? Math.min(100, Math.round((j.edited / j.videosShot) * 100)) : 0;
                  return (
                    <div key={j.id}>
                      <div className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="truncate font-semibold" title={j.clientName}>{j.clientName}</span>
                        <span className="flex-none text-[11.5px] font-bold tnum">{j.edited}{j.videosShot ? <span className="font-normal text-[var(--muted)]"> / {j.videosShot}</span> : null}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} /></div>
                    </div>
                  );
                })}
                {m.jobs.length > 4 && <div className="text-[11.5px] font-semibold text-[var(--muted)]">+{m.jobs.length - 4} more client shoots</div>}
                {m.jobs.length === 0 && <div className="rounded-[8px] border border-dashed border-[var(--line-2)] px-3 py-3 text-center text-[11.5px] text-[var(--muted)]">No client videos pending</div>}
              </div>

              <div className="mt-3"><AssignClientVideosButton form={d.form} meId={meId} presetEditorId={m.id} label={`Assign to ${m.name.split(" ")[0]}`} variant="soft" /></div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t border-[var(--line)] bg-[var(--surface-2)] px-5 py-2.5 text-[12px] font-bold">
        <Link href="/client-videos" className="inline-flex items-center gap-1 text-[var(--violet)] hover:underline"><Film size={13} /> All client videos <ArrowRight size={12} /></Link>
        <Link href="/video-team" className="inline-flex items-center gap-1 text-[var(--violet)] hover:underline"><ListOrdered size={13} /> Team editing count <ArrowRight size={12} /></Link>
        <Link href="/video-team" className="inline-flex items-center gap-1 text-[var(--violet)] hover:underline"><Clapperboard size={13} /> Team video tasks <ArrowRight size={12} /></Link>
      </div>
    </div>
  );
}
