import { getCreativeReport } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreativeReport from "@/components/CreativeReport";

export const dynamic = "force-dynamic";

export default async function CreativeReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Designer/editor work oversight — Super Admin + the managers who assign creative work
  // (AM Head / Account Manager / DM Head / DM Exec) so they can track output.
  const ALLOWED = ["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "ACCOUNT_MANAGER", "DM_HEAD", "DM_EXEC"];
  if (!ALLOWED.includes(user.role)) redirect("/");
  const d = await getCreativeReport();
  return <CreativeReport rows={d.rows} clients={d.clients} types={d.types} days={d.days} members={d.members} assigners={d.assigners} clientOptions={d.clientOptions} today={d.today} currentUserId={user.id} />;
}
