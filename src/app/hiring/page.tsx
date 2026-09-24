import { getCandidates } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import HiringBoard from "@/components/HiringBoard";

export const dynamic = "force-dynamic";

const HR_ROLES = ["SUPER_ADMIN", "SUB_ADMIN"];

export default async function HiringPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!HR_ROLES.includes(user.role)) redirect("/");
  const d = await getCandidates();
  return <HiringBoard rows={d.rows} stageCount={d.stageCount} />;
}
