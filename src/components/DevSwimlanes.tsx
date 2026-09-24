"use client";

import { useState } from "react";
import { DEV_PLATFORMS, PROJECT_STATUS, PROJECT_STATUS_KEYS, PRIORITIES } from "@/lib/domain";
import { Avatar } from "./ui";

const TONE: Record<string, string> = { slate: "var(--ink-2)", violet: "var(--violet)", amber: "var(--amber)", emerald: "var(--emerald)", rose: "var(--rose)", sky: "var(--sky)", indigo: "var(--indigo)" };
const PLAT_SHORT: Record<string, string> = { WORDPRESS: "WP", SHOPIFY: "SH", REACT: "Re", NEXTJS: "Nx", NODEJS: "Nd", HTML: "</>" };

type Row = {
  id: string; name: string; client: string | null; assignee: string | null; assigneeId: string | null;
  platform: string; status: string; priority: string; progress: number;
  repoUrl: string; liveUrl: string; notes: string; taskDone: number; taskTotal: number;
};
type Dev = { id: string; name: string };

export default function DevSwimlanes({ rows, devs, updateAction }: { rows: Row[]; devs: Dev[]; updateAction: (fd: FormData) => Promise<void> | void }) {
  const [items, setItems] = useState<Row[]>(rows);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  async function move(id: string, status: string) {
    const r = items.find((x) => x.id === id);
    if (!r || r.status === status) return;
    setItems((s) => s.map((x) => (x.id === id ? { ...x, status } : x)));
    const fd = new FormData();
    fd.set("id", id); fd.set("status", status); fd.set("priority", r.priority);
    fd.set("progress", String(r.progress)); fd.set("liveUrl", r.liveUrl); fd.set("repoUrl", r.repoUrl); fd.set("notes", r.notes);
    try { await updateAction(fd); } catch { /* optimistic */ }
  }

  // lanes: each developer that has projects, plus Unassigned
  const lanes: { id: string | null; name: string }[] = [
    ...devs.filter((d) => items.some((r) => r.assigneeId === d.id)).map((d) => ({ id: d.id as string | null, name: d.name })),
    ...(items.some((r) => !r.assigneeId) ? [{ id: null, name: "Unassigned" }] : []),
  ];

  return (
    <div className="space-y-3">
      {lanes.map((lane) => {
        const laneRows = items.filter((r) => r.assigneeId === lane.id);
        return (
          <div key={lane.id ?? "none"} className="card overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5">
              <Avatar name={lane.name} size={28} tone={lane.id ? undefined : "slate"} />
              <span className="text-[13.5px] font-bold">{lane.name}</span>
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--surface-3)] px-1.5 text-[11px] font-bold text-[var(--ink-2)] tnum">{laneRows.length}</span>
            </div>
            <div className="overflow-x-auto scroll-thin p-3">
              <div className="flex gap-3" style={{ minWidth: "min-content" }}>
                {PROJECT_STATUS_KEYS.map((k) => {
                  const cfg = PROJECT_STATUS[k]; const tone = TONE[cfg.tone];
                  const cards = laneRows.filter((r) => r.status === k);
                  const okey = `${lane.id}:${k}`;
                  return (
                    <div key={k}
                      onDragOver={(e) => { e.preventDefault(); setOver(okey); }}
                      onDragLeave={() => setOver((o) => (o === okey ? null : o))}
                      onDrop={(e) => { e.preventDefault(); if (dragId) move(dragId, k); setDragId(null); setOver(null); }}
                      className={`w-[220px] flex-none rounded-[var(--r-md)] border p-2 transition-colors ${over === okey ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_5%,var(--surface-2))]" : "border-[var(--line)] bg-[var(--surface-2)]"}`}
                    >
                      <div className="flex items-center gap-1.5 px-1 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: tone }}>{cfg.label}</span>
                        <span className="ml-auto text-[11px] font-bold text-[var(--muted)] tnum">{cards.length}</span>
                      </div>
                      <div className="mt-1.5 space-y-2 min-h-[40px]">
                        {cards.map((r) => {
                          const pf = DEV_PLATFORMS[r.platform as keyof typeof DEV_PLATFORMS];
                          const platTone = TONE[pf?.tone ?? "slate"];
                          const pr = PRIORITIES[r.priority as keyof typeof PRIORITIES];
                          return (
                            <div key={r.id} draggable onDragStart={() => setDragId(r.id)} onDragEnd={() => { setDragId(null); setOver(null); }}
                              className="cursor-grab rounded-[var(--r-sm,8px)] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-sm active:cursor-grabbing" style={{ borderLeft: `3px solid ${platTone}` }}>
                              <div className="flex items-start gap-1.5">
                                <span className="grid h-5 w-5 flex-none place-items-center rounded text-[8px] font-extrabold" style={{ background: `color-mix(in srgb, ${platTone} 13%, white)`, color: platTone }}>{PLAT_SHORT[r.platform] ?? "•"}</span>
                                <span className="flex-1 text-[12px] font-semibold leading-tight">{r.name}</span>
                                {pr && <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: TONE[pr.tone] }} title={`${pr.label} priority`} />}
                              </div>
                              <div className="mt-1.5 h-1 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, r.progress)}%`, background: tone }} /></div>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)] tnum">
                                <span className="truncate">{r.client ?? "Internal"}</span>
                                {r.taskTotal > 0 && <span>{r.taskDone}/{r.taskTotal}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
