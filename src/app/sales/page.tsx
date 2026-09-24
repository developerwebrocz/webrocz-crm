import { getSalesBoard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import SalesWorkspace from "@/components/SalesWorkspace";

export const dynamic = "force-dynamic";

const SALES_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD", "SALES_EXEC"];

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!SALES_ROLES.includes(user.role)) redirect("/");
  const sp = await searchParams;
  const pipeline = sp.pipeline === "DIGITALHAT" ? "DIGITALHAT" : "WEBROCZ";
  // Default landing = new Leads (Positive). Sidebar/toolbar can switch to a stage or "All stages".
  const initialStage = typeof sp.stage === "string" ? sp.stage : "POSITIVE_LEAD";
  const initialCategory = sp.category === "WEBSITE" || sp.category === "DM" ? sp.category : "ALL";
  const d = await getSalesBoard(user.id, user.role);
  const canPickExec = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD"].includes(user.role);
  return <SalesWorkspace rows={d.rows} dueReminders={d.dueReminders} upcomingReminders={d.upcomingReminders} execs={d.execs} canPickExec={canPickExec} myId={user.id} pipeline={pipeline} initialStage={initialStage} initialCategory={initialCategory} />;
}
