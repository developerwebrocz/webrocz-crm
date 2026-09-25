import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAccountantDashboard } from "@/lib/queries";
import AccountantDashboard from "@/components/AccountantDashboard";

export const dynamic = "force-dynamic";

// The full Accountant / Finance dashboard — same view the Accountant sees at "/",
// exposed here so Super Admin & Sub Admin can open it directly (in-shell).
const ALLOWED = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];

export default async function FinanceDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const d = await getAccountantDashboard();
  return <AccountantDashboard totals={d.totals} invoiceRows={d.invoiceRows} monthlyRows={d.monthlyRows} employees={d.employees} aging={d.aging} amUsers={d.amUsers} userName={user.name} />;
}
