import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getFinanceClientDetail } from "@/lib/queries";
import FinanceClientDetail from "@/components/FinanceClientDetail";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

export default async function FinanceClientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const openPayId = typeof sp.pay === "string" ? sp.pay : "";
  const d = await getFinanceClientDetail(id);
  if (!d) redirect("/accounts");
  return <FinanceClientDetail client={d.client} invoices={d.invoices} payments={d.payments} totals={d.totals} openPayId={openPayId} />;
}
