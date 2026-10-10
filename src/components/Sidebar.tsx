"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { initials, ROLES } from "@/lib/domain";
import {
  LayoutDashboard, Users, UserCog, Megaphone, ClipboardList,
  FileBarChart, Search, UsersRound, Wallet, Images, Code2,
  CalendarDays, ClipboardCheck, ListChecks, Target, Palette, Clapperboard,
  Contact, CalendarClock, ReceiptText, FileText, CheckCircle2, XCircle, UserPlus, Repeat, Landmark, Building2, Globe, FileSignature, ChevronDown, PieChart,
  Loader, Eye, AlertTriangle, LayoutGrid, Camera, ListOrdered, Film,
} from "lucide-react";

type Item = { href: string; label: string; icon: React.ElementType; badge?: number; badgeTone?: "red"; forceActive?: boolean; subItems?: Item[]; iconColor?: string; badgeBg?: string; badgeFg?: string; showZero?: boolean };
type Group = { label?: string; items: Item[] };

type Pipeline = { total: number; dueToday: number; inProgress: number; review: number; completed: number; overdue: number };
export default function Sidebar({ clientCount, approvalsCount = 0, taskCount = 0, reminderCount = 0, pipeline, user, myShoots = false }: { clientCount: number; approvalsCount?: number; taskCount?: number; reminderCount?: number; pipeline?: Pipeline; user: { name: string; role: string }; myShoots?: boolean }) {
  const path = usePathname();
  const sp = useSearchParams();
  const curStage = sp.get("stage") ?? "";
  const fParam = sp.get("f") ?? "";
  // Collapsible sidebar groups (remembered per browser).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem("wr_sb_collapsed") || "[]"); setCollapsed(new Set(Array.isArray(s) ? s : [])); } catch { /* ignore */ } }, []);
  const toggleGroup = (label: string) => setCollapsed((prev) => {
    const n = new Set(prev); if (n.has(label)) n.delete(label); else n.add(label);
    try { localStorage.setItem("wr_sb_collapsed", JSON.stringify([...n])); } catch { /* ignore */ }
    return n;
  });
  const active = (href: string) => {
    if (href === "/") return path === "/";
    const [p, query] = href.split("?");
    if (query) {
      const st = new URLSearchParams(query).get("stage");
      return path === p && curStage === st;
    }
    if (p === "/sales") return path === "/sales" && !curStage; // "All Leads" only when no stage filter
    return path.startsWith(p);
  };

  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN";
  const isManager = user.role === "AM_HEAD" || user.role === "ACCOUNT_MANAGER" || user.role === "DM_EXEC";
  const isDev = user.role === "WEB_DEV" || user.role === "DEV_HEAD";
  const isSeo = user.role === "SEO" || user.role === "SEO_HEAD";
  const isDesigner = user.role === "DESIGNER";
  const isEditor = user.role === "EDITOR";
  const isSales = user.role === "SALES_HEAD" || user.role === "SALES_EXEC";
  const isDmHead = user.role === "DM_HEAD";
  const isAccountant = user.role === "ACCOUNTANT";
  const isStudioHead = user.role === "STUDIO_HEAD";
  const isShooter = user.role === "VIDEOGRAPHER";
  const isHead = user.role.endsWith("_HEAD");

  const groups: Group[] = [];
  // Super Admin gets the Payments pipeline right at the top, next to the Dashboard
  // (everyone else who has it finds it under Accountants).
  const paymentsOnTop = user.role === "SUPER_ADMIN";
  groups.push({ items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }, ...(paymentsOnTop ? [{ href: "/payments", label: "Payments", icon: Wallet }] : [])] });

  // Sales nav split into two clear groups + reports.
  const leadsGroup: Group = { label: "Leads", items: [
    { href: "/sales?stage=POSITIVE_LEAD", label: "Positive Leads", icon: Contact },
    { href: "/sales?stage=FOLLOW_UP", label: "Follow-up", icon: CalendarClock },
    { href: "/sales?stage=ALL", label: "All Leads", icon: UsersRound },
  ] };
  const pipelineGroup: Group = { label: "Pipeline", items: [
    { href: "/sales?stage=QUOTATION", label: "Quotation", icon: FileText },
    { href: "/sales?stage=REMINDER", label: "Reminder", icon: CalendarClock, badge: reminderCount || undefined, badgeTone: "red" },
    { href: "/sales?stage=MEETING", label: "Meetings", icon: CalendarDays },
    { href: "/sales?stage=ONBOARDED", label: "Client Onboarding", icon: CheckCircle2 },
    { href: "/sla", label: "Upload SLA", icon: FileSignature },
    { href: "/sales?stage=LOST", label: "Lost", icon: XCircle },
  ] };
  const salesGroups: Group[] = [leadsGroup, pipelineGroup, ...(isAdmin || isSales ? [{ label: "Insights", items: [{ href: "/sales/reports", label: "Sales Reports", icon: FileBarChart }] }] : [])];

  if (isSales) groups.push(...salesGroups);
  if (isDmHead) groups.push({ label: "Digital Marketing", items: [
    { href: "/dm", label: "Marketing Clients", icon: UserCog },
    { href: "/reports/creative", label: "Creative Report", icon: FileBarChart },
  ] });
  // Companies pipeline — each billing entity expands into its own sections
  // (Clients / Invoices / Website renewals) when it's the one you're viewing.
  const companyMeta = [
    { key: "WEB_SOLUTIONS", slug: "web-solutions", label: "Web Solutions", icon: Globe, renewals: true, clientsLabel: "Clients" },
    { key: "WEB_ROCZ", slug: "web-rocz", label: "Web Rocz", icon: Megaphone, renewals: false, clientsLabel: "Clients" },
    { key: "WEB_ROCZ_PVT", slug: "web-rocz-pvt", label: "Web Rocz Pvt Ltd", icon: Building2, renewals: false, clientsLabel: "Clients" },
  ];
  const companyParam = sp.get("company") ?? "";
  const activeCoKey = (() => {
    const byPipe = companyMeta.find((c) => path === `/pipeline/${c.slug}`);
    if (byPipe) return byPipe.key;
    if (path.startsWith("/invoices")) { const c = companyMeta.find((c) => c.key === companyParam); if (c) return c.key; }
    if (path.startsWith("/renewals")) { const c = companyMeta.find((c) => c.slug === companyParam); if (c) return c.key; }
    return null;
  })();
  const companyItems: Item[] = companyMeta.map((c) => {
    const activeCo = activeCoKey === c.key;
    const subItems: Item[] = activeCo ? [
      { href: `/pipeline/${c.slug}`, label: c.clientsLabel, icon: Users, forceActive: path === `/pipeline/${c.slug}` },
      { href: `/invoices?company=${c.key}&hub=1`, label: "Invoices", icon: ReceiptText, forceActive: path.startsWith("/invoices") && companyParam === c.key },
      ...(c.renewals ? [{ href: `/renewals?company=${c.slug}`, label: "Website renewals", icon: Repeat, forceActive: path.startsWith("/renewals") && companyParam === c.slug }] : []),
    ] : [];
    return { href: `/pipeline/${c.slug}`, label: c.label, icon: c.icon, forceActive: activeCo, subItems };
  });
  // Accountant finance suite — also shown to Super/Sub Admin (they oversee finance).
  const financeGroups: Group[] = [
    { label: "Accountants", items: [...companyItems, ...(paymentsOnTop ? [] : [{ href: "/payments", label: "Payments", icon: Wallet }])] },
    { label: "Finance", items: [
      { href: "/dm-clients", label: "All DM Clients", icon: Megaphone },
      { href: "/sla", label: "SLAs", icon: FileSignature },
      // Website renewals now live under each company in the Companies group above.
      { href: "/statements", label: "Reports", icon: FileBarChart },
      { href: "/expenses", label: "Expenses", icon: Wallet },
      ...(isAdmin ? [{ href: "/profit-loss", label: "Profit & Loss", icon: PieChart }] : []),
      { href: "/gst", label: "GST Report", icon: Landmark },
      { href: "/invoices", label: "Invoices", icon: ReceiptText },
    ] },
  ];
  if (isAccountant) groups.push(...financeGroups);

  if (isAdmin) {
    groups.push(...salesGroups);
    groups.push({ label: "Marketing", items: [
      { href: "/seo", label: "SEO Performance", icon: Search },
      { href: "/ads", label: "Meta Ads", icon: Megaphone },
      { href: "/google-ads", label: "Google Ads", icon: Target },
      { href: "/smo", label: "SM Posts", icon: Images },
      { href: "/dm", label: "Marketing Clients", icon: UserCog },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ] });
    groups.push({ label: "Delivery", items: [
      { href: "/designs", label: "Design Studio", icon: Palette },
      { href: "/videos", label: "Video Studio", icon: Clapperboard },
      { href: "/client-videos", label: "Client Videos", icon: Film },
      { href: "/video-team", label: "Editing Count", icon: ListOrdered },
      { href: "/shoots", label: "Studio X", icon: Camera },
      { href: "/reports/creative", label: "Creative Report", icon: FileBarChart },
      { href: "/projects", label: "Developer Team", icon: Code2 },
    ] });
    groups.push({ label: "Clients", items: [
      { href: "/clients", label: "Clients", icon: Users, badge: clientCount },
      { href: "/am", label: "AM Panel", icon: UserCog },
      // Invoices now live in the Finance group below (added for admins too).
    ] });
    groups.push({ label: "Team", items: [
      { href: "/tasks", label: "Tasks", icon: ListChecks, badge: taskCount || undefined },
      { href: "/approvals", label: "Approvals", icon: ClipboardCheck, badge: approvalsCount || undefined },
      { href: "/reports", label: "Reports", icon: FileBarChart },
      { href: "/team", label: "Team", icon: UsersRound },
      { href: "/hiring", label: "Hiring", icon: UserPlus },
      { href: "/billing", label: "Billing", icon: Wallet },
    ] });
    groups.push(...financeGroups); // Super/Sub Admin also oversee the accountant finance suite
  } else if (isSales) {
    // Sales team → clean, pipeline-only sidebar (Sales group already added above).
  } else if (isAccountant) {
    // Accountant → finance-only (Invoices group already added above).
  } else {
    // role-primary console + personal work
    const work: Item[] = [];
    if (isSeo) work.push({ href: "/seo", label: "SEO Performance", icon: Search });
    if (isDesigner) work.push({ href: "/designs", label: "My Designs", icon: Palette });
    if (isEditor) work.push({ href: "/videos", label: "My Videos", icon: Clapperboard });
    // the video team's daily count (was a Google Sheet); the team lead sees the whole team there
    // client shoots and their editing / posting status (was the "Video Shoots Status" sheet)
    if (isEditor) work.push({ href: "/client-videos", label: "Client Videos", icon: Film });
    if (isEditor) work.push({ href: "/video-team", label: "Editing Count", icon: ListOrdered });
    if (isStudioHead) work.push({ href: "/shoots", label: "Studiox Shoot", icon: Camera });
    // only the video editors on the shoot team (they are assigned as the shooter) get the same link
    if (isShooter || (isEditor && myShoots)) work.push({ href: "/shoots", label: "My Shoots", icon: Camera });
    if (isDev) work.push({ href: "/projects", label: "Developer Team", icon: Code2 });
    work.push({ href: "/tasks", label: "My Tasks", icon: ListChecks, badge: taskCount || undefined });
    // SEO team log their work inside SEO Performance, so no separate "Update Work"/"Approvals" clutter.
    // (the Studio X head works from the shoots board, so no "Update Work" there either)
    if (!isSeo && !isStudioHead) work.push({ href: "/updates", label: "Update Work", icon: ClipboardList });
    if (isHead && !isSeo) work.push({ href: "/approvals", label: "Approvals", icon: ClipboardCheck, badge: approvalsCount || undefined });
    work.push({ href: "/reports", label: "Reports", icon: FileBarChart });
    groups.push({ label: "My Work", items: work });

    // Designer / Editor status pipeline — colour-coded shortcuts that filter their board.
    if (isDesigner || isEditor) {
      const base = isDesigner ? "/designs" : "/videos";
      const p = pipeline ?? { total: 0, dueToday: 0, inProgress: 0, review: 0, completed: 0, overdue: 0 };
      const noun = isDesigner ? "Designs" : "Videos";
      const pipe = [
        { key: "ALL", label: `Assigned ${noun}`, icon: LayoutGrid, color: "#CBD5E1", bg: "rgba(148,163,184,.22)", fg: "#E2E8F0", n: p.total },
        { key: "DUE_TODAY", label: "Due Today", icon: CalendarClock, color: "#F59E0B", bg: "rgba(245,158,11,.20)", fg: "#FDBA74", n: p.dueToday },
        { key: "IN_PROGRESS", label: "In Progress", icon: Loader, color: "#3B82F6", bg: "rgba(59,130,246,.20)", fg: "#93C5FD", n: p.inProgress },
        { key: "REVIEW", label: "Review Pending", icon: Eye, color: "#8B5CF6", bg: "rgba(139,92,246,.22)", fg: "#C4B5FD", n: p.review },
        { key: "COMPLETED", label: "Completed", icon: CheckCircle2, color: "#10B981", bg: "rgba(16,185,129,.20)", fg: "#6EE7B7", n: p.completed },
        { key: "OVERDUE", label: "Overdue", icon: AlertTriangle, color: "#EF4545", bg: "rgba(239,69,69,.20)", fg: "#FCA5A5", n: p.overdue },
      ];
      groups.push({ label: "Workspace", items: pipe.map((x) => ({
        href: x.key === "ALL" ? base : `${base}?f=${x.key}`, label: x.label, icon: x.icon, iconColor: x.color,
        badge: x.n, badgeBg: x.bg, badgeFg: x.fg, showZero: true,
        forceActive: path.startsWith(base) && (x.key === "ALL" ? fParam === "" : fParam === x.key),
      })) });
    }

    if (isManager) {
      groups.push({ label: "Marketing", items: [
        { href: "/ads", label: "Meta Ads", icon: Megaphone },
        { href: "/google-ads", label: "Google Ads", icon: Target },
        { href: "/smo", label: "SM Posts", icon: Images },
        ...(user.role === "DM_EXEC" ? [{ href: "/dm", label: "My Marketing Clients", icon: UserCog }] : []),
        { href: "/reports/creative", label: "Creative Report", icon: FileBarChart },
        { href: "/calendar", label: "Calendar", icon: CalendarDays },
      ] });
      groups.push({ label: "Clients", items: [{ href: "/clients", label: "Clients", icon: Users, badge: clientCount }] });
    }
  }

  const Row = ({ it, sub }: { it: Item; sub?: boolean }) => {
    const on = it.forceActive ?? active(it.href);
    return (
      <Link href={it.href} prefetch aria-current={on ? "page" : undefined}
        className={`group relative flex items-center gap-3 rounded-[10px] ${sub ? "px-3 py-1.5 text-[12.5px]" : "px-3 py-2 text-[13.5px]"} font-medium transition-colors ${on ? "bg-[var(--sb-panel)] text-white" : "text-[var(--sb-muted-2)] hover:bg-white/[0.05] hover:text-white"}`}>
        {on && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--violet-soft)]" />}
        <it.icon size={sub ? 15 : 17} className={`flex-none ${!it.iconColor ? (on ? "text-white" : "text-[var(--sb-muted)] group-hover:text-white") : ""}`} style={it.iconColor ? { color: it.iconColor } : undefined} />
        <span className="flex-1 truncate">{it.label}</span>
        {typeof it.badge === "number" && (it.badge > 0 || it.showZero) && (
          it.badgeBg
            ? <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tnum" style={{ background: it.badgeBg, color: it.badgeFg }}>{it.badge}</span>
            : <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tnum ${it.badgeTone === "red" ? "text-white" : "bg-white/10"}`} style={it.badgeTone === "red" ? { background: "var(--rose)" } : undefined}>{it.badge}</span>
        )}
      </Link>
    );
  };

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[240px] flex-none flex-col overflow-y-auto scroll-thin border-r border-[var(--sb-line)] bg-[var(--sb-bg)] px-3 py-4 md:flex">
      <nav className="space-y-5">
        {groups.map((g, i) => {
          const isCol = !!g.label && collapsed.has(g.label);
          return (
          <div key={i}>
            {g.label && <button type="button" onClick={() => toggleGroup(g.label!)} className="mb-1.5 flex w-full items-center justify-between px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sb-muted)] transition-colors hover:text-white"><span>{g.label}</span><ChevronDown size={13} className={`flex-none transition-transform ${isCol ? "-rotate-90" : ""}`} /></button>}
            {!isCol && <div className="space-y-0.5">{g.items.map((it) => (
              <div key={it.label}>
                <Row it={it} />
                {it.subItems && it.subItems.length > 0 && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--sb-line)] pl-2">
                    {it.subItems.map((s) => <Row key={s.label} it={s} sub />)}
                  </div>
                )}
              </div>
            ))}</div>}
          </div>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-[var(--sb-line)] bg-[var(--sb-panel)] p-3">
        <span className="avatar h-9 w-9" style={{ borderRadius: 10 }}>{initials(user.name)}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{user.name}</div>
          <div className="truncate text-[11px] text-[var(--sb-muted-2)]">{ROLES[user.role as keyof typeof ROLES] ?? user.role}</div>
        </div>
      </div>
    </aside>
  );
}
