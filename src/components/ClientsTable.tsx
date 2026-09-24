"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CLIENT_STATUS, inrShort } from "@/lib/domain";
import { Avatar, Badge, ServiceChips, Progress } from "./ui";

type Row = {
  id: string; code: string; name: string; status: string;
  industry: string | null; pocName: string | null; am: string | null;
  retainer: number; services: string[]; team: string[];
  agreed: number; completed: number; pct: number;
  band: { label: string; tone: string };
};

export default function ClientsTable({ rows, ams }: { rows: Row[]; ams: string[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [am, setAm] = useState("ALL");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (am !== "ALL" && r.am !== am) return false;
      if (q) {
        const hay = `${r.name} ${r.code} ${r.pocName ?? ""} ${r.industry ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, q, status, am]);

  return (
    <div className="card" >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--line)] p-3.5">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input className="input !pl-9" placeholder="Search clients, POC, industry…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All status</option>
          {Object.entries(CLIENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="select !w-auto" value={am} onChange={(e) => setAm(e.target.value)}>
          <option value="ALL">All AMs</option>
          {ams.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="tag tnum">{filtered.length} shown</span>
      </div>

      <div className="overflow-x-auto scroll-thin">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="th">Client &amp; POC</th>
              <th className="th">Account manager</th>
              <th className="th">Services</th>
              <th className="th">Budget</th>
              <th className="th">This month</th>
              <th className="th">Team</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} onClick={() => window.location.assign(`/clients/${r.id}`)} className="row-link cursor-pointer border-b border-[var(--line)] last:border-0">
                <td className="td">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.name} size={38} />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.name}</div>
                      <div className="text-xs text-[var(--muted)] truncate">{r.pocName} · {r.industry} · {r.code}</div>
                    </div>
                  </div>
                </td>
                <td className="td whitespace-nowrap text-[var(--ink-2)]">{r.am ?? "—"}</td>
                <td className="td"><ServiceChips services={r.services} /></td>
                <td className="td whitespace-nowrap font-semibold tnum">{inrShort(r.retainer)}<span className="text-xs font-normal text-[var(--muted)]">/mo</span></td>
                <td className="td min-w-[150px]">
                  <div className="flex items-center justify-between text-xs tnum">
                    <span className="font-semibold">{r.completed}/{r.agreed}</span>
                    <span className="text-[var(--muted)]">{r.pct}%</span>
                  </div>
                  <div className="mt-1.5"><Progress pct={r.pct} tone={r.band.tone} /></div>
                </td>
                <td className="td">
                  <div className="flex -space-x-2">
                    {r.team.slice(0, 3).map((t, i) => <Avatar key={i} name={t} size={28} className="ring-2 ring-white" />)}
                  </div>
                </td>
                <td className="td"><Badge tone={r.band.tone}>{CLIENT_STATUS[r.status as keyof typeof CLIENT_STATUS] ?? r.status}</Badge></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="td py-14 text-center">
                  {rows.length === 0 ? (
                    <div className="text-[var(--muted)]">
                      <div className="text-[15px] font-semibold text-[var(--ink)]">No clients yet</div>
                      <div className="mt-1 text-sm">Add your first client to get started.</div>
                      <a href="/clients/new" className="btn btn-violet mt-4 inline-flex">+ New client</a>
                    </div>
                  ) : (
                    <span className="text-[var(--muted)]">No clients match your filters.</span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
