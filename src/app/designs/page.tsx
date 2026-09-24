import { getCreativeBoard, getAlerts } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreativeBoard from "@/components/CreativeBoard";

export const dynamic = "force-dynamic";

export default async function DesignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = await getCreativeBoard(user.id, user.role, "DESIGN");
  const chrome = user.role === "DESIGNER" && !user.impersonatedBy ? "studio" : "embedded";
  const alerts = chrome === "studio" ? await getAlerts(user.id) : undefined;
  return <CreativeBoard kind="DESIGN" chrome={chrome} rows={d.rows} counts={d.counts} clients={d.clients} types={d.types} progress={d.progress} today={d.today} clientOptions={d.clientOptions} userName={user.name} alerts={alerts} />;
}
