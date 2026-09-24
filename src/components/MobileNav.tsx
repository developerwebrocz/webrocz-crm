"use client";

import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/updates", label: "Update Work" },
  { href: "/am", label: "AM Panel" },
  { href: "/ads", label: "Meta Ads" },
  { href: "/smo", label: "SM Posts" },
  { href: "/reports", label: "Reports" },
  { href: "/team", label: "Team" },
];

export default function MobileNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav className="md:hidden sticky top-16 z-30 flex gap-1.5 overflow-x-auto scroll-thin border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
      {NAV.map((n) => (
        <a key={n.href} href={n.href} className={`pill ${active(n.href) ? "pill-dark" : ""}`}>{n.label}</a>
      ))}
    </nav>
  );
}
