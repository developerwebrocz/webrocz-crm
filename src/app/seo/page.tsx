import { getSeoBoard, getSeoClient, getGmbBoard, getSeoReportsBoard, getSeoLeaderboard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import SeoConsole from "@/components/SeoConsole";
import SeoEmployeeDashboard from "@/components/SeoEmployeeDashboard";

export const dynamic = "force-dynamic";

export default async function SeoPage({ searchParams }: PageProps<"/seo">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : undefined;
  const clientId = typeof sp.client === "string" ? sp.client : undefined;
  const view = typeof sp.view === "string" ? sp.view : "clients";

  // SEO team members get the full pipeline + per-client editor (uploaded design).
  if (user.role === "SEO" || user.role === "SEO_HEAD") {
    return <SeoEmployeeDashboard user={{ id: user.id, name: user.name, role: user.role }} month={month} clientId={clientId} />;
  }

  const [d, gmb, reports, leaderboard, detail] = await Promise.all([
    getSeoBoard(user.id, user.role, month),
    getGmbBoard(user.id, user.role),
    getSeoReportsBoard(user.id, user.role, month),
    getSeoLeaderboard(month),
    clientId ? getSeoClient(clientId, user.id, user.role, month) : Promise.resolve(null),
  ]);

  return (
    <SeoConsole
      rows={d.rows} kpis={d.kpis} overall={d.overall}
      monthLabel={d.monthLabel} month={d.month} months={d.months}
      userName={user.name} userRole={user.role}
      view={view} gmb={gmb} reports={reports} leaderboard={leaderboard}
      detail={detail}
    />
  );
}
