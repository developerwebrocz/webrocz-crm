"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { initials, ROLES } from "@/lib/domain";
import {
  LayoutDashboard, Users, UserCog, Megaphone, ClipboardList,
  FileBarChart, Search, UsersRound, Wallet, Images, Code2,
  CalendarDays, ClipboardCheck, ListChecks, Target, Palette, Clapperboard,
  Contact, CalendarClock, ReceiptText, FileText, CheckCircle2, XCircle, UserPlus, Repeat, Landmark, Building2, Globe, FileSignature,
} from "lucide-react";

type Item = { href: string; label: string; icon: React.ElementType; badge?: number; badgeTone?: "red" };
type Group = { label?: string; items: Item[] };

export default function Sidebar({ clientCount, approvalsCount = 0, taskCount = 0, reminderCount = 0, user }: { clientCount: number; approvalsCount?: number; taskCount?: number; reminderCount?: number; user: { name: string; role: string } }) {
  const path = usePathname();
  const sp = useSearchParams();
  const curStage = sp.get("stage") ?? "";
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
  const isHead = user.role.endsWith("_HEAD");

  const groups: Group[] = [];
  groups.push({ items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] });

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
  if (isDmHead) groups.push({ label: "Digital Marketing", items: [{ href: "/dm", label: "Marketing Clients", icon: UserCog }] });
  // Accountant finance suite — also shown to Super/Sub Admin (they oversee finance).
  const financeGroups: Group[] = [
    { label: "Companies", items: [
      { href: "/pipeline/web-solutions", label: "Web Solutions", icon: Globe },
      { href: "/pipeline/web-rocz", label: "Web Rocz", icon: Megaphone },
      { href: "/pipeline/web-rocz-pvt", label: "Web Rocz Pvt Ltd", icon: Building2 },
    ] },
    { label: "Finance", items: [
      { href: "/finance", label: "Finance Dashboard", icon: LayoutDashboard },
      { href: "/accounts", label: "All Clients", icon: Users },
      { href: "/dm-clients", label: "DM Clients", icon: Megaphone },
      { href: "/sla", label: "SLAs", icon: FileSignature },
      // Payments hidden for now — re-add when needed:
      // { href: "/payments", label: "Payments", icon: Wallet },
      { href: "/renewals", label: "Website renewals", icon: Repeat },
      { href: "/gst", label: "GST Summary", icon: Landmark },
      { href: "/statements", label: "Reports", icon: FileBarChart },
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
    if (isDev) work.push({ href: "/projects", label: "Developer Team", icon: Code2 });
    work.push({ href: "/tasks", label: "My Tasks", icon: ListChecks, badge: taskCount || undefined });
    // SEO team log their work inside SEO Performance, so no separate "Update Work"/"Approvals" clutter.
    if (!isSeo) work.push({ href: "/updates", label: "Update Work", icon: ClipboardList });
    if (isHead && !isSeo) work.push({ href: "/approvals", label: "Approvals", icon: ClipboardCheck, badge: approvalsCount || undefined });
    work.push({ href: "/reports", label: "Reports", icon: FileBarChart });
    groups.push({ label: "My Work", items: work });

    if (isManager) {
      groups.push({ label: "Marketing", items: [
        { href: "/ads", label: "Meta Ads", icon: Megaphone },
        { href: "/google-ads", label: "Google Ads", icon: Target },
        { href: "/smo", label: "SM Posts", icon: Images },
        ...(user.role === "DM_EXEC" ? [{ href: "/dm", label: "My Marketing Clients", icon: UserCog }] : []),
        { href: "/calendar", label: "Calendar", icon: CalendarDays },
      ] });
      groups.push({ label: "Clients", items: [{ href: "/clients", label: "Clients", icon: Users, badge: clientCount }] });
    }
  }

  const Row = ({ it }: { it: Item }) => {
    const on = active(it.href);
    return (
      <Link href={it.href} prefetch aria-current={on ? "page" : undefined}
        className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors ${on ? "bg-[var(--sb-panel)] text-white" : "text-[var(--sb-muted-2)] hover:bg-white/[0.05] hover:text-white"}`}>
        {on && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--violet-soft)]" />}
        <it.icon size={17} className={`flex-none ${on ? "text-white" : "text-[var(--sb-muted)] group-hover:text-white"}`} />
        <span className="flex-1 truncate">{it.label}</span>
        {typeof it.badge === "number" && it.badge > 0 && <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tnum ${it.badgeTone === "red" ? "text-white" : "bg-white/10"}`} style={it.badgeTone === "red" ? { background: "var(--rose)" } : undefined}>{it.badge}</span>}
      </Link>
    );
  };

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[240px] flex-none flex-col overflow-y-auto scroll-thin border-r border-[var(--sb-line)] bg-[var(--sb-bg)] px-3 py-4 md:flex">
      <nav className="space-y-5">
        {groups.map((g, i) => (
          <div key={i}>
            {g.label && <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sb-muted)]">{g.label}</div>}
            <div className="space-y-0.5">{g.items.map((it) => <Row key={it.label} it={it} />)}</div>
          </div>
        ))}
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
