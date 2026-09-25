"use client";

import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

// Role-appropriate quick nav for mobile (mirrors the sidebar, so no role sees another
// role's sections). Falls back to an admin/overview set for management roles.
const FINANCE_NAV: Item[] = [
  { href: "/", label: "Dashboard" },
  { href: "/accounts", label: "Clients" },
  { href: "/dm-clients", label: "DM Clients" },
  { href: "/sla", label: "SLAs" },
  { href: "/renewals", label: "Renewals" },
  { href: "/gst", label: "GST" },
  { href: "/statements", label: "Reports" },
  { href: "/invoices", label: "Invoices" },
];
const SALES_NAV: Item[] = [
  { href: "/", label: "Dashboard" },
  { href: "/sales?stage=POSITIVE_LEAD", label: "Positive Leads" },
  { href: "/sales?stage=ALL", label: "All Leads" },
  { href: "/sales?stage=QUOTATION", label: "Quotation" },
  { href: "/sales?stage=ONBOARDED", label: "Onboarding" },
  { href: "/sla", label: "Upload SLA" },
];
const ADMIN_NAV: Item[] = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/updates", label: "Update Work" },
  { href: "/am", label: "AM Panel" },
  { href: "/ads", label: "Meta Ads" },
  { href: "/smo", label: "SM Posts" },
  { href: "/invoices", label: "Invoices" },
  { href: "/reports", label: "Reports" },
  { href: "/team", label: "Team" },
];

function navFor(role: string): Item[] {
  if (role === "ACCOUNTANT") return FINANCE_NAV;
  if (role === "SALES_HEAD" || role === "SALES_EXEC") return SALES_NAV;
  return ADMIN_NAV; // SUPER_ADMIN / SUB_ADMIN and other management roles
}

export default function MobileNav({ role }: { role: string }) {
  const path = usePathname();
  const nav = navFor(role);
  const active = (href: string) => { const base = href.split("?")[0]; return base === "/" ? path === "/" : path.startsWith(base); };
  return (
    <nav className="md:hidden sticky top-16 z-30 flex gap-1.5 overflow-x-auto scroll-thin border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
      {nav.map((n) => (
        <a key={n.href} href={n.href} className={`pill ${active(n.href) ? "pill-dark" : ""}`}>{n.label}</a>
      ))}
    </nav>
  );
}
