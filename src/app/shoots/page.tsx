import { getShootBoard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import ShootBoard from "@/components/ShootBoard";

export const dynamic = "force-dynamic";

const ALLOWED = ["STUDIO_HEAD", "VIDEOGRAPHER", "SUPER_ADMIN", "SUB_ADMIN"];

export default async function ShootsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const d = await getShootBoard(user.id, user.role);
  return (
    <ShootBoard
      rows={d.rows} kpis={d.kpis} clientOptions={d.clientOptions} shooters={d.shooters}
      canManage={d.canManage} canAdd={d.canAdd} selfId={d.selfId} today={d.today} userName={user.name}
    />
  );
}
