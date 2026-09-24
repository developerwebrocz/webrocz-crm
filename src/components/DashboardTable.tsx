"use client";

import { useMemo, useState } from "react";
import { Search, Images, Clapperboard } from "lucide-react";
import { CLIENT_STATUS, inrShort } from "@/lib/domain";
import { Avatar, Badge, Progress } from "./ui";

type Row = {
  id: string; code: string; name: string; status: string;
  pocName: string | null; pocMobile: string | null; am: string | null;
  retainer: number; services: string[]; team: string[];
  agreed: number; completed: number; pct: number;
  postsDone: number; postsAgreed: number; videosDone: number; videosAgreed: number;
  band: { label: string; tone: string };
};

// service -> {label, colored tag classes}
const SVC: Record<string, { label: string; cls: string }> = {
  SMO: { label: "Social", cls: "bg-pink-50 text-pink-600" },
  META_ADS: { label: "Meta", cls: "bg-blue-50 text-blue-600" },
  GOOGLE_ADS: { label: "Google", cls: "bg-amber-50 text-amber-600" },
  SEO: { label: "SEO", cls: "bg-emerald-50 text-emerald-600" },
  VIDEO: { label: "Video", cls: "bg-orange-50 text-orange-600" },
  CRM: { label: "CRM", cls: "bg-violet-50 text-violet-600" },
  WEBSITE_DEV: { label: "Web", cls: "bg-slate-100 text-slate-600" },
  BRANDING: { label: "Brand", cls: "bg-fuchsia-50 text-fuchsia-600" },
  OTHER: { label: "Other", cls: "bg-slate-100 text-slate-600" },
};

function SvcTag({ s }: { s: string }) {
  const m = SVC[s] ?? { label: s, cls: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
}

export default function DashboardTable({ rows, amList }: { rows: Row[]; amList: { name: string; count: number }[] }) {
  const [q, setQ] = useState("");
  const [am, setAm] = useState("ALL");

  const filtered = useMemo(() => rows.filter((r) => {
    if (am !== "ALL" && r.am !== am) return false;
    if (q) {
      const hay = `${r.name} ${r.pocName ?? ""} ${r.code}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, q, am]);

  return (
    <div className="space-y-3">
      {/* AM filter pills + search */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
        <button onClick={() => setAm("ALL")} className={`pill ${am === "ALL" ? "pill-dark" : ""}`}>All ({rows.length})</button>
        {amList.map((a) => (
          <button key={a.name} onClick={() => setAm(a.name)} className={`pill ${am === a.name ? "pill-dark" : ""}`}>
            {a.name} · {a.count}
          </button>
        ))}
        <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[280px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input className="input !h-9 !pl-9 !text-[13px]" placeholder="Search client / POC" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {/* table */}
      <div className="card">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="th">Client &amp; POC</th>
                <th className="th">AM</th>
                <th className="th">Services</th>
                <th className="th">Budget</th>
                <th className="th">Posts &amp; videos</th>
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
                        <div className="truncate font-semibold">{r.name}</div>
                        <div className="truncate text-xs text-[var(--muted)]">{r.pocName ?? "—"}{r.pocMobile ? ` · ${r.pocMobile}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td">{r.am ? <span className="rounded-full bg-[var(--ink)] px-2.5 py-1 text-[11.5px] font-semibold text-white">{r.am}</span> : <span className="text-[var(--muted)]">—</span>}</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {r.services.slice(0, 4).map((s) => <SvcTag key={s} s={s} />)}
                      {r.services.length > 4 && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">+{r.services.length - 4}</span>}
                    </div>
                  </td>
                  <td className="td whitespace-nowrap font-semibold tnum">{inrShort(r.retainer)}<span className="text-xs font-normal text-[var(--muted)]">/mo</span></td>
                  <td className="td min-w-[190px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><Progress pct={r.pct} tone={r.band.tone} /></div>
                      <span className="text-xs font-semibold tnum">{r.completed}/{r.agreed}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--muted)] tnum">
                      <span className="inline-flex items-center gap-1"><Images size={12} /> {r.postsDone}/{r.postsAgreed}</span>
                      <span className="inline-flex items-center gap-1"><Clapperboard size={12} /> {r.videosDone}/{r.videosAgreed}</span>
                      <span className="font-semibold" style={{ color: `var(--${r.band.tone})` }}>{r.pct}%</span>
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex -space-x-2">
                      {r.team.slice(0, 3).map((t, i) => <Avatar key={i} name={t} size={26} className="ring-2 ring-white" />)}
                    </div>
                  </td>
                  <td className="td"><Badge tone={r.band.tone}>{CLIENT_STATUS[r.status as keyof typeof CLIENT_STATUS] ?? r.status}</Badge></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="td py-12 text-center text-[var(--muted)]">{rows.length === 0 ? "No clients yet — add your first client." : "No clients match."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
