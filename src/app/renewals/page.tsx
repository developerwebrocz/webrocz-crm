import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRetainers } from "@/lib/queries";
import FinanceRetainers from "@/components/FinanceRetainers";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export default async function FinanceRenewalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const { rows, counts, totals } = await getRetainers();
  return <FinanceRetainers rows={rows} counts={counts} totals={totals} />;
}
