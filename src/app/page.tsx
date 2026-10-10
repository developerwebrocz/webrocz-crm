import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { PeriodKey } from "@/lib/period";
import AgencyDashboard from "@/components/AgencyDashboard";
import RoleDashboard from "@/components/RoleDashboard";
import SeoEmployeeOverview from "@/components/SeoEmployeeOverview";
import AmOverview from "@/components/AmOverview";
import MyShootsStrip from "@/components/MyShootsStrip";
import TodayEditCount from "@/components/TodayEditCount";
import CreativeBoard from "@/components/CreativeBoard";
import ShootBoard from "@/components/ShootBoard";
import { getSeoEmployeeBoard, getCreativeBoard, getSalesBoard, getAccountantDashboard, getShootBoard } from "@/lib/queries";
import SalesDashboard from "@/components/SalesDashboard";
import AccountantDashboard from "@/components/AccountantDashboard";

export const dynamic = "force-dynamic";

// Only the Super Admin sees the full agency overview; everyone else sees their own workspace.
const ADMIN_ROLES = ["SUPER_ADMIN", "SUB_ADMIN"];
// SEO team members get their own dashboard, built from the SEO team's Google Sheet.
const SEO_ROLES = ["SEO", "SEO_HEAD"];
// Account Managers get an ads-focused dashboard → Meta / Google / SM Posts boards.
const AM_ROLES = ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"];
// Designers & Video Editors land on their own assigned-work board (design-matched).
const DESIGN_ROLES = ["DESIGNER"];
const VIDEO_ROLES = ["EDITOR"];

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Unified CRM: "/" is ALWAYS the overview dashboard, rendered in-shell — no redirect
  // to a standalone console. The Super Admin sees the full agency overview; every other
  // role sees their own workspace overview. Their primary section (SEO / Designs / Videos /
  // Developer / Ads) is one click away in the shared sidebar.
  const sp = await searchParams;
  // Sales team → a dedicated Sales Dashboard (overview cards); the pipeline/table is /sales.
  if (user.role === "SALES_HEAD" || user.role === "SALES_EXEC") {
    const d = await getSalesBoard(user.id, user.role);
    return <SalesDashboard rows={d.rows} dueReminders={d.dueReminders} pipeline="WEBROCZ" userName={user.name} />;
  }
  // Website Head → the Website/Developer module (assign & monitor projects).
  if (user.role === "DEV_HEAD") redirect("/projects");
  // Digital Marketing Head → the marketing-clients assignment module.
  if (user.role === "DM_HEAD") redirect("/dm");
  // Accountant → a dedicated finance dashboard (clients + invoices + employees).
  if (user.role === "ACCOUNTANT") {
    const d = await getAccountantDashboard();
    return <AccountantDashboard totals={d.totals} invoiceRows={d.invoiceRows} monthlyRows={d.monthlyRows} employees={d.employees} aging={d.aging} userName={user.name} />;
  }
  if (ADMIN_ROLES.includes(user.role)) {
    const period = (typeof sp.period === "string" ? sp.period : "month") as PeriodKey;
    // Super Admin sees the agency overview AND the full Accountant / Finance dashboard below it
    // (same view the Accountant gets) — one place for the whole business + finance.
    const fin = await getAccountantDashboard();
    return (
      <div className="space-y-10">
        <AgencyDashboard period={period} />
        <div className="border-t-2 border-[var(--line)] pt-8">
          <AccountantDashboard totals={fin.totals} invoiceRows={fin.invoiceRows} monthlyRows={fin.monthlyRows} employees={fin.employees} aging={fin.aging} userName={user.name} />
        </div>
      </div>
    );
  }
  if (SEO_ROLES.includes(user.role)) {
    const month = typeof sp.month === "string" ? sp.month : undefined;
    const data = await getSeoEmployeeBoard(user.id, user.role, month);
    return <SeoEmployeeOverview data={data} />;
  }
  if (AM_ROLES.includes(user.role)) {
    return <AmOverview user={{ id: user.id, name: user.name, role: user.role }} />;
  }
  // Designers & Video Editors get their creative board inside the SAME CRM shell as every
  // other role (shared sidebar / top bar / logout) — rendered with the embedded chrome.
  if (DESIGN_ROLES.includes(user.role)) {
    const d = await getCreativeBoard(user.id, user.role, "DESIGN");
    return <CreativeBoard kind="DESIGN" chrome="embedded" rows={d.rows} counts={d.counts} clients={d.clients} types={d.types} progress={d.progress} today={d.today} clientOptions={d.clientOptions} userName={user.name} />;
  }
  if (VIDEO_ROLES.includes(user.role)) {
    const d = await getCreativeBoard(user.id, user.role, "VIDEO");
    // A video editor can also be the shooter on a shoot (Studio X assigns it): those shoots
    // are shown on top of their own dashboard.
    // Today's editing count is entered right here, on top of the dashboard.
    return <div className="space-y-5"><TodayEditCount userId={user.id} /><MyShootsStrip userId={user.id} /><CreativeBoard kind="VIDEO" chrome="embedded" rows={d.rows} counts={d.counts} clients={d.clients} types={d.types} progress={d.progress} today={d.today} clientOptions={d.clientOptions} userName={user.name} /></div>;
  }
  // Studio X Head & Videographer land on the Shooting / Studio X board.
  if (user.role === "STUDIO_HEAD" || user.role === "VIDEOGRAPHER") {
    const d = await getShootBoard(user.id, user.role);
    return <ShootBoard rows={d.rows} kpis={d.kpis} clientOptions={d.clientOptions} shooters={d.shooters} canManage={d.canManage} canAdd={d.canAdd} selfId={d.selfId} today={d.today} userName={user.name} />;
  }
  return <RoleDashboard user={{ id: user.id, name: user.name, role: user.role }} />;
}
