import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getExpenses } from "@/lib/queries";
import ExpensesBoard from "@/components/ExpensesBoard";

export const dynamic = "force-dynamic";

// Accountants record expenses here; the profit view (/profit-loss) is Super Admin only.
const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const expenses = await getExpenses();
  return <ExpensesBoard expenses={expenses} canDelete={["SUPER_ADMIN", "SUB_ADMIN"].includes(user.role)} />;
}
