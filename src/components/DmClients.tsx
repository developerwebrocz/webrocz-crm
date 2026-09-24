import { assignDmExec } from "@/app/sales-actions";

type Row = { id: string; code: string; name: string; poc: string | null; phone: string | null; retainer: number; assigned: string | null; assignedId: string | null; services: string[]; createdAt: string };
type Exec = { id: string; name: string };
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const SVC_LABEL: Record<string, string> = { SEO: "SEO", SMO: "Social Media", META_ADS: "Meta Ads", GOOGLE_ADS: "Google Ads", WEBSITE_DEV: "Website" };

export default function DmClients({ rows, execs, counts, canAssign }: { rows: Row[]; execs: Exec[]; counts: { total: number; unassigned: number; assigned: number }; canAssign: boolean }) {
  const unassigned = rows.filter((r) => !r.assignedId);
  const assigned = rows.filter((r) => r.assignedId);
  return (
    <div className="space-y-5">
      <div>
        <span className="eyebrow">Digital Marketing</span>
        <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">Marketing Clients</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">Onboarded marketing clients. {canAssign ? "Assign each to a Digital Marketing Executive." : "Clients assigned to you."}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:max-w-[420px]">
        <Tile label="Total" value={counts.total} />
        <Tile label="Unassigned" value={counts.unassigned} tone="var(--amber)" alert={counts.unassigned > 0} />
        <Tile label="Assigned" value={counts.assigned} tone="var(--emerald)" />
      </div>

      {canAssign && (
        <Section title="Unassigned" tone="var(--amber)" count={unassigned.length}>
          {unassigned.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--amber)_35%,white)] bg-[color-mix(in_srgb,var(--amber)_5%,white)] p-3.5">
              <div>
                <div className="text-[13.5px] font-semibold">{r.name}</div>
                <div className="text-[11.5px] text-[var(--faint)]">{r.code} · {r.services.map((s) => SVC_LABEL[s] ?? s).join(", ")} · {inr(r.retainer)}/mo</div>
              </div>
              <form action={assignDmExec} className="flex items-center gap-2">
                <input type="hidden" name="clientId" value={r.id} />
                <select name="execId" required className="select !w-auto !py-1.5"><option value="">— Select executive —</option>{execs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                <button className="btn btn-violet btn-sm">Assign</button>
              </form>
            </div>
          ))}
          {unassigned.length === 0 && <div className="text-[13px] text-[var(--muted)]">Nothing waiting — all clients assigned. 🎉</div>}
        </Section>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3.5"><h2 className="text-[14.5px] font-bold">{canAssign ? "Assigned clients" : "Your clients"}</h2></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Client", "Services", "Monthly", "Executive", "Onboarded", ""].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {(canAssign ? assigned : rows).map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3"><div className="text-[13px] font-semibold">{r.name}</div><div className="text-[11px] text-[var(--faint)]">{r.code}</div></td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted)]">{r.services.map((s) => SVC_LABEL[s] ?? s).join(", ")}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum">{r.retainer ? inr(r.retainer) : "—"}</td>
                  <td className="px-5 py-3 text-[12.5px]">{r.assigned ?? <span className="text-[var(--amber)]">Unassigned</span>}</td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted)] tnum">{r.createdAt}</td>
                  <td className="px-5 py-3 text-right"><a href={`/clients/${r.id}`} className="text-[12px] font-semibold text-[var(--violet)]">Open</a></td>
                </tr>
              ))}
              {(canAssign ? assigned : rows).length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No marketing clients yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone, alert }: { label: string; value: number; tone?: string; alert?: boolean }) {
  return (
    <div className="card card-pad" style={alert ? { borderColor: "color-mix(in srgb, var(--amber) 30%, white)", background: "color-mix(in srgb, var(--amber) 5%, white)" } : undefined}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tone ?? "var(--muted)" }}>{label}</div>
      <div className="mt-1.5 text-[22px] font-extrabold leading-none tnum">{value}</div>
    </div>
  );
}

function Section({ title, tone, count, children }: { title: string; tone: string; count: number; children: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: tone }} /><h2 className="text-[14px] font-bold">{title}</h2><span className="text-[12px] text-[var(--muted)] tnum">{count}</span></div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
