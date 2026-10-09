"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Remembers the pages visited in this browser tab, so a "Back" button can return to the page
// the user actually came from — the same list, the same tab, with its filters — instead of a
// fixed page. (Saving a form reloads the same page, so plain browser-back often went nowhere,
// and the old fixed links dropped people on the all-invoices / all-clients page.)

const KEY = "wr-nav-trail";
// one-off flags added after a save; they are not part of "where the user was"
const TRANSIENT = ["saved", "sent", "client", "shoot", "pay"];

const pathOf = (url: string) => url.split("?")[0];
function read(): string[] { try { const a = JSON.parse(sessionStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }
function write(t: string[]) { try { sessionStorage.setItem(KEY, JSON.stringify(t.slice(-40))); } catch { /* storage blocked: Back falls back to its default page */ } }

// Mounted once in the app shell: notes every page change.
export function NavTrail() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    const p = new URLSearchParams(search.toString());
    for (const k of TRANSIENT) p.delete(k);
    const url = pathname + (p.toString() ? `?${p.toString()}` : "");
    const trail = read();
    // same page again (a save, a filter change) replaces the last entry instead of piling up
    if (trail.length && pathOf(trail[trail.length - 1]) === pathname) trail[trail.length - 1] = url;
    else trail.push(url);
    write(trail);
  }, [pathname, search]);
  return null;
}

// "Back": to the last different page in the trail; `fallback` when there is none (the page was
// opened directly, e.g. from a link or a new tab).
export function BackButton({ fallback, className = "btn btn-ghost btn-sm", label = "Back" }: { fallback: string; className?: string; label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = () => {
    const trail = read();
    while (trail.length && pathOf(trail[trail.length - 1]) === pathname) trail.pop();
    const target = trail.length ? trail[trail.length - 1] : fallback;
    write(trail);
    router.push(target);
  };
  return <button type="button" onClick={go} className={className}><ArrowLeft size={14} /> {label}</button>;
}
