"use client";

import { useMemo, useState } from "react";
import { CREATIVE_STATUS } from "@/lib/domain";
import { deleteCreativeTask } from "@/app/actions";
import AssignCreativeForm from "@/components/AssignCreativeForm";
import { Search, ChevronDown, Download, Palette, Clapperboard, ExternalLink, Trash2 } from "lucide-react";

type Row = {
  id: string; kind: string; code: string; title: string;
  member: string; memberId: string; role: string;
  client: string; type: string; priority: string; status: string; source: string;
  assignedDate: string; dueDate: string; finalLink: string; updatedAt: string; overdue: boolean;
};
type Member = { id: string; name: string; role: string };

const STATUS_TONE: Record<string, string> = { PENDING: "var(--muted)", IN_PROGRESS: "var(--sky)", REVIEW: "var(--violet)", COMPLETED: "var(--emerald)" };
const PRIORITY_TONE: Record<string, string> = { HIGH: "var(--rose)", MEDIUM: "var(--amber)", LOW: "var(--emerald)" };

function shortDate(d: string) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";
}

export default function CreativeReport({
  rows, clients, types, days, members, clientOptions,
}: {
  rows: Row[]; clients: string[]; types: string[]; days: string[]; members: Member[]; clientOptions: { id: string; name: string }[]; today: string;
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("ALL");
  const [member, setMember] = useState("ALL");
  const [client, setClient] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [day, setDay] = useState("ALL");

  const memberChoices = useMemo(() => members.filter((m) => role === "ALL" || m.role === role), [members, role]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (role !== "ALL" && r.role !== role) return false;
      if (member !== "ALL" && r.memberId !== member) return false;
      if (client !== "ALL" && r.client !== client) return false;
      if (type !== "ALL" && r.type !== type) return false;
      if (status === "OVERDUE" ? !r.overdue : status !== "ALL" && r.status !== status) return false;
      if (day !== "ALL" && r.assignedDate !== day) return false;
      if (n && !(r.title.toLowerCase().includes(n) || r.client.toLowerCase().includes(n) || r.code.toLowerCase().includes(n) || r.member.toLowerCase().includes(n) || r.type.toLowerCase().includes(n))) return false;
      return true;
    });
  }, [rows, q, role, member, client, type, status, day]);

  const kpi = useMemo(() => {
    const k = { total: filtered.length, done: 0, prog: 0, review: 0, pending: 0, overdue: 0 };
    for (const r of filtered) {
      if (r.overdue) k.overdue++;
      if (r.status === "COMPLETED") k.done++;
      else if (r.status === "IN_PROGRESS") k.prog++;
      else if (r.status === "REVIEW") k.review++;
      else k.pending++;
    }
    return k;
  }, [filtered]);
  const pct = kpi.total ? Math.round((kpi.done / kpi.total) * 100) : 0;

  // per-member roll-up (over the filtered set)
  const perMember = useMemo(() => {
    const map = new Map<string, { name: string; role: string; total: number; done: number; prog: number; review: number; pending: number; overdue: number }>();
    for (const r of filtered) {
      const cur = map.get(r.memberId) ?? { name: r.member, role: r.role, total: 0, done: 0, prog: 0, review: 0, pending: 0, overdue: 0 };
      cur.total++;
      if (r.overdue) cur.overdue++;
      if (r.status === "COMPLETED") cur.done++;
      else if (r.status === "IN_PROGRESS") cur.prog++;
      else if (r.status === "REVIEW") cur.review++;
      else cur.pending++;
      map.set(r.memberId, cur);
    }
    return [...map.values()].sort((a, b) => b.done - a.done || b.total - a.total);
  }, [filtered]);

  // per-day roll-up (assigned date)
  const perDay = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const r of filtered) {
      if (!r.assignedDate) continue;
      const cur = map.get(r.assignedDate) ?? { total: 0, done: 0 };
      cur.total++; if (r.status === "COMPLETED") cur.done++;
      map.set(r.assignedDate, cur);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const download = () => {
    const head = ["Assigned", "Member", "Role", "Kind", "Code", "Title", "Client", "Type", "Priority", "Status", "Due", "Final link"];
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.join(",")];
    for (const r of filtered) {
      lines.push([r.assignedDate, r.member, r.role, r.kind, r.code, r.title, r.client, r.type, r.priority,
        CREATIVE_STATUS[r.status as keyof typeof CREATIVE_STATUS]?.label ?? r.status, r.dueDate, r.finalLink].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `creative-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const resetMember = (v: string) => { setRole(v); setMember("ALL"); };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Super Admin · Creative Team</span>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">Designer & Video Editor Report</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Every design & video task — filter by member, client, day or status to see exactly what each person worked on.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AssignCreativeForm members={members} clients={clientOptions} />
          <button onClick={download} className="btn btn-dark"><Download size={15} /> Download CSV</button>
        </div>
      </div>

      {/* filters */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item, client, member…" className="w-full rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[var(--violet)] focus:bg-[var(--surface)]" />
          </div>
          <Sel value={role} onChange={resetMember} raw={[["ALL", "All Teams"], ["DESIGNER", "Designers"], ["EDITOR", "Video Editors"]]} />
          <Sel value={member} onChange={setMember} all="All Members" opts={memberChoices.map((m) => [m.id, m.name])} />
          <Sel value={client} onChange={setClient} all="All Clients" opts={clients.map((c) => [c, c])} />
          <Sel value={type} onChange={setType} all="All Types" opts={types.map((t) => [t, t])} />
          <Sel value={status} onChange={setStatus} raw={[["ALL", "All Status"], ["PENDING", "Pending"], ["IN_PROGRESS", "In Progress"], ["REVIEW", "Review Pending"], ["COMPLETED", "Completed"], ["OVERDUE", "Overdue"]]} />
          <Sel value={day} onChange={setDay} all="All Days (assigned)" opts={days.map((d) => [d, shortDate(d)])} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Items" value={kpi.total} tone="ink" />
        <Kpi label="Completed" value={kpi.done} sub={`${pct}% done`} tone="emerald" />
        <Kpi label="In progress" value={kpi.prog} tone="sky" />
        <Kpi label="Review pending" value={kpi.review} tone="violet" />
        <Kpi label="Pending" value={kpi.pending} tone="amber" />
        <Kpi label="Overdue" value={kpi.overdue} tone="rose" alert={kpi.overdue > 0} />
      </div>

      {/* by day */}
      {perDay.length > 0 && (
        <div className="card card-pad">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[14px] font-bold">Work by day</h2>
            <span className="text-[12px] text-[var(--muted)]">(assigned date · {perDay.length} days)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {perDay.map(([d, v]) => (
              <button key={d} onClick={() => setDay(day === d ? "ALL" : d)}
                className={`inline-flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[12.5px] transition ${day === d ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_8%,white)]" : "border-[var(--line-2)] hover:border-[var(--ink)]"}`}>
                <span className="font-semibold">{shortDate(d)}</span>
                <span className="text-[var(--muted)] tnum">{v.done}/{v.total} done</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* per-member summary */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3.5">
          <h2 className="text-[14.5px] font-bold">Per-member summary</h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">Based on the current filters · {perMember.length} members</p>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Member", "Role", "Total", "Done", "In prog", "Review", "Pending", "Overdue", "Completion"].map((h, i) => <th key={h} className={`th px-5 py-2.5 ${i >= 2 && i <= 7 ? "text-center" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {perMember.map((m) => {
                const p = m.total ? Math.round((m.done / m.total) * 100) : 0;
                return (
                  <tr key={m.name} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3 text-[13.5px] font-semibold">{m.name}</td>
                    <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: m.role === "DESIGNER" ? "var(--amber)" : "var(--rose)" }}>{m.role === "DESIGNER" ? <Palette size={13} /> : <Clapperboard size={13} />}{m.role === "DESIGNER" ? "Designer" : "Editor"}</span></td>
                    <td className="px-5 py-3 text-center text-[13px] font-bold tnum">{m.total}</td>
                    <td className="px-5 py-3 text-center text-[13px] tnum" style={{ color: "var(--emerald)" }}>{m.done || "—"}</td>
                    <td className="px-5 py-3 text-center text-[13px] tnum" style={{ color: "var(--sky)" }}>{m.prog || "—"}</td>
                    <td className="px-5 py-3 text-center text-[13px] tnum" style={{ color: "var(--violet)" }}>{m.review || "—"}</td>
                    <td className="px-5 py-3 text-center text-[13px] tnum text-[var(--muted)]">{m.pending || "—"}</td>
                    <td className="px-5 py-3 text-center text-[13px] tnum" style={{ color: m.overdue ? "var(--rose)" : "var(--faint)", fontWeight: m.overdue ? 700 : 400 }}>{m.overdue || "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${p}%`, background: p >= 80 ? "var(--emerald)" : p >= 50 ? "var(--violet)" : "var(--amber)" }} /></div>
                        <span className="w-9 text-right text-[12px] font-semibold tnum text-[var(--muted)]">{p}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {perMember.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No work matches these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* detailed table */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
          <div>
            <h2 className="text-[14.5px] font-bold">Detailed work log</h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">{filtered.length} items · newest assigned first</p>
          </div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[900px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Assigned", "Member", "Item", "Client", "Type", "Priority", "Status", "Due", ""].map((h, i) => <th key={i} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((r) => {
                const st = CREATIVE_STATUS[r.status as keyof typeof CREATIVE_STATUS];
                return (
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3 text-[12.5px] text-[var(--muted)] tnum whitespace-nowrap">{shortDate(r.assignedDate)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-[13px] font-semibold">{r.member}</span>
                      <span className="ml-1.5 align-middle" title={r.role === "DESIGNER" ? "Designer" : "Editor"} style={{ color: r.role === "DESIGNER" ? "var(--amber)" : "var(--rose)" }}>{r.role === "DESIGNER" ? "◧" : "▶"}</span>
                    </td>
                    <td className="px-5 py-3"><div className="text-[13px] font-medium">{r.title}</div><div className="text-[11px] text-[var(--faint)] tnum">{r.code} · {r.source === "ADDITIONAL" ? "Additional" : "Onboarding"}</div></td>
                    <td className="px-5 py-3 text-[12.5px]">{r.client}</td>
                    <td className="px-5 py-3 text-[12px] text-[var(--muted)]">{r.type}</td>
                    <td className="px-5 py-3"><span className="text-[11.5px] font-bold" style={{ color: PRIORITY_TONE[r.priority] }}>{r.priority}</span></td>
                    <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: `color-mix(in srgb, ${r.overdue ? "var(--rose)" : STATUS_TONE[r.status]} 12%, white)`, color: r.overdue ? "var(--rose)" : STATUS_TONE[r.status] }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: r.overdue ? "var(--rose)" : STATUS_TONE[r.status] }} />{r.overdue ? "Overdue" : st?.label ?? r.status}</span></td>
                    <td className="px-5 py-3 text-[12.5px] text-[var(--muted)] tnum whitespace-nowrap">{shortDate(r.dueDate)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2.5">
                        {r.finalLink && <a href={r.finalLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--violet)]">Final <ExternalLink size={12} /></a>}
                        <form action={deleteCreativeTask}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="from" value="report" />
                          <button title="Delete this task" onClick={(e) => { if (!window.confirm(`Delete "${r.title}" (${r.code})? This can't be undone.`)) e.preventDefault(); }} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line-2)] text-[var(--muted)] transition hover:border-[var(--rose)] hover:text-[var(--rose)]"><Trash2 size={13} /></button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No work matches these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Sel({ value, onChange, all, opts, raw }: { value: string; onChange: (v: string) => void; all?: string; opts?: [string, string][]; raw?: [string, string][] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface)] py-2 pl-3 pr-8 text-[12.5px] font-medium outline-none focus:border-[var(--violet)]">
        {raw ? raw.map(([v, l]) => <option key={v} value={v}>{l}</option>)
          : (<><option value="ALL">{all}</option>{opts?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
    </div>
  );
}

function Kpi({ label, value, sub, tone, alert }: { label: string; value: number; sub?: string; tone: string; alert?: boolean }) {
  const c: Record<string, string> = { ink: "var(--ink)", emerald: "var(--emerald)", sky: "var(--sky)", violet: "var(--violet)", amber: "var(--amber)", rose: "var(--rose)" };
  return (
    <div className="card card-pad" style={alert ? { background: "color-mix(in srgb, var(--rose) 5%, white)", borderColor: "color-mix(in srgb, var(--rose) 30%, white)" } : undefined}>
      <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: tone === "ink" ? "var(--muted)" : c[tone] }}>{label}</div>
      <div className="mt-1.5 text-[24px] font-extrabold leading-none tracking-tight tnum">{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
}
