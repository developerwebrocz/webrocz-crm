import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProfitLoss, getExpenses } from "@/lib/queries";
import ProfitLoss from "@/components/ProfitLoss";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export default async function ProfitLossPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const [pl, expenses] = await Promise.all([getProfitLoss(), getExpenses()]);
  return <ProfitLoss pl={pl} expenses={expenses} canDelete={["SUPER_ADMIN", "SUB_ADMIN"].includes(user.role)} />;
}
