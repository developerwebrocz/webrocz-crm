import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { PeriodKey } from "@/lib/period";
import AgencyDashboard from "@/components/AgencyDashboard";
import RoleDashboard from "@/components/RoleDashboard";
import SeoEmployeeOverview from "@/components/SeoEmployeeOverview";
import AmOverview from "@/components/AmOverview";
import CreativeBoard from "@/components/CreativeBoard";
import { getSeoEmployeeBoard, getCreativeBoard, getAlerts, getSalesBoard, getAccountantDashboard } from "@/lib/queries";
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
    return <AccountantDashboard totals={d.totals} invoiceRows={d.invoiceRows} monthlyRows={d.monthlyRows} employees={d.employees} userName={user.name} />;
  }
  if (ADMIN_ROLES.includes(user.role)) {
    const period = (typeof sp.period === "string" ? sp.period : "month") as PeriodKey;
    return <AgencyDashboard period={period} />;
  }
  if (SEO_ROLES.includes(user.role)) {
    const month = typeof sp.month === "string" ? sp.month : undefined;
    const data = await getSeoEmployeeBoard(user.id, user.role, month);
    return <SeoEmployeeOverview data={data} />;
  }
  if (AM_ROLES.includes(user.role)) {
    return <AmOverview user={{ id: user.id, name: user.name, role: user.role }} />;
  }
  const studioChrome = user.impersonatedBy ? "embedded" : "studio";
  const alerts = studioChrome === "studio" ? await getAlerts(user.id) : undefined;
  if (DESIGN_ROLES.includes(user.role)) {
    const d = await getCreativeBoard(user.id, user.role, "DESIGN");
    return <CreativeBoard kind="DESIGN" chrome={studioChrome} rows={d.rows} counts={d.counts} clients={d.clients} types={d.types} progress={d.progress} today={d.today} clientOptions={d.clientOptions} userName={user.name} alerts={alerts} />;
  }
  if (VIDEO_ROLES.includes(user.role)) {
    const d = await getCreativeBoard(user.id, user.role, "VIDEO");
    return <CreativeBoard kind="VIDEO" chrome={studioChrome} rows={d.rows} counts={d.counts} clients={d.clients} types={d.types} progress={d.progress} today={d.today} clientOptions={d.clientOptions} userName={user.name} alerts={alerts} />;
  }
  return <RoleDashboard user={{ id: user.id, name: user.name, role: user.role }} />;
}
