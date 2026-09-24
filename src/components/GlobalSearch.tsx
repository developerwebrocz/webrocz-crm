"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Users, Code2, UserRound, CornerDownLeft } from "lucide-react";

type Item = { id: string; label: string; sub: string; href: string };
type Index = { clients: Item[]; projects: Item[]; team: Item[] };

export default function GlobalSearch({ index }: { index: Index }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) { const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); }
    setQ("");
  }, [open]);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    const f = (arr: Item[], k: number) => (n ? arr.filter((i) => i.label.toLowerCase().includes(n) || i.sub.toLowerCase().includes(n)) : arr).slice(0, k);
    return { clients: f(index.clients, n ? 6 : 5), projects: f(index.projects, 5), team: f(index.team, 5) };
  }, [q, index]);
  const flat = [...results.clients, ...results.projects, ...results.team];

  return (
    <>
      <button onClick={() => setOpen(true)} className="hidden items-center gap-2 rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--muted)] transition hover:border-[var(--ink)] sm:flex">
        <Search size={15} /> <span>Search…</span>
        <kbd className="ml-2 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--faint)]">⌘K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)] sm:hidden" aria-label="Search"><Search size={16} /></button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[560px] overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-4">
              <Search size={17} className="text-[var(--faint)]" />
              <input
                ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && flat[0]) window.location.assign(flat[0].href); }}
                placeholder="Search clients, projects, team…"
                className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-[var(--faint)]"
              />
            </div>
            <div className="max-h-[54vh] overflow-y-auto scroll-thin p-2">
              <Group title="Clients" icon={Users} items={results.clients} />
              <Group title="Developer projects" icon={Code2} items={results.projects} />
              <Group title="Team" icon={UserRound} items={results.team} />
              {flat.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-[var(--muted)]">No matches for “{q}”.</div>}
            </div>
            <div className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-2 text-[11px] text-[var(--faint)]">
              <span className="inline-flex items-center gap-1"><CornerDownLeft size={12} /> open</span>
              <span>esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Group({ title, icon: Icon, items }: { title: string; icon: typeof Users; items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]"><Icon size={11} /> {title}</div>
      {items.map((it) => (
        <a key={it.id} href={it.href} className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2 transition hover:bg-[var(--surface-2)]">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold">{it.label}</div>
            {it.sub && <div className="truncate text-[11.5px] text-[var(--muted)]">{it.sub}</div>}
          </div>
        </a>
      ))}
    </div>
  );
}
