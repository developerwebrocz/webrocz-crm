import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getGstSummary } from "@/lib/queries";
import FinanceGst from "@/components/FinanceGst";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export default async function FinanceGstPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const { rows, supplierState } = await getGstSummary();
  return <FinanceGst rows={rows} supplierState={supplierState} />;
}
