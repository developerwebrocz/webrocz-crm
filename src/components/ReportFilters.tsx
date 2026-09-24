"use client";

import { DEPARTMENTS } from "@/lib/domain";

type Opt = { id: string; name: string };
type Current = { period: string; member: string; dept: string; client: string };

// No useSearchParams/usePathname (those force a Suspense boundary → streaming, which
// breaks in some browsers). Current values come from the server; navigation is a plain
// full-page load with the merged query string.
export default function ReportFilters({ users, clients, current }: { users: Opt[]; clients: Opt[]; current: Current }) {
  function set(key: string, val: string) {
    const merged: Record<string, string> = { period: current.period, member: current.member, dept: current.dept, client: current.client, [key]: val };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "period" && v === "month")) params.set(k, v);
    window.location.assign(`/reports${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="select !w-auto" value={current.member} onChange={(e) => set("member", e.target.value)}>
        <option value="">All members</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select className="select !w-auto" value={current.dept} onChange={(e) => set("dept", e.target.value)}>
        <option value="">All departments</option>
        {Object.entries(DEPARTMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select className="select !w-auto" value={current.client} onChange={(e) => set("client", e.target.value)}>
        <option value="">All clients</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}
