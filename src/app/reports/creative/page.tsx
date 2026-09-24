import { getCreativeReport } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreativeReport from "@/components/CreativeReport";

export const dynamic = "force-dynamic";

export default async function CreativeReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Super Admin only — designer/editor oversight report.
  if (!(user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN")) redirect("/");
  const d = await getCreativeReport();
  return <CreativeReport rows={d.rows} clients={d.clients} types={d.types} days={d.days} members={d.members} clientOptions={d.clientOptions} today={d.today} />;
}
