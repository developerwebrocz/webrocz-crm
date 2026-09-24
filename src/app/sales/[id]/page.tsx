import { getLead } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import LeadDetail from "@/components/LeadDetail";

export const dynamic = "force-dynamic";

const SALES_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD", "SALES_EXEC"];

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!SALES_ROLES.includes(user.role)) redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const openModal = sp.do === "onboard" ? "onboard" : sp.do === "lost" ? "lost" : "";
  const d = await getLead(id, user.id, user.role);
  if (!d) redirect("/sales");
  // Flat sales team — every sales member can reassign, same as admin.
  const isAdmin = SALES_ROLES.includes(user.role);
  return <LeadDetail lead={d.lead} execs={d.execs} developers={d.developers} dmPeople={d.dmPeople} canManage={SALES_ROLES.includes(user.role)} isAdmin={isAdmin} openModal={openModal} />;
}
