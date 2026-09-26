import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSlaBoard } from "@/lib/queries";
import SlaBoard from "@/components/SlaBoard";

export const dynamic = "force-dynamic";

const SALES = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD", "SALES_EXEC"];
const FINANCE = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export default async function SlaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canUpload = SALES.includes(user.role);
  const canGenerate = FINANCE.includes(user.role);
  if (!canUpload && !canGenerate) redirect("/");
  const { rows, counts, totals } = await getSlaBoard();
  return <SlaBoard rows={rows} counts={counts} totals={totals} canUpload={canUpload} canGenerate={canGenerate} />;
}
