import { setFollowupStatus } from "@/app/sales-actions";
import { FOLLOWUP_STATUS } from "@/lib/domain";

type Row = { id: string; leadId: string; leadCode: string; leadName: string; company: string; owner: string; date: string; time: string; type: string; notes: string; status: string; overdue: boolean; dueToday: boolean };
type Buckets = { today: Row[]; overdue: Row[]; upcoming: Row[]; completed: Row[]; rescheduled: Row[]; noResponse: Row[] };
type Counts = { today: number; overdue: number; upcoming: number; completed: number; rescheduled: number; noResponse: number };

export default function FollowupsBoard({ buckets, counts }: { buckets: Buckets; counts: Counts }) {
  return (
    <div className="space-y-5">
      <div>
        <span className="eyebrow">Sales CRM · Follow-ups</span>
        <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">Follow-ups</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">Stay on top of every conversation. Overdue follow-ups are highlighted.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Today" value={counts.today} tone="var(--violet)" />
        <Kpi label="Overdue" value={counts.overdue} tone="var(--rose)" alert={counts.overdue > 0} />
        <Kpi label="Upcoming" value={counts.upcoming} tone="var(--sky)" />
        <Kpi label="Completed" value={counts.completed} tone="var(--emerald)" />
        <Kpi label="Rescheduled" value={counts.rescheduled} tone="var(--amber)" />
        <Kpi label="No Response" value={counts.noResponse} tone="var(--muted)" />
      </div>

      {buckets.overdue.length > 0 && <Section title="Overdue" rows={buckets.overdue} tone="var(--rose)" />}
      <Section title="Due today" rows={buckets.today} tone="var(--violet)" />
      <Section title="Upcoming" rows={buckets.upcoming} tone="var(--sky)" />
    </div>
  );
}

function Kpi({ label, value, tone, alert }: { label: string; value: number; tone: string; alert?: boolean }) {
  return (
    <div className="card card-pad" style={alert ? { background: "color-mix(in srgb, var(--rose) 5%, white)", borderColor: "color-mix(in srgb, var(--rose) 30%, white)" } : undefined}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tone }}>{label}</div>
      <div className="mt-1.5 text-[24px] font-extrabold leading-none tnum">{value}</div>
    </div>
  );
}

function Section({ title, rows, tone }: { title: string; rows: Row[]; tone: string }) {
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3"><span className="h-2 w-2 rounded-full" style={{ background: tone }} /><h2 className="text-[14px] font-bold">{title}</h2><span className="text-[12px] text-[var(--muted)] tnum">{rows.length}</span></div>
      {rows.length === 0 ? <div className="px-5 py-8 text-center text-[13px] text-[var(--muted)]">Nothing here.</div> : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Lead", "Type", "Date", "Owner", "Notes", ""].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3"><a href={`/sales/${r.leadId}`} className="text-[13px] font-semibold hover:text-[var(--violet)]">{r.leadName}</a><div className="text-[11px] text-[var(--faint)]">{r.leadCode}{r.company ? ` · ${r.company}` : ""}</div></td>
                  <td className="px-5 py-3 text-[12.5px]">{r.type}</td>
                  <td className="px-5 py-3 text-[12.5px] tnum" style={r.overdue ? { color: "var(--rose)", fontWeight: 600 } : undefined}>{r.date} {r.time}</td>
                  <td className="px-5 py-3 text-[12.5px]">{r.owner}</td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted)]">{r.notes || "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      {(["COMPLETED", "RESCHEDULED", "NO_RESPONSE"] as const).map((st) => (
                        <form key={st} action={setFollowupStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="leadId" value={r.leadId} /><input type="hidden" name="status" value={st} /><button className="rounded-md border border-[var(--line-2)] px-2 py-1 text-[11px] font-semibold hover:border-[var(--ink)]">{FOLLOWUP_STATUS[st]}</button></form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
