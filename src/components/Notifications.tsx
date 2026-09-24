"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { markNotificationsRead } from "@/app/actions";

type Item = { tone: string; title: string; sub: string; href: string };
const TONE: Record<string, string> = { rose: "var(--rose)", amber: "var(--amber)", violet: "var(--violet)", emerald: "var(--emerald)" };
const ICON: Record<string, typeof Bell> = { rose: AlertTriangle, amber: Clock, violet: CheckCircle2, emerald: CheckCircle2 };

export default function Notifications({ count, items }: { count: number; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative grid h-9 w-9 place-items-center rounded-full border border-[var(--line-2)] text-[var(--ink-2)] transition hover:border-[var(--ink)]" aria-label="Notifications">
        <Bell size={17} />
        {count > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--rose)] px-1 text-[10px] font-bold text-white tnum">{count > 9 ? "9+" : count}</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <span className="text-sm font-bold">Notifications</span>
            {count > 0
              ? <form action={markNotificationsRead}><button className="text-[11.5px] font-semibold text-[var(--violet)] hover:underline">Mark all read</button></form>
              : <span className="badge badge-slate tnum">{count}</span>}
          </div>
          <div className="max-h-[360px] overflow-y-auto scroll-thin">
            {items.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">You&apos;re all caught up 🎉</div>}
            {items.map((it, i) => {
              const Icon = ICON[it.tone] ?? Bell;
              return (
                <a key={i} href={it.href} className="flex items-start gap-3 border-b border-[var(--line)] px-4 py-3 transition last:border-0 hover:bg-[var(--surface-2)]">
                  <span className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${TONE[it.tone]} 12%, white)`, color: TONE[it.tone] }}><Icon size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-snug">{it.title}</div>
                    <div className="text-[11.5px] text-[var(--muted)]">{it.sub}</div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
