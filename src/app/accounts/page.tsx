import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getFinanceClients } from "@/lib/queries";
import FinanceClients from "@/components/FinanceClients";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export default async function FinanceClientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const { rows } = await getFinanceClients();
  return <FinanceClients rows={rows} />;
}
