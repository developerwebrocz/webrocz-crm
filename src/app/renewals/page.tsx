import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getWebsiteRenewals } from "@/lib/queries";
import WebsiteRenewals from "@/components/WebsiteRenewals";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export default async function WebsiteRenewalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const { rows, counts, totals } = await getWebsiteRenewals();
  return <WebsiteRenewals rows={rows} counts={counts} totals={totals} />;
}
