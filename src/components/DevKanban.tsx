"use client";

import { useState } from "react";
import { DEV_PLATFORMS, PROJECT_TYPES, PROJECT_STATUS, PROJECT_STATUS_KEYS, PRIORITIES } from "@/lib/domain";
import { Avatar } from "./ui";
import { CalendarClock, ExternalLink, MessageSquare, GitBranch, Flag, CheckSquare } from "lucide-react";

const TONE: Record<string, string> = { slate: "var(--ink-2)", violet: "var(--violet)", amber: "var(--amber)", emerald: "var(--emerald)", rose: "var(--rose)", sky: "var(--sky)", indigo: "var(--indigo)" };
const PLAT_SHORT: Record<string, string> = { WORDPRESS: "WP", SHOPIFY: "SH", REACT: "Re", NEXTJS: "Nx", NODEJS: "Nd", HTML: "</>" };

type Row = {
  id: string; name: string; client: string | null; clientCode: string | null;
  assignee: string | null; assigneeId: string | null;
  projectType: string; platform: string; status: string; priority: string; progress: number;
  dueDate: string; liveUrl: string; repoUrl: string; notes: string;
  taskDone: number; taskTotal: number;
  daysLeft: number | null; overdue: boolean;
};

export default function DevKanban({ rows, updateAction }: { rows: Row[]; updateAction: (fd: FormData) => Promise<void> | void }) {
  const [items, setItems] = useState<Row[]>(rows);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function move(id: string, status: string) {
    const r = items.find((x) => x.id === id);
    if (!r || r.status === status) return;
    setItems((s) => s.map((x) => (x.id === id ? { ...x, status } : x))); // optimistic
    setSaving(id);
    const fd = new FormData();
    fd.set("id", id); fd.set("status", status); fd.set("priority", r.priority);
    fd.set("progress", String(r.progress)); fd.set("liveUrl", r.liveUrl); fd.set("repoUrl", r.repoUrl); fd.set("notes", r.notes);
    try { await updateAction(fd); } catch { /* keep optimistic; a reload will reconcile */ }
    setSaving(null);
  }

  return (
    <div className="overflow-x-auto scroll-thin pb-2">
      <div className="flex gap-4" style={{ minWidth: "min-content" }}>
        {PROJECT_STATUS_KEYS.map((k) => {
          const cfg = PROJECT_STATUS[k];
          const tone = TONE[cfg.tone];
          const colItems = items.filter((r) => r.status === k);
          return (
            <div
              key={k}
              onDragOver={(e) => { e.preventDefault(); setOverCol(k); }}
              onDragLeave={() => setOverCol((c) => (c === k ? null : c))}
              onDrop={(e) => { e.preventDefault(); if (dragId) move(dragId, k); setDragId(null); setOverCol(null); }}
              className={`w-[290px] flex-none rounded-[var(--r-lg)] border p-2.5 transition-colors ${overCol === k ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_5%,var(--surface-2))]" : "border-[var(--line)] bg-[var(--surface-2)]"}`}
            >
              {/* column header */}
              <div className="flex items-center gap-2 px-1.5 py-1">
                <span className="h-2 w-2 rounded-full" style={{ background: tone }} />
                <span className="text-[12.5px] font-bold uppercase tracking-wide" style={{ color: tone }}>{cfg.label}</span>
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[var(--surface-3)] px-1.5 text-[11px] font-bold text-[var(--ink-2)] tnum">{colItems.length}</span>
              </div>

              {/* cards */}
              <div className="mt-1.5 space-y-2.5 min-h-[60px]">
                {colItems.map((r) => {
                  const pf = DEV_PLATFORMS[r.platform as keyof typeof DEV_PLATFORMS];
                  const platTone = TONE[pf?.tone ?? "slate"];
                  return (
                    <div
                      key={r.id}
                      draggable
                      onDragStart={() => setDragId(r.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      className={`cursor-grab rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm active:cursor-grabbing ${saving === r.id ? "opacity-60" : ""}`}
                      style={{ borderLeft: `3px solid ${platTone}` }}
                    >
                      {(() => { const pr = PRIORITIES[r.priority as keyof typeof PRIORITIES]; return (
                      <div className="flex items-start gap-2">
                        <span className="grid h-7 w-7 flex-none place-items-center rounded-lg text-[10px] font-extrabold" style={{ background: `color-mix(in srgb, ${platTone} 13%, white)`, color: platTone }}>{PLAT_SHORT[r.platform] ?? "•"}</span>
                        <span className="flex-1 text-[13px] font-bold leading-tight">{r.name}</span>
                        {pr && <span className="flex flex-none items-center gap-0.5 text-[10px] font-bold uppercase" style={{ color: TONE[pr.tone] }} title={`${pr.label} priority`}><Flag size={11} /> {pr.label}</span>}
                      </div>
                      ); })()}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--muted)]">
                        <span className="font-semibold text-[var(--ink-2)]">{pf?.label ?? r.platform}</span>
                        <span>· {PROJECT_TYPES[r.projectType as keyof typeof PROJECT_TYPES] ?? r.projectType}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--muted)]">{r.client ? `${r.client}` : "Internal"}</div>

                      <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, r.progress)}%`, background: tone }} /></div>

                      <div className="mt-2.5 flex items-center gap-2">
                        <Avatar name={r.assignee ?? "?"} size={22} tone="slate" />
                        <span className="truncate text-[11px] font-medium text-[var(--ink-2)]">{r.assignee ?? "Unassigned"}</span>
                        <span className="ml-auto flex items-center gap-2 text-[10.5px] text-[var(--muted)] tnum">
                          {r.taskTotal > 0 && <span className="inline-flex items-center gap-0.5"><CheckSquare size={11} /> {r.taskDone}/{r.taskTotal}</span>}
                          {r.notes && <MessageSquare size={12} className="text-[var(--amber)]" />}
                          {r.repoUrl && <GitBranch size={12} className="text-[var(--ink-2)]" />}
                          {r.liveUrl && <ExternalLink size={12} className="text-[var(--violet)]" />}
                          {r.dueDate && (
                            r.overdue
                              ? <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-bold" style={{ background: "color-mix(in srgb, var(--rose) 12%, white)", color: "var(--rose)" }}><CalendarClock size={11} /> {Math.abs(r.daysLeft ?? 0)}d over</span>
                              : <span className="inline-flex items-center gap-0.5"><CalendarClock size={11} /> {r.daysLeft !== null && r.daysLeft <= 7 && r.status !== "LIVE" ? `${r.daysLeft}d left` : r.dueDate.slice(5)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {colItems.length === 0 && <div className="rounded-[var(--r-md)] border border-dashed border-[var(--line-2)] py-6 text-center text-[11px] text-[var(--faint)]">Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
