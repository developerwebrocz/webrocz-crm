import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getFinanceClients } from "@/lib/queries";
import FinanceClients from "@/components/FinanceClients";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

// Finance → DM Clients: every Digital Marketing client (across GST + non-GST), with follow-ups.
export default async function DmClientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const { rows } = await getFinanceClients();
  return <FinanceClients rows={rows} lockedCategory="DM" />;
}
