import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getFinancePayments } from "@/lib/queries";
import FinancePayments from "@/components/FinancePayments";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export default async function FinancePaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const { rows } = await getFinancePayments();
  return <FinancePayments rows={rows} />;
}
