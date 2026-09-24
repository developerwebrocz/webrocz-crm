import { getDmClients } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import DmClients from "@/components/DmClients";

export const dynamic = "force-dynamic";

const DM_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "DM_HEAD", "DM_EXEC"];

export default async function DmPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!DM_ROLES.includes(user.role)) redirect("/");
  const d = await getDmClients(user.id, user.role);
  const canAssign = ["SUPER_ADMIN", "SUB_ADMIN", "DM_HEAD"].includes(user.role);
  return <DmClients rows={d.rows} execs={d.execs} counts={d.counts} canAssign={canAssign} />;
}
