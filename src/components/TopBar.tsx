"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { initials, ROLES } from "@/lib/domain";
import { logout } from "@/app/actions";
import { ChevronDown, LogOut } from "lucide-react";
import GlobalSearch from "./GlobalSearch";
import Notifications from "./Notifications";

type SearchItem = { id: string; label: string; sub: string; href: string };
type Alert = { tone: string; title: string; sub: string; href: string };

export default function TopBar({ user, search, alerts }: {
  user: { name: string; role: string };
  search?: { clients: SearchItem[]; projects: SearchItem[]; team: SearchItem[] };
  alerts?: { count: number; items: Alert[] };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const roleLabel = ROLES[user.role as keyof typeof ROLES] ?? user.role;

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
        <Link href="/" prefetch className="flex items-center">
          <Image src="/webrocz-horizontal.png" alt="WebRocz" width={175} height={45} className="h-[30px] w-auto object-contain" priority />
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {search && <GlobalSearch index={search} />}
          {alerts && <Notifications count={alerts.count} items={alerts.items} />}
          {(user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN" || user.role === "AM_HEAD" || user.role === "ACCOUNT_MANAGER" || user.role === "DM_EXEC") && (
            <Link href="/clients/new" prefetch className="btn btn-violet !py-2.5 hidden sm:inline-flex">+ New client</Link>
          )}

          <div className="relative" ref={ref}>
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-[var(--line-2)] py-1 pl-1 pr-2.5 transition hover:border-[var(--ink)]">
              <span className="avatar h-8 w-8" style={{ borderRadius: 999 }}>{initials(user.name)}</span>
              <span className="hidden text-left sm:block">
                <span className="block text-[13px] font-semibold leading-tight">{user.name}</span>
                <span className="block text-[10px] uppercase tracking-wider text-[var(--muted)]">{roleLabel}</span>
              </span>
              <ChevronDown size={15} className="text-[var(--muted)]" />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg">
                <div className="border-b border-[var(--line)] px-4 py-3">
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs text-[var(--muted)]">{roleLabel}</div>
                </div>
                <form action={logout}>
                  <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--rose)] hover:bg-[var(--surface-2)]">
                    <LogOut size={15} /> Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
